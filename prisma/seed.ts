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
    // EgoSMS Configuration
    sms_provider: "EgoSMS",
    sms_api_key: "nobtechworld",
    sms_api_secret: "9da115d9939022ecd051cdfd29b6982f8357c1e0c48a0b95",
    sms_sender_id: "KAFS",
    sms_base_url: "https://comms.egosms.co/api/v1/plain/",
    sms_enabled: "true",
    // Email Configuration (Gmail SMTP)
    email_host: "smtp.gmail.com",
    email_port: "465",
    email_user: "nobtechworld2@gmail.com",
    email_password: "",
    email_from: "nobtechworld2@gmail.com",
    email_enabled: "false",
    // Report Recipients
    report_recipients_to: "najunapacious@gmail.com,Paciousnajuna27@iCloud.com",
    report_recipients_cc: "bturinawe30@gmail.com,katahofarmerssacco@gmail.com,nobtechworld2@gmail.com",
    // Report Schedule
    report_daily_enabled: "true",
    report_weekly_enabled: "true",
    report_monthly_enabled: "true",
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.appSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: value },
      create: { settingKey: key, settingValue: value },
    })
  }
  console.log("  ✓ App Settings seeded (including EgoSMS + Email)")

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
      templateName: "Account Opening",
      templateKey: "account_opening",
      messageBody:
        "Dear {member_name}, your {account_type} account ({account_no}) has been opened successfully. Initial deposit: UGX {amount}. Welcome to KATAHO FARMERS' SACCO!",
    },
    {
      templateName: "Savings Deposit",
      templateKey: "savings_deposit",
      messageBody:
        "Dear {member_name}, your deposit of UGX {amount} has been processed successfully. New balance: UGX {balance}. Ref: {reference}.",
    },
    {
      templateName: "Savings Withdrawal",
      templateKey: "savings_withdrawal",
      messageBody:
        "Dear {member_name}, your withdrawal of UGX {amount} has been processed. New balance: UGX {balance}. Ref: {reference}.",
    },
    {
      templateName: "Loan Disbursement",
      templateKey: "loan_disbursement",
      messageBody:
        "Dear {member_name}, your loan of UGX {amount} ({loan_code}) has been disbursed. Monthly installment: UGX {installment}. Due: {due_date}.",
    },
    {
      templateName: "Loan Repayment",
      templateKey: "loan_repayment",
      messageBody:
        "Dear {member_name}, your loan repayment of UGX {amount} has been received. Outstanding balance: UGX {balance}. Ref: {reference}.",
    },
    {
      templateName: "Loan Approval",
      templateKey: "loan_approval",
      messageBody:
        "Dear {member_name}, your loan application ({application_code}) for UGX {amount} has been approved. Please visit the office for disbursement.",
    },
    {
      templateName: "Loan Rejection",
      templateKey: "loan_rejection",
      messageBody:
        "Dear {member_name}, your loan application ({application_code}) for UGX {amount} has been declined. Please contact the office for details.",
    },
    {
      templateName: "Share Purchase",
      templateKey: "share_purchase",
      messageBody:
        "Dear {member_name}, you have purchased {shares} shares at UGX {price} each. Total: UGX {amount}. Ref: {reference}.",
    },
    {
      templateName: "Fixed Deposit",
      templateKey: "fixed_deposit",
      messageBody:
        "Dear {member_name}, your fixed deposit of UGX {amount} for {period} months has been created. Maturity: {maturity_date}. Expected interest: UGX {interest}.",
    },
  ]

  for (const t of smsTemplates) {
    await prisma.smsTemplate.upsert({
      where: { templateKey: t.templateKey },
      update: { messageBody: t.messageBody, isActive: true },
      create: { ...t, isActive: true },
    })
  }
  console.log("  ✓ SMS Templates seeded (10 templates)")

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
