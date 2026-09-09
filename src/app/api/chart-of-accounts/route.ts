import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const type = searchParams.get("type") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "50")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { accountCode: { contains: search } },
        { accountName: { contains: search } },
      ]
    }

    if (type) {
      where.accountType = type
    }

    const [accounts, total] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        orderBy: { accountCode: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.chartOfAccount.count({ where }),
    ])

    return NextResponse.json({
      data: accounts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/chart-of-accounts error:", error)
    return NextResponse.json({ error: "Failed to fetch chart of accounts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountCode, accountName, accountType, balance = 0 } = body

    if (!accountCode?.trim()) {
      return NextResponse.json({ error: "Account code is required" }, { status: 400 })
    }
    if (!accountName?.trim()) {
      return NextResponse.json({ error: "Account name is required" }, { status: 400 })
    }
    if (!accountType) {
      return NextResponse.json({ error: "Account type is required" }, { status: 400 })
    }

    const existing = await prisma.chartOfAccount.findUnique({
      where: { accountCode: accountCode.trim() },
    })
    if (existing) {
      return NextResponse.json({ error: "Account code already exists" }, { status: 409 })
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        accountCode: accountCode.trim(),
        accountName: accountName.trim(),
        accountType,
        balance: parseFloat(balance) || 0,
        status: "Active",
      },
    })

    return NextResponse.json({ data: account, message: "Account created" }, { status: 201 })
  } catch (error) {
    console.error("POST /api/chart-of-accounts error:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, accountCode, accountName, accountType, status } = body

    if (!id) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 })
    }

    const account = await prisma.chartOfAccount.update({
      where: { id: parseInt(id) },
      data: {
        ...(accountCode && { accountCode: accountCode.trim() }),
        ...(accountName && { accountName: accountName.trim() }),
        ...(accountType && { accountType }),
        ...(status && { status }),
      },
    })

    return NextResponse.json({ data: account, message: "Account updated" })
  } catch (error) {
    console.error("PUT /api/chart-of-accounts error:", error)
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 })
    }

    const hasLines = await prisma.journalLine.findFirst({
      where: { accountId: parseInt(id) },
    })
    if (hasLines) {
      return NextResponse.json(
        { error: "Cannot delete account with existing journal entries" },
        { status: 409 }
      )
    }

    await prisma.chartOfAccount.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ message: "Account deleted" })
  } catch (error) {
    console.error("DELETE /api/chart-of-accounts error:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
