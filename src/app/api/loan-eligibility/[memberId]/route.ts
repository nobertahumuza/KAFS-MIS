import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    await requireAuth()

    const { memberId } = await params
    const memberIdInt = parseInt(memberId)

    if (isNaN(memberIdInt)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberIdInt },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const lastSavingsEntry = await prisma.savingsLedger.findFirst({
      where: { memberId: memberIdInt },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })
    const savingsBalance = lastSavingsEntry?.balanceAfter ?? 0

    const shareValue = member.shareValue ?? 0

    const activeDefaultedLoans = await prisma.loan.findFirst({
      where: {
        memberId: memberIdInt,
        loanStatus: "Defaulted",
      },
    })

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const activeLoans = await prisma.loan.findMany({
      where: {
        memberId: memberIdInt,
        loanStatus: "Active",
      },
      include: {
        repaymentSchedules: {
          where: {
            dueDate: { lt: new Date() },
            status: "Pending",
          },
          orderBy: { dueDate: "asc" },
        },
      },
    })

    const hasMissedPayments = activeLoans.some(
      (loan) => loan.repaymentSchedules.length > 0
    )

    const recentRepayments = await prisma.loanRepayment.findMany({
      where: {
        loan: { memberId: memberIdInt },
        paymentDate: { gte: sixMonthsAgo },
      },
      orderBy: { paymentDate: "desc" },
    })

    const criteria = {
      savingsBalance: {
        met: savingsBalance >= 100000,
        actual: savingsBalance,
        minimum: 100000,
        label: "Savings Balance",
      },
      shareValue: {
        met: shareValue >= 50000,
        actual: shareValue,
        minimum: 50000,
        label: "Share Value",
      },
      noDefaultedLoans: {
        met: !activeDefaultedLoans,
        label: "No Active Defaulted Loans",
      },
      repaymentHistory: {
        met: !hasMissedPayments && recentRepayments.length > 0,
        label: "Good Repayment History (Last 6 Months)",
      },
    }

    let score = 0
    const maxScore = 100
    const reasons: string[] = []

    if (criteria.savingsBalance.met) {
      score += 30
      if (savingsBalance >= 500000) {
        score += 5
      }
    } else {
      reasons.push(
        `Savings balance UGX ${savingsBalance.toLocaleString()} is below minimum UGX 100,000`
      )
    }

    if (criteria.shareValue.met) {
      score += 25
      if (shareValue >= 200000) {
        score += 5
      }
    } else {
      reasons.push(
        `Share value UGX ${shareValue.toLocaleString()} is below minimum UGX 50,000`
      )
    }

    if (criteria.noDefaultedLoans.met) {
      score += 20
    } else {
      reasons.push("Member has an active defaulted loan")
      score -= 20
    }

    if (criteria.repaymentHistory.met) {
      score += 25
    } else {
      reasons.push("Member has missed loan payments in the last 6 months")
      score -= 10
    }

    if (member.status !== "Active") {
      reasons.push("Member account is not active")
      score = Math.min(score, 20)
    }

    score = Math.max(0, Math.min(maxScore, score))

    const isEligible = score >= 60 && criteria.noDefaultedLoans.met

    return NextResponse.json({
      memberId: memberIdInt,
      memberName: member.farmerName,
      memberCode: member.memberCode,
      isEligible,
      score,
      maxScore,
      criteria,
      reasons,
      recommendation: isEligible
        ? "Member is eligible for a loan"
        : "Member does not meet the minimum eligibility requirements",
    })
  } catch (error) {
    console.error("GET /api/loan-eligibility/[memberId] error:", error)
    return NextResponse.json({ error: "Failed to check eligibility" }, { status: 500 })
  }
}
