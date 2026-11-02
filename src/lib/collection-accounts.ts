/**
 * The SACCO's own collection accounts.
 *
 * These are bank accounts, not members: they hold the fees and funds the
 * SACCO has collected. They are never charged a fee or deduction, never
 * pay the withdrawal fee, and are excluded from member listings, counts
 * and reports (pass `includeSystem=true` to /api/members when a teller
 * genuinely needs to transact with one of them).
 */
export const COLLECTION_ACCOUNT_CODES = ["KAFS-237", "KAFS-557", "KAFS-560"] as const

/** True when the member code belongs to one of the SACCO's bank accounts. */
export function isCollectionAccount(memberCode: string): boolean {
  return (COLLECTION_ACCOUNT_CODES as readonly string[]).includes(memberCode)
}

/** Prisma filter that hides the collection accounts from member queries. */
export function excludeCollectionAccounts() {
  return { memberCode: { notIn: [...COLLECTION_ACCOUNT_CODES] } }
}
