"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet, ArrowLeft, User, FileText, Building, CheckCircle } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Button from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

interface FormData {
  // Application Details
  appDate: string
  applicationType: string
  // Account & Photo
  accountType: string
  accountTypeOther: string
  currency: string
  currencyOther: string
  memberId: string
  // Personal Details
  fullName: string
  gender: string
  maritalStatus: string
  dateOfBirth: string
  placeOfBirth: string
  district: string
  county: string
  subCounty: string
  nationality: string
  phoneNumber: string
  emailAddress: string
  residentialAddress: string
  occupation: string
  employerBusiness: string
  ninNumber: string
  // Banking / KYC
  sourceOfFunds: string
  purposeOfAccount: string
  nextOfKinName: string
  nextOfKinContact: string
  beneficiary: string
  idDocumentType: string
  idDocumentNumber: string
  status: string
}

const initialForm: FormData = {
  appDate: new Date().toISOString().split("T")[0],
  applicationType: "Single",
  accountType: "Savings Account",
  accountTypeOther: "",
  currency: "UGX",
  currencyOther: "",
  memberId: "",
  fullName: "",
  gender: "Male",
  maritalStatus: "Single",
  dateOfBirth: "",
  placeOfBirth: "",
  district: "",
  county: "",
  subCounty: "",
  nationality: "Ugandan",
  phoneNumber: "",
  emailAddress: "",
  residentialAddress: "",
  occupation: "",
  employerBusiness: "",
  ninNumber: "",
  sourceOfFunds: "",
  purposeOfAccount: "",
  nextOfKinName: "",
  nextOfKinContact: "",
  beneficiary: "",
  idDocumentType: "",
  idDocumentNumber: "",
  status: "Draft",
}

const ACCOUNT_TYPES = [
  "Savings Account",
  "Current Account",
  "Fixed Deposit",
  "Share Account",
  "Other",
]

const CURRENCIES = ["UGX", "USD", "Other"]

const MARITAL_STATUSES = ["Single", "Married", "Other"]

const SOURCE_OF_FUNDS = [
  "Salary",
  "Business Income",
  "Farming/Agriculture",
  "Investment Returns",
  "Inheritance",
  "Savings",
  "Loan Proceeds",
  "Other",
]

const PURPOSES = [
  "Personal Savings",
  "Business Operations",
  "Salary Payments",
  "Loan Repayment",
  "School Fees",
  "Agricultural Activities",
  "Investment",
  "Other",
]

const ID_TYPES = [
  "National ID (NIN)",
  "Passport",
  "Driving Permit",
  "Voter Card",
  "Student ID",
  "Other",
]

