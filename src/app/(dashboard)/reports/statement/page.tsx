"use client"

import { useState, useEffect } from "react"
import { Search, Download, FileText, User, PiggyBank, CreditCard, TrendingUp, Calendar, RefreshCw } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import { Card, MetricCard } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import Input from "@/components/ui/Input"
import { formatUGX, formatDate } from "@/lib/utils"

interface Member {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
  gender: string | null
  status: string | null
}

interface Transaction {
  id: number
  type: string
  description: string
  amount: number
  balance: number
  date: string
  reference: string
}

interface StatementData {
  profile: {
    id: number
    memberCode: string
    farmerName: string
    phoneNumber: string | null
    gender: string | null
    dateOfBirth: string | null
    parish: string | null
    district: string | null
    registrationDate: string
    status: string
  }
  savings: {
    totalDeposits: number
    totalWithdrawals: number
    currentBalance: number
    transactionCount: number
  }
  loan: {
    totalBorrowed: number
    totalRepaid: number
    outstandingBalance: number
    activeLoans: number
    loanHistory: Array<{
      id: number
      loanCode: string
      amount: number
      status: string
      disbursedDate: string
    }>
  }
  shares: {
    totalShares: number
    shareValue: number
    totalValue: number
  }
  transactions: Transaction[]
}

