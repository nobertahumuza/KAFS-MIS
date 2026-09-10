"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Users,
  Landmark,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  FileText,
  DollarSign,
  BarChart3,
  RefreshCw,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { formatUGX } from "@/lib/utils"

interface DashboardData {
  totalMembers: number
  totalSavings: number
  totalLoans: number
  activeLoans: number
  totalExpenses: number
  totalShares: number
  delinquentLoans: number
  cashFlow: {
    month: string
    deposits: number
    withdrawals: number
    expenses: number
  }[]
  recentActivity: Array<{
    id: number
    type: string
    description: string
    amount: number
    date: string
    memberName?: string
  }>
  delinquencyAlerts: Array<{
    id: number
    memberName: string
    loanCode: string
    amount: number
    daysOverdue: number
    riskLevel: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/dashboard")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      console.error("Failed to load dashboard")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchData()
    }
  }, [status])

  const maxCashFlowValue = data?.cashFlow
    ? Math.max(...data.cashFlow.flatMap((m) => [m.deposits, m.withdrawals, m.expenses]), 1)
    : 1

  const quickActions = [
    { label: "Register Member", icon: Users, href: "/members/register", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { label: "Record Deposit", icon: PiggyBank, href: "/savings", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
    { label: "Process Loan", icon: CreditCard, href: "/loans", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
    { label: "New Expense", icon: DollarSign, href: "/expenses", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
    { label: "View Reports", icon: BarChart3, href: "/reports", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
    { label: "Member Statement", icon: FileText, href: "/reports/statement", color: "text-[var(--color-gold)]", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  ]

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load dashboard data.</p>
          <Button variant="outline" onClick={() => fetchData()} icon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.fullName || session?.user?.username}`}
        subtitle="Here's what's happening with your SACCO today."
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
          value={data.totalMembers}
          icon={<Users className="w-5 h-5" />}
          trend={{ value: 5, isPositive: true }}
        />
        <MetricCard
          label="Total Savings"
          value={formatUGX(data.totalSavings)}
          icon={<PiggyBank className="w-5 h-5" />}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard
          label="Active Loans"
          value={data.activeLoans}
          icon={<CreditCard className="w-5 h-5" />}
          trend={{ value: 3, isPositive: true }}
        />
        <MetricCard
          label="Total Shares"
          value={formatUGX(data.totalShares)}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cash Flow Overview</h2>
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
        {data.cashFlow && data.cashFlow.length > 0 ? (
          <div className="flex items-end gap-2 h-48">
            {data.cashFlow.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5" style={{ height: "140px" }}>
                  <div
                    className="flex-1 bg-green-500 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.deposits / maxCashFlowValue) * 100}%`, minHeight: "2px" }}
                    title={`Deposits: ${formatUGX(month.deposits)}`}
                  />
                  <div
                    className="flex-1 bg-blue-500 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.withdrawals / maxCashFlowValue) * 100}%`, minHeight: "2px" }}
                    title={`Withdrawals: ${formatUGX(month.withdrawals)}`}
                  />
                  <div
                    className="flex-1 bg-red-500 rounded-t-sm transition-all duration-300"
                    style={{ height: `${(month.expenses / maxCashFlowValue) * 100}%`, minHeight: "2px" }}
                    title={`Expenses: ${formatUGX(month.expenses)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                  {month.month}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No cash flow data available.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          {data.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        t.type === "Deposit" || t.type === "Savings"
                          ? "bg-green-100 dark:bg-green-900/30"
                          : t.type === "Loan"
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                      }`}
                    >
                      {t.type === "Deposit" || t.type === "Savings" ? (
                        <ArrowDownRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.memberName ? `${t.memberName} · ` : ""}{t.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-semibold ${
                        t.type === "Deposit" || t.type === "Savings"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {t.type === "Deposit" || t.type === "Savings" ? "+" : "-"}
                      {formatUGX(t.amount)}
                    </span>
                    <Badge
                      variant={
                        t.type === "Deposit" || t.type === "Savings"
                          ? "success"
                          : t.type === "Loan"
                          ? "info"
                          : "danger"
                      }
                      className="ml-2"
                    >
                      {t.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No recent activity.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delinquency Alerts</h2>
            </div>
            {data.delinquencyAlerts && data.delinquencyAlerts.length > 0 ? (
              <div className="space-y-3">
                {data.delinquencyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.memberName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{alert.loanCode}</p>
                      </div>
                      <Badge variant="danger">{alert.riskLevel}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {alert.daysOverdue} days overdue
                      </span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatUGX(alert.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No delinquent loans.</p>
              </div>
            )}
            {data.delinquentLoans > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-3 text-center">
                {data.delinquentLoans} loan{data.delinquentLoans > 1 ? "s" : ""} at risk
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.bg} group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{action.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
