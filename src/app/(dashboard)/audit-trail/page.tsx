"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Shield, Filter, X } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { formatDateTime } from "@/lib/utils"

interface AuditUser {
  id: number
  fullName: string
  username: string
}

interface AuditTrail {
  id: number
  userId: number | null
  actionType: string
  tableName: string | null
  recordId: number | null
  description: string | null
  amount: number | null
  createdAt: string
  user: AuditUser | null
}

interface UsersList {
  id: number
  fullName: string
  username: string
}

const ACTION_TYPES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "APPROVE",
  "REJECT",
  "DISBURSE",
  "REPAY",
  "WITHDRAW",
  "DEPOSIT",
]

export default function AuditTrailPage() {
  const [trails, setTrails] = useState<AuditTrail[]>([])
  const [users, setUsers] = useState<UsersList[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [userIdFilter, setUserIdFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      if (userIdFilter) params.set("userId", userIdFilter)
      if (actionFilter) params.set("actionType", actionFilter)
      params.set("page", String(page))
      params.set("pageSize", "50")

      const res = await fetch(`/api/audit-trail?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTrails(data.trails || [])
        setUsers(data.users || [])
        setTotalPages(data.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to fetch audit trail:", err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, userIdFilter, actionFilter, page])

  useEffect(() => { fetchData() }, [fetchData])

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setUserIdFilter("")
    setActionFilter("")
    setPage(1)
  }

  const columns = [
    {
      key: "createdAt",
      header: "Date",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(item.createdAt as string)}</span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (item: Record<string, unknown>) => {
        const u = item.user as AuditUser | null
        return u ? (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{u.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{u.username}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-400">System</span>
        )
      },
    },
    {
      key: "actionType",
      header: "Action",
      render: (item: Record<string, unknown>) => {
        const action = item.actionType as string
        const variant = action === "CREATE" || action === "APPROVE" ? "success" : action === "DELETE" || action === "REJECT" ? "danger" : action === "LOGIN" ? "info" : "default"
        return <Badge variant={variant}>{action}</Badge>
      },
    },
    {
      key: "tableName",
      header: "Table",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm">{(item.tableName as string) || "—"}</span>
      ),
    },
    {
      key: "recordId",
      header: "Record ID",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs">{item.recordId ? `#${item.recordId}` : "—"}</span>
      ),
    },
    {
      key: "description",
      header: "Details",
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate block">{(item.description as string) || "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (item: Record<string, unknown>) => {
        const amt = item.amount as number | null
        return amt ? <span className="text-sm font-medium">{`UGX ${amt.toLocaleString("en-UG")}`}</span> : "—"
      },
    },
  ]

  const hasFilters = dateFrom || dateTo || userIdFilter || actionFilter

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" subtitle="Track all system activities and changes" />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="max-w-[160px]" placeholder="From" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="max-w-[160px]" placeholder="To" />
            <Select
              value={userIdFilter}
              onChange={(e) => { setUserIdFilter(e.target.value); setPage(1) }}
              options={[{ value: "", label: "All Users" }, ...users.map((u) => ({ value: String(u.id), label: u.fullName }))]}
              className="max-w-[180px]"
            />
            <Select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              options={[{ value: "", label: "All Actions" }, ...ACTION_TYPES.map((a) => ({ value: a, label: a }))]}
              className="max-w-[160px]"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} icon={<X className="w-4 h-4" />}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <Table columns={columns} data={trails as unknown as Record<string, unknown>[]} emptyMessage="No audit trail records found" />
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
