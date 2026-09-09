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
} from "lucide-react"
import { Card } from "@/components/ui/Card"

interface DashboardData {
  totalMembers: number
  totalSavings: number
  totalLoans: number
  activeLoans: number
  totalExpenses: number
  totalShares: number
  recentTransactions: Array<{
    id: number
    type: string
    description: string
    amount: number
    date: string
  }>
}

function formatUGX(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/dashboard")
        .then((res) => res.json())
        .then((d) => {
          setData(d)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [status])

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
        <p className="text-gray-500">Failed to load dashboard data.</p>
      </div>
    )
  }

  const metrics = [
    {
      title: "Total Members",
      value: data.totalMembers,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Total Savings",
      value: formatUGX(data.totalSavings),
      icon: PiggyBank,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Active Loans",
      value: data.activeLoans,
      icon: CreditCard,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: "Total Loan Portfolio",
      value: formatUGX(data.totalLoans),
      icon: Landmark,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Total Shares",
      value: formatUGX(data.totalShares),
      icon: TrendingUp,
      color: "text-[var(--color-gold)]",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      title: "Total Expenses",
      value: formatUGX(data.totalExpenses),
      icon: Activity,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {session?.user?.fullName || session?.user?.username}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your SACCO today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <Card key={m.title} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{m.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.bg}`}>
                <m.icon className={`w-6 h-6 ${m.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        {data.recentTransactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No recent transactions.</p>
        ) : (
          <div className="space-y-3">
            {data.recentTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      t.type === "Deposit" || t.type === "Savings"
                        ? "bg-green-100 dark:bg-green-900/30"
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
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.date}</p>
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
