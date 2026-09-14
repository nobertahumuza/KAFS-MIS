import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG')}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateMemberCode(index: number): string {
  return `KAFS-${String(index).padStart(3, '0')}`
}

export function generateAccountNo(index: number): string {
  return `KAFS-ACC-${String(index).padStart(3, '0')}`
}

export function generateLoanCode(index: number): string {
  return `KAFS-LOAN-${String(index).padStart(3, '0')}`
}

export function generateApplicationCode(index: number): string {
  return `KAFS-APP-${String(index).padStart(3, '0')}`
}

export function generateReference(prefix: string, index: number): string {
  return `REF-${prefix}-${String(index).padStart(3, '0')}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
