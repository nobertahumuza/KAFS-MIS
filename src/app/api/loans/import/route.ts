import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { generateLoanCode, generateApplicationCode, generateReference } from "@/lib/utils"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import {
  computeAllocation,
  computeRepaymentState,
  roundMoney,
} from "@/lib/loan-repayment"

/** Registering loans from the paper files is office work: Admin and the Loans Officer. */
const ALLOWED_ROLES: string[] = [ROLES.ADMIN, ROLES.LOANS_OFFICER]

/** Regular loans are booked at 2.5% per month everywhere else in the app. */
const DEFAULT_RATE = 2.5
const MAX_ROWS_PER_REQUEST = 25
const MAX_TERM_MONTHS = 120

/** Vercel: a batch of loans is many inserts, give the function room to finish. */
export const maxDuration = 60

interface RawRow {
  memberCode?: string
  principalAmount?: string | number
  startDate?: string
  termMonths?: string | number
  amountPaid?: string | number
  interestRate?: string | number
  purpose?: string
  fileRef?: string
}

interface RowResult {
  row: number
  memberCode: string
  status: "imported" | "skipped" | "error"
  loanCode?: string
  error?: string
  principalAmount?: number
  finishesOn?: string
  paidInstallments?: number
  totalInstallments?: number
}

function unauthorised() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json(
    { error: "Only the Admin or the Loans Officer can register existing loans" },
    { status: 403 }
  )
}

