"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Eye, Edit, Trash2, Users, ChevronLeft, ChevronRight } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { formatUGX, formatDate } from "@/lib/utils"

interface Member {
  id: number
  memberCode: string
  farmerName: string
  gender: string | null
  phoneNumber: string | null
  status: string | null
  registrationDate: string
  parish: string | null
  district: string | null
}

interface MembersResponse {
  data: Member[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 10

export default function MembersPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/members?${params}`)
      if (res.ok) {
        const data: MembersResponse = await res.json()
        setMembers(data.data)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch members:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleDelete = async (memberId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete member "${name}"? This action cannot be undone.`)) return
    setDeleting(memberId)
    try {
      const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to delete member")
        return
      }
      fetchMembers()
    } catch {
      alert("Failed to delete member")
    } finally {
      setDeleting(null)
    }
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "memberCode",
      header: "Code",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">{item.memberCode as string}</span>
      ),
    },
    {
      key: "farmerName",
      header: "Name",
      render: (item: Row) => (
        <span className="font-medium">{item.farmerName as string}</span>
      ),
    },
    {
      key: "phoneNumber",
      header: "Phone",
      render: (item: Row) => (item.phoneNumber as string) || "—",
    },
    {
      key: "gender",
      header: "Gender",
      render: (item: Row) => (item.gender as string) || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (item: Row) => (
        <Badge variant={getStatusVariant((item.status as string) || "")}>{(item.status as string) || "Unknown"}</Badge>
      ),
    },
    {
      key: "registrationDate",
      header: "Join Date",
      render: (item: Row) => formatDate(item.registrationDate as string),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item: Row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedMember(item as unknown as Member)
              setDetailModalOpen(true)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/members/${item.id as number}/edit`)
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(item.id as number, item.farmerName as string)
            }}
            disabled={deleting === item.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            title="Delete"
          >
            {deleting === item.id ? (
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle={`Total: ${total} members`}
        actions={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => router.push("/members/register")}
          >
            Register Member
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, code, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={members as unknown as Row[]}
          emptyMessage={loading ? "Loading members..." : "No members found"}
          emptyIcon={!loading ? <Users className="w-12 h-12 mb-3 opacity-50" /> : undefined}
          onRowClick={(item) => {
            setSelectedMember(item as unknown as Member)
            setDetailModalOpen(true)
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

      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedMember(null)
        }}
        title="Member Details"
        size="md"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Code</p>
                <p className="text-sm font-mono font-semibold text-[var(--color-primary)]">{selectedMember.memberCode}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</p>
                <Badge variant={getStatusVariant(selectedMember.status || "")}>{selectedMember.status || "Unknown"}</Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedMember.farmerName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedMember.phoneNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Gender</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedMember.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Parish</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedMember.parish || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">District</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedMember.district || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Join Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedMember.registrationDate)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDetailModalOpen(false)
                  router.push(`/members/${selectedMember.id}/edit`)
                }}
              >
                Edit Member
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
