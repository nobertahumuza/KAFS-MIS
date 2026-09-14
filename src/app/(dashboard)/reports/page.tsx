"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Printer, Calendar, TrendingUp, Users, DollarSign, FileText, Shield, Mail, Download, Receipt, Wallet, Landmark, PiggyBank, BarChart3, CreditCard } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card, MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"
import type jsPDF from "jspdf"

interface SavingsReport {
  totalDeposits: number
  totalWithdrawals: number
  netSavings: number
  transactionCount: number
  recentTransactions: Array<{
    id: number
    memberName: string
    transactionType: string
    amount: number
    transactionDate: string
  }>
}

interface LoansReport {
  totalLoans: number
  activeLoans: number
  totalDisbursed: number
  totalRepaid: number
  outstandingBalance: number
  recentLoans: Array<{
    id: number
    loanCode: string
    memberName: string
    principalAmount: number
    loanStatus: string
    disbursementDate: string
  }>
}

interface MembersReport {
  totalMembers: number
  activeMembers: number
  newThisMonth: number
  genderDistribution: { male: number; female: number }
}

interface FinancialReport {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalExpenses: number
  totalIncome: number
}

interface SummaryReport {
  totalMembers: number
  totalAccounts: number
  totalSavings: number
  totalLoans: number
  totalOutstandingBalance: number
  activeLoans: number
  totalShares: number
  totalSharesCount: number
  totalExpenses: number
}

const TABS = [
  { id: "summary", label: "Summary", icon: BarChart3 },
  { id: "savings", label: "Savings", icon: DollarSign },
  { id: "loans", label: "Loans", icon: FileText },
  { id: "members", label: "Members", icon: Users },
  { id: "financial", label: "Financial", icon: TrendingUp },
  { id: "audit", label: "Audit", icon: Shield },
] as const

type TabId = (typeof TABS)[number]["id"]

