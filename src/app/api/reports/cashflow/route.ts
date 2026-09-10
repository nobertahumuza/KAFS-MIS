import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const now = new Date()
    const months: { start: Date; end: Date; label: string; year: number; month: number }[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(date.getFullYear(), date.getMonth(), 1)
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
      const label = start.toLocaleString("en-US", { month: "short", year: "numeric" })
      months.push({ start, end, label, year: start.getFullYear(), month: start.getMonth() })
    }

    const monthlyData = await Promise.all(
      months.map(async (m) => {
        const [deposits, withdrawals, disbursements, repayments, expenses] = await Promise.all([
          prisma.savingsLedger.aggregate({
            _sum: { amount: true },
            where: {
              transactionType: "Deposit",
              transactionDate: { gte: m.start, lte: m.end },
            },
          }),
          prisma.savingsLedger.aggregate({
            _sum: { amount: true },
            where: {
              transactionType: "Withdrawal",
              transactionDate: { gte: m.start, lte: m.end },
            },
          }),
          prisma.loanDisbursement.aggregate({
            _sum: { amountDisbursed: true },
            where: {
              disbursementDate: { gte: m.start, lte: m.end },
            },
          }),
          prisma.loanRepayment.aggregate({
            _sum: { amountPaid: true },
            where: {
              paymentDate: { gte: m.start, lte: m.end },
            },
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              expenseDate: { gte: m.start, lte: m.end },
            },
          }),
        ])

        return {
          month: m.label,
          year: m.year,
          monthNum: m.month + 1,
          deposits: deposits._sum.amount ?? 0,
          withdrawals: withdrawals._sum.amount ?? 0,
          loanDisbursements: disbursements._sum.amountDisbursed ?? 0,
          loanRepayments: repayments._sum.amountPaid ?? 0,
          expenses: expenses._sum.amount ?? 0,
          netCashFlow:
            (deposits._sum.amount ?? 0) -
            (withdrawals._sum.amount ?? 0) -
            (disbursements._sum.amountDisbursed ?? 0) +
            (repayments._sum.amountPaid ?? 0) -
            (expenses._sum.amount ?? 0),
        }
      })
    )

    const forecast = generateForecast(monthlyData)

    const totalDeposits = monthlyData.reduce((sum, m) => sum + m.deposits, 0)
    const totalWithdrawals = monthlyData.reduce((sum, m) => sum + m.withdrawals, 0)
    const totalDisbursements = monthlyData.reduce((sum, m) => sum + m.loanDisbursements, 0)
    const totalRepayments = monthlyData.reduce((sum, m) => sum + m.loanRepayments, 0)
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0)

    return NextResponse.json({
      period: {
        from: months[0].label,
        to: months[months.length - 1].label,
      },
      monthlyData,
      summary: {
        totalDeposits,
        totalWithdrawals,
        totalLoanDisbursements: totalDisbursements,
        totalLoanRepayments: totalRepayments,
        totalExpenses,
        netCashFlow: totalDeposits - totalWithdrawals - totalDisbursements + totalRepayments - totalExpenses,
      },
      forecast,
    })
  } catch (error) {
    console.error("GET /api/reports/cashflow error:", error)
    return NextResponse.json({ error: "Failed to generate cashflow report" }, { status: 500 })
  }
}

function generateForecast(monthlyData: { deposits: number; withdrawals: number; loanDisbursements: number; loanRepayments: number; expenses: number }[]) {
  const last6 = monthlyData.slice(-6)

  const avgDeposits = last6.reduce((s, m) => s + m.deposits, 0) / 6
  const avgWithdrawals = last6.reduce((s, m) => s + m.withdrawals, 0) / 6
  const avgDisbursements = last6.reduce((s, m) => s + m.loanDisbursements, 0) / 6
  const avgRepayments = last6.reduce((s, m) => s + m.loanRepayments, 0) / 6
  const avgExpenses = last6.reduce((s, m) => s + m.expenses, 0) / 6

  const recentMonths = monthlyData.slice(-3)
  const olderMonths = monthlyData.slice(-6, -3)

  const recentAvgDeposits = recentMonths.reduce((s, m) => s + m.deposits, 0) / 3
  const olderAvgDeposits = olderMonths.reduce((s, m) => s + m.deposits, 0) / 3
  const depositTrend = olderAvgDeposits > 0 ? (recentAvgDeposits - olderAvgDeposits) / olderAvgDeposits : 0

  const recentAvgRepayments = recentMonths.reduce((s, m) => s + m.loanRepayments, 0) / 3
  const olderAvgRepayments = olderMonths.reduce((s, m) => s + m.loanRepayments, 0) / 3
  const repaymentTrend = olderAvgRepayments > 0 ? (recentAvgRepayments - olderAvgRepayments) / olderAvgRepayments : 0

  const forecast = []
  const now = new Date()

  for (let i = 1; i <= 3; i++) {
    const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const label = forecastDate.toLocaleString("en-US", { month: "short", year: "numeric" })
    const trendMultiplier = 1 + depositTrend * i

    const forecastDeposits = Math.round(avgDeposits * trendMultiplier)
    const forecastWithdrawals = Math.round(avgWithdrawals)
    const forecastDisbursements = Math.round(avgDisbursements)
    const forecastRepayments = Math.round(avgRepayments * (1 + repaymentTrend * i))
    const forecastExpenses = Math.round(avgExpenses)

    forecast.push({
      month: label,
      deposits: forecastDeposits,
      withdrawals: forecastWithdrawals,
      loanDisbursements: forecastDisbursements,
      loanRepayments: forecastRepayments,
      expenses: forecastExpenses,
      netCashFlow:
        forecastDeposits - forecastWithdrawals - forecastDisbursements + forecastRepayments - forecastExpenses,
    })
  }

  return forecast
}
