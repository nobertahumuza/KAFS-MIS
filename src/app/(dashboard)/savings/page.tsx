"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown, Filter, X } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate, formatDateTime } from "@/lib/utils"

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface SavingsTransaction {
  id: number
  memberId: number
  memberName: string
  memberCode: string
  transactionType: string
  amount: number
  withdrawalFee: number
  balanceAfter: number
  narration: string | null
  referenceNumber: string | null
  transactionDate: string
}

interface SavingsSummary {
  totalDeposits: number
  totalWithdrawals: number
  netSavings: number
}

interface TransactionFormData {
  memberId: string
  transactionType: "Deposit" | "Withdrawal"
  amount: string
  narration: string
  sendSms: boolean
}

const initialFormData: TransactionFormData = {
  memberId: "",
  transactionType: "Deposit",
  amount: "",
  narration: "",
  sendSms: false,
}

const WITHDRAWAL_FEE = 500

export default function SavingsPage() {
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [summary, setSummary] = useState<SavingsSummary>({ totalDeposits: 0, totalWithdrawals: 0, netSavings: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TransactionFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [selectedMemberBalance, setSelectedMemberBalance] = useState<number | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter) params.set("type", typeFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/savings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
        setSummary(data.summary || { totalDeposits: 0, totalWithdrawals: 0, netSavings: 0 })
      }
    } catch (err) {
      console.error("Failed to fetch savings:", err)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMemberOptions([])
      return
    }
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&pageSize=10`)
      if (res.ok) {
        const data = await res.json()
        setMemberOptions(data.data || [])
      }
    } catch (err) {
      console.error("Member search failed:", err)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMembers(memberSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [memberSearch, searchMembers])

  const fetchMemberBalance = useCallback(async (memberId: string) => {
    if (!memberId) {
      setSelectedMemberBalance(null)
      return
    }
    try {
      const res = await fetch(`/api/savings/balance?memberId=${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedMemberBalance(data.balance ?? 0)
      }
    } catch {
      setSelectedMemberBalance(0)
    }
  }, [])

  const handleFormChange = (field: keyof TransactionFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleMemberSelect = (member: MemberOption) => {
    setForm((prev) => ({ ...prev, memberId: String(member.id) }))
    setMemberSearch(`${member.memberCode} - ${member.farmerName}`)
    setMemberDropdownOpen(false)
    setMemberOptions([])
    fetchMemberBalance(String(member.id))
    if (formErrors.memberId) setFormErrors((prev) => ({ ...prev, memberId: undefined }))
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof TransactionFormData, string>> = {}
    if (!form.memberId) errors.memberId = "Select a member"
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) {
      errors.amount = "Enter a valid amount"
    } else if (form.transactionType === "Withdrawal" && amount + WITHDRAWAL_FEE > (selectedMemberBalance ?? 0)) {
      errors.amount = "Insufficient balance (includes UGX 500 fee)"
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    setSubmitError("")

    try {
      const amount = parseFloat(form.amount)
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: parseInt(form.memberId),
          transactionType: form.transactionType,
          amount,
          narration: form.narration.trim() || null,
          sendSms: form.sendSms,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Transaction failed")
      }

      setModalOpen(false)
      setForm(initialFormData)
      setMemberSearch("")
      setSelectedMemberBalance(null)
      fetchTransactions()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: "referenceNumber",
      header: "Reference",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {(item.referenceNumber as string) || "—"}
        </span>
      ),
    },
    {
      key: "memberCode",
      header: "Member",
      render: (item: Record<string, unknown>) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{item.memberName as string}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.memberCode as string}</p>
        </div>
      ),
    },
    {
      key: "transactionType",
      header: "Type",
      render: (item: Record<string, unknown>) => {
        const type = item.transactionType as string
        return (
          <Badge variant={type === "Deposit" ? "success" : type === "Withdrawal" ? "warning" : "info"}>
            {type}
          </Badge>
        )
      },
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const amount = item.amount as number
        const type = item.transactionType as string
        return (
          <span className={type === "Deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {type === "Deposit" ? "+" : "-"}{formatUGX(amount)}
          </span>
        )
      },
    },
    {
      key: "withdrawalFee",
      header: "Fee",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const fee = item.withdrawalFee as number
        return fee > 0 ? <span className="text-amber-600 dark:text-amber-400">{formatUGX(fee)}</span> : "—"
      },
    },
    {
      key: "balanceAfter",
      header: "Balance",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.balanceAfter as number)}</span>
      ),
    },
    {
      key: "transactionDate",
      header: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDateTime(item.transactionDate as string)}
        </span>
      ),
    },
  ]

  const withdrawalAmount = parseFloat(form.amount) || 0
  const totalDeduction = form.transactionType === "Withdrawal" ? withdrawalAmount + WITHDRAWAL_FEE : withdrawalAmount

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        subtitle="Manage member deposits and withdrawals"
        actions={
          <Button icon={<ArrowDownCircle className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            New Transaction
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Deposits"
          value={formatUGX(summary.totalDeposits)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Withdrawals"
          value={formatUGX(summary.totalWithdrawals)}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <MetricCard
          label="Net Savings"
          value={formatUGX(summary.netSavings)}
          icon={<Wallet className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="w-4 h-4" />}
            >
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: "", label: "All Types" },
                  { value: "Deposit", label: "Deposits" },
                  { value: "Withdrawal", label: "Withdrawals" },
                ]}
                className="max-w-[160px]"
              />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="max-w-[180px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="max-w-[180px]"
                placeholder="To"
              />
              {(typeFilter || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeFilter("")
                    setDateFrom("")
                    setDateTo("")
                  }}
                  icon={<X className="w-4 h-4" />}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>

        <Table columns={columns} data={transactions as unknown as Record<string, unknown>[]} emptyMessage="No transactions found" />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setForm(initialFormData)
          setMemberSearch("")
          setSelectedMemberBalance(null)
          setSubmitError("")
        }}
        title="New Savings Transaction"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <div className="relative">
            <Input
              label="Member *"
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value)
                setForm((prev) => ({ ...prev, memberId: "" }))
                setSelectedMemberBalance(null)
                setMemberDropdownOpen(true)
              }}
              onFocus={() => setMemberDropdownOpen(true)}
              placeholder="Search member by name or code..."
              error={formErrors.memberId}
            />
            {memberDropdownOpen && memberOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {memberOptions.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleMemberSelect(member)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{member.farmerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.memberCode} • {member.phoneNumber || "No phone"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMemberBalance !== null && (
            <div className="p-3 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
              <p className="text-lg font-bold text-[var(--color-primary)]">{formatUGX(selectedMemberBalance)}</p>
            </div>
          )}

          <Select
            label="Transaction Type *"
            value={form.transactionType}
            onChange={handleFormChange("transactionType")}
            options={[
              { value: "Deposit", label: "Deposit" },
              { value: "Withdrawal", label: "Withdrawal" },
            ]}
          />

          <Input
            label="Amount (UGX) *"
            type="number"
            value={form.amount}
            onChange={handleFormChange("amount")}
            error={formErrors.amount}
            placeholder="0"
            min="1"
          />

          {form.transactionType === "Withdrawal" && withdrawalAmount > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Withdrawal Amount</span>
                <span>{formatUGX(withdrawalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Processing Fee</span>
                <span className="text-amber-600 dark:text-amber-400">{formatUGX(WITHDRAWAL_FEE)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-amber-200 dark:border-amber-700 pt-1">
                <span>Total Deduction</span>
                <span>{formatUGX(totalDeduction)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Narration</label>
            <textarea
              value={form.narration}
              onChange={handleFormChange("narration")}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
              placeholder="Optional note..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendSms}
              onChange={handleFormChange("sendSms")}
              className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Send SMS notification to member</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setModalOpen(false)
                setForm(initialFormData)
                setMemberSearch("")
                setSelectedMemberBalance(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {form.transactionType === "Deposit" ? "Process Deposit" : "Process Withdrawal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
