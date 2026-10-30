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

    const now = new Date()

    // Sunday (SACCO calendar, Africa/Kampala): no report is sent.
    const kampalaNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Kampala" }))
    if (kampalaNow.getDay() === 0) {
      await prisma.auditTrail.create({
        data: {
          actionType: "SystemReport",
          description: "Daily report skipped - Sunday (no report sent on Sundays)",
        },
      }).catch(() => {})
      return NextResponse.json({ message: "Skipped - Sunday (no report on Sundays)", skipped: true })
    }

    const today = new Date(now)
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
      savingsLedgerToday,
      loanRepaymentsToday,
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
      prisma.savingsLedger.findMany({
        where: { transactionDate: { gte: today, lt: tomorrow } },
        include: { member: { select: { farmerName: true, memberCode: true } } },
        orderBy: { id: "desc" },
      }),
      prisma.loanRepayment.findMany({
        where: { paymentDate: { gte: today, lt: tomorrow } },
        include: { loan: { select: { member: { select: { farmerName: true, memberCode: true } } } } },
        orderBy: { id: "desc" },
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

    // Members who made transactions today (savings + loan repayments).
    const memberTransactions: Array<{
      memberName: string
      memberCode: string
      type: string
      amount: number
    }> = [
      ...savingsLedgerToday.map((t) => ({
        memberName: t.member?.farmerName || "Unknown",
        memberCode: t.member?.memberCode || "",
        type: t.transactionType,
        amount: t.amount,
      })),
      ...loanRepaymentsToday.map((r) => ({
        memberName: r.loan?.member?.farmerName || "Unknown",
        memberCode: r.loan?.member?.memberCode || "",
        type: "Loan Repayment",
        amount: r.amountPaid,
      })),
    ]

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
      memberTransactions,
    })

    const result = await sendReportEmail(
      `KAFS Daily Report – ${dateStr}`,
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
        membersWhoTransacted: memberTransactions.length,
      },
    })
  } catch (error) {
    console.error("Daily report cron error:", error)
    await prisma.auditTrail
      .create({
        data: {
          actionType: "SystemReport",
          description: `Daily report failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      })
      .catch(() => {})
    return NextResponse.json({ error: "Failed to generate daily report" }, { status: 500 })
  }
}
