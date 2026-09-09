import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendReportEmail, generateReportHTML } from "@/lib/email"

export async function POST() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalMembers, totalSavings, totalLoans, activeLoans, totalExpenses,
      newMembers, deposits, withdrawals, loanRepayments, recentTransactions,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.savingsLedger.aggregate({ _sum: { amount: true } }),
      prisma.loan.aggregate({ _sum: { principalAmount: true } }),
      prisma.loan.count({ where: { loanStatus: "Active" } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: startOfMonth } } }),
      prisma.member.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.savingsLedger.aggregate({ _sum: { amount: true }, where: { transactionType: "Deposit", transactionDate: { gte: startOfDay } } }),
      prisma.savingsLedger.aggregate({ _sum: { amount: true }, where: { transactionType: "Withdrawal", transactionDate: { gte: startOfDay } } }),
      prisma.loanRepayment.aggregate({ _sum: { amountPaid: true }, where: { paymentDate: { gte: startOfDay } } }),
      prisma.savingsLedger.findMany({
        where: { transactionDate: { gte: startOfDay } },
        include: { member: { select: { farmerName: true } } },
        orderBy: { transactionDate: "desc" },
        take: 20,
      }),
    ])

    const html = generateReportHTML({
      title: "Daily Financial Report",
      date: now.toISOString().split("T")[0],
      totalMembers,
      totalSavings: totalSavings._sum.amount || 0,
      totalLoans: totalLoans._sum.principalAmount || 0,
      activeLoans,
      totalExpenses: totalExpenses._sum.amount || 0,
      newMembers,
      deposits: deposits._sum.amount || 0,
      withdrawals: withdrawals._sum.amount || 0,
      loanRepayments: loanRepayments._sum.amountPaid || 0,
      recentTransactions: recentTransactions.map((t) => ({
        type: t.transactionType,
        description: `${t.member.farmerName} - ${t.narration || t.transactionType}`,
        amount: t.amount,
        date: t.transactionDate.toISOString().split("T")[0],
      })),
    })

    const result = await sendReportEmail(`KAFS SACCO Daily Report - ${now.toISOString().split("T")[0]}`, html)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Daily report error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
