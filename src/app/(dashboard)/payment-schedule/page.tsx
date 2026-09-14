"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Calendar, ChevronDown, Landmark, TrendingUp,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import { formatUGX, formatDate } from "@/lib/utils"

interface LoanOption {
  id: number
  loanCode: string
  principalAmount: number
  currentBalance: number
  loanStatus: string | null
  disbursementDate: string
  dueDate: string | null
  member: {
    id: number
    farmerName: string
    memberCode: string
  }
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
  fine: number
  status: string | null
}

interface LoanDetail {
  id: number
  loanCode: string
  principalAmount: number
  interestRate: number
  currentBalance: number
  loanStatus: string | null
  disbursementDate: string
  dueDate: string | null
  repaymentSchedules: ScheduleItem[]
  member: {
    id: number
    farmerName: string
    memberCode: string
  }
}

export default function PaymentSchedulePage() {
  const [loans, setLoans] = useState<LoanOption[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState("")
  const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingLoans, setLoadingLoans] = useState(true)

  const [search, setSearch] = useState("")
  const [loanDropdownOpen, setLoanDropdownOpen] = useState(false)

  const fetchLoans = useCallback(async () => {
    setLoadingLoans(true)
    try {
      const params = new URLSearchParams({ pageSize: "100" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/loans?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLoans(data.data || [])
      }
    } catch (err) {
      console.error("Failed to fetch loans:", err)
    } finally {
      setLoadingLoans(false)
    }
  }, [search])

  useEffect(() => { fetchLoans() }, [fetchLoans])

  const fetchLoanDetail = useCallback(async (loanId: string) => {
    if (!loanId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/loans/${loanId}`)
      if (res.ok) {
        const data: LoanDetail = await res.json()
        setLoanDetail(data)
      }
    } catch (err) {
      console.error("Failed to fetch loan detail:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedLoanId) fetchLoanDetail(selectedLoanId)
    else setLoanDetail(null)
  }, [selectedLoanId, fetchLoanDetail])

  const schedules = loanDetail?.repaymentSchedules || []
  const totalScheduled = schedules.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalPaid = schedules.reduce((sum, s) => sum + s.amountPaid, 0)
  const totalFines = schedules.reduce((sum, s) => sum + (s.fine || 0), 0)
  const paidCount = schedules.filter((s) => s.status === "Paid").length
  const progress = totalScheduled > 0 ? (totalPaid / totalScheduled) * 100 : 0

  return (
    <div className="min-h-screen bg-[#0a0e1a] -m-6 p-6 relative">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Payment Schedule"
          subtitle="View loan repayment schedules"
        />

        {/* Loan Selector */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5">
          <label className="block text-sm font-medium text-white/60 mb-2">Select a Loan</label>
          <div className="relative">
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">— Select a loan —</option>
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id} className="bg-gray-900">
                  {loan.loanCode} — {loan.member.farmerName} — {formatUGX(loan.principalAmount)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Loan Summary */}
        {loanDetail && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-b from-blue-500/20 to-blue-600/5 border border-blue-500/20 rounded-2xl p-4">
              <Landmark className="w-5 h-5 text-white/50 mb-3" />
              <p className="text-xs text-white/40 mb-1">Principal Amount</p>
              <p className="text-sm font-bold text-white">{formatUGX(loanDetail.principalAmount)}</p>
            </div>
            <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/5 border border-amber-500/20 rounded-2xl p-4">
              <TrendingUp className="w-5 h-5 text-white/50 mb-3" />
              <p className="text-xs text-white/40 mb-1">Outstanding Balance</p>
              <p className="text-sm font-bold text-white">{formatUGX(loanDetail.currentBalance)}</p>
            </div>
            <div className="bg-gradient-to-b from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-4">
              <Calendar className="w-5 h-5 text-white/50 mb-3" />
              <p className="text-xs text-white/40 mb-1">Installments Paid</p>
              <p className="text-sm font-bold text-white">{paidCount} / {schedules.length}</p>
            </div>
            <div className="bg-gradient-to-b from-red-500/20 to-red-600/5 border border-red-500/20 rounded-2xl p-4">
              <Calendar className="w-5 h-5 text-white/50 mb-3" />
              <p className="text-xs text-white/40 mb-1">Total Fines</p>
              <p className="text-sm font-bold text-white">{formatUGX(totalFines)}</p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {loanDetail && (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Repayment Progress</h3>
              <span className="text-sm font-bold text-[var(--color-gold)]">{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-gold)] transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-white/40">
              <span>Paid: {formatUGX(totalPaid)}</span>
              <span>Scheduled: {formatUGX(totalScheduled)}</span>
            </div>
          </div>
        )}

        {/* Schedule Table */}
        {loanDetail && schedules.length > 0 && (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">
                Repayment Schedule — {loanDetail.loanCode}
                <span className="text-white/40 font-normal ml-2">({loanDetail.member.farmerName})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase">Principal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase">Interest</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase">Fine</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/40 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white/70">{s.installmentNo}</td>
                      <td className="px-4 py-3 text-white/70">{formatDate(s.dueDate)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{formatUGX(s.principalAmount)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{formatUGX(s.interestAmount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-white/90">{formatUGX(s.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatUGX(s.amountPaid)}</td>
                      <td className="px-4 py-3 text-right">
                        {(s.fine || 0) > 0 ? (
                          <span className="text-red-400">{formatUGX(s.fine)}</span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={
                          s.status === "Paid" ? "success" :
                          s.status === "Overdue" ? "danger" :
                          "warning"
                        }>
                          {s.status || "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08]">
                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-white/40 uppercase">Totals</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-white/40">{formatUGX(schedules.reduce((s, x) => s + x.interestAmount, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-white/90">{formatUGX(totalScheduled)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatUGX(totalPaid)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-400">{formatUGX(totalFines)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedLoanId && !loadingLoans && (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-16 text-center">
            <Calendar className="w-16 h-16 mx-auto text-white/10 mb-4" />
            <p className="text-white/30 text-sm">Select a loan above to view its repayment schedule</p>
          </div>
        )}

        {loading && (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-16 text-center">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/40 text-sm">Loading repayment schedule...</p>
          </div>
        )}
      </div>
    </div>
  )
}