export default function AccountsPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [success, setSuccess] = useState(false)
  const [nextAccountNo, setNextAccountNo] = useState("Loading...")
  const [members, setMembers] = useState<{ id: number; memberCode: string; farmerName: string }[]>([])

  useEffect(() => {
    fetch("/api/accounts/next-code")
      .then((res) => res.json())
      .then((d) => setNextAccountNo(d.code || "KAFS-ACC-001"))
      .catch(() => setNextAccountNo("KAFS-ACC-001"))

    fetch("/api/members?pageSize=1000")
      .then((res) => res.json())
      .then((d) => setMembers(d.data || []))
      .catch(() => setMembers([]))
  }, [])

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = "Full name is required"
    if (!form.phoneNumber.trim()) e.phoneNumber = "Phone number is required"
    if (!form.accountType) e.accountType = "Account type is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError("")

    try {
      const payload: Record<string, unknown> = {
        applicationType: form.applicationType,
        accountType: form.accountType,
        accountTypeOther: form.accountType || form.accountType === "Other" ? form.accountTypeOther : undefined,
        currency: form.currency,
        currencyOther: form.currency === "Other" ? form.currencyOther : undefined,
        maritalStatus: form.maritalStatus,
        dateOfBirth: form.dateOfBirth || undefined,
        placeOfBirth: form.placeOfBirth || undefined,
        nationality: form.nationality,
        county: form.county || undefined,
        sourceOfFunds: form.sourceOfFunds || undefined,
        purposeOfAccount: form.purposeOfAccount || undefined,
        nextOfKinName: form.nextOfKinName || undefined,
        nextOfKinContact: form.nextOfKinContact || undefined,
        beneficiary: form.beneficiary || undefined,
        idDocumentType: form.idDocumentType || undefined,
        idDocumentNumber: form.idDocumentNumber || undefined,
        status: form.status,
      }

      if (form.memberId) {
        payload.memberId = parseInt(form.memberId)
      } else {
        payload.newMember = {
          farmerName: form.fullName.trim(),
          phoneNumber: form.phoneNumber.trim(),
          email: form.emailAddress.trim() || null,
          gender: form.gender,
          ninNumber: form.ninNumber.trim() || null,
          address: form.residentialAddress.trim() || null,
          district: form.district.trim() || null,
          subCounty: form.subCounty.trim() || null,
          occupation: form.occupation.trim() || null,
        }
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to open account")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/accounts")
      }, 2000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Account Opened Successfully!</h2>
          <p className="text-white/40 text-sm">Redirecting to accounts list...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Account Opening"
        subtitle="Register a new account"
        actions={
          <Button variant="ghost" onClick={() => router.back()} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          {/* ── SECTION 1: Application Details ─────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Application Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Date"
                type="date"
                value={form.appDate}
                onChange={handleChange("appDate")}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Our Ref</label>
                <input
                  type="text"
                  value={nextAccountNo}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nature of Application *</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationType"
                      value="Single"
                      checked={form.applicationType === "Single"}
                      onChange={handleChange("applicationType")}
                      className="w-4 h-4"
                    />
                    Single
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationType"
                      value="Joint"
                      checked={form.applicationType === "Joint"}
                      onChange={handleChange("applicationType")}
                      className="w-4 h-4"
                    />
                    Joint
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Allocated Account No.</label>
                <input
                  type="text"
                  value={nextAccountNo}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Account & Photo ─────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center">
                <Building className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Account & Photo</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Account Type *"
                value={form.accountType}
                onChange={handleChange("accountType")}
                error={errors.accountType}
                placeholder="Select account type"
                options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))}
              />
              {form.accountType === "Other" && (
                <Input
                  label="Specify Account Type"
                  value={form.accountTypeOther}
                  onChange={handleChange("accountTypeOther")}
                  placeholder="Enter account type"
                />
              )}
              <Select
                label="Currency *"
                value={form.currency}
                onChange={handleChange("currency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              {form.currency === "Other" && (
                <Input
                  label="Specify Currency"
                  value={form.currencyOther}
                  onChange={handleChange("currencyOther")}
                  placeholder="Enter currency"
                />
              )}
              <Select
                label="Linked Member (optional)"
                value={form.memberId}
                onChange={handleChange("memberId")}
                placeholder="— None —"
                options={members.map((m) => ({
                  value: String(m.id),
                  label: `#${m.memberCode} — ${m.farmerName}`,
                }))}
              />
            </div>
          </div>

          {/* ── SECTION 3: Personal Details ─────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                <User className="w-4 h-4 text-[var(--color-primary)]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Personal Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Input
                  label="Full Name *"
                  value={form.fullName}
                  onChange={handleChange("fullName")}
                  error={errors.fullName}
                  placeholder="Enter full name as it appears on ID"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender *</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="Male"
                      checked={form.gender === "Male"}
                      onChange={handleChange("gender")}
                      className="w-4 h-4"
                    />
                    Male
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="Female"
                      checked={form.gender === "Female"}
                      onChange={handleChange("gender")}
                      className="w-4 h-4"
                    />
                    Female
                  </label>
                </div>
              </div>
              <Select
                label="Marital Status"
                value={form.maritalStatus}
                onChange={handleChange("maritalStatus")}
                options={MARITAL_STATUSES.map((s) => ({ value: s, label: s }))}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={handleChange("dateOfBirth")}
              />
              <Input
                label="Place of Birth"
                value={form.placeOfBirth}
                onChange={handleChange("placeOfBirth")}
                placeholder="Enter place of birth"
              />
              <Input
                label="District"
                value={form.district}
                onChange={handleChange("district")}
                placeholder="Enter district"
              />
              <Input
                label="County"
                value={form.county}
                onChange={handleChange("county")}
                placeholder="Enter county"
              />
              <Input
                label="Sub-county"
                value={form.subCounty}
                onChange={handleChange("subCounty")}
                placeholder="Enter sub-county"
              />
              <Input
                label="Nationality"
                value={form.nationality}
                onChange={handleChange("nationality")}
                placeholder="Enter nationality"
              />
              <Input
                label="Telephone / Contact *"
                value={form.phoneNumber}
                onChange={handleChange("phoneNumber")}
                error={errors.phoneNumber}
                placeholder="07XXXXXXXX"
              />
              <Input
                label="Email Address"
                type="email"
                value={form.emailAddress}
                onChange={handleChange("emailAddress")}
                placeholder="email@example.com"
              />
              <div className="md:col-span-3">
                <Input
                  label="Residential Address"
                  value={form.residentialAddress}
                  onChange={handleChange("residentialAddress")}
                  placeholder="Enter residential address"
                />
              </div>
              <Input
                label="Occupation"
                value={form.occupation}
                onChange={handleChange("occupation")}
                placeholder="Enter occupation"
              />
              <Input
                label="Employer / Business Name"
                value={form.employerBusiness}
                onChange={handleChange("employerBusiness")}
                placeholder="Enter employer or business"
              />
              <Input
                label="National ID / NIN"
                value={form.ninNumber}
                onChange={handleChange("ninNumber")}
                placeholder="Enter NIN number"
              />
            </div>
          </div>

          {/* ── SECTION 4: Banking / KYC ────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Additional Banking / KYC Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Source of Funds"
                value={form.sourceOfFunds}
                onChange={handleChange("sourceOfFunds")}
                placeholder="Select..."
                options={SOURCE_OF_FUNDS.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Purpose of Account"
                value={form.purposeOfAccount}
                onChange={handleChange("purposeOfAccount")}
                placeholder="Select..."
                options={PURPOSES.map((p) => ({ value: p, label: p }))}
              />
              <Select
                label="ID Document Type"
                value={form.idDocumentType}
                onChange={handleChange("idDocumentType")}
                placeholder="Select..."
                options={ID_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <Input
                label="ID Document Number"
                value={form.idDocumentNumber}
                onChange={handleChange("idDocumentNumber")}
                placeholder="Enter document number"
              />
              <Input
                label="Next of Kin Name"
                value={form.nextOfKinName}
                onChange={handleChange("nextOfKinName")}
                placeholder="Enter next of kin name"
              />
              <Input
                label="Next of Kin Contact"
                value={form.nextOfKinContact}
                onChange={handleChange("nextOfKinContact")}
                placeholder="Phone number"
              />
              <Input
                label="Beneficiary"
                value={form.beneficiary}
                onChange={handleChange("beneficiary")}
                placeholder="Enter beneficiary"
              />
              <Select
                label="Status"
                value={form.status}
                onChange={handleChange("status")}
                options={[
                  { value: "Draft", label: "Draft" },
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                  { value: "Closed", label: "Closed" },
                ]}
              />
            </div>
          </div>

          {/* ── FORM ACTIONS ────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} icon={<Wallet className="w-4 h-4" />}>
              Save Account
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
