import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const members = await prisma.member.findMany({
      where: { status: "Active" },
    })

    const SERVICE_FEE_AMOUNT = 300
    const processed: { memberId: number; memberName: string; amount: number; newBalance: number }[] = []
    let totalDeducted = 0

    for (const member of members) {
      const existing = await prisma.serviceFeeDeduction.findFirst({
        where: { memberId: member.id, month: currentMonth, year: currentYear },
      })

      if (existing) continue

      const lastEntry = await prisma.savingsLedger.findFirst({
        where: { memberId: member.id },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const currentBalance = lastEntry?.balanceAfter ?? 0

      const newBalance = currentBalance - SERVICE_FEE_AMOUNT

      await prisma.serviceFeeDeduction.create({
        data: {
          memberId: member.id,
          amount: SERVICE_FEE_AMOUNT,
          month: currentMonth,
          year: currentYear,
        },
      })

      await prisma.savingsLedger.create({
        data: {
          memberId: member.id,
          transactionType: "Withdrawal",
          amount: SERVICE_FEE_AMOUNT,
          balanceAfter: newBalance,
          narration: "Monthly Service Fee",
          transactionDate: now,
        },
      })

      totalDeducted += SERVICE_FEE_AMOUNT
      processed.push({
        memberId: member.id,
        memberName: member.farmerName,
        amount: SERVICE_FEE_AMOUNT,
        newBalance,
      })
    }

    return NextResponse.json({
      message: "Service fees processed",
      month: currentMonth,
      year: currentYear,
      membersProcessed: processed.length,
      totalDeducted,
      details: processed,
    })
  } catch (error) {
    console.error("POST /api/cron/service-fees error:", error)
    return NextResponse.json({ error: "Failed to process service fees" }, { status: 500 })
  }
}
