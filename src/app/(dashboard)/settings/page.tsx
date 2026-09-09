"use client"

import { useState, useEffect, useCallback } from "react"
import { Settings, Save, MessageSquare, Mail } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"

type Tab = "app" | "sms" | "email"

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("app")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // App settings
  const [saccoName, setSaccoName] = useState("")
  const [sharePrice, setSharePrice] = useState("")
  const [savingsInterestRate, setSavingsInterestRate] = useState("")
  const [loanInterestRate, setLoanInterestRate] = useState("")
  const [savingsInterestThreshold, setSavingsInterestThreshold] = useState("")
  const [withdrawalFee, setWithdrawalFee] = useState("")

  // SMS settings
  const [smsProvider, setSmsProvider] = useState("EgoSMS")
  const [smsApiKey, setSmsApiKey] = useState("")
  const [smsApiSecret, setSmsApiSecret] = useState("")
  const [smsSenderId, setSmsSenderId] = useState("")
  const [smsBaseUrl, setSmsBaseUrl] = useState("https://app.egosms.co/api/v1")
  const [smsEnabled, setSmsEnabled] = useState(false)

  // Email settings
  const [emailHost, setEmailHost] = useState("")
  const [emailPort, setEmailPort] = useState("")
  const [emailUser, setEmailUser] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [emailFrom, setEmailFrom] = useState("")
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [reportRecipientsTo, setReportRecipientsTo] = useState("")
  const [reportRecipientsCc, setReportRecipientsCc] = useState("")
  const [testSmsLoading, setTestSmsLoading] = useState(false)
  const [testEmailLoading, setTestEmailLoading] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings")
      if (res.ok) {
        const data = await res.json()
        const s = data.data || {}

        setSaccoName(s.sacco_name || "")
        setSharePrice(s.share_price || "")
        setSavingsInterestRate(s.savings_interest_rate || "")
        setLoanInterestRate(s.loan_interest_rate || "")
        setSavingsInterestThreshold(s.savings_interest_threshold || "")
        setWithdrawalFee(s.withdrawal_fee || "")

        setSmsProvider(s.sms_provider || "EgoSMS")
        setSmsApiKey(s.sms_api_key || "")
        setSmsApiSecret(s.sms_api_secret || "")
        setSmsSenderId(s.sms_sender_id || "")
        setSmsBaseUrl(s.sms_base_url || "https://app.egosms.co/api/v1")
        setSmsEnabled(s.sms_enabled === "true")

        setEmailHost(s.email_host || "")
        setEmailPort(s.email_port || "")
        setEmailUser(s.email_user || "")
        setEmailPassword(s.email_password || "")
        setEmailFrom(s.email_from || "")
        setEmailEnabled(s.email_enabled === "true")
        setReportRecipientsTo(s.report_recipients_to || "")
        setReportRecipientsCc(s.report_recipients_cc || "")
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings: Record<string, string> = {}

      if (tab === "app") {
        settings.sacco_name = saccoName
        settings.share_price = sharePrice
        settings.savings_interest_rate = savingsInterestRate
        settings.loan_interest_rate = loanInterestRate
        settings.savings_interest_threshold = savingsInterestThreshold
        settings.withdrawal_fee = withdrawalFee
      } else if (tab === "sms") {
        settings.sms_provider = smsProvider
        settings.sms_api_key = smsApiKey
        settings.sms_api_secret = smsApiSecret
        settings.sms_sender_id = smsSenderId
        settings.sms_base_url = smsBaseUrl
        settings.sms_enabled = String(smsEnabled)
      } else if (tab === "email") {
        settings.email_host = emailHost
        settings.email_port = emailPort
        settings.email_user = emailUser
        settings.email_password = emailPassword
        settings.email_from = emailFrom
        settings.email_enabled = String(emailEnabled)
        settings.report_recipients_to = reportRecipientsTo
        settings.report_recipients_cc = reportRecipientsCc
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        alert("Settings saved successfully")
      } else {
        alert("Failed to save settings")
      }
    } catch (err) {
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleTestSms = async () => {
    setTestSmsLoading(true)
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "0760399849",
          message: "Test SMS from KAFS SACCO Management System. If you received this, SMS is configured correctly!",
          messageType: "Test",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("Test SMS sent successfully!")
      } else {
        alert(`SMS failed: ${data.error || "Unknown error"}`)
      }
    } catch {
      alert("Failed to send test SMS")
    } finally {
      setTestSmsLoading(false)
    }
  }

  const handleTestEmail = async () => {
    setTestEmailLoading(true)
    try {
      const res = await fetch("/api/reports/daily", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        alert("Test email report sent successfully!")
      } else {
        alert(`Email failed: ${data.error || "Unknown error"}`)
      }
    } catch {
      alert("Failed to send test email")
    } finally {
      setTestEmailLoading(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "app", label: "App Settings", icon: <Settings className="w-4 h-4" /> },
    { key: "sms", label: "SMS Gateway", icon: <MessageSquare className="w-4 h-4" /> },
    { key: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Configure your SACCO application"
        actions={
          <Button
            icon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            loading={saving}
          >
            Save Settings
          </Button>
        }
      />

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "app" && (
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Application Settings</h3>
          <div className="space-y-4">
            <Input
              label="SACCO Name"
              value={saccoName}
              onChange={(e) => setSaccoName(e.target.value)}
              placeholder="Kataho Farmers SACCO"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Share Price (UGX)"
                type="number"
                value={sharePrice}
                onChange={(e) => setSharePrice(e.target.value)}
                min="0"
              />
              <Input
                label="Withdrawal Fee (UGX)"
                type="number"
                value={withdrawalFee}
                onChange={(e) => setWithdrawalFee(e.target.value)}
                min="0"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Savings Interest Rate (%)"
                type="number"
                value={savingsInterestRate}
                onChange={(e) => setSavingsInterestRate(e.target.value)}
                min="0"
                step="0.1"
              />
              <Input
                label="Loan Interest Rate (%)"
                type="number"
                value={loanInterestRate}
                onChange={(e) => setLoanInterestRate(e.target.value)}
                min="0"
                step="0.1"
              />
            </div>
            <Input
              label="Savings Interest Threshold (UGX)"
              type="number"
              value={savingsInterestThreshold}
              onChange={(e) => setSavingsInterestThreshold(e.target.value)}
              hint="Minimum balance to earn interest"
              min="0"
            />
          </div>
        </Card>
      )}

      {tab === "sms" && (
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">SMS Gateway Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable SMS</label>
              <button
                onClick={() => setSmsEnabled(!smsEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  smsEnabled ? "bg-[var(--color-primary)]" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    smsEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <Input
              label="Provider"
              value={smsProvider}
              onChange={(e) => setSmsProvider(e.target.value)}
              placeholder="EgoSMS"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="API Key"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="Your API key"
              />
              <Input
                label="API Secret"
                type="password"
                value={smsApiSecret}
                onChange={(e) => setSmsApiSecret(e.target.value)}
                placeholder="Your API secret"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Sender ID"
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
                placeholder="KAFSSACCO"
              />
              <Input
                label="API Base URL"
                value={smsBaseUrl}
                onChange={(e) => setSmsBaseUrl(e.target.value)}
                placeholder="https://comms.egosms.co/api/v1/plain/"
              />
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleTestSms}
                loading={testSmsLoading}
                disabled={!smsEnabled}
              >
                Send Test SMS
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === "email" && (
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Email Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Email</label>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  emailEnabled ? "bg-[var(--color-primary)]" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    emailEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="SMTP Host"
                value={emailHost}
                onChange={(e) => setEmailHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
              <Input
                label="SMTP Port"
                value={emailPort}
                onChange={(e) => setEmailPort(e.target.value)}
                placeholder="587"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email Username"
                value={emailUser}
                onChange={(e) => setEmailUser(e.target.value)}
                placeholder="your@email.com"
              />
              <Input
                label="Email Password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="App password"
              />
            </div>
            <Input
              label="From Address"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="noreply@sacco.com"
            />
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Report Recipients</h4>
              <Input
                label="To (comma-separated)"
                value={reportRecipientsTo}
                onChange={(e) => setReportRecipientsTo(e.target.value)}
                placeholder="najunapacious@gmail.com,Paciousnajuna27@iCloud.com"
              />
              <Input
                label="CC (comma-separated)"
                value={reportRecipientsCc}
                onChange={(e) => setReportRecipientsCc(e.target.value)}
                placeholder="bturinawe30@gmail.com,katahofarmerssacco@gmail.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reports are sent automatically: Daily at 6PM, Weekly on Monday at 6PM, Monthly on the 1st at 6PM.
              </p>
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleTestEmail}
                loading={testEmailLoading}
                disabled={!emailEnabled}
              >
                Send Test Report
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
