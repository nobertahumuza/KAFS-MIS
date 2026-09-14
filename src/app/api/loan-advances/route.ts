import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId") || ""
    const loanId = searchParams.get("loanId") || ""
    const status = searchParams.get("status") || ""

    const where: Record<string, unknown> = {}

    if (memberId) where.memberId = parseInt(memberId)
    if (loanId) where.loanId = parseInt(loanId)
    if (status) where.status = status

    const advances = await prisma.loanAdvance.findMany({
      where,
      include: {
        member: { select: { id: true, farmerName: true, memberCode: true } },
        loan: { select: { id: true, loanCode: true, principalAmount: true, currentBalance: true } },
        recorder: { select: { fullName: true } },
        approver: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      data: advances.map((a) => ({
        id: a.id,
        advanceCode: a.advanceCode,
        memberId: a.memberId,
        memberName: a.member.farmerName,
        memberCode: a.member.memberCode,
        loanId: a.loanId,
        loanCode: a.loan.loanCode,
        advanceAmount: a.advanceAmount,
        reason: a.reason,
        status: a.status,
        recordedBy: a.recorder?.fullName || null,
        approvedBy: a.approver?.fullName || null,
        approvedAt: a.approvedAt?.toISOString() || null,
        disbursementDate: a.disbursementDate?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/loan-advances error:", error)
    return NextResponse.json({ error: "Failed to fetch loan advances" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { memberId, loanId, advanceAmount, reason } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }

    if (!loanId) {
      return NextResponse.json({ error: "Loan ID is required" }, { status: 400 })
    }

    if (!advanceAmount || advanceAmount <= 0) {
      return NextResponse.json({ error: "Valid advance amount is required" }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({ where: { id: loanId } })
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (loan.loanStatus !== "Active") {
      return NextResponse.json({ error: "Loan is not active" }, { status: 400 })
    }

    if (loan.memberId !== memberId) {
      return NextResponse.json({ error: "Loan does not belong to this member" }, { status: 400 })
    }

    const maxAdvance = loan.currentBalance * 0.5
    if (advanceAmount > maxAdvance) {
      return NextResponse.json(
        { error: `Advance amount exceeds 50% of remaining balance. Maximum: UGX ${maxAdvance.toLocaleString()}` },
        { status: 400 }
      )
    }

    const lastAdvance = await prisma.loanAdvance.findFirst({
      orderBy: { id: "desc" },
      select: { advanceCode: true },
    })
    let nextIndex = 1
    if (lastAdvance?.advanceCode) {
      const match = lastAdvance.advanceCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }
    const advanceCode = `KAFS-ADV-${String(nextIndex).padStart(3, "0")}`

    const recordUserId = Number((user as { id?: string | number }).id)

    const advance = await prisma.loanAdvance.create({
      data: {
        advanceCode,
        memberId,
        loanId,
        advanceAmount,
        reason: reason || null,
        status: "Pending",
        recordedBy: recordUserId || null,
      },
    })

    return NextResponse.json(
      { message: "Loan advance request created", data: advance },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/loan-advances error:", error)
    return NextResponse.json({ error: "Failed to create loan advance" }, { status: 500 })
  }
}
