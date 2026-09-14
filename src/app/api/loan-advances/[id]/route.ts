import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const advanceId = parseInt(id)

    if (isNaN(advanceId)) {
      return NextResponse.json({ error: "Invalid advance ID" }, { status: 400 })
    }

    const advance = await prisma.loanAdvance.findUnique({
      where: { id: advanceId },
      include: {
        member: { select: { id: true, farmerName: true, memberCode: true, phoneNumber: true } },
        loan: { select: { id: true, loanCode: true, principalAmount: true, currentBalance: true } },
        recorder: { select: { fullName: true } },
        approver: { select: { fullName: true } },
      },
    })

    if (!advance) {
      return NextResponse.json({ error: "Loan advance not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: advance.id,
      advanceCode: advance.advanceCode,
      memberId: advance.memberId,
      memberName: advance.member.farmerName,
      memberCode: advance.member.memberCode,
      loanId: advance.loanId,
      loanCode: advance.loan.loanCode,
      advanceAmount: advance.advanceAmount,
      reason: advance.reason,
      status: advance.status,
      recordedBy: advance.recorder?.fullName || null,
      approvedBy: advance.approver?.fullName || null,
      approvedAt: advance.approvedAt?.toISOString() || null,
      disbursementDate: advance.disbursementDate?.toISOString() || null,
      createdAt: advance.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("GET /api/loan-advances/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch loan advance" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const advanceId = parseInt(id)

    if (isNaN(advanceId)) {
      return NextResponse.json({ error: "Invalid advance ID" }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    if (!action || !["approve", "disburse"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'approve' or 'disburse'" }, { status: 400 })
    }

    const advance = await prisma.loanAdvance.findUnique({ where: { id: advanceId } })
    if (!advance) {
      return NextResponse.json({ error: "Loan advance not found" }, { status: 404 })
    }

    const recordUserId = Number((user as { id?: string | number }).id)

    if (action === "approve") {
      if (advance.status !== "Pending") {
        return NextResponse.json({ error: "Only pending advances can be approved" }, { status: 400 })
      }

      const updated = await prisma.loanAdvance.update({
        where: { id: advanceId },
        data: {
          status: "Approved",
          approvedBy: recordUserId || null,
          approvedAt: new Date(),
        },
      })

      return NextResponse.json({ message: "Advance approved", data: updated })
    }

    if (action === "disburse") {
      if (advance.status !== "Approved") {
        return NextResponse.json({ error: "Only approved advances can be disbursed" }, { status: 400 })
      }

      const updated = await prisma.loanAdvance.update({
        where: { id: advanceId },
        data: {
          status: "Disbursed",
          disbursementDate: new Date(),
        },
      })

      await prisma.loan.update({
        where: { id: advance.loanId },
        data: { currentBalance: { increment: advance.advanceAmount } },
      })

      return NextResponse.json({ message: "Advance disbursed", data: updated })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("PUT /api/loan-advances/[id] error:", error)
    return NextResponse.json({ error: "Failed to update loan advance" }, { status: 500 })
  }
}
