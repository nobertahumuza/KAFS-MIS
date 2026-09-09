import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type ButtonVariant = "primary" | "gold" | "outline" | "danger" | "ghost"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-sm",
  gold:
    "bg-[var(--color-gold)] text-white hover:bg-[var(--color-gold-dark)] shadow-sm",
  outline:
    "border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  ghost:
    "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
          "transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export default Button
