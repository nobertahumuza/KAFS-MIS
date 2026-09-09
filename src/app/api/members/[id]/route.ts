import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    return NextResponse.json(member)
  } catch (error) {
    console.error("GET /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch member" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)
    const body = await request.json()

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      "farmerName", "phoneNumber", "email", "gender", "ninNumber",
      "address", "village", "parish", "subCounty", "district",
      "occupation", "idDocumentType", "idDocumentNumber",
      "nextOfKinName", "nextOfKinPhone", "status",
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: updateData,
    })

    return NextResponse.json({ message: "Member updated successfully", member: updated })
  } catch (error) {
    console.error("PATCH /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const hasLoans = await prisma.loan.count({ where: { memberId } })
    if (hasLoans > 0) {
      return NextResponse.json(
        { error: "Cannot delete member with existing loans" },
        { status: 400 }
      )
    }

    const hasSavings = await prisma.savingsLedger.count({ where: { memberId } })
    if (hasSavings > 0) {
      return NextResponse.json(
        { error: "Cannot delete member with existing savings transactions" },
        { status: 400 }
      )
    }

    await prisma.customer.deleteMany({ where: { memberId } })
    await prisma.member.delete({ where: { id: memberId } })

    return NextResponse.json({ message: "Member deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 })
  }
}
