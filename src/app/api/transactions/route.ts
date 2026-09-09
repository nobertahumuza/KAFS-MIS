import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const search = searchParams.get("search")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { narration: { contains: search, mode: "insensitive" } },
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { member: { farmerName: { contains: search, mode: "insensitive" } } },
      ]
    }

    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) (where.transactionDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.transactionDate as Record<string, unknown>).lte = new Date(dateTo)
    }

    if (type) {
      where.transactionType = type
    }

    const savings = await prisma.savingsLedger.findMany({
      where,
      include: {
        member: { select: { farmerName: true, memberCode: true } },
        recordedByUser: { select: { fullName: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 200,
    })

    const loanRepayments = await prisma.loanRepayment.findMany({
      where: type ? { ...where, loan: undefined } : {},
      include: {
        loan: {
          include: {
            member: { select: { farmerName: true, memberCode: true } },
          },
        },
        recordedByUser: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    const expenses = await prisma.expense.findMany({
      where: type ? { category: type } : {},
      include: {
        recordedByUser: { select: { fullName: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: 200,
    })

    const transactions = [
      ...savings.map((s) => ({
        id: s.id,
        date: s.transactionDate.toISOString(),
        member: s.member.farmerName,
        memberCode: s.member.memberCode,
        type: s.transactionType,
        description: s.narration || s.transactionType,
        amount: s.amount,
        reference: s.referenceNumber || "-",
        recordedBy: s.recordedByUser?.fullName || "System",
      })),
      ...loanRepayments.map((r) => ({
        id: r.id + 100000,
        date: r.paymentDate.toISOString(),
        member: r.loan.member.farmerName,
        memberCode: r.loan.member.memberCode,
        type: "Loan Repayment",
        description: `Repayment for ${r.loan.loanCode}`,
        amount: r.amountPaid,
        reference: r.referenceNumber || "-",
        recordedBy: r.recordedByUser?.fullName || "System",
      })),
      ...expenses.map((e) => ({
        id: e.id + 200000,
        date: e.expenseDate.toISOString(),
        member: "N/A",
        memberCode: "-",
        type: "Expense",
        description: `${e.category}: ${e.description}`,
        amount: e.amount,
        reference: e.referenceNo || "-",
        recordedBy: e.recordedByUser?.fullName || "System",
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 200)

    return NextResponse.json(transactions)
  } catch (error) {
    console.error("Transactions API error:", error)
    return NextResponse.json([], { status: 200 })
  }
}
