"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react"
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
}

interface PreviewRow extends ImportRow {
  problems: string[]
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

const TEMPLATE_HEADERS = [
  "Member Code",
  "Amount",
  "Start Date",
  "Term (months)",
  "Paid So Far",
  "Rate %",
  "Purpose",
  "File Ref",
]

/** Header spellings staff use, normalised to lowercase letters only. */
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  membercode: "memberCode",
  member: "memberCode",
  code: "memberCode",
  memberno: "memberCode",
  membernumber: "memberCode",
  amount: "principalAmount",
  loanamount: "principalAmount",
  principal: "principalAmount",
  principalamount: "principalAmount",
  startdate: "startDate",
  date: "startDate",
  disbursementdate: "startDate",
  issued: "startDate",
  term: "termMonths",
  months: "termMonths",
  termmonths: "termMonths",
  duration: "termMonths",
  period: "termMonths",
  loanterm: "termMonths",
  paidsofar: "amountPaid",
  paid: "amountPaid",
  amountpaid: "amountPaid",
  totalpaid: "amountPaid",
  repaid: "amountPaid",
  rate: "interestRate",
  interestrate: "interestRate",
  purpose: "purpose",
  loanpurpose: "purpose",
  fileref: "fileRef",
  ref: "fileRef",
  reference: "fileRef",
  filenumber: "fileRef",
  file: "fileRef",
}

/** The eight columns when the file has no header row. */
const POSITIONAL: (keyof ImportRow)[] = [
  "memberCode",
  "principalAmount",
  "startDate",
  "termMonths",
  "amountPaid",
  "interestRate",
  "purpose",
  "fileRef",
]

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Splits one line on commas, tabs or semicolons, honouring "quoted cells". */
function splitLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === "," || ch === "\t" || ch === ";") {
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function looksLikeDate(value: string) {
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(value) || /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(value)
}

function parseCsv(text: string): PreviewRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))

  if (lines.length === 0) return []

  const first = splitLine(lines[0]).map(normaliseHeader)
  const hasHeader = first.some((cell) => cell in HEADER_ALIASES) && lines.length > 1
  const mapping = hasHeader ? first.map((cell) => HEADER_ALIASES[cell]) : POSITIONAL
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = splitLine(line)
    const row = emptyRow()
    mapping.forEach((field, index) => {
      if (field && cells[index] !== undefined) {
        row[field] = cells[index]
      }
    })

    const problems: string[] = []
    if (!row.memberCode) problems.push("member code missing")
    if (!row.principalAmount || !(Number(row.principalAmount.replace(/[^\d.-]/g, "")) > 0)) {
      problems.push("amount missing or zero")
    }
    if (!row.startDate || !looksLikeDate(row.startDate)) problems.push("start date missing")
    if (!row.termMonths || !(Number(row.termMonths) > 0)) problems.push("term missing or zero")
    if (row.amountPaid && Number(row.amountPaid.replace(/[^\d.-]/g, "")) < 0) {
      problems.push("paid so far is negative")
    }

    return { ...row, problems }
  })
}

