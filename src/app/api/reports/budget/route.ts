import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const fiscalYearParam = searchParams.get("fiscalYear")
    const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam) : new Date().getFullYear()

    if (isNaN(fiscalYear)) {
      return NextResponse.json({ error: "Invalid fiscal year" }, { status: 400 })
    }

    const startDate = new Date(fiscalYear, 0, 1)
    const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59, 999)

    const budgets = await prisma.budget.findMany({
      where: { fiscalYear },
      orderBy: { category: "asc" },
      include: {
        creator: { select: { fullName: true } },
      },
    })

    const categories = [...new Set(budgets.map((b) => b.category))]

    const actuals = await Promise.all(
      categories.map(async (category) => {
        const expenses = await prisma.expense.aggregate({
          _sum: { amount: true },
          _count: { id: true },
          where: {
            category,
            expenseDate: { gte: startDate, lte: endDate },
          },
        })

        return {
          category,
          totalSpent: expenses._sum.amount ?? 0,
          transactionCount: expenses._count.id,
        }
      })
    )

    const actualsMap = new Map(actuals.map((a) => [a.category, a]))

    const budgetsWithActuals = budgets.map((b) => {
      const actual = actualsMap.get(b.category)
      const spent = actual?.totalSpent ?? 0
      const variance = b.amount - spent
      const utilizationRate = b.amount > 0 ? parseFloat(((spent / b.amount) * 100).toFixed(1)) : 0

      return {
        id: b.id,
        category: b.category,
        budgetedAmount: b.amount,
        actualSpent: spent,
        variance,
        utilizationRate,
        transactionCount: actual?.transactionCount ?? 0,
        notes: b.notes,
        createdBy: b.creator?.fullName ?? null,
        createdAt: b.createdAt.toISOString(),
      }
    })

    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalSpent = actuals.reduce((sum, a) => sum + a.totalSpent, 0)

    return NextResponse.json({
      fiscalYear,
      summary: {
        totalBudgeted,
        totalSpent,
        variance: totalBudgeted - totalSpent,
        overallUtilization: totalBudgeted > 0 ? parseFloat(((totalSpent / totalBudgeted) * 100).toFixed(1)) : 0,
        totalCategories: categories.length,
      },
      budgets: budgetsWithActuals,
    })
  } catch (error) {
    console.error("GET /api/reports/budget error:", error)
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { category, amount, fiscalYear, notes } = body

    if (!category || typeof category !== "string") {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const year = fiscalYear || new Date().getFullYear()

    const existing = await prisma.budget.findFirst({
      where: {
        category,
        fiscalYear: year,
      },
    })

    let budget

    if (existing) {
      budget = await prisma.budget.update({
        where: { id: existing.id },
        data: {
          amount,
          notes: notes ?? existing.notes,
        },
      })
    } else {
      budget = await prisma.budget.create({
        data: {
          category,
          amount,
          fiscalYear: year,
          notes: notes ?? null,
          createdBy: parseInt((user as { id: string }).id) || null,
        },
      })
    }

    return NextResponse.json({
      message: existing ? "Budget updated" : "Budget created",
      budget,
    }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("POST /api/reports/budget error:", error)
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 })
  }
}
