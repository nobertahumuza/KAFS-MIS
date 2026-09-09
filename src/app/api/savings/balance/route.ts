import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    const id = parseInt(memberId)
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid memberId" }, { status: 400 })
    }

    const lastTransaction = await prisma.savingsLedger.findFirst({
      where: { memberId: id },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })

    return NextResponse.json({
      memberId: id,
      balance: lastTransaction?.balanceAfter ?? 0,
    })
  } catch (error) {
    console.error("GET /api/savings/balance error:", error)
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    )
  }
}
