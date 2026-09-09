'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/layout/ThemeProvider'
import { SIDEBAR_NAV, APP_NAME } from '@/lib/constants'
import {
  Users,
  Wallet,
  PiggyBank,
  HandCoins,
  FileText,
  Receipt,
  BarChart3,
  MessageSquare,
  BookOpen,
  Settings,
  LayoutDashboard,
  Bell,
  TrendingUp,
  Lock,
  Shield,
  ClipboardList,
  Moon,
  Sun,
  ChevronLeft,
  X,
  LogOut,
  Menu,
  ArrowLeftRight,
  Coins,
  Landmark,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { getInitials } from '@/lib/utils'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Wallet,
  PiggyBank,
  HandCoins,
  FileText,
  Receipt,
  BarChart3,
  MessageSquare,
  BookOpen,
  Settings,
  Bell,
  TrendingUp,
  Lock,
  Shield,
  ClipboardList,
  ArrowLeftRight,
  Coins,
  Landmark,
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  const userRole = session?.user?.role
  const user = session?.user

  const filteredNav = SIDEBAR_NAV.filter((item) => {
    if (!userRole) return false
    return (item.roles as readonly string[]).includes(userRole)
  })

  useEffect(() => {
    if (session) {
      fetch("/api/notifications?filter=unread")
        .then((res) => res.json())
        .then((d) => setNotificationCount(d.unreadCount || 0))
        .catch(() => {})
    }
  }, [session])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex flex-col',
          'bg-[var(--color-primary-dark)] text-white',
          'transition-all duration-300 ease-in-out',
          'lg:relative lg:translate-x-0',
          collapsed ? 'w-20' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-white/10',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--color-gold)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-primary-dark)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-wide truncate">{APP_NAME}</h1>
                <p className="text-[10px] text-white/50 truncate">Management System</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'hidden lg:flex items-center justify-center w-8 h-8 rounded-md',
              'hover:bg-white/10 transition-colors'
            )}
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
          </button>

          <button
            onClick={onClose}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-1">
            {filteredNav.map((item) => {
              const Icon = iconMap[item.icon]
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-[var(--color-gold)] text-[var(--color-primary-dark)] shadow-md'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {Icon && <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[var(--color-primary-dark)]')} />}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.label === 'Applications' && notificationCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {notificationCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={cn(
          'border-t border-white/10 p-3 space-y-2',
          collapsed && 'px-2'
        )}>
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors',
              collapsed && 'justify-center px-0'
            )}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {user && !collapsed && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-[var(--color-gold)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[var(--color-primary-dark)]">
                  {getInitials(user.fullName || user.name || 'U')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.fullName || user.name}</p>
                <p className="text-[11px] text-white/50 truncate">{user.role}</p>
              </div>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
