import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"

function createPrismaClient() {
  if (process.env.TURSO_DATABASE_URL) {
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter })
  }
  return new PrismaClient()
}

export async function POST() {
  const prisma = createPrismaClient()

  try {
    console.log("Seeding database via API...")

    // Users
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
        },
      })
    }

    // Account Types
    const accountTypes = [
      { typeName: "Savings", requiresOtherText: false },
      { typeName: "Fixed Deposit", requiresOtherText: false },
      { typeName: "Share", requiresOtherText: false },
    ]

    for (const at of accountTypes) {
      await prisma.accountType.upsert({
        where: { typeName: at.typeName },
        update: {},
        create: at,
      })
    }

    // App Settings
    const settings = [
      { settingKey: "company_name", settingValue: "Kataho Farmers SACCO" },
      { settingKey: "sacco_reg_number", settingValue: "KAFS-001" },
      { settingKey: "shares_price", settingValue: "10000" },
      { settingKey: "loan_interest_rate", settingValue: "2.5" },
      { settingKey: "savings_interest_rate", settingValue: "3" },
      { settingKey: "late_payment_fine_rate", settingValue: "5" },
      { settingKey: "withdrawal_fee", settingValue: "500" },
      { settingKey: "sms_sender_id", settingValue: "KAFS" },
      { settingKey: "report_recipient_to", settingValue: "najunapacious@gmail.com,Paciousnajuna27@iCloud.com" },
      { settingKey: "report_recipient_cc", settingValue: "bturinawe30@gmail.com,katahofarmerssacco@gmail.com,nobtechworld2@gmail.com" },
    ]

    for (const s of settings) {
      await prisma.appSetting.upsert({
        where: { settingKey: s.settingKey },
        update: { settingValue: s.settingValue },
        create: s,
      })
    }

    // Chart of Accounts
    const chartAccounts = [
      { accountCode: "1000", accountName: "Cash and Cash Equivalents", accountType: "Asset" },
      { accountCode: "1010", accountName: "Petty Cash", accountType: "Asset" },
      { accountCode: "1020", accountName: "Main Bank Account", accountType: "Asset" },
      { accountCode: "1100", accountName: "Savings Deposits", accountType: "Asset" },
      { accountCode: "1200", accountName: "Fixed Deposits", accountType: "Asset" },
      { accountCode: "1300", accountName: "Loans Receivable", accountType: "Asset" },
      { accountCode: "1400", accountName: "Interest Receivable", accountType: "Asset" },
      { accountCode: "1500", accountName: "Shares", accountType: "Asset" },
      { accountCode: "2000", accountName: "Accounts Payable", accountType: "Liability" },
      { accountCode: "2100", accountName: "Savings Withdrawals", accountType: "Liability" },
      { accountCode: "2200", accountName: "Accrued Interest", accountType: "Liability" },
      { accountCode: "2300", accountName: "Member Deposits", accountType: "Liability" },
      { accountCode: "3000", accountName: "Share Capital", accountType: "Equity" },
      { accountCode: "3100", accountName: "Retained Earnings", accountType: "Equity" },
      { accountCode: "3200", accountName: "Reserve Fund", accountType: "Equity" },
      { accountCode: "4000", accountName: "Interest Income - Loans", accountType: "Income" },
      { accountCode: "4100", accountName: "Interest Income - Fixed Deposits", accountType: "Income" },
      { accountCode: "4200", accountName: "Share Transfer Fees", accountType: "Income" },
      { accountCode: "4300", accountName: "Loan Processing Fees", accountType: "Income" },
      { accountCode: "4400", accountName: "Penalty Income", accountType: "Income" },
      { accountCode: "4500", accountName: "Withdrawal Fees", accountType: "Income" },
      { accountCode: "5000", accountName: "Administrative Expenses", accountType: "Expense" },
      { accountCode: "5100", accountName: "Staff Salaries", accountType: "Expense" },
      { accountCode: "5200", accountName: "Office Rent", accountType: "Expense" },
      { accountCode: "5300", accountName: "Utilities", accountType: "Expense" },
      { accountCode: "5400", accountName: "Marketing & Outreach", accountType: "Expense" },
      { accountCode: "5500", accountName: "Loan Loss Provision", accountType: "Expense" },
      { accountCode: "5600", accountName: "Bank Charges", accountType: "Expense" },
      { accountCode: "5700", accountName: "Depreciation", accountType: "Expense" },
      { accountCode: "5800", accountName: "Audit Fees", accountType: "Expense" },
    ]

    for (const ca of chartAccounts) {
      await prisma.chartOfAccount.upsert({
        where: { accountCode: ca.accountCode },
        update: {},
        create: ca,
      })
    }

    // SMS Templates
    const smsTemplates = [
      { templateName: "Welcome", templateKey: "welcome", messageBody: "Dear {name}, welcome to Kataho Farmers SACCO. Your member code is {code}. Thank you for joining us!" },
      { templateName: "Savings Confirmation", templateKey: "savings_deposit", messageBody: "Dear {name}, your savings deposit of UGX {amount} has been confirmed. New balance: UGX {balance}. Ref: {ref}" },
      { templateName: "Withdrawal Confirmation", templateKey: "savings_withdrawal", messageBody: "Dear {name}, your withdrawal of UGX {amount} has been processed. New balance: UGX {balance}. Fee: UGX {fee}. Ref: {ref}" },
      { templateName: "Loan Disbursement", templateKey: "loan_disbursement", messageBody: "Dear {name}, your loan of UGX {amount} has been disbursed. Monthly installment: UGX {installment}. Ref: {ref}" },
      { templateName: "Loan Repayment", templateKey: "loan_repayment", messageBody: "Dear {name}, your loan repayment of UGX {amount} has been received. Remaining balance: UGX {balance}. Ref: {ref}" },
      { templateName: "Share Purchase", templateKey: "share_purchase", messageBody: "Dear {name}, you have purchased {qty} shares at UGX {price} each. Total: UGX {total}. Ref: {ref}" },
    ]

    for (const t of smsTemplates) {
      await prisma.smsTemplate.upsert({
        where: { templateKey: t.templateKey },
        update: {},
        create: t,
      })
    }

    // SMS Settings
    const smsSettings = [
      { settingKey: "api_username", settingValue: "nobtechworld" },
      { settingKey: "api_password", settingValue: "9da115d9939022ecd051cdfd29b6982f8357c1e0c48a0b95" },
      { settingKey: "sender_id", settingValue: "KAFS" },
      { settingKey: "api_url", settingValue: "https://comms.egosms.co/api/v1/plain/" },
    ]

    for (const s of smsSettings) {
      await prisma.smsSetting.upsert({
        where: { settingKey: s.settingKey },
        update: { settingValue: s.settingValue },
        create: s,
      })
    }

    console.log("Database seeded successfully!")
    return NextResponse.json({ success: true, message: "Database seeded successfully" })
  } catch (error) {
    console.error("Seeding error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
