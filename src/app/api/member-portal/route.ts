import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberCode, phoneNumber } = body

    if (!memberCode?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json({ error: "Member code and phone number are required" }, { status: 400 })
    }

    const member = await prisma.member.findFirst({
      where: {
        memberCode: memberCode.trim(),
        phoneNumber: { contains: phoneNumber.trim().replace(/\s/g, "") },
      },
      select: {
        id: true,
        memberCode: true,
        farmerName: true,
        gender: true,
        phoneNumber: true,
        email: true,
        village: true,
        parish: true,
        district: true,
        subCounty: true,
        occupation: true,
        nextOfKinName: true,
        nextOfKinPhone: true,
        mainProduce: true,
        totalShares: true,
        shareValue: true,
        registrationDate: true,
        status: true,
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Invalid member code or phone number" }, { status: 401 })
    }

    const lastSavings = await prisma.savingsLedger.findFirst({
      where: { memberId: member.id },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })

    const savingsSummary = await prisma.savingsLedger.aggregate({
      where: { memberId: member.id },
      _sum: { amount: true },
    })

    const deposits = await prisma.savingsLedger.aggregate({
      where: { memberId: member.id, transactionType: "Deposit" },
      _sum: { amount: true },
    })

    const withdrawals = await prisma.savingsLedger.aggregate({
      where: { memberId: member.id, transactionType: "Withdrawal" },
      _sum: { amount: true },
    })

    const recentTransactions = await prisma.savingsLedger.findMany({
      where: { memberId: member.id },
      orderBy: { transactionDate: "desc" },
      take: 20,
      select: {
        id: true,
        transactionType: true,
        amount: true,
        balanceAfter: true,
        narration: true,
        referenceNumber: true,
        transactionDate: true,
      },
    })

    const loans = await prisma.loan.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        loanCode: true,
        principalAmount: true,
        currentBalance: true,
        loanStatus: true,
        disbursementDate: true,
        dueDate: true,
        interestRate: true,
      },
    })

    const activeLoans = loans.filter((l) => l.loanStatus === "Active")
    const totalLoanBalance = activeLoans.reduce((sum, l) => sum + l.currentBalance, 0)

    const loanRepayments = await prisma.loanRepayment.findMany({
      where: { loan: { memberId: member.id } },
      orderBy: { paymentDate: "desc" },
      take: 20,
      select: {
        id: true,
        amountPaid: true,
        finePaid: true,
        balanceAfter: true,
        paymentDate: true,
        referenceNumber: true,
        loan: { select: { loanCode: true } },
      },
    })

    const shares = await prisma.sharesLedger.findMany({
      where: { memberId: member.id },
      orderBy: { transactionDate: "desc" },
      take: 20,
      select: {
        id: true,
        sharesQuantity: true,
        sharePrice: true,
        totalAmount: true,
        transactionType: true,
        referenceNumber: true,
        transactionDate: true,
      },
    })

    const fixedAccounts = await prisma.fixedAccount.findMany({
      where: { memberId: member.id },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        fixedCode: true,
        principalAmount: true,
        interestRate: true,
        interestEarned: true,
        maturityAmount: true,
        startDate: true,
        maturityDate: true,
        status: true,
      },
    })

    return NextResponse.json({
      member,
      savings: {
        currentBalance: lastSavings?.balanceAfter ?? 0,
        totalDeposits: deposits._sum.amount ?? 0,
        totalWithdrawals: withdrawals._sum.amount ?? 0,
      },
      loans: {
        total: loans.length,
        active: activeLoans.length,
        totalBalance: totalLoanBalance,
        list: loans,
      },
      shares: {
        totalShares: member.totalShares ?? 0,
        shareValue: member.shareValue ?? 0,
        list: shares,
      },
      fixedAccounts,
      recentTransactions,
      loanRepayments,
    })
  } catch (error) {
    console.error("POST /api/member-portal error:", error)
    return NextResponse.json({ error: "Failed to fetch member data" }, { status: 500 })
  }
}
