"use client"

import { useState, useEffect } from "react"
import { Calendar, CheckCircle, Clock, AlertTriangle, RefreshCw, Archive, Lock, Unlock, TrendingUp, TrendingDown } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Modal from "@/components/ui/Modal"
import Table from "@/components/ui/Table"
import { formatUGX, formatDate } from "@/lib/utils"

interface FiscalYearInfo {
  id: number
  year: string
  startDate: string
  endDate: string
  status: string
  totalIncome: number
  totalExpenses: number
  netIncome: number
  closedAt: string | null
  closedBy: string | null
}

interface YearEndData {
  currentYear: FiscalYearInfo | null
  closedYears: FiscalYearInfo[]
  summary: {
    totalIncome: number
    totalExpenses: number
    netIncome: number
    daysRemaining: number
  }
}

export default function YearEndPage() {
  const [data, setData] = useState<YearEndData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState(0)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/reports/year-end")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      console.error("Failed to load year-end data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCloseYear = async () => {
    if (confirmStep === 0) {
      setConfirmStep(1)
      return
    }
    setClosing(true)
    try {
      const res = await fetch("/api/reports/year-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      })
      if (res.ok) {
        setConfirmOpen(false)
        setConfirmStep(0)
        fetchData()
      } else {
        const err = await res.json()
        alert(err.error || "Failed to close year")
      }
    } catch {
      alert("Failed to close fiscal year")
    } finally {
      setClosing(false)
    }
  }

  const closedYearColumns = [
    {
      key: "year",
      header: "Fiscal Year",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono font-semibold text-gray-900 dark:text-white">{item.year as string}</span>
      ),
    },
    {
      key: "totalIncome",
      header: "Income",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold text-green-600 dark:text-green-400">{formatUGX(item.totalIncome as number)}</span>
      ),
    },
    {
      key: "totalExpenses",
      header: "Expenses",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold text-red-600 dark:text-red-400">{formatUGX(item.totalExpenses as number)}</span>
      ),
    },
    {
      key: "netIncome",
      header: "Net Income",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const net = item.netIncome as number
        return (
          <span className={`font-bold ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {net >= 0 ? "+" : ""}{formatUGX(net)}
          </span>
        )
      },
    },
    {
      key: "closedAt",
      header: "Closed On",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {item.closedAt ? formatDate(item.closedAt as string) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Record<string, unknown>) => (
        <Badge variant={item.status === "Closed" ? "success" : "warning"}>
          {item.status as string}
        </Badge>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading year-end data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load year-end data.</p>
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
        title="Year-End Closing"
        subtitle="Close the current fiscal year and view historical records"
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

      {data.currentYear && (
        <Card className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Fiscal Year {data.currentYear.year}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(data.currentYear.startDate)} — {formatDate(data.currentYear.endDate)}
                </p>
              </div>
            </div>
            <Badge variant={data.currentYear.status === "Open" ? "warning" : "success"}>
              {data.currentYear.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Total Income"
              value={formatUGX(data.summary.totalIncome)}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <MetricCard
              label="Total Expenses"
              value={formatUGX(data.summary.totalExpenses)}
              icon={<TrendingDown className="w-5 h-5" />}
            />
            <MetricCard
              label="Net Income"
              value={formatUGX(data.summary.netIncome)}
              icon={data.summary.netIncome >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            />
            <MetricCard
              label="Days Remaining"
              value={data.summary.daysRemaining}
              icon={<Clock className="w-5 h-5" />}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="danger"
              icon={<Lock className="w-4 h-4" />}
              onClick={() => {
                setConfirmStep(0)
                setConfirmOpen(true)
              }}
              disabled={data.currentYear.status === "Closed"}
            >
              Close Year
            </Button>
            {data.summary.daysRemaining > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data.summary.daysRemaining} days remaining in the current fiscal year
              </p>
            )}
          </div>
        </Card>
      )}

      {!data.currentYear && (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No active fiscal year found.</p>
          <p className="text-sm text-gray-400 mt-1">A new fiscal year can be started from settings.</p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Archive className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Closed Years History</h2>
        </div>
        <Table
          columns={closedYearColumns}
          data={data.closedYears as unknown as Record<string, unknown>[]}
          emptyMessage="No closed fiscal years yet"
          emptyIcon={<Calendar className="w-12 h-12 mb-3 opacity-50" />}
        />
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setConfirmStep(0)
        }}
        title="Confirm Year-End Closing"
        size="md"
      >
        <div className="space-y-4">
          {confirmStep === 0 ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    This action will permanently close the current fiscal year.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    All transactions will be finalized and no further entries will be allowed for this period.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary Before Closing</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Income</span>
                    <span className="text-sm font-semibold text-green-600">{formatUGX(data?.summary.totalIncome || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</span>
                    <span className="text-sm font-semibold text-red-600">{formatUGX(data?.summary.totalExpenses || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Net Income</span>
                    <span className={`text-sm font-bold ${(data?.summary.netIncome || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatUGX(data?.summary.netIncome || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleCloseYear}>
                  Proceed to Confirm
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Final Confirmation Required
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Type &quot;CLOSE&quot; to confirm. This action is irreversible.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" onClick={() => setConfirmStep(0)}>
                  Back
                </Button>
                <Button variant="danger" onClick={handleCloseYear} loading={closing}>
                  <Lock className="w-4 h-4" />
                  Close Year Permanently
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
