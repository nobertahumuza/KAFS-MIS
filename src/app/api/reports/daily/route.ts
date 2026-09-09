import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendEmail, generateDailyReportHTML } from "@/lib/email"

export async function POST() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalMembers,
      totalSavings,
      totalLoans,
      activeLoans,
      totalExpenses,
      newMembersToday,
      depositsToday,
      withdrawalsToday,
      loanRepaymentsToday,
      recentTransactions,
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

    const dateStr = now.toISOString().split("T")[0]

    const reportData = {
      date: dateStr,
      totalMembers,
      totalSavings: totalSavings._sum.amount || 0,
      totalLoans: totalLoans._sum.principalAmount || 0,
      activeLoans,
      totalExpenses: totalExpenses._sum.amount || 0,
      newMembersToday,
      depositsToday: depositsToday._sum.amount || 0,
      withdrawalsToday: withdrawalsToday._sum.amount || 0,
      loanRepaymentsToday: loanRepaymentsToday._sum.amountPaid || 0,
      recentTransactions: recentTransactions.map((t) => ({
        type: t.transactionType,
        description: `${t.member.farmerName} - ${t.narration || t.transactionType}`,
        amount: t.amount,
        date: t.transactionDate.toISOString().split("T")[0],
      })),
    }

    const html = generateDailyReportHTML(reportData)

    const recipients = process.env.REPORT_RECIPIENTS_TO || "najunapacious@gmail.com,Paciousnajuna27@iCloud.com"
    const ccRecipients = process.env.REPORT_RECIPIENTS_CC || "bturinawe30@gmail.com,katahofarmerssacco@gmail.com,nobtechworld2@gmail.com"

    const result = await sendEmail({
      to: recipients,
      cc: ccRecipients,
      subject: `KAFS SACCO Daily Report - ${dateStr}`,
      html,
    })

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      report: reportData,
    })
  } catch (error) {
    console.error("Daily report error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
