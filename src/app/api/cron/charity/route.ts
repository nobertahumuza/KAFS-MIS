import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const now = new Date()
    const currentMonth = now.getMonth() + 1

    if (currentMonth !== 11) {
      return NextResponse.json(
        { error: "Charity deductions only run in November" },
        { status: 400 }
      )
    }

    const currentYear = now.getFullYear()
    const CHARITY_AMOUNT = 6000

    const members = await prisma.member.findMany({
      where: { status: "Active" },
    })

    const processed: { memberId: number; memberName: string; amount: number; newBalance: number }[] = []
    let totalDeducted = 0

    for (const member of members) {
      const existing = await prisma.charityDeduction.findFirst({
        where: { memberId: member.id, year: currentYear },
      })

      if (existing) continue

      const lastEntry = await prisma.savingsLedger.findFirst({
        where: { memberId: member.id },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const currentBalance = lastEntry?.balanceAfter ?? 0

      const newBalance = currentBalance - CHARITY_AMOUNT

      await prisma.charityDeduction.create({
        data: {
          memberId: member.id,
          amount: CHARITY_AMOUNT,
          year: currentYear,
        },
      })

      await prisma.savingsLedger.create({
        data: {
          memberId: member.id,
          transactionType: "Withdrawal",
          amount: CHARITY_AMOUNT,
          balanceAfter: newBalance,
          narration: "Annual Charity Fund Deduction",
          transactionDate: now,
        },
      })

      totalDeducted += CHARITY_AMOUNT
      processed.push({
        memberId: member.id,
        memberName: member.farmerName,
        amount: CHARITY_AMOUNT,
        newBalance,
      })
    }

    return NextResponse.json({
      message: "Charity deductions processed",
      year: currentYear,
      membersProcessed: processed.length,
      totalDeducted,
      details: processed,
    })
  } catch (error) {
    console.error("POST /api/cron/charity error:", error)
    return NextResponse.json({ error: "Failed to process charity deductions" }, { status: 500 })
  }
}
