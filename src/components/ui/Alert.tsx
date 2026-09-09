"use client"

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertType = "success" | "error" | "warning" | "info"

interface AlertItem {
  id: string
  type: AlertType
  message: string
}

interface AlertContextType {
  alerts: AlertItem[]
  addAlert: (type: AlertType, message: string) => void
  removeAlert: (id: string) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider")
  }
  return context
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id))
  }, [])

  const addAlert = useCallback(
    (type: AlertType, message: string) => {
      const id = Math.random().toString(36).substring(2, 9)
      setAlerts((prev) => [...prev, { id, type, message }])
      setTimeout(() => removeAlert(id), 5000)
    },
    [removeAlert]
  )

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert }}>
      {children}
      <AlertContainer alerts={alerts} removeAlert={removeAlert} />
    </AlertContext.Provider>
  )
}

const alertConfig: Record<
  AlertType,
  { icon: React.ReactNode; className: string }
> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    className: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    className: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    className: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-500" />,
    className: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  },
}

function AlertContainer({
  alerts,
  removeAlert,
}: {
  alerts: AlertItem[]
  removeAlert: (id: string) => void
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onClose={() => removeAlert(alert.id)} />
      ))}
    </div>
  )
}

function AlertItem({ alert, onClose }: { alert: AlertItem; onClose: () => void }) {
  const config = alertConfig[alert.type]

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right",
        config.className
      )}
    >
      {config.icon}
      <p className="flex-1 text-sm text-gray-900 dark:text-gray-100">{alert.message}</p>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
