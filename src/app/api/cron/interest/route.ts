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
  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const members = await prisma.member.findMany({
    where: { status: "Active" },
  })

  const results: { memberId: number; memberName: string; balance: number; interestEarned: number }[] = []
  const SAVINGS_INTEREST_RATE = 3

  for (const member of members) {
    const firstEntry = await prisma.savingsLedger.findFirst({
      where: { memberId: member.id },
      orderBy: { id: "asc" },
      select: { createdAt: true },
    })

    if (!firstEntry) continue
    if (firstEntry.createdAt > sixMonthsAgo) continue

    const lastSavingsEntry = await prisma.savingsLedger.findFirst({
      where: { memberId: member.id },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })

    const balance = lastSavingsEntry?.balanceAfter ?? 0

    if (balance > 500000) {
      const interestEarned = parseFloat(
        ((balance * SAVINGS_INTEREST_RATE) / 100).toFixed(2)
      )

      const existing = await prisma.savingsInterest.findFirst({
        where: { memberId: member.id, period, fiscalYear },
      })

      if (!existing) {
        await prisma.savingsInterest.create({
          data: {
            memberId: member.id,
            period,
            interestRate: SAVINGS_INTEREST_RATE,
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

  const results: { loanId: number; loanCode: string; memberName: string; principalBalance: number; interestAmount: number; loanType: string }[] = []

  for (const loan of activeLoans) {
    const existing = await prisma.loanInterest.findFirst({
      where: { loanId: loan.id, period },
    })

    if (existing) continue

    let interestAmount = 0
    let interestRate = 0
    let principalBalance = loan.currentBalance

    if (loan.loanType === "Emergency") {
      interestRate = 10
      const hasBeenCharged = await prisma.loanInterest.findFirst({
        where: { loanId: loan.id },
      })
      if (hasBeenCharged) continue
      principalBalance = loan.principalAmount
      interestAmount = parseFloat(((principalBalance * interestRate) / 100).toFixed(2))
    } else {
      interestRate = 2.5
      if (principalBalance <= 0) continue
      interestAmount = parseFloat(((principalBalance * interestRate) / 100).toFixed(2))
    }

    await prisma.loanInterest.create({
      data: {
        loanId: loan.id,
        period,
        interestRate,
        principalBalance,
        interestAmount,
      },
    })

    results.push({
      loanId: loan.id,
      loanCode: loan.loanCode,
      memberName: loan.member.farmerName,
      principalBalance,
      interestAmount,
      loanType: loan.loanType ?? "Regular",
    })
  }

  const totalInterest = results.reduce((sum, r) => sum + r.interestAmount, 0)

  return {
    loansCalculated: results.length,
    totalInterestCharged: totalInterest,
    details: results,
  }
}
