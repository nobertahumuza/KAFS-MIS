"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Landmark, TrendingUp, CheckCircle, Clock } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
}

interface FixedAccount {
  id: number
  fixedCode: string
  memberId: number
  accountNumber: string
  principalAmount: number
  startDate: string
  fixedPeriod: number
  maturityDate: string
  interestRate: number
  interestEarned: number
  maturityAmount: number
  status: string
  member: { id: number; farmerName: string; memberCode: string }
}

interface Summary {
  totalAccounts: number
  activeAccounts: number
  maturedAccounts: number
  totalValue: number
}

interface FormData {
  memberId: string
  principalAmount: string
  duration: string
  startDate: string
}

const initialForm: FormData = {
  memberId: "",
  principalAmount: "",
  duration: "6",
  startDate: new Date().toISOString().split("T")[0],
}

export default function FixedAccountsPage() {
  const [accounts, setAccounts] = useState<FixedAccount[]>([])
  const [summary, setSummary] = useState<Summary>({ totalAccounts: 0, activeAccounts: 0, maturedAccounts: 0, totalValue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/fixed-accounts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
        setSummary(data.summary || { totalAccounts: 0, activeAccounts: 0, maturedAccounts: 0, totalValue: 0 })
      }
    } catch (err) {
      console.error("Failed to fetch fixed accounts:", err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) { setMemberOptions([]); return }
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
    const timer = setTimeout(() => searchMembers(memberSearch), 300)
    return () => clearTimeout(timer)
  }, [memberSearch, searchMembers])

  const handleMemberSelect = (member: MemberOption) => {
    setForm((prev) => ({ ...prev, memberId: String(member.id) }))
    setMemberSearch(`${member.memberCode} - ${member.farmerName}`)
    setMemberDropdownOpen(false)
    setMemberOptions([])
  }

  const getInterestPreview = () => {
    const principal = parseFloat(form.principalAmount) || 0
    const duration = Number(form.duration)
    const rate = duration === 6 ? 3 : duration === 12 ? 6 : 1.5
    const interest = principal * (rate / 100)
    return { rate, interest, maturity: principal + interest }
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!form.memberId) errors.memberId = "Select a member"
    const amount = parseFloat(form.principalAmount)
    if (!form.principalAmount || isNaN(amount) || amount <= 0) errors.principalAmount = "Enter a valid amount"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/fixed-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: parseInt(form.memberId),
          principalAmount: parseFloat(form.principalAmount),
          duration: parseInt(form.duration),
          startDate: form.startDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create fixed account")
      }
      setModalOpen(false)
      setForm(initialForm)
      setMemberSearch("")
      fetchData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const preview = getInterestPreview()

  const columns = [
    {
      key: "fixedCode",
      header: "Account Code",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs">{item.fixedCode as string}</span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Record<string, unknown>) => {
        const member = item.member as { farmerName: string; memberCode: string }
        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{member.farmerName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{member.memberCode}</p>
          </div>
        )
      },
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
      key: "interestRate",
      header: "Rate",
      render: (item: Record<string, unknown>) => (
        <span>{item.interestRate as number}%</span>
      ),
    },
    {
      key: "fixedPeriod",
      header: "Duration",
      render: (item: Record<string, unknown>) => (
        <span>{item.fixedPeriod as number} months</span>
      ),
    },
    {
      key: "maturityDate",
      header: "Maturity Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500">{formatDate(item.maturityDate as string)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Record<string, unknown>) => (
        <Badge variant={getStatusVariant(item.status as string)}>{item.status as string}</Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Accounts"
        subtitle="Manage fixed deposit accounts"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            New Fixed Account
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Accounts" value={summary.totalAccounts} icon={<Landmark className="w-5 h-5" />} />
        <MetricCard label="Active" value={summary.activeAccounts} icon={<Clock className="w-5 h-5" />} />
        <MetricCard label="Matured" value={summary.maturedAccounts} icon={<CheckCircle className="w-5 h-5" />} />
        <MetricCard label="Total Value" value={formatUGX(summary.totalValue)} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code or member name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Statuses" },
              { value: "Active", label: "Active" },
              { value: "Matured", label: "Matured" },
              { value: "Withdrawn", label: "Withdrawn" },
            ]}
            className="max-w-[160px]"
          />
        </div>
        <Table columns={columns} data={accounts as unknown as Record<string, unknown>[]} emptyMessage="No fixed accounts found" />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(initialForm); setMemberSearch(""); setSubmitError("") }} title="New Fixed Account" size="md">
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
              onChange={(e) => { setMemberSearch(e.target.value); setForm((p) => ({ ...p, memberId: "" })); setMemberDropdownOpen(true) }}
              onFocus={() => setMemberDropdownOpen(true)}
              placeholder="Search member by name or code..."
              error={formErrors.memberId}
            />
            {memberDropdownOpen && memberOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {memberOptions.map((m) => (
                  <button key={m.id} type="button" onClick={() => handleMemberSelect(m)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{m.farmerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.memberCode}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Input
            label="Principal Amount (UGX) *"
            type="number"
            value={form.principalAmount}
            onChange={(e) => setForm((p) => ({ ...p, principalAmount: e.target.value }))}
            error={formErrors.principalAmount}
            placeholder="0"
            min="1"
          />

          <Select
            label="Duration *"
            value={form.duration}
            onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
            options={[
              { value: "3", label: "3 Months" },
              { value: "6", label: "6 Months (3% interest)" },
              { value: "12", label: "12 Months (6% interest)" },
            ]}
          />

          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          />

          {parseFloat(form.principalAmount) > 0 && (
            <div className="p-4 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Interest Rate</span>
                <span>{preview.rate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Interest Earned</span>
                <span className="text-emerald-600">{formatUGX(preview.interest)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-[var(--color-primary)]/20 pt-2">
                <span>Maturity Amount</span>
                <span>{formatUGX(preview.maturity)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setForm(initialForm); setMemberSearch("") }}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create Fixed Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
