"use client"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card } from "@/components/ui/Card"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Modal from "@/components/ui/Modal"

interface ChartAccount {
  id: number
  accountCode: string
  accountName: string
  accountType: string
  balance: number
  status: string
  createdAt: string
}

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"]

const TYPE_BADGE_VARIANT: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  Asset: "success",
  Liability: "danger",
  Equity: "info",
  Revenue: "warning",
  Expense: "default",
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null)
  const [form, setForm] = useState({ accountCode: "", accountName: "", accountType: "Asset" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter) params.set("type", typeFilter)
      const res = await fetch(`/api/chart-of-accounts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.data)
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const openCreate = () => {
    setEditingAccount(null)
    setForm({ accountCode: "", accountName: "", accountType: "Asset" })
    setErrors({})
    setShowModal(true)
  }

  const openEdit = (account: ChartAccount) => {
    setEditingAccount(account)
    setForm({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
    })
    setErrors({})
    setShowModal(true)
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.accountCode.trim()) e.accountCode = "Required"
    if (!form.accountName.trim()) e.accountName = "Required"
    if (!form.accountType) e.accountType = "Required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (editingAccount) {
        const res = await fetch("/api/chart-of-accounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingAccount.id, ...form }),
        })
        if (!res.ok) {
          const data = await res.json()
          setErrors({ general: data.error })
          return
        }
      } else {
        const res = await fetch("/api/chart-of-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          setErrors({ general: data.error })
          return
        }
      }
      setShowModal(false)
      fetchAccounts()
    } catch (err) {
      setErrors({ general: "An error occurred" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account?")) return
    try {
      const res = await fetch(`/api/chart-of-accounts?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchAccounts()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete")
      }
    } catch (err) {
      alert("Failed to delete")
    }
  }

  const columns = [
    {
      key: "accountCode",
      header: "Code",
      render: (item: ChartAccount) => (
        <span className="font-mono font-semibold text-[var(--color-primary)]">{item.accountCode}</span>
      ),
    },
    {
      key: "accountName",
      header: "Name",
      render: (item: ChartAccount) => (
        <span className="font-medium text-gray-900 dark:text-white">{item.accountName}</span>
      ),
    },
    {
      key: "accountType",
      header: "Type",
      render: (item: ChartAccount) => (
        <Badge variant={TYPE_BADGE_VARIANT[item.accountType] || "default"}>{item.accountType}</Badge>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      render: (item: ChartAccount) => (
        <span className="font-mono">{item.balance.toLocaleString("en-UG", { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: ChartAccount) => (
        <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: ChartAccount) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(item) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage the SACCO's chart of accounts"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Add Account
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                ...ACCOUNT_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={accounts as unknown as Record<string, unknown>[]}
          emptyMessage="No accounts found"
          emptyIcon={<BookOpen className="w-12 h-12 mb-3 opacity-50" />}
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingAccount ? "Edit Account" : "Add Account"}
        size="md"
      >
        <div className="space-y-4">
          {errors.general && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
            </div>
          )}
          <Input
            label="Account Code *"
            value={form.accountCode}
            onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
            error={errors.accountCode}
            placeholder="e.g. 1000"
            disabled={!!editingAccount}
          />
          <Input
            label="Account Name *"
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            error={errors.accountName}
            placeholder="e.g. Cash"
          />
          <Select
            label="Account Type *"
            value={form.accountType}
            onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            error={errors.accountType}
            options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingAccount ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
