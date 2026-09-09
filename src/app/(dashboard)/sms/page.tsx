"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquare, Send, Search, Upload, FileText, Plus } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card } from "@/components/ui/Card"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Modal from "@/components/ui/Modal"
import { formatDateTime } from "@/lib/utils"

interface SmsLog {
  id: number
  memberId: number | null
  phoneNumber: string
  message: string
  messageType: string
  status: string
  errorMessage: string | null
  createdAt: string
  sentAt: string | null
  member: { id: number; farmerName: string; memberCode: string } | null
  sender: { id: number; fullName: string } | null
}

interface Member {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
}

interface SmsTemplate {
  id: number
  templateName: string
  templateKey: string
  messageBody: string
  isActive: boolean
}

type Tab = "quick" | "bulk" | "history" | "templates"

export default function SmsPage() {
  const [tab, setTab] = useState<Tab>("quick")
  const [members, setMembers] = useState<Member[]>([])
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [logSearch, setLogSearch] = useState("")
  const [logTypeFilter, setLogTypeFilter] = useState("")

  // Quick send state
  const [quickMemberId, setQuickMemberId] = useState("")
  const [quickPhone, setQuickPhone] = useState("")
  const [quickMessage, setQuickMessage] = useState("")

  // Bulk send state
  const [bulkPhoneNumbers, setBulkPhoneNumbers] = useState("")
  const [bulkMessage, setBulkMessage] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [memberSearch, setMemberSearch] = useState("")
  const [showMemberSelect, setShowMemberSelect] = useState(false)

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({ templateName: "", templateKey: "", messageBody: "" })
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({})

  const fetchMembers = useCallback(async () => {
    try {
      const params = memberSearch ? `?search=${encodeURIComponent(memberSearch)}&pageSize=20` : "?pageSize=20"
      const res = await fetch(`/api/members${params}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [memberSearch])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (logSearch) params.set("search", logSearch)
      if (logTypeFilter) params.set("messageType", logTypeFilter)
      const res = await fetch(`/api/sms?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [logSearch, logTypeFilter])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      if (res.ok) {
        const data = await res.json()
        if (data.templates) setTemplates(data.templates)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleQuickSend = async () => {
    if (!quickPhone.trim() || !quickMessage.trim()) {
      alert("Phone number and message are required")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: quickMemberId || undefined,
          phoneNumber: quickPhone,
          message: quickMessage,
          messageType: "General",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("SMS sent successfully")
        setQuickPhone("")
        setQuickMessage("")
        setQuickMemberId("")
        fetchLogs()
      } else {
        alert(data.error || "Failed to send SMS")
      }
    } catch (err) {
      alert("Failed to send SMS")
    } finally {
      setSending(false)
    }
  }

  const handleBulkSend = async () => {
    const selectedMemberData = members.filter((m) => selectedMembers.includes(m.id))
    const phones = [
      ...new Set([
        ...selectedMemberData.map((m) => m.phoneNumber).filter(Boolean),
        ...bulkPhoneNumbers.split(/[,\n]/).map((p) => p.trim()).filter(Boolean),
      ]),
    ]

    if (phones.length === 0) {
      alert("Add phone numbers or select members")
      return
    }
    if (!bulkMessage.trim()) {
      alert("Message is required")
      return
    }

    setSending(true)
    try {
      let sent = 0
      let failed = 0
      for (const phone of phones) {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: phone,
            message: bulkMessage,
            messageType: "Bulk",
          }),
        })
        if (res.ok) sent++
        else failed++
      }
      alert(`Bulk SMS complete. Sent: ${sent}, Failed: ${failed}`)
      setBulkPhoneNumbers("")
      setBulkMessage("")
      setSelectedMembers([])
      fetchLogs()
    } catch (err) {
      alert("Bulk SMS failed")
    } finally {
      setSending(false)
    }
  }

  const toggleMemberSelection = (id: number) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.templateName.trim() || !templateForm.messageBody.trim()) {
      setTemplateErrors({ name: "Name and body are required" })
      return
    }
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType: "Template",
          phoneNumber: "N/A",
          message: JSON.stringify(templateForm),
        }),
      })
      if (res.ok) {
        setShowTemplateModal(false)
        setTemplateForm({ templateName: "", templateKey: "", messageBody: "" })
        fetchTemplates()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const logColumns = [
    {
      key: "createdAt",
      header: "Date",
      render: (item: SmsLog) => formatDateTime(item.createdAt),
    },
    {
      key: "phoneNumber",
      header: "Phone",
      render: (item: SmsLog) => (
        <span className="font-mono text-sm">{item.phoneNumber}</span>
      ),
    },
    {
      key: "message",
      header: "Message",
      render: (item: SmsLog) => (
        <span className="max-w-[250px] truncate block text-sm">{item.message}</span>
      ),
    },
    {
      key: "messageType",
      header: "Type",
      render: (item: SmsLog) => <Badge variant="info">{item.messageType}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: SmsLog) => (
        <Badge variant={getStatusVariant(item.status)}>
          {item.status}
        </Badge>
      ),
    },
  ]

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "quick", label: "Quick Send", icon: <Send className="w-4 h-4" /> },
    { key: "bulk", label: "Bulk Send", icon: <Upload className="w-4 h-4" /> },
    { key: "history", label: "History", icon: <FileText className="w-4 h-4" /> },
    { key: "templates", label: "Templates", icon: <MessageSquare className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="SMS Management" subtitle="Send SMS messages to members" />

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick Send */}
      {tab === "quick" && (
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Send</h3>
          <div className="space-y-4">
            <Select
              label="Select Member (optional)"
              value={quickMemberId}
              onChange={(e) => {
                setQuickMemberId(e.target.value)
                const member = members.find((m) => m.id === parseInt(e.target.value))
                if (member?.phoneNumber) setQuickPhone(member.phoneNumber)
              }}
              options={[
                { value: "", label: "Select member..." },
                ...members.map((m) => ({
                  value: String(m.id),
                  label: `${m.memberCode} - ${m.farmerName}`,
                })),
              ]}
            />
            <Input
              label="Phone Number *"
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              placeholder="0700000000"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Message *
              </label>
              <textarea
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Type your message..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{quickMessage.length} characters</p>
            </div>
            <div className="flex justify-end">
              <Button
                icon={<Send className="w-4 h-4" />}
                onClick={handleQuickSend}
                loading={sending}
                disabled={!quickPhone.trim() || !quickMessage.trim()}
              >
                Send SMS
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Bulk Send */}
      {tab === "bulk" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bulk Send</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Members
                  </label>
                  <span className="text-xs text-gray-500">{selectedMembers.length} selected</span>
                </div>
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.id)}
                        onChange={() => toggleMemberSelection(m.id)}
                        className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{m.farmerName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.memberCode} · {m.phoneNumber}</p>
                      </div>
                    </label>
                  ))}
                  {members.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-500 text-center">No members found</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Additional Phone Numbers (comma or newline separated)
                </label>
                <textarea
                  value={bulkPhoneNumbers}
                  onChange={(e) => setBulkPhoneNumbers(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                  placeholder="0700111222, 0700333444"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Message *
                </label>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                  placeholder="Type your bulk message..."
                />
              </div>

              <div className="flex justify-end">
                <Button
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleBulkSend}
                  loading={sending}
                  disabled={selectedMembers.length === 0 && !bulkPhoneNumbers.trim()}
                >
                  Send Bulk SMS
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by phone, message, or member..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
              </div>
              <div className="w-44">
                <Select
                  value={logTypeFilter}
                  onChange={(e) => setLogTypeFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Types" },
                    { value: "General", label: "General" },
                    { value: "Bulk", label: "Bulk" },
                    { value: "Welcome", label: "Welcome" },
                  ]}
                />
              </div>
            </div>
          </Card>
          <Card>
            <Table
              columns={logColumns}
              data={logs as unknown as Record<string, unknown>[]}
              emptyMessage="No SMS logs found"
              emptyIcon={<MessageSquare className="w-12 h-12 mb-3 opacity-50" />}
            />
          </Card>
        </div>
      )}

      {/* Templates */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowTemplateModal(true)}>
              Add Template
            </Button>
          </div>
          {templates.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No templates configured. Use the seed script to add default templates.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{t.templateName}</h4>
                    <Badge variant={t.isActive ? "success" : "default"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{t.messageBody}</p>
                </Card>
              ))}
            </div>
          )}

          <Modal
            open={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            title="Add SMS Template"
            size="md"
          >
            <div className="space-y-4">
              <Input
                label="Template Name *"
                value={templateForm.templateName}
                onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                placeholder="e.g. Welcome Message"
              />
              <Input
                label="Template Key"
                value={templateForm.templateKey}
                onChange={(e) => setTemplateForm({ ...templateForm, templateKey: e.target.value })}
                placeholder="e.g. welcome"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Message Body *
                </label>
                <textarea
                  value={templateForm.messageBody}
                  onChange={(e) => setTemplateForm({ ...templateForm, messageBody: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                  placeholder="Use {variable_name} for dynamic content"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
                <Button onClick={handleSaveTemplate}>Save Template</Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}


