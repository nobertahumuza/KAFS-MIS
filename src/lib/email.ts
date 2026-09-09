import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "nobtechworld2@gmail.com",
    pass: process.env.SMTP_PASS || "",
  },
})

interface EmailOptions {
  to: string
  subject: string
  html: string
  cc?: string
}

export async function sendEmail({ to, subject, html, cc }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"KAFS SACCO" <${process.env.SMTP_USER || "nobtechworld2@gmail.com"}>`,
      to,
      cc,
      subject,
      html,
    })
    console.log("Email sent:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: String(error) }
  }
}

export function generateDailyReportHTML(data: {
  date: string
  totalMembers: number
  totalSavings: number
  totalLoans: number
  activeLoans: number
  totalExpenses: number
  newMembersToday: number
  depositsToday: number
  withdrawalsToday: number
  loanRepaymentsToday: number
  recentTransactions: Array<{
    type: string
    description: string
    amount: number
    date: string
  }>
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a365d, #2d5a8e); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.8; }
    .content { padding: 30px; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
    .metric { background: #f8fafc; border-radius: 8px; padding: 15px; border-left: 4px solid #1a365d; }
    .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .metric-value { font-size: 20px; font-weight: bold; color: #1a365d; margin-top: 4px; }
    .section-title { font-size: 16px; font-weight: bold; color: #1a365d; margin: 20px 0 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; color: #475569; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .inflow { color: #16a34a; font-weight: 600; }
    .outflow { color: #dc2626; font-weight: 600; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Kataho Farmers SACCO</h1>
      <p>Daily Financial Report — ${data.date}</p>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Total Members</div>
          <div class="metric-value">${data.totalMembers}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Active Loans</div>
          <div class="metric-value">${data.activeLoans}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Deposits Today</div>
          <div class="metric-value inflow">UGX ${data.depositsToday.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Withdrawals Today</div>
          <div class="metric-value outflow">UGX ${data.withdrawalsToday.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Loan Repayments Today</div>
          <div class="metric-value inflow">UGX ${data.loanRepaymentsToday.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Expenses This Month</div>
          <div class="metric-value outflow">UGX ${data.totalExpenses.toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">New Members Today</div>
          <div class="metric-value">${data.newMembersToday}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Savings</div>
          <div class="metric-value">UGX ${data.totalSavings.toLocaleString()}</div>
        </div>
      </div>

      <div class="section-title">Recent Transactions</div>
      <table>
        <thead>
          <tr><th>Type</th><th>Description</th><th>Amount</th></tr>
        </thead>
        <tbody>
          ${data.recentTransactions
            .map(
              (t) => `
            <tr>
              <td>${t.type}</td>
              <td>${t.description}</td>
              <td class="${["Deposit", "Loan Repayment", "Share Purchase"].includes(t.type) ? "inflow" : "outflow"}">
                ${["Deposit", "Loan Repayment", "Share Purchase"].includes(t.type) ? "+" : "-"}UGX ${t.amount.toLocaleString()}
              </td>
            </tr>`
            )
            .join("")}
          ${data.recentTransactions.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">No transactions today</td></tr>' : ""}
        </tbody>
      </table>
    </div>
    <div class="footer">
      <p>Designed by NobTechWorld | For help call 0760 399 849</p>
      <p>This is an automated report from KAFS SACCO Management System</p>
    </div>
  </div>
</body>
</html>`
}
