import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { notifyExpenseRecorded } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { category: { contains: search } },
      ]
    }
    if (category) {
      where.category = category
    }
    if (dateFrom || dateTo) {
      where.expenseDate = {}
      if (dateFrom) (where.expenseDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        ;(where.expenseDate as Record<string, unknown>).lte = to
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { recorder: { select: { id: true, fullName: true } } },
      orderBy: { expenseDate: "desc" },
    })

    const totalExpensesAgg = await prisma.expense.aggregate({ _sum: { amount: true } })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const thisMonthAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { expenseDate: { gte: monthStart } },
    })
    const thisWeekAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { expenseDate: { gte: weekStart } },
    })

    return NextResponse.json({
      expenses,
      summary: {
        totalExpenses: totalExpensesAgg._sum.amount || 0,
        thisMonth: thisMonthAgg._sum.amount || 0,
        thisWeek: thisWeekAgg._sum.amount || 0,
      },
    })
  } catch (error) {
    console.error("GET /api/expenses error:", error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, description, amount, expenseDate, paymentMethod } = body

    if (!category?.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        category: category.trim(),
        description: description.trim(),
        amount: Number(amount),
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        paymentMethod: paymentMethod || "Cash",
      },
    })

    notifyExpenseRecorded(description.trim(), Number(amount), category.trim())

    return NextResponse.json({ message: "Expense recorded successfully", expense }, { status: 201 })
  } catch (error) {
    console.error("POST /api/expenses error:", error)
    return NextResponse.json({ error: "Failed to record expense" }, { status: 500 })
  }
}
