/**
 * Post-restore sanity check.
 *
 * Usage:
 *   node scripts/restore-check.js <connection-string>
 *   DATABASE_URL=... node scripts/restore-check.js
 *
 * Prints row counts for every critical table and exits non-zero if the
 * restored database looks empty or structurally broken. Run it after every
 * restore (see docs/BACKUP.md, "Quarterly restore test").
 *
 * Read-only: only issues SELECT / COUNT queries.
 */
const { PrismaClient } = require("@prisma/client")

const CRITICAL_TABLES = [
  ["members", "Member"],
  ["users", "User"],
  ["loans", "Loan"],
  ["loanApplications", "LoanApplication"],
  ["loanRepaymentSchedules", "LoanRepaymentSchedule"],
  ["loanRepayments", "LoanRepayment"],
  ["savingsLedger", "SavingsLedger"],
  ["sharesLedger", "SharesLedger"],
  ["auditTrail", "AuditTrail"],
  ["smsLogs", "SmsLog"],
  ["notifications", "Notification"],
  ["memberDocuments", "MemberDocument"],
  ["charityDeductions", "CharityDeduction"],
  ["serviceFeeDeductions", "ServiceFeeDeduction"],
  ["appSettings", "AppSetting"],
  ["smsTemplates", "SmsTemplate"],
  ["smsSettings", "SmsSetting"],
]

// Tables that must never be empty in a real restore.
const MUST_BE_NON_EMPTY = new Set([
  "members",
  "users",
  "loans",
  "savingsLedger",
  "appSettings",
  "smsTemplates",
])

async function withRetry(fn, tries = 10, sleepMs = 5000) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      console.error(`  retry ${i + 1}: ${String(e.message).split("\n")[0]}`)
      await new Promise((r) => setTimeout(r, sleepMs))
    }
  }
  throw lastErr
}

async function main() {
  const url = process.argv[2] || process.env.DATABASE_URL
  if (!url) {
    console.error("Usage: node scripts/restore-check.js <connection-string>")
    process.exit(2)
  }

  // Never log the credentials.
  const safeUrl = url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@")
  console.log(`Checking: ${safeUrl}\n`)

  const prisma = new PrismaClient({ datasources: { db: { url } } })

  try {
    const server = await withRetry(() =>
      prisma.$queryRawUnsafe("SELECT version() AS v, current_database() AS db")
    )
    console.log(`Server: ${String(server[0].v).slice(0, 60)}...`)
    console.log(`Database: ${server[0].db}\n`)

    let failed = 0
    const results = []

    for (const [label, model] of CRITICAL_TABLES) {
      try {
        const count = await withRetry(() => prisma[model].count())
        const required = MUST_BE_NON_EMPTY.has(label)
        const bad = required && count === 0
        if (bad) failed++
        results.push({ label, count, required, bad })
      } catch (e) {
        failed++
        results.push({ label, count: null, required: true, bad: true, err: String(e.message).split("\n")[0] })
      }
    }

    const width = Math.max(...results.map((r) => r.label.length))
    for (const r of results) {
      const mark = r.bad ? "FAIL" : "ok  "
      const value = r.count === null ? `ERROR: ${r.err}` : r.count.toLocaleString()
      console.log(`  [${mark}] ${r.label.padEnd(width)}  ${value}`)
    }

    // Freshness: the newest audit row tells us how current the restore is.
    try {
      const latest = await withRetry(() =>
        prisma.auditTrail.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      )
      console.log(
        `\nNewest audit entry: ${latest ? latest.createdAt.toISOString() : "(none)"}`
      )
    } catch {
      /* non-fatal */
    }

    console.log("")
    if (failed > 0) {
      console.error(`RESTORE CHECK FAILED: ${failed} table(s) missing or empty.`)
      process.exit(1)
    }
    console.log("RESTORE CHECK PASSED: all critical tables present.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
