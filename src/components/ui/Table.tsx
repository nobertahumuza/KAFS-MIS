import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Column<T = any> {
  key: string
  header: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (item: any) => React.ReactNode
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TableProps<T = any> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowClick?: (item: any) => void
  className?: string
}

export default function Table({
  columns,
  data,
  emptyMessage = "No data found",
  emptyIcon,
  onRowClick,
  className,
}: TableProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        {emptyIcon || <Inbox className="w-12 h-12 mb-3 opacity-50" />}
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-gray-500 dark:text-gray-400",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((item: Record<string, unknown>, index: number) => (
            <tr
              key={index}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-sm text-gray-900 dark:text-gray-100",
                    col.className
                  )}
                >
                  {col.render ? col.render(item) : (item[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
