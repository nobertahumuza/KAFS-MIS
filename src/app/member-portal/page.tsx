"use client"

import { useState, useCallback, useRef } from "react"
import { User, Wallet, TrendingDown, TrendingUp, Landmark, PiggyBank, LogOut, Eye, EyeOff, Clock, CreditCard, CheckCircle, AlertCircle, Camera } from "lucide-react"
import { formatUGX, formatDate } from "@/lib/utils"
import CelebrationPopup from "@/components/ui/CelebrationPopup"
import Footer from "@/components/layout/Footer"

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
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0e1a] -m-6 p-6">
        {/* Animated background orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <img src="/badge.jpg" alt="KAFS SACCO" className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[var(--color-primary)]/30 to-transparent" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Member <span className="text-[var(--color-gold)]">Portal</span></h1>
            <p className="text-white/40 mt-1 text-sm tracking-wide">Access your SACCO account</p>
          </div>

          {/* Glass Card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-2xl overflow-hidden">
            {/* Feature Pills */}
            <div className="flex justify-center gap-2 px-6 pt-6">
              {[
                { icon: PiggyBank, label: "Savings", color: "border-green-500/20 text-green-400 bg-green-500/10" },
                { icon: Landmark, label: "Loans", color: "border-blue-500/20 text-blue-400 bg-blue-500/10" },
                { icon: TrendingUp, label: "Shares", color: "border-purple-500/20 text-purple-400 bg-purple-500/10" },
                { icon: Wallet, label: "Fixed", color: "border-orange-500/20 text-orange-400 bg-orange-500/10" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="p-6 pt-5">
              {loginError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm backdrop-blur-sm">
                  {loginError}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Member Code</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[var(--color-gold)] transition-colors">
                      <Landmark className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="text"
                      value={memberCode}
                      onChange={(e) => setMemberCode(e.target.value)}
                      placeholder="e.g. KAFS-001"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-gold)]/50 focus:border-[var(--color-gold)]/50 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Phone Number</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[var(--color-gold)] transition-colors">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      required
                      className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-gold)]/50 focus:border-[var(--color-gold)]/50 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 hover:shadow-lg hover:shadow-[var(--color-gold)]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                >
                  {loginLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <User className="w-5 h-5" />
                      Sign In
                    </>
                  )}
                </button>
              </form>
              <p className="text-center text-xs text-white/25 mt-4">
                Contact the SACCO office if you forgot your credentials
              </p>
            </div>
          </div>

          <Footer />
      </div>
    </div>
    )
  }

  const m = data.member
  const totalAssetValue = data.savings.currentBalance + data.shares.shareValue + data.fixedAccounts.filter(f => f.status === "Active").reduce((s, f) => s + f.maturityAmount, 0)

  return (
    <div className="min-h-screen bg-[#0a0e1a] -m-6 p-6 relative">
      {/* Background orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.farmerName} className="w-14 h-14 rounded-full object-cover border-2 border-[var(--color-gold)]/30" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)]/30 to-[var(--color-gold)]/30 border border-white/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-white/70">
                    {m.farmerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0a0e1a]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{m.farmerName}</h1>
              <p className="text-white/40 text-sm">{m.memberCode}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all text-sm font-medium">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                }`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Savings Balance", value: formatUGX(data.savings.currentBalance), icon: PiggyBank, color: "from-green-500/20 to-green-600/5 border-green-500/20" },
                { label: "Active Loans", value: `${data.loans.active} (${formatUGX(data.loans.totalBalance)})`, icon: Landmark, color: "from-blue-500/20 to-blue-600/5 border-blue-500/20" },
                { label: "Total Shares", value: `${data.shares.totalShares} (${formatUGX(data.shares.shareValue)})`, icon: TrendingUp, color: "from-purple-500/20 to-purple-600/5 border-purple-500/20" },
                { label: "Asset Value", value: formatUGX(totalAssetValue), icon: Wallet, color: "from-orange-500/20 to-orange-600/5 border-orange-500/20" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`bg-gradient-to-b ${color} border rounded-2xl p-4`}>
                  <Icon className="w-5 h-5 text-white/50 mb-3" />
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-[var(--color-gold)]" />My Profile
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                  { label: "Registered", value: formatDate(m.registrationDate) },
                  { label: "Status", value: m.status || "Active" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-white/80">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/[0.06]">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/20 transition-all text-sm font-medium">
                  <input type="file" accept="image/*" className="hidden" ref={photoInputRef} onChange={handlePhotoUpload} />
                  <Camera className="w-4 h-4" />
                  {photoUploading ? "Uploading..." : "Upload Photo"}
                </label>
              </div>
            </div>

            {data.recentTransactions.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-[var(--color-gold)]" />Recent Transactions
                </h3>
                <div className="space-y-2">
                  {data.recentTransactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.transactionType === "Deposit" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {t.transactionType === "Deposit" ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">{t.transactionType}</p>
                          <p className="text-[11px] text-white/30">{t.referenceNumber} • {formatDate(t.transactionDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.transactionType === "Deposit" ? "text-green-400" : "text-red-400"}`}>
                          {t.transactionType === "Deposit" ? "+" : "-"}{formatUGX(t.amount)}
                        </p>
                        <p className="text-[11px] text-white/25">Bal: {formatUGX(t.balanceAfter)}</p>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Current Balance", value: formatUGX(data.savings.currentBalance), icon: PiggyBank, color: "from-green-500/20 to-green-600/5 border-green-500/20" },
                { label: "Total Deposits", value: formatUGX(data.savings.totalDeposits), icon: TrendingUp, color: "from-blue-500/20 to-blue-600/5 border-blue-500/20" },
                { label: "Total Withdrawals", value: formatUGX(data.savings.totalWithdrawals), icon: TrendingDown, color: "from-red-500/20 to-red-600/5 border-red-500/20" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`bg-gradient-to-b ${color} border rounded-2xl p-4`}>
                  <Icon className="w-5 h-5 text-white/50 mb-3" />
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4">Transaction History</h3>
              <div className="space-y-2">
                {data.recentTransactions.length === 0 ? (
                  <p className="text-white/30 text-center py-8">No transactions yet</p>
                ) : (
                  data.recentTransactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                      <div>
                        <p className="text-sm font-medium text-white/80">{t.transactionType}</p>
                        <p className="text-[11px] text-white/30">{t.referenceNumber} • {formatDate(t.transactionDate)}</p>
                        {t.narration && <p className="text-[11px] text-white/20">{t.narration}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.transactionType === "Deposit" ? "text-green-400" : "text-red-400"}`}>
                          {t.transactionType === "Deposit" ? "+" : "-"}{formatUGX(t.amount)}
                        </p>
                        <p className="text-[11px] text-white/25">Bal: {formatUGX(t.balanceAfter)}</p>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Loans", value: String(data.loans.total), icon: Landmark, color: "from-blue-500/20 to-blue-600/5 border-blue-500/20" },
                { label: "Active Loans", value: String(data.loans.active), icon: TrendingDown, color: "from-orange-500/20 to-orange-600/5 border-orange-500/20" },
                { label: "Outstanding", value: formatUGX(data.loans.totalBalance), icon: Wallet, color: "from-red-500/20 to-red-600/5 border-red-500/20" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`bg-gradient-to-b ${color} border rounded-2xl p-4`}>
                  <Icon className="w-5 h-5 text-white/50 mb-3" />
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {data.loans.list.length === 0 ? (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-10 text-center">
                <Landmark className="w-12 h-12 mx-auto text-white/15 mb-3" />
                <p className="text-white/30">No loans found</p>
              </div>
            ) : (
              data.loans.list.map((loan) => {
                const paidAmount = loan.principalAmount - loan.currentBalance
                const paidPercent = loan.principalAmount > 0 ? (paidAmount / loan.principalAmount) * 100 : 0
                return (
                  <div key={loan.id} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-base font-semibold text-white flex items-center gap-2">
                          {loan.loanCode}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${loan.loanStatus === "Active" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" : loan.loanStatus === "Cleared" ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-white/10 text-white/50 border border-white/10"}`}>
                            {loan.loanStatus}
                          </span>
                        </h4>
                        <p className="text-[11px] text-white/30 mt-1">Disbursed: {formatDate(loan.disbursementDate)}</p>
                      </div>
                      {loan.loanStatus === "Active" && (
                        <button onClick={() => { setSelectedLoanId(loan.id); setPayLoanOpen(true); setPayAmount(""); setPayError("") }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-[var(--color-gold)]/20 transition-all">
                          <CreditCard className="w-4 h-4" /> Pay
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        { label: "Principal", value: formatUGX(loan.principalAmount) },
                        { label: "Outstanding", value: formatUGX(loan.currentBalance), className: "text-red-400" },
                        { label: "Rate", value: `${loan.interestRate}% p.a.` },
                        { label: "Due Date", value: loan.dueDate ? formatDate(loan.dueDate) : "—" },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className={`text-sm font-semibold ${item.className || "text-white/80"}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-white/30 mb-1.5">
                        <span>Repayment Progress</span>
                        <span>{paidPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-white/[0.06] rounded-full h-2">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-white/20 mt-1">Paid: {formatUGX(paidAmount)} of {formatUGX(loan.principalAmount)}</p>
                    </div>
                  </div>
                )
              })
            )}

            {data.loanRepayments.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Repayment History</h3>
                <div className="space-y-2">
                  {data.loanRepayments.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                      <div>
                        <p className="text-sm font-medium text-white/80">Repayment — {r.loan.loanCode}</p>
                        <p className="text-[11px] text-white/30">{r.referenceNumber} • {formatDate(r.paymentDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-400">+{formatUGX(r.amountPaid)}</p>
                        {r.finePaid > 0 && <p className="text-[11px] text-orange-400">Fine: {formatUGX(r.finePaid)}</p>}
                        <p className="text-[11px] text-white/25">Bal: {formatUGX(r.balanceAfter)}</p>
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
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Shares", value: String(data.shares.totalShares), icon: TrendingUp, color: "from-purple-500/20 to-purple-600/5 border-purple-500/20" },
                { label: "Share Value", value: formatUGX(data.shares.shareValue), icon: Wallet, color: "from-green-500/20 to-green-600/5 border-green-500/20" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`bg-gradient-to-b ${color} border rounded-2xl p-4`}>
                  <Icon className="w-5 h-5 text-white/50 mb-3" />
                  <p className="text-xs text-white/40 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            {data.shares.list.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Share Transactions</h3>
                <div className="space-y-2">
                  {data.shares.list.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                      <div>
                        <p className="text-sm font-medium text-white/80">{s.transactionType} — {s.sharesQuantity} shares</p>
                        <p className="text-[11px] text-white/30">{s.referenceNumber} • {formatDate(s.transactionDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white/80">{formatUGX(s.totalAmount)}</p>
                        <p className="text-[11px] text-white/25">@ {formatUGX(s.sharePrice)}/share</p>
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
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-10 text-center">
                <Wallet className="w-12 h-12 mx-auto text-white/15 mb-3" />
                <p className="text-white/30">No fixed deposits found</p>
              </div>
            ) : (
              data.fixedAccounts.map((fa) => (
                <div key={fa.id} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-semibold text-white">{fa.fixedCode}</h4>
                      <p className="text-[11px] text-white/30 mt-1">Started: {formatDate(fa.startDate)}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${fa.status === "Active" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" : fa.status === "Matured" ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-white/10 text-white/50 border border-white/10"}`}>
                      {fa.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Principal", value: formatUGX(fa.principalAmount) },
                      { label: "Rate", value: `${fa.interestRate}%` },
                      { label: "Interest", value: formatUGX(fa.interestEarned), className: "text-green-400" },
                      { label: "Maturity", value: formatUGX(fa.maturityAmount), className: "text-[var(--color-gold)]" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{item.label}</p>
                        <p className={`text-sm font-semibold ${item.className || "text-white/80"}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/[0.04] text-[11px] text-white/25">
                    Maturity Date: {formatDate(fa.maturityDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pay Loan Modal */}
        {payLoanOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPayLoanOpen(false)} />
            <div className="relative w-full max-w-md bg-[#12172a] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--color-gold)]" />Pay Loan
              </h3>
              {payError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />{payError}
                </div>
              )}
              {(() => {
                const loan = data.loans.list.find(l => l.id === selectedLoanId)
                if (!loan) return null
                return (
                  <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-sm font-medium text-white">{loan.loanCode}</p>
                    <p className="text-[11px] text-white/30">Outstanding: <span className="font-semibold text-red-400">{formatUGX(loan.currentBalance)}</span></p>
                  </div>
                )
              })()}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Amount (UGX)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" min="1"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-gold)]/50 focus:border-[var(--color-gold)]/50 transition-all" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setPayLoanOpen(false)} className="px-4 py-2.5 rounded-xl text-white/40 hover:text-white/70 transition-colors text-sm font-medium">Cancel</button>
                <button disabled={payLoading} onClick={handlePayLoan}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-[var(--color-gold)]/20 disabled:opacity-50 transition-all">
                  {payLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Submit
                </button>
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

        <Footer />
      </div>
    </div>
  )
}
