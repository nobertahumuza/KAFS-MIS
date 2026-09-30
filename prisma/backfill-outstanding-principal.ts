import { PrismaClient } from "@prisma/client"

/**
 * One-time backfill of `loans.outstanding_principal`.
 *
 * `LoanRepayment` rows written before the reducing-balance feature carry no
 * interest/principal split, so the principal already repaid is derived using the
 * same flat split the borrower was shown on their repayment schedule:
 *
 *    principalPortion = payment × (principalAmount / scheduledTotalPayable)
 *    outstandingPrincipal = principalAmount − Σ principalPortion
 *
 * The script is guarded by an AppSetting marker so running it twice cannot
 * overwrite a balance that later repayments have already reduced.
 *
 * Run AFTER `npx prisma db push`:
 *    npx tsx prisma/backfill-outstanding-principal.ts
 */

const prisma = new PrismaClient()
const MARKER_KEY = "loans_outstanding_principal_backfilled"

const roundMoney = (value: number) => Math.round(value * 100) / 100

async function main() {
  const marker = await prisma.appSetting.findUnique({ where: { settingKey: MARKER_KEY } })
  if (marker?.settingValue === "true") {
    console.log("Outstanding-principal backfill already ran. Nothing to do.")
    return
  }

  const loans = await prisma.loan.findMany({
    include: {
      repaymentSchedules: { select: { principalAmount: true, interestAmount: true } },
      repayments: { select: { amountPaid: true, finePaid: true } },
    },
    orderBy: { id: "asc" },
  })

  let updated = 0
  let unchanged = 0

  for (const loan of loans) {
    let outstanding: number

    if (loan.currentBalance <= 0) {
      // Fully settled — nothing left to collect.
      outstanding = 0
    } else {
      const scheduledPrincipal = loan.repaymentSchedules.reduce(
        (sum, row) => sum + (row.principalAmount ?? 0),
        0
      )
      const scheduledInterest = loan.repaymentSchedules.reduce(
        (sum, row) => sum + (row.interestAmount ?? 0),
        0
      )

      // Fallback when no schedule rows exist: in the old model
      // currentBalance = totalPayable − payments − fines.
      const fallbackTotalPayable =
        loan.currentBalance +
        loan.repayments.reduce((sum, r) => sum + (r.amountPaid || 0) + (r.finePaid || 0), 0)

      const totalPayable =
        scheduledPrincipal > 0 ? scheduledPrincipal + scheduledInterest : fallbackTotalPayable

      const ratio = totalPayable > 0 ? loan.principalAmount / totalPayable : 1
      const principalRepaid = loan.repayments.reduce(
        (sum, r) => sum + (r.amountPaid || 0) * ratio,
        0
      )

      outstanding = Math.max(0, roundMoney(loan.principalAmount - principalRepaid))
    }

    if (outstanding === loan.outstandingPrincipal) {
      unchanged += 1
      continue
    }

    await prisma.loan.update({
      where: { id: loan.id },
      data: { outstandingPrincipal: outstanding },
    })
    updated += 1
    console.log(
      `  ${loan.loanCode}: outstanding principal = UGX ${outstanding.toLocaleString()} ` +
        `(balance UGX ${loan.currentBalance.toLocaleString()})`
    )
  }

  await prisma.appSetting.upsert({
    where: { settingKey: MARKER_KEY },
    update: { settingValue: "true", updatedAt: new Date() },
    create: { settingKey: MARKER_KEY, settingValue: "true" },
  })

  console.log(`Backfill complete: ${updated} updated, ${unchanged} unchanged.`)
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
