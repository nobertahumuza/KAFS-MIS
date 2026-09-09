import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const messageType = searchParams.get("messageType") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { phoneNumber: { contains: search } },
        { message: { contains: search } },
        { member: { farmerName: { contains: search } } },
      ]
    }

    if (messageType) {
      where.messageType = messageType
    }

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        include: {
          member: { select: { id: true, farmerName: true, memberCode: true } },
          sender: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count({ where }),
    ])

    return NextResponse.json({
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/sms error:", error)
    return NextResponse.json({ error: "Failed to fetch SMS logs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, phoneNumber, message, messageType = "General" } = body

    if (!phoneNumber?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const log = await prisma.smsLog.create({
      data: {
        memberId: memberId ? parseInt(memberId) : null,
        phoneNumber: phoneNumber.trim(),
        message: message.trim(),
        messageType,
        status: "Pending",
      },
    })

    return NextResponse.json({ data: log, message: "SMS queued" }, { status: 201 })
  } catch (error) {
    console.error("POST /api/sms error:", error)
    return NextResponse.json({ error: "Failed to queue SMS" }, { status: 500 })
  }
}
