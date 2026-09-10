"use client"

import { useEffect, useState } from "react"
import { X, PartyPopper, ArrowUpCircle, ArrowDownCircle, Landmark, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CelebrationPopupProps {
  open: boolean
  onClose: () => void
  type: "deposit" | "withdrawal" | "loan" | "share" | "fixed"
  amount: number
  balance?: number
  reference?: string
  charges?: number
}

const config = {
  deposit: {
    icon: ArrowUpCircle,
    title: "Deposit Successful!",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    emoji: "💰",
    msg: "Your savings deposit has been received successfully.",
  },
  withdrawal: {
    icon: ArrowDownCircle,
    title: "Withdrawal Processed!",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    emoji: "💸",
    msg: "Your withdrawal has been processed.",
  },
  loan: {
    icon: Landmark,
    title: "Loan Disbursed!",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    emoji: "🏦",
    msg: "Your loan has been disbursed to your account.",
  },
  share: {
    icon: CheckCircle,
    title: "Shares Purchased!",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
    emoji: "📈",
    msg: "Your shares have been purchased successfully.",
  },
  fixed: {
    icon: CheckCircle,
    title: "Fixed Deposit Created!",
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-200 dark:border-teal-800",
    emoji: "🔒",
    msg: "Your fixed deposit has been created.",
  },
}

function formatUGX(amount: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(amount)
}

export default function CelebrationPopup({ open, onClose, type, amount, balance, reference, charges }: CelebrationPopupProps) {
  const [show, setShow] = useState(false)
  const cfg = config[type]
  const Icon = cfg.icon

  useEffect(() => {
    if (open) {
      setShow(true)
      const timer = setTimeout(onClose, 8000)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 text-center",
          "transform transition-all duration-500",
          show ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>

        <div className="text-5xl mb-4 animate-bounce">{cfg.emoji}</div>

        <div className={cn("inline-flex items-center justify-center w-16 h-16 rounded-full mb-4", cfg.bg)}>
          <Icon className={cn("w-8 h-8", cfg.color)} />
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{cfg.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{cfg.msg}</p>

        <div className={cn("rounded-xl p-4 mb-4 border", cfg.bg, cfg.border)}>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatUGX(amount)}</p>
          {charges !== undefined && charges > 0 && (
            <p className="text-xs text-gray-500 mt-1">Transaction charges: {formatUGX(charges)}</p>
          )}
          {balance !== undefined && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              New Balance: <span className="font-semibold">{formatUGX(balance)}</span>
            </p>
          )}
          {reference && (
            <p className="text-xs text-gray-400 mt-1">Ref: {reference}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
          <PartyPopper className="w-3 h-3" />
          <span>KATAHO FARMERS&apos; SACCO</span>
        </div>
      </div>
    </div>
  )
}
