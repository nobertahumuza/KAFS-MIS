"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus, Wallet, ArrowLeft } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Button from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

interface MemberSearchResult {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
  email: string | null
  gender: string | null
  ninNumber: string | null
  address: string | null
  parish: string | null
  district: string | null
  occupation: string | null
}

interface AccountFormData {
  accountType: string
  initialDeposit: string
  applicationType: string
}

interface MemberFormData {
  farmerName: string
  phoneNumber: string
  email: string
  gender: string
  ninNumber: string
  address: string
  parish: string
  district: string
  occupation: string
}

const initialAccountForm: AccountFormData = {
  accountType: "Savings Account",
  initialDeposit: "",
  applicationType: "Single",
}

const initialMemberForm: MemberFormData = {
  farmerName: "",
  phoneNumber: "",
  email: "",
  gender: "Male",
  ninNumber: "",
  address: "",
  parish: "",
  district: "",
  occupation: "",
}

export default function AccountsPage() {
  const router = useRouter()
  const [memberSearch, setMemberSearch] = useState("")
  const [foundMember, setFoundMember] = useState<MemberSearchResult | null>(null)
  const [isNewMember, setIsNewMember] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)

  const [memberForm, setMemberForm] = useState<MemberFormData>(initialMemberForm)
  const [accountForm, setAccountForm] = useState<AccountFormData>(initialAccountForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) return
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&pageSize=5`)
      if (res.ok) {
        const data = await res.json()
        if (data.data && data.data.length > 0) {
          const exactMatch = data.data.find(
            (m: MemberSearchResult) =>
              m.memberCode.toLowerCase() === query.toLowerCase() ||
              m.phoneNumber === query
          )
          if (exactMatch) {
            setFoundMember(exactMatch)
            setMemberForm({
              farmerName: exactMatch.farmerName,
              phoneNumber: exactMatch.phoneNumber || "",
              email: exactMatch.email || "",
              gender: exactMatch.gender || "Male",
              ninNumber: exactMatch.ninNumber || "",
              address: exactMatch.address || "",
              parish: exactMatch.parish || "",
              district: exactMatch.district || "",
              occupation: exactMatch.occupation || "",
            })
            setIsNewMember(false)
          } else {
            setFoundMember(null)
            setIsNewMember(true)
            setMemberForm(initialMemberForm)
          }
        } else {
          setFoundMember(null)
          setIsNewMember(true)
          setMemberForm(initialMemberForm)
        }
        setSearchPerformed(true)
      }
    } catch (err) {
      console.error("Search failed:", err)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (memberSearch.trim()) {
        searchMembers(memberSearch.trim())
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [memberSearch, searchMembers])

  const handleAccountChange = (field: keyof AccountFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setAccountForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const handleMemberChange = (field: keyof MemberFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setMemberForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!accountForm.accountType) newErrors.accountType = "Account type is required"
    const deposit = parseFloat(accountForm.initialDeposit)
    if (!accountForm.initialDeposit || isNaN(deposit) || deposit < 0) {
      newErrors.initialDeposit = "Enter a valid initial deposit"
    }

    if (isNewMember || !foundMember) {
      if (!memberForm.farmerName.trim()) newErrors.farmerName = "Full name is required"
      if (!memberForm.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setSubmitError("")

    try {
      const payload: Record<string, unknown> = {
        accountType: accountForm.accountType,
        applicationType: accountForm.applicationType,
        initialDeposit: parseFloat(accountForm.initialDeposit),
      }

      if (foundMember && !isNewMember) {
        payload.memberId = foundMember.id
      } else {
        payload.newMember = {
          farmerName: memberForm.farmerName.trim(),
          phoneNumber: memberForm.phoneNumber.trim(),
          email: memberForm.email.trim() || null,
          gender: memberForm.gender,
          ninNumber: memberForm.ninNumber.trim() || null,
          address: memberForm.address.trim() || null,
          parish: memberForm.parish.trim() || null,
          district: memberForm.district.trim() || null,
          occupation: memberForm.occupation.trim() || null,
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

      router.push("/accounts")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Open New Account"
        subtitle="Search for existing member or create new one with account"
        actions={
          <Button variant="ghost" onClick={() => router.back()} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        }
      />

      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Member Lookup</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, member code, or phone number..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {searchPerformed && foundMember && (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Member Found</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {foundMember.farmerName} ({foundMember.memberCode})
                  </p>
                </div>
              </div>
            </div>
          )}

          {searchPerformed && isNewMember && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">New Member</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No existing member found. A new member will be created with this account.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Account Type *"
                value={accountForm.accountType}
                onChange={handleAccountChange("accountType")}
                error={errors.accountType}
                options={[
                  { value: "Savings Account", label: "Savings Account" },
                  { value: "Current Account", label: "Current Account" },
                  { value: "Fixed Deposit", label: "Fixed Deposit" },
                  { value: "Share Account", label: "Share Account" },
                ]}
              />
              <Select
                label="Application Type"
                value={accountForm.applicationType}
                onChange={handleAccountChange("applicationType")}
                options={[
                  { value: "Single", label: "Single" },
                  { value: "Joint", label: "Joint" },
                ]}
              />
              <Input
                label="Initial Deposit (UGX) *"
                type="number"
                value={accountForm.initialDeposit}
                onChange={handleAccountChange("initialDeposit")}
                error={errors.initialDeposit}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {(isNewMember || !foundMember) && memberSearch.trim() && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">New Member Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name *"
                  value={memberForm.farmerName}
                  onChange={handleMemberChange("farmerName")}
                  error={errors.farmerName}
                  placeholder="Enter full name"
                />
                <Input
                  label="Phone Number *"
                  value={memberForm.phoneNumber}
                  onChange={handleMemberChange("phoneNumber")}
                  error={errors.phoneNumber}
                  placeholder="0700000000"
                />
                <Input
                  label="Email"
                  type="email"
                  value={memberForm.email}
                  onChange={handleMemberChange("email")}
                  placeholder="email@example.com"
                />
                <Select
                  label="Gender"
                  value={memberForm.gender}
                  onChange={handleMemberChange("gender")}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                  ]}
                />
                <Input
                  label="NIN Number"
                  value={memberForm.ninNumber}
                  onChange={handleMemberChange("ninNumber")}
                  placeholder="National ID Number"
                />
                <Input
                  label="Occupation"
                  value={memberForm.occupation}
                  onChange={handleMemberChange("occupation")}
                  placeholder="e.g. Farmer"
                />
                <Input
                  label="Parish"
                  value={memberForm.parish}
                  onChange={handleMemberChange("parish")}
                  placeholder="Enter parish"
                />
                <Input
                  label="District"
                  value={memberForm.district}
                  onChange={handleMemberChange("district")}
                  placeholder="Enter district"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} icon={<Wallet className="w-4 h-4" />}>
              Open Account
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
