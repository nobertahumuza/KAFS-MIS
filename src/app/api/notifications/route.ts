import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get("filter") || "all"

    const where: Record<string, unknown> = {}

    if (filter === "unread") {
      where.isRead = false
    } else if (filter === "warnings") {
      where.severity = "warning"
    } else if (filter === "alerts") {
      where.severity = "alert"
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    const unreadCount = await prisma.notification.count({ where: { isRead: false } })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("GET /api/notifications error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ message: "All notifications marked as read" })
    }

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 })
    }

    await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: true },
    })

    return NextResponse.json({ message: "Notification marked as read" })
  } catch (error) {
    console.error("PATCH /api/notifications error:", error)
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
  }
}
