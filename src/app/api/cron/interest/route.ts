import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const fiscalYear = now.getFullYear()

    const [savingsResults, loanResults] = await Promise.all([
      calculateSavingsInterest(period, fiscalYear),
      calculateLoanInterest(period),
    ])

    return NextResponse.json({
      message: "Interest calculations completed",
      period,
      savingsInterest: savingsResults,
      loanInterest: loanResults,
    })
  } catch (error) {
    console.error("POST /api/cron/interest error:", error)
    return NextResponse.json({ error: "Failed to calculate interest" }, { status: 500 })
  }
}

async function calculateSavingsInterest(period: string, fiscalYear: number) {
  const members = await prisma.member.findMany({
    where: { status: "Active" },
  })

  const results: { memberId: number; memberName: string; balance: number; interestEarned: number }[] = []
  const SAVERS_INTEREST_RATE = 3

  for (const member of members) {
    const lastSavingsEntry = await prisma.savingsLedger.findFirst({
      where: { memberId: member.id },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })

    const balance = lastSavingsEntry?.balanceAfter ?? 0

    if (balance > 500000) {
      const interestEarned = parseFloat(
        ((balance * SAVERS_INTEREST_RATE) / 100).toFixed(2)
      )

      const existing = await prisma.savingsInterest.findFirst({
        where: { memberId: member.id, period, fiscalYear },
      })

      if (!existing) {
        await prisma.savingsInterest.create({
          data: {
            memberId: member.id,
            period,
            interestRate: SAVERS_INTEREST_RATE,
            balance,
            interestEarned,
            fiscalYear,
          },
        })
      }

      results.push({
        memberId: member.id,
        memberName: member.farmerName,
        balance,
        interestEarned,
      })
    }
  }

  const totalInterest = results.reduce((sum, r) => sum + r.interestEarned, 0)

  return {
    membersQualified: results.length,
    totalInterestEarned: totalInterest,
    details: results,
  }
}

async function calculateLoanInterest(period: string) {
  const activeLoans = await prisma.loan.findMany({
    where: { loanStatus: "Active" },
    include: {
      member: { select: { farmerName: true, memberCode: true } },
    },
  })

  const results: { loanId: number; loanCode: string; memberName: string; principalBalance: number; interestAmount: number }[] = []
  const LOAN_INTEREST_RATE = 2.5

  for (const loan of activeLoans) {
    const principalBalance = loan.currentBalance

    if (principalBalance > 0) {
      const interestAmount = parseFloat(
        ((principalBalance * LOAN_INTEREST_RATE) / 100).toFixed(2)
      )

      const existing = await prisma.loanInterest.findFirst({
        where: { loanId: loan.id, period },
      })

      if (!existing) {
        await prisma.loanInterest.create({
          data: {
            loanId: loan.id,
            period,
            interestRate: LOAN_INTEREST_RATE,
            principalBalance,
            interestAmount,
          },
        })
      }

      results.push({
        loanId: loan.id,
        loanCode: loan.loanCode,
        memberName: loan.member.farmerName,
        principalBalance,
        interestAmount,
      })
    }
  }

  const totalInterest = results.reduce((sum, r) => sum + r.interestAmount, 0)

  return {
    loansCalculated: results.length,
    totalInterestCharged: totalInterest,
    details: results,
  }
}
