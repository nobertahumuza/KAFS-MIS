import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId") || ""

    const where: Record<string, unknown> = {}

    if (memberId) where.memberId = parseInt(memberId)

    const fees = await prisma.membershipFee.findMany({
      where,
      include: {
        member: { select: { id: true, farmerName: true, memberCode: true } },
        recorder: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      data: fees.map((f) => ({
        id: f.id,
        memberId: f.memberId,
        memberName: f.member.farmerName,
        memberCode: f.member.memberCode,
        amount: f.amount,
        feeType: f.feeType,
        description: f.description,
        paidDate: f.paidDate.toISOString(),
        recordedBy: f.recorder?.fullName || null,
        createdAt: f.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/membership-fees error:", error)
    return NextResponse.json({ error: "Failed to fetch membership fees" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { memberId, amount, description } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const recordUserId = Number((user as { id?: string | number }).id)

    const fee = await prisma.membershipFee.create({
      data: {
        memberId,
        amount,
        description: description || null,
        paidDate: new Date(),
        recordedBy: recordUserId || null,
      },
    })

    return NextResponse.json(
      { message: "Membership fee recorded", data: fee },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/membership-fees error:", error)
    return NextResponse.json({ error: "Failed to record membership fee" }, { status: 500 })
  }
}
