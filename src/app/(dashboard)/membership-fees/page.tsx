"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Plus, CreditCard, DollarSign, CalendarDays,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface MembershipFee {
  id: number
  amount: number
  description: string | null
  paidDate: string
  createdAt: string
  member: {
    id: number
    farmerName: string
    memberCode: string
    phoneNumber: string | null
  }
}

interface FeesResponse {
  data: MembershipFee[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface FeeSummary {
  totalCollected: number
  thisMonth: number
  thisYear: number
  totalRecords: number
}

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface FeeForm {
  memberId: string
  amount: string
  description: string
}

const initialForm: FeeForm = { memberId: "", amount: "", description: "" }
const PAGE_SIZE = 10

export default function MembershipFeesPage() {
  const [fees, setFees] = useState<MembershipFee[]>([])
  const [summary, setSummary] = useState<FeeSummary>({
    totalCollected: 0,
    thisMonth: 0,
    thisYear: 0,
    totalRecords: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form, setForm] = useState<FeeForm>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)

  const fetchFees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/membership-fees?${params}`)
      if (res.ok) {
        const data: FeesResponse = await res.json()
        setFees(data.data)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch membership fees:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/membership-fees/summary")
      if (res.ok) {
        const data: FeeSummary = await res.json()
        setSummary(data)
      }
    } catch { /* empty */ }
  }, [])

  useEffect(() => { fetchFees() }, [fetchFees])
  useEffect(() => { fetchSummary() }, [fetchSummary])
  useEffect(() => { setPage(1) }, [search])

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) { setMemberOptions([]); return }
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&pageSize=10`)
      if (res.ok) {
        const data = await res.json()
        setMemberOptions(data.data || [])
      }
    } catch { /* empty */ }
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
    if (errors.memberId) setErrors((p) => ({ ...p, memberId: "" }))
  }

  const handleChange = (field: keyof FeeForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.memberId) newErrors.memberId = "Select a member"
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) newErrors.amount = "Enter a valid amount"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/membership-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: parseInt(form.memberId),
          amount: parseFloat(form.amount),
          description: form.description.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to record fee")
      }
      setCreateModalOpen(false)
      setForm(initialForm)
      setMemberSearch("")
      fetchFees()
      fetchSummary()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "member",
      header: "Member",
      render: (item: Row) => {
        const fee = item as unknown as MembershipFee
        return (
          <div>
            <p className="font-medium text-white/90">{fee.member.farmerName}</p>
            <p className="text-xs text-white/40">{fee.member.memberCode}</p>
          </div>
        )
      },
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: Row) => (
        <span className="font-semibold text-white/90">{formatUGX(item.amount as number)}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (item: Row) => (
        <span className="text-white/50 text-sm">{(item.description as string) || "—"}</span>
      ),
    },
    {
      key: "paidDate",
      header: "Date",
      render: (item: Row) => (
        <span className="text-white/50 text-sm">{formatDate(item.paidDate as string)}</span>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0e1a] -m-6 p-6 relative">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Membership Fees"
          subtitle={`${total} total records`}
          actions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm(initialForm); setMemberSearch(""); setCreateModalOpen(true) }}>
              Record Fee
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Collected"
            value={formatUGX(summary.totalCollected)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            label="This Month"
            value={formatUGX(summary.thisMonth)}
            icon={<CalendarDays className="w-5 h-5" />}
          />
          <MetricCard
            label="This Year"
            value={formatUGX(summary.thisYear)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            label="Total Records"
            value={summary.totalRecords}
            icon={<CreditCard className="w-5 h-5" />}
          />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search by member name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={fees as unknown as Row[]}
            emptyMessage={loading ? "Loading fees..." : "No membership fees found"}
            emptyIcon={!loading ? <CreditCard className="w-12 h-12 mb-3 text-white/20" /> : undefined}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <p className="text-sm text-white/40">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} icon={<ChevronLeft className="w-4 h-4" />}>
                  Prev
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Record Fee Modal */}
        <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Record Membership Fee" size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}

            <div className="relative">
              <Input
                label="Member *"
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setForm((p) => ({ ...p, memberId: "" })); setMemberDropdownOpen(true) }}
                onFocus={() => setMemberDropdownOpen(true)}
                placeholder="Search member by name or code..."
                error={errors.memberId}
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
                      <p className="text-xs text-gray-500">{member.memberCode} • {member.phoneNumber || "No phone"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              label="Amount (UGX) *"
              type="number"
              value={form.amount}
              onChange={handleChange("amount")}
              error={errors.amount}
              placeholder="0"
              min="1"
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={form.description}
                onChange={handleChange("description")}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Record Fee</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}
