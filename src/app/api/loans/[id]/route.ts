import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateApplicationCode } from "@/lib/utils"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { computeRepaymentState, roundMoney } from "@/lib/loan-repayment"

const ALLOWED_ROLES: string[] = [ROLES.ADMIN, ROLES.LOANS_OFFICER]

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Same month arithmetic the disbursement flow uses when booking instalments. */
const addMonths = (date: Date, months: number) => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to view loans" }, { status: 403 })
    }

    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          select: {
            id: true, farmerName: true, memberCode: true, phoneNumber: true,
            gender: true, parish: true, district: true, occupation: true,
          },
        },
        repaymentSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        repayments: {
          orderBy: { paymentDate: "desc" },
          include: { recorder: { select: { fullName: true } } },
        },
        fines: true,
        disbursements: true,
      },
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    const application = await prisma.loanApplication.findFirst({
      where: { repaymentSchedules: { some: { loanId } } },
      orderBy: { id: "desc" },
      select: { repaymentMode: true, loanDuration: true, loanPeriodMonths: true },
    })

    const lastPaymentDate = loan.repayments[0]?.paymentDate ?? null
    const pendingFines = roundMoney(
      loan.fines.filter((f) => f.status === "Pending").reduce((sum, f) => sum + (f.fineAmount || 0), 0)
    )
    const state = computeRepaymentState(
      {
        id: loan.id,
        loanCode: loan.loanCode,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        currentBalance: loan.currentBalance,
        outstandingPrincipal: loan.outstandingPrincipal,
        disbursementDate: loan.disbursementDate,
        lastPaymentDate,
      },
      new Date(),
      pendingFines
    )

    const nextSchedule =
      loan.repaymentSchedules.find((s) => s.status === "Pending" || s.status === "Partial") ?? null
    const paidInstallments = loan.repaymentSchedules.filter((s) => s.status === "Paid").length
    const partialInstallments = loan.repaymentSchedules.filter((s) => s.status === "Partial").length

    const summary = {
      outstandingPrincipal: state.outstandingPrincipal,
      interestComponent: state.interestComponent,
      accruedInterest: state.accruedInterest,
      interestAvailable: state.interestAvailable,
      accrualDate: state.accrualDate.toISOString(),
      daysElapsed: state.daysElapsed,
      maxAmountPaid: state.maxAmountPaid,
      pendingFines,
      totalPaid: roundMoney(loan.repayments.reduce((s, r) => s + r.amountPaid, 0)),
      totalInterestPaid: roundMoney(loan.repayments.reduce((s, r) => s + r.interestPaid, 0)),
      totalPrincipalPaid: roundMoney(loan.repayments.reduce((s, r) => s + r.principalPaid, 0)),
      totalFinePaid: roundMoney(loan.repayments.reduce((s, r) => s + (r.finePaid || 0), 0)),
      repaymentFrequency: application?.repaymentMode || "Monthly",
      termMonths:
        application?.loanPeriodMonths ??
        application?.loanDuration ??
        loan.repaymentSchedules.length,
      nextDueDate: nextSchedule?.dueDate.toISOString() ?? null,
      nextInstallmentNo: nextSchedule?.installmentNo ?? null,
      paidInstallments,
      partialInstallments,
      totalInstallments: loan.repaymentSchedules.length,
    }

    return NextResponse.json({
      ...loan,
      disbursementDate: loan.disbursementDate.toISOString(),
      dueDate: loan.dueDate?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      summary,
      repaymentSchedules: loan.repaymentSchedules.map((s) => ({
        ...s,
        dueDate: s.dueDate.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      repayments: loan.repayments.map((r) => ({
        ...r,
        recorderName: r.recorder?.fullName ?? null,
        recorder: undefined,
        paymentDate: r.paymentDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      fines: loan.fines.map((f) => ({
        ...f,
        paidDate: f.paidDate?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch loan" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to update loans" }, { status: 403 })
    }

    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const existing = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { member: { select: { farmerName: true, memberCode: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      loanStatus,
      interestRate,
      loanPurpose,
      dueDate,
      principalAmount,
      termMonths,
      disbursementDate,
    } = body

    // The booked terms (amount, term, dates) can only be rewritten
    // while nothing has been collected — otherwise the repayment
    // history and the instalment plan would no longer match the
    // figures in the books.
    const repaymentCount = await prisma.loanRepayment.count({ where: { loanId } })
    const hasRepayments = repaymentCount > 0
    const wantsTermChange =
      principalAmount !== undefined ||
      termMonths !== undefined ||
      disbursementDate !== undefined
    if (wantsTermChange && hasRepayments) {
      return NextResponse.json(
        {
          error: "This loan already has repayments recorded. The amount, term and dates can no longer be changed — only the purpose, interest rate, status and due date can be edited.",
        },
        { status: 400 }
      )
    }

    // Validate everything before touching the database.
    const errors: string[] = []
    const rate =
      interestRate === undefined ? existing.interestRate : parseFloat(String(interestRate))
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      errors.push("Interest rate must be between 0 and 100.")
    }

    const status = loanStatus === undefined ? existing.loanStatus : loanStatus
    if (status !== null && status !== undefined && !["Active", "Cleared"].includes(status)) {
      errors.push("Status must be 'Active' or 'Cleared'.")
    }

    const purpose =
      loanPurpose === undefined ? existing.loanPurpose : loanPurpose || null

    let due = existing.dueDate
    if (dueDate !== undefined && dueDate !== null) {
      due = new Date(dueDate)
      if (isNaN(due.getTime())) errors.push("Due date is not a valid date.")
    }

    const bookedTerm = await prisma.loanRepaymentSchedule.count({ where: { loanId } })
    let principal = existing.principalAmount
    let term = bookedTerm || 1
    let start = existing.disbursementDate

    if (principalAmount !== undefined) {
      principal = parseFloat(String(principalAmount))
      if (isNaN(principal) || principal <= 0) {
        errors.push("Principal amount must be greater than 0.")
      }
    }
    if (termMonths !== undefined) {
      term = parseInt(String(termMonths))
      if (isNaN(term) || term < 1 || term > 360) {
        errors.push("Term must be between 1 and 360 months.")
      }
    }
    if (disbursementDate !== undefined && disbursementDate !== null) {
      start = new Date(disbursementDate)
      if (isNaN(start.getTime())) errors.push("Date given is not a valid date.")
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 })
    }

    const changes: string[] = []
    if (purpose !== existing.loanPurpose) changes.push("purpose")
    if (rate !== existing.interestRate) changes.push(`interest rate to ${rate}%`)
    if (status !== existing.loanStatus) changes.push(`status to ${status}`)
    if ((due?.getTime() ?? null) !== (existing.dueDate?.getTime() ?? null)) {
      changes.push("due date")
    }

    let loan
    if (wantsTermChange) {
      // Re-book the loan from the new terms and rebuild the
      // instalment plan from scratch.
      const totalInterest = roundMoney(principal * (rate / 100) * term)
      const totalPayable = roundMoney(principal + totalInterest)
      const monthlyInstallment = totalPayable / term
      const newDue = addMonths(start, term)

      const firstSchedule = await prisma.loanRepaymentSchedule.findFirst({
        where: { loanId },
        select: { applicationId: true },
      })
      const firstDisbursement = await prisma.loanDisbursement.findFirst({
        where: { loanId },
        select: { applicationId: true },
      })
      let applicationId =
        firstSchedule?.applicationId ?? firstDisbursement?.applicationId ?? null

      if (!applicationId) {
        // The loan has lost its application link — recreate one
        // so the rebuilt instalment plan has a home.
        const lastApp = await prisma.loanApplication.findFirst({
          orderBy: { id: "desc" },
          select: { applicationCode: true },
        })
        let appIndex = 1
        if (lastApp?.applicationCode) {
          const match = lastApp.applicationCode.match(/(\d+)$/)
          if (match) appIndex = parseInt(match[1]) + 1
        }
        const application = await prisma.loanApplication.create({
          data: {
            applicationCode: generateApplicationCode(appIndex),
            memberId: existing.memberId,
            loanAmount: principal,
            loanPurpose: purpose,
            loanDuration: term,
            loanPeriodMonths: term,
            interestRate: rate,
            monthlyInstallment,
            status: "Disbursed",
            submittedAt: start,
            disbursedAt: start,
            disbursementDate: start,
            dueDate: newDue,
          },
        })
        applicationId = application.id
        await prisma.loanDisbursement.create({
          data: {
            applicationId,
            loanId,
            amountDisbursed: principal,
            disbursementDate: start,
            disbursementMethod: "Cash",
          },
        })
      }

      loan = await prisma.loan.update({
        where: { id: loanId },
        data: {
          principalAmount: principal,
          interestRate: rate,
          currentBalance: totalPayable,
          outstandingPrincipal: principal,
          loanPurpose: purpose,
          loanStatus: status ?? "Active",
          disbursementDate: start,
          dueDate: newDue,
        },
        include: { member: { select: { farmerName: true, memberCode: true } } },
      })

      // The application and disbursement that created the loan
      // follow the same figures so the books stay consistent.
      if (applicationId) {
        await prisma.loanApplication.update({
          where: { id: applicationId },
          data: {
            loanAmount: principal,
            loanDuration: term,
            loanPeriodMonths: term,
            interestRate: rate,
            monthlyInstallment,
            dueDate: newDue,
          },
        })
        await prisma.loanDisbursement.updateMany({
          where: { loanId },
          data: { amountDisbursed: principal, disbursementDate: start },
        })
      }

      await prisma.loanRepaymentSchedule.deleteMany({ where: { loanId } })
      const rows = []
      for (let n = 1; n <= term; n++) {
        rows.push({
          applicationId,
          loanId,
          installmentNo: n,
          dueDate: addMonths(start, n),
          principalAmount: principal / term,
          interestAmount: totalInterest / term,
          totalAmount: monthlyInstallment,
          balance: totalPayable - monthlyInstallment * n,
          status: "Pending",
        })
      }
      if (rows.length > 0) {
        await prisma.loanRepaymentSchedule.createMany({ data: rows })
      }

      changes.push(
        `principal to UGX ${principal.toLocaleString()}`,
        `${term}-month term`,
        `date given ${start.toISOString().slice(0, 10)}`,
        "instalment plan rebuilt"
      )
    } else {
      loan = await prisma.loan.update({
        where: { id: loanId },
        data: {
          loanStatus: status ?? "Active",
          interestRate: rate,
          loanPurpose: purpose,
          dueDate: due,
        },
        include: { member: { select: { farmerName: true, memberCode: true } } },
      })
    }

    await prisma.auditTrail.create({
      data: {
        actionType: "LoanUpdated",
        description:
          `Loan ${existing.loanCode} for ${existing.member.farmerName} (${existing.member.memberCode}) edited by ${session.user.fullName}: ` +
          (changes.length > 0 ? changes.join(", ") : "no changes"),
        amount: principal,
        memberId: existing.memberId,
        recordId: loanId,
        tableName: "loans",
      },
    })

    return NextResponse.json({ message: "Loan updated successfully", loan })
  } catch (error) {
    console.error("PUT /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to update loan" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ error: "Only an administrator can delete a loan" }, { status: 403 })
    }

    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const existing = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { select: { farmerName: true, memberCode: true } },
        repayments: { select: { id: true, amountPaid: true } },
        disbursements: { select: { id: true, applicationId: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    // A loan that has collected money is a financial record —
    // the repayment history cannot be erased.
    const totalPaid = existing.repayments.reduce((sum, r) => sum + r.amountPaid, 0)
    if (existing.repayments.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this loan: UGX ${totalPaid.toLocaleString()} has already been collected on it. Repayment records cannot be erased.`,
        },
        { status: 400 }
      )
    }

    const applicationId = existing.disbursements[0]?.applicationId ?? null
    const disbursementIds = existing.disbursements.map((d) => d.id)
    const repaymentIds = existing.repayments.map((r) => r.id)

    await prisma.$transaction(
      async (tx) => {
        // Audit entries about this loan are not FK-linked —
        // remove them (they describe records that no longer
        // exist once the loan is gone).
        await tx.auditTrail.deleteMany({
          where: {
            OR: [
              { tableName: "loans", recordId: loanId },
              { tableName: "loan_repayments", recordId: { in: repaymentIds } },
              { tableName: "loan_disbursements", recordId: { in: disbursementIds } },
              ...(applicationId ? [{ tableName: "loan_applications", recordId: applicationId }] : []),
              { description: { contains: existing.loanCode } },
            ],
          },
        })

        await tx.loanRepaymentSchedule.deleteMany({ where: { loanId } })
        await tx.loanRepayment.deleteMany({ where: { loanId } })
        await tx.loanFine.deleteMany({ where: { loanId } })
        await tx.loanInterest.deleteMany({ where: { loanId } })
        await tx.loanAdvance.deleteMany({ where: { loanId } })
        await tx.loanAgreement.deleteMany({ where: { loanId } })
        await tx.loanDisbursement.deleteMany({ where: { loanId } })
        await tx.loan.delete({ where: { id: loanId } })
        if (applicationId) {
          // Cascades to decisions, consents, guarantors, securities,
          // documents and appraisals.
          await tx.loanApplication.delete({ where: { id: applicationId } })
        }

        // The deletion record itself is written last so the
        // cleanup above cannot erase it — it must survive as
        // the proof the loan was removed, and by whom.
        await tx.auditTrail.create({
          data: {
            actionType: "LoanDeleted",
            description:
              `Loan ${existing.loanCode} (${existing.loanType ?? "Regular"}) for ${existing.member.farmerName} (${existing.member.memberCode}) - principal UGX ${existing.principalAmount.toLocaleString()} deleted by ${session.user.fullName}. Its disbursement, instalment plan and application were removed with it.`,
            amount: existing.principalAmount,
            memberId: existing.memberId,
            recordId: loanId,
            tableName: "loans",
          },
        })
      },
      // Neon round-trips can be slow — the default 5s
      // transaction timeout is not enough for the cleanup.
      { timeout: 60_000, maxWait: 10_000 }
    )

    return NextResponse.json({ message: "Loan deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete loan" }, { status: 500 })
  }
}
