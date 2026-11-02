import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { excludeCollectionAccounts } from "@/lib/collection-accounts"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""

    if (q.length < 1) {
      return NextResponse.json({ data: [] })
    }

    const members = await prisma.member.findMany({
      where: {
        // Bank accounts are not members - keep them out of pickers.
        ...excludeCollectionAccounts(),
        OR: [
          { farmerName: { contains: q } },
          { memberCode: { contains: q } },
          { phoneNumber: { contains: q } },
        ],
      },
      select: {
        id: true,
        memberCode: true,
        farmerName: true,
        phoneNumber: true,
        gender: true,
        parish: true,
        district: true,
        occupation: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json({ data: members })
  } catch (error) {
    console.error("GET /api/members/search error:", error)
    return NextResponse.json({ error: "Failed to search members" }, { status: 500 })
  }
}
