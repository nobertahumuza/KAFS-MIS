"use client"

import { useState } from "react"
import { User, Wallet, TrendingDown, TrendingUp, Landmark, PiggyBank, Download, LogOut, Eye, EyeOff, Clock } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface MemberData {
  member: {
    id: number
    memberCode: string
    farmerName: string
    gender: string | null
    phoneNumber: string | null
    email: string | null
    village: string | null
    parish: string | null
    district: string | null
    subCounty: string | null
    occupation: string | null
    nextOfKinName: string | null
    nextOfKinPhone: string | null
    mainProduce: string | null
    totalShares: number | null
    shareValue: number | null
    registrationDate: string
    status: string | null
  }
  savings: {
    currentBalance: number
    totalDeposits: number
    totalWithdrawals: number
  }
  loans: {
    total: number
    active: number
    totalBalance: number
    list: Array<{
      id: number
      loanCode: string
      principalAmount: number
      currentBalance: number
      loanStatus: string
      disbursementDate: string
      dueDate: string | null
      interestRate: number
    }>
  }
  shares: {
    totalShares: number
    shareValue: number
    list: Array<{
      id: number
      sharesQuantity: number
      sharePrice: number
      totalAmount: number
      transactionType: string
      referenceNumber: string
      transactionDate: string
    }>
  }
  fixedAccounts: Array<{
    id: number
    fixedCode: string
    principalAmount: number
    interestRate: number
    interestEarned: number
    maturityAmount: number
    startDate: string
    maturityDate: string
    status: string
  }>
  recentTransactions: Array<{
    id: number
    transactionType: string
    amount: number
    balanceAfter: number
    narration: string | null
    referenceNumber: string
    transactionDate: string
  }>
  loanRepayments: Array<{
    id: number
    amountPaid: number
    finePaid: number
    balanceAfter: number
    paymentDate: string
    referenceNumber: string
    loan: { loanCode: string }
  }>
}

type Tab = "overview" | "savings" | "loans" | "shares" | "fixed"

