import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""
    const userId = searchParams.get("userId") || ""
    const actionType = searchParams.get("actionType") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "50")

    const where: Record<string, unknown> = {}

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        ;(where.createdAt as Record<string, unknown>).lte = to
      }
    }
    if (userId) where.userId = Number(userId)
    if (actionType) where.actionType = actionType

    const [trails, total] = await Promise.all([
      prisma.auditTrail.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditTrail.count({ where }),
    ])

    const users = await prisma.user.findMany({
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: "asc" },
    })

    return NextResponse.json({
      trails,
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/audit-trail error:", error)
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 })
  }
}
