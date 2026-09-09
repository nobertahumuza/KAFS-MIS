import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { fixedCode: { contains: search } },
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    const accounts = await prisma.fixedAccount.findMany({
      where,
      include: { member: { select: { id: true, farmerName: true, memberCode: true } } },
      orderBy: { createdAt: "desc" },
    })

    const totalAccounts = await prisma.fixedAccount.count()
    const activeAccounts = await prisma.fixedAccount.count({ where: { status: "Active" } })
    const maturedAccounts = await prisma.fixedAccount.count({ where: { status: "Matured" } })
    const totalValueAgg = await prisma.fixedAccount.aggregate({ _sum: { principalAmount: true } })

    return NextResponse.json({
      accounts,
      summary: {
        totalAccounts,
        activeAccounts,
        maturedAccounts,
        totalValue: totalValueAgg._sum.principalAmount || 0,
      },
    })
  } catch (error) {
    console.error("GET /api/fixed-accounts error:", error)
    return NextResponse.json({ error: "Failed to fetch fixed accounts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, principalAmount, duration, startDate } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }
    if (!principalAmount || principalAmount <= 0) {
      return NextResponse.json({ error: "Valid principal amount is required" }, { status: 400 })
    }
    if (![3, 6, 12].includes(Number(duration))) {
      return NextResponse.json({ error: "Duration must be 3, 6, or 12 months" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: Number(memberId) } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const lastAccount = await prisma.fixedAccount.findFirst({
      orderBy: { id: "desc" },
      select: { fixedCode: true },
    })
    let nextIndex = 1
    if (lastAccount?.fixedCode) {
      const match = lastAccount.fixedCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }
    const fixedCode = `KAFS-FIX-${String(nextIndex).padStart(3, "0")}`

    const start = startDate ? new Date(startDate) : new Date()
    const durationNum = Number(duration)
    const maturityDate = new Date(start)
    maturityDate.setMonth(maturityDate.getMonth() + durationNum)

    const interestRate = durationNum === 6 ? 3 : durationNum === 12 ? 6 : 1.5
    const interestEarned = principalAmount * (interestRate / 100)
    const maturityAmount = principalAmount + interestEarned

    const account = await prisma.fixedAccount.create({
      data: {
        fixedCode,
        memberId: Number(memberId),
        accountNumber: member.memberCode,
        principalAmount: Number(principalAmount),
        startDate: start,
        fixedPeriod: durationNum,
        maturityDate,
        interestRate,
        interestEarned,
        maturityAmount,
        status: "Active",
      },
      include: { member: { select: { id: true, farmerName: true, memberCode: true } } },
    })

    return NextResponse.json({ message: "Fixed account created successfully", account }, { status: 201 })
  } catch (error) {
    console.error("POST /api/fixed-accounts error:", error)
    return NextResponse.json({ error: "Failed to create fixed account" }, { status: 500 })
  }
}
