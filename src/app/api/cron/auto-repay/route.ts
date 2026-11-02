import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { roundMoney } from "@/lib/loan-repayment"
import { applyDepositToLoans } from "@/lib/loan-offset"
import { smsLoanAutoRepay } from "@/lib/sms"
import { notifyAutoRepay, createNotification } from "@/lib/notify"
import { COLLECTION_ACCOUNT_CODES } from "@/lib/collection-accounts"

export const maxDuration = 60

const TIME_ZONE = "Africa/Kampala"

/**
 * Auto-repay: collect due loan installments straight from members' savings.
 *
 * Runs daily at 07:00 UTC (10:00 EAT) - before the penalties cron at
 * 15:00 UTC, so installments paid here are never fined the same day.
 *
 * Behaviour (gated by the `auto_repay_enabled` Settings toggle, default OFF):
 *  - every Pending/Partial installment whose due date has passed is collected
 *    for that member (all arrears in one run, capped at the savings balance -
 *    balances are never driven negative),
 *  - the money is booked through the same offset engine as a manual deposit
 *    offset (fines -> interest -> principal, oldest loan first),
 *  - each member gets an SMS saying the money was taken to repay the loan,
 *  - the cashier gets a detailed in-app notification of exactly how each
 *    transaction went (per-loan split, new balances), plus a run summary.
 *
 * Idempotent per member per day: the savings withdrawal is booked with the
 * reference AUTOPAY-<kampala-date>-<memberId>, and a member whose reference
 * already exists is skipped on re-runs.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const { searchParams } = new URL(request.url)

    // Test hooks - development only, ignored in production.
    const isDev = process.env.NODE_ENV === "development"
    const force = isDev && searchParams.get("force") === "1"
    const memberIdsParam = isDev ? searchParams.get("memberIds") : null

    const setting = await prisma.appSetting.findUnique({
      where: { settingKey: "auto_repay_enabled" },
    })
    const enabled = setting?.settingValue === "true"
    if (!enabled && !force) {
      return NextResponse.json({
        message: "Auto-repay is OFF in Settings - nothing collected",
        skipped: true,
        membersProcessed: 0,
        totalCollected: 0,
      })
    }

    const { year, month, day } = calendarDate(now)

    const dueSchedules = await prisma.loanRepaymentSchedule.findMany({
      where: {
        status: { in: ["Pending", "Partial"] },
        dueDate: { lte: now },
        loan: {
          loanStatus: "Active",
          // Bank/collection accounts never hold loans - exclude defensively.
          NOT: { member: { memberCode: { in: [...COLLECTION_ACCOUNT_CODES] } } },
          ...(memberIdsParam
            ? {
                memberId: {
                  in: memberIdsParam
                    .split(",")
                    .map((v) => parseInt(v.trim()))
                    .filter(Number.isFinite),
                },
              }
            : {}),
        },
      },
      orderBy: [{ dueDate: "asc" }, { installmentNo: "asc" }],
      include: {
        loan: { select: { id: true, loanCode: true, memberId: true } },
      },
    })

    // Group arrears by member: total due (installments + fines owed).
    const byMember = new Map<
      number,
      { loanIds: Set<number>; totalDue: number }
    >()
    for (const schedule of dueSchedules) {
      const loan = schedule.loan
      if (!loan) continue
      let entry = byMember.get(loan.memberId)
      if (!entry) {
        entry = { loanIds: new Set<number>(), totalDue: 0 }
        byMember.set(loan.memberId, entry)
      }
      entry.loanIds.add(loan.id)
      const remaining = roundMoney(
        Math.max(0, (schedule.totalAmount ?? 0) - (schedule.amountPaid ?? 0))
      )
      entry.totalDue = roundMoney(entry.totalDue + remaining)
    }

    // Fines still pending on those loans are part of the arrears too - the
    // offset engine settles them before interest/principal.
    const allLoanIds = [...new Set([...byMember.values()].flatMap((e) => [...e.loanIds]))]
    if (allLoanIds.length > 0) {
      const pendingFines = await prisma.loanFine.groupBy({
        by: ["loanId"],
        where: { loanId: { in: allLoanIds }, status: "Pending" },
        _sum: { fineAmount: true, paidAmount: true },
      })
      const loanToMember = new Map<number, number>()
      for (const schedule of dueSchedules) {
        if (schedule.loan) loanToMember.set(schedule.loan.id, schedule.loan.memberId)
      }
      for (const fine of pendingFines) {
        const owed = roundMoney(
          Math.max(0, (fine._sum.fineAmount ?? 0) - (fine._sum.paidAmount ?? 0))
        )
        if (owed <= 0) continue
        const memberId = loanToMember.get(fine.loanId)
        const entry = memberId !== undefined ? byMember.get(memberId) : undefined
        if (entry) entry.totalDue = roundMoney(entry.totalDue + owed)
      }
    }

    const memberIds = [...byMember.keys()].sort((a, b) => a - b)

    let membersProcessed = 0
    let membersSkippedNoBalance = 0
    let membersSkippedAlreadyRun = 0
    let totalCollected = 0

    const details: {
      memberId: number
      memberCode: string
      memberName: string
      due: number
      collected: number
      savingsBalanceAfter: number
      reference: string
      outcome: "collected" | "partial" | "no_balance" | "already_run"
      loans: {
        loanCode: string
        amountApplied: number
        interestPaid: number
        principalPaid: number
        finePaid: number
        newBalance: number
        loanCleared: boolean
      }[]
    }[] = []

    for (const memberId of memberIds) {
      const entry = byMember.get(memberId)!
      const reference = `AUTOPAY-${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${memberId}`

      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, memberCode: true, farmerName: true },
      })
      if (!member) continue

      // Already collected today (crash-resume / duplicated trigger safety).
      const alreadyRun = await prisma.savingsLedger.findFirst({
        where: { referenceNumber: reference },
        select: { id: true },
      })
      if (alreadyRun) {
        membersSkippedAlreadyRun += 1
        continue
      }

      const lastEntry = await prisma.savingsLedger.findFirst({
        where: { memberId },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const balance = roundMoney(lastEntry?.balanceAfter ?? 0)

      // Never drive savings negative: take what is there, or skip.
      const pay = roundMoney(Math.min(entry.totalDue, balance))
      if (pay <= 0) {
        membersSkippedNoBalance += 1
        await createNotification({
          title: "Auto-repay skipped - no savings",
          message:
            `${member.farmerName} (${member.memberCode}) has UGX ${entry.totalDue.toLocaleString()} of loan installments due ` +
            `but a savings balance of UGX ${balance.toLocaleString()}. Nothing was collected - contact the member.`,
          severity: "warning",
          notificationType: "loan_auto_repay",
          link: `/savings`,
        })
        details.push({
          memberId,
          memberCode: member.memberCode,
          memberName: member.farmerName,
          due: entry.totalDue,
          collected: 0,
          savingsBalanceAfter: balance,
          reference,
          outcome: "no_balance",
          loans: [],
        })
        continue
      }

      const asOf = now
      const result = await prisma.$transaction(
        async (tx) => {
          const offset = await applyDepositToLoans(tx, memberId, pay, asOf, {
            loanIds: [...entry.loanIds],
          })
          if (offset.totalApplied <= 0) return { ...offset, newBalance: balance }

          const newBalance = roundMoney(balance - offset.totalApplied)
          await tx.savingsLedger.create({
            data: {
              memberId,
              transactionType: "Withdrawal",
              amount: offset.totalApplied,
              balanceAfter: newBalance,
              narration:
                offset.totalApplied < entry.totalDue
                  ? `Automatic loan repayment (partial - UGX ${roundMoney(entry.totalDue - offset.totalApplied).toLocaleString()} still due)`
                  : "Automatic loan repayment - installments due",
              referenceNumber: reference,
              transactionDate: asOf,
            },
          })
          await tx.auditTrail.create({
            data: {
              actionType: "LoanAutoRepay",
              description:
                `Auto-repay collected UGX ${offset.totalApplied.toLocaleString()} from savings of ` +
                `${member.farmerName} (${member.memberCode}) against UGX ${entry.totalDue.toLocaleString()} due ` +
                `(loans: ${offset.applied.map((a) => `${a.loanCode} UGX ${a.amountApplied.toLocaleString()}`).join(", ")})`,
              amount: offset.totalApplied,
              memberId,
              referenceNumber: reference,
              tableName: "savings_ledger",
            },
          })
          return { ...offset, newBalance }
        },
        { timeout: 60_000, maxWait: 10_000 }
      )

      if (result.totalApplied <= 0) {
        // Loans could not absorb the cash (already cleared) - leave savings alone.
        membersSkippedNoBalance += 1
        details.push({
          memberId,
          memberCode: member.memberCode,
          memberName: member.farmerName,
          due: entry.totalDue,
          collected: 0,
          savingsBalanceAfter: balance,
          reference,
          outcome: "no_balance",
          loans: [],
        })
        continue
      }

      membersProcessed += 1
      totalCollected = roundMoney(totalCollected + result.totalApplied)
      const fullyPaid = result.totalApplied >= entry.totalDue

      // One SMS per loan that received money.
      for (const loan of result.applied) {
        await smsLoanAutoRepay(
          memberId,
          loan.amountApplied,
          loan.loanCode,
          loan.newBalance,
          result.newBalance,
          reference
        )
      }

      // One detailed cashier notification per member.
      await notifyAutoRepay({
        memberName: member.farmerName,
        memberCode: member.memberCode,
        amount: result.totalApplied,
        savingsBalanceBefore: balance,
        savingsBalanceAfter: result.newBalance,
        fullyPaid,
        reference,
        loans: result.applied,
      })

      details.push({
        memberId,
        memberCode: member.memberCode,
        memberName: member.farmerName,
        due: entry.totalDue,
        collected: result.totalApplied,
        savingsBalanceAfter: result.newBalance,
        reference,
        outcome: fullyPaid ? "collected" : "partial",
        loans: result.applied,
      })
    }

    // One run summary for the cashier.
    if (membersProcessed > 0 || membersSkippedNoBalance > 0) {
      await createNotification({
        title: "Auto-repay run complete",
        message:
          `${membersProcessed} member(s) collected, UGX ${totalCollected.toLocaleString()} total. ` +
          `${membersSkippedNoBalance} skipped for insufficient savings, ` +
          `${membersSkippedAlreadyRun} already processed today.`,
        severity: membersSkippedNoBalance > 0 ? "warning" : "success",
        notificationType: "loan_auto_repay",
        link: `/savings`,
      })
    }

    return NextResponse.json({
      message:
        membersProcessed > 0
          ? `Auto-repay collected from ${membersProcessed} member(s)`
          : "Nothing to collect",
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      timeZone: TIME_ZONE,
      dueSchedulesFound: dueSchedules.length,
      membersConsidered: memberIds.length,
      membersProcessed,
      membersSkippedNoBalance,
      membersSkippedAlreadyRun,
      totalCollected,
      details,
    })
  } catch (error) {
    console.error("GET /api/cron/auto-repay error:", error)
    return NextResponse.json({ error: "Failed to run auto-repay" }, { status: 500 })
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
