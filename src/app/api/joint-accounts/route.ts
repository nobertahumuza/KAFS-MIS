import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const accounts = await prisma.jointAccount.findMany({
      include: {
        members: {
          include: {
            member: { select: { id: true, farmerName: true, memberCode: true, phoneNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      data: accounts.map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountType: a.accountType,
        totalBalance: a.totalBalance,
        status: a.status,
        members: a.members.map((m) => ({
          id: m.member.id,
          farmerName: m.member.farmerName,
          memberCode: m.member.memberCode,
          phoneNumber: m.member.phoneNumber,
          role: m.role,
          sharePercent: m.sharePercent,
          joinedAt: m.joinedAt.toISOString(),
        })),
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/joint-accounts error:", error)
    return NextResponse.json({ error: "Failed to fetch joint accounts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { accountName, memberIds, sharePercents } = body

    if (!accountName?.trim()) {
      return NextResponse.json({ error: "Account name is required" }, { status: 400 })
    }

    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return NextResponse.json({ error: "At least 2 members are required" }, { status: 400 })
    }

    if (memberIds.length > 3) {
      return NextResponse.json({ error: "Maximum 3 members allowed" }, { status: 400 })
    }

    if (!Array.isArray(sharePercents) || sharePercents.length !== memberIds.length) {
      return NextResponse.json({ error: "Share percents must match member count" }, { status: 400 })
    }

    const totalPercent = sharePercents.reduce((sum: number, p: number) => sum + p, 0)
    if (Math.abs(totalPercent - 100) > 0.01) {
      return NextResponse.json({ error: "Share percents must sum to 100" }, { status: 400 })
    }

    for (const memberId of memberIds) {
      const member = await prisma.member.findUnique({ where: { id: memberId } })
      if (!member) {
        return NextResponse.json({ error: `Member ID ${memberId} not found` }, { status: 404 })
      }
    }

    const uniqueIds = new Set(memberIds)
    if (uniqueIds.size !== memberIds.length) {
      return NextResponse.json({ error: "Duplicate members not allowed" }, { status: 400 })
    }

    const lastAccount = await prisma.jointAccount.findFirst({
      orderBy: { id: "desc" },
      select: { accountCode: true },
    })
    let nextIndex = 1
    if (lastAccount?.accountCode) {
      const match = lastAccount.accountCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }
    const accountCode = `KAFS-JA-${String(nextIndex).padStart(3, "0")}`

    const recordUserId = Number((user as { id?: string | number }).id)

    const jointAccount = await prisma.jointAccount.create({
      data: {
        accountCode,
        accountName: accountName.trim(),
        totalBalance: 0,
        status: "Active",
        createdBy: recordUserId || null,
      },
    })

    for (let i = 0; i < memberIds.length; i++) {
      await prisma.jointAccountMember.create({
        data: {
          jointAccountId: jointAccount.id,
          memberId: memberIds[i],
          role: i === 0 ? "Primary" : "Member",
          sharePercent: sharePercents[i],
        },
      })
    }

    const created = await prisma.jointAccount.findUnique({
      where: { id: jointAccount.id },
      include: {
        members: {
          include: {
            member: { select: { id: true, farmerName: true, memberCode: true } },
          },
        },
      },
    })

    return NextResponse.json(
      { message: "Joint account created successfully", data: created },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/joint-accounts error:", error)
    return NextResponse.json({ error: "Failed to create joint account" }, { status: 500 })
  }
}
