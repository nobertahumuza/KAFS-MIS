"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, TrendingUp, Users, DollarSign, ExternalLink } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
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
}

interface Shareholder {
  id: number
  farmerName: string
  memberCode: string
  totalShares: number
  shareValue: number
}

interface ShareTransaction {
  id: number
  memberId: number
  transactionType: string
  sharesQuantity: number
  sharePrice: number
  totalAmount: number
  narration: string | null
  referenceNumber: string | null
  transactionDate: string
  member: { id: number; farmerName: string; memberCode: string }
}

interface Summary {
  totalSharesIssued: number
  totalValue: number
  shareholdersCount: number
  pricePerShare: number
}

interface FormData {
  memberId: string
  quantity: string
  sharePrice: string
  transactionType: string
  transactionDate: string
  narration: string
  sendSms: boolean
}

const initialForm: FormData = {
  memberId: "",
  quantity: "",
  sharePrice: "10000",
  transactionType: "Purchase",
  transactionDate: new Date().toISOString().split("T")[0],
  narration: "",
  sendSms: false,
}

export default function SharesPage() {
  const router = useRouter()
  const [shareholders, setShareholders] = useState<Shareholder[]>([])
  const [transactions, setTransactions] = useState<ShareTransaction[]>([])
  const [summary, setSummary] = useState<Summary>({ totalSharesIssued: 0, totalValue: 0, shareholdersCount: 0, pricePerShare: 10000 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
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
      const res = await fetch(`/api/shares?${params}`)
      if (res.ok) {
        const data = await res.json()
        setShareholders(data.shareholders || [])
        setTransactions(data.transactions || [])
        setSummary(data.summary || { totalSharesIssued: 0, totalValue: 0, shareholdersCount: 0, pricePerShare: 10000 })
      }
    } catch (err) {
      console.error("Failed to fetch shares:", err)
    } finally {
      setLoading(false)
    }
  }, [search])

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

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!form.memberId) errors.memberId = "Select a member"
    const qty = parseInt(form.quantity)
    if (!form.quantity || isNaN(qty) || qty <= 0) errors.quantity = "Enter a valid quantity"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: parseInt(form.memberId),
          quantity: parseInt(form.quantity),
          sharePrice: parseFloat(form.sharePrice),
          transactionType: form.transactionType,
          transactionDate: form.transactionDate,
          narration: form.narration.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to record share transaction")
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

  const shareholderColumns = [
    {
      key: "memberCode",
      header: "Member",
      render: (item: Record<string, unknown>) => {
        const s = item as unknown as Shareholder
        return (
          <button
            onClick={() => router.push(`/members/${s.id}/edit`)}
            className="text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-1 -m-1 transition-colors group"
          >
            <p className="font-medium text-gray-900 dark:text-white group-hover:text-[var(--color-primary)]">{s.farmerName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {s.memberCode}
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </button>
        )
      },
    },
    {
      key: "totalShares",
      header: "Total Shares",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{(item.totalShares as number).toLocaleString()}</span>
      ),
    },
    {
      key: "shareValue",
      header: "Total Value",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.shareValue as number)}</span>
      ),
    },
  ]

  const transactionColumns = [
    {
      key: "referenceNumber",
      header: "Reference",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs">{(item.referenceNumber as string) || "—"}</span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Record<string, unknown>) => {
        const t = item as unknown as ShareTransaction
        const m = t.member
        return (
          <button
            onClick={() => router.push(`/members/${t.memberId}/edit`)}
            className="text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-1 -m-1 transition-colors group"
          >
            <p className="font-medium text-gray-900 dark:text-white group-hover:text-[var(--color-primary)]">{m.farmerName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{m.memberCode}</p>
          </button>
        )
      },
    },
    {
      key: "transactionType",
      header: "Type",
      render: (item: Record<string, unknown>) => {
        const t = item.transactionType as string
        return <Badge variant={t === "Purchase" ? "success" : t === "Transfer In" ? "info" : "warning"}>{t}</Badge>
      },
    },
    {
      key: "sharesQuantity",
      header: "Shares",
      className: "text-right",
      render: (item: Record<string, unknown>) => <span>{(item.sharesQuantity as number).toLocaleString()}</span>,
    },
    {
      key: "totalAmount",
      header: "Amount",
      className: "text-right",
      render: (item: Record<string, unknown>) => (
        <span className="font-semibold">{formatUGX(item.totalAmount as number)}</span>
      ),
    },
    {
      key: "transactionDate",
      header: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500">{formatDateTime(item.transactionDate as string)}</span>
      ),
    },
  ]

  const totalCost = (parseInt(form.quantity) || 0) * (parseFloat(form.sharePrice) || 10000)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shares"
        subtitle="Manage SACCO shares"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Buy Shares
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Shares Issued" value={summary.totalSharesIssued.toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} />
        <MetricCard label="Total Value" value={formatUGX(summary.totalValue)} icon={<DollarSign className="w-5 h-5" />} />
        <MetricCard label="Shareholders" value={summary.shareholdersCount} icon={<Users className="w-5 h-5" />} />
        <MetricCard label="Price Per Share" value={formatUGX(summary.pricePerShare)} icon={<DollarSign className="w-5 h-5" />} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shareholders</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search shareholders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
        <Table columns={shareholderColumns} data={shareholders as unknown as Record<string, unknown>[]} emptyMessage="No shareholders found" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Transactions</h3>
        </div>
        <Table columns={transactionColumns} data={transactions as unknown as Record<string, unknown>[]} emptyMessage="No transactions found" />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(initialForm); setMemberSearch(""); setSubmitError("") }} title="Buy Shares" size="md">
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
            label="Quantity *"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            error={formErrors.quantity}
            placeholder="0"
            min="1"
          />

          <Input
            label="Price Per Share (UGX)"
            type="number"
            value={form.sharePrice}
            onChange={(e) => setForm((p) => ({ ...p, sharePrice: e.target.value }))}
            placeholder="10000"
          />

          <Select
            label="Transaction Type *"
            value={form.transactionType}
            onChange={(e) => setForm((p) => ({ ...p, transactionType: e.target.value }))}
            options={[
              { value: "Purchase", label: "Purchase" },
              { value: "Transfer In", label: "Transfer In" },
              { value: "Refund", label: "Refund" },
            ]}
          />

          <Input
            label="Date"
            type="date"
            value={form.transactionDate}
            onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Narration</label>
            <textarea
              value={form.narration}
              onChange={(e) => setForm((p) => ({ ...p, narration: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] resize-none"
              placeholder="Optional note..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendSms}
              onChange={(e) => setForm((p) => ({ ...p, sendSms: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Send SMS notification</span>
          </label>

          {totalCost > 0 && (
            <div className="p-3 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Cost</span>
                <span>{formatUGX(totalCost)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setForm(initialForm); setMemberSearch("") }}>Cancel</Button>
            <Button type="submit" loading={submitting}>Confirm Purchase</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
