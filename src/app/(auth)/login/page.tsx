"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, User, Shield, Landmark, PiggyBank, Wallet, HandCoins, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"staff" | "member">("staff")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === "Configuration") {
          setError("Server configuration error. Please check that NEXTAUTH_SECRET and database are properly configured.")
        } else {
          setError("Invalid username or password.")
        }
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Cannot connect to server. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0e1a] p-4">
      {/* Animated background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--color-gold)]/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <img
              src="/badge.jpg"
              alt="KAFS SACCO Badge"
              className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-2xl"
            />
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[var(--color-primary)]/30 to-transparent" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            KAFS <span className="text-[var(--color-gold)]">SACCO</span>
          </h1>
          <p className="text-white/40 mt-1 text-sm tracking-wide">
            Kataho Farmers&apos; Savings & Credit Cooperative
          </p>
        </div>

        {/* Main Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-2xl overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex p-1.5 m-3 bg-white/[0.03] rounded-2xl">
            <button
              type="button"
              onClick={() => { setMode("staff"); setError(""); setUsername(""); setPassword("") }}
              className={cn(
                "flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
                mode === "staff"
                  ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg shadow-[var(--color-primary)]/25"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Staff
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setMode("member"); setError("") }}
              className={cn(
                "flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300",
                mode === "member"
                  ? "bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 text-white shadow-lg shadow-[var(--color-gold)]/25"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4" />
                Member
              </div>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* Content Area */}
          <div className="p-6 pt-4">
            {mode === "staff" ? (
              <form onSubmit={handleStaffLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Username</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[var(--color-primary)] transition-colors">
                      <User className="w-4.5 h-4.5" />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-all"
                      placeholder="Enter your username"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Password</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[var(--color-primary)] transition-colors">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-all"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] hover:shadow-lg hover:shadow-[var(--color-primary)]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Member Portal Hero */}
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-gold)]/5 border border-[var(--color-gold)]/20 flex items-center justify-center mx-auto">
                      <User className="w-10 h-10 text-[var(--color-gold)]" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full border-2 border-[#0a0e1a] flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-4">
                    Welcome, Member
                  </h3>
                  <p className="text-white/40 text-sm mt-1 max-w-xs mx-auto">
                    Access your personal SACCO account to manage your finances.
                  </p>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Landmark, label: "Account\nOverview", color: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400" },
                    { icon: PiggyBank, label: "Savings\nBalance", color: "from-green-500/20 to-green-600/5 border-green-500/20 text-green-400" },
                    { icon: HandCoins, label: "Loan\nStatus", color: "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400" },
                    { icon: Wallet, label: "Shares &\nDeposits", color: "from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400" },
                  ].map(({ icon: Icon, label, color }) => (
                    <div
                      key={label}
                      className={cn("flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-gradient-to-b hover:scale-[1.02] transition-all duration-300 cursor-default", color)}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-[11px] font-semibold text-white/70 text-center leading-tight whitespace-pre-line">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Enter Button */}
                <button
                  type="button"
                  onClick={() => router.push("/member-portal")}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 hover:shadow-lg hover:shadow-[var(--color-gold)]/25 transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4.5 h-4.5" />
                  Enter Member Portal
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Help Text */}
                <p className="text-center text-xs text-white/25">
                  Use your <span className="font-medium text-white/40">Member Code</span> and{" "}
                  <span className="font-medium text-white/40">Phone Number</span> to sign in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-6">
          Designed by NobTechWorld &middot; &copy; {new Date().getFullYear()} KATAHO FARMERS&apos; SACCO
        </p>
      </div>
    </div>
  )
}
