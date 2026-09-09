import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // ── Users ──────────────────────────────────────────────
  const users = [
    { fullName: "System Administrator", username: "admin", password: "admin123", role: "Admin" },
    { fullName: "Cashier User", username: "cashier", password: "cashier123", role: "Cashier" },
    { fullName: "Loans Officer", username: "officer", password: "officer123", role: "LoansOfficer" },
    { fullName: "Treasurer User", username: "treasurer", password: "treasurer123", role: "Treasurer" },
  ]

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        fullName: u.fullName,
        username: u.username,
        password: hashed,
        role: u.role,
        status: "Active",
      },
    })
    console.log(`  ✓ User: ${u.username} / ${u.password} (${u.role})`)
  }

  // ── Account Types ──────────────────────────────────────
  const accountTypes = ["Savings", "Fixed Deposit", "Share"]
  for (const typeName of accountTypes) {
    await prisma.accountType.upsert({
      where: { typeName },
      update: {},
      create: { typeName, status: "Active" },
    })
    console.log(`  ✓ AccountType: ${typeName}`)
  }

  // ── App Settings ───────────────────────────────────────
  const settings: Record<string, string> = {
    sacco_name: "KATAHO FARMERS' SACCO",
    share_price: "10000",
    savings_interest_rate: "3",
    loan_interest_rate: "2.5",
    savings_interest_threshold: "500000",
    withdrawal_fee: "500",
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.appSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: value },
      create: { settingKey: key, settingValue: value },
    })
  }
  console.log("  ✓ App Settings seeded")

  // ── Chart of Accounts ──────────────────────────────────
  const chartAccounts = [
    { accountCode: "1000", accountName: "Cash", accountType: "Asset" },
    { accountCode: "1010", accountName: "Bank", accountType: "Asset" },
    { accountCode: "1020", accountName: "Accounts Receivable", accountType: "Asset" },
    { accountCode: "2000", accountName: "Share Capital", accountType: "Liability" },
    { accountCode: "2010", accountName: "Retained Earnings", accountType: "Liability" },
    { accountCode: "3000", accountName: "Interest Income", accountType: "Revenue" },
    { accountCode: "3010", accountName: "Fee Income", accountType: "Revenue" },
    { accountCode: "4000", accountName: "Salaries Expense", accountType: "Expense" },
    { accountCode: "4010", accountName: "Rent Expense", accountType: "Expense" },
    { accountCode: "4020", accountName: "Utilities Expense", accountType: "Expense" },
  ]

  for (const a of chartAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { accountCode: a.accountCode },
      update: {},
      create: { ...a, balance: 0, status: "Active" },
    })
  }
  console.log("  ✓ Chart of Accounts seeded")

  // ── SMS Templates ──────────────────────────────────────
  const smsTemplates = [
    {
      templateName: "Welcome",
      templateKey: "welcome",
      messageBody:
        "Dear {member_name}, welcome to KATAHO FARMERS' SACCO. Your member code is {member_code}. Thank you for joining us!",
    },
    {
      templateName: "Savings Confirmation",
      templateKey: "savings_confirmation",
      messageBody:
        "Dear {member_name}, your {transaction_type} of UGX {amount} has been processed. New balance: UGX {balance}. Ref: {reference}.",
    },
    {
      templateName: "Loan Repayment",
      templateKey: "loan_repayment",
      messageBody:
        "Dear {member_name}, your loan repayment of UGX {amount} has been received. Outstanding balance: UGX {balance}. Ref: {reference}.",
    },
  ]

  for (const t of smsTemplates) {
    await prisma.smsTemplate.upsert({
      where: { templateKey: t.templateKey },
      update: { messageBody: t.messageBody },
      create: { ...t, isActive: true },
    })
  }
  console.log("  ✓ SMS Templates seeded")

  // ── SMS Settings (EgoSMS) ─────────────────────────────
  const smsSettings: Record<string, string> = {
    provider: "EgoSMS",
    api_key: "",
    api_secret: "",
    sender_id: "KAFSSACCO",
    base_url: "https://app.egosms.co/api/v1",
    enabled: "false",
  }

  for (const [key, value] of Object.entries(smsSettings)) {
    await prisma.smsSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: value },
      create: { settingKey: key, settingValue: value },
    })
  }
  console.log("  ✓ SMS Settings seeded")

  console.log("\nSeeding complete!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
