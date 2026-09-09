'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from '@/components/layout/ThemeProvider'
import { cn, getInitials } from '@/lib/utils'
import {
  Menu,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  LogOut,
  User,
  ChevronDown,
  Key,
} from 'lucide-react'
import { signOut } from 'next-auth/react'

interface HeaderProps {
  onMenuClick: () => void
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  accounts: 'Accounts',
  transactions: 'Transactions',
  shares: 'Shares',
  loans: 'Loans',
  applications: 'Applications',
  treasury: 'Treasury',
  reports: 'Reports',
  settings: 'Settings',
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { theme, toggleTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const user = session?.user

  const pathSegments = pathname.split('/').filter(Boolean)
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/')
    return {
      label: routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      href,
      isLast: index === pathSegments.length - 1,
    }
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (session) {
      fetch("/api/notifications?filter=unread")
        .then((res) => res.json())
        .then((d) => setNotifCount(d.unreadCount || 0))
        .catch(() => {})
    }
  }, [session])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    setPasswordSuccess("")
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password")
        return
      }
      setPasswordSuccess("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        setShowChangePassword(false)
        setPasswordSuccess("")
      }, 2000)
    } catch {
      setPasswordError("Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-3"
      >
        <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>

      <nav className="flex items-center gap-1 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
            {crumb.isLast ? (
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate"
              >
                {crumb.label}
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>

        <button
          onClick={() => router.push('/notifications')}
          className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold)] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[var(--color-primary-dark)]">
                {user ? getInitials(user.fullName || user.name || 'U') : 'U'}
              </span>
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                {user?.fullName || user?.name || 'User'}
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-gray-500 transition-transform hidden sm:block',
              dropdownOpen && 'rotate-180'
            )} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.fullName || user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {user?.role}
                </p>
              </div>
              <button
                onClick={() => {
                  setDropdownOpen(false)
                  router.push('/settings')
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => {
                  setDropdownOpen(false)
                  setShowChangePassword(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>Change Password</span>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showChangePassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowChangePassword(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Update your account password</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]"
                  placeholder="Re-enter new password"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false)
                    setPasswordError("")
                    setPasswordSuccess("")
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {changingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
