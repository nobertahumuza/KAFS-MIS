"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Eye, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import { formatUGX, formatDate } from "@/lib/utils"

interface Application {
  id: number
  applicationCode: string
  loanAmount: number
  loanPurpose: string | null
  status: string
  submittedAt: string | null
  createdAt: string
  member: {
    id: number
    farmerName: string
    memberCode: string
  }
}

interface ApplicationsResponse {
  data: Application[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Under_Review", label: "Under Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Disbursed", label: "Disbursed" },
]

const STATUS_BADGE_MAP: Record<string, { variant: "success" | "warning" | "danger" | "info" | "default"; className?: string }> = {
  Draft: { variant: "default" },
  Submitted: { variant: "info" },
  Under_Review: { variant: "warning" },
  Approved: { variant: "success" },
  Rejected: { variant: "danger" },
  Disbursed: { variant: "info", className: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" },
}

const PAGE_SIZE = 10

export default function ApplicationsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/loan-applications?${params}`)
      if (res.ok) {
        const data: ApplicationsResponse = await res.json()
        setApplications(data.data || [])
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchApplications() }, [fetchApplications])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const getStatusBadge = (status: string) => {
    const config = STATUS_BADGE_MAP[status] || { variant: "default" as const }
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace(/_/g, " ")}
      </Badge>
    )
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "applicationCode",
      header: "Application Code",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">
          {item.applicationCode as string}
        </span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Row) => {
        const app = item as unknown as Application
        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{app.member.farmerName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{app.member.memberCode}</p>
          </div>
        )
      },
    },
    {
      key: "loanAmount",
      header: "Amount",
      className: "text-right",
      render: (item: Row) => (
        <span className="font-semibold text-gray-900 dark:text-white">{formatUGX(item.loanAmount as number)}</span>
      ),
    },
    {
      key: "loanPurpose",
      header: "Purpose",
      render: (item: Row) => (
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px] block">
          {(item.loanPurpose as string) || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Row) => getStatusBadge((item.status as string) || "Draft"),
    },
    {
      key: "submittedAt",
      header: "Submitted Date",
      render: (item: Row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {(item.submittedAt as string) ? formatDate(item.submittedAt as string) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item: Row) => {
        const app = item as unknown as Application
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/loans/applications?id=${app.id}`)
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Applications"
        subtitle={`${total} total applications`}
        actions={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => router.push("/loans/applications")}
          >
            New Application
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by code or member name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="max-w-[180px]"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={applications as unknown as Row[]}
          emptyMessage={loading ? "Loading applications..." : "No applications found"}
          emptyIcon={!loading ? <ClipboardList className="w-12 h-12 mb-3 opacity-50" /> : undefined}
          onRowClick={(item) => {
            const app = item as unknown as Application
            router.push(`/loans/applications?id=${app.id}`)
          }}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
