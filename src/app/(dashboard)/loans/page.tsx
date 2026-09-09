"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Plus, ChevronDown, ChevronUp, DollarSign, AlertTriangle,
  Clock, BadgeCheck, Landmark, X, Banknote
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface LoanMember {
  id: number
  farmerName: string
  memberCode: string
  phoneNumber: string | null
}

interface NextDue {
  dueDate: string
  totalAmount: number
  installmentNo: number
}

interface Loan {
  id: number
  loanCode: string
  memberId: number
  principalAmount: number
  interestRate: number
  currentBalance: number
  loanPurpose: string | null
  loanStatus: string | null
  disbursementDate: string
  dueDate: string | null
  createdAt: string
  member: LoanMember
  nextDue: NextDue | null
  pendingFinesCount: number
  lastPayment: { amountPaid: number; paymentDate: string } | null
}

interface LoanSummary {
  totalDisbursed: number
  outstandingBalance: number
  totalLoans: number
  overdueCount: number
  pendingFinesTotal: number
}

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface ScheduleItem {
  id: number
  installmentNo: number
  dueDate: string
  principalAmount: number
  interestAmount: number
  totalAmount: number
  balance: number
  amountPaid: number
  status: string | null
}

interface LoanDetail extends Loan {
  repaymentSchedules: ScheduleItem[]
  repayments: Array<{
    id: number
    amountPaid: number
    finePaid: number
    balanceAfter: number
    paymentDate: string
    referenceNumber: string | null
  }>
  fines: Array<{
    id: number
    fineAmount: number
    reason: string | null
    status: string
  }>
}

interface DisburseForm {
  memberId: string
  principalAmount: string
  interestRate: string
  duration: string
  purpose: string
}

const initialDisburseForm: DisburseForm = {
  memberId: "",
  principalAmount: "",
  interestRate: "2.5",
  duration: "12",
  purpose: "",
}

