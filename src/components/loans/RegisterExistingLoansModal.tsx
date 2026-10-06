"use client"

import { useEffect, useState } from "react"
import Modal from "@/components/ui/Modal"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { formatDate, formatUGX } from "@/lib/utils"

/** One loan exactly as POST /api/loans/import expects it. */
interface ImportRow {
  memberCode: string
  principalAmount: string
  startDate: string
  termMonths: string
  amountPaid: string
  interestRate: string
  purpose: string
  fileRef: string
}

interface RowResult {
  row: number
  memberCode: string
  status: "imported" | "skipped" | "error"
  loanCode?: string
  error?: string
  finishesOn?: string
  totalInstallments?: number
}

interface MemberOption {
  id: number
  farmerName: string
  memberCode: string
}

const emptyRow = (): ImportRow => ({
  memberCode: "",
  principalAmount: "",
  startDate: "",
  termMonths: "",
  amountPaid: "",
  interestRate: "2.5",
  purpose: "",
  fileRef: "",
})

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a loan was created, so the caller can refresh. */
  onImported: () => void
}

export default function RegisterExistingLoansModal({ open, onClose, onImported }: Props) {
  const [form, setForm] = useState<ImportRow>(emptyRow)
  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<RowResult | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyRow())
    setMemberSearch("")
    setMemberOptions([])
    setDropdownOpen(false)
    setSubmitting(false)
    setError("")
    setResult(null)
  }, [open])

  // Member lookup for the form.
  useEffect(() => {
    if (memberSearch.trim().length < 2) {
      setMemberOptions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/members?search=${encodeURIComponent(memberSearch.trim())}&pageSize=8`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const data = await res.json()
        const list: MemberOption[] = (data.data ?? []).map(
          (m: { id: number; farmerName: string; memberCode: string }) => ({
            id: m.id,
            farmerName: m.farmerName,
            memberCode: m.memberCode,
          })
        )
        setMemberOptions(list)
      } catch {
        // Aborted or offline — leave the dropdown empty.
      }
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [memberSearch])

  // Live maths for the form.
  const principal = Number(form.principalAmount) || 0
  const rate = Number(form.interestRate) || 0
  const term = Number(form.termMonths) || 0
  const paidSoFar = Number(form.amountPaid) || 0
  const totalInterest = principal * (rate / 100) * term
  const totalPayable = principal + totalInterest
  const monthlyInstallment = term > 0 ? totalPayable / term : 0
  const instalmentsCovered =
    monthlyInstallment > 0 ? Math.min(term, Math.floor(paidSoFar / monthlyInstallment)) : 0
  const startDateObj = form.startDate ? new Date(form.startDate) : null
  const finishesOn = startDateObj && term > 0 ? addMonths(startDateObj, term) : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setResult(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/loans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [form],
          source: form.fileRef.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Could not register the loan")
      }
      const outcome: RowResult | undefined = (data.results ?? [])[0]
      if (outcome?.status === "imported") {
        setResult(outcome)
        onImported()
        setForm(emptyRow())
        setMemberSearch("")
        setMemberOptions([])
      } else {
        setError(outcome?.error || "Could not register the loan")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register the loan")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register Existing Loan" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {result?.status === "imported" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            <p className="font-medium">
              Loan {result.loanCode} registered
            </p>
            <p className="mt-1">
              {result.totalInstallments} instalments · finishes{" "}
              {result.finishesOn ? formatDate(result.finishesOn) : "—"}
            </p>
          </div>
        )}

        <div className="relative">
          <Input
            label="Member *"
            value={memberSearch}
            onChange={(e) => {
              setMemberSearch(e.target.value)
              setDropdownOpen(true)
              setForm((prev) => ({ ...prev, memberCode: "" }))
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search by name or member code..."
          />
          {dropdownOpen && memberOptions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              {memberOptions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, memberCode: member.memberCode }))
                    setMemberSearch(`${member.farmerName} (${member.memberCode})`)
                    setDropdownOpen(false)
                  }}
                  className="block w-full border-b border-gray-100 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <p className="text-sm font-medium">{member.farmerName}</p>
                  <p className="text-xs text-gray-500">{member.memberCode}</p>
                </button>
              ))}
            </div>
          )}
          {form.memberCode && (
            <p className="mt-1 text-xs text-emerald-600">Selected: {form.memberCode}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Loan Amount (UGX) *"
            type="number"
            min="1"
            value={form.principalAmount}
            onChange={(e) => setForm((prev) => ({ ...prev, principalAmount: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Start Date *"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
          />
          <Input
            label="Term (months) *"
            type="number"
            min="1"
            max="120"
            value={form.termMonths}
            onChange={(e) => setForm((prev) => ({ ...prev, termMonths: e.target.value }))}
            placeholder="6"
          />
          <Input
            label="Total Paid So Far (UGX)"
            type="number"
            min="0"
            value={form.amountPaid}
            onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Interest Rate (% per month)"
            type="number"
            step="0.1"
            min="0"
            value={form.interestRate}
            onChange={(e) => setForm((prev) => ({ ...prev, interestRate: e.target.value }))}
          />
          <Input
            label="File Reference"
            value={form.fileRef}
            onChange={(e) => setForm((prev) => ({ ...prev, fileRef: e.target.value }))}
            placeholder="FILE-0142"
          />
        </div>

        <Input
          label="Loan Purpose"
          value={form.purpose}
          onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
          placeholder="e.g. Season farming"
        />

        {principal > 0 && term > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              What the system will book
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-gray-500">Monthly instalment</p>
                <p className="font-semibold">{formatUGX(monthlyInstallment)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total payable</p>
                <p className="font-semibold">{formatUGX(totalPayable)}</p>
              </div>
              <div>
                <p className="text-gray-500">Finishes on</p>
                <p className="font-semibold">{finishesOn ? formatDate(finishesOn) : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Time remaining</p>
                <p className="font-semibold">
                  {term - instalmentsCovered} of {term} instalments
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Interest is booked flat for the term, then charged on the reducing balance as
              repayments come in. Nothing is sent to the member by SMS.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={submitting}
            disabled={!form.memberCode || principal <= 0 || term <= 0 || !form.startDate}
          >
            Register loan
          </Button>
        </div>
      </form>
    </Modal>
  )
}
