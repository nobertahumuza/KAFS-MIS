import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { computeRepaymentState, roundMoney } from "@/lib/loan-repayment"

const ALLOWED_ROLES: string[] = [ROLES.ADMIN, ROLES.LOANS_OFFICER]

interface RouteParams {
  params: Promise<{ id: string }>
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

    const existing = await prisma.loan.findUnique({ where: { id: loanId } })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    const body = await request.json()
    const { loanStatus, interestRate, loanPurpose, dueDate } = body

    const updateData: Record<string, unknown> = {}
    if (loanStatus !== undefined) updateData.loanStatus = loanStatus
    if (interestRate !== undefined) updateData.interestRate = parseFloat(interestRate)
    if (loanPurpose !== undefined) updateData.loanPurpose = loanPurpose
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: updateData,
      include: {
        member: { select: { farmerName: true, memberCode: true } },
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

    const existing = await prisma.loan.findUnique({ where: { id: loanId } })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (existing.currentBalance < existing.principalAmount) {
      return NextResponse.json(
        { error: "Cannot delete a loan with outstanding repayments" },
        { status: 400 }
      )
    }

    await prisma.loanRepaymentSchedule.deleteMany({ where: { loanId } })
    await prisma.loanRepayment.deleteMany({ where: { loanId } })
    await prisma.loanFine.deleteMany({ where: { loanId } })
    await prisma.loan.delete({ where: { id: loanId } })

    return NextResponse.json({ message: "Loan deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete loan" }, { status: 500 })
  }
}