export default function MemberPortalPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [memberCode, setMemberCode] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [data, setData] = useState<MemberData | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("overview")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)
    try {
      const res = await fetch("/api/member-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberCode: memberCode.trim(), phoneNumber: phoneNumber.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Login failed")
      }
      const d = await res.json()
      setData(d)
      setLoggedIn(true)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    setLoggedIn(false)
    setData(null)
    setMemberCode("")
    setPhoneNumber("")
    setActiveTab("overview")
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: User },
    { key: "savings", label: "Savings", icon: PiggyBank },
    { key: "loans", label: "Loans", icon: Landmark },
    { key: "shares", label: "Shares", icon: TrendingUp },
    { key: "fixed", label: "Fixed Deposits", icon: Wallet },
  ]

  if (!loggedIn || !data) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src="/badge.jpg" alt="KAFS SACCO" className="inline-block w-20 h-20 rounded-full object-cover mb-4" />
            <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-white">Member Portal</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Access your SACCO account information</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {loginError}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-5">
              <Input label="Member Code" value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="e.g. KAFS-001" required />
              <div className="relative">
                <Input
                  label="Phone Number"
                  type={showPassword ? "text" : "password"}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" loading={loginLoading} className="w-full">
                Access My Account
              </Button>
            </form>
          </div>
          <p className="text-center text-gray-400 text-xs mt-6">
            Designed by NobTechWorld · WhatsApp: +256 760 399 849
          </p>
        </div>
      </div>
    )
  }

  const m = data.member
  const totalAssetValue = data.savings.currentBalance + data.shares.shareValue + data.fixedAccounts.filter(f => f.status === "Active").reduce((s, f) => s + f.maturityAmount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${m.farmerName}`}
        subtitle={`Member Code: ${m.memberCode}`}
        actions={
          <Button variant="outline" icon={<LogOut className="w-4 h-4" />} onClick={handleLogout}>
            Logout
          </Button>
        }
      />

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Savings Balance" value={formatUGX(data.savings.currentBalance)} icon={<PiggyBank className="w-5 h-5" />} />
            <MetricCard label="Active Loans" value={`${data.loans.active} (${formatUGX(data.loans.totalBalance)})`} icon={<Landmark className="w-5 h-5" />} />
            <MetricCard label="Total Shares" value={`${data.shares.totalShares} (${formatUGX(data.shares.shareValue)})`} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Total Asset Value" value={formatUGX(totalAssetValue)} icon={<Wallet className="w-5 h-5" />} />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              My Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Full Name", value: m.farmerName },
                { label: "Gender", value: m.gender || "—" },
                { label: "Phone", value: m.phoneNumber || "—" },
                { label: "Email", value: m.email || "—" },
                { label: "Village", value: m.village || "—" },
                { label: "Parish", value: m.parish || "—" },
                { label: "District", value: m.district || "—" },
                { label: "Sub County", value: m.subCounty || "—" },
                { label: "Occupation", value: m.occupation || "—" },
                { label: "Main Produce", value: m.mainProduce || "—" },
                { label: "Next of Kin", value: m.nextOfKinName || "—" },
                { label: "Next of Kin Phone", value: m.nextOfKinPhone || "—" },
                { label: "Registration Date", value: formatDate(m.registrationDate) },
                { label: "Status", value: m.status || "Active" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {data.recentTransactions.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Transactions
              </h3>
              <div className="space-y-2">
                {data.recentTransactions.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium">{t.transactionType}</p>
                      <p className="text-xs text-gray-500">{t.referenceNumber} • {formatDate(t.transactionDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${t.transactionType === "Deposit" ? "text-green-600" : "text-red-600"}`}>
                        {t.transactionType === "Deposit" ? "+" : "-"}{formatUGX(t.amount)}
                      </p>
                      <p className="text-xs text-gray-500">Bal: {formatUGX(t.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "savings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Current Balance" value={formatUGX(data.savings.currentBalance)} icon={<PiggyBank className="w-5 h-5" />} />
            <MetricCard label="Total Deposits" value={formatUGX(data.savings.totalDeposits)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Total Withdrawals" value={formatUGX(data.savings.totalWithdrawals)} icon={<TrendingDown className="w-5 h-5" />} />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
            <div className="space-y-2">
              {data.recentTransactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No transactions yet</p>
              ) : (
                data.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium">{t.transactionType}</p>
                      <p className="text-xs text-gray-500">{t.referenceNumber} • {formatDate(t.transactionDate)}</p>
                      {t.narration && <p className="text-xs text-gray-400">{t.narration}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${t.transactionType === "Deposit" ? "text-green-600" : "text-red-600"}`}>
                        {t.transactionType === "Deposit" ? "+" : "-"}{formatUGX(t.amount)}
                      </p>
                      <p className="text-xs text-gray-500">Bal: {formatUGX(t.balanceAfter)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "loans" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Total Loans" value={String(data.loans.total)} icon={<Landmark className="w-5 h-5" />} />
            <MetricCard label="Active Loans" value={String(data.loans.active)} icon={<TrendingDown className="w-5 h-5" />} />
            <MetricCard label="Outstanding Balance" value={formatUGX(data.loans.totalBalance)} icon={<Wallet className="w-5 h-5" />} />
          </div>
          {data.loans.list.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-8 text-center">
              <Landmark className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No loans found</p>
            </div>
          ) : (
            data.loans.list.map((loan) => (
              <div key={loan.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{loan.loanCode}</h4>
                    <p className="text-sm text-gray-500">Disbursed: {formatDate(loan.disbursementDate)}</p>
                  </div>
                  <Badge variant={loan.loanStatus === "Active" ? "warning" : loan.loanStatus === "Cleared" ? "success" : "default"}>
                    {loan.loanStatus}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="text-sm font-semibold">{formatUGX(loan.principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Outstanding</p>
                    <p className="text-sm font-semibold text-red-600">{formatUGX(loan.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Rate</p>
                    <p className="text-sm font-semibold">{loan.interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Due Date</p>
                    <p className="text-sm font-semibold">{loan.dueDate ? formatDate(loan.dueDate) : "—"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {data.loanRepayments.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Repayment History</h3>
              <div className="space-y-2">
                {data.loanRepayments.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium">Repayment — {r.loan.loanCode}</p>
                      <p className="text-xs text-gray-500">{r.referenceNumber} • {formatDate(r.paymentDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">+{formatUGX(r.amountPaid)}</p>
                      {r.finePaid > 0 && <p className="text-xs text-orange-500">Fine: {formatUGX(r.finePaid)}</p>}
                      <p className="text-xs text-gray-500">Bal: {formatUGX(r.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "shares" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard label="Total Shares" value={String(data.shares.totalShares)} icon={<TrendingUp className="w-5 h-5" />} />
            <MetricCard label="Share Value" value={formatUGX(data.shares.shareValue)} icon={<Wallet className="w-5 h-5" />} />
          </div>
          {data.shares.list.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Share Transactions</h3>
              <div className="space-y-2">
                {data.shares.list.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium">{s.transactionType} — {s.sharesQuantity} shares</p>
                      <p className="text-xs text-gray-500">{s.referenceNumber} • {formatDate(s.transactionDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatUGX(s.totalAmount)}</p>
                      <p className="text-xs text-gray-500">@ {formatUGX(s.sharePrice)}/share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "fixed" && (
        <div className="space-y-6">
          {data.fixedAccounts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-8 text-center">
              <Wallet className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No fixed deposits found</p>
            </div>
          ) : (
            data.fixedAccounts.map((fa) => (
              <div key={fa.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{fa.fixedCode}</h4>
                    <p className="text-sm text-gray-500">Started: {formatDate(fa.startDate)}</p>
                  </div>
                  <Badge variant={fa.status === "Active" ? "warning" : fa.status === "Matured" ? "success" : "default"}>
                    {fa.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Principal</p>
                    <p className="text-sm font-semibold">{formatUGX(fa.principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Rate</p>
                    <p className="text-sm font-semibold">{fa.interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Interest Earned</p>
                    <p className="text-sm font-semibold text-green-600">{formatUGX(fa.interestEarned)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Maturity Amount</p>
                    <p className="text-sm font-bold text-[var(--color-primary)]">{formatUGX(fa.maturityAmount)}</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Maturity Date: {formatDate(fa.maturityDate)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="text-center text-xs text-gray-400 py-4">
        Designed by NobTechWorld · WhatsApp: +256 760 399 849 · © {new Date().getFullYear()} KATAHO FARMERS&apos; SACCO
      </div>
    </div>
  )
}
