import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { smsSharePurchase } from "@/lib/sms"
import { notifySharePurchase } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "50")

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
      ]
    }

    const transactions = await prisma.sharesLedger.findMany({
      where,
      include: { member: { select: { id: true, farmerName: true, memberCode: true } } },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const membersWithShares = await prisma.member.findMany({
      where: { totalShares: { gt: 0 } },
      select: { id: true, farmerName: true, memberCode: true, totalShares: true, shareValue: true },
      orderBy: { shareValue: "desc" },
    })

    const totalSharesAgg = await prisma.member.aggregate({ _sum: { totalShares: true } })
    const totalValueAgg = await prisma.member.aggregate({ _sum: { shareValue: true } })

    return NextResponse.json({
      transactions,
      shareholders: membersWithShares,
      summary: {
        totalSharesIssued: totalSharesAgg._sum.totalShares || 0,
        totalValue: totalValueAgg._sum.shareValue || 0,
        shareholdersCount: membersWithShares.length,
        pricePerShare: 10000,
      },
    })
  } catch (error) {
    console.error("GET /api/shares error:", error)
    return NextResponse.json({ error: "Failed to fetch shares data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, quantity, sharePrice, transactionType, transactionDate, narration } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: "Valid quantity is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: Number(memberId) } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const price = Number(sharePrice) || 10000
    const qty = Number(quantity)
    const totalAmount = price * qty

    const lastTx = await prisma.sharesLedger.findFirst({
      orderBy: { id: "desc" },
      select: { referenceNumber: true },
    })
    let nextIndex = 1
    if (lastTx?.referenceNumber) {
      const match = lastTx.referenceNumber.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }

    const referenceNumber = `REF-SHR-${String(nextIndex).padStart(3, "0")}`

    await prisma.sharesLedger.create({
      data: {
        memberId: Number(memberId),
        transactionType: transactionType || "Purchase",
        sharesQuantity: qty,
        sharePrice: price,
        totalAmount,
        narration: narration?.trim() || null,
        referenceNumber,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      },
    })

    const updatedMember = await prisma.member.update({
      where: { id: Number(memberId) },
      data: {
        totalShares: { increment: qty },
        shareValue: { increment: totalAmount },
      },
    })

    smsSharePurchase(Number(memberId), qty, price, totalAmount, referenceNumber)
    notifySharePurchase(Number(memberId), member.farmerName, qty, totalAmount)

    return NextResponse.json({ message: "Shares purchased successfully", member: updatedMember }, { status: 201 })
  } catch (error) {
    console.error("POST /api/shares error:", error)
    return NextResponse.json({ error: "Failed to record share transaction" }, { status: 500 })
  }
}
