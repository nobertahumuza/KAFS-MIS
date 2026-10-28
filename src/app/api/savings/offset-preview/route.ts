import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { computeRepaymentState, roundMoney } from "@/lib/loan-repayment"

/**
 * Preview what a savings deposit would do to a member's active loans.
 *
 * Uses the same reducing-balance engine as the actual deposit offset
 * (POST /api/savings) so the figure shown in the deposit form matches what
 * will really be booked.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = parseInt(searchParams.get("memberId") || "")
    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid memberId" }, { status: 400 })
    }

    const activeLoans = await prisma.loan.findMany({
      where: { memberId, loanStatus: "Active" },
      orderBy: { disbursementDate: "asc" },
      include: {
        repayments: {
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true },
        },
        fines: { where: { status: "Pending" }, select: { fineAmount: true } },
      },
    })

    const asOf = new Date()
    let totalPayoff = 0
    const loans = activeLoans.map((loan) => {
      const pendingFines = roundMoney(
        loan.fines.reduce((sum, f) => sum + (f.fineAmount || 0), 0)
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
          lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
        },
        asOf,
        pendingFines
      )
      totalPayoff = roundMoney(totalPayoff + state.maxAmountPaid)
      return {
        loanId: loan.id,
        loanCode: loan.loanCode,
        currentBalance: loan.currentBalance,
        pendingFines,
        payoff: state.maxAmountPaid,
      }
    })

    return NextResponse.json({
      memberId,
      hasActiveLoans: loans.length > 0,
      totalPayoff,
      loans,
    })
  } catch (error) {
    console.error("GET /api/savings/offset-preview error:", error)
    return NextResponse.json(
      { error: "Failed to fetch loan offset preview" },
      { status: 500 }
    )
  }
}
