"use client"

import { useState, useEffect } from "react"
import { Users, PiggyBank, CreditCard, AlertTriangle, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { formatUGX } from "@/lib/utils"

interface TrendsData {
  memberGrowth: Array<{ month: string; count: number; cumulative: number }>
  savingsGrowth: Array<{ month: string; amount: number; cumulative: number }>
  loanPortfolio: Array<{ month: string; disbursed: number; repaid: number; outstanding: number }>
  delinquencyRate: Array<{ month: string; rate: number; count: number }>
  summary: {
    totalMembers: number
    memberGrowthRate: number
    totalSavings: number
    savingsGrowthRate: number
    loanOutstanding: number
    loanGrowthRate: number
    currentDelinquencyRate: number
    delinquencyTrend: number
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

  const maxMemberCount = Math.max(...data.memberGrowth.map((m) => m.count), 1)
  const maxMemberCumulative = Math.max(...data.memberGrowth.map((m) => m.cumulative), 1)
  const maxSavingsAmount = Math.max(...data.savingsGrowth.map((m) => m.amount), 1)
  const maxSavingsCumulative = Math.max(...data.savingsGrowth.map((m) => m.cumulative), 1)
  const maxLoanDisbursed = Math.max(...data.loanPortfolio.flatMap((m) => [m.disbursed, m.repaid, m.outstanding]), 1)
  const maxDelinquencyRate = Math.max(...data.delinquencyRate.map((m) => m.rate), 1)

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
          value={data.summary.totalMembers}
          icon={<Users className="w-5 h-5" />}
          trend={{ value: data.summary.memberGrowthRate, isPositive: data.summary.memberGrowthRate >= 0 }}
        />
        <MetricCard
          label="Total Savings"
          value={formatUGX(data.summary.totalSavings)}
          icon={<PiggyBank className="w-5 h-5" />}
          trend={{ value: data.summary.savingsGrowthRate, isPositive: data.summary.savingsGrowthRate >= 0 }}
        />
        <MetricCard
          label="Loan Outstanding"
          value={formatUGX(data.summary.loanOutstanding)}
          icon={<CreditCard className="w-5 h-5" />}
          trend={{ value: data.summary.loanGrowthRate, isPositive: data.summary.loanGrowthRate >= 0 }}
        />
        <MetricCard
          label="Delinquency Rate"
          value={`${data.summary.currentDelinquencyRate.toFixed(1)}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={{ value: data.summary.delinquencyTrend, isPositive: data.summary.delinquencyTrend <= 0 }}
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
        {data.memberGrowth.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.memberGrowth.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-48">
                  <div
                    className="flex-1 bg-blue-500 rounded-t-sm transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${(month.count / maxMemberCount) * 100}%`, minHeight: month.count > 0 ? "4px" : "0px" }}
                    title={`New members: ${month.count}`}
                  />
                  <div
                    className="flex-1 bg-blue-300 dark:bg-blue-600 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.cumulative / maxMemberCumulative) * 100}%`, minHeight: month.cumulative > 0 ? "4px" : "0px" }}
                    title={`Cumulative: ${month.cumulative}`}
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
        {data.savingsGrowth.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.savingsGrowth.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-48">
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                    style={{ height: `${(month.amount / maxSavingsAmount) * 100}%`, minHeight: month.amount > 0 ? "4px" : "0px" }}
                    title={`Monthly: ${formatUGX(month.amount)}`}
                  />
                  <div
                    className="flex-1 bg-green-300 dark:bg-green-600 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.cumulative / maxSavingsCumulative) * 100}%`, minHeight: month.cumulative > 0 ? "4px" : "0px" }}
                    title={`Cumulative: ${formatUGX(month.cumulative)}`}
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
        {data.loanPortfolio.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.loanPortfolio.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-0.5 h-48">
                  <div
                    className="flex-1 bg-purple-500 rounded-t-sm transition-all duration-300 hover:bg-purple-600"
                    style={{ height: `${(month.disbursed / maxLoanDisbursed) * 100}%`, minHeight: month.disbursed > 0 ? "3px" : "0px" }}
                    title={`Disbursed: ${formatUGX(month.disbursed)}`}
                  />
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                    style={{ height: `${(month.repaid / maxLoanDisbursed) * 100}%`, minHeight: month.repaid > 0 ? "3px" : "0px" }}
                    title={`Repaid: ${formatUGX(month.repaid)}`}
                  />
                  <div
                    className="flex-1 bg-orange-500 rounded-t-sm transition-all duration-300 hover:bg-orange-600"
                    style={{ height: `${(month.outstanding / maxLoanDisbursed) * 100}%`, minHeight: month.outstanding > 0 ? "3px" : "0px" }}
                    title={`Outstanding: ${formatUGX(month.outstanding)}`}
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
          <Badge variant={data.summary.currentDelinquencyRate > 10 ? "danger" : data.summary.currentDelinquencyRate > 5 ? "warning" : "success"}>
            {data.summary.currentDelinquencyRate.toFixed(1)}% current
          </Badge>
        </div>
        {data.delinquencyRate.length > 0 ? (
          <div className="flex items-end gap-3 h-56">
            {data.delinquencyRate.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end h-48">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      month.rate > 10 ? "bg-red-500 hover:bg-red-600" :
                      month.rate > 5 ? "bg-amber-500 hover:bg-amber-600" :
                      "bg-green-500 hover:bg-green-600"
                    }`}
                    style={{ height: `${(month.rate / maxDelinquencyRate) * 100}%`, minHeight: month.rate > 0 ? "4px" : "0px" }}
                    title={`Rate: ${month.rate.toFixed(1)}% (${month.count} loans)`}
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
              {data.memberGrowth.map((m, i) => {
                const savings = data.savingsGrowth[i]
                const loan = data.loanPortfolio[i]
                const delinq = data.delinquencyRate[i]
                return (
                  <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{m.month}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400 font-semibold">{m.count}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-semibold">{formatUGX(savings?.amount || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatUGX(loan?.disbursed || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatUGX(loan?.repaid || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${(delinq?.rate || 0) > 10 ? "text-red-600" : (delinq?.rate || 0) > 5 ? "text-amber-600" : "text-green-600"}`}>
                        {(delinq?.rate || 0).toFixed(1)}%
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
