"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, ArrowDownCircle, ArrowUpCircle, Wallet, Filter, X, FileText } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDateTime } from "@/lib/utils"

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface Transaction {
  id: string
  type: string
  memberName: string
  memberCode: string
  description: string
  amount: number
  referenceNumber: string | null
  transactionDate: string
  recordedBy: string | null
}

interface TransactionSummary {
  totalInflows: number
  totalOutflows: number
  netAmount: number
  transactionCount: number
}

interface TransactionsResponse {
  transactions: Transaction[]
  summary: TransactionSummary
  displayedCount?: number
  hasMore?: boolean
  filtered?: boolean
  error?: string
}

function getTransactionBadgeVariant(type: string) {
  switch (type) {
    case "Deposit":
    case "Loan Repayment":
    case "Share Purchase":
      return "success" as const
    case "Withdrawal":
    case "Loan Disbursement":
    case "Expense":
      return "danger" as const
    default:
      return "info" as const
  }
}

function isInflow(type: string): boolean {
  return ["Deposit", "Loan Repayment", "Share Purchase"].includes(type)
}

const TRANSACTION_TYPES = [
  "Deposit",
  "Withdrawal",
  "Loan Disbursement",
  "Loan Repayment",
  "Share Purchase",
  "Expense",
]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary>({
    totalInflows: 0,
    totalOutflows: 0,
    netAmount: 0,
    transactionCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [displayedCount, setDisplayedCount] = useState(0)
  const [isFiltered, setIsFiltered] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<"Deposit" | "Withdrawal">("Deposit")
  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [narration, setNarration] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter) params.set("type", typeFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/transactions?${params}`)
      const data = (await res.json().catch(() => null)) as TransactionsResponse | null

      if (!res.ok || !data) {
        // Never let a failed request look like "there are no transactions".
        setTransactions([])
        setSummary({ totalInflows: 0, totalOutflows: 0, netAmount: 0, transactionCount: 0 })
        setLoadError(data?.error || `Failed to load transactions (HTTP ${res.status}).`)
        return
      }

      setTransactions(data.transactions || [])
      setSummary(
        data.summary || {
          totalInflows: 0,
          totalOutflows: 0,
          netAmount: 0,
          transactionCount: 0,
        }
      )
      setHasMore(Boolean(data.hasMore))
      setDisplayedCount(data.displayedCount ?? (data.transactions || []).length)
      setIsFiltered(Boolean(data.filtered))
    } catch (err) {
      console.error("Failed to fetch transactions:", err)
      setTransactions([])
      setSummary({ totalInflows: 0, totalOutflows: 0, netAmount: 0, transactionCount: 0 })
      setLoadError("Network error while loading transactions.")
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) { setMemberOptions([]); return }
    try {
      // includeSystem: the SACCO's bank accounts are hidden from member
      // listings but must stay selectable for deposits/withdrawals.
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&pageSize=10&includeSystem=true`)
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMemberOptions([])
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchMemberBalance = useCallback(async (memberId: number) => {
    try {
      const res = await fetch(`/api/savings/balance?memberId=${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setMemberBalance(data.balance ?? 0)
      }
    } catch {
      setMemberBalance(0)
    }
  }, [])

  const handleMemberSelect = (member: MemberOption) => {
    setSelectedMember(member)
    setMemberSearch(`${member.memberCode} - ${member.farmerName}`)
    setMemberOptions([])
    fetchMemberBalance(member.id)
  }

  const openModal = (type: "Deposit" | "Withdrawal") => {
    setModalType(type)
    setMemberSearch("")
    setSelectedMember(null)
    setMemberBalance(null)
    setAmount("")
    setNarration("")
    setSubmitError("")
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) { setSubmitError("Select a member"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setSubmitError("Enter a valid amount"); return }

    if (modalType === "Withdrawal" && memberBalance !== null && amt > memberBalance) {
      setSubmitError(`Insufficient balance. Available: UGX ${memberBalance.toLocaleString()}`)
      return
    }

    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.id,
          transactionType: modalType,
          amount: amt,
          narration: narration || `${modalType} from Transactions page`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || "Failed")
        return
      }
      setModalOpen(false)
      fetchTransactions()
    } catch {
      setSubmitError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: "transactionDate",
      header: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDateTime(item.transactionDate as string)}
        </span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Record<string, unknown>) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {item.memberName as string}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.memberCode as string}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item: Record<string, unknown>) => (
        <Badge variant={getTransactionBadgeVariant(item.type as string)}>
          {item.type as string}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {(item.description as string) || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const amount = item.amount as number
        const inflow = isInflow(item.type as string)
        return (
          <span
            className={
              inflow
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-red-600 dark:text-red-400 font-semibold"
            }
          >
            {inflow ? "+" : "−"}
            {formatUGX(amount)}
          </span>
        )
      },
    },
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
      key: "recordedBy",
      header: "Recorded By",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {(item.recordedBy as string) || "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Unified view of all financial activity"
        actions={
          <div className="flex gap-2">
            <Button icon={<ArrowDownCircle className="w-4 h-4" />} onClick={() => openModal("Deposit")}>
              Deposit
            </Button>
            <Button variant="outline" icon={<ArrowUpCircle className="w-4 h-4" />} onClick={() => openModal("Withdrawal")}>
              Withdraw
            </Button>
          </div>
        }
      />

      {loadError && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{loadError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={isFiltered ? "Inflows (filtered)" : "Total Inflows"}
          value={formatUGX(summary.totalInflows)}
          icon={<ArrowDownCircle className="w-5 h-5" />}
        />
        <MetricCard
          label={isFiltered ? "Outflows (filtered)" : "Total Outflows"}
          value={formatUGX(summary.totalOutflows)}
          icon={<ArrowUpCircle className="w-5 h-5" />}
        />
        <MetricCard
          label={isFiltered ? "Net Amount (filtered)" : "Net Amount"}
          value={formatUGX(summary.netAmount)}
          icon={<Wallet className="w-5 h-5" />}
        />
        <MetricCard
          label={isFiltered ? "Transactions (filtered)" : "Total Transactions"}
          value={summary.transactionCount.toLocaleString()}
          icon={<FileText className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by member, reference..."
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
                  ...TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
                ]}
                className="max-w-[200px]"
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

        <Table
          columns={columns}
          data={transactions as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? "Loading transactions..." : loadError ? "Transactions could not be loaded" : "No transactions found"}
          emptyIcon={!loading && !loadError ? <FileText className="w-12 h-12 mb-3 opacity-50" /> : undefined}
        />

        {/* The table is capped server-side; make the cap visible so a short
            list is never mistaken for the complete ledger. */}
        {!loading && !loadError && summary.transactionCount > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {displayedCount.toLocaleString()} of{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {summary.transactionCount.toLocaleString()}
              </span>{" "}
              transaction{summary.transactionCount === 1 ? "" : "s"}
              {isFiltered ? " (matching current filters)" : ""} — totals above cover all of them.
            </p>
            {hasMore && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Narrow the date range or search to see older entries.
              </p>
            )}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${modalType} Funds`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Member *</label>
            <div className="relative">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value)
                  setSelectedMember(null)
                  setMemberBalance(null)
                }}
                onFocus={() => {
                  if (memberSearch.length >= 2) searchMembers(memberSearch)
                }}
                placeholder="Type to search member by name or code..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                required
              />
              {memberOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {memberOptions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleMemberSelect(m)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs text-gray-500 mr-2">{m.memberCode}</span>
                        <span className="font-medium">{m.farmerName}</span>
                      </div>
                      {m.phoneNumber && (
                        <span className="text-xs text-gray-400">{m.phoneNumber}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedMember && (
              <div className="mt-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Selected: {selectedMember.memberCode} - {selectedMember.farmerName}
                </p>
                {memberBalance !== null && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Current Balance: <span className="font-semibold">{formatUGX(memberBalance)}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <Input
            label={`Amount (UGX) ${modalType === "Withdrawal" && memberBalance !== null ? `- Available: ${formatUGX(memberBalance)}` : ""}`}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            min="1"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Narration (optional)</label>
            <textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!selectedMember}>
              {modalType === "Deposit" ? "Process Deposit" : "Process Withdrawal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
