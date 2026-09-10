"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Wallet, PiggyBank, HandCoins, TrendingUp, User } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Button from "@/components/ui/Button"
import { MetricCard } from "@/components/ui/Card"
import { formatUGX, formatDate } from "@/lib/utils"

interface MemberData {
  id: number
  memberCode: string
  farmerName: string
  gender: string | null
  phoneNumber: string | null
  email: string | null
  ninNumber: string | null
  address: string | null
  village: string | null
  parish: string | null
  subCounty: string | null
  district: string | null
  occupation: string | null
  idDocumentType: string | null
  idDocumentNumber: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  status: string | null
  registrationDate: string | null
  account: { accountNo: string; status: string } | null
  savingsBalance: number
  totalDeposits: number
  totalWithdrawals: number
  activeLoans: number
  totalShares: number
  photoUrl?: string | null
}

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setError(d.error)
        } else {
          setMember(d)
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load member")
        setLoading(false)
      })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerName: member.farmerName,
          phoneNumber: member.phoneNumber,
          email: member.email,
          gender: member.gender,
          ninNumber: member.ninNumber,
          address: member.address,
          village: member.village,
          parish: member.parish,
          subCounty: member.subCounty,
          district: member.district,
          occupation: member.occupation,
          idDocumentType: member.idDocumentType,
          idDocumentNumber: member.idDocumentNumber,
          nextOfKinName: member.nextOfKinName,
          nextOfKinPhone: member.nextOfKinPhone,
          status: member.status,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update member")
      }
      router.push("/members")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !member) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`Edit Member: ${member?.memberCode || ""}`}
        subtitle={member?.farmerName || ""}
        actions={
          <Button variant="ghost" onClick={() => router.back()} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        }
      />

      {member && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Savings Balance"
            value={formatUGX(member.savingsBalance)}
            icon={<Wallet className="w-5 h-5" />}
          />
          <MetricCard
            label="Total Deposits"
            value={formatUGX(member.totalDeposits)}
            icon={<PiggyBank className="w-5 h-5" />}
          />
          <MetricCard
            label="Active Loans"
            value={member.activeLoans}
            icon={<HandCoins className="w-5 h-5" />}
          />
          <MetricCard
            label="Total Shares"
            value={member.totalShares}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      )}

      {member?.account && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Account Number</p>
              <p className="text-sm font-mono font-semibold text-[var(--color-primary)]">{member.account.accountNo}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Account Status</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{member.account.status}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Registration Date</p>
              <p className="text-sm text-gray-900 dark:text-white">{member.registrationDate ? formatDate(member.registrationDate) : "—"}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {member && (
            <>
              <div className="flex items-center gap-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt="Member photo" className="w-24 h-24 rounded-full object-cover border-2 border-[var(--color-primary)]" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
                      <span className="text-3xl font-bold text-gray-400 dark:text-gray-500">
                        {member.farmerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">Member Photo</p>
                  {member.photoUrl ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Photo uploaded by member via portal</p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No photo uploaded yet</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase">Member Code</p>
                  <p className="text-lg font-bold text-blue-800 dark:text-blue-200 font-mono">{member.memberCode}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Full Name *" value={member.farmerName} onChange={(e) => setMember({ ...member, farmerName: e.target.value })} />
                  <Input label="Phone Number" value={member.phoneNumber || ""} onChange={(e) => setMember({ ...member, phoneNumber: e.target.value })} />
                  <Input label="Email" type="email" value={member.email || ""} onChange={(e) => setMember({ ...member, email: e.target.value })} />
                  <Select label="Gender" value={member.gender || "Male"} onChange={(e) => setMember({ ...member, gender: e.target.value })} options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
                  <Input label="NIN Number" value={member.ninNumber || ""} onChange={(e) => setMember({ ...member, ninNumber: e.target.value })} />
                  <Input label="Occupation" value={member.occupation || ""} onChange={(e) => setMember({ ...member, occupation: e.target.value })} />
                  <Select label="ID Document Type" value={member.idDocumentType || "National ID"} onChange={(e) => setMember({ ...member, idDocumentType: e.target.value })} options={[{ value: "National ID", label: "National ID" }, { value: "Passport", label: "Passport" }, { value: "Driving Permit", label: "Driving Permit" }, { value: "Voter Card", label: "Voter Card" }]} />
                  <Input label="ID Document Number" value={member.idDocumentNumber || ""} onChange={(e) => setMember({ ...member, idDocumentNumber: e.target.value })} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Address" value={member.address || ""} onChange={(e) => setMember({ ...member, address: e.target.value })} />
                  <Input label="Village" value={member.village || ""} onChange={(e) => setMember({ ...member, village: e.target.value })} />
                  <Input label="Parish" value={member.parish || ""} onChange={(e) => setMember({ ...member, parish: e.target.value })} />
                  <Input label="Sub-county" value={member.subCounty || ""} onChange={(e) => setMember({ ...member, subCounty: e.target.value })} />
                  <Input label="District" value={member.district || ""} onChange={(e) => setMember({ ...member, district: e.target.value })} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Next of Kin</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Next of Kin Name" value={member.nextOfKinName || ""} onChange={(e) => setMember({ ...member, nextOfKinName: e.target.value })} />
                  <Input label="Next of Kin Phone" value={member.nextOfKinPhone || ""} onChange={(e) => setMember({ ...member, nextOfKinPhone: e.target.value })} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Status</h3>
                <Select
                  label="Status"
                  value={member.status || "Active"}
                  onChange={(e) => setMember({ ...member, status: e.target.value })}
                  options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>Save Changes</Button>
        </div>
      </form>
    </div>
  )
}
