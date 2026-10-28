import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsSavingsDeposit, smsSavingsWithdrawal, smsLoanRepayment } from "@/lib/sms"
import { notifySavingsDeposit, notifySavingsWithdrawal, notifyLoanRepaid } from "@/lib/notify"
import {
  computeAllocation,
  computeRepaymentState,
  roundMoney,
} from "@/lib/loan-repayment"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const type = searchParams.get("type") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
        { referenceNumber: { contains: search } },
      ]
    }

    if (type) {
      where.transactionType = type
    }

    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) {
        ;(where.transactionDate as Record<string, unknown>).gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        ;(where.transactionDate as Record<string, unknown>).lte = endDate
      }
    }

    const transactions = await prisma.savingsLedger.findMany({
      where,
      include: {
        member: {
          select: {
            farmerName: true,
            memberCode: true,
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    })

    const formatted = transactions.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.farmerName,
      memberCode: t.member.memberCode,
      transactionType: t.transactionType,
      amount: t.amount,
      withdrawalFee: t.withdrawalFee ?? 0,
      balanceAfter: t.balanceAfter,
      narration: t.narration,
      referenceNumber: t.referenceNumber,
      transactionDate: t.transactionDate.toISOString(),
    }))

    const summary = await prisma.savingsLedger.groupBy({
      by: ["transactionType"],
      _sum: { amount: true },
    })

    let totalDeposits = 0
    let totalWithdrawals = 0
    for (const s of summary) {
      if (s.transactionType === "Deposit") totalDeposits = s._sum.amount ?? 0
      if (s.transactionType === "Withdrawal") totalWithdrawals = s._sum.amount ?? 0
    }

    return NextResponse.json({
      transactions: formatted,
      summary: {
        totalDeposits,
        totalWithdrawals,
        netSavings: totalDeposits - totalWithdrawals,
      },
    })
  } catch (error) {
    console.error("GET /api/savings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch savings transactions" },
      { status: 500 }
    )
  }
}

/**
 * Apply part of a savings deposit to a member's active loans (oldest first).
 *
 * Uses the same reducing-balance engine as manual repayments so an automatic
 * offset books interest/principal identically to what an officer would record.
 * Returns the total applied to loans and a per-loan breakdown. Any amount the
 * loans cannot absorb (because they are cleared) is left for savings.
 */
