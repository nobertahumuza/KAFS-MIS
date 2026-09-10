"use client"

import { useState, useEffect } from "react"
import { Users, PiggyBank, CreditCard, AlertTriangle, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { formatUGX } from "@/lib/utils"

interface TrendsData {
  period: { from: string; to: string }
  memberGrowth: {
    data: Array<{ month: string; newMembers: number; totalMembers: number }>
    summary: { totalNewMembers: number; avgMonthlyGrowth: number }
  }
  savingsGrowth: {
    data: Array<{ month: string; deposits: number; withdrawals: number; netGrowth: number; cumulativeBalance: number }>
    summary: { totalDeposits: number; totalWithdrawals: number; netGrowth: number }
  }
  loanPortfolio: {
    data: Array<{ month: string; disbursements: number; repayments: number; activeLoans: number }>
    summary: { totalDisbursements: number; totalRepayments: number; currentOutstandingBalance: number }
  }
  delinquencyRate: {
    data: Array<{ month: string; totalActiveLoans: number; overdueLoans: number; overdueAmount: number; delinquencyRate: number }>
    summary: { currentDelinquencyRate: number; averageRate: number }
  }
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/reports/trends")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      console.error("Failed to load trends data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading trends data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load trends data.</p>
          <Button variant="outline" onClick={() => fetchData()} icon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const maxMemberCount = Math.max(...data.memberGrowth.data.map((m) => m.newMembers), 1)
  const maxMemberCumulative = Math.max(...data.memberGrowth.data.map((m) => m.totalMembers), 1)
  const maxSavingsAmount = Math.max(...data.savingsGrowth.data.map((m) => m.deposits), 1)
  const maxSavingsCumulative = Math.max(...data.savingsGrowth.data.map((m) => m.cumulativeBalance), 1)
  const maxLoanDisbursed = Math.max(...data.loanPortfolio.data.flatMap((m) => [m.disbursements, m.repayments]), 1)
  const maxDelinquencyRate = Math.max(...data.delinquencyRate.data.map((m) => m.delinquencyRate), 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth Trends"
        subtitle="Track member, savings, and loan portfolio trends over time"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Members"
          value={data.memberGrowth.summary.totalNewMembers}
          icon={<Users className="w-5 h-5" />}
          trend={{ value: data.memberGrowth.summary.avgMonthlyGrowth, isPositive: true }}
        />
        <MetricCard
          label="Total Savings"
          value={formatUGX(data.savingsGrowth.summary.netGrowth)}
          icon={<PiggyBank className="w-5 h-5" />}
          trend={{ value: data.savingsGrowth.summary.totalDeposits, isPositive: true }}
        />
        <MetricCard
          label="Loan Outstanding"
          value={formatUGX(data.loanPortfolio.summary.currentOutstandingBalance)}
          icon={<CreditCard className="w-5 h-5" />}
          trend={{ value: data.loanPortfolio.summary.totalDisbursements, isPositive: true }}
        />
        <MetricCard
          label="Delinquency Rate"
          value={`${data.delinquencyRate.summary.currentDelinquencyRate.toFixed(1)}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={{ value: data.delinquencyRate.summary.averageRate, isPositive: data.delinquencyRate.summary.averageRate <= 0 }}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Member Growth</h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-gray-500 dark:text-gray-400">Monthly New</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-600" />
              <span className="text-gray-500 dark:text-gray-400">Cumulative</span>
            </div>
          </div>
        </div>
        {data.memberGrowth.data.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.memberGrowth.data.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-48">
                  <div
                    className="flex-1 bg-blue-500 rounded-t-sm transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${(month.newMembers / maxMemberCount) * 100}%`, minHeight: month.newMembers > 0 ? "4px" : "0px" }}
                    title={`New members: ${month.newMembers}`}
                  />
                  <div
                    className="flex-1 bg-blue-300 dark:bg-blue-600 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.totalMembers / maxMemberCumulative) * 100}%`, minHeight: month.totalMembers > 0 ? "4px" : "0px" }}
                    title={`Cumulative: ${month.totalMembers}`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{month.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No member growth data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Savings Growth</h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-gray-500 dark:text-gray-400">Monthly</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-600" />
              <span className="text-gray-500 dark:text-gray-400">Cumulative</span>
            </div>
          </div>
        </div>
        {data.savingsGrowth.data.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.savingsGrowth.data.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-48">
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                    style={{ height: `${(month.deposits / maxSavingsAmount) * 100}%`, minHeight: month.deposits > 0 ? "4px" : "0px" }}
                    title={`Monthly: ${formatUGX(month.deposits)}`}
                  />
                  <div
                    className="flex-1 bg-green-300 dark:bg-green-600 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.cumulativeBalance / maxSavingsCumulative) * 100}%`, minHeight: month.cumulativeBalance > 0 ? "4px" : "0px" }}
                    title={`Cumulative: ${formatUGX(month.cumulativeBalance)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{month.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No savings growth data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loan Portfolio Trend</h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-purple-500" />
              <span className="text-gray-500 dark:text-gray-400">Disbursed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-gray-500 dark:text-gray-400">Repaid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-orange-500" />
              <span className="text-gray-500 dark:text-gray-400">Outstanding</span>
            </div>
          </div>
        </div>
        {data.loanPortfolio.data.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.loanPortfolio.data.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-0.5 h-48">
                  <div
                    className="flex-1 bg-purple-500 rounded-t-sm transition-all duration-300 hover:bg-purple-600"
                    style={{ height: `${(month.disbursements / maxLoanDisbursed) * 100}%`, minHeight: month.disbursements > 0 ? "3px" : "0px" }}
                    title={`Disbursed: ${formatUGX(month.disbursements)}`}
                  />
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                    style={{ height: `${(month.repayments / maxLoanDisbursed) * 100}%`, minHeight: month.repayments > 0 ? "3px" : "0px" }}
                    title={`Repaid: ${formatUGX(month.repayments)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{month.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No loan portfolio data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delinquency Rate Trend</h2>
          <Badge variant={data.delinquencyRate.summary.currentDelinquencyRate > 10 ? "danger" : data.delinquencyRate.summary.currentDelinquencyRate > 5 ? "warning" : "success"}>
            {data.delinquencyRate.summary.currentDelinquencyRate.toFixed(1)}% current
          </Badge>
        </div>
        {data.delinquencyRate.data.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.delinquencyRate.data.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end h-48">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      month.delinquencyRate > 10 ? "bg-red-500 hover:bg-red-600" :
                      month.delinquencyRate > 5 ? "bg-amber-500 hover:bg-amber-600" :
                      "bg-green-500 hover:bg-green-600"
                    }`}
                    style={{ height: `${(month.delinquencyRate / maxDelinquencyRate) * 100}%`, minHeight: month.delinquencyRate > 0 ? "4px" : "0px" }}
                    title={`Rate: ${month.delinquencyRate.toFixed(1)}% (${month.overdueLoans} loans)`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{month.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No delinquency data available.</p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Data Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">New Members</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Savings</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Disbursed</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Repaid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Delinquency %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.memberGrowth.data.map((m, i) => {
                const savings = data.savingsGrowth.data[i]
                const loan = data.loanPortfolio.data[i]
                const delinq = data.delinquencyRate.data[i]
                return (
                  <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{m.month}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400 font-semibold">{m.newMembers}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-semibold">{formatUGX(savings?.deposits || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatUGX(loan?.disbursements || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatUGX(loan?.repayments || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${(delinq?.delinquencyRate || 0) > 10 ? "text-red-600" : (delinq?.delinquencyRate || 0) > 5 ? "text-amber-600" : "text-green-600"}`}>
                        {(delinq?.delinquencyRate || 0).toFixed(1)}%
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
