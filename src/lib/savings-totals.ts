import prisma from "@/lib/prisma"
import { COLLECTION_ACCOUNT_CODES } from "@/lib/collection-accounts"

/**
 * Correct "how much do members have in savings" totals.
 *
 * `savings_ledger.amount` is always stored positive for BOTH deposits and
 * withdrawals, so `aggregate({ _sum: { amount } })` adds them together and
 * reports a figure far larger than the money actually held (it was showing
 * ~UGX 348M against a real balance of ~UGX 134M).
 *
 * The balance of an account is the `balanceAfter` on its newest ledger row -
 * the same value `getSavingsBalance()` and every balance check read - so that
 * is what these helpers return.
 */

const COLLECTION_CODE_LIST = COLLECTION_ACCOUNT_CODES.map((c) => `'${c}'`).join(",")

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Sum of every account's most recent `balanceAfter`.
 *
 * @param asOf  Only consider ledger rows up to this moment (for closing a
 *              fiscal year at a point in time). Omit for "right now".
 * @param includeCollectionAccounts  The SACCO's own bank accounts (fees,
 *              charity fund) are not member savings; they are excluded by
 *              default.
 */
export async function getTotalSavingsBalance(options?: {
  asOf?: Date
  includeCollectionAccounts?: boolean
}): Promise<number> {
  const asOf = options?.asOf
  const excludeBank = !options?.includeCollectionAccounts

  const dateClause = asOf ? "AND s.transaction_date <= $1" : ""
  const bankClause = excludeBank
    ? `AND m.member_code NOT IN (${COLLECTION_CODE_LIST})`
    : ""

  const sql = `
    SELECT COALESCE(SUM(t.bal), 0) AS total
    FROM (
      SELECT DISTINCT ON (s.member_id) s.member_id, s.balance_after AS bal
      FROM savings_ledger s
      JOIN members m ON m.id = s.member_id
      WHERE 1 = 1
        ${bankClause}
        ${dateClause}
      ORDER BY s.member_id, s.id DESC
    ) t
  `

  const rows = asOf
    ? await prisma.$queryRawUnsafe<Array<{ total: unknown }>>(sql, asOf)
    : await prisma.$queryRawUnsafe<Array<{ total: unknown }>>(sql)

  return toNumber(rows?.[0]?.total)
}

/**
 * Cumulative deposits (money that came in), excluding withdrawals.
 * Used where a label says "deposits" rather than "balance".
 */
export async function getTotalSavingsDeposits(): Promise<number> {
  const row = await prisma.savingsLedger.aggregate({
    where: { transactionType: "Deposit" },
    _sum: { amount: true },
  })
  return toNumber(row._sum.amount)
}
