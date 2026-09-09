import prisma from "@/lib/prisma"

async function sendEgoSMS(
  phone: string,
  message: string,
  settings: Record<string, string>
): Promise<{ success: boolean; providerMsgId?: string; error?: string }> {
  const username = settings.sms_api_key || ""
  const password = settings.sms_api_secret || ""
  const senderId = settings.sms_sender_id || "KAFS"
  const apiUrl = settings.sms_base_url || "https://www.egosms.co/api/v1/plain/"

  if (!username || !password) return { success: false, error: "EgoSMS not configured" }

  const formattedPhone = phone.startsWith("+") ? phone.substring(1) : phone.startsWith("256") ? phone : "256" + phone.replace(/^0/, "")

  try {
    const params = new URLSearchParams({
      username,
      password,
      sender: senderId,
      number: formattedPhone,
      message,
    })
    const url = `${apiUrl}?${params.toString()}`
    const response = await fetch(url, { method: "GET" })
    const result = await response.text()

    const isError = result.toLowerCase().includes("error") ||
      result.toLowerCase().includes("not exist") ||
      result.toLowerCase().includes("not active") ||
      result.toLowerCase().includes("invalid") ||
      result.toLowerCase().includes("failed") ||
      result.includes("<!doctype")

    if (isError) {
      return { success: false, error: result }
    }

    return { success: true, providerMsgId: result }
  } catch (err) {
    return { success: false, error: `Network error: ${err instanceof Error ? err.message : "Unknown"}` }
  }
}

async function getSmsSettings(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany()
  const s: Record<string, string> = {}
  rows.forEach((r) => { s[r.settingKey] = r.settingValue || "" })
  return s
}

async function getTemplate(key: string): Promise<string | null> {
  const t = await prisma.smsTemplate.findUnique({ where: { templateKey: key } })
  return t?.isActive ? t.messageBody : null
}

function fill(template: string, vars: Record<string, string>): string {
  let msg = template
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), v)
  }
  return msg
}

function now(): string {
  return new Date().toLocaleString("en-UG", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" })
}

async function sendToMember(
  templateKey: string,
  memberId: number,
  vars: Record<string, string>,
  messageType: string
): Promise<void> {
  try {
    const settings = await getSmsSettings()
    if (settings.sms_enabled !== "true") return

    const template = await getTemplate(templateKey)
    if (!template) return

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member?.phoneNumber) return

    const message = fill(template, {
      member_name: member.farmerName,
      member_code: member.memberCode,
      ...vars,
    })

    const log = await prisma.smsLog.create({
      data: {
        memberId,
        phoneNumber: member.phoneNumber,
        message,
        messageType,
        status: "Pending",
      },
    })

    const result = await sendEgoSMS(member.phoneNumber, message, settings)

    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? "Sent" : "Failed",
        providerMsgId: result.providerMsgId || null,
        errorMessage: result.error || null,
        sentAt: result.success ? new Date() : null,
      },
    })
  } catch (err) {
    console.error(`SMS trigger [${templateKey}] error:`, err)
  }
}

export async function smsAccountOpening(memberId: number, accountNo: string, accountType: string, amount: number) {
  await sendToMember("account_opening", memberId, {
    account_no: accountNo,
    account_type: accountType,
    amount: amount.toLocaleString(),
    time: now(),
  }, "Account Opening")
}

export async function smsSavingsDeposit(memberId: number, amount: number, balance: number, reference: string) {
  await sendToMember("savings_deposit", memberId, {
    amount: amount.toLocaleString(),
    balance: balance.toLocaleString(),
    reference,
    time: now(),
  }, "Savings Deposit")
}

export async function smsSavingsWithdrawal(memberId: number, amount: number, balance: number, reference: string) {
  await sendToMember("savings_withdrawal", memberId, {
    amount: amount.toLocaleString(),
    balance: balance.toLocaleString(),
    reference,
    time: now(),
  }, "Savings Withdrawal")
}

export async function smsLoanDisbursement(memberId: number, loanCode: string, amount: number, installment: number, dueDate: string) {
  await sendToMember("loan_disbursement", memberId, {
    loan_code: loanCode,
    amount: amount.toLocaleString(),
    installment: installment.toLocaleString(),
    due_date: dueDate,
    time: now(),
  }, "Loan Disbursement")
}

export async function smsLoanRepayment(memberId: number, amount: number, balance: number, reference: string) {
  await sendToMember("loan_repayment", memberId, {
    amount: amount.toLocaleString(),
    balance: balance.toLocaleString(),
    reference,
    time: now(),
  }, "Loan Repayment")
}

export async function smsLoanApproval(memberId: number, applicationCode: string, amount: number) {
  await sendToMember("loan_approval", memberId, {
    application_code: applicationCode,
    amount: amount.toLocaleString(),
    time: now(),
  }, "Loan Approval")
}

export async function smsLoanRejection(memberId: number, applicationCode: string, amount: number) {
  await sendToMember("loan_rejection", memberId, {
    application_code: applicationCode,
    amount: amount.toLocaleString(),
    time: now(),
  }, "Loan Rejection")
}

export async function smsSharePurchase(memberId: number, shares: number, price: number, amount: number, reference: string) {
  await sendToMember("share_purchase", memberId, {
    shares: String(shares),
    price: price.toLocaleString(),
    amount: amount.toLocaleString(),
    reference,
    time: now(),
  }, "Share Purchase")
}

export async function smsFixedDeposit(memberId: number, amount: number, period: number, maturityDate: string, interest: number) {
  await sendToMember("fixed_deposit", memberId, {
    amount: amount.toLocaleString(),
    period: String(period),
    maturity_date: maturityDate,
    interest: interest.toLocaleString(),
    time: now(),
  }, "Fixed Deposit")
}

export async function smsExpense(memberId: number, category: string, description: string, amount: number) {
  await sendToMember("expense_recorded", memberId, {
    category,
    description,
    amount: amount.toLocaleString(),
    time: now(),
  }, "Expense")
}
