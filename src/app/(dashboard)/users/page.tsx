"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Shield, Edit, Key } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { formatDate } from "@/lib/utils"

interface User {
  id: number
  fullName: string
  username: string
  role: string
  status: string
  createdAt: string
}

interface FormData {
  fullName: string
  username: string
  password: string
  role: string
}

const initialForm: FormData = {
  fullName: "",
  username: "",
  password: "",
  role: "Teller",
}

interface PasswordFormData {
  userId: number
  newPassword: string
  confirmPassword: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [form, setForm] = useState<FormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({ userId: 0, newPassword: "", confirmPassword: "" })
  const [passwordError, setPasswordError] = useState("")

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!form.fullName?.trim()) errors.fullName = "Full name is required"
    if (!form.username?.trim()) errors.username = "Username is required"
    if (!form.password || form.password.length < 6) errors.password = "Password must be at least 6 characters"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create user")
      }
      setModalOpen(false)
      setForm(initialForm)
      fetchUsers()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: passwordForm.userId, password: passwordForm.newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update password")
      }
      setPasswordModalOpen(false)
      setPasswordForm({ userId: 0, newPassword: "", confirmPassword: "" })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "An unexpected error occurred")
    }
  }

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: "username",
      header: "Username",
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-sm">{item.username as string}</span>
      ),
    },
    {
      key: "fullName",
      header: "Full Name",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium text-gray-900 dark:text-white">{item.fullName as string}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (item: Record<string, unknown>) => {
        const role = item.role as string
        return <Badge variant={role === "Admin" ? "danger" : role === "Manager" ? "info" : "default"}>{role}</Badge>
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item: Record<string, unknown>) => (
        <Badge variant={getStatusVariant(item.status as string)}>{item.status as string}</Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-gray-500">{formatDate(item.createdAt as string)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: Record<string, unknown>) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Key className="w-3 h-3" />}
          onClick={(e) => {
            e.stopPropagation()
            setPasswordForm({ userId: item.id as number, newPassword: "", confirmPassword: "" })
            setPasswordModalOpen(true)
          }}
        >
          Password
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Users"
        subtitle="Manage system user accounts"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Add User
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
        <Table columns={columns} data={filteredUsers as unknown as Record<string, unknown>[]} emptyMessage="No users found" />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(initialForm); setSubmitError("") }} title="Add User" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <Input
            label="Full Name *"
            value={form.fullName}
            onChange={(e) => { setForm((p) => ({ ...p, fullName: e.target.value })); if (formErrors.fullName) setFormErrors((p) => ({ ...p, fullName: undefined })) }}
            error={formErrors.fullName}
            placeholder="Enter full name"
          />

          <Input
            label="Username *"
            value={form.username}
            onChange={(e) => { setForm((p) => ({ ...p, username: e.target.value })); if (formErrors.username) setFormErrors((p) => ({ ...p, username: undefined })) }}
            error={formErrors.username}
            placeholder="Enter username"
          />

          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={(e) => { setForm((p) => ({ ...p, password: e.target.value })); if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined })) }}
            error={formErrors.password}
            placeholder="Minimum 6 characters"
          />

          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            options={[
              { value: "Teller", label: "Teller" },
              { value: "Manager", label: "Manager" },
              { value: "Admin", label: "Admin" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setForm(initialForm) }}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create User</Button>
          </div>
        </form>
      </Modal>

      <Modal open={passwordModalOpen} onClose={() => { setPasswordModalOpen(false); setPasswordError("") }} title="Change Password" size="sm">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            </div>
          )}

          <Input
            label="New Password *"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            placeholder="Minimum 6 characters"
          />

          <Input
            label="Confirm Password *"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Re-enter password"
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="ghost" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
            <Button type="submit">Update Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
