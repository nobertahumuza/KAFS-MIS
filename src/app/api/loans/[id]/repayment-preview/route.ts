import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import {
  computeAllocation,
  computeRepaymentState,
  roundMoney,
  type LoanBalanceInput,
} from "@/lib/loan-repayment"

const ALLOWED_ROLES: string[] = [ROLES.ADMIN, ROLES.LOANS_OFFICER]

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Dry run of a repayment: shows how a payment would be split between fees,
 * interest and principal before anything is written.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to view repayments" }, { status: 403 })
    }

    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        repayments: {
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true },
        },
        fines: { where: { status: "Pending" }, select: { fineAmount: true } },
      },
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (loan.loanStatus !== "Active") {
      return NextResponse.json(
        { error: "Cannot record repayment for a non-active loan" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const amountPaid = parseFloat(searchParams.get("amountPaid") || "0")
    const finePaid = parseFloat(searchParams.get("finePaid") || "0") || 0

    const asOf = dateParam ? new Date(dateParam) : new Date()
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 })
    }

    const balanceInput: LoanBalanceInput = {
      id: loan.id,
      loanCode: loan.loanCode,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      currentBalance: loan.currentBalance,
      outstandingPrincipal: loan.outstandingPrincipal,
      disbursementDate: loan.disbursementDate,
      lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
    }
    const pendingFines = roundMoney(
      loan.fines.reduce((sum, f) => sum + (f.fineAmount || 0), 0)
    )
    const state = computeRepaymentState(balanceInput, asOf, pendingFines)

    const summary = {
      outstandingPrincipal: state.outstandingPrincipal,
      interestComponent: state.interestComponent,
      accruedInterest: state.accruedInterest,
      interestAvailable: state.interestAvailable,
      daysElapsed: state.daysElapsed,
      accrualDate: state.accrualDate.toISOString(),
      maxAmountPaid: state.maxAmountPaid,
      pendingFines,
      currentBalance: loan.currentBalance,
    }

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return NextResponse.json({ summary })
    }

    const result = computeAllocation(balanceInput, state, {
      amountPaid,
      finePaid,
      paymentDate: asOf,
    })

    if (!result.ok) {
      return NextResponse.json({ summary, error: result.error })
    }

    return NextResponse.json({
      summary,
      allocation: {
        feePaid: result.allocation.feePaid,
        interestPaid: result.allocation.interestPaid,
        principalPaid: result.allocation.principalPaid,
        newBalance: result.allocation.newBalance,
        newOutstandingPrincipal: result.allocation.newOutstandingPrincipal,
        writtenOff: result.allocation.writtenOff,
        loanCleared: result.allocation.loanCleared,
      },
    })
  } catch (error) {
    console.error("GET /api/loans/[id]/repayment-preview error:", error)
    return NextResponse.json({ error: "Failed to preview repayment" }, { status: 500 })
  }
}
