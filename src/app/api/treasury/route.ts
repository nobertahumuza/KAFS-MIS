import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalSavings,
      totalFixedDeposits,
      totalLoans,
      activeLoans,
      totalShares,
      totalExpensesThisMonth,
      savingsByType,
      expensesByCategory,
      largeSavings,
      largeLoans,
    ] = await Promise.all([
      prisma.savingsLedger.aggregate({ _sum: { amount: true } }),
      prisma.fixedAccount.aggregate({ _sum: { principalAmount: true }, where: { status: "Active" } }),
      prisma.loan.aggregate({ _sum: { principalAmount: true } }),
      prisma.loan.aggregate({ _sum: { currentBalance: true }, where: { loanStatus: "Active" } }),
      prisma.sharesLedger.aggregate({ _sum: { totalAmount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: startOfMonth } } }),
      prisma.savingsLedger.groupBy({ by: ["transactionType"], _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["category"], _sum: { amount: true }, where: { expenseDate: { gte: startOfMonth } } }),
      prisma.savingsLedger.findMany({
        where: { amount: { gte: 500000 } },
        include: { member: { select: { farmerName: true } } },
        orderBy: { transactionDate: "desc" },
        take: 10,
      }),
      prisma.loan.findMany({
        where: { principalAmount: { gte: 500000 } },
        include: { member: { select: { farmerName: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

    const totalCash = (totalSavings._sum.amount || 0) - (totalLoans._sum.principalAmount || 0)

    const income = savingsByType
      .filter((s) => s.transactionType === "Deposit")
      .reduce((sum, s) => sum + (s._sum.amount || 0), 0)

    const expenses = expensesByCategory.map((e) => ({
      category: e.category,
      amount: e._sum.amount || 0,
    }))

    const recentLargeTransactions = [
      ...largeSavings.map((s) => ({
        type: "Savings",
        member: s.member.farmerName,
        amount: s.amount,
        date: s.transactionDate.toISOString(),
        description: s.narration || "Savings transaction",
      })),
      ...largeLoans.map((l) => ({
        type: "Loan",
        member: l.member.farmerName,
        amount: l.principalAmount,
        date: l.disbursementDate.toISOString(),
        description: `Loan ${l.loanCode}`,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    return NextResponse.json({
      totalCash,
      totalSavingsDeposits: totalSavings._sum.amount || 0,
      totalFixedDeposits: totalFixedDeposits._sum.principalAmount || 0,
      totalLoanPortfolio: totalLoans._sum.principalAmount || 0,
      outstandingBalance: activeLoans._sum.currentBalance || 0,
      totalShares: totalShares._sum.amount || 0,
      totalExpensesThisMonth: totalExpensesThisMonth._sum.amount || 0,
      income,
      expenses,
      netPosition: income - (totalExpensesThisMonth._sum.amount || 0),
      recentLargeTransactions,
    })
  } catch (error) {
    console.error("Treasury API error:", error)
    return NextResponse.json(
      {
        totalCash: 0,
        totalSavingsDeposits: 0,
        totalFixedDeposits: 0,
        totalLoanPortfolio: 0,
        outstandingBalance: 0,
        totalShares: 0,
        totalExpensesThisMonth: 0,
        income: 0,
        expenses: [],
        netPosition: 0,
        recentLargeTransactions: [],
      },
      { status: 200 }
    )
  }
}