const TAB_TITLES: Record<TabId, string> = {
  summary: "Bank Summary Report",
  savings: "Savings Report",
  loans: "Loans Report",
  members: "Members Report",
  financial: "Financial Report",
  audit: "Audit Report",
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("summary")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [emailLoading, setEmailLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const [savingsReport, setSavingsReport] = useState<SavingsReport>({ totalDeposits: 0, totalWithdrawals: 0, netSavings: 0, transactionCount: 0, recentTransactions: [] })
  const [loansReport, setLoansReport] = useState<LoansReport>({ totalLoans: 0, activeLoans: 0, totalDisbursed: 0, totalRepaid: 0, outstandingBalance: 0, recentLoans: [] })
  const [membersReport, setMembersReport] = useState<MembersReport>({ totalMembers: 0, activeMembers: 0, newThisMonth: 0, genderDistribution: { male: 0, female: 0 } })
  const [financialReport, setFinancialReport] = useState<FinancialReport>({ totalAssets: 0, totalLiabilities: 0, netWorth: 0, totalExpenses: 0, totalIncome: 0 })
  const [summaryReport, setSummaryReport] = useState<SummaryReport>({ totalMembers: 0, totalAccounts: 0, totalSavings: 0, totalLoans: 0, totalOutstandingBalance: 0, activeLoans: 0, totalShares: 0, totalSharesCount: 0, totalExpenses: 0 })
  const [chargesReport, setChargesReport] = useState<{ withdrawalFees: number; loanInterest: number; smsCharges: number; totalCharges: number; withdrawalCount: number; loanCount: number }>({ withdrawalFees: 0, loanInterest: 0, smsCharges: 0, totalCharges: 0, withdrawalCount: 0, loanCount: 0 })

  const fetchReport = useCallback(async (tab: TabId) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      if (tab === "savings") {
        const res = await fetch(`/api/savings?${params}`)
        if (res.ok) {
          const data = await res.json()
          setSavingsReport({
            totalDeposits: data.summary?.totalDeposits || 0,
            totalWithdrawals: data.summary?.totalWithdrawals || 0,
            netSavings: data.summary?.netSavings || 0,
            transactionCount: (data.transactions || []).length,
            recentTransactions: (data.transactions || []).slice(0, 5),
          })
        }
      } else if (tab === "summary") {
        const res = await fetch(`/api/dashboard`)
        if (res.ok) {
          const data = await res.json()
          setSummaryReport({
            totalMembers: data.totalMembers || 0,
            totalAccounts: data.totalAccounts || 0,
            totalSavings: data.totalSavings || 0,
            totalLoans: data.totalLoans || 0,
            totalOutstandingBalance: data.totalOutstandingBalance || 0,
            activeLoans: data.activeLoans || 0,
            totalShares: data.totalShares || 0,
            totalSharesCount: data.totalSharesCount || 0,
            totalExpenses: data.totalExpenses || 0,
          })
        }
      } else if (tab === "loans") {
        const res = await fetch(`/api/loans?${params}`)
        if (res.ok) {
          const data = await res.json()
          const loans = data.loans || data.data || []
          setLoansReport({
            totalLoans: loans.length,
            activeLoans: loans.filter((l: Record<string, unknown>) => l.loanStatus === "Active").length,
            totalDisbursed: loans.reduce((s: number, l: Record<string, unknown>) => s + ((l.principalAmount as number) || 0), 0),
            totalRepaid: 0,
            outstandingBalance: loans.reduce((s: number, l: Record<string, unknown>) => s + ((l.currentBalance as number) || 0), 0),
            recentLoans: loans.slice(0, 5).map((l: Record<string, unknown>) => ({
              id: l.id as number,
              loanCode: l.loanCode as string,
              memberName: (l.member as Record<string, unknown>)?.farmerName as string || "",
              principalAmount: l.principalAmount as number,
              loanStatus: l.loanStatus as string,
              disbursementDate: l.disbursementDate as string,
            })),
          })
        }
      } else if (tab === "members") {
        const res = await fetch(`/api/members?pageSize=1000`)
        if (res.ok) {
          const data = await res.json()
          const members = data.data || []
          const now = new Date()
          setMembersReport({
            totalMembers: data.total || members.length,
            activeMembers: members.filter((m: Record<string, unknown>) => m.status === "Active").length,
            newThisMonth: members.filter((m: Record<string, unknown>) => {
              const d = new Date(m.registrationDate as string)
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length,
            genderDistribution: {
              male: members.filter((m: Record<string, unknown>) => m.gender === "Male").length,
              female: members.filter((m: Record<string, unknown>) => m.gender === "Female").length,
            },
          })
        }
      } else if (tab === "financial") {
        const [expRes, savingsRes, loansRes, smsRes] = await Promise.all([
          fetch(`/api/expenses?${params}`),
          fetch(`/api/savings?${params}`),
          fetch(`/api/loans?${params}`),
          fetch(`/api/sms?${params}`),
        ])
        const expData = expRes.ok ? await expRes.json() : { summary: { totalExpenses: 0 } }
        const savData = savingsRes.ok ? await savingsRes.json() : { summary: { totalDeposits: 0 }, transactions: [] }
        const loansData = loansRes.ok ? await loansRes.json() : { data: [] }
        const smsData = smsRes.ok ? await smsRes.json() : { logs: [] }

        const transactions = savData.transactions || []
        const withdrawals = transactions.filter((t: Record<string, unknown>) => t.transactionType === "Withdrawal")
        const withdrawalFees = withdrawals.reduce((s: number, t: Record<string, unknown>) => s + ((t.withdrawalFee as number) || 0), 0)
        const withdrawalCount = withdrawals.length

        const loans = loansData.data || loansData.loans || []
        const activeLoans = loans.filter((l: Record<string, unknown>) => l.loanStatus === "Active")
        const totalDisbursed = activeLoans.reduce((s: number, l: Record<string, unknown>) => s + ((l.principalAmount as number) || 0), 0)
        const loanInterest = activeLoans.reduce((s: number, l: Record<string, unknown>) => {
          const principal = (l.principalAmount as number) || 0
          const rate = (l.interestRate as number) || 2.5
          return s + principal * (rate / 100)
        }, 0)

        const smsLogs = smsData.logs || smsData.data || []
        const smsCharges = smsLogs.length * 35

        setFinancialReport({
          totalAssets: savData.summary?.totalDeposits || 0,
          totalLiabilities: loansData.summary?.outstandingBalance || activeLoans.reduce((s: number, l: Record<string, unknown>) => s + ((l.currentBalance as number) || 0), 0),
          netWorth: (savData.summary?.totalDeposits || 0) - (expData.summary?.totalExpenses || 0),
          totalExpenses: expData.summary?.totalExpenses || 0,
          totalIncome: savData.summary?.totalDeposits || 0,
        })
        setChargesReport({
          withdrawalFees,
          loanInterest,
          smsCharges,
          totalCharges: withdrawalFees + loanInterest + smsCharges,
          withdrawalCount,
          loanCount: activeLoans.length,
        })
      }
    } catch (err) {
      console.error("Failed to fetch report:", err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport(activeTab) }, [activeTab, fetchReport])

  const handlePrint = () => { window.print() }

  const handleSendEmail = async () => {
    setEmailLoading(true)
    try {
      const endpoint = activeTab === "savings" || activeTab === "financial" || activeTab === "audit"
        ? "/api/reports/daily"
        : activeTab === "loans"
        ? "/api/reports/weekly"
        : "/api/reports/monthly"
      const res = await fetch(endpoint, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        alert(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} report sent to email successfully!`)
      } else {
        alert(`Failed to send: ${data.error || "Unknown error"}`)
      }
    } catch {
      alert("Failed to send report email")
    } finally {
      setEmailLoading(false)
    }
  }

  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL("image/jpeg", 0.8))
        } else {
          resolve("")
        }
      }
      img.onerror = () => resolve("")
      img.src = src
    })
  }

  const drawPdfHeader = async (doc: jsPDF, title: string) => {
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header background
    doc.setFillColor(30, 58, 95) // #1e3a5f
    doc.rect(0, 0, pageWidth, 42, "F")

    // Gold accent line
    doc.setFillColor(212, 168, 67) // #d4a843
    doc.rect(0, 42, pageWidth, 2, "F")

    // Logo
    const logoBase64 = await loadImageAsBase64("/badge.jpg")
    if (logoBase64) {
      doc.addImage(logoBase64, "JPEG", 14, 6, 28, 28)
    }

    // Title text
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text("KATAHO FARMERS SACCO - MUTARA", logoBase64 ? 48 : pageWidth / 2, 16, { align: logoBase64 ? "left" : "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(200, 200, 200)
    doc.text("Saving for our Future", logoBase64 ? 48 : pageWidth / 2, 23, { align: logoBase64 ? "left" : "center" })

    // Report title
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(212, 168, 67) // gold
    doc.text(title, logoBase64 ? 48 : pageWidth / 2, 31, { align: logoBase64 ? "left" : "center" })

    // Date on right side
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(180, 180, 180)
    const dateRange = dateFrom && dateTo ? `Period: ${dateFrom} to ${dateTo}` : `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`
    doc.text(dateRange, pageWidth - 14, 16, { align: "right" })

    return 50 // return Y position after header
  }

  const drawPdfFooter = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Footer line
    doc.setFillColor(212, 168, 67)
    doc.rect(14, pageHeight - 18, pageWidth - 28, 0.5, "F")

    // Footer text
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(130, 130, 130)
    doc.text("Kataho Farmers SACCO - Mutara | Saving for our Future", 14, pageHeight - 13)
    doc.text("Designed by NobTechWorld | 0771 918 116", pageWidth - 14, pageHeight - 13, { align: "right" })
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      const y = await drawPdfHeader(doc, TAB_TITLES[activeTab])

      // Green section header
      const sectionHeader = (text: string, yPos: number) => {
        doc.setFillColor(30, 58, 95)
        doc.roundedRect(14, yPos, pageWidth - 28, 8, 1, 1, "F")
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(255, 255, 255)
        doc.text(text, 18, yPos + 5.5)
        return yPos + 12
      }

      // Gold-highlighted summary row
      const highlightRow = (label: string, value: string, yPos: number) => {
        doc.setFillColor(254, 249, 235) // light gold bg
        doc.rect(14, yPos, pageWidth - 28, 8, "F")
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(60, 60, 60)
        doc.text(label, 18, yPos + 5.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(30, 58, 95)
        doc.text(value, pageWidth - 18, yPos + 5.5, { align: "right" })
        return yPos + 8
      }

      let curY = y

      if (activeTab === "summary") {
        // Key Metrics
        curY = sectionHeader("KEY METRICS", curY)
        curY = highlightRow("Total Members", String(summaryReport.totalMembers), curY)
        curY = highlightRow("Total Active Accounts", String(summaryReport.totalAccounts), curY)
        curY = highlightRow("Active Loans", String(summaryReport.activeLoans), curY)
        curY += 4

        curY = sectionHeader("SAVINGS & DEPOSITS", curY)
        curY = highlightRow("Total Savings (Deposits)", formatUGX(summaryReport.totalSavings), curY)
        curY += 4

        curY = sectionHeader("LOANS", curY)
        curY = highlightRow("Total Loans Disbursed", formatUGX(summaryReport.totalLoans), curY)
        curY = highlightRow("Outstanding Loan Balance", formatUGX(summaryReport.totalOutstandingBalance), curY)
        curY += 4

        curY = sectionHeader("SHARES", curY)
        curY = highlightRow("Total Shares Count", `${summaryReport.totalSharesCount.toLocaleString()} shares`, curY)
        curY = highlightRow("Total Shares Value", formatUGX(summaryReport.totalShares), curY)
        curY += 4

        curY = sectionHeader("EXPENSES", curY)
        curY = highlightRow("Total Expenses", formatUGX(summaryReport.totalExpenses), curY)
      } else if (activeTab === "savings") {
        curY = sectionHeader("SAVINGS SUMMARY", curY)
        curY = highlightRow("Total Deposits", formatUGX(savingsReport.totalDeposits), curY)
        curY = highlightRow("Total Withdrawals", formatUGX(savingsReport.totalWithdrawals), curY)
        curY = highlightRow("Net Savings", formatUGX(savingsReport.netSavings), curY)
        curY += 6

        if (savingsReport.recentTransactions.length > 0) {
          curY = sectionHeader("RECENT TRANSACTIONS", curY)
          autoTable(doc, {
            startY: curY,
            head: [["Type", "Member", "Amount", "Date"]],
            body: savingsReport.recentTransactions.map(t => [
              t.transactionType,
              t.memberName,
              formatUGX(t.amount),
              formatDate(t.transactionDate),
            ]),
            headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 14, right: 14 },
          })
        }
      } else if (activeTab === "loans") {
        curY = sectionHeader("LOANS SUMMARY", curY)
        curY = highlightRow("Total Loans", String(loansReport.totalLoans), curY)
        curY = highlightRow("Active Loans", String(loansReport.activeLoans), curY)
        curY = highlightRow("Total Disbursed", formatUGX(loansReport.totalDisbursed), curY)
        curY = highlightRow("Outstanding Balance", formatUGX(loansReport.outstandingBalance), curY)
        curY += 6

        if (loansReport.recentLoans.length > 0) {
          curY = sectionHeader("RECENT LOANS", curY)
          autoTable(doc, {
            startY: curY,
            head: [["Code", "Member", "Amount", "Status"]],
            body: loansReport.recentLoans.map(l => [
              l.loanCode,
              l.memberName,
              formatUGX(l.principalAmount),
              l.loanStatus,
            ]),
            headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 14, right: 14 },
          })
        }
      } else if (activeTab === "members") {
        curY = sectionHeader("MEMBERS SUMMARY", curY)
        curY = highlightRow("Total Members", String(membersReport.totalMembers), curY)
        curY = highlightRow("Active Members", String(membersReport.activeMembers), curY)
        curY = highlightRow("New This Month", String(membersReport.newThisMonth), curY)
        curY += 4

        curY = sectionHeader("GENDER DISTRIBUTION", curY)
        curY = highlightRow("Male", String(membersReport.genderDistribution.male), curY)
        curY = highlightRow("Female", String(membersReport.genderDistribution.female), curY)
      } else if (activeTab === "financial") {
        curY = sectionHeader("FINANCIAL SUMMARY", curY)
        curY = highlightRow("Total Income", formatUGX(financialReport.totalIncome), curY)
        curY = highlightRow("Total Expenses", formatUGX(financialReport.totalExpenses), curY)
        curY = highlightRow("Net Worth", formatUGX(financialReport.netWorth), curY)
        curY += 6

        curY = sectionHeader("TRANSACTION CHARGES", curY)
        autoTable(doc, {
          startY: curY,
          head: [["Charge Type", "Amount", "Details"]],
          body: [
            ["Withdrawal Fees", formatUGX(chargesReport.withdrawalFees), `${chargesReport.withdrawalCount} x UGX 500`],
            ["Loan Interest", formatUGX(chargesReport.loanInterest), `${chargesReport.loanCount} active loans`],
            ["SMS Charges", formatUGX(chargesReport.smsCharges), "UGX 35/SMS"],
            ["Total Charges", formatUGX(chargesReport.totalCharges), ""],
          ],
          headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
        })
      }

      drawPdfFooter(doc)
      doc.save(`KAFS_${activeTab}_report_${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
      alert("Failed to generate PDF")
    } finally {
      setPdfLoading(false)
    }
  }

  const savingsColumns = [
    { key: "transactionType", header: "Type", render: (item: Record<string, unknown>) => <Badge variant={item.transactionType === "Deposit" ? "success" : "warning"}>{item.transactionType as string}</Badge> },
    { key: "amount", header: "Amount", className: "text-right", render: (item: Record<string, unknown>) => <span className="font-semibold">{formatUGX(item.amount as number)}</span> },
    { key: "transactionDate", header: "Date", render: (item: Record<string, unknown>) => <span className="text-xs">{formatDate(item.transactionDate as string)}</span> },
  ]

  const loansColumns = [
    { key: "loanCode", header: "Code", render: (item: Record<string, unknown>) => <span className="font-mono text-xs">{item.loanCode as string}</span> },
    { key: "memberName", header: "Member", render: (item: Record<string, unknown>) => <span>{item.memberName as string}</span> },
    { key: "principalAmount", header: "Amount", className: "text-right", render: (item: Record<string, unknown>) => <span className="font-semibold">{formatUGX(item.principalAmount as number)}</span> },
    { key: "loanStatus", header: "Status", render: (item: Record<string, unknown>) => <Badge variant={item.loanStatus === "Active" ? "success" : "default"}>{item.loanStatus as string}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="View SACCO reports and analytics"
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" icon={<Mail className="w-4 h-4" />} onClick={handleSendEmail} loading={emailLoading}>
              Email Report
            </Button>
            <Button variant="outline" icon={<Download className="w-4 h-4" />} onClick={handleDownloadPDF} loading={pdfLoading}>
              Download PDF
            </Button>
            <Button variant="outline" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="max-w-[180px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="max-w-[180px]" placeholder="To" />
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 no-print">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Printable report header */}
      <div ref={reportRef} className="hidden print:block print:mb-4">
        <div className="flex items-center gap-4 border-b-2 border-[#1e3a5f] pb-3">
          <img src="/badge.jpg" alt="KAFS SACCO" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-[#1e3a5f]">KATAHO FARMERS SACCO - MUTARA</h1>
            <p className="text-sm text-gray-600">Saving for our Future</p>
            <p className="text-sm font-semibold text-[#d4a843]">{TAB_TITLES[activeTab]}</p>
          </div>
          <div className="ml-auto text-right text-xs text-gray-500">
            <p>{dateFrom && dateTo ? `Period: ${dateFrom} to ${dateTo}` : `Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`}</p>
          </div>
        </div>
      </div>

      {/* On-screen report header */}
      <Card className="p-4 no-print">
        <div className="flex items-center gap-4">
          <img src="/badge.jpg" alt="KAFS SACCO" className="w-14 h-14 rounded-lg object-contain border border-gray-200 dark:border-gray-700" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">KATAHO FARMERS SACCO - MUTARA</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Saving for our Future</p>
            <p className="text-sm font-semibold text-[var(--color-gold)] mt-0.5">{TAB_TITLES[activeTab]}</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>{dateFrom && dateTo ? `Period: ${dateFrom} to ${dateTo}` : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </Card>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Members" value={summaryReport.totalMembers} icon={<Users className="w-5 h-5" />} />
            <MetricCard label="Total Accounts" value={summaryReport.totalAccounts} icon={<Landmark className="w-5 h-5" />} />
            <MetricCard label="Total Savings" value={formatUGX(summaryReport.totalSavings)} icon={<PiggyBank className="w-5 h-5" />} />
            <MetricCard label="Total Loans Disbursed" value={formatUGX(summaryReport.totalLoans)} icon={<CreditCard className="w-5 h-5" />} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Outstanding Loan Balance" value={formatUGX(summaryReport.totalOutstandingBalance)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Active Loans" value={summaryReport.activeLoans} icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Total Shares Value" value={formatUGX(summaryReport.totalShares)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Total Shares Count" value={`${summaryReport.totalSharesCount.toLocaleString()} shares`} icon={<BarChart3 className="w-5 h-5" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <PiggyBank className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Savings & Deposits</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Savings</span>
                  <span className="text-base font-bold text-green-600 dark:text-green-400">{formatUGX(summaryReport.totalSavings)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-orange-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Loans Portfolio</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Disbursed</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{formatUGX(summaryReport.totalLoans)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Outstanding Balance</span>
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">{formatUGX(summaryReport.totalOutstandingBalance)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active Loans</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{summaryReport.activeLoans}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-[var(--color-gold)]" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Shares</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Shares</span>
                  <span className="text-base font-bold text-[var(--color-gold)]">{summaryReport.totalSharesCount.toLocaleString()} shares</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Value</span>
                  <span className="text-base font-bold text-[var(--color-gold)]">{formatUGX(summaryReport.totalShares)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Expenses</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</span>
                  <span className="text-base font-bold text-red-600 dark:text-red-400">{formatUGX(summaryReport.totalExpenses)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "savings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Total Deposits" value={formatUGX(savingsReport.totalDeposits)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Total Withdrawals" value={formatUGX(savingsReport.totalWithdrawals)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Net Savings" value={formatUGX(savingsReport.netSavings)} icon={<DollarSign className="w-5 h-5" />} />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Savings Transactions</h3>
            </div>
            <Table columns={savingsColumns} data={savingsReport.recentTransactions as unknown as Record<string, unknown>[]} emptyMessage="No transactions found" />
          </div>
        </div>
      )}

      {activeTab === "loans" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Total Loans" value={loansReport.totalLoans} icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Active Loans" value={loansReport.activeLoans} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Outstanding Balance" value={formatUGX(loansReport.outstandingBalance)} icon={<DollarSign className="w-5 h-5" />} />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Loans</h3>
            </div>
            <Table columns={loansColumns} data={loansReport.recentLoans as unknown as Record<string, unknown>[]} emptyMessage="No loans found" />
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Total Members" value={membersReport.totalMembers} icon={<Users className="w-5 h-5" />} />
            <MetricCard label="Active Members" value={membersReport.activeMembers} icon={<Users className="w-5 h-5" />} />
            <MetricCard label="New This Month" value={membersReport.newThisMonth} icon={<Calendar className="w-5 h-5" />} />
          </div>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Gender Distribution</h3>
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{membersReport.genderDistribution.male}</p>
                <p className="text-sm text-gray-500">Male</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{membersReport.genderDistribution.female}</p>
                <p className="text-sm text-gray-500">Female</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "financial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Total Income" value={formatUGX(financialReport.totalIncome)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Total Expenses" value={formatUGX(financialReport.totalExpenses)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Net Worth" value={formatUGX(financialReport.netWorth)} icon={<DollarSign className="w-5 h-5" />} />
          </div>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Transaction Charges Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Withdrawal Fees</p>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{formatUGX(chargesReport.withdrawalFees)}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{chargesReport.withdrawalCount} withdrawals x UGX 500</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Loan Interest</p>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">{formatUGX(chargesReport.loanInterest)}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{chargesReport.loanCount} active loans (2.5% p.a.)</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">SMS Charges</p>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200">{formatUGX(chargesReport.smsCharges)}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">UGX 35 per SMS sent</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
                  <p className="text-sm font-medium text-[var(--color-primary)]">Total Charges</p>
                </div>
                <p className="text-2xl font-bold text-[var(--color-primary)]">{formatUGX(chargesReport.totalCharges)}</p>
                <p className="text-xs text-[var(--color-primary)]/70 mt-1">All transaction fees</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Charges Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">Withdrawal Fee (UGX 500 per withdrawal)</span>
                <span className="text-sm font-semibold">{formatUGX(chargesReport.withdrawalFees)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">Loan Interest (2.5% p.a. reducing balance)</span>
                <span className="text-sm font-semibold">{formatUGX(chargesReport.loanInterest)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">SMS Notification Charges (UGX 35/SMS)</span>
                <span className="text-sm font-semibold">{formatUGX(chargesReport.smsCharges)}</span>
              </div>
              <div className="flex justify-between items-center py-2 font-bold">
                <span className="text-sm text-gray-900 dark:text-white">Total Transaction Charges</span>
                <span className="text-sm text-[var(--color-primary)]">{formatUGX(chargesReport.totalCharges)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <Card className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Audit report data loads from the Audit Trail page.</p>
          <p className="text-sm text-gray-400 mt-1">Navigate to Audit Trail for detailed logs.</p>
        </Card>
      )}
    </div>
  )
}
