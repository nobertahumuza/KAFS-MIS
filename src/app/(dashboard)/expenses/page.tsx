"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Receipt, Calendar, TrendingDown, Filter, X } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface ExpenseRecord {
  id: number
  category: string
  description: string
  amount: number
  expenseDate: string
  paymentMethod: string | null
  referenceNo: string | null
  recorder: { id: number; fullName: string } | null
}

interface Summary {
  totalExpenses: number
  thisMonth: number
  thisWeek: number
}

interface FormData {
  category: string
  description: string
  amount: string
  expenseDate: string
  paymentMethod: string
}

const initialForm: FormData = {
  category: "",
  description: "",
  amount: "",
  expenseDate: new Date().toISOString().split("T")[0],
  paymentMethod: "Cash",
}

const EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Transport",
  "Utilities",
  "Salaries",
  "Rent",
  "Equipment",
  "Marketing",
  "Legal & Professional",
  "Maintenance",
  "Other",
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [summary, setSummary] = useState<Summary>({ totalExpenses: 0, thisMonth: 0, thisWeek: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (categoryFilter) params.set("category", categoryFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      const res = await fetch(`/api/expenses?${params}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses || [])
        setSummary(data.summary || { totalExpenses: 0, thisMonth: 0, thisWeek: 0 })
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err)
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!form.category) errors.category = "Category is required"
    if (!form.description?.trim()) errors.description = "Description is required"
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) errors.amount = "Enter a valid amount"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          expenseDate: form.expenseDate,
          paymentMethod: form.paymentMethod,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to record expense")
      }
      setModalOpen(false)
      setForm(initialForm)
      fetchData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: "expenseDate",
      header: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500">{formatDate(item.expenseDate as string)}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item: Record<string, unknown>) => (
        <Badge variant="info">{item.category as string}</Badge>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-gray-900 dark:text-white">{item.description as string}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold text-red-600 dark:text-red-400">{formatUGX(item.amount as number)}</span>
      ),
    },
    {
      key: "paymentMethod",
      header: "Payment Method",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm">{(item.paymentMethod as string) || "—"}</span>
      ),
    },
    {
      key: "recorder",
      header: "Recorded By",
      render: (item: Record<string, unknown>) => {
        const r = item.recorder as { fullName: string } | null
        return <span className="text-sm">{r?.fullName || "—"}</span>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track and manage SACCO expenses"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Record Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Expenses" value={formatUGX(summary.totalExpenses)} icon={<TrendingDown className="w-5 h-5" />} />
        <MetricCard label="This Month" value={formatUGX(summary.thisMonth)} icon={<Calendar className="w-5 h-5" />} />
        <MetricCard label="This Week" value={formatUGX(summary.thisWeek)} icon={<Receipt className="w-5 h-5" />} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} icon={<Filter className="w-4 h-4" />}>
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[{ value: "", label: "All Categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
                className="max-w-[180px]"
              />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="max-w-[180px]" placeholder="From" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="max-w-[180px]" placeholder="To" />
              {(categoryFilter || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter(""); setDateFrom(""); setDateTo("") }} icon={<X className="w-4 h-4" />}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
        <Table columns={columns} data={expenses as unknown as Record<string, unknown>[]} emptyMessage="No expenses found" />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(initialForm); setSubmitError("") }} title="Record Expense" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <Select
            label="Category *"
            value={form.category}
            onChange={(e) => { setForm((p) => ({ ...p, category: e.target.value })); if (formErrors.category) setFormErrors((p) => ({ ...p, category: undefined })) }}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select category"
            error={formErrors.category}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => { setForm((p) => ({ ...p, description: e.target.value })); if (formErrors.description) setFormErrors((p) => ({ ...p, description: undefined })) }}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] resize-none"
              placeholder="Enter description..."
            />
            {formErrors.description && <p className="text-sm text-red-600">{formErrors.description}</p>}
          </div>

          <Input
            label="Amount (UGX) *"
            type="number"
            value={form.amount}
            onChange={(e) => { setForm((p) => ({ ...p, amount: e.target.value })); if (formErrors.amount) setFormErrors((p) => ({ ...p, amount: undefined })) }}
            error={formErrors.amount}
            placeholder="0"
            min="1"
          />

          <Input
            label="Date"
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
          />

          <Select
            label="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
            options={[
              { value: "Cash", label: "Cash" },
              { value: "Mobile Money", label: "Mobile Money" },
              { value: "Bank Transfer", label: "Bank Transfer" },
              { value: "Cheque", label: "Cheque" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setForm(initialForm) }}>Cancel</Button>
            <Button type="submit" loading={submitting}>Record Expense</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
