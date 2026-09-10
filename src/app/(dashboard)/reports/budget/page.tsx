"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, RefreshCw, DollarSign, Calendar, TrendingUp, TrendingDown } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Table from "@/components/ui/Table"
import Modal from "@/components/ui/Modal"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { formatUGX } from "@/lib/utils"

interface BudgetItem {
  id: number
  category: string
  budgetedAmount: number
  actualSpent: number
  variance: number
  utilizationRate: number
  transactionCount: number
  notes: string | null
  createdBy: string | null
  createdAt: string
}

interface BudgetData {
  fiscalYear: number
  budgets: BudgetItem[]
  summary: {
    totalBudgeted: number
    totalSpent: number
    variance: number
    overallUtilization: number
    totalCategories: number
  }
}

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fiscalYear, setFiscalYear] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [formCategory, setFormCategory] = useState("")
  const [formBudgeted, setFormBudgeted] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (fiscalYear) params.set("fiscalYear", fiscalYear)
      const res = await fetch(`/api/reports/budget?${params}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        if (!fiscalYear && d.fiscalYear) {
          setFiscalYear(String(d.fiscalYear))
        }
      }
    } catch {
      console.error("Failed to load budget data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fiscalYear])

  const handleOpenModal = (item?: BudgetItem) => {
    if (item) {
      setEditingItem(item)
      setFormCategory(item.category)
      setFormBudgeted(String(item.budgetedAmount))
    } else {
      setEditingItem(null)
      setFormCategory("")
      setFormBudgeted("")
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formCategory || !formBudgeted) return
    setFormLoading(true)
    try {
      const url = editingItem
        ? `/api/reports/budget/${editingItem.id}`
        : "/api/reports/budget"
      const method = editingItem ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory,
          amount: Number(formBudgeted),
          fiscalYear: fiscalYear || data?.fiscalYear,
        }),
      })
      if (res.ok) {
        setModalOpen(false)
        fetchData()
      } else {
        const err = await res.json()
        alert(err.error || "Failed to save budget item")
      }
    } catch {
      alert("Failed to save budget item")
    } finally {
      setFormLoading(false)
    }
  }

  const columns = [
    {
      key: "category",
      header: "Category",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium text-gray-900 dark:text-white">{item.category as string}</span>
      ),
    },
    {
      key: "budgetedAmount",
      header: "Budgeted",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.budgetedAmount as number)}</span>
      ),
    },
    {
      key: "actualSpent",
      header: "Actual",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.actualSpent as number)}</span>
      ),
    },
    {
      key: "variance",
      header: "Variance",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const variance = item.variance as number
        return (
          <span className={`font-semibold ${variance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {variance >= 0 ? "+" : ""}{formatUGX(variance)}
          </span>
        )
      },
    },
    {
      key: "progress",
      header: "Utilization",
      className: "w-48",
      render: (item: Record<string, unknown>) => {
        const budgetedAmount = item.budgetedAmount as number
        const actualSpent = item.actualSpent as number
        const percent = budgetedAmount > 0 ? Math.min((actualSpent / budgetedAmount) * 100, 100) : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  percent > 90 ? "bg-red-500" : percent > 70 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-12 text-right">
              {percent.toFixed(0)}%
            </span>
          </div>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item: Record<string, unknown>) => {
        const budgetedAmount = item.budgetedAmount as number
        const actualSpent = item.actualSpent as number
        const percent = budgetedAmount > 0 ? (actualSpent / budgetedAmount) * 100 : 0
        return (
          <Badge variant={percent > 100 ? "danger" : percent > 80 ? "warning" : "success"}>
            {percent > 100 ? "Over Budget" : percent > 80 ? "Near Limit" : "On Track"}
          </Badge>
        )
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleOpenModal(item as unknown as BudgetItem)
          }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading budget data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Failed to load budget data.</p>
          <Button variant="outline" onClick={() => fetchData()} icon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const fiscalYearOptions = [{ value: String(data.fiscalYear), label: String(data.fiscalYear) }]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Management"
        subtitle="Track budget vs actual spending per category"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}
              onClick={() => fetchData(true)}
              loading={refreshing}
            >
              Refresh
            </Button>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => handleOpenModal()}
            >
              Add Budget
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <Select
          label="Fiscal Year"
          options={fiscalYearOptions}
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
          className="max-w-[200px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Budgeted"
          value={formatUGX(data.summary.totalBudgeted)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Actual"
          value={formatUGX(data.summary.totalSpent)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Variance"
          value={formatUGX(data.summary.variance)}
          icon={data.summary.variance >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        />
        <MetricCard
          label="Budget Utilization"
          value={`${data.summary.overallUtilization.toFixed(1)}%`}
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget vs Actual by Category</h2>
        {data.budgets.length > 0 && (
          <div className="mb-6">
            <div className="flex items-end gap-2 h-48">
              {data.budgets.map((item) => {
                const maxVal = Math.max(item.budgetedAmount, item.actualSpent, 1)
                return (
                  <div key={item.id} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end gap-1 h-40">
                      <div
                        className="flex-1 bg-blue-400 dark:bg-blue-600 rounded-t-sm transition-all duration-300"
                        style={{ height: `${(item.budgetedAmount / maxVal) * 100}%`, minHeight: "4px" }}
                        title={`Budgeted: ${formatUGX(item.budgetedAmount)}`}
                      />
                      <div
                        className={`flex-1 rounded-t-sm transition-all duration-300 ${
                          item.actualSpent > item.budgetedAmount ? "bg-red-500" : "bg-green-500"
                        }`}
                        style={{ height: `${(item.actualSpent / maxVal) * 100}%`, minHeight: "4px" }}
                        title={`Actual: ${formatUGX(item.actualSpent)}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                      {item.category}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-600" />
                <span className="text-gray-500 dark:text-gray-400">Budgeted</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-gray-500 dark:text-gray-400">Actual (Under)</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-gray-500 dark:text-gray-400">Actual (Over)</span>
              </div>
            </div>
          </div>
        )}
        <Table
          columns={columns}
          data={data.budgets as unknown as Record<string, unknown>[]}
          emptyMessage="No budget items found. Add your first budget category."
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit Budget Item" : "Add Budget Item"}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Category"
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
            placeholder="e.g. Office Supplies"
            disabled={!!editingItem}
          />
          <Input
            label="Budgeted Amount (UGX)"
            type="number"
            value={formBudgeted}
            onChange={(e) => setFormBudgeted(e.target.value)}
            placeholder="0"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={formLoading} disabled={!formCategory || !formBudgeted}>
              {editingItem ? "Update" : "Add"} Budget
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
