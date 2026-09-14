import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const accountId = parseInt(id)

    if (isNaN(accountId)) {
      return NextResponse.json({ error: "Invalid account ID" }, { status: 400 })
    }

    const account = await prisma.jointAccount.findUnique({
      where: { id: accountId },
      include: {
        members: {
          include: {
            member: {
              select: {
                id: true,
                farmerName: true,
                memberCode: true,
                phoneNumber: true,
                email: true,
                village: true,
                parish: true,
                district: true,
              },
            },
          },
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: "Joint account not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      totalBalance: account.totalBalance,
      status: account.status,
      members: account.members.map((m) => ({
        id: m.member.id,
        farmerName: m.member.farmerName,
        memberCode: m.member.memberCode,
        phoneNumber: m.member.phoneNumber,
        email: m.member.email,
        village: m.member.village,
        parish: m.member.parish,
        district: m.member.district,
        role: m.role,
        sharePercent: m.sharePercent,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: account.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("GET /api/joint-accounts/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch joint account" }, { status: 500 })
  }
}
