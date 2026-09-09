"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, Check, CheckCheck, AlertTriangle, AlertCircle, Info, Filter } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { formatDateTime } from "@/lib/utils"

interface Notification {
  id: number
  notificationType: string
  title: string
  message: string
  severity: string | null
  link: string | null
  isRead: boolean | null
  createdAt: string
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "warnings", label: "Warnings" },
  { id: "alerts", label: "Alerts" },
] as const

type FilterId = (typeof FILTER_TABS)[number]["id"]

const severityConfig: Record<string, { icon: typeof Bell; color: string; badge: "warning" | "danger" | "info" | "success" }> = {
  warning: { icon: AlertTriangle, color: "text-amber-500", badge: "warning" },
  alert: { icon: AlertCircle, color: "text-red-500", badge: "danger" },
  info: { icon: Info, color: "text-blue-500", badge: "info" },
  success: { icon: Check, color: "text-emerald-500", badge: "success" },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterId>("all")

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notifications?filter=${activeFilter}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err)
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAsRead = async (id: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error("Failed to mark notification as read:", err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("Failed to mark all as read:", err)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" icon={<CheckCheck className="w-4 h-4" />} onClick={markAllAsRead}>
              Mark All Read
            </Button>
          ) : undefined
        }
      />

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeFilter === tab.id
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.id === "unread" && unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <Bell className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">No notifications</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {notifications.map((notification) => {
            const config = severityConfig[notification.severity || "info"] || severityConfig.info
            const Icon = config.icon
            return (
              <button
                key={notification.id}
                onClick={() => !notification.isRead && markAsRead(notification.id)}
                className={`w-full text-left px-6 py-4 flex items-start gap-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  !notification.isRead ? "bg-[var(--color-primary)]/5" : ""
                }`}
              >
                <div className={`mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm ${!notification.isRead ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-300"}`}>
                      {notification.title}
                    </h3>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{notification.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDateTime(notification.createdAt)}</p>
                </div>
                <Badge variant={config.badge} className="shrink-0 mt-1">{notification.severity || "info"}</Badge>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
