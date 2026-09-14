"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Plus, ArrowUpRight, CheckCircle, XCircle, Banknote,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { formatUGX, formatDate } from "@/lib/utils"

interface LoanAdvance {
  id: number
  advanceCode: string
  amount: number
  reason: string | null
  status: string | null
  createdAt: string
  loan: {
    id: number
    loanCode: string
    principalAmount: number
    currentBalance: number
  }
  member: {
    id: number
    farmerName: string
    memberCode: string
    phoneNumber: string | null
  }
}

interface LoanAdvancesResponse {
  data: LoanAdvance[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface LoanOption {
  id: number
  loanCode: string
  principalAmount: number
  currentBalance: number
  loanStatus: string | null
}

interface AdvanceForm {
  memberId: string
  loanId: string
  amount: string
  reason: string
}

const initialForm: AdvanceForm = { memberId: "", loanId: "", amount: "", reason: "" }
const PAGE_SIZE = 10

export default function LoanAdvancesPage() {
  const [advances, setAdvances] = useState<LoanAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form, setForm] = useState<AdvanceForm>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([])

  const fetchAdvances = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/loan-advances?${params}`)
      if (res.ok) {
        const data: LoanAdvancesResponse = await res.json()
        setAdvances(data.data)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch loan advances:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchAdvances() }, [fetchAdvances])
  useEffect(() => { setPage(1) }, [search, statusFilter])

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

  const handleMemberSelect = async (member: MemberOption) => {
    setForm((prev) => ({ ...prev, memberId: String(member.id), loanId: "" }))
    setMemberSearch(`${member.memberCode} - ${member.farmerName}`)
    setMemberDropdownOpen(false)
    setMemberOptions([])
    if (errors.memberId) setErrors((p) => ({ ...p, memberId: "" }))

    try {
      const res = await fetch(`/api/loans?search=${member.memberCode}&pageSize=20`)
      if (res.ok) {
        const data = await res.json()
        const activeLoans = (data.data || []).filter((l: LoanOption) => l.loanStatus === "Active" || l.loanStatus === "Disbursed")
        setLoanOptions(activeLoans)
      }
    } catch { /* empty */ }
  }

  const handleChange = (field: keyof AdvanceForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.memberId) newErrors.memberId = "Select a member"
    if (!form.loanId) newErrors.loanId = "Select an active loan"
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
      const res = await fetch("/api/loan-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: parseInt(form.loanId),
          amount: parseFloat(form.amount),
          reason: form.reason.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create advance")
      }
      setCreateModalOpen(false)
      setForm(initialForm)
      setMemberSearch("")
      setLoanOptions([])
      fetchAdvances()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (advanceId: number, action: "approve" | "disburse" | "reject") => {
    try {
      const res = await fetch(`/api/loan-advances/${advanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || `Failed to ${action} advance`)
        return
      }
      fetchAdvances()
    } catch {
      alert(`Failed to ${action} advance`)
    }
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "advanceCode",
      header: "Code",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">{item.advanceCode as string}</span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Row) => {
        const advance = item as unknown as LoanAdvance
        return (
          <div>
            <p className="font-medium text-white/90">{advance.member.farmerName}</p>
            <p className="text-xs text-white/40">{advance.member.memberCode}</p>
          </div>
        )
      },
    },
    {
      key: "loan",
      header: "Loan",
      render: (item: Row) => {
        const advance = item as unknown as LoanAdvance
        return (
          <div>
            <p className="font-mono text-xs text-white/60">{advance.loan.loanCode}</p>
            <p className="text-xs text-white/40">Balance: {formatUGX(advance.loan.currentBalance)}</p>
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
      key: "status",
      header: "Status",
      render: (item: Row) => {
        const status = (item.status as string) || "Pending"
        let variant: "success" | "info" | "danger" | "warning" | "default" = "warning"
        if (status === "Approved" || status === "Disbursed") variant = "success"
        else if (status === "Rejected") variant = "danger"
        else if (status === "Pending") variant = "warning"
        return <Badge variant={variant}>{status}</Badge>
      },
    },
    {
      key: "createdAt",
      header: "Date",
      render: (item: Row) => (
        <span className="text-white/50 text-sm">{formatDate(item.createdAt as string)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item: Row) => {
        const advance = item as unknown as LoanAdvance
        const status = advance.status || "Pending"
        return (
          <div className="flex items-center justify-end gap-1">
            {status === "Pending" && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(advance.id, "approve") }}
                  className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  title="Approve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(advance.id, "reject") }}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Reject"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            {status === "Approved" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(advance.id, "disburse") }}
                className="p-1.5 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                title="Disburse"
              >
                <Banknote className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0e1a] -m-6 p-6 relative">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Loan Advances"
          subtitle={`${total} total advances`}
          actions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setForm(initialForm); setMemberSearch(""); setLoanOptions([]); setCreateModalOpen(true) }}>
              New Advance
            </Button>
          }
        />

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl">
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by code, member name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-colors"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "", label: "All Status" },
                  { value: "Pending", label: "Pending" },
                  { value: "Approved", label: "Approved" },
                  { value: "Disbursed", label: "Disbursed" },
                  { value: "Rejected", label: "Rejected" },
                ]}
                className="max-w-[160px]"
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={advances as unknown as Row[]}
            emptyMessage={loading ? "Loading advances..." : "No loan advances found"}
            emptyIcon={!loading ? <ArrowUpRight className="w-12 h-12 mb-3 text-white/20" /> : undefined}
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

        {/* Create Advance Modal */}
        <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Loan Advance" size="lg">
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

            <Select
              label="Active Loan *"
              value={form.loanId}
              onChange={handleChange("loanId")}
              options={[
                { value: "", label: loanOptions.length ? "Select loan..." : "Search member first" },
                ...loanOptions.map((l) => ({
                  value: String(l.id),
                  label: `${l.loanCode} — Balance: ${formatUGX(l.currentBalance)}`,
                })),
              ]}
              error={errors.loanId}
              disabled={!form.memberId}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Advance Amount (UGX) *"
                type="number"
                value={form.amount}
                onChange={handleChange("amount")}
                error={errors.amount}
                placeholder="0"
                min="1"
              />
              <Input
                label="Reason"
                value={form.reason}
                onChange={handleChange("reason")}
                placeholder="Reason for advance..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Create Advance</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}
