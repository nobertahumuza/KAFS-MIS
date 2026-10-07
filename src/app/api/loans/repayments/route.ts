import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsLoanRepayment } from "@/lib/sms"
import { notifyLoanRepaid } from "@/lib/notify"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import {
  computeAllocation,
  computeRepaymentState,
  roundMoney,
  type LoanBalanceInput,
} from "@/lib/loan-repayment"

/** Who may view repayments: the two roles with a screen on /loans. */
const VIEW_ROLES: string[] = [ROLES.ADMIN, ROLES.LOANS_OFFICER]
/** Who may register that a borrower has paid: the Loans Officer alone. */
const RECORD_ROLES: string[] = [ROLES.LOANS_OFFICER]

function unauthorised() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json(
    { error: "Only the Loans Officer can record loan repayments" },
    { status: 403 }
  )
}

async function requireRole(roles: string[]) {
  const session = await getServerSession()
  if (!session?.user) return { user: null, response: unauthorised() }
  if (!roles.includes(session.user.role)) return { user: null, response: forbidden() }
  return { user: session.user, response: null }
}

type LoanRecord = Awaited<ReturnType<typeof loadLoan>>

async function loadLoan(loanId: number) {
  return prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      member: { select: { farmerName: true, phoneNumber: true } },
      repayments: {
        orderBy: { paymentDate: "desc" },
        take: 1,
        select: { paymentDate: true },
      },
      fines: { where: { status: "Pending" }, select: { fineAmount: true } },
    },
  })
}

function toBalanceInput(loan: LoanRecord): LoanBalanceInput {
  if (!loan) throw new Error("Loan not found")
  return {
    id: loan.id,
    loanCode: loan.loanCode,
    principalAmount: loan.principalAmount,
    interestRate: loan.interestRate,
    currentBalance: loan.currentBalance,
    outstandingPrincipal: loan.outstandingPrincipal,
    disbursementDate: loan.disbursementDate,
    lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
  }
}

