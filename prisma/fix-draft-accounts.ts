import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const apply = process.argv.includes("--apply")

  const drafts = await p.customer.findMany({
    where: { status: "Draft" },
    select: { id: true, accountNo: true, status: true, memberId: true, member: { select: { memberCode: true, farmerName: true } } },
  })
  console.log(`Draft accounts: ${drafts.length}`)
  drafts.forEach((d) => console.log(`  customer#${d.id} ${d.accountNo} memberId=${d.memberId} ${d.member?.memberCode} ${d.member?.farmerName}`))

  if (!apply) {
    console.log("(dry run — pass --apply)")
    return
  }

  const res = await p.customer.updateMany({ where: { status: "Draft" }, data: { status: "Active" } })
  console.log(`updated: ${res.count}`)

  const members = await p.member.count()
  const accountsActive = await p.customer.count({ where: { status: "Active" } })
  const accountsAll = await p.customer.count()
  console.log(`\nMember (all)          : ${members}`)
  console.log(`Account (Active)      : ${accountsActive}`)
  console.log(`Account (all)         : ${accountsAll}`)
  console.log(members === accountsActive ? "MATCH ✅" : "STILL DIFFERENT ❌")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => p.$disconnect())
