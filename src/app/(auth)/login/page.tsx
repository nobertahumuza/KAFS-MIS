"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, User, Shield, Landmark, PiggyBank, Wallet, HandCoins, ChevronRight } from "lucide-react"
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-gold)] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <img
            src="/badge.jpg"
            alt="KAFS SACCO Badge"
            className="inline-block w-24 h-24 rounded-full object-cover mb-4 shadow-lg border-4 border-white/20"
          />
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            KAFS SACCO
          </h1>
          <p className="text-white/70 mt-1 text-sm">
            Kataho Farmers&apos; Savings & Credit Cooperative
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">

          {/* Tab Switcher */}
          <div className="flex">
            <button
              type="button"
              onClick={() => { setMode("staff"); setError(""); setUsername(""); setPassword("") }}
              className={cn(
                "flex-1 py-4 text-sm font-semibold transition-all duration-300 border-b-2",
                mode === "staff"
                  ? "text-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Staff Login
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setMode("member"); setError("") }}
              className={cn(
                "flex-1 py-4 text-sm font-semibold transition-all duration-300 border-b-2",
                mode === "member"
                  ? "text-[var(--color-gold)] border-[var(--color-gold)] bg-[var(--color-gold)]/5"
                  : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4" />
                Member Portal
              </div>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Content Area */}
          <div className="p-6">
            {mode === "staff" ? (
              <form onSubmit={handleStaffLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600",
                      "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                      "focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "transition-colors"
                    )}
                    placeholder="Enter your username"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        "w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600",
                        "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                        "focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent",
                        "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                        "transition-colors"
                      )}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full py-3 px-4 rounded-lg font-semibold text-white",
                    "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-all duration-200 flex items-center justify-center gap-2",
                    "shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-xl hover:shadow-[var(--color-primary)]/30"
                  )}
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
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-gold)]/10 to-[var(--color-gold)]/20 flex items-center justify-center mx-auto">
                      <User className="w-10 h-10 text-[var(--color-gold)]" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-4">
                    Welcome, Member
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                    Access your personal SACCO account to manage your finances.
                  </p>
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Landmark, label: "Account\nOverview", color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
                    { icon: PiggyBank, label: "Savings\nBalance", color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
                    { icon: HandCoins, label: "Loan\nStatus", color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
                    { icon: Wallet, label: "Shares &\nDeposits", color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
                  ].map(({ icon: Icon, label, color }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-[var(--color-gold)]/30 transition-colors"
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 text-center leading-tight whitespace-pre-line">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Enter Button */}
                <button
                  type="button"
                  onClick={() => router.push("/member-portal")}
                  className={cn(
                    "w-full py-3.5 px-4 rounded-xl font-semibold text-white",
                    "bg-gradient-to-r from-[var(--color-gold)] to-yellow-600",
                    "hover:from-yellow-600 hover:to-yellow-700",
                    "transition-all duration-200 flex items-center justify-center gap-2",
                    "shadow-lg shadow-[var(--color-gold)]/20 hover:shadow-xl hover:shadow-[var(--color-gold)]/30",
                    "group"
                  )}
                >
                  Enter Member Portal
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Help Text */}
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  Use your <span className="font-medium text-gray-500 dark:text-gray-400">Member Code</span> and{" "}
                  <span className="font-medium text-gray-500 dark:text-gray-400">Phone Number</span> to sign in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          Designed by NobTechWorld &middot; &copy; {new Date().getFullYear()} KATAHO FARMERS&apos; SACCO
        </p>
      </div>
    </div>
  )
}
