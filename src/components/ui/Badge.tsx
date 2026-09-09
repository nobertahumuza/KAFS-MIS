import { cn } from "@/lib/utils"

type BadgeVariant = "success" | "warning" | "danger" | "info" | "default"

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  default: "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function getStatusVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase()
  if (["active", "approved", "completed", "paid", "success"].includes(normalized)) {
    return "success"
  }
  if (["pending", "processing", "under_review", "draft"].includes(normalized)) {
    return "warning"
  }
  if (["rejected", "failed", "defaulted", "cancelled", "inactive"].includes(normalized)) {
    return "danger"
  }
  if (["submitted", "disbursed", "info"].includes(normalized)) {
    return "info"
  }
  return "default"
}