async function applyDepositToLoans(
  tx: Prisma.TransactionClient,
  memberId: number,
  amount: number,
  asOf: Date
) {
  const activeLoans = await tx.loan.findMany({
    where: { memberId, loanStatus: "Active" },
    orderBy: { disbursementDate: "asc" },
    include: {
      repayments: {
        orderBy: { paymentDate: "desc" },
        take: 1,
        select: { paymentDate: true },
      },
      fines: {
        where: { status: "Pending" },
        orderBy: { createdAt: "asc" },
        select: { id: true, scheduleId: true, fineAmount: true, paidAmount: true },
      },
    },
  })

  let remaining = roundMoney(amount)
  let totalApplied = 0
  const applied: {
    loanId: number
    loanCode: string
    amountApplied: number
    interestPaid: number
    principalPaid: number
    finePaid: number
    newBalance: number
    loanCleared: boolean
  }[] = []

  for (const loan of activeLoans) {
    if (remaining <= 0) break

    // Fines still owed (a fine may have been partially paid already).
    const pendingFines = roundMoney(
      loan.fines.reduce(
        (sum, f) => sum + Math.max(0, (f.fineAmount || 0) - (f.paidAmount || 0)),
        0
      )
    )

    const balanceInput = {
      id: loan.id,
      loanCode: loan.loanCode,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      currentBalance: loan.currentBalance,
      outstandingPrincipal: loan.outstandingPrincipal,
      disbursementDate: loan.disbursementDate,
      lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
    }

    const state = computeRepaymentState(balanceInput, asOf, pendingFines)

    // Cash this loan can absorb right now: payoff (principal + accrued
    // interest) plus pending fines, never more than the balance the engine
    // allows in a single payment. Fines are settled first, mirroring the
    // officer's manual repayment screen.
    const cashCap = roundMoney(
      Math.min(remaining, state.maxAmountPaid + pendingFines, loan.currentBalance)
    )
    let finePart = roundMoney(Math.min(pendingFines, cashCap))
    let amountPart = roundMoney(Math.min(cashCap - finePart, state.maxAmountPaid))
    if (amountPart <= 0 && finePart > 0) {
      // The engine books no fine-only payment; pay the loan leg instead and
      // leave the fines pending for the next payment.
      finePart = 0
      amountPart = roundMoney(Math.min(cashCap, state.maxAmountPaid))
    }
    if (amountPart <= 0) continue

    const apply = roundMoney(finePart + amountPart)

    const result = computeAllocation(balanceInput, state, {
      amountPaid: amountPart,
      finePaid: finePart,
      paymentDate: asOf,
    })
    if (!result.ok) continue

    const allocation = result.allocation
    const referenceNumber = generateReference("OFFSET", Date.now() + applied.length)

    await tx.loanRepayment.create({
      data: {
        loanId: loan.id,
        amountPaid: amountPart,
        finePaid: allocation.feePaid,
        interestPaid: allocation.interestPaid,
        principalPaid: allocation.principalPaid,
        balanceAfter: allocation.newBalance,
        paymentDate: asOf,
        recordedBy: null,
        referenceNumber,
      },
    })

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        currentBalance: allocation.newBalance,
        outstandingPrincipal: allocation.newOutstandingPrincipal,
        ...(allocation.loanCleared ? { loanStatus: "Cleared" } : {}),
      },
    })

    // Track how much of the current installment is covered.
    const currentSchedule = await tx.loanRepaymentSchedule.findFirst({
      where: { loanId: loan.id, status: { in: ["Pending", "Partial"] } },
      orderBy: { dueDate: "asc" },
    })
    if (currentSchedule) {
      const paidSoFar = (currentSchedule.amountPaid ?? 0) + amountPart
      const expected = currentSchedule.totalAmount ?? 0
      const fullyPaid = expected > 0 ? paidSoFar >= expected : paidSoFar > 0
      await tx.loanRepaymentSchedule.update({
        where: { id: currentSchedule.id },
        data: { amountPaid: paidSoFar, status: fullyPaid ? "Paid" : "Partial" },
      })
    }

    // Settle pending fines the offset covered (oldest first; a fine may be
    // only partially covered, in which case it stays pending).
    let fineLeft = allocation.feePaid
    for (const fine of loan.fines) {
      if (fineLeft <= 0) break
      const owed = roundMoney(Math.max(0, (fine.fineAmount || 0) - (fine.paidAmount || 0)))
      if (owed <= 0) continue
      const pay = roundMoney(Math.min(owed, fineLeft))
      const paidNow = roundMoney((fine.paidAmount || 0) + pay)
      await tx.loanFine.update({
        where: { id: fine.id },
        data: {
          paidAmount: paidNow,
          paidDate: asOf,
          status: paidNow >= (fine.fineAmount || 0) ? "Paid" : "Pending",
        },
      })
      fineLeft = roundMoney(fineLeft - pay)
    }

    await tx.auditTrail.create({
      data: {
        actionType: "LoanRepayment",
        description:
          `Automatic savings offset of UGX ${apply.toLocaleString()} on loan ${loan.loanCode} ` +
          `(fines UGX ${allocation.feePaid.toLocaleString()}, ` +
          `interest UGX ${allocation.interestPaid.toLocaleString()}, ` +
          `principal UGX ${allocation.principalPaid.toLocaleString()})`,
        amount: apply,
        memberId,
        referenceNumber,
        tableName: "loan_repayments",
      },
    })

    applied.push({
      loanId: loan.id,
      loanCode: loan.loanCode,
      amountApplied: apply,
      interestPaid: allocation.interestPaid,
      principalPaid: allocation.principalPaid,
      finePaid: allocation.feePaid,
      newBalance: allocation.newBalance,
      loanCleared: allocation.loanCleared,
    })

    if (allocation.writtenOff > 0) {
      await tx.auditTrail.create({
        data: {
          actionType: "LoanWriteOff",
          description:
            `Booked interest of UGX ${allocation.writtenOff.toLocaleString()} written off on loan ` +
            `${loan.loanCode} because outstanding principal was cleared before all booked interest accrued`,
          amount: allocation.writtenOff,
          memberId,
          referenceNumber,
          tableName: "loans",
          recordId: loan.id,
        },
      })
    }

    totalApplied = roundMoney(totalApplied + apply)
    remaining = roundMoney(remaining - apply)
  }

  return { totalApplied, applied }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, transactionType, amount, narration, sendSms, offsetToLoan } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    if (!transactionType || !["Deposit", "Withdrawal"].includes(transactionType)) {
      return NextResponse.json({ error: "Valid transaction type is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const lastTransaction = await prisma.savingsLedger.findFirst({
      where: { memberId },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })
    const currentBalance = lastTransaction?.balanceAfter ?? 0

    const WITHDRAWAL_FEE = 500
    let withdrawalFee = 0
    let totalApplied = 0
    let appliedBreakdown: Awaited<ReturnType<typeof applyDepositToLoans>>["applied"] = []

    // A deposit pays the member's active loans first (unless opted out);
    // only the remainder is credited to savings. The offset itself runs
    // inside the transaction below so it commits atomically.
    const shouldOffset = transactionType === "Deposit" && offsetToLoan !== false
    const asOf = new Date()

    if (transactionType !== "Deposit") {
      withdrawalFee = WITHDRAWAL_FEE
      const totalDeduction = amount + withdrawalFee
      if (totalDeduction > currentBalance) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: UGX ${currentBalance.toLocaleString()}, Required: UGX ${totalDeduction.toLocaleString()} (includes UGX ${WITHDRAWAL_FEE} fee)` },
          { status: 400 }
        )
      }
    }

    const referenceNumber = generateReference(
      transactionType === "Deposit" ? "DEP" : "WTH",
      Date.now()
    )

    // All writes (loan offsets + savings ledger + audit) commit together so a
    // failure can never leave a deposit half-applied.
    const result = await prisma.$transaction(async (tx) => {
      // For a deposit, offset loans inside the transaction so the reads and
      // writes are consistent.
      let offset = { totalApplied: 0, applied: [] as typeof appliedBreakdown }
      if (shouldOffset) {
        offset = await applyDepositToLoans(tx, memberId, amount, asOf)
      }

      const toSavings = roundMoney(amount - offset.totalApplied)
      const bal = roundMoney(currentBalance + toSavings)

      // Record the savings leg only for the portion that stays in savings.
      const savingsTx =
        toSavings > 0 || transactionType === "Withdrawal"
          ? await tx.savingsLedger.create({
              data: {
                memberId,
                transactionType,
                amount: transactionType === "Deposit" ? toSavings : amount,
                withdrawalFee,
                balanceAfter: bal,
                narration:
                  transactionType === "Deposit" && offset.totalApplied > 0
                    ? `${narration ? narration + " — " : ""}UGX ${offset.totalApplied.toLocaleString()} offset to loan, UGX ${toSavings.toLocaleString()} saved`
                    : narration || null,
                referenceNumber,
                transactionDate: asOf,
              },
            })
          : null

      await tx.auditTrail.create({
        data: {
          actionType: `Savings${transactionType}`,
          description:
            transactionType === "Deposit" && offset.totalApplied > 0
              ? `Deposit of UGX ${amount.toLocaleString()} by ${member.farmerName}: ` +
                `UGX ${offset.totalApplied.toLocaleString()} paid to loan(s), UGX ${toSavings.toLocaleString()} credited to savings`
              : `${transactionType} of UGX ${amount.toLocaleString()} by ${member.farmerName}`,
          amount,
          memberId,
          referenceNumber,
        },
      })

      return { savingsTx, bal, offset }
    }, { timeout: 60_000, maxWait: 10_000 })

    const transaction = result.savingsTx
    const newBalance = result.bal
    totalApplied = result.offset.totalApplied
    appliedBreakdown = result.offset.applied
    const savingsCredited = roundMoney(amount - totalApplied)

    if (transactionType === "Deposit") {
      if (totalApplied > 0) {
        for (const loan of appliedBreakdown) {
          smsLoanRepayment(memberId, loan.amountApplied, loan.newBalance, referenceNumber)
        }
        notifyLoanRepaid(memberId, member.farmerName, totalApplied, referenceNumber)
      }
      if (savingsCredited > 0) {
        smsSavingsDeposit(memberId, savingsCredited, newBalance, referenceNumber)
        notifySavingsDeposit(memberId, member.farmerName, savingsCredited, referenceNumber)
      }
    } else {
      smsSavingsWithdrawal(memberId, amount, newBalance, referenceNumber)
      notifySavingsWithdrawal(memberId, member.farmerName, amount, referenceNumber)
    }

    return NextResponse.json(
      {
        message:
          transactionType === "Deposit" && totalApplied > 0
            ? `Deposit processed — UGX ${totalApplied.toLocaleString()} paid to loan, UGX ${savingsCredited.toLocaleString()} credited to savings`
            : `${transactionType} processed successfully`,
        transaction,
        newBalance,
        offsetToLoan:
          totalApplied > 0
            ? {
                totalApplied,
                loans: appliedBreakdown,
                savingsCredited,
              }
            : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/savings error:", error)
    return NextResponse.json(
      { error: "Failed to process transaction" },
      { status: 500 }
    )
  }
}
