"use client"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, Plus, Eye, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card } from "@/components/ui/Card"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Modal from "@/components/ui/Modal"
import { formatUGX, formatDate } from "@/lib/utils"

interface JournalLine {
  id: number
  accountId: number
  debit: number
  credit: number
  narration: string | null
  account: { accountCode: string; accountName: string }
}

interface JournalEntry {
  id: number
  entryCode: string
  entryDate: string
  description: string
  referenceNumber: string | null
  totalDebit: number
  totalCredit: number
  status: string | null
  createdAt: string
  lines: JournalLine[]
}

interface ChartAccount {
  id: number
  accountCode: string
  accountName: string
}

interface LineForm {
  accountId: string
  debit: string
  credit: string
  narration: string
}

const emptyLine = (): LineForm => ({ accountId: "", debit: "", credit: "", narration: "" })

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<ChartAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null)
  const [saving, setSaving] = useState(false)

  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formDesc, setFormDesc] = useState("")
  const [formRef, setFormRef] = useState("")
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (search) params.set("search", search)
      const res = await fetch(`/api/journal-entries?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/chart-of-accounts?pageSize=200")
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
    fetchAccounts()
  }, [fetchEntries, fetchAccounts])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const updateLine = (index: number, field: keyof LineForm, value: string) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === "debit" && value) updated[index].credit = ""
      if (field === "credit" && value) updated[index].debit = ""
      return updated
    })
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (index: number) => {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    const e: Record<string, string> = {}
    if (!formDate) e.date = "Date is required"
    if (!formDesc.trim()) e.description = "Description is required"

    if (!isBalanced) {
      e.lines = "Debits and credits must be equal"
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].accountId) {
        e[`line_${i}`] = "Account is required"
      }
    }

    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate: formDate,
          description: formDesc.trim(),
          referenceNumber: formRef.trim() || null,
          lines: lines
            .filter((l) => l.accountId)
            .map((l) => ({
              accountId: parseInt(l.accountId),
              debit: parseFloat(l.debit) || 0,
              credit: parseFloat(l.credit) || 0,
              narration: l.narration.trim() || null,
            })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormErrors({ general: data.error })
        return
      }

      setShowCreate(false)
      resetForm()
      fetchEntries()
    } catch (err) {
      setFormErrors({ general: "An error occurred" })
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormDate(new Date().toISOString().split("T")[0])
    setFormDesc("")
    setFormRef("")
    setLines([emptyLine(), emptyLine()])
    setFormErrors({})
  }

  const handleAction = async (id: number, action: "post" | "reverse") => {
    const label = action === "post" ? "post" : "reverse"
    if (!confirm(`Are you sure you want to ${label} this entry?`)) return

    try {
      const res = await fetch("/api/journal-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || `Failed to ${label}`)
        return
      }

      fetchEntries()
      if (showView && viewingEntry?.id === id) {
        const updated = await fetch(`/api/journal-entries?search=${viewingEntry.entryCode}`)
        if (updated.ok) {
          const d = await updated.json()
          if (d.data?.length) setViewingEntry(d.data[0])
        }
      }
    } catch (err) {
      alert(`Failed to ${label}`)
    }
  }

  const openView = (entry: JournalEntry) => {
    setViewingEntry(entry)
    setShowView(true)
  }

  const accountOptions = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.accountCode} - ${a.accountName}`,
  }))

  const entryColumns = [
    {
      key: "entryCode",
      header: "Entry #",
      render: (item: JournalEntry) => (
        <span className="font-mono font-semibold text-[var(--color-primary)]">{item.entryCode}</span>
      ),
    },
    {
      key: "entryDate",
      header: "Date",
      render: (item: JournalEntry) => formatDate(item.entryDate),
    },
    {
      key: "description",
      header: "Description",
      render: (item: JournalEntry) => (
        <span className="max-w-[200px] truncate block">{item.description}</span>
      ),
    },
    {
      key: "totalDebit",
      header: "Debit",
      render: (item: JournalEntry) => <span className="font-mono">{formatUGX(item.totalDebit)}</span>,
    },
    {
      key: "totalCredit",
      header: "Credit",
      render: (item: JournalEntry) => <span className="font-mono">{formatUGX(item.totalCredit)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: JournalEntry) => (
        <Badge variant={getStatusVariant(item.status || "")}>{item.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: JournalEntry) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openView(item) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {item.status === "Draft" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(item.id, "post") }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              title="Post"
            >
              <ArrowUpCircle className="w-4 h-4" />
            </button>
          )}
          {item.status === "Posted" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(item.id, "reverse") }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title="Reverse"
            >
              <ArrowDownCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        subtitle="Manage double-entry journal entries"
        actions={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => { resetForm(); setShowCreate(true) }}
          >
            New Entry
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "Draft", label: "Draft" },
                { value: "Posted", label: "Posted" },
                { value: "Reversed", label: "Reversed" },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table
          columns={entryColumns}
          data={entries as unknown as Record<string, unknown>[]}
          emptyMessage="No journal entries found"
          emptyIcon={<BookOpen className="w-12 h-12 mb-3 opacity-50" />}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Journal Entry"
        size="xl"
      >
        <div className="space-y-4">
          {formErrors.general && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{formErrors.general}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Entry Date *"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              error={formErrors.date}
            />
            <Input
              label="Description *"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              error={formErrors.description}
              placeholder="Enter description"
            />
            <Input
              label="Reference #"
              value={formRef}
              onChange={(e) => setFormRef(e.target.value)}
              placeholder="Optional reference"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Journal Lines
              </h4>
              <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />} onClick={addLine}>
                Add Line
              </Button>
            </div>

            {formErrors.lines && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{formErrors.lines}</p>
            )}

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-end gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={line.accountId}
                      onChange={(e) => updateLine(i, "accountId", e.target.value)}
                      options={[{ value: "", label: "Select account" }, ...accountOptions]}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="Debit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateLine(i, "debit", e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="Credit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateLine(i, "credit", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder="Narration"
                      value={line.narration}
                      onChange={(e) => updateLine(i, "narration", e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Total Debit: <strong className="font-mono text-gray-900 dark:text-white">{formatUGX(totalDebit)}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Total Credit: <strong className="font-mono text-gray-900 dark:text-white">{formatUGX(totalCredit)}</strong>
              </span>
              <span className={isBalanced ? "text-emerald-600" : "text-red-600"}>
                {isBalanced ? "Balanced" : "Not Balanced"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving} disabled={!isBalanced}>
              Create Entry
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        open={showView}
        onClose={() => setShowView(false)}
        title={`Journal Entry: ${viewingEntry?.entryCode || ""}`}
        size="lg"
      >
        {viewingEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(viewingEntry.entryDate)}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <p><Badge variant={getStatusVariant(viewingEntry.status || "")}>{viewingEntry.status}</Badge></p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Description:</span>
                <p className="font-medium text-gray-900 dark:text-white">{viewingEntry.description}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Reference:</span>
                <p className="font-medium text-gray-900 dark:text-white">{viewingEntry.referenceNumber || "—"}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Lines</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Account</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Debit</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Credit</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Narration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {viewingEntry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 px-3 text-gray-900 dark:text-white">
                          <span className="font-mono text-xs text-[var(--color-primary)]">{line.account.accountCode}</span>{" "}
                          {line.account.accountName}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                          {line.debit > 0 ? formatUGX(line.debit) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">
                          {line.credit > 0 ? formatUGX(line.credit) : "—"}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{line.narration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                      <td className="py-2 px-3 text-gray-900 dark:text-white">Total</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">{formatUGX(viewingEntry.totalDebit)}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-900 dark:text-white">{formatUGX(viewingEntry.totalCredit)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {viewingEntry.status === "Draft" && (
                <Button
                  icon={<ArrowUpCircle className="w-4 h-4" />}
                  onClick={() => { handleAction(viewingEntry.id, "post"); setShowView(false) }}
                >
                  Post Entry
                </Button>
              )}
              {viewingEntry.status === "Posted" && (
                <Button
                  variant="danger"
                  icon={<ArrowDownCircle className="w-4 h-4" />}
                  onClick={() => { handleAction(viewingEntry.id, "reverse"); setShowView(false) }}
                >
                  Reverse Entry
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowView(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
