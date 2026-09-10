import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const body = await request.json()
    const { photo } = body

    if (!photo || typeof photo !== "string") {
      return NextResponse.json(
        { error: "Photo base64 data URL is required" },
        { status: 400 }
      )
    }

    if (!photo.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid photo format. Expected a base64 data URL" },
        { status: 400 }
      )
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: { photoUrl: photo },
    })

    return NextResponse.json({
      message: "Member photo uploaded successfully",
      photoUrl: updated.photoUrl,
    })
  } catch (error) {
    console.error("POST /api/members/[id]/photo error:", error)
    return NextResponse.json(
      { error: "Failed to upload member photo" },
      { status: 500 }
    )
  }
}