function downloadTemplate() {
  const example = [
    TEMPLATE_HEADERS.join(","),
    "KAFS-004,1000000,15/01/2026,6,350000,2.5,Season farming,FILE-0142",
    "KAFS-010,500000,01/02/2026,3,0,2.5,Emergency,FILE-0143",
  ].join("\n")
  const blob = new Blob([example], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "existing-loans-template.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

interface Props {
  open: boolean
  onClose: () => void
  /** Called after at least one loan was created, so the caller can refresh. */
  onImported: () => void
}

type Tab = "csv" | "single"

export default function RegisterExistingLoansModal({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>("csv")

  // Spreadsheet mode
  const [csvText, setCsvText] = useState("")
  const [batchRef, setBatchRef] = useState("")
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [results, setResults] = useState<RowResult[] | null>(null)

  // Single-loan mode
  const [form, setForm] = useState<ImportRow>(emptyRow)
  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTab("csv")
    setCsvText("")
    setBatchRef("")
    setPreview(null)
    setResults(null)
    setForm(emptyRow())
    setMemberSearch("")
    setMemberOptions([])
    setDropdownOpen(false)
    setSubmitting(false)
    setProgress("")
    setError("")
  }, [open])

  // Member lookup for the single-loan form.
  useEffect(() => {
    if (tab !== "single" || memberSearch.trim().length < 2) {
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
        const list: MemberOption[] = (data.data ?? data.members ?? []).map(
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
  }, [memberSearch, tab])

  const previewOk = preview?.filter((row) => row.problems.length === 0).length ?? 0
  const previewBad = preview?.length ? preview.length - previewOk : 0

  const importedCount = results?.filter((r) => r.status === "imported").length ?? 0
  const skippedCount = results?.filter((r) => r.status === "skipped").length ?? 0
  const failedResults = results?.filter((r) => r.status !== "imported") ?? []

  // Live maths for the single-loan form.
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

  async function postRows(rows: ImportRow[], source: string): Promise<RowResult[]> {
    const collected: RowResult[] = []
    const CHUNK = 25
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      setProgress(`Importing ${i + 1}–${i + chunk.length} of ${rows.length}…`)
      const res = await fetch("/api/loans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chunk, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "The import could not be completed")
      }
      const offset = i
      collected.push(
        ...(data.results ?? []).map((r: RowResult) => ({ ...r, row: r.row + offset }))
      )
    }
    return collected
  }

  async function handleCsvImport() {
    if (!preview || preview.length === 0) return
    // Strip the client-side check column — the server validates everything again.
    const rows: ImportRow[] = preview.map((row) => ({
      memberCode: row.memberCode,
      principalAmount: row.principalAmount,
      startDate: row.startDate,
      termMonths: row.termMonths,
      amountPaid: row.amountPaid,
      interestRate: row.interestRate,
      purpose: row.purpose,
      fileRef: row.fileRef,
    }))
    setError("")
    setResults(null)
    setSubmitting(true)
    try {
      const outcome = await postRows(rows, batchRef.trim())
      setResults(outcome)
      if (outcome.some((r) => r.status === "imported")) onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setSubmitting(false)
      setProgress("")
    }
  }

  async function handleSingleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setResults(null)
    setSubmitting(true)
    try {
      const outcome = await postRows([form], form.fileRef.trim())
      setResults(outcome)
      if (outcome.some((r) => r.status === "imported")) {
        onImported()
        setForm(emptyRow())
        setMemberSearch("")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register the loan")
    } finally {
      setSubmitting(false)
      setProgress("")
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register Existing Loans" size="xl">
      <div className="space-y-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <p className="font-medium">Bringing the paper files online</p>
          <p className="mt-1">
            Enter the loan amount, the date it was given, the term in months and the total collected
            so far. Outstanding balance, interest and <strong>time remaining</strong> are worked out
            for you. Nothing is sent to the member by SMS.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={tab === "csv" ? "primary" : "outline"}
            size="sm"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={() => setTab("csv")}
            type="button"
          >
            Spreadsheet (many loans)
          </Button>
          <Button
            variant={tab === "single" ? "primary" : "outline"}
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => setTab("single")}
            type="button"
          >
            One loan at a time
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {tab === "csv" && !preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                One loan per line. Columns:{" "}
                <span className="font-mono text-xs">{TEMPLATE_HEADERS.join(" · ")}</span>
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} type="button">
                Download template
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="grow">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Choose a CSV file
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => setCsvText(String(reader.result ?? ""))
                    reader.readAsText(file)
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-400 dark:file:bg-gray-800 dark:file:text-gray-300"
                />
              </div>
              <Input
                label="Batch file reference (optional)"
                value={batchRef}
                onChange={(e) => setBatchRef(e.target.value)}
                placeholder="e.g. FILE-0142"
                className="w-56"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                …or paste the rows straight from Excel
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                placeholder={"KAFS-004,1000000,15/01/2026,6,350000\nKAFS-010,500000,01/02/2026,3,0"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>

            <Button
              onClick={() => {
                setError("")
                setPreview(parseCsv(csvText))
              }}
              disabled={csvText.trim().length === 0}
              type="button"
            >
              Preview rows
            </Button>
          </div>
        )}

        {tab === "csv" && preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {preview.length} rows · <span className="text-emerald-600">{previewOk} ready</span>
                {previewBad > 0 && (
                  <>
                    {" · "}
                    <span className="text-red-600">{previewBad} need fixing</span>
                  </>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreview(null)
                  setResults(null)
                }}
                type="button"
              >
                Change file
              </Button>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2 text-right">Months</th>
                    <th className="px-3 py-2 text-right">Paid so far</th>
                    <th className="px-3 py-2">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.map((row, index) => (
                    <tr
                      key={index}
                      className={row.problems.length ? "bg-red-50 dark:bg-red-900/10" : ""}
                    >
                      <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.memberCode || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.principalAmount || "—"}</td>
                      <td className="px-3 py-2">{row.startDate || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.termMonths || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.amountPaid || "0"}</td>
                      <td className="px-3 py-2">
                        {row.problems.length ? (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {row.problems.join(", ")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setPreview(null)}
                disabled={submitting}
                type="button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCsvImport}
                loading={submitting}
                disabled={previewOk === 0}
                icon={<Download className="w-4 h-4" />}
                type="button"
              >
                Import {previewOk} loan{previewOk === 1 ? "" : "s"}
              </Button>
            </div>
            {progress && <p className="text-sm text-gray-500">{progress}</p>}
          </div>
        )}

        {tab === "single" && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
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
                  repayments come in.
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
        )}

        {results && results.length > 0 && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-emerald-600">{importedCount} imported</span>
              {skippedCount > 0 && <span className="text-amber-600">{skippedCount} skipped</span>}
              {failedResults.length > 0 && (
                <span className="text-red-600">{failedResults.length} not imported</span>
              )}
            </div>
            {failedResults.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                {failedResults.map((r) => (
                  <li key={r.row} className="text-red-600 dark:text-red-400">
                    Row {r.row} ({r.memberCode || "no code"}): {r.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResults(null)
                  setPreview(null)
                }}
                type="button"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
