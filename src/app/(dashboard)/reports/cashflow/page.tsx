"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { formatUGX } from "@/lib/utils"

interface MonthlyData {
  month: string
  deposits: number
  withdrawals: number
  loanDisbursements: number
  loanRepayments: number
  expenses: number
  netCashFlow: number
}

interface ForecastData {
  month: string
  deposits: number
  withdrawals: number
  loanDisbursements: number
  loanRepayments: number
  expenses: number
  netCashFlow: number
}

interface CashFlowData {
  monthlyData: MonthlyData[]
  summary: {
    totalDeposits: number
    totalWithdrawals: number
    totalLoanDisbursements: number
    totalLoanRepayments: number
    totalExpenses: number
    netCashFlow: number
  }
  forecast: ForecastData[]
}

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/reports/cashflow")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      console.error("Failed to load cash flow data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const monthly = data?.monthlyData ?? []
  const forecast = data?.forecast ?? []
  const summary = data?.summary

  const maxValue = monthly.length > 0
    ? Math.max(...monthly.flatMap((m) => [m.deposits, m.withdrawals, m.expenses]), 1)
    : 1

  const maxForecastValue = forecast.length > 0
    ? Math.max(...forecast.flatMap((m) => [m.deposits, m.withdrawals]), 1)
    : 1

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading cash flow data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load cash flow data.</p>
          <Button variant="outline" onClick={() => fetchData()} icon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const totalInflow = (summary?.totalDeposits ?? 0) + (summary?.totalLoanRepayments ?? 0)
  const totalOutflow = (summary?.totalWithdrawals ?? 0) + (summary?.totalLoanDisbursements ?? 0) + (summary?.totalExpenses ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow Analysis"
        subtitle="Monitor deposits, withdrawals, and expense flows"
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}
            onClick={() => fetchData(true)}
            loading={refreshing}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Inflow"
          value={formatUGX(totalInflow)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Outflow"
          value={formatUGX(totalOutflow)}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <MetricCard
          label="Net Cash Flow"
          value={formatUGX(summary?.netCashFlow ?? 0)}
          icon={<DollarSign className="w-5 h-5" />}
          trend={{
            value: Math.abs(Math.round(((summary?.netCashFlow ?? 0) / (totalInflow || 1)) * 100)),
            isPositive: (summary?.netCashFlow ?? 0) >= 0,
          }}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Cash Flow</h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-gray-500 dark:text-gray-400">Deposits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-gray-500 dark:text-gray-400">Withdrawals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-gray-500 dark:text-gray-400">Expenses</span>
            </div>
          </div>
        </div>
        {monthly.length > 0 ? (
          <div className="flex items-end gap-3 h-64">
            {monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-52">
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                    style={{ height: `${(m.deposits / maxValue) * 100}%`, minHeight: m.deposits > 0 ? "4px" : "0px" }}
                    title={`Deposits: ${formatUGX(m.deposits)}`}
                  />
                  <div
                    className="flex-1 bg-blue-500 rounded-t-sm transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${(m.withdrawals / maxValue) * 100}%`, minHeight: m.withdrawals > 0 ? "4px" : "0px" }}
                    title={`Withdrawals: ${formatUGX(m.withdrawals)}`}
                  />
                  <div
                    className="flex-1 bg-red-500 rounded-t-sm transition-all duration-300 hover:bg-red-600"
                    style={{ height: `${(m.expenses / maxValue) * 100}%`, minHeight: m.expenses > 0 ? "4px" : "0px" }}
                    title={`Expenses: ${formatUGX(m.expenses)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No monthly data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">3-Month Forecast</h2>
          <Badge variant="info">Projected</Badge>
        </div>
        {forecast.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-end gap-3 h-48">
              {forecast.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end gap-1 h-40">
                    <div
                      className="flex-1 bg-green-400 rounded-t-sm transition-all duration-300"
                      style={{ height: `${(m.deposits / maxForecastValue) * 100}%`, minHeight: m.deposits > 0 ? "4px" : "0px" }}
                      title={`Projected Inflow: ${formatUGX(m.deposits)}`}
                    />
                    <div
                      className="flex-1 bg-blue-400 rounded-t-sm transition-all duration-300"
                      style={{ height: `${(m.withdrawals / maxForecastValue) * 100}%`, minHeight: m.withdrawals > 0 ? "4px" : "0px" }}
                      title={`Projected Outflow: ${formatUGX(m.withdrawals)}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
                    {m.month}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {forecast.map((m) => {
                  const net = m.netCashFlow
                  return (
                    <div key={m.month} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{m.month}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <ArrowDownRight className="w-3 h-3" /> {formatUGX(m.deposits)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <ArrowUpRight className="w-3 h-3" /> {formatUGX(m.withdrawals + m.loanDisbursements + m.expenses)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`flex items-center gap-1 text-sm font-semibold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {net >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {formatUGX(Math.abs(net))}
                        </span>
                        <Badge variant={net >= 0 ? "success" : "danger"} className="mt-1">
                          {net >= 0 ? "Surplus" : "Deficit"}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No forecast data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deposits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Withdrawals</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Expenses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {monthly.map((m) => {
                const net = m.deposits - m.withdrawals - m.expenses
                return (
                  <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{m.month}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-semibold">{formatUGX(m.deposits)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">{formatUGX(m.withdrawals)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">{formatUGX(m.expenses)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {net >= 0 ? "+" : ""}{formatUGX(net)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
