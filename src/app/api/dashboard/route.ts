import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const [
      totalMembers,
      savingsAgg,
      loansAgg,
      activeLoans,
      expensesAgg,
      sharesAgg,
      recentSavings,
      recentLoans,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.savingsLedger.aggregate({ _sum: { amount: true } }),
      prisma.loan.aggregate({ _sum: { principalAmount: true } }),
      prisma.loan.count({ where: { loanStatus: "Active" } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.sharesLedger.aggregate({ _sum: { totalAmount: true } }),
      prisma.savingsLedger.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          transactionType: true,
          narration: true,
          amount: true,
          transactionDate: true,
          member: { select: { farmerName: true } },
        },
      }),
      prisma.loan.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          loanCode: true,
          principalAmount: true,
          disbursementDate: true,
          member: { select: { farmerName: true } },
        },
      }),
    ])

    const recentTransactions = [
      ...recentSavings.map((s) => ({
        id: s.id,
        type: s.transactionType,
        description: `${s.member.farmerName} - ${s.narration || s.transactionType}`,
        amount: s.amount,
        date: s.transactionDate.toISOString().split("T")[0],
      })),
      ...recentLoans.map((l) => ({
        id: l.id + 10000,
        type: "Loan",
        description: `${l.member.farmerName} - Loan ${l.loanCode}`,
        amount: l.principalAmount,
        date: l.disbursementDate.toISOString().split("T")[0],
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)

    return NextResponse.json({
      totalMembers,
      totalSavings: savingsAgg._sum.amount || 0,
      totalLoans: loansAgg._sum.principalAmount || 0,
      activeLoans,
      totalExpenses: expensesAgg._sum.amount || 0,
      totalShares: sharesAgg._sum.totalAmount || 0,
      recentTransactions,
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      {
        totalMembers: 0,
        totalSavings: 0,
        totalLoans: 0,
        activeLoans: 0,
        totalExpenses: 0,
        totalShares: 0,
        recentTransactions: [],
      },
      { status: 200 }
    )
  }
}
