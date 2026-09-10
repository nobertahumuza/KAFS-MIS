import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const now = new Date()
    const months: { start: Date; end: Date; label: string }[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(date.getFullYear(), date.getMonth(), 1)
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
      const label = start.toLocaleString("en-US", { month: "short", year: "numeric" })
      months.push({ start, end, label })
    }

    const [memberGrowth, savingsGrowth, loanPortfolio, delinquencyRate] = await Promise.all([
      getMemberGrowth(months),
      getSavingsGrowth(months),
      getLoanPortfolioTrend(months),
      getDelinquencyRateTrend(months),
    ])

    return NextResponse.json({
      period: {
        from: months[0].label,
        to: months[months.length - 1].label,
      },
      memberGrowth,
      savingsGrowth,
      loanPortfolio,
      delinquencyRate,
    })
  } catch (error) {
    console.error("GET /api/reports/trends error:", error)
    return NextResponse.json({ error: "Failed to generate trends report" }, { status: 500 })
  }
}

async function getMemberGrowth(months: { start: Date; end: Date; label: string }[]) {
  const data = await Promise.all(
    months.map(async (m) => {
      const newMembers = await prisma.member.count({
        where: { createdAt: { gte: m.start, lte: m.end } },
      })
      const totalMembers = await prisma.member.count({
        where: { createdAt: { lte: m.end } },
      })
      return {
        month: m.label,
        newMembers,
        totalMembers,
      }
    })
  )

  const totalNewMembers = data.reduce((s, d) => s + d.newMembers, 0)
  const avgMonthlyGrowth = totalNewMembers / 12

  return {
    data,
    summary: {
      totalNewMembers,
      avgMonthlyGrowth: Math.round(avgMonthlyGrowth),
    },
  }
}

async function getSavingsGrowth(months: { start: Date; end: Date; label: string }[]) {
  const data = await Promise.all(
    months.map(async (m) => {
      const deposits = await prisma.savingsLedger.aggregate({
        _sum: { amount: true },
        where: {
          transactionType: "Deposit",
          transactionDate: { gte: m.start, lte: m.end },
        },
      })
      const withdrawals = await prisma.savingsLedger.aggregate({
        _sum: { amount: true },
        where: {
          transactionType: "Withdrawal",
          transactionDate: { gte: m.start, lte: m.end },
        },
      })

      const totalDeposits = deposits._sum.amount ?? 0
      const totalWithdrawals = withdrawals._sum.amount ?? 0

      return {
        month: m.label,
        deposits: totalDeposits,
        withdrawals: totalWithdrawals,
        netGrowth: totalDeposits - totalWithdrawals,
      }
    })
  )

  const cumulativeSavings: number[] = []
  let runningTotal = 0
  for (const d of data) {
    runningTotal += d.netGrowth
    cumulativeSavings.push(runningTotal)
  }

  const dataWithCumulative = data.map((d, i) => ({
    ...d,
    cumulativeBalance: cumulativeSavings[i],
  }))

  const totalDeposits = data.reduce((s, d) => s + d.deposits, 0)
  const totalWithdrawals = data.reduce((s, d) => s + d.withdrawals, 0)

  return {
    data: dataWithCumulative,
    summary: {
      totalDeposits,
      totalWithdrawals,
      netGrowth: totalDeposits - totalWithdrawals,
    },
  }
}

async function getLoanPortfolioTrend(months: { start: Date; end: Date; label: string }[]) {
  const data = await Promise.all(
    months.map(async (m) => {
      const disbursements = await prisma.loanDisbursement.aggregate({
        _sum: { amountDisbursed: true },
        where: { disbursementDate: { gte: m.start, lte: m.end } },
      })
      const repayments = await prisma.loanRepayment.aggregate({
        _sum: { amountPaid: true },
        where: { paymentDate: { gte: m.start, lte: m.end } },
      })
      const activeLoans = await prisma.loan.count({
        where: { loanStatus: "Active" },
      })

      return {
        month: m.label,
        disbursements: disbursements._sum.amountDisbursed ?? 0,
        repayments: repayments._sum.amountPaid ?? 0,
        activeLoans,
      }
    })
  )

  const totalDisbursements = data.reduce((s, d) => s + d.disbursements, 0)
  const totalRepayments = data.reduce((s, d) => s + d.repayments, 0)

  const currentOutstanding = await prisma.loan.aggregate({
    _sum: { currentBalance: true },
    where: { loanStatus: "Active" },
  })

  return {
    data,
    summary: {
      totalDisbursements,
      totalRepayments,
      currentOutstandingBalance: currentOutstanding._sum.currentBalance ?? 0,
    },
  }
}

async function getDelinquencyRateTrend(months: { start: Date; end: Date; label: string }[]) {
  const data = await Promise.all(
    months.map(async (m) => {
      const totalActive = await prisma.loan.count({
        where: { loanStatus: "Active" },
      })

      const overdueLoans = await prisma.loan.count({
        where: {
          loanStatus: "Active",
          dueDate: { lt: m.end },
        },
      })

      const overdueAmount = await prisma.loan.aggregate({
        _sum: { currentBalance: true },
        where: {
          loanStatus: "Active",
          dueDate: { lt: m.end },
        },
      })

      const delinquencyRate = totalActive > 0 ? parseFloat(((overdueLoans / totalActive) * 100).toFixed(1)) : 0

      return {
        month: m.label,
        totalActiveLoans: totalActive,
        overdueLoans,
        overdueAmount: overdueAmount._sum.currentBalance ?? 0,
        delinquencyRate,
      }
    })
  )

  const latestDelinquency = data[data.length - 1]?.delinquencyRate ?? 0

  return {
    data,
    summary: {
      currentDelinquencyRate: latestDelinquency,
      averageRate: parseFloat(
        (data.reduce((s, d) => s + d.delinquencyRate, 0) / 12).toFixed(1)
      ),
    },
  }
}
