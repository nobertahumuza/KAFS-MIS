"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Button from "@/components/ui/Button"

interface FormData {
  full_name: string
  phone: string
  email: string
  gender: string
  nin: string
  address: string
  parish: string
  district: string
  occupation: string
  next_of_kin_name: string
  next_of_kin_phone: string
}

const initialFormData: FormData = {
  full_name: "",
  phone: "",
  email: "",
  gender: "Male",
  nin: "",
  address: "",
  parish: "",
  district: "",
  occupation: "",
  next_of_kin_name: "",
  next_of_kin_phone: "",
}

export default function RegisterMemberPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState("")

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.full_name.trim()) newErrors.full_name = "Full name is required"
    if (!form.phone.trim()) newErrors.phone = "Phone number is required"
    if (!form.gender) newErrors.gender = "Gender is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError("")

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerName: form.full_name.trim(),
          phoneNumber: form.phone.trim(),
          email: form.email.trim() || null,
          gender: form.gender,
          ninNumber: form.nin.trim() || null,
          address: form.address.trim() || null,
          parish: form.parish.trim() || null,
          district: form.district.trim() || null,
          occupation: form.occupation.trim() || null,
          nextOfKinName: form.next_of_kin_name.trim() || null,
          nextOfKinPhone: form.next_of_kin_phone.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to register member")
      }

      router.push("/members")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Register New Member"
        subtitle="Fill in the member details below"
        actions={
          <Button variant="ghost" onClick={() => router.back()} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
          {serverError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                value={form.full_name}
                onChange={handleChange("full_name")}
                error={errors.full_name}
                placeholder="Enter full name"
              />
              <Input
                label="Phone Number *"
                value={form.phone}
                onChange={handleChange("phone")}
                error={errors.phone}
                placeholder="0700000000"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="email@example.com"
              />
              <Select
                label="Gender *"
                value={form.gender}
                onChange={handleChange("gender")}
                error={errors.gender}
                options={[
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                ]}
              />
              <Input
                label="NIN Number"
                value={form.nin}
                onChange={handleChange("nin")}
                placeholder="National ID Number"
              />
              <Input
                label="Occupation"
                value={form.occupation}
                onChange={handleChange("occupation")}
                placeholder="e.g. Farmer, Teacher"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Address"
                value={form.address}
                onChange={handleChange("address")}
                placeholder="Village/Street"
              />
              <Input
                label="Parish"
                value={form.parish}
                onChange={handleChange("parish")}
                placeholder="Enter parish"
              />
              <Input
                label="District"
                value={form.district}
                onChange={handleChange("district")}
                placeholder="Enter district"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Next of Kin</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Next of Kin Name"
                value={form.next_of_kin_name}
                onChange={handleChange("next_of_kin_name")}
                placeholder="Full name"
              />
              <Input
                label="Next of Kin Phone"
                value={form.next_of_kin_phone}
                onChange={handleChange("next_of_kin_phone")}
                placeholder="0700000000"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} icon={<Save className="w-4 h-4" />}>
            Register Member
          </Button>
        </div>
      </form>
    </div>
  )
}
