import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { roundMoney } from "@/lib/loan-repayment"

export const maxDuration = 60

const CHARITY_AMOUNT = 6000
const TIME_ZONE = "Africa/Kampala"

/**
 * Annual charity fund deduction (SACCO policy - no member notification).
 *
 * Runs in November: UGX 6,000 is deducted from each active member's savings
 * account for the charity fund. Members with less than UGX 6,000 (or no
 * savings) are skipped - balances are never driven negative.
 *
 * Idempotent: the charity_deductions row (member + year) makes a re-run, a
 * duplicated trigger or a crash-resume safe. No SMS / notifications.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const { searchParams } = new URL(request.url)

    const { year, month, day } = calendarDate(now)

    const isDev = process.env.NODE_ENV === "development"
    const force = isDev && searchParams.get("force") === "1"
    const memberIdsParam = isDev ? searchParams.get("memberIds") : null

    if (!force && month !== 11) {
      return NextResponse.json({
        message: "Charity deductions only run in November - nothing to do",
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        timeZone: TIME_ZONE,
        membersProcessed: 0,
        totalDeducted: 0,
      })
    }

    const members = await prisma.member.findMany({
      where: memberIdsParam
        ? { status: "Active", id: { in: memberIdsParam.split(",").map((v) => parseInt(v.trim())).filter(Number.isFinite) } }
        : { status: "Active" },
      select: { id: true, memberCode: true },
      orderBy: { id: "asc" },
    })

    let membersProcessed = 0
    let skippedLowBalance = 0

    for (const member of members) {
      const alreadyCharged = await prisma.charityDeduction.findFirst({
        where: { memberId: member.id, year },
        select: { id: true },
      })
      if (alreadyCharged) continue

      const lastEntry = await prisma.savingsLedger.findFirst({
        where: { memberId: member.id },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const balance = roundMoney(lastEntry?.balanceAfter ?? 0)
      if (balance < CHARITY_AMOUNT) {
        skippedLowBalance += 1
        continue
      }

      const referenceNumber = `CHARITY-${year}-${member.id}`
      const newBalance = roundMoney(balance - CHARITY_AMOUNT)

      await prisma.$transaction(
        [
          prisma.charityDeduction.create({
            data: {
              memberId: member.id,
              amount: CHARITY_AMOUNT,
              year,
            },
          }),
          prisma.savingsLedger.create({
            data: {
              memberId: member.id,
              transactionType: "Withdrawal",
              amount: CHARITY_AMOUNT,
              balanceAfter: newBalance,
              narration: "Annual Charity Fund Deduction",
              referenceNumber,
              transactionDate: now,
            },
          }),
        ],
        { isolationLevel: "ReadCommitted" }
      )

      membersProcessed += 1
    }

    const totalDeducted = roundMoney(membersProcessed * CHARITY_AMOUNT)

    if (membersProcessed > 0) {
      await prisma.auditTrail.create({
        data: {
          actionType: "CharityDeduction",
          description:
            `Annual charity fund deduction of UGX ${CHARITY_AMOUNT.toLocaleString()} collected ` +
            `for ${year} from ${membersProcessed} member(s) (total UGX ${totalDeducted.toLocaleString()}); ` +
            `${skippedLowBalance} member(s) skipped for low balance`,
          amount: totalDeducted,
          referenceNumber: `CHARITY-${year}`,
          tableName: "charity_deductions",
        },
      })
    }

    return NextResponse.json({
      message: membersProcessed > 0 ? `Charity deductions processed for ${year}` : `No charity deductions due for ${year}`,
      year,
      month,
      membersConsidered: members.length,
      membersProcessed,
      skippedLowBalance,
      totalDeducted,
    })
  } catch (error) {
    console.error("GET /api/cron/charity error:", error)
    return NextResponse.json({ error: "Failed to process charity deductions" }, { status: 500 })
  }
}

function calendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  return { year: get("year"), month: get("month"), day: get("day") }
}
