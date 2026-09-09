"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react"
import { Card } from "@/components/ui/Card"

function formatUGX(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount)
}

interface TreasuryData {
  totalCash: number
  totalSavingsDeposits: number
  totalFixedDeposits: number
  totalLoanPortfolio: number
  totalShares: number
  totalExpensesThisMonth: number
  incomeByCategory: Array<{ category: string; amount: number }>
  expenseByCategory: Array<{ category: string; amount: number }>
  largeTransactions: Array<{
    id: number
    type: string
    description: string
    amount: number
    date: string
    category?: string
  }>
}

export default function TreasuryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<TreasuryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/treasury")
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
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading treasury data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Failed to load treasury data.</p>
      </div>
    )
  }

  const totalIncome = data.incomeByCategory.reduce((sum, c) => sum + c.amount, 0)
  const totalExpense = data.expenseByCategory.reduce((sum, c) => sum + c.amount, 0)
  const netPosition = totalIncome - totalExpense

  const summaryMetrics = [
    {
      title: "Total Cash",
      value: formatUGX(data.totalCash),
      icon: Wallet,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: "Total Savings Deposits",
      value: formatUGX(data.totalSavingsDeposits),
      icon: PiggyBank,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Total Fixed Deposits",
      value: formatUGX(data.totalFixedDeposits),
      icon: Landmark,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Total Loan Portfolio",
      value: formatUGX(data.totalLoanPortfolio),
      icon: TrendingUp,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: "Total Shares",
      value: formatUGX(data.totalShares),
      icon: Activity,
      color: "text-[var(--color-gold)]",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      title: "Total Expenses (This Month)",
      value: formatUGX(data.totalExpensesThisMonth),
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Treasury Overview
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Financial summary for {session?.user?.fullName || "Treasurer"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryMetrics.map((m) => (
          <Card key={m.title} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{m.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {m.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.bg}`}>
                <m.icon className={`w-6 h-6 ${m.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Income Summary
          </h2>
          {data.incomeByCategory.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No income data available.</p>
          ) : (
            <div className="space-y-3">
              {data.incomeByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatUGX(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Income</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatUGX(totalIncome)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Expense Summary
          </h2>
          {data.expenseByCategory.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No expense data available.</p>
          ) : (
            <div className="space-y-3">
              {data.expenseByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    -{formatUGX(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Expenses</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -{formatUGX(totalExpense)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Net Position
          </h2>
          <span
            className={`text-lg font-bold ${
              netPosition >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {netPosition >= 0 ? "+" : ""}{formatUGX(netPosition)}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Large Transactions (&gt; UGX 500,000)
        </h2>
        {data.largeTransactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No large transactions found.</p>
        ) : (
          <div className="space-y-3">
            {data.largeTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      t.type === "Income" || t.type === "Deposit" || t.type === "Savings"
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {t.type === "Income" || t.type === "Deposit" || t.type === "Savings" ? (
                      <ArrowDownRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t.category && <span className="mr-2">{t.category}</span>}
                      {t.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    t.type === "Income" || t.type === "Deposit" || t.type === "Savings"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {t.type === "Income" || t.type === "Deposit" || t.type === "Savings"
                    ? "+"
                    : "-"}
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
