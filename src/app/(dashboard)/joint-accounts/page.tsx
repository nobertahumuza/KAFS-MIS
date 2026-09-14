"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Plus, Users, X, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { formatUGX, formatDate } from "@/lib/utils"

interface JointAccountMember {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
  sharePercent: number
}

interface JointAccount {
  id: number
  accountName: string
  accountNumber: string
  totalBalance: number
  status: string | null
  createdAt: string
  members: JointAccountMember[]
}

interface JointAccountsResponse {
  data: JointAccount[]
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

interface FormMember {
  memberId: string
  sharePercent: string
}

const PAGE_SIZE = 10

export default function JointAccountsPage() {
  const [accounts, setAccounts] = useState<JointAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [accountName, setAccountName] = useState("")
  const [formMembers, setFormMembers] = useState<FormMember[]>([
    { memberId: "", sharePercent: "" },
    { memberId: "", sharePercent: "" },
    { memberId: "", sharePercent: "" },
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearches, setMemberSearches] = useState<string[]>(["", "", ""])
  const [memberDropdowns, setMemberDropdowns] = useState<boolean[]>([false, false, false])
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])

  const [selectedAccount, setSelectedAccount] = useState<JointAccount | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/joint-accounts?${params}`)
      if (res.ok) {
        const data: JointAccountsResponse = await res.json()
        setAccounts(data.data)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch joint accounts:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])
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
    const activeSearch = memberSearches.find((s, i) => memberDropdowns[i] && s.length >= 2)
    if (activeSearch) {
      const timer = setTimeout(() => searchMembers(activeSearch), 300)
      return () => clearTimeout(timer)
    }
  }, [memberSearches, memberDropdowns, searchMembers])

  const handleMemberSearchChange = (index: number, value: string) => {
    const newSearches = [...memberSearches]
    newSearches[index] = value
    setMemberSearches(newSearches)

    const newFormMembers = [...formMembers]
    newFormMembers[index] = { ...newFormMembers[index], memberId: "" }
    setFormMembers(newFormMembers)

    const newDropdowns = [...memberDropdowns]
    newDropdowns[index] = true
    setMemberDropdowns(newDropdowns)
  }

  const handleMemberSelect = (index: number, member: MemberOption) => {
    const newFormMembers = [...formMembers]
    newFormMembers[index] = { ...newFormMembers[index], memberId: String(member.id) }
    setFormMembers(newFormMembers)

    const newSearches = [...memberSearches]
    newSearches[index] = `${member.memberCode} - ${member.farmerName}`
    setMemberSearches(newSearches)

    const newDropdowns = [...memberDropdowns]
    newDropdowns[index] = false
    setMemberDropdowns(newDropdowns)
  }

  const handleShareChange = (index: number, value: string) => {
    const newFormMembers = [...formMembers]
    newFormMembers[index] = { ...newFormMembers[index], sharePercent: value }
    setFormMembers(newFormMembers)
  }

  const removeMember = (index: number) => {
    if (formMembers.length <= 2) return
    const newFormMembers = formMembers.filter((_, i) => i !== index)
    setFormMembers(newFormMembers)
    const newSearches = memberSearches.filter((_, i) => i !== index)
    setMemberSearches(newSearches)
    const newDropdowns = memberDropdowns.filter((_, i) => i !== index)
    setMemberDropdowns(newDropdowns)
  }

  const addMember = () => {
    if (formMembers.length >= 3) return
    setFormMembers([...formMembers, { memberId: "", sharePercent: "" }])
    setMemberSearches([...memberSearches, ""])
    setMemberDropdowns([...memberDropdowns, false])
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!accountName.trim()) newErrors.accountName = "Account name is required"

    const validMembers = formMembers.filter((m) => m.memberId)
    if (validMembers.length < 2) {
      newErrors.members = "At least 2 members are required"
    }

    const totalShare = validMembers.reduce((sum, m) => sum + (parseFloat(m.sharePercent) || 0), 0)
    if (Math.abs(totalShare - 100) > 0.01) {
      newErrors.shareTotal = `Share percentages must sum to 100% (currently ${totalShare}%)`
    }

    const memberIds = validMembers.map((m) => m.memberId)
    const uniqueIds = new Set(memberIds)
    if (uniqueIds.size !== memberIds.length) {
      newErrors.duplicate = "Duplicate members selected"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError("")

    try {
      const validMembers = formMembers
        .filter((m) => m.memberId)
        .map((m) => ({
          memberId: parseInt(m.memberId),
          sharePercent: parseFloat(m.sharePercent),
        }))

      const res = await fetch("/api/joint-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName: accountName.trim(), members: validMembers }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create joint account")
      }
      setCreateModalOpen(false)
      resetForm()
      fetchAccounts()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setAccountName("")
    setFormMembers([{ memberId: "", sharePercent: "" }, { memberId: "", sharePercent: "" }, { memberId: "", sharePercent: "" }])
    setMemberSearches(["", "", ""])
    setMemberDropdowns([false, false, false])
    setErrors({})
    setSubmitError("")
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "accountName",
      header: "Account Name",
      render: (item: Row) => (
        <span className="font-medium text-white/90">{item.accountName as string}</span>
      ),
    },
    {
      key: "accountNumber",
      header: "Account #",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">{item.accountNumber as string}</span>
      ),
    },
    {
      key: "members",
      header: "Members",
      render: (item: Row) => {
        const account = item as unknown as JointAccount
        return (
          <div className="space-y-1">
            {account.members.map((m) => (
              <div key={m.id} className="text-xs text-white/60">
                {m.farmerName} <span className="text-white/30">({m.sharePercent}%)</span>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      key: "totalBalance",
      header: "Total Balance",
      className: "text-right",
      render: (item: Row) => (
        <span className="font-semibold text-white/90">{formatUGX(item.totalBalance as number)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Row) => {
        const status = (item.status as string) || "Active"
        const variant = status === "Active" ? "success" : "danger"
        return <Badge variant={variant as "success" | "danger"}>{status}</Badge>
      },
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item: Row) => (
        <span className="text-white/50 text-sm">{formatDate(item.createdAt as string)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item: Row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedAccount(item as unknown as JointAccount)
            setDetailModalOpen(true)
          }}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          title="View Details"
        >
          <Users className="w-4 h-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0e1a] -m-6 p-6 relative">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Joint Accounts"
          subtitle={`${total} total joint accounts`}
          actions={
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => { resetForm(); setCreateModalOpen(true) }}
            >
              New Joint Account
            </Button>
          }
        />

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search by account name or member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={accounts as unknown as Row[]}
            emptyMessage={loading ? "Loading joint accounts..." : "No joint accounts found"}
            emptyIcon={!loading ? <Users className="w-12 h-12 mb-3 text-white/20" /> : undefined}
            onRowClick={(item) => {
              setSelectedAccount(item as unknown as JointAccount)
              setDetailModalOpen(true)
            }}
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

        {/* Create Joint Account Modal */}
        <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Joint Account" size="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}

            <Input
              label="Account Name *"
              value={accountName}
              onChange={(e) => { setAccountName(e.target.value); if (errors.accountName) setErrors((p) => ({ ...p, accountName: "" })) }}
              placeholder="e.g. Farm Group Savings"
              error={errors.accountName}
            />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Members (2-3 required)</h3>
                {formMembers.length < 3 && (
                  <button type="button" onClick={addMember} className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Member
                  </button>
                )}
              </div>

              {errors.members && <p className="text-sm text-red-500 mb-2">{errors.members}</p>}
              {errors.shareTotal && <p className="text-sm text-red-500 mb-2">{errors.shareTotal}</p>}
              {errors.duplicate && <p className="text-sm text-red-500 mb-2">{errors.duplicate}</p>}

              <div className="space-y-3">
                {formMembers.map((fm, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search member..."
                        value={memberSearches[index]}
                        onChange={(e) => handleMemberSearchChange(index, e.target.value)}
                        onFocus={() => {
                          const newDropdowns = [...memberDropdowns]
                          newDropdowns[index] = true
                          setMemberDropdowns(newDropdowns)
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
                      />
                      {memberDropdowns[index] && memberOptions.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {memberOptions.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => handleMemberSelect(index, member)}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{member.farmerName}</p>
                              <p className="text-xs text-gray-500">{member.memberCode} • {member.phoneNumber || "No phone"}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        placeholder="%"
                        value={fm.sharePercent}
                        onChange={(e) => handleShareChange(index, e.target.value)}
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                    {formMembers.length > 2 && (
                      <button type="button" onClick={() => removeMember(index)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">
                  Total: {formMembers.reduce((sum, m) => sum + (parseFloat(m.sharePercent) || 0), 0)}%
                  {Math.abs(formMembers.reduce((sum, m) => sum + (parseFloat(m.sharePercent) || 0), 0) - 100) < 0.01 && (
                    <span className="text-emerald-400 ml-2">✓ Valid</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Create Joint Account</Button>
            </div>
          </form>
        </Modal>

        {/* Detail Modal */}
        <Modal open={detailModalOpen} onClose={() => { setDetailModalOpen(false); setSelectedAccount(null) }} title="Joint Account Details" size="md">
          {selectedAccount && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Account Name</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAccount.accountName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Account Number</p>
                  <p className="text-sm font-mono font-semibold text-[var(--color-primary)]">{selectedAccount.accountNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Balance</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatUGX(selectedAccount.totalBalance)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <Badge variant={selectedAccount.status === "Active" ? "success" : "danger"}>{selectedAccount.status || "Active"}</Badge>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Members & Shares</h4>
                <div className="space-y-2">
                  {selectedAccount.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{m.farmerName}</p>
                        <p className="text-xs text-gray-500">{m.memberCode} • {m.phoneNumber || "No phone"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--color-primary)]">{m.sharePercent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
