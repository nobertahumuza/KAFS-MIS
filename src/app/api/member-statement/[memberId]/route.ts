import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    await requireAuth()

    const { memberId } = await params
    const memberIdInt = parseInt(memberId)

    if (isNaN(memberIdInt)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const dateFromParam = searchParams.get("dateFrom")
    const dateToParam = searchParams.get("dateTo")

    const dateFrom = dateFromParam ? new Date(dateFromParam) : new Date(new Date().getFullYear(), 0, 1)
    const dateTo = dateToParam ? new Date(dateToParam) : new Date()
    dateTo.setHours(23, 59, 59, 999)

    const member = await prisma.member.findUnique({
      where: { id: memberIdInt },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const [savingsTransactions, loans, shares, fixedDeposits, savingsInterest, lastSavingsEntry] =
      await Promise.all([
        prisma.savingsLedger.findMany({
          where: {
            memberId: memberIdInt,
            transactionDate: { gte: dateFrom, lte: dateTo },
          },
          orderBy: { transactionDate: "asc" },
          include: {
            recorder: { select: { fullName: true } },
          },
        }),
        prisma.loan.findMany({
          where: { memberId: memberIdInt },
          include: {
            repaymentSchedules: { orderBy: { installmentNo: "asc" } },
            repayments: { orderBy: { paymentDate: "asc" } },
            fines: true,
            disbursements: true,
          },
          orderBy: { disbursementDate: "asc" },
        }),
        prisma.sharesLedger.findMany({
          where: {
            memberId: memberIdInt,
            transactionDate: { gte: dateFrom, lte: dateTo },
          },
          orderBy: { transactionDate: "asc" },
        }),
        prisma.fixedAccount.findMany({
          where: { memberId: memberIdInt },
          orderBy: { createdAt: "asc" },
        }),
        prisma.savingsInterest.findMany({
          where: { memberId: memberIdInt },
          orderBy: { creditedAt: "asc" },
        }),
        prisma.savingsLedger.findFirst({
          where: { memberId: memberIdInt },
          orderBy: { id: "desc" },
          select: { balanceAfter: true },
        }),
      ])

    const currentSavingsBalance = lastSavingsEntry?.balanceAfter ?? 0

    const account = await prisma.customer.findFirst({
      where: { memberId: memberIdInt },
      select: { accountNo: true, accountType: true, status: true },
    })

    const formattedSavings = savingsTransactions.map((t) => ({
      date: t.transactionDate.toISOString(),
      type: t.transactionType,
      amount: t.amount,
      fee: t.withdrawalFee ?? 0,
      balanceAfter: t.balanceAfter,
      narration: t.narration,
      referenceNumber: t.referenceNumber,
      recordedBy: t.recorder?.fullName ?? null,
    }))

    const formattedLoans = loans.map((loan) => {
      const totalPaid = loan.repayments.reduce((sum, r) => sum + r.amountPaid, 0)
      const totalFines = loan.fines.reduce((sum, f) => sum + (f.fineAmount ?? 0), 0)
      const totalFinePaid = loan.fines.reduce((sum, f) => sum + (f.paidAmount ?? 0), 0)

      return {
        loanCode: loan.loanCode,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        currentBalance: loan.currentBalance,
        status: loan.loanStatus,
        disbursementDate: loan.disbursementDate.toISOString(),
        dueDate: loan.dueDate?.toISOString() ?? null,
        totalPaid,
        totalFines,
        totalFinePaid,
        schedule: loan.repaymentSchedules.map((s) => ({
          installmentNo: s.installmentNo,
          dueDate: s.dueDate.toISOString(),
          principalAmount: s.principalAmount,
          interestAmount: s.interestAmount,
          totalAmount: s.totalAmount,
          amountPaid: s.amountPaid,
          fineAmount: s.fineAmount ?? 0,
          status: s.status,
        })),
        payments: loan.repayments.map((r) => ({
          date: r.paymentDate.toISOString(),
          amountPaid: r.amountPaid,
          finePaid: r.finePaid ?? 0,
          balanceAfter: r.balanceAfter,
          referenceNumber: r.referenceNumber,
        })),
      }
    })

    const formattedShares = shares.map((s) => ({
      date: s.transactionDate.toISOString(),
      type: s.transactionType,
      sharesQuantity: s.sharesQuantity,
      sharePrice: s.sharePrice,
      totalAmount: s.totalAmount,
      narration: s.narration,
      referenceNumber: s.referenceNumber,
    }))

    const formattedFixedDeposits = fixedDeposits.map((fd) => ({
      fixedCode: fd.fixedCode,
      principalAmount: fd.principalAmount,
      startDate: fd.startDate.toISOString(),
      maturityDate: fd.maturityDate.toISOString(),
      interestRate: fd.interestRate,
      interestEarned: fd.interestEarned,
      maturityAmount: fd.maturityAmount,
      status: fd.status,
    }))

    const formattedInterest = savingsInterest.map((si) => ({
      period: si.period,
      interestRate: si.interestRate,
      balance: si.balance,
      interestEarned: si.interestEarned,
      creditedAt: si.creditedAt.toISOString(),
    }))

    const totalSharesValue = member.totalShares ?? 0
    const totalSharesAmount = member.shareValue ?? 0
    const totalFixedDepositValue = fixedDeposits
      .filter((fd) => fd.status === "Active")
      .reduce((sum, fd) => sum + fd.principalAmount, 0)

    return NextResponse.json({
      statementPeriod: {
        from: dateFrom.toISOString().split("T")[0],
        to: dateTo.toISOString().split("T")[0],
      },
      generatedAt: new Date().toISOString(),
      profile: {
        id: member.id,
        memberCode: member.memberCode,
        farmerName: member.farmerName,
        gender: member.gender,
        phoneNumber: member.phoneNumber,
        email: member.email,
        village: member.village,
        parish: member.parish,
        district: member.district,
        occupation: member.occupation,
        registrationDate: member.registrationDate.toISOString(),
        status: member.status,
      },
      account: account
        ? {
            accountNo: account.accountNo,
            accountType: account.accountType,
            status: account.status,
          }
        : null,
      savings: {
        currentBalance: currentSavingsBalance,
        transactions: formattedSavings,
        totalDeposits: savingsTransactions
          .filter((t) => t.transactionType === "Deposit")
          .reduce((sum, t) => sum + t.amount, 0),
        totalWithdrawals: savingsTransactions
          .filter((t) => t.transactionType === "Withdrawal")
          .reduce((sum, t) => sum + t.amount, 0),
        transactionCount: savingsTransactions.length,
      },
      loans: formattedLoans,
      shares: {
        totalQuantity: totalSharesValue,
        totalValue: totalSharesAmount,
        transactions: formattedShares,
      },
      fixedDeposits: formattedFixedDeposits,
      savingsInterest: formattedInterest,
      summary: {
        totalSavings: currentSavingsBalance,
        totalShares: totalSharesAmount,
        totalFixedDeposits: totalFixedDepositValue,
        totalLoanOutstanding: loans
          .filter((l) => l.loanStatus === "Active")
          .reduce((sum, l) => sum + l.currentBalance, 0),
        netWorth:
          currentSavingsBalance +
          totalSharesAmount +
          totalFixedDepositValue -
          loans
            .filter((l) => l.loanStatus === "Active")
            .reduce((sum, l) => sum + l.currentBalance, 0),
      },
    })
  } catch (error) {
    console.error("GET /api/member-statement/[memberId] error:", error)
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
