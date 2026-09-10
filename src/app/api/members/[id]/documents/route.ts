import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(
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

    const documents = await prisma.memberDocument.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("GET /api/members/[id]/documents error:", error)
    return NextResponse.json(
      { error: "Failed to fetch member documents" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
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
    const { docType, docName, fileUrl, fileSize, mimeType } = body

    if (!docType?.trim()) {
      return NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      )
    }

    if (!docName?.trim()) {
      return NextResponse.json(
        { error: "Document name is required" },
        { status: 400 }
      )
    }

    if (!fileUrl?.trim()) {
      return NextResponse.json(
        { error: "File URL is required" },
        { status: 400 }
      )
    }

    const document = await prisma.memberDocument.create({
      data: {
        memberId,
        docType: docType.trim(),
        docName: docName.trim(),
        fileUrl: fileUrl.trim(),
        fileSize: fileSize ? parseInt(fileSize) : null,
        mimeType: mimeType?.trim() || null,
        uploadedBy: parseInt(user.id),
      },
    })

    return NextResponse.json(
      { message: "Document uploaded successfully", document },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/members/[id]/documents error:", error)
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    )
  }
}
