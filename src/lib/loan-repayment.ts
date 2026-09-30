/**
 * Reducing-balance repayment engine.
 *
 * Rules (agreed with the SACCO):
 *  - Interest for a period is charged on the OUTSTANDING PRINCIPAL only, pro-rata
 *    per day: principal × rate% ÷ 30 × days elapsed since the last payment.
 *  - A payment is applied in the order: fees/fines → interest → principal.
 *  - `Loan.currentBalance` keeps meaning "total still owed" so that every existing
 *    dashboard / treasury / report figure stays correct.
 *  - Interest that was pre-booked into `currentBalance` when the loan was created is
 *    a ceiling: we never charge more interest than what is still booked on the loan.
 *  - When principal reaches zero, any booked interest that never accrued is written
 *    off (recorded in the audit trail) instead of being collected.
 *
 * Outstanding principal lives in `Loan.outstandingPrincipal` and is backfilled by
 * prisma/scripts/backfill-outstanding-principal.ts.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24
const DAYS_PER_MONTH = 30

/** Money is kept to 2 decimal places, matching the way fines and savings interest
 *  are rounded elsewhere in the system (`parseFloat(x.toFixed(2))`). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** YYYY-MM-DD in the SACCO's timezone, used for day-level date comparisons. */
export function loanDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(date)
}

/** Whole calendar days between two dates, measured in the SACCO's timezone. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${loanDateKey(from)}T00:00:00Z`)
  const b = Date.parse(`${loanDateKey(to)}T00:00:00Z`)
  return Math.round((b - a) / MS_PER_DAY)
}

export interface LoanBalanceInput {
  id: number
  loanCode: string
  principalAmount: number
  interestRate: number
  currentBalance: number
  outstandingPrincipal: number
  disbursementDate: Date
  /** Latest repayment date already recorded, or null when there are none. */
  lastPaymentDate?: Date | null
}

export interface RepaymentState {
  /** Principal still to be collected. */
  outstandingPrincipal: number
  /** Interest already booked into currentBalance that has not been charged yet. */
  interestComponent: number
  /** Date interest starts accruing from (last payment, else disbursement). */
  accrualDate: Date
  /** Whole days between accrualDate and the payment date. */
  daysElapsed: number
  /** Reducing-balance interest earned over those days. */
  accruedInterest: number
  /** Interest we are allowed to charge now: accrued, capped at what is booked. */
  interestAvailable: number
  /** Highest amount that may be applied to principal + interest in one payment. */
  maxAmountPaid: number
  pendingFines: number
}

/** Build the reducing-balance position of a loan as at `asOf` (the payment date). */
export function computeRepaymentState(
  loan: LoanBalanceInput,
  asOf: Date,
  pendingFines = 0
): RepaymentState {
  const outstandingPrincipal = Math.max(0, roundMoney(loan.outstandingPrincipal))
  const interestComponent = Math.max(0, roundMoney(loan.currentBalance - outstandingPrincipal))
  const accrualDate = loan.lastPaymentDate ?? loan.disbursementDate

  const rawDays = calendarDaysBetween(accrualDate, asOf)
  const daysElapsed = Math.max(0, rawDays)

  const monthlyRate = (loan.interestRate || 0) / 100
  const accruedInterest =
    outstandingPrincipal > 0
      ? roundMoney((outstandingPrincipal * monthlyRate * daysElapsed) / DAYS_PER_MONTH)
      : 0

  const interestAvailable = roundMoney(Math.min(accruedInterest, interestComponent))
  const maxAmountPaid = roundMoney(outstandingPrincipal + interestAvailable)

  return {
    outstandingPrincipal,
    interestComponent,
    accrualDate,
    daysElapsed,
    accruedInterest,
    interestAvailable,
    maxAmountPaid,
    pendingFines: Math.max(0, roundMoney(pendingFines)),
  }
}

export interface AllocationRequest {
  amountPaid: number
  finePaid?: number
  /** The date the payment was made. */
  paymentDate: Date
}

export interface Allocation {
  feePaid: number
  interestPaid: number
  principalPaid: number
  newBalance: number
  newOutstandingPrincipal: number
  /** Booked interest cancelled because principal was already cleared. */
  writtenOff: number
  loanCleared: boolean
  state: RepaymentState
}

export type AllocationResult =
  | { ok: true; allocation: Allocation }
  | { ok: false; error: string }

/**
 * Validate and split a payment between fees, interest and principal.
 * Pure function: used by both the preview endpoint and the record endpoint so the
 * officer always sees exactly what will be written.
 */
export function computeAllocation(
  loan: LoanBalanceInput,
  state: RepaymentState,
  request: AllocationRequest
): AllocationResult {
  const { paymentDate } = request
  const amountPaid = request.amountPaid
  const finePaid = request.finePaid ?? 0

  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return { ok: false, error: "Valid payment amount is required" }
  }
  if (!Number.isFinite(finePaid) || finePaid < 0) {
    return { ok: false, error: "Valid fine amount is required" }
  }

  if (loanDateKey(paymentDate) > loanDateKey(new Date())) {
    return { ok: false, error: "Payment date cannot be in the future" }
  }
  if (loanDateKey(paymentDate) < loanDateKey(loan.disbursementDate)) {
    return {
      ok: false,
      error: `Payment date cannot be earlier than the disbursement date (${loanDateKey(loan.disbursementDate)})`,
    }
  }
  if (loanDateKey(paymentDate) < loanDateKey(state.accrualDate)) {
    return {
      ok: false,
      error: `Payment date cannot be earlier than the last recorded payment on ${loanDateKey(state.accrualDate)}. Record payments in date order.`,
    }
  }

  const totalPaid = roundMoney(amountPaid + finePaid)
  if (totalPaid > loan.currentBalance) {
    return {
      ok: false,
      error: `Payment exceeds outstanding balance of UGX ${loan.currentBalance.toLocaleString()}`,
    }
  }

  if (amountPaid > state.maxAmountPaid) {
    return {
      ok: false,
      error:
        `Payment exceeds the payoff amount of UGX ${state.maxAmountPaid.toLocaleString()} ` +
        `(outstanding principal UGX ${state.outstandingPrincipal.toLocaleString()} + ` +
        `accrued interest UGX ${state.interestAvailable.toLocaleString()}). ` +
        `Charging interest beyond what has accrued is not allowed.`,
    }
  }

  // Fees first, then interest, then principal.
  const feePaid = roundMoney(finePaid)
  const interestPaid = roundMoney(Math.min(amountPaid, state.interestAvailable))
  const principalPaid = roundMoney(amountPaid - interestPaid)

  const newOutstandingPrincipal = Math.max(0, roundMoney(state.outstandingPrincipal - principalPaid))
  const remainingBookedInterest = Math.max(0, roundMoney(state.interestComponent - feePaid - interestPaid))

  let newBalance = roundMoney(newOutstandingPrincipal + remainingBookedInterest)
  let writtenOff = 0

  if (newOutstandingPrincipal <= 0 && newBalance > 0) {
    writtenOff = newBalance
    newBalance = 0
  }

  return {
    ok: true,
    allocation: {
      feePaid,
      interestPaid,
      principalPaid,
      newBalance,
      newOutstandingPrincipal,
      writtenOff,
      loanCleared: newBalance <= 0,
      state,
    },
  }
}
