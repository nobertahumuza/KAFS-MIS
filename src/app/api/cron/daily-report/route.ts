import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendReportEmail, generateReportHTML } from "@/lib/email"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalMembers,
      newMembersToday,
      depositsResult,
      withdrawalsResult,
      loanRepaymentsResult,
      totalSavingsResult,
      activeLoansCount,
      totalLoansResult,
      totalExpensesResult,
      recentTransactions,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { registrationDate: { gte: today, lt: tomorrow } } }),
      prisma.savingsLedger.aggregate({
        where: { transactionType: "Deposit", transactionDate: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.savingsLedger.aggregate({
        where: { transactionType: "Withdrawal", transactionDate: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.loanRepayment.aggregate({
        where: { paymentDate: { gte: today, lt: tomorrow } },
        _sum: { amountPaid: true },
      }),
      prisma.member.aggregate({ _sum: { shareValue: true } }),
      prisma.loanApplication.count({ where: { status: "Active" } }),
      prisma.loanApplication.aggregate({ where: { status: "Active" }, _sum: { loanAmount: true } }),
      prisma.journalLine.aggregate({
        where: {
          entry: { entryDate: { gte: today, lt: tomorrow } },
        },
        _sum: { credit: true },
      }),
      prisma.journalEntry.findMany({
        where: { entryDate: { gte: today, lt: tomorrow } },
        orderBy: { id: "desc" },
        take: 10,
      }),
    ])

    const deposits = depositsResult._sum.amount || 0
    const withdrawals = withdrawalsResult._sum.amount || 0
    const loanRepayments = loanRepaymentsResult._sum.amountPaid || 0
    const totalSavings = totalSavingsResult._sum.shareValue || 0
    const totalLoans = totalLoansResult._sum.loanAmount || 0
    const totalExpenses = totalExpensesResult._sum.credit || 0

    const formattedTransactions = recentTransactions.map((t) => ({
      type: t.description || "Transaction",
      description: `Entry #${t.id}`,
      amount: Math.abs(t.totalDebit || t.totalCredit || 0),
      date: t.entryDate.toISOString(),
    }))

    const dateStr = today.toLocaleDateString("en-UG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Kampala",
    })

    const html = generateReportHTML({
      title: "Daily Report",
      date: dateStr,
      totalMembers,
      totalSavings,
      totalLoans,
      activeLoans: activeLoansCount,
      totalExpenses,
      newMembers: newMembersToday,
      deposits,
      withdrawals,
      loanRepayments,
      recentTransactions: formattedTransactions,
    })

    const result = await sendReportEmail(
      `KAFS Daily Report — ${dateStr}`,
      html
    )

    await prisma.auditTrail.create({
      data: {
        actionType: "SystemReport",
        description: `Daily report sent${result.success ? "" : " (failed: " + result.error + ")"}`,
      },
    })

    return NextResponse.json({
      message: result.success ? "Daily report sent successfully" : "Failed to send report",
      details: result.success ? undefined : result.error,
      data: {
        totalMembers,
        newMembers: newMembersToday,
        deposits,
        withdrawals,
        loanRepayments,
        activeLoans: activeLoansCount,
        totalExpenses,
      },
    })
  } catch (error) {
    console.error("Daily report cron error:", error)
    return NextResponse.json({ error: "Failed to generate daily report" }, { status: 500 })
  }
}
