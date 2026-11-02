import prisma from "@/lib/prisma"

export async function createNotification(params: {
  title: string
  message: string
  severity?: string
  notificationType?: string
  link?: string
}) {
  try {
    await prisma.notification.create({
      data: {
        notificationType: params.notificationType || "info",
        title: params.title,
        message: params.message,
        severity: params.severity || "info",
        link: params.link || null,
        isRead: false,
      },
    })
  } catch (err) {
    console.error("Notification creation error:", err)
  }
}

export async function notifyMemberRegistered(memberId: number, memberName: string, memberCode: string) {
  await createNotification({
    title: "New Member Registered",
    message: `${memberName} (${memberCode}) has been registered as a new member.`,
    severity: "success",
    notificationType: "member_registered",
    link: `/members/${memberId}`,
  })
}

export async function notifyAccountOpened(memberId: number, memberName: string, accountNo: string) {
  await createNotification({
    title: "Account Opened",
    message: `Account ${accountNo} opened for ${memberName}.`,
    severity: "success",
    notificationType: "account_opened",
    link: `/accounts`,
  })
}

export async function notifySavingsDeposit(memberId: number, memberName: string, amount: number, reference: string) {
  await createNotification({
    title: "Savings Deposit",
    message: `${memberName} deposited UGX ${amount.toLocaleString()}. Ref: ${reference}`,
    severity: "success",
    notificationType: "savings_deposit",
    link: `/savings`,
  })
}

export async function notifySavingsWithdrawal(memberId: number, memberName: string, amount: number, reference: string) {
  await createNotification({
    title: "Savings Withdrawal",
    message: `${memberName} withdrew UGX ${amount.toLocaleString()}. Ref: ${reference}`,
    severity: "warning",
    notificationType: "savings_withdrawal",
    link: `/savings`,
  })
}

export async function notifyLoanDisbursed(memberId: number, memberName: string, loanCode: string, amount: number) {
  await createNotification({
    title: "Loan Disbursed",
    message: `Loan ${loanCode} of UGX ${amount.toLocaleString()} disbursed to ${memberName}.`,
    severity: "info",
    notificationType: "loan_disbursed",
    link: `/loans`,
  })
}

export async function notifyLoanRepaid(memberId: number, memberName: string, amount: number, reference: string) {
  await createNotification({
    title: "Loan Repayment",
    message: `${memberName} repaid UGX ${amount.toLocaleString()}. Ref: ${reference}`,
    severity: "success",
    notificationType: "loan_repaid",
    link: `/loans`,
  })
}

/**
 * Detailed cashier notification for a deposit that was (partly) offset to
 * loans: how the money was split per loan, what interest/principal/fines it
 * covered, the new loan balances and the savings remainder.
 */
export async function notifyDepositOffset(params: {
  memberName: string
  memberCode: string
  depositAmount: number
  totalApplied: number
  savingsCredited: number
  savingsBalance: number
  reference: string
  loans: {
    loanCode: string
    amountApplied: number
    interestPaid: number
    principalPaid: number
    finePaid: number
    newBalance: number
    loanCleared: boolean
  }[]
}) {
  const loanDetails = params.loans
    .map(
      (l) =>
        `${l.loanCode}: UGX ${l.amountApplied.toLocaleString()} ` +
        `(interest UGX ${l.interestPaid.toLocaleString()}, principal UGX ${l.principalPaid.toLocaleString()}, fines UGX ${l.finePaid.toLocaleString()}) ` +
        `→ balance UGX ${l.newBalance.toLocaleString()}${l.loanCleared ? " — CLEARED" : ""}`
    )
    .join("; ")

  await createNotification({
    title: "Deposit offset to loan",
    message:
      `${params.memberName} (${params.memberCode}) deposited UGX ${params.depositAmount.toLocaleString()}. ` +
      `UGX ${params.totalApplied.toLocaleString()} paid to loan: ${loanDetails}. ` +
      `UGX ${params.savingsCredited.toLocaleString()} credited to savings (balance UGX ${params.savingsBalance.toLocaleString()}). ` +
      `Ref: ${params.reference}`,
    severity: "success",
    notificationType: "deposit_offset",
    link: `/savings`,
  })
}

