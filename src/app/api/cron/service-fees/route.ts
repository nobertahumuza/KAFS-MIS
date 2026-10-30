import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { roundMoney } from "@/lib/loan-repayment"

// The run walks every active member, so give the function a full budget.
export const maxDuration = 60

const SERVICE_FEE_AMOUNT = 300
/** Member registered as the SACCO's service-fee collection account. */
const FEE_ACCOUNT_CODE = "KAFS-557"
const TIME_ZONE = "Africa/Kampala"

/**
 * Monthly service fee (SACCO policy - members are NOT notified).
 *
 * On the last day of every month, UGX 300 is deducted from each active
 * member's savings account and credited into the service-fee account
 * (KAFS-557). One deposit per member, narrated with the payer's code, so
 * the collection is fully traceable in that account's ledger.
 *
 * Rules:
 *  - Members with less than UGX 300 (or no savings) are skipped - balances
 *    are never driven negative.
 *  - The fee account itself is never charged.
 *  - Idempotent: the service_fee_deductions row (member + month + year)
 *    makes a re-run, a duplicated cron trigger or a crash-resume safe.
 *  - No SMS / notifications are sent, per SACCO policy.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const { searchParams } = new URL(request.url)

    // Vercel cron sends the schedule's timezone as UTC; decide "last day of
    // month" on the SACCO's own calendar (Africa/Kampala).
    const { year, month, day } = calendarDate(now)

    // Test hooks - development only, ignored in production.
    const isDev = process.env.NODE_ENV === "development"
    const force = isDev && searchParams.get("force") === "1"
    const memberIdsParam = isDev ? searchParams.get("memberIds") : null

    if (!force && !isLastDayOfMonth(year, month, day)) {
      return NextResponse.json({
        message: "Not the last day of the month - nothing to do",
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        timeZone: TIME_ZONE,
        membersProcessed: 0,
        totalDeducted: 0,
      })
    }

    const feeAccount = await prisma.member.findFirst({
      where: { memberCode: FEE_ACCOUNT_CODE },
      select: { id: true, memberCode: true },
    })
    if (!feeAccount) {
      return NextResponse.json(
        { error: `Service fee account ${FEE_ACCOUNT_CODE} not found - refusing to run` },
        { status: 500 }
      )
    }

    const members = await prisma.member.findMany({
      where: memberIdsParam
        ? {
            status: "Active",
            id: { in: memberIdsParam.split(",").map((v) => parseInt(v.trim())).filter(Number.isFinite) },
          }
        : { status: "Active", NOT: { id: feeAccount.id } },
      select: { id: true, memberCode: true },
      orderBy: { id: "asc" },
    })

    // Running balance of the fee account, topped up by every deposit below.
    const feeLastEntry = await prisma.savingsLedger.findFirst({
      where: { memberId: feeAccount.id },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })
    let feeAccountBalance = roundMoney(feeLastEntry?.balanceAfter ?? 0)

    let membersProcessed = 0
    let skippedLowBalance = 0
    const monthCode = `${year}-${String(month).padStart(2, "0")}`

    for (const member of members) {
      const alreadyCharged = await prisma.serviceFeeDeduction.findFirst({
        where: { memberId: member.id, month, year },
        select: { id: true },
      })
      if (alreadyCharged) continue

      const lastEntry = await prisma.savingsLedger.findFirst({
        where: { memberId: member.id },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const balance = roundMoney(lastEntry?.balanceAfter ?? 0)
      // Never drive a balance negative (SACCO policy decision).
      if (balance < SERVICE_FEE_AMOUNT) {
        skippedLowBalance += 1
        continue
      }

      const referenceNumber = `SVCFEE-${monthCode}-${member.id}`
      const newMemberBalance = roundMoney(balance - SERVICE_FEE_AMOUNT)
      feeAccountBalance = roundMoney(feeAccountBalance + SERVICE_FEE_AMOUNT)

      // Deduction, member withdrawal and the credit into KAFS-557 book
      // together or not at all.
      await prisma.$transaction(
        [
          prisma.serviceFeeDeduction.create({
            data: {
              memberId: member.id,
              amount: SERVICE_FEE_AMOUNT,
              month,
              year,
              referenceNo: referenceNumber,
            },
          }),
          prisma.savingsLedger.create({
            data: {
              memberId: member.id,
              transactionType: "Withdrawal",
              amount: SERVICE_FEE_AMOUNT,
              balanceAfter: newMemberBalance,
              narration: "Monthly Service Fee",
              referenceNumber,
              transactionDate: now,
            },
          }),
          prisma.savingsLedger.create({
            data: {
              memberId: feeAccount.id,
              transactionType: "Deposit",
              amount: SERVICE_FEE_AMOUNT,
              balanceAfter: feeAccountBalance,
              narration: `Monthly service fee - ${member.memberCode}`,
              referenceNumber,
              transactionDate: now,
            },
          }),
        ],
        { isolationLevel: "ReadCommitted" }
      )

      membersProcessed += 1
    }

    const totalDeducted = roundMoney(membersProcessed * SERVICE_FEE_AMOUNT)

    if (membersProcessed > 0) {
      await prisma.auditTrail.create({
        data: {
          actionType: "ServiceFeeCollection",
          description:
            `Monthly service fee of UGX ${SERVICE_FEE_AMOUNT.toLocaleString()} collected ` +
            `for ${monthCode} from ${membersProcessed} member(s) (total UGX ${totalDeducted.toLocaleString()}) ` +
            `into ${FEE_ACCOUNT_CODE}; ${skippedLowBalance} member(s) skipped for low balance`,
          amount: totalDeducted,
          referenceNumber: `SVCFEE-${monthCode}`,
          tableName: "service_fee_deductions",
        },
      })
    }

    return NextResponse.json({
      message:
        membersProcessed > 0
          ? `Service fees processed for ${monthCode}`
          : `No service fees due for ${monthCode}`,
      month,
      year,
      feeAccount: FEE_ACCOUNT_CODE,
      membersConsidered: members.length,
      membersProcessed,
      skippedLowBalance,
      totalDeducted,
      feeAccountBalance,
    })
  } catch (error) {
    console.error("GET /api/cron/service-fees error:", error)
    return NextResponse.json({ error: "Failed to process service fees" }, { status: 500 })
  }
}

/** Calendar date in the SACCO's timezone (cron executes in UTC). */
function calendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")
  return { year: get("year"), month: get("month"), day: get("day") }
}

function isLastDayOfMonth(year: number, month: number, day: number) {
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
  return nextDay.getUTCMonth() !== month - 1
}
