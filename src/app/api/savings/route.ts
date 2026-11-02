import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/auth"
import { generateReference } from "@/lib/utils"
import { smsSavingsDeposit, smsSavingsWithdrawal, smsDepositOffset } from "@/lib/sms"
import { notifySavingsDeposit, notifySavingsWithdrawal, notifyDepositOffset } from "@/lib/notify"
import { roundMoney } from "@/lib/loan-repayment"
import { applyDepositToLoans } from "@/lib/loan-offset"
import { isCollectionAccount } from "@/lib/collection-accounts"

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

export async function POST(request: NextRequest) {
  try {
    // Money route: staff session required (middleware guards this too, but a
    // deposit/withdrawal must never be bookable anonymously).
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      // The SACCO's own collection accounts (service fee, withdrawal fee,
      // charity fund) are bank accounts - they never pay the withdrawal fee.
      withdrawalFee = isCollectionAccount(member.memberCode) ? 0 : WITHDRAWAL_FEE
      const totalDeduction = amount + withdrawalFee
      if (totalDeduction > currentBalance) {
        return NextResponse.json(
          {
            error:
              `Insufficient balance. Available: UGX ${currentBalance.toLocaleString()}, Required: UGX ${totalDeduction.toLocaleString()}` +
              (withdrawalFee > 0 ? ` (includes UGX ${WITHDRAWAL_FEE} fee)` : ""),
          },
          { status: 400 }
        )
      }
    }

    const referenceNumber = generateReference(
      transactionType === "Deposit" ? "DEP" : "WTH",
      Date.now()
    )

    // Look up the withdrawal-fee collection account (KAFS-560) so the 500 fee
    // can be credited to it atomically with the withdrawal.
    const feeAccount = await prisma.member.findFirst({
      where: { memberCode: "KAFS-560" },
      select: { id: true, memberCode: true },
    })
    const feeLastEntry = feeAccount
      ? await prisma.savingsLedger.findFirst({
          where: { memberId: feeAccount.id },
          orderBy: { id: "desc" },
          select: { balanceAfter: true },
        })
      : null
    const feeBalanceBefore = feeLastEntry?.balanceAfter ?? 0

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
      const bal =
        transactionType === "Deposit"
          ? roundMoney(currentBalance + toSavings)
          : roundMoney(currentBalance - amount - withdrawalFee)

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

      // Credit the UGX 500 withdrawal fee to the withdrawal-fee account
      // (KAFS-560) so it accumulates there, mirroring the service-fee flow.
      if (transactionType === "Withdrawal" && feeAccount && withdrawalFee > 0) {
        const newFeeBalance = roundMoney(feeBalanceBefore + withdrawalFee)
        await tx.savingsLedger.create({
          data: {
            memberId: feeAccount.id,
            transactionType: "Deposit",
            amount: withdrawalFee,
            balanceAfter: newFeeBalance,
            narration: `Withdrawal fee - ${member.farmerName} (${member.memberCode})`,
            referenceNumber,
            transactionDate: asOf,
          },
        })
      }

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
        // One SMS telling the member the deposit money went to the loan, and
        // one detailed cashier notification breaking the whole transaction
        // down per loan (interest / principal / fines / new balance).
        const loanCodes = appliedBreakdown.map((l) => l.loanCode).join(", ")
        const loanBalance = roundMoney(
          appliedBreakdown.reduce((sum, l) => sum + l.newBalance, 0)
        )
        await smsDepositOffset(
          memberId,
          amount,
          totalApplied,
          loanCodes,
          loanBalance,
          savingsCredited,
          newBalance,
          referenceNumber
        )
        await notifyDepositOffset({
          memberName: member.farmerName,
          memberCode: member.memberCode,
          depositAmount: amount,
          totalApplied,
          savingsCredited,
          savingsBalance: newBalance,
          reference: referenceNumber,
          loans: appliedBreakdown,
        })
      } else if (savingsCredited > 0) {
        await smsSavingsDeposit(memberId, savingsCredited, newBalance, referenceNumber)
        await notifySavingsDeposit(memberId, member.farmerName, savingsCredited, referenceNumber)
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