/**
 * Cashier notification for one member processed by the auto-repay cron -
 * exactly how much was taken from savings and where it went.
 */
export async function notifyAutoRepay(params: {
  memberName: string
  memberCode: string
  amount: number
  savingsBalanceBefore: number
  savingsBalanceAfter: number
  fullyPaid: boolean
  reference: string
  loans: {
    loanCode: string
    amountApplied: number
    interestPaid: number
    principalPaid: number
    finePaid: number
    newBalance: number
    loanCleared: boolean
  }[]
}) {
  const loanDetails = params.loans
    .map(
      (l) =>
        `${l.loanCode}: UGX ${l.amountApplied.toLocaleString()} ` +
        `(interest UGX ${l.interestPaid.toLocaleString()}, principal UGX ${l.principalPaid.toLocaleString()}, fines UGX ${l.finePaid.toLocaleString()}) ` +
        `→ balance UGX ${l.newBalance.toLocaleString()}${l.loanCleared ? " — CLEARED" : ""}`
    )
    .join("; ")

  await createNotification({
    title: params.fullyPaid ? "Auto-repay collected" : "Auto-repay partial (low savings)",
    message:
      `${params.memberName} (${params.memberCode}): UGX ${params.amount.toLocaleString()} taken from savings ` +
      `(UGX ${params.savingsBalanceBefore.toLocaleString()} → UGX ${params.savingsBalanceAfter.toLocaleString()}) ` +
      `and paid to loan: ${loanDetails}. Ref: ${params.reference}`,
    severity: params.fullyPaid ? "success" : "warning",
    notificationType: "loan_auto_repay",
    link: `/savings`,
  })
}

export async function notifyLoanApplication(memberId: number, memberName: string, applicationCode: string, amount: number) {
  await createNotification({
    title: "New Loan Application",
    message: `${memberName} applied for a loan of UGX ${amount.toLocaleString()} (${applicationCode}).`,
    severity: "info",
    notificationType: "loan_application",
    link: `/loans/applications`,
  })
}

export async function notifyLoanApproval(memberId: number, memberName: string, applicationCode: string) {
  await createNotification({
    title: "Loan Application Approved",
    message: `Loan application ${applicationCode} for ${memberName} has been approved.`,
    severity: "success",
    notificationType: "loan_approved",
    link: `/loans/applications`,
  })
}

export async function notifyLoanRejection(memberId: number, memberName: string, applicationCode: string) {
  await createNotification({
    title: "Loan Application Rejected",
    message: `Loan application ${applicationCode} for ${memberName} has been rejected.`,
    severity: "danger",
    notificationType: "loan_rejected",
    link: `/loans/applications`,
  })
}

export async function notifySharePurchase(memberId: number, memberName: string, shares: number, amount: number) {
  await createNotification({
    title: "Share Purchase",
    message: `${memberName} purchased ${shares} shares for UGX ${amount.toLocaleString()}.`,
    severity: "success",
    notificationType: "share_purchase",
    link: `/shares`,
  })
}

export async function notifyFixedDeposit(memberId: number, memberName: string, amount: number, period: number) {
  await createNotification({
    title: "Fixed Deposit",
    message: `${memberName} made a fixed deposit of UGX ${amount.toLocaleString()} for ${period} months.`,
    severity: "info",
    notificationType: "fixed_deposit",
    link: `/fixed-accounts`,
  })
}

export async function notifyExpenseRecorded(description: string, amount: number, category: string) {
  await createNotification({
    title: "Expense Recorded",
    message: `Expense of UGX ${amount.toLocaleString()} recorded: ${description} (${category})`,
    severity: "warning",
    notificationType: "expense_recorded",
    link: `/expenses`,
  })
}