function pendingFinesOf(loan: LoanRecord): number {
  if (!loan) return 0
  return roundMoney(loan.fines.reduce((sum, f) => sum + (f.fineAmount || 0), 0))
}

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireRole(VIEW_ROLES)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const loanId = searchParams.get("loanId") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (loanId) {
      where.loanId = parseInt(loanId)
    }

    const [repayments, total] = await Promise.all([
      prisma.loanRepayment.findMany({
        where,
        include: {
          loan: {
            select: {
              loanCode: true,
              memberId: true,
              member: { select: { farmerName: true, memberCode: true } },
            },
          },
          recorder: { select: { fullName: true } },
        },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loanRepayment.count({ where }),
    ])

    return NextResponse.json({
      data: repayments.map((r) => ({
        id: r.id,
        loanId: r.loanId,
        loanCode: r.loan.loanCode,
        memberName: r.loan.member.farmerName,
        memberCode: r.loan.member.memberCode,
        amountPaid: r.amountPaid,
        finePaid: r.finePaid ?? 0,
        interestPaid: r.interestPaid,
        principalPaid: r.principalPaid,
        balanceAfter: r.balanceAfter,
        paymentDate: r.paymentDate.toISOString(),
        referenceNumber: r.referenceNumber,
        recordedBy: r.recorder?.fullName ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/loans/repayments error:", error)
    return NextResponse.json({ error: "Failed to fetch repayments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireRole(RECORD_ROLES)
    if (response) return response

    const userId = parseInt(String(user?.id)) || null
    const body = await request.json()
    const { loanId, amountPaid, finePaid, scheduleId, paymentDate, reference, clientRequestId } = body

    if (!loanId) {
      return NextResponse.json({ error: "Loan ID is required" }, { status: 400 })
    }

    // Guard against double submission (double click, network retry).
    if (clientRequestId) {
      const existing = await prisma.loanRepayment.findUnique({
        where: { clientRequestId: String(clientRequestId) },
      })
      if (existing) {
        return NextResponse.json(
          {
            message: "This payment has already been recorded",
            duplicate: true,
            repayment: { id: existing.id, referenceNumber: existing.referenceNumber },
          },
          { status: 200 }
        )
      }
    }

    const loan = await loadLoan(Number(loanId))
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (loan.loanStatus !== "Active") {
      return NextResponse.json(
        { error: "Cannot record repayment for a non-active loan" },
        { status: 400 }
      )
    }

    const asOf = paymentDate ? new Date(paymentDate) : new Date()
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 })
    }

    const balanceInput = toBalanceInput(loan)
    const state = computeRepaymentState(balanceInput, asOf, pendingFinesOf(loan))

    const result = computeAllocation(balanceInput, state, {
      amountPaid: Number(amountPaid),
      finePaid: Number(finePaid) || 0,
      paymentDate: asOf,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const { allocation } = result

    if (scheduleId) {
      const schedule = await prisma.loanRepaymentSchedule.findUnique({
        where: { id: Number(scheduleId) },
      })
      if (!schedule || schedule.loanId !== loan.id) {
        return NextResponse.json(
          { error: "The selected installment does not belong to this loan" },
          { status: 400 }
        )
      }
    }

    const referenceNumber =
      typeof reference === "string" && reference.trim()
        ? reference.trim()
        : generateReference("REPAY", Date.now())

    const repayment = await prisma.$transaction(async (tx) => {
      const created = await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          amountPaid: Number(amountPaid),
          finePaid: allocation.feePaid,
          interestPaid: allocation.interestPaid,
          principalPaid: allocation.principalPaid,
          balanceAfter: allocation.newBalance,
          paymentDate: asOf,
          recordedBy: userId,
          referenceNumber,
          clientRequestId: clientRequestId ? String(clientRequestId) : null,
        },
      })

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          currentBalance: allocation.newBalance,
          outstandingPrincipal: allocation.newOutstandingPrincipal,
          ...(allocation.loanCleared ? { loanStatus: "Cleared" } : {}),
        },
      })

      // Repayment schedule: keep track of how much of each installment is covered.
      let currentSchedule = null
      if (scheduleId) {
        currentSchedule = await tx.loanRepaymentSchedule.findUnique({
          where: { id: Number(scheduleId) },
        })
      } else {
        currentSchedule = await tx.loanRepaymentSchedule.findFirst({
          where: { loanId: loan.id, status: { in: ["Pending", "Partial"] } },
          orderBy: { dueDate: "asc" },
        })
      }

      if (currentSchedule) {
        const paidSoFar = (currentSchedule.amountPaid ?? 0) + Number(amountPaid)
        const expected = currentSchedule.totalAmount ?? 0
        const fullyPaid = expected > 0 ? paidSoFar >= expected : paidSoFar > 0
        await tx.loanRepaymentSchedule.update({
          where: { id: currentSchedule.id },
          data: { amountPaid: paidSoFar, status: fullyPaid ? "Paid" : "Partial" },
        })
      }

      // Clear any fine the officer included in this payment.
      if (allocation.feePaid > 0 && currentSchedule) {
        const fine = await tx.loanFine.findFirst({
          where: { loanId: loan.id, scheduleId: currentSchedule.id, status: "Pending" },
        })
        if (fine) {
          await tx.loanFine.update({
            where: { id: fine.id },
            data: { paidAmount: allocation.feePaid, paidDate: asOf, status: "Paid" },
          })
        }
      }

      // Charge a late fine if the installment being settled was already overdue.
      if (currentSchedule) {
        const overdueDays = Math.floor(
          (asOf.getTime() - new Date(currentSchedule.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (overdueDays > 0) {
          const existingFine = await tx.loanFine.findFirst({
            where: { loanId: loan.id, scheduleId: currentSchedule.id },
          })

          if (!existingFine) {
            let fineAmount = 0
            let fineRate = 0
            let reason = ""

            if (loan.loanType === "Emergency") {
              fineRate = 10
              fineAmount = roundMoney((loan.principalAmount * fineRate) / 100)
              reason = `Emergency loan fine - ${overdueDays} days overdue (10% flat of principal)`
            } else {
              fineRate = 5
              fineAmount = roundMoney(((currentSchedule.totalAmount ?? 0) * fineRate) / 100)
              reason = `Late payment fine - ${overdueDays} days overdue (5% of monthly repayment)`
            }

            if (fineAmount > 0) {
              await tx.loanFine.create({
                data: {
                  loanId: loan.id,
                  scheduleId: currentSchedule.id,
                  fineAmount,
                  fineRate,
                  reason,
                  status: "Pending",
                },
              })

              await tx.loanRepaymentSchedule.update({
                where: { id: currentSchedule.id },
                data: { fineAmount: (currentSchedule.fineAmount ?? 0) + fineAmount },
              })
            }
          }
        }
      }

      await tx.auditTrail.create({
        data: {
          userId,
          actionType: "LoanRepayment",
          description:
            `Repayment of UGX ${Number(amountPaid).toLocaleString()} for loan ${loan.loanCode} ` +
            `(interest UGX ${allocation.interestPaid.toLocaleString()}, ` +
            `principal UGX ${allocation.principalPaid.toLocaleString()}, ` +
            `fees UGX ${allocation.feePaid.toLocaleString()})`,
          amount: Number(amountPaid),
          memberId: loan.memberId,
          referenceNumber,
          tableName: "loan_repayments",
          recordId: created.id,
        },
      })

      if (allocation.writtenOff > 0) {
        await tx.auditTrail.create({
          data: {
            userId,
            actionType: "LoanWriteOff",
            description:
              `Booked interest of UGX ${allocation.writtenOff.toLocaleString()} written off on loan ` +
              `${loan.loanCode} because outstanding principal was cleared before all booked interest accrued`,
            amount: allocation.writtenOff,
            memberId: loan.memberId,
            referenceNumber,
            tableName: "loans",
            recordId: loan.id,
          },
        })
      }

      return created
    },
    // Neon round-trips can be slow — the default 5s
    // transaction timeout is not enough for the writes.
    { timeout: 60_000, maxWait: 10_000 }
  )

    smsLoanRepayment(loan.memberId, Number(amountPaid), allocation.newBalance, referenceNumber)
    notifyLoanRepaid(loan.memberId, loan.member.farmerName, Number(amountPaid), referenceNumber)

    return NextResponse.json(
      {
        message: allocation.loanCleared ? "Loan fully repaid" : "Repayment recorded successfully",
        repayment,
        newBalance: allocation.newBalance,
        outstandingPrincipal: allocation.newOutstandingPrincipal,
        allocation: {
          feePaid: allocation.feePaid,
          interestPaid: allocation.interestPaid,
          principalPaid: allocation.principalPaid,
          writtenOff: allocation.writtenOff,
        },
        loanCleared: allocation.loanCleared,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/loans/repayments error:", error)
    return NextResponse.json({ error: "Failed to record repayment" }, { status: 500 })
  }
}
