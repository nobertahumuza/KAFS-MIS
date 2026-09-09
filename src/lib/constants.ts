export const APP_NAME = 'KAFS SACCO'
export const SACCO_NAME = 'Kataho SACCO'

export const ROLES = {
  ADMIN: 'Admin',
  CASHIER: 'Cashier',
  LOANS_OFFICER: 'LoansOfficer',
  TREASURER: 'Treasurer',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const SIDEBAR_NAV = [
  { icon: 'LayoutDashboard', label: 'Dashboard', href: '/dashboard', roles: [ROLES.ADMIN, ROLES.CASHIER, ROLES.LOANS_OFFICER, ROLES.TREASURER] },
  { icon: 'Users', label: 'Members', href: '/members', roles: [ROLES.ADMIN, ROLES.CASHIER] },
  { icon: 'Wallet', label: 'Accounts', href: '/accounts', roles: [ROLES.ADMIN, ROLES.CASHIER, ROLES.TREASURER] },
  { icon: 'ArrowLeftRight', label: 'Transactions', href: '/transactions', roles: [ROLES.ADMIN, ROLES.CASHIER, ROLES.TREASURER] },
  { icon: 'Coins', label: 'Shares', href: '/shares', roles: [ROLES.ADMIN, ROLES.CASHIER] },
  { icon: 'HandCoins', label: 'Loans', href: '/loans', roles: [ROLES.ADMIN, ROLES.LOANS_OFFICER] },
  { icon: 'ClipboardList', label: 'Applications', href: '/applications', roles: [ROLES.ADMIN, ROLES.LOANS_OFFICER] },
  { icon: 'Landmark', label: 'Treasury', href: '/treasury', roles: [ROLES.ADMIN, ROLES.TREASURER] },
  { icon: 'BookOpen', label: 'Chart of Accounts', href: '/chart-of-accounts', roles: [ROLES.ADMIN, ROLES.TREASURER] },
  { icon: 'FileText', label: 'Journal Entries', href: '/journal-entries', roles: [ROLES.ADMIN, ROLES.TREASURER] },
  { icon: 'BarChart3', label: 'Reports', href: '/reports', roles: [ROLES.ADMIN, ROLES.TREASURER] },
  { icon: 'MessageSquare', label: 'SMS', href: '/sms', roles: [ROLES.ADMIN, ROLES.CASHIER] },
  { icon: 'Settings', label: 'Settings', href: '/settings', roles: [ROLES.ADMIN] },
] as const

export const TRANSACTION_TYPES = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  LOAN_DISBURSEMENT: 'LoanDisbursement',
  LOAN_REPAYMENT: 'LoanRepayment',
  SHARE_PURCHASE: 'SharePurchase',
  SHARE_WITHDRAWAL: 'ShareWithdrawal',
  TRANSFER: 'Transfer',
  FEE: 'Fee',
} as const

export const LOAN_STATUSES = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DISBURSED: 'Disbursed',
  REPAID: 'Repaid',
  DEFAULTED: 'Defaulted',
  REJECTED: 'Rejected',
} as const

export const APPLICATION_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'UnderReview',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const
