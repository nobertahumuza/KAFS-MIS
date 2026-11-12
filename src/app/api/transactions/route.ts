import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Unified transactions feed.
 *
 * Two rules this endpoint must keep:
 *  1. The summary is aggregated over the WHOLE filtered dataset, never over
 *     the capped display list - otherwise the totals silently stop at the
 *     page size (they used to be summed from a 200-row slice).
 *  2. Every type offered by the client filter maps to a real query here.
 *     Share purchases and loan disbursements were previously missing
 *     entirely, so those filters always came back empty.
 */

const TRANSACTION_TYPES = [
  "Deposit",
  "Withdrawal",
  "Loan Repayment",
  "Share Purchase",
  "Loan Disbursement",
  "Expense",
] as const

type TransactionType = (typeof TRANSACTION_TYPES)[number]

const INFLOW_TYPES: string[] = ["Deposit", "Loan Repayment", "Share Purchase"]

// shares_ledger records these as "Purchase"/"Sale"; the unified view uses the
// same vocabulary as the filter dropdown and the client-side badge logic.
const SHARE_TYPE_LABEL: Record<string, string> = {
  Purchase: "Share Purchase",
  Sale: "Share Sale",
}

/** Newest N rows are displayed; totals still cover everything. */
const DISPLAY_LIMIT = 200

const EMPTY_SUMMARY = {
  totalInflows: 0,
  totalOutflows: 0,
  netAmount: 0,
  // Net with loan disbursements backed out: cash collected vs cash paid out,
  // ignoring money handed to members as loans (which is a receivable, not a
  // loss). Keeps the always-negative netAmount from being misread.
  netBeforeLending: 0,
  transactionCount: 0,
}

type DisplayRow = {
  id: string
  transactionDate: string
  memberName: string
  memberCode: string
  type: string
  description: string
  amount: number
  referenceNumber: string
  recordedBy: string
}

