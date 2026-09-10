"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Shield, AlertCircle, Skull, RefreshCw, DollarSign } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Table from "@/components/ui/Table"
import { formatUGX } from "@/lib/utils"

interface DelinquencyData {
  summary: {
    totalOverdueLoans: number
    totalActiveLoans: number
    delinquencyRate: number
    totalAtRiskPortfolio: number
    totalPendingFines: number
    riskBreakdown: {
      low: { count: number; amount: number }
      medium: { count: number; amount: number }
      high: { count: number; amount: number }
      critical: { count: number; amount: number }
    }
  }
  loans: Array<{
    loanId: number
    loanCode: string
    memberId: number
    memberName: string
    memberCode: string
    phoneNumber: string
    principalAmount: number
    currentBalance: number
    disbursementDate: string
    dueDate: string | null
    daysOverdue: number
    riskLevel: string
    pendingFines: number
    lastPayment: {
      amount: number
      date: string
    } | null
  }>
}

export default function DelinquencyPage() {
  const [data, setData] = useState<DelinquencyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/reports/delinquency")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      console.error("Failed to load delinquency data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const riskCards = data ? [
    {
      label: "Low Risk",
      value: data.summary.riskBreakdown.low.count,
      icon: <Shield className="w-5 h-5" />,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
      border: "border-green-200 dark:border-green-800",
    },
    {
      label: "Medium Risk",
      value: data.summary.riskBreakdown.medium.count,
      icon: <AlertCircle className="w-5 h-5" />,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
    },
    {
      label: "High Risk",
      value: data.summary.riskBreakdown.high.count,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      border: "border-orange-200 dark:border-orange-800",
    },
    {
      label: "Critical",
      value: data.summary.riskBreakdown.critical.count,
      icon: <Skull className="w-5 h-5" />,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      border: "border-red-200 dark:border-red-800",
    },
  ] : []

  const getRiskBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case "low": return "success"
      case "medium": return "warning"
      case "high": return "danger"
      case "critical": return "danger"
      default: return "default"
    }
  }

  const columns = [
    {
      key: "loanCode",
      header: "Loan Code",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">{item.loanCode as string}</span>
      ),
    },
    {
      key: "memberName",
      header: "Member",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium">{item.memberName as string}</span>
      ),
    },
    {
      key: "principalAmount",
      header: "Principal",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.principalAmount as number)}</span>
      ),
    },
    {
      key: "currentBalance",
      header: "Balance",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold text-red-600 dark:text-red-400">{formatUGX(item.currentBalance as number)}</span>
      ),
    },
    {
      key: "daysOverdue",
      header: "Days Overdue",
      className: "text-center",
      render: (item: Record<string, unknown>) => {
        const days = item.daysOverdue as number
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
            days > 90 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
            days > 60 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
            days > 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}>
            {days}
          </span>
        )
      },
    },
    {
      key: "riskLevel",
      header: "Risk Level",
      render: (item: Record<string, unknown>) => (
        <Badge variant={getRiskBadgeVariant(item.riskLevel as string)}>
          {(item.riskLevel as string).charAt(0).toUpperCase() + (item.riskLevel as string).slice(1)}
        </Badge>
      ),
    },
    {
      key: "lastPayment",
      header: "Last Payment",
      render: (item: Record<string, unknown>) => {
        const lastPayment = item.lastPayment as { amount: number; date: string } | null
        return (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {lastPayment ? new Date(lastPayment.date).toLocaleDateString() : "—"}
          </span>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading delinquency data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load delinquency data.</p>
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
        title="Loan Delinquency"
        subtitle="Monitor overdue loans and risk exposure"
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
        {riskCards.map((card) => (
          <Card key={card.label} className={`p-5 border ${card.border}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Total At-Risk Portfolio</h2>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">{formatUGX(data.summary.totalAtRiskPortfolio)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total At-Risk Loans</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{data.summary.totalOverdueLoans}</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Days Overdue</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {data.loans.length > 0
                ? Math.round(data.loans.reduce((s, l) => s + l.daysOverdue, 0) / data.loans.length)
                : 0} days
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overdue Loans</h2>
        <Table
          columns={columns}
          data={data.loans as unknown as Record<string, unknown>[]}
          emptyMessage="No overdue loans found"
          emptyIcon={<AlertTriangle className="w-12 h-12 mb-3 opacity-50" />}
        />
      </Card>
    </div>
  )
}