export default function StatementPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch("/api/members?pageSize=1000")
        if (res.ok) {
          const data = await res.json()
          setMembers(data.data || [])
        }
      } catch {
        console.error("Failed to load members")
      } finally {
        setMembersLoading(false)
      }
    }
    fetchMembers()
  }, [])

  const handleGenerate = async () => {
    if (!selectedMemberId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      const res = await fetch(`/api/member-statement/${selectedMemberId}?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStatement(data)
      } else {
        alert("Failed to generate statement")
      }
    } catch {
      alert("Failed to generate statement")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!statement) return
    setGenerating(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFontSize(18)
      doc.text("KAFS SACCO", pageWidth / 2, 18, { align: "center" })
      doc.setFontSize(12)
      doc.text("Member Statement", pageWidth / 2, 26, { align: "center" })
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: "center" })

      let y = 40

      doc.setFontSize(11)
      doc.text("Member Profile", 14, y); y += 7
      autoTable(doc, {
        startY: y,
        head: [["Field", "Value"]],
        body: [
          ["Member Code", statement.profile.memberCode],
          ["Full Name", statement.profile.farmerName],
          ["Phone", statement.profile.phoneNumber || "—"],
          ["Gender", statement.profile.gender || "—"],
          ["Parish", statement.profile.parish || "—"],
          ["District", statement.profile.district || "—"],
          ["Registration Date", formatDate(statement.profile.registrationDate)],
          ["Status", statement.profile.status],
        ],
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      doc.text("Savings Summary", 14, y); y += 7
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Deposits", formatUGX(statement.savings.totalDeposits)],
          ["Total Withdrawals", formatUGX(statement.savings.totalWithdrawals)],
          ["Current Balance", formatUGX(statement.savings.currentBalance)],
          ["Transactions", String(statement.savings.transactionCount)],
        ],
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      doc.text("Loan Summary", 14, y); y += 7
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Borrowed", formatUGX(statement.loan.totalBorrowed)],
          ["Total Repaid", formatUGX(statement.loan.totalRepaid)],
          ["Outstanding Balance", formatUGX(statement.loan.outstandingBalance)],
          ["Active Loans", String(statement.loan.activeLoans)],
        ],
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      doc.text("Shares", 14, y); y += 7
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Shares", String(statement.shares.totalShares)],
          ["Share Value", formatUGX(statement.shares.shareValue)],
          ["Total Value", formatUGX(statement.shares.totalValue)],
        ],
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      if (statement.transactions.length > 0) {
        doc.text("Transaction History", 14, y); y += 7
        autoTable(doc, {
          startY: y,
          head: [["Date", "Type", "Description", "Amount", "Balance"]],
          body: statement.transactions.map((t) => [
            formatDate(t.date),
            t.type,
            t.description,
            formatUGX(t.amount),
            formatUGX(t.balance),
          ]),
        })
      }

      doc.setFontSize(8)
      doc.text("Designed by NobTechWorld | 0760 399 849", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" })

      doc.save(`KAFS_Statement_${statement.profile.memberCode}_${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
      alert("Failed to generate PDF")
    } finally {
      setGenerating(false)
    }
  }

  const memberOptions = [
    { value: "", label: "Select a member..." },
    ...members.map((m) => ({
      value: String(m.id),
      label: `${m.memberCode} — ${m.farmerName}`,
    })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Statement"
        subtitle="Generate and download detailed member statements"
      />

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 min-w-0">
            <Select
              label="Member"
              options={memberOptions}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              placeholder={membersLoading ? "Loading members..." : "Select a member"}
            />
          </div>
          <div className="w-full sm:w-auto">
            <Input
              label="Date From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto">
            <Input
              label="Date To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button
            onClick={handleGenerate}
            loading={loading}
            disabled={!selectedMemberId}
            icon={<FileText className="w-4 h-4" />}
          >
            Generate Statement
          </Button>
          {statement && (
            <Button
              variant="gold"
              onClick={handleDownloadPDF}
              loading={generating}
              icon={<Download className="w-4 h-4" />}
            >
              Download PDF
            </Button>
          )}
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Generating statement...</p>
          </div>
        </div>
      )}

      {!loading && statement && (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[var(--color-primary)]/10 rounded-xl">
                <User className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Member Profile</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{statement.profile.memberCode}</p>
              </div>
              <Badge variant={statement.profile.status === "Active" ? "success" : "default"} className="ml-auto">
                {statement.profile.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{statement.profile.farmerName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                <p className="text-sm text-gray-900 dark:text-white">{statement.profile.phoneNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Gender</p>
                <p className="text-sm text-gray-900 dark:text-white">{statement.profile.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Parish</p>
                <p className="text-sm text-gray-900 dark:text-white">{statement.profile.parish || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">District</p>
                <p className="text-sm text-gray-900 dark:text-white">{statement.profile.district || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Date of Birth</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {statement.profile.dateOfBirth ? formatDate(statement.profile.dateOfBirth) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Registration Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(statement.profile.registrationDate)}</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Current Savings Balance"
              value={formatUGX(statement.savings.currentBalance)}
              icon={<PiggyBank className="w-5 h-5" />}
            />
            <MetricCard
              label="Loan Outstanding"
              value={formatUGX(statement.loan.outstandingBalance)}
              icon={<CreditCard className="w-5 h-5" />}
            />
            <MetricCard
              label="Total Shares"
              value={`${statement.shares.totalShares} shares`}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <MetricCard
              label="Share Value"
              value={formatUGX(statement.shares.totalValue)}
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <PiggyBank className="w-4 h-4" />
                Savings Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Deposits</span>
                  <span className="text-sm font-semibold text-green-600">{formatUGX(statement.savings.totalDeposits)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Withdrawals</span>
                  <span className="text-sm font-semibold text-red-600">{formatUGX(statement.savings.totalWithdrawals)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Current Balance</span>
                  <span className="text-sm font-bold text-[var(--color-primary)]">{formatUGX(statement.savings.currentBalance)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Loan Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Borrowed</span>
                  <span className="text-sm font-semibold">{formatUGX(statement.loan.totalBorrowed)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Repaid</span>
                  <span className="text-sm font-semibold text-green-600">{formatUGX(statement.loan.totalRepaid)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Outstanding Balance</span>
                  <span className="text-sm font-bold text-red-600">{formatUGX(statement.loan.outstandingBalance)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active Loans</span>
                  <Badge variant="info">{statement.loan.activeLoans}</Badge>
                </div>
              </div>
            </Card>
          </div>

          {statement.loan.loanHistory.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Loan History</h3>
              <div className="space-y-3">
                {statement.loan.loanHistory.map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{loan.loanCode}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Disbursed: {formatDate(loan.disbursedDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatUGX(loan.amount)}</p>
                      <Badge variant={loan.status === "Active" ? "success" : "default"}>{loan.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {statement.transactions.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Transaction History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Reference</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {statement.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={t.type === "Deposit" || t.type === "Savings" ? "success" : "danger"}>
                            {t.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{t.description}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">{t.reference}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${
                          t.type === "Deposit" || t.type === "Savings"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {t.type === "Deposit" || t.type === "Savings" ? "+" : "-"}{formatUGX(t.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          {formatUGX(t.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!loading && statement && statement.transactions.length === 0 && (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No transactions found for the selected period.</p>
            </Card>
          )}
        </div>
      )}

      {!loading && !statement && (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Select a member and click &quot;Generate Statement&quot; to view their statement.</p>
        </Card>
      )}
    </div>
  )
}