function isInflow(type: string): boolean {
  return INFLOW_TYPES.includes(type)
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")?.trim() || ""
    const search = searchParams.get("search")?.trim() || ""
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    if (type && !TRANSACTION_TYPES.includes(type as TransactionType)) {
      return NextResponse.json(
        { error: `Unknown transaction type "${type}"`, transactions: [], summary: EMPTY_SUMMARY },
        { status: 400 }
      )
    }

    // --- shared filter construction -------------------------------------
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    // Inclusive end of the selected day.
    if (dateTo) dateFilter.lte = new Date(dateTo + "T23:59:59.999Z")
    const hasDate = Boolean(dateFrom || dateTo)

    // Which source tables participate for the selected type.
    const wantSavings = !type || type === "Deposit" || type === "Withdrawal"
    const wantRepayments = !type || type === "Loan Repayment"
    const wantExpenses = !type || type === "Expense"
    const wantShares = !type || type === "Share Purchase"
    const wantLoans = !type || type === "Loan Disbursement"

    const savingsWhere: Record<string, unknown> = {}
    if (wantSavings) {
      // When a type is selected it is one of Deposit/Withdrawal, so it maps
      // straight onto savings_ledger.transaction_type.
      if (type) savingsWhere.transactionType = type
      if (search) {
        savingsWhere.OR = [
          { narration: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { member: { farmerName: { contains: search, mode: "insensitive" } } },
          { member: { memberCode: { contains: search, mode: "insensitive" } } },
        ]
      }
      if (hasDate) savingsWhere.transactionDate = dateFilter
    }

    const repaymentWhere: Record<string, unknown> = {}
    if (wantRepayments) {
      if (search) {
        repaymentWhere.OR = [
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { loan: { loanCode: { contains: search, mode: "insensitive" } } },
          { loan: { member: { farmerName: { contains: search, mode: "insensitive" } } } },
        ]
      }
      if (hasDate) repaymentWhere.paymentDate = dateFilter
    }

    const expenseWhere: Record<string, unknown> = {}
    if (wantExpenses) {
      // "Expense" is a transaction *type*, not a category - filtering
      // category = "Expense" matched nothing (real categories are Salaries,
      // Other, ...), so this filter always returned an empty list.
      if (search) {
        expenseWhere.OR = [
          { description: { contains: search, mode: "insensitive" } },
          { referenceNo: { contains: search, mode: "insensitive" } },
        ]
      }
      if (hasDate) expenseWhere.expenseDate = dateFilter
    }

    const shareWhere: Record<string, unknown> = {}
    if (wantShares) {
      if (search) {
        shareWhere.OR = [
          { narration: { contains: search, mode: "insensitive" } },
          { referenceNumber: { contains: search, mode: "insensitive" } },
          { member: { farmerName: { contains: search, mode: "insensitive" } } },
        ]
      }
      if (hasDate) shareWhere.transactionDate = dateFilter
    }

    const loanWhere: Record<string, unknown> = {}
    if (wantLoans) {
      // Loan.disbursementDate is non-nullable, so every row is a genuine
      // disbursement - no null guard required.
      if (hasDate) loanWhere.disbursementDate = dateFilter
      if (search) {
        loanWhere.OR = [
          { loanCode: { contains: search, mode: "insensitive" } },
          { member: { farmerName: { contains: search, mode: "insensitive" } } },
        ]
      }
    }

    // --- display rows (capped) + aggregates (full) -----------------------
    // Each source contributes one capped findMany for the table and one
    // groupBy/aggregate over the same filter for the summary.
    const [
      savingsRows,
      repaymentRows,
      expenseRows,
      shareRows,
      loanRows,
      savingsByType,
      shareByType,
      repaymentAgg,
      expenseAgg,
      loanAgg,
    ] = await Promise.all([
      wantSavings
        ? prisma.savingsLedger.findMany({
            where: savingsWhere,
            include: {
              member: { select: { farmerName: true, memberCode: true } },
              recorder: { select: { fullName: true } },
            },
            orderBy: { transactionDate: "desc" },
            take: DISPLAY_LIMIT,
          })
        : Promise.resolve([]),
      wantRepayments
        ? prisma.loanRepayment.findMany({
            where: repaymentWhere,
            include: {
              loan: { include: { member: { select: { farmerName: true, memberCode: true } } } },
              recorder: { select: { fullName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: DISPLAY_LIMIT,
          })
        : Promise.resolve([]),
      wantExpenses
        ? prisma.expense.findMany({
            where: expenseWhere,
            include: { recorder: { select: { fullName: true } } },
            orderBy: { expenseDate: "desc" },
            take: DISPLAY_LIMIT,
          })
        : Promise.resolve([]),
      wantShares
        ? prisma.sharesLedger.findMany({
            where: shareWhere,
            // SharesLedger has no `recorder` relation - only the scalar
            // recordedBy id - so the member join is all we can include here.
            include: { member: { select: { farmerName: true, memberCode: true } } },
            orderBy: { transactionDate: "desc" },
            take: DISPLAY_LIMIT,
          })
        : Promise.resolve([]),
      wantLoans
        ? prisma.loan.findMany({
            where: loanWhere,
            include: { member: { select: { farmerName: true, memberCode: true } } },
            orderBy: { disbursementDate: "desc" },
            take: DISPLAY_LIMIT,
          })
        : Promise.resolve([]),
      wantSavings
        ? prisma.savingsLedger.groupBy({
            by: ["transactionType"],
            where: savingsWhere,
            _count: { _all: true },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      wantShares
        ? prisma.sharesLedger.groupBy({
            by: ["transactionType"],
            where: shareWhere,
            _count: { _all: true },
            _sum: { totalAmount: true },
          })
        : Promise.resolve([]),
      wantRepayments
        ? prisma.loanRepayment.aggregate({
            where: repaymentWhere,
            _count: { _all: true },
            _sum: { amountPaid: true },
          })
        : Promise.resolve({ _count: { _all: 0 }, _sum: { amountPaid: null } }),
      wantExpenses
        ? prisma.expense.aggregate({
            where: expenseWhere,
            _count: { _all: true },
            _sum: { amount: true },
          })
        : Promise.resolve({ _count: { _all: 0 }, _sum: { amount: null } }),
      wantLoans
        ? prisma.loan.aggregate({
            where: loanWhere,
            _count: { _all: true },
            _sum: { principalAmount: true },
          })
        : Promise.resolve({ _count: { _all: 0 }, _sum: { principalAmount: null } }),
    ])

    // --- summary over the FULL filtered dataset --------------------------
    let totalInflows = 0
    let totalOutflows = 0
    let transactionCount = 0

    for (const group of savingsByType) {
      transactionCount += group._count._all
      const amount = toNumber(group._sum.amount)
      if (isInflow(group.transactionType)) totalInflows += amount
      else totalOutflows += amount
    }

    for (const group of shareByType) {
      transactionCount += group._count._all
      const amount = toNumber(group._sum.totalAmount)
      const label = SHARE_TYPE_LABEL[group.transactionType] || group.transactionType
      if (isInflow(label)) totalInflows += amount
      else totalOutflows += amount
    }

    const repaymentTotal = toNumber(repaymentAgg._sum.amountPaid)
    transactionCount += repaymentAgg._count._all
    totalInflows += repaymentTotal

    const expenseTotal = toNumber(expenseAgg._sum.amount)
    transactionCount += expenseAgg._count._all
    totalOutflows += expenseTotal

    const loanTotal = toNumber(loanAgg._sum.principalAmount)
    transactionCount += loanAgg._count._all
    totalOutflows += loanTotal

    // --- display list (capped, newest first) ----------------------------
    const displayRows: DisplayRow[] = [
      ...savingsRows.map((s) => ({
        id: `savings-${s.id}`,
        transactionDate: s.transactionDate.toISOString(),
        memberName: s.member.farmerName,
        memberCode: s.member.memberCode,
        type: s.transactionType,
        description: s.narration || s.transactionType,
        amount: toNumber(s.amount),
        referenceNumber: s.referenceNumber || "-",
        recordedBy: s.recorder?.fullName || "System",
      })),
      ...repaymentRows.map((r) => ({
        id: `repayment-${r.id}`,
        transactionDate: r.paymentDate.toISOString(),
        memberName: r.loan.member.farmerName,
        memberCode: r.loan.member.memberCode,
        type: "Loan Repayment",
        description: `Repayment for ${r.loan.loanCode}`,
        amount: toNumber(r.amountPaid),
        referenceNumber: r.referenceNumber || "-",
        recordedBy: r.recorder?.fullName || "System",
      })),
      ...expenseRows.map((e) => ({
        id: `expense-${e.id}`,
        transactionDate: e.expenseDate.toISOString(),
        memberName: "N/A",
        memberCode: "-",
        type: "Expense",
        description: `${e.category}: ${e.description}`,
        amount: toNumber(e.amount),
        referenceNumber: e.referenceNo || "-",
        recordedBy: e.recorder?.fullName || "System",
      })),
      ...shareRows.map((s) => ({
        id: `share-${s.id}`,
        transactionDate: s.transactionDate.toISOString(),
        memberName: s.member.farmerName,
        memberCode: s.member.memberCode,
        type: SHARE_TYPE_LABEL[s.transactionType] || s.transactionType,
        description: s.narration || `${s.sharesQuantity} share(s)`,
        amount: toNumber(s.totalAmount),
        referenceNumber: s.referenceNumber || "-",
        // SharesLedger has no recorder relation, so no cash officer name is
        // available here - fall back to the same label other sources use.
        recordedBy: "System",
      })),
      ...loanRows.map((l) => ({
        id: `loan-${l.id}`,
        transactionDate: (l.disbursementDate || l.createdAt).toISOString(),
        memberName: l.member.farmerName,
        memberCode: l.member.memberCode,
        type: "Loan Disbursement",
        description: `Disbursement for ${l.loanCode}`,
        amount: toNumber(l.principalAmount),
        referenceNumber: l.loanCode,
        recordedBy: "System",
      })),
    ]
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, DISPLAY_LIMIT)

    return NextResponse.json({
      transactions: displayRows,
      summary: {
        totalInflows,
        totalOutflows,
        netAmount: totalInflows - totalOutflows,
        netBeforeLending: totalInflows - (totalOutflows - loanTotal),
        transactionCount,
      },
      // Lets the client say "showing 200 of 2,835" instead of pretending the
      // visible list is everything.
      displayedCount: displayRows.length,
      hasMore: transactionCount > displayRows.length,
      filtered: Boolean(type || search || hasDate),
    })
  } catch (error) {
    console.error("Transactions API error:", error)
    // A failure must not masquerade as "there are no transactions" - the
    // client shows this message instead of a row of zeros.
    return NextResponse.json(
      { error: "Failed to load transactions. Please try again.", transactions: [], summary: EMPTY_SUMMARY },
      { status: 500 }
    )
  }
}