/** "1,250,000" / "UGX 1250000" / 1250000 → 1250000, blank → null */
function toNumber(value: string | number | undefined | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const cleaned = String(value ?? "")
    .replace(/[^\d.-]/g, "")
    .trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Accepts the formats staff actually write on files:
 * 2026-03-15, 15/03/2026, 15-3-26, 15.03.2026
 * Day-first, because that is how dates are written in Uganda.
 */
function parseDate(value: string | undefined | null): Date | null {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  let year: number
  let month: number
  let day: number

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else {
    const dayFirst = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(raw)
    if (!dayFirst) return null
    day = Number(dayFirst[1])
    month = Number(dayFirst[2])
    year = Number(dayFirst[3])
    if (year < 100) year += 2000
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Noon UTC keeps the date stable in every timezone, including Kampala.
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

function dateKey(date: Date): string {
  return date.toISOString().split("T")[0]
}

async function resolveMember(memberCode: string) {
  const exact = await prisma.member.findUnique({ where: { memberCode } })
  if (exact) return exact
  return prisma.member.findFirst({
    where: { memberCode: { equals: memberCode, mode: "insensitive" } },
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) return unauthorised()
    if (!ALLOWED_ROLES.includes(session.user.role)) return forbidden()
    const userId = parseInt(String(session.user.id)) || null

    const body = await request.json()
    const rows: RawRow[] = Array.isArray(body?.rows) ? body.rows : []
    const batchRef = typeof body?.source === "string" ? body.source.trim() : ""

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 })
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Send at most ${MAX_ROWS_PER_REQUEST} loans per request` },
        { status: 400 }
      )
    }

    // Loan codes must stay unique across a batch, so we walk one counter.
    const lastLoan = await prisma.loan.findFirst({
      orderBy: { id: "desc" },
      select: { loanCode: true },
    })
    let loanIndex = Number(lastLoan?.loanCode?.match(/(\d+)$/)?.[1] ?? 0)

    const lastApp = await prisma.loanApplication.findFirst({
      orderBy: { id: "desc" },
      select: { applicationCode: true },
    })
    let appIndex = Number(lastApp?.applicationCode?.match(/(\d+)$/)?.[1] ?? 0)

    const todayKey = dateKey(new Date())
    const results: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1
      const raw = rows[i]
      const memberCode = String(raw?.memberCode ?? "").trim().toUpperCase()
      const fail = (error: string): RowResult => ({ row: rowNo, memberCode, status: "error", error })

      try {
        if (!memberCode) {
          results.push(fail("Member code is required"))
          continue
        }

        const principal = toNumber(raw.principalAmount)
        if (principal === null || principal <= 0) {
          results.push(fail("Loan amount is required and must be greater than zero"))
          continue
        }

        const termMonths = toNumber(raw.termMonths)
        if (termMonths === null || termMonths < 1) {
          results.push(fail("Term (number of months) is required"))
          continue
        }
        if (termMonths > MAX_TERM_MONTHS) {
          results.push(fail(`Term cannot exceed ${MAX_TERM_MONTHS} months`))
          continue
        }
        const term = Math.round(termMonths)

        const startDate = parseDate(raw.startDate)
        if (!startDate) {
          results.push(fail("Start date is missing or not a date the system understands (use DD/MM/YYYY)"))
          continue
        }
        if (dateKey(startDate) > todayKey) {
          results.push(fail("Start date cannot be in the future"))
          continue
        }

        const rate = toNumber(raw.interestRate) ?? DEFAULT_RATE
        if (rate < 0 || rate > 100) {
          results.push(fail("Interest rate must be between 0 and 100"))
          continue
        }

        const amountPaid = toNumber(raw.amountPaid) ?? 0
        if (amountPaid < 0) {
          results.push(fail("Total paid so far cannot be negative"))
          continue
        }

        const fileRef = String(raw.fileRef ?? "").trim() || batchRef || null
        const purpose = String(raw.purpose ?? "").trim() || null

        const member = await resolveMember(memberCode)
        if (!member) {
          results.push(fail(`Member ${memberCode} is not in the system — register the member first`))
          continue
        }

        // Same paper file loaded twice? Same loan on two lines? Refuse politely.
        if (fileRef) {
          const already = await prisma.loan.findFirst({
            where: { importedFrom: fileRef },
            select: { loanCode: true },
          })
          if (already) {
            results.push({
              row: rowNo,
              memberCode,
              status: "skipped",
              loanCode: already.loanCode,
              error: `Already imported as ${already.loanCode} (reference ${fileRef})`,
            })
            continue
          }
        }
        const duplicate = await prisma.loan.findFirst({
          where: { memberId: member.id, principalAmount: principal, disbursementDate: startDate },
          select: { loanCode: true },
        })
        if (duplicate) {
          results.push({
            row: rowNo,
            memberCode,
            status: "skipped",
            loanCode: duplicate.loanCode,
            error: "This member already has a loan for the same amount on the same date",
          })
          continue
        }

        const totalInterest = roundMoney(principal * (rate / 100) * term)
        const totalPayable = roundMoney(principal + totalInterest)
        const monthlyInstallment = totalPayable / term

        if (amountPaid > totalPayable) {
          results.push(
            fail(
              `Total paid (${amountPaid.toLocaleString()}) is more than the loan is worth (${totalPayable.toLocaleString()})`
            )
          )
          continue
        }

        const dueDate = addMonths(startDate, term)

        // How much of the paper history does this lump sum cover?
        const instalmentsCovered = Math.min(
          term,
          Math.floor(amountPaid / monthlyInstallment)
        )
        let paymentDate = addMonths(startDate, instalmentsCovered)
        if (dateKey(paymentDate) > todayKey) paymentDate = new Date(`${todayKey}T12:00:00Z`)

        const loan = await prisma.$transaction(async (tx) => {
          const application = await tx.loanApplication.create({
            data: {
              applicationCode: generateApplicationCode(++appIndex),
              memberId: member.id,
              loanAmount: principal,
              loanPurpose: purpose,
              loanDuration: term,
              loanPeriodMonths: term,
              interestRate: rate,
              monthlyInstallment: roundMoney(monthlyInstallment),
              status: "Disbursed",
              submittedAt: startDate,
              disbursedAt: startDate,
              disbursementDate: startDate,
              dueDate,
            },
          })

          const created = await tx.loan.create({
            data: {
              loanCode: generateLoanCode(++loanIndex),
              memberId: member.id,
              principalAmount: principal,
              interestRate: rate,
              currentBalance: totalPayable,
              outstandingPrincipal: principal,
              loanPurpose: purpose,
              loanType: "Regular",
              loanStatus: "Active",
              disbursementDate: startDate,
              dueDate,
              importedFrom: fileRef,
              recordedBy: userId,
            },
          })

          await tx.loanDisbursement.create({
            data: {
              applicationId: application.id,
              loanId: created.id,
              amountDisbursed: principal,
              disbursementDate: startDate,
              disbursementMethod: "Cash",
            },
          })

          const scheduleRows: Prisma.LoanRepaymentScheduleCreateManyInput[] = []
          for (let n = 1; n <= term; n++) {
            const due = addMonths(startDate, n)
            scheduleRows.push({
              applicationId: application.id,
              loanId: created.id,
              installmentNo: n,
              dueDate: due,
              principalAmount: principal / term,
              interestAmount: totalInterest / term,
              totalAmount: monthlyInstallment,
              balance: totalPayable - monthlyInstallment * n,
              status: "Pending",
            })
          }
          await tx.loanRepaymentSchedule.createMany({ data: scheduleRows })

          let paidInstallments = 0

          if (amountPaid > 0) {
            // Everything collected on paper, booked as one backdated payment so
            // reducing-balance interest carries on from the right principal.
            const balanceInput = {
              id: created.id,
              loanCode: created.loanCode,
              principalAmount: principal,
              interestRate: rate,
              currentBalance: totalPayable,
              outstandingPrincipal: principal,
              disbursementDate: startDate,
              lastPaymentDate: null,
            }
            const state = computeRepaymentState(balanceInput, paymentDate, 0)
            const allocation = computeAllocation(balanceInput, state, {
              amountPaid,
              finePaid: 0,
              paymentDate,
            })
            if (!allocation.ok) throw new Error(allocation.error)

            const referenceNumber = fileRef
              ? `FILE-${fileRef}`
              : generateReference("FILE", Date.now())

            await tx.loanRepayment.create({
              data: {
                loanId: created.id,
                amountPaid,
                finePaid: allocation.allocation.feePaid,
                interestPaid: allocation.allocation.interestPaid,
                principalPaid: allocation.allocation.principalPaid,
                balanceAfter: allocation.allocation.newBalance,
                paymentDate,
                recordedBy: userId,
                referenceNumber,
              },
            })

            await tx.loan.update({
              where: { id: created.id },
              data: {
                currentBalance: allocation.allocation.newBalance,
                outstandingPrincipal: allocation.allocation.newOutstandingPrincipal,
                ...(allocation.allocation.loanCleared ? { loanStatus: "Cleared" } : {}),
              },
            })

            // Settle whole instalments in date order, then any remainder as partial.
            let remaining = amountPaid
            const scheduleRows = await tx.loanRepaymentSchedule.findMany({
              where: { loanId: created.id },
              orderBy: { installmentNo: "asc" },
            })
            for (const schedule of scheduleRows) {
              if (remaining <= 0) break
              const expected = schedule.totalAmount ?? 0
              const applied = Math.min(remaining, expected)
              const paidSoFar = (schedule.amountPaid ?? 0) + applied
              const fullyPaid = expected > 0 ? paidSoFar >= expected - 0.005 : paidSoFar > 0
              await tx.loanRepaymentSchedule.update({
                where: { id: schedule.id },
                data: { amountPaid: paidSoFar, status: fullyPaid ? "Paid" : "Partial" },
              })
              remaining = roundMoney(remaining - applied)
              if (fullyPaid) paidInstallments++
            }
          }

          await tx.auditTrail.create({
            data: {
              userId,
              actionType: "LoanImported",
              description:
                `Loan ${created.loanCode} registered from ${fileRef ?? "data entry form"} for ` +
                `${member.farmerName} (${member.memberCode}) - principal UGX ${principal.toLocaleString()}, ` +
                `${term} months from ${dateKey(startDate)}, paid to date UGX ${amountPaid.toLocaleString()}`,
              amount: principal,
              memberId: member.id,
              tableName: "loans",
              recordId: created.id,
            },
          })

          return { loan: created, paidInstallments }
        },
        // A loan is many inserts; give the batch room before Prisma gives up.
        { timeout: 60_000, maxWait: 10_000 }
      )

        results.push({
          row: rowNo,
          memberCode,
          status: "imported",
          loanCode: loan.loan.loanCode,
          principalAmount: principal,
          finishesOn: dateKey(dueDate),
          paidInstallments: loan.paidInstallments,
          totalInstallments: term,
        })
      } catch (error) {
        results.push(fail(error instanceof Error ? error.message : "Could not import this loan"))
      }
    }

    const imported = results.filter((r) => r.status === "imported").length
    const skipped = results.filter((r) => r.status === "skipped").length
    const failed = results.filter((r) => r.status === "error").length

    return NextResponse.json({ imported, skipped, failed, results })
  } catch (error) {
    console.error("POST /api/loans/import error:", error)
    return NextResponse.json({ error: "Failed to import loans" }, { status: 500 })
  }
}
