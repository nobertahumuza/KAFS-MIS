"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <img
              src="/badge.jpg"
              alt="KAFS SACCO Badge"
              className="inline-block w-20 h-20 rounded-full object-cover mb-4"
            />
            <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-white">
              KAFS SACCO
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Management System
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-2.5 px-4 rounded-lg font-semibold text-white",
                "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors flex items-center justify-center gap-2"
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
        </div>
      </div>
    </div>
  )
}
