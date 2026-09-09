import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const search = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const savingsWhere: Record<string, unknown> = {}
    const loanWhere: Record<string, unknown> = {}
    const expenseWhere: Record<string, unknown> = {}

    if (search) {
      savingsWhere.OR = [
        { narration: { contains: search, mode: "insensitive" } },
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { member: { farmerName: { contains: search, mode: "insensitive" } } },
      ]
      loanWhere.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { loan: { member: { farmerName: { contains: search, mode: "insensitive" } } } },
      ]
      expenseWhere.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { referenceNo: { contains: search, mode: "insensitive" } },
      ]
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo + "T23:59:59.999Z")
      savingsWhere.transactionDate = dateFilter
      loanWhere.paymentDate = dateFilter
      expenseWhere.expenseDate = dateFilter
    }

    if (type) {
      if (type === "Deposit" || type === "Withdrawal") {
        savingsWhere.transactionType = type
      } else if (type === "Loan Repayment") {
        // handled via loan repayments
      } else if (type === "Expense") {
        expenseWhere.category = type
      }
    }

    const [savings, loanRepayments, expenses] = await Promise.all([
      prisma.savingsLedger.findMany({
        where: type && ["Deposit", "Withdrawal"].includes(type) ? savingsWhere : (type && !["Deposit", "Withdrawal", "Loan Repayment", "Expense"].includes(type) ? { id: -1 } : savingsWhere),
        include: {
          member: { select: { farmerName: true, memberCode: true } },
          recorder: { select: { fullName: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 200,
      }),
      prisma.loanRepayment.findMany({
        where: type === "Loan Repayment" ? (search || dateFrom || dateTo ? loanWhere : {}) : (type && !["Deposit", "Withdrawal", "Loan Repayment", "Expense"].includes(type) ? { id: -1 } : (search || dateFrom || dateTo ? loanWhere : {})),
        include: {
          loan: {
            include: {
              member: { select: { farmerName: true, memberCode: true } },
            },
          },
          recorder: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.expense.findMany({
        where: type === "Expense" ? expenseWhere : (type && !["Deposit", "Withdrawal", "Loan Repayment", "Expense"].includes(type) ? { id: -1 } : expenseWhere),
        include: {
          recorder: { select: { fullName: true } },
        },
        orderBy: { expenseDate: "desc" },
        take: 200,
      }),
    ])

    const allTransactions = [
      ...savings.map((s) => ({
        id: `savings-${s.id}`,
        transactionDate: s.transactionDate.toISOString(),
        memberName: s.member.farmerName,
        memberCode: s.member.memberCode,
        type: s.transactionType,
        description: s.narration || s.transactionType,
        amount: s.amount,
        referenceNumber: s.referenceNumber || "-",
        recordedBy: s.recorder?.fullName || "System",
      })),
      ...loanRepayments.map((r) => ({
        id: `repayment-${r.id}`,
        transactionDate: r.paymentDate.toISOString(),
        memberName: r.loan.member.farmerName,
        memberCode: r.loan.member.memberCode,
        type: "Loan Repayment",
        description: `Repayment for ${r.loan.loanCode}`,
        amount: r.amountPaid,
        referenceNumber: r.referenceNumber || "-",
        recordedBy: r.recorder?.fullName || "System",
      })),
      ...expenses.map((e) => ({
        id: `expense-${e.id}`,
        transactionDate: e.expenseDate.toISOString(),
        memberName: "N/A",
        memberCode: "-",
        type: "Expense",
        description: `${e.category}: ${e.description}`,
        amount: e.amount,
        referenceNumber: e.referenceNo || "-",
        recordedBy: e.recorder?.fullName || "System",
      })),
    ]
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 200)

    let totalInflows = 0
    let totalOutflows = 0
    allTransactions.forEach((t) => {
      if (["Deposit", "Loan Repayment", "Share Purchase"].includes(t.type)) {
        totalInflows += t.amount
      } else {
        totalOutflows += t.amount
      }
    })

    return NextResponse.json({
      transactions: allTransactions,
      summary: {
        totalInflows,
        totalOutflows,
        netAmount: totalInflows - totalOutflows,
        transactionCount: allTransactions.length,
      },
    })
  } catch (error) {
    console.error("Transactions API error:", error)
    return NextResponse.json(
      { transactions: [], summary: { totalInflows: 0, totalOutflows: 0, netAmount: 0, transactionCount: 0 } },
      { status: 200 }
    )
  }
}
