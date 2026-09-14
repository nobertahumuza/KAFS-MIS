import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId") || ""

    const where: Record<string, unknown> = {}

    if (memberId) where.memberId = parseInt(memberId)

    const expenses = await prisma.memberExpense.findMany({
      where,
      include: {
        member: { select: { id: true, farmerName: true, memberCode: true } },
      },
      orderBy: { expenseDate: "desc" },
    })

    return NextResponse.json({
      data: expenses.map((e) => ({
        id: e.id,
        memberId: e.memberId,
        memberName: e.member.farmerName,
        memberCode: e.member.memberCode,
        category: e.category,
        description: e.description,
        amount: e.amount,
        expenseDate: e.expenseDate.toISOString(),
        month: e.month,
        year: e.year,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/member-expenses error:", error)
    return NextResponse.json({ error: "Failed to fetch member expenses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, category, description, amount, expenseDate } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }

    if (!category?.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const date = expenseDate ? new Date(expenseDate) : new Date()

    const expense = await prisma.memberExpense.create({
      data: {
        memberId,
        category: category.trim(),
        description: description.trim(),
        amount,
        expenseDate: date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      },
    })

    return NextResponse.json(
      { message: "Member expense recorded", data: expense },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/member-expenses error:", error)
    return NextResponse.json({ error: "Failed to record member expense" }, { status: 500 })
  }
}
