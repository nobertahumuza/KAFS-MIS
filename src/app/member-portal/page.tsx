"use client"

import { useState, useCallback, useRef } from "react"
import { User, Wallet, TrendingDown, TrendingUp, Landmark, PiggyBank, LogOut, Eye, EyeOff, Clock, CreditCard, CheckCircle, AlertCircle, Camera } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"
import CelebrationPopup from "@/components/ui/CelebrationPopup"

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
    photoUrl?: string | null
  }
  savings: { currentBalance: number; totalDeposits: number; totalWithdrawals: number }
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
  const [celebration, setCelebration] = useState<{ open: boolean; type: "deposit" | "withdrawal" | "loan" | "share" | "fixed" | "repayment"; amount: number; balance?: number; reference?: string; charges?: number; message?: string }>({ open: false, type: "deposit", amount: 0 })

  const [payLoanOpen, setPayLoanOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payError, setPayError] = useState("")
  const [payLoading, setPayLoading] = useState(false)

  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !data) return
    setPhotoUploading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch(`/api/members/${data.member.id}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: base64 }),
      })
      if (!res.ok) throw new Error("Upload failed")
      setData({ ...data, member: { ...data.member, photoUrl: base64 } })
      setCelebration({
        open: true,
        type: "deposit",
        amount: 0,
        reference: "PHOTO",
        message: "Your photo has been uploaded successfully!",
      })
    } catch {
      setPayError("Failed to upload photo")
    } finally {
      setPhotoUploading(false)
    }
  }

  const fetchMemberData = useCallback(async (code: string, phone: string) => {
    const res = await fetch("/api/member-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: code, phoneNumber: phone }),
    })
    if (!res.ok) throw new Error("Login failed")
    return res.json()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)
    try {
      const d = await fetchMemberData(memberCode.trim(), phoneNumber.trim())
      setData(d)
      setLoggedIn(true)
      setTimeout(() => {
        setCelebration({
          open: true,
          type: "deposit",
          amount: d.savings.currentBalance,
          balance: d.savings.currentBalance,
          reference: "WELCOME",
          message: `Welcome back, ${d.member.farmerName}! Your savings balance is ${formatUGX(d.savings.currentBalance)}.`,
        })
      }, 600)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Invalid member code or phone number")
    } finally {
      setLoginLoading(false)
    }
  }

  const handlePayLoan = async () => {
    if (!selectedLoanId || !payAmount || parseFloat(payAmount) <= 0) return
    setPayError("")
    setPayLoading(true)
    try {
      const res = await fetch("/api/member-portal/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: memberCode.trim(),
          phoneNumber: phoneNumber.trim(),
          loanId: selectedLoanId,
          amountPaid: parseFloat(payAmount),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Payment failed")
      }
      const result = await res.json()
      setPayLoanOpen(false)
      setPayAmount("")
      setSelectedLoanId(null)

      const d = await fetchMemberData(memberCode.trim(), phoneNumber.trim())
      setData(d)

      setCelebration({
        open: true,
        type: "repayment",
        amount: parseFloat(payAmount),
        balance: result.newBalance,
        reference: result.repayment.referenceNumber,
        message: result.loanCleared
          ? "Congratulations! You have fully cleared your loan!"
          : `Loan repayment of ${formatUGX(parseFloat(payAmount))} received. Outstanding balance: ${formatUGX(result.newBalance)}.`,
      })
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setPayLoading(false)
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" loading={loginLoading} className="w-full">Access My Account</Button>
            </form>
          </div>
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
          <Button variant="outline" icon={<LogOut className="w-4 h-4" />} onClick={handleLogout}>Logout</Button>
        }
      />

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key ? "bg-[var(--color-primary)] text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}>
              <Icon className="w-4 h-4" />{tab.label}
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
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5" />My Profile
              </h3>
              <div className="flex flex-col items-center gap-2">
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt="Member photo" className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-primary)]" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
                    <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                      {m.farmerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" ref={photoInputRef} onChange={handlePhotoUpload} />
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity">
                    <Camera className="w-3.5 h-3.5" />
                    {photoUploading ? "Uploading..." : "Upload Photo"}
                  </span>
                </label>
              </div>
            </div>
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
                <Clock className="w-5 h-5" />Recent Transactions
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
            data.loans.list.map((loan) => {
              const paidAmount = loan.principalAmount - loan.currentBalance
              const paidPercent = loan.principalAmount > 0 ? (paidAmount / loan.principalAmount) * 100 : 0
              return (
                <div key={loan.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {loan.loanCode}
                        <Badge variant={loan.loanStatus === "Active" ? "warning" : loan.loanStatus === "Cleared" ? "success" : "default"}>
                          {loan.loanStatus}
                        </Badge>
                      </h4>
                      <p className="text-sm text-gray-500">Disbursed: {formatDate(loan.disbursementDate)}</p>
                    </div>
                    {loan.loanStatus === "Active" && (
                      <Button size="sm" icon={<CreditCard className="w-4 h-4" />}
                        onClick={() => { setSelectedLoanId(loan.id); setPayLoanOpen(true); setPayAmount(""); setPayError("") }}>
                        Pay Loan
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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
                      <p className="text-sm font-semibold">{loan.interestRate}% p.a.</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Due Date</p>
                      <p className="text-sm font-semibold">{loan.dueDate ? formatDate(loan.dueDate) : "—"}</p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Repayment Progress</span>
                      <span>{paidPercent.toFixed(1)}% paid</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Paid: {formatUGX(paidAmount)} of {formatUGX(loan.principalAmount)}</p>
                  </div>
                </div>
              )
            })
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
                  <Badge variant={fa.status === "Active" ? "warning" : fa.status === "Matured" ? "success" : "default"}>{fa.status}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div><p className="text-xs text-gray-500">Principal</p><p className="text-sm font-semibold">{formatUGX(fa.principalAmount)}</p></div>
                  <div><p className="text-xs text-gray-500">Interest Rate</p><p className="text-sm font-semibold">{fa.interestRate}%</p></div>
                  <div><p className="text-xs text-gray-500">Interest Earned</p><p className="text-sm font-semibold text-green-600">{formatUGX(fa.interestEarned)}</p></div>
                  <div><p className="text-xs text-gray-500">Maturity Amount</p><p className="text-sm font-bold text-[var(--color-primary)]">{formatUGX(fa.maturityAmount)}</p></div>
                </div>
                <div className="mt-3 text-xs text-gray-500">Maturity Date: {formatDate(fa.maturityDate)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {payLoanOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayLoanOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />Pay Loan
            </h3>
            {payError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />{payError}
              </div>
            )}
            {(() => {
              const loan = data.loans.list.find(l => l.id === selectedLoanId)
              if (!loan) return null
              return (
                <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium">{loan.loanCode}</p>
                  <p className="text-xs text-gray-500">Outstanding: <span className="font-semibold text-red-600">{formatUGX(loan.currentBalance)}</span></p>
                </div>
              )
            })()}
            <Input label="Amount (UGX)" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" min="1" />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => setPayLoanOpen(false)}>Cancel</Button>
              <Button loading={payLoading} onClick={handlePayLoan} icon={<CheckCircle className="w-4 h-4" />}>Submit Payment</Button>
            </div>
          </div>
        </div>
      )}

      <CelebrationPopup
        open={celebration.open}
        onClose={() => setCelebration((p) => ({ ...p, open: false }))}
        type={celebration.type}
        amount={celebration.amount}
        balance={celebration.balance}
        reference={celebration.reference}
        charges={celebration.charges}
        message={celebration.message}
      />
    </div>
  )
}
