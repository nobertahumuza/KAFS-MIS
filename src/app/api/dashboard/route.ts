import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const [
      totalMembers,
      totalAccounts,
      savingsAgg,
      totalActiveSavers,
      loansAgg,
      activeLoans,
      totalActiveBorrowers,
      expensesAgg,
      sharesAgg,
      recentSavings,
      recentLoans,
      cashFlowData,
      delinquentLoans,
      delinquencyAlerts,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.customer.count({ where: { status: "Active" } }),
      prisma.savingsLedger.aggregate({ _sum: { amount: true } }),
      prisma.savingsLedger.groupBy({ by: ["memberId"] }).then((groups) => groups.length),
      prisma.loan.aggregate({ _sum: { principalAmount: true, currentBalance: true } }),
      prisma.loan.count({ where: { loanStatus: "Active" } }),
      prisma.loan.groupBy({ by: ["memberId"], where: { loanStatus: "Active" } }).then((groups) => groups.length),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.sharesLedger.aggregate({ _sum: { totalAmount: true, sharesQuantity: true } }),
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
      // Cash flow: last 6 months
      (async () => {
        const months: { month: string; deposits: number; withdrawals: number; expenses: number }[] = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const start = new Date(d.getFullYear(), d.getMonth(), 1)
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
          const label = start.toLocaleDateString("en-US", { month: "short" })

          const [depAgg, witAgg, expAgg] = await Promise.all([
            prisma.savingsLedger.aggregate({
              where: { transactionType: "Deposit", transactionDate: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
            prisma.savingsLedger.aggregate({
              where: { transactionType: "Withdrawal", transactionDate: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
            prisma.expense.aggregate({
              where: { expenseDate: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
          ])

          months.push({
            month: label,
            deposits: depAgg._sum.amount || 0,
            withdrawals: witAgg._sum.amount || 0,
            expenses: expAgg._sum.amount || 0,
          })
        }
        return months
      })(),
      prisma.loan.count({
        where: { loanStatus: "Active", dueDate: { lt: new Date() } },
      }),
      // Delinquency alerts: top overdue loans
      prisma.loan.findMany({
        where: { loanStatus: "Active", dueDate: { lt: new Date() } },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true,
          loanCode: true,
          currentBalance: true,
          dueDate: true,
          member: { select: { farmerName: true } },
        },
      }),
    ])

    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = await prisma.member.count({
      where: { createdAt: { gte: currentMonthStart } },
    })

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

    const formattedAlerts = delinquencyAlerts.map((l) => {
      const daysOverdue = Math.floor(
        (now.getTime() - (l.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
      )
      return {
        id: l.id,
        memberName: l.member.farmerName,
        loanCode: l.loanCode,
        amount: l.currentBalance,
        daysOverdue,
        riskLevel: daysOverdue > 90 ? "High" : daysOverdue > 30 ? "Medium" : "Low",
      }
    })

    return NextResponse.json({
      totalMembers,
      totalAccounts,
      totalSavings: savingsAgg._sum.amount || 0,
      totalActiveSavers,
      totalLoans: loansAgg._sum.principalAmount || 0,
      totalOutstandingBalance: loansAgg._sum.currentBalance || 0,
      activeLoans,
      totalActiveBorrowers,
      totalExpenses: expensesAgg._sum.amount || 0,
      totalShares: sharesAgg._sum.totalAmount || 0,
      totalSharesCount: sharesAgg._sum.sharesQuantity || 0,
      newThisMonth,
      recentTransactions,
      cashFlow: cashFlowData,
      delinquentLoans,
      delinquencyAlerts: formattedAlerts,
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      {
        totalMembers: 0,
        totalAccounts: 0,
        totalSavings: 0,
        totalActiveSavers: 0,
        totalLoans: 0,
        totalOutstandingBalance: 0,
        activeLoans: 0,
        totalActiveBorrowers: 0,
        totalExpenses: 0,
        totalShares: 0,
        totalSharesCount: 0,
        newThisMonth: 0,
        recentTransactions: [],
        cashFlow: [],
        delinquentLoans: 0,
        delinquencyAlerts: [],
      },
      { status: 200 }
    )
  }
}
