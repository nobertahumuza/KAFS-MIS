import { cn } from "@/lib/utils"

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({ label, value, icon, trend, className }: MetricCardProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}% from last month
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-[var(--color-primary)]/10 rounded-lg text-[var(--color-primary)]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