const PAGE_SIZE = 10

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<LoanSummary>({
    totalDisbursed: 0,
    outstandingBalance: 0,
    totalLoans: 0,
    overdueCount: 0,
    pendingFinesTotal: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [disburseModalOpen, setDisburseModalOpen] = useState(false)
  const [disburseForm, setDisburseForm] = useState<DisburseForm>(initialDisburseForm)
  const [disburseErrors, setDisburseErrors] = useState<Partial<Record<keyof DisburseForm, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)

  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null)
  const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [repayModalOpen, setRepayModalOpen] = useState(false)
  const [repayLoanId, setRepayLoanId] = useState<number | null>(null)
  const [repayAmount, setRepayAmount] = useState("")
  const [repayFine, setRepayFine] = useState("")

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/loans?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLoans(data.data || [])
        setTotalPages(data.totalPages)
        setTotal(data.total)
        setSummary(data.summary || {
          totalDisbursed: 0,
          outstandingBalance: 0,
          totalLoans: 0,
          overdueCount: 0,
          pendingFinesTotal: 0,
        })
      }
    } catch (err) {
      console.error("Failed to fetch loans:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchLoans() }, [fetchLoans])
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

  const handleMemberSelect = (member: MemberOption) => {
    setDisburseForm((prev) => ({ ...prev, memberId: String(member.id) }))
    setMemberSearch(`${member.memberCode} - ${member.farmerName}`)
    setMemberDropdownOpen(false)
    setMemberOptions([])
    if (disburseErrors.memberId) setDisburseErrors((prev) => ({ ...prev, memberId: undefined }))
  }

  const handleDisburseChange = (field: keyof DisburseForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setDisburseForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (disburseErrors[field]) setDisburseErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validateDisburse = (): boolean => {
    const errors: Partial<Record<keyof DisburseForm, string>> = {}
    if (!disburseForm.memberId) errors.memberId = "Select a member"
    const amount = parseFloat(disburseForm.principalAmount)
    if (!disburseForm.principalAmount || isNaN(amount) || amount <= 0) {
      errors.principalAmount = "Enter a valid amount"
    }
    const rate = parseFloat(disburseForm.interestRate)
    if (isNaN(rate) || rate < 0) errors.interestRate = "Enter a valid interest rate"
    const dur = parseInt(disburseForm.duration)
    if (isNaN(dur) || dur <= 0) errors.duration = "Enter a valid duration"
    setDisburseErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateDisburse()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: parseInt(disburseForm.memberId),
          principalAmount: parseFloat(disburseForm.principalAmount),
          interestRate: parseFloat(disburseForm.interestRate),
          duration: parseInt(disburseForm.duration),
          purpose: disburseForm.purpose.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Disbursement failed")
      }
      setDisburseModalOpen(false)
      setDisburseForm(initialDisburseForm)
      setMemberSearch("")
      fetchLoans()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleExpand = async (loanId: number) => {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null)
      setLoanDetail(null)
      return
    }
    setExpandedLoanId(loanId)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/loans/${loanId}`)
      if (res.ok) {
        const data = await res.json()
        setLoanDetail(data)
      }
    } catch (err) {
      console.error("Failed to fetch loan detail:", err)
    } finally {
      setDetailLoading(false)
    }
  }

  const openRepayModal = (loanId: number) => {
    setRepayLoanId(loanId)
    setRepayAmount("")
    setRepayFine("")
    setRepayModalOpen(true)
  }

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayLoanId) return
    const amount = parseFloat(repayAmount)
    if (!amount || amount <= 0) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/loans/repayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: repayLoanId,
          amountPaid: amount,
          finePaid: parseFloat(repayFine) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Repayment failed")
      }
      setRepayModalOpen(false)
      fetchLoans()
      if (expandedLoanId === repayLoanId) {
        const detailRes = await fetch(`/api/loans/${repayLoanId}`)
        if (detailRes.ok) setLoanDetail(await detailRes.json())
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const principalAmount = parseFloat(disburseForm.principalAmount) || 0
  const interestRate = parseFloat(disburseForm.interestRate) || 2.5
  const duration = parseInt(disburseForm.duration) || 12
  const totalInterest = principalAmount * (interestRate / 100) * duration
  const totalPayable = principalAmount + totalInterest
  const monthlyInstallment = duration > 0 ? totalPayable / duration : 0

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "loanCode",
      header: "Loan Code",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">
          {item.loanCode as string}
        </span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Row) => {
        const loan = item as unknown as Loan
        return (
          <div>
            <p className="font-medium">{loan.member.farmerName}</p>
            <p className="text-xs text-gray-500">{loan.member.memberCode}</p>
          </div>
        )
      },
    },
    {
      key: "principalAmount",
      header: "Principal",
      className: "text-right",
      render: (item: Row) => (
        <span className="font-semibold">{formatUGX(item.principalAmount as number)}</span>
      ),
    },
    {
      key: "currentBalance",
      header: "Balance",
      className: "text-right",
      render: (item: Row) => {
        const balance = item.currentBalance as number
        return (
          <span className={balance > 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
            {formatUGX(balance)}
          </span>
        )
      },
    },
    {
      key: "loanStatus",
      header: "Status",
      render: (item: Row) => {
        const status = (item.loanStatus as string) || "Unknown"
        let variant: "success" | "info" | "danger" | "warning" | "default" = "default"
        if (status === "Active") variant = "success"
        else if (status === "Cleared") variant = "info"
        else if (status === "Overdue") variant = "danger"
        return <Badge variant={variant}>{status}</Badge>
      },
    },
    {
      key: "nextDue",
      header: "Next Due",
      render: (item: Row) => {
        const loan = item as unknown as Loan
        if (!loan.nextDue) return <span className="text-gray-400">—</span>
        return (
          <div>
            <p className="text-xs font-medium">{formatDate(loan.nextDue.dueDate)}</p>
            <p className="text-xs text-gray-500">Installment #{loan.nextDue.installmentNo}</p>
          </div>
        )
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item: Row) => {
        const loan = item as unknown as Loan
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openRepayModal(loan.id)
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              title="Record Repayment"
            >
              <Banknote className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(loan.id)
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              title="View Schedule"
            >
              {expandedLoanId === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle={`${total} total loans`}
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setDisburseModalOpen(true)}>
            Disburse Loan
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Disbursed"
          value={formatUGX(summary.totalDisbursed)}
          icon={<Landmark className="w-5 h-5" />}
        />
        <MetricCard
          label="Outstanding Balance"
          value={formatUGX(summary.outstandingBalance)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Active Loans"
          value={summary.totalLoans}
          icon={<BadgeCheck className="w-5 h-5" />}
        />
        <MetricCard
          label="Overdue"
          value={summary.overdueCount}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <MetricCard
          label="Pending Fines"
          value={formatUGX(summary.pendingFinesTotal)}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by loan code, member name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Status" },
                { value: "Active", label: "Active" },
                { value: "Cleared", label: "Cleared" },
                { value: "Overdue", label: "Overdue" },
                { value: "Defaulted", label: "Defaulted" },
              ]}
              className="max-w-[160px]"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={loans as unknown as Row[]}
          emptyMessage={loading ? "Loading loans..." : "No loans found"}
          emptyIcon={!loading ? <Landmark className="w-12 h-12 mb-3 opacity-50" /> : undefined}
        />

        {expandedLoanId && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            {detailLoading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading repayment schedule...</p>
            ) : loanDetail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Repayment Schedule — {loanDetail.loanCode}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => { setExpandedLoanId(null); setLoanDetail(null) }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Principal</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Interest</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {loanDetail.repaymentSchedules.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{s.installmentNo}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{formatDate(s.dueDate)}</td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatUGX(s.principalAmount)}</td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatUGX(s.interestAmount)}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatUGX(s.totalAmount)}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{formatUGX(s.amountPaid)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatUGX(s.balance)}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={s.status === "Paid" ? "success" : s.status === "Overdue" ? "danger" : "warning"}>
                              {s.status || "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {loanDetail.fines.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Fines</h4>
                    <div className="space-y-1">
                      {loanDetail.fines.map((f) => (
                        <div key={f.id} className="flex items-center justify-between text-sm p-2 rounded bg-red-50 dark:bg-red-900/20">
                          <span className="text-red-700 dark:text-red-400">{f.reason || "Late payment fine"}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{formatUGX(f.fineAmount)}</span>
                            <Badge variant={f.status === "Paid" ? "success" : "danger"}>{f.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Disburse Loan Modal */}
      <Modal
        open={disburseModalOpen}
        onClose={() => {
          setDisburseModalOpen(false)
          setDisburseForm(initialDisburseForm)
          setMemberSearch("")
          setSubmitError("")
        }}
        title="Disburse Loan"
        size="lg"
      >
        <form onSubmit={handleDisburseSubmit} className="space-y-4">
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
                setDisburseForm((prev) => ({ ...prev, memberId: "" }))
                setMemberDropdownOpen(true)
              }}
              onFocus={() => setMemberDropdownOpen(true)}
              placeholder="Search member by name or code..."
              error={disburseErrors.memberId}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Principal Amount (UGX) *"
              type="number"
              value={disburseForm.principalAmount}
              onChange={handleDisburseChange("principalAmount")}
              error={disburseErrors.principalAmount}
              placeholder="0"
              min="1"
            />
            <Input
              label="Interest Rate (%) *"
              type="number"
              value={disburseForm.interestRate}
              onChange={handleDisburseChange("interestRate")}
              error={disburseErrors.interestRate}
              step="0.1"
              min="0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Duration (months) *"
              type="number"
              value={disburseForm.duration}
              onChange={handleDisburseChange("duration")}
              error={disburseErrors.duration}
              min="1"
            />
            <Input
              label="Purpose"
              value={disburseForm.purpose}
              onChange={handleDisburseChange("purpose")}
              placeholder="Loan purpose..."
            />
          </div>

          {principalAmount > 0 && (
            <div className="p-4 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Principal</span>
                <span className="font-medium">{formatUGX(principalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Interest ({interestRate}% × {duration}mo)</span>
                <span className="font-medium">{formatUGX(totalInterest)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-[var(--color-primary)]/20 pt-2">
                <span>Total Payable</span>
                <span className="text-[var(--color-primary)]">{formatUGX(totalPayable)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Monthly Installment</span>
                <span className="font-semibold">{formatUGX(monthlyInstallment)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => setDisburseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>Disburse Loan</Button>
          </div>
        </form>
      </Modal>

      {/* Repayment Modal */}
      <Modal
        open={repayModalOpen}
        onClose={() => setRepayModalOpen(false)}
        title="Record Repayment"
        size="sm"
      >
        <form onSubmit={handleRepaySubmit} className="space-y-4">
          <Input
            label="Payment Amount (UGX) *"
            type="number"
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            placeholder="0"
            min="1"
          />
          <Input
            label="Fine Paid (UGX)"
            type="number"
            value={repayFine}
            onChange={(e) => setRepayFine(e.target.value)}
            placeholder="0"
            min="0"
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => setRepayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
