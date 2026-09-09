"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Search, Plus, Eye, FileText, ChevronLeft, ChevronRight, Check, User,
  DollarSign, Users, Shield, Heart, ClipboardCheck, UsersRound, Award, X, Download
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import Table from "@/components/ui/Table"
import Badge, { getStatusVariant } from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { formatUGX, formatDate } from "@/lib/utils"

interface MemberOption {
  id: number
  memberCode: string
  farmerName: string
  phoneNumber: string | null
  gender: string | null
  parish: string | null
  district: string | null
  occupation: string | null
}

interface Guarantor {
  fullName: string
  accountNumber: string
  telephone: string
  memberId: number | null
}

interface Security {
  permanentHome: string
  village: string
  parish: string
  subCounty: string
  county: string
  district: string
  residentialAddress: string
  securityLocation: string
  securityOwnership: string
  marketPrice: string
  securityDescription: string
  estimatedValue: string
  totalSecurityValue: string
  lcConfirmation: string
  securityBoundaries: string
}

interface SpouseConsent {
  spouseName: string
  approvedAmount: string
  telephone: string
}

interface Appraisal {
  appraisalNotes: string
  recommendation: string
  comments: string
  officerName: string
}

interface CommitteeDecision {
  decision: string
  approvedAmount: string
  chairpersonName: string
  comments: string
}

interface BoardDecision {
  decision: string
  approvedAmount: string
  chairpersonName: string
  comments: string
}

interface WizardData {
  memberId: string
  memberSearch: string
  loanAmount: string
  loanPurpose: string
  loanDuration: string
  interestRate: string
  repaymentMode: string
  guarantors: Guarantor[]
  security: Security
  spouseConsent: SpouseConsent
  appraisal: Appraisal
  committeeDecision: CommitteeDecision
  boardDecision: BoardDecision
}

const emptySecurity: Security = {
  permanentHome: "", village: "", parish: "", subCounty: "", county: "",
  district: "", residentialAddress: "", securityLocation: "", securityOwnership: "",
  marketPrice: "", securityDescription: "", estimatedValue: "", totalSecurityValue: "",
  lcConfirmation: "", securityBoundaries: "",
}

const emptySpouseConsent: SpouseConsent = { spouseName: "", approvedAmount: "", telephone: "" }
const emptyAppraisal: Appraisal = { appraisalNotes: "", recommendation: "", comments: "", officerName: "" }
const emptyCommittee: CommitteeDecision = { decision: "", approvedAmount: "", chairpersonName: "", comments: "" }
const emptyBoard: BoardDecision = { decision: "", approvedAmount: "", chairpersonName: "", comments: "" }

const initialWizardData: WizardData = {
  memberId: "",
  memberSearch: "",
  loanAmount: "",
  loanPurpose: "",
  loanDuration: "12",
  interestRate: "10",
  repaymentMode: "Monthly",
  guarantors: [],
  security: emptySecurity,
  spouseConsent: emptySpouseConsent,
  appraisal: emptyAppraisal,
  committeeDecision: emptyCommittee,
  boardDecision: emptyBoard,
}

const STEP_TITLES = [
  "Personal Info",
  "Loan Details",
  "Guarantors",
  "Collateral/Security",
  "Spouse Consent",
  "Appraisal",
  "Committee Review",
  "Board Review",
]

const STEP_ICONS = [User, DollarSign, Users, Shield, Heart, ClipboardCheck, UsersRound, Award]

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Officer_Appraisal", label: "Officer Appraisal" },
  { value: "Committee_Review", label: "Committee Review" },
  { value: "Board_Review", label: "Board Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Disbursed", label: "Disbursed" },
]

interface Application {
  id: number
  applicationCode: string
  memberId: number
  loanAmount: number
  loanPurpose: string | null
  loanDuration: number | null
  interestRate: number | null
  monthlyInstallment: number | null
  status: string
  submittedAt: string | null
  disbursedAt: string | null
  createdAt: string
  member: { id: number; farmerName: string; memberCode: string; phoneNumber: string | null }
  guarantors: Array<{ id: number; fullName: string; telephone: string | null }>
}

const PAGE_SIZE = 10

export default function LoanApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [memberSearch, setMemberSearch] = useState("")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const memberInputRef = useRef<HTMLInputElement>(null)
  const [memberDropdownPos, setMemberDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/loan-applications?${params}`)
      if (res.ok) {
        const data = await res.json()
        setApplications(data.data || [])
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchApplications() }, [fetchApplications])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFontSize(18)
      doc.text("KAFS SACCO", pageWidth / 2, 20, { align: "center" })
      doc.setFontSize(14)
      doc.text("Loan Applications Report", pageWidth / 2, 28, { align: "center" })
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Total: ${total} applications`, pageWidth / 2, 34, { align: "center" })

      const tableData = applications.map((app) => [
        app.applicationCode,
        app.member.farmerName,
        app.member.memberCode,
        app.loanPurpose || "-",
        formatUGX(app.loanAmount || 0),
        `${app.loanDuration || 0} months`,
        app.status,
        formatDate(app.createdAt),
      ])

      autoTable(doc, {
        startY: 40,
        head: [["Code", "Applicant Name", "Member Code", "Purpose", "Amount", "Duration", "Status", "Date"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      })

      doc.setFontSize(8)
      doc.text("Designed by NobTechWorld | 0760 399 849", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" })

      doc.save(`KAFS_loan_applications_${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
      alert("Failed to generate PDF")
    }
  }

  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) { setMemberOptions([]); return }
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&pageSize=10`)
      if (res.ok) {
        const data = await res.json()
        setMemberOptions(data.data || [])
      }
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchMembers(memberSearch), 300)
    return () => clearTimeout(timer)
  }, [memberSearch, searchMembers])

  const handleMemberSelect = (member: MemberOption) => {
    setWizardData((prev) => ({
      ...prev,
      memberId: String(member.id),
      memberSearch: `${member.memberCode} - ${member.farmerName}`,
    }))
    setMemberDropdownOpen(false)
    setMemberOptions([])
  }

  const updateDropdownPos = () => {
    if (memberInputRef.current) {
      const rect = memberInputRef.current.getBoundingClientRect()
      setMemberDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  const updateWizard = <K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setWizardData((prev) => ({ ...prev, [field]: value }))
  }

  const updateSecurity = <K extends keyof Security>(field: K, value: string) => {
    setWizardData((prev) => ({ ...prev, security: { ...prev.security, [field]: value } }))
  }

  const updateSpouseConsent = <K extends keyof SpouseConsent>(field: K, value: string) => {
    setWizardData((prev) => ({ ...prev, spouseConsent: { ...prev.spouseConsent, [field]: value } }))
  }

  const updateAppraisal = <K extends keyof Appraisal>(field: K, value: string) => {
    setWizardData((prev) => ({ ...prev, appraisal: { ...prev.appraisal, [field]: value } }))
  }

  const updateCommittee = <K extends keyof CommitteeDecision>(field: K, value: string) => {
    setWizardData((prev) => ({ ...prev, committeeDecision: { ...prev.committeeDecision, [field]: value } }))
  }

  const updateBoard = <K extends keyof BoardDecision>(field: K, value: string) => {
    setWizardData((prev) => ({ ...prev, boardDecision: { ...prev.boardDecision, [field]: value } }))
  }

  const addGuarantor = () => {
    setWizardData((prev) => ({
      ...prev,
      guarantors: [...prev.guarantors, { fullName: "", accountNumber: "", telephone: "", memberId: null }],
    }))
  }

  const updateGuarantor = (index: number, field: keyof Guarantor, value: string | number | null) => {
    setWizardData((prev) => ({
      ...prev,
      guarantors: prev.guarantors.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    }))
  }

  const removeGuarantor = (index: number) => {
    setWizardData((prev) => ({
      ...prev,
      guarantors: prev.guarantors.filter((_, i) => i !== index),
    }))
  }

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return !!wizardData.memberId
      case 1: return !!wizardData.loanAmount && parseFloat(wizardData.loanAmount) > 0
      default: return true
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = {
        memberId: parseInt(wizardData.memberId),
        loanAmount: parseFloat(wizardData.loanAmount),
        loanPurpose: wizardData.loanPurpose || null,
        loanDuration: parseInt(wizardData.loanDuration) || 12,
        interestRate: parseFloat(wizardData.interestRate) || 10,
        repaymentMode: wizardData.repaymentMode,
        guarantors: wizardData.guarantors.filter((g) => g.fullName.trim()),
        securities: wizardData.security,
        spouseConsent: wizardData.spouseConsent.spouseName ? wizardData.spouseConsent : null,
        appraisal: wizardData.appraisal.appraisalNotes ? wizardData.appraisal : null,
        committeeDecision: wizardData.committeeDecision.decision ? wizardData.committeeDecision : null,
        boardDecision: wizardData.boardDecision.decision ? wizardData.boardDecision : null,
        status: "Submitted",
      }

      const res = await fetch("/api/loan-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to submit application")
      }

      setWizardOpen(false)
      setWizardData(initialWizardData)
      setCurrentStep(0)
      setMemberSearch("")
      fetchApplications()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const advanceApplication = async (appId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/loan-applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to update status")
        return
      }
      fetchApplications()
      if (selectedApp?.id === appId) {
        const detailRes = await fetch(`/api/loan-applications/${appId}`)
        if (detailRes.ok) setSelectedApp(await detailRes.json())
      }
    } catch {
      alert("Failed to update application status")
    }
  }

  const getWorkflowActions = (app: Application) => {
    const actions: Array<{ label: string; status: string; variant: "primary" | "danger" | "outline" }> = []
    switch (app.status) {
      case "Draft":
        actions.push({ label: "Submit", status: "Submitted", variant: "primary" })
        break
      case "Submitted":
        actions.push({ label: "Start Appraisal", status: "Officer_Appraisal", variant: "primary" })
        actions.push({ label: "Reject", status: "Rejected", variant: "danger" })
        break
      case "Officer_Appraisal":
        actions.push({ label: "Send to Committee", status: "Committee_Review", variant: "primary" })
        actions.push({ label: "Reject", status: "Rejected", variant: "danger" })
        break
      case "Committee_Review":
        actions.push({ label: "Send to Board", status: "Board_Review", variant: "primary" })
        actions.push({ label: "Reject", status: "Rejected", variant: "danger" })
        break
      case "Board_Review":
        actions.push({ label: "Approve", status: "Approved", variant: "primary" })
        actions.push({ label: "Reject", status: "Rejected", variant: "danger" })
        break
      case "Approved":
        actions.push({ label: "Disburse", status: "Disbursed", variant: "primary" })
        break
    }
    return actions
  }

  type Row = Record<string, unknown>

  const columns = [
    {
      key: "applicationCode",
      header: "Code",
      render: (item: Row) => (
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">
          {item.applicationCode as string}
        </span>
      ),
    },
    {
      key: "member",
      header: "Member",
      render: (item: Row) => {
        const app = item as unknown as Application
        return (
          <div>
            <p className="font-medium">{app.member.farmerName}</p>
            <p className="text-xs text-gray-500">{app.member.memberCode}</p>
          </div>
        )
      },
    },
    {
      key: "loanAmount",
      header: "Amount",
      className: "text-right",
      render: (item: Row) => (
        <span className="font-semibold">{formatUGX(item.loanAmount as number)}</span>
      ),
    },
    {
      key: "interestRate",
      header: "Rate",
      render: (item: Row) => <span>{item.interestRate as number}%</span>,
    },
    {
      key: "loanDuration",
      header: "Duration",
      render: (item: Row) => <span>{item.loanDuration as number} months</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: Row) => {
        const status = (item.status as string) || "Draft"
        let variant: "success" | "info" | "danger" | "warning" | "default" = "default"
        if (["Approved", "Disbursed"].includes(status)) variant = "success"
        else if (["Submitted", "Officer_Appraisal", "Committee_Review", "Board_Review"].includes(status)) variant = "warning"
        else if (status === "Rejected") variant = "danger"
        else if (status === "Draft") variant = "info"
        return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>
      },
    },
    {
      key: "createdAt",
      header: "Created",
      render: (item: Row) => (
        <span className="text-xs text-gray-500">{formatDate(item.createdAt as string)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (item: Row) => {
        const app = item as unknown as Application
        const workflowActions = getWorkflowActions(app)
        return (
          <div className="flex items-center justify-end gap-1">
            {workflowActions.map((action) => (
              <button
                key={action.status}
                onClick={(e) => {
                  e.stopPropagation()
                  advanceApplication(app.id, action.status)
                }}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  action.variant === "primary"
                    ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                    : action.variant === "danger"
                    ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title={action.label}
              >
                {action.label}
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedApp(app)
                setDetailModalOpen(true)
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )
      },
    },
  ]

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="relative">
              <Input
                ref={memberInputRef}
                label="Member *"
                value={wizardData.memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value)
                  updateWizard("memberId", "")
                  updateWizard("memberSearch", "")
                  setMemberDropdownOpen(true)
                  updateDropdownPos()
                }}
                onFocus={() => { setMemberDropdownOpen(true); updateDropdownPos() }}
                placeholder="Search member by name or code..."
              />
              {memberDropdownOpen && memberOptions.length > 0 && (
                <div
                  className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  style={{ top: memberDropdownPos.top, left: memberDropdownPos.left, width: memberDropdownPos.width }}
                >
                  {memberOptions.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMemberSelect(member)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.farmerName}</p>
                      <p className="text-xs text-gray-500">{member.memberCode} • {member.phoneNumber || "No phone"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {wizardData.memberId && (
              <div className="p-3 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
                <p className="text-xs text-gray-500">Selected Member</p>
                <p className="text-sm font-medium">{wizardData.memberSearch}</p>
              </div>
            )}
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Loan Amount (UGX) *"
                type="number"
                value={wizardData.loanAmount}
                onChange={(e) => updateWizard("loanAmount", e.target.value)}
                placeholder="0"
                min="1"
              />
              <Input
                label="Interest Rate (%)"
                type="number"
                value={wizardData.interestRate}
                onChange={(e) => updateWizard("interestRate", e.target.value)}
                step="0.1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Duration (months)"
                type="number"
                value={wizardData.loanDuration}
                onChange={(e) => updateWizard("loanDuration", e.target.value)}
                min="1"
              />
              <Select
                label="Repayment Mode"
                value={wizardData.repaymentMode}
                onChange={(e) => updateWizard("repaymentMode", e.target.value)}
                options={[
                  { value: "Monthly", label: "Monthly" },
                  { value: "Quarterly", label: "Quarterly" },
                  { value: "Weekly", label: "Weekly" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
              <textarea
                value={wizardData.loanPurpose}
                onChange={(e) => updateWizard("loanPurpose", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Describe the purpose of this loan..."
              />
            </div>
            {wizardData.loanAmount && (
              <div className="p-3 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 space-y-1">
                {(() => {
                  const amt = parseFloat(wizardData.loanAmount) || 0
                  const rate = parseFloat(wizardData.interestRate) || 10
                  const dur = parseInt(wizardData.loanDuration) || 12
                  const interest = amt * (rate / 100) * dur
                  const total = amt + interest
                  const monthly = dur > 0 ? total / dur : 0
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Interest</span>
                        <span>{formatUGX(interest)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total Payable</span>
                        <span className="text-[var(--color-primary)]">{formatUGX(total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Monthly Installment</span>
                        <span className="font-semibold">{formatUGX(monthly)}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add guarantors who will back this loan application.
              </p>
              <Button size="sm" variant="outline" onClick={addGuarantor} icon={<Plus className="w-3 h-3" />}>
                Add Guarantor
              </Button>
            </div>
            {wizardData.guarantors.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No guarantors added yet.</p>
            )}
            {wizardData.guarantors.map((g, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Guarantor #{idx + 1}</h4>
                  <button
                    onClick={() => removeGuarantor(idx)}
                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Full Name *"
                    value={g.fullName}
                    onChange={(e) => updateGuarantor(idx, "fullName", e.target.value)}
                    placeholder="Full name"
                  />
                  <Input
                    label="Account Number"
                    value={g.accountNumber}
                    onChange={(e) => updateGuarantor(idx, "accountNumber", e.target.value)}
                    placeholder="Account number"
                  />
                  <Input
                    label="Telephone"
                    value={g.telephone}
                    onChange={(e) => updateGuarantor(idx, "telephone", e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
              </div>
            ))}
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Provide details about the collateral or security pledged for this loan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Permanent Home" value={wizardData.security.permanentHome} onChange={(e) => updateSecurity("permanentHome", e.target.value)} />
              <Input label="Village" value={wizardData.security.village} onChange={(e) => updateSecurity("village", e.target.value)} />
              <Input label="Parish" value={wizardData.security.parish} onChange={(e) => updateSecurity("parish", e.target.value)} />
              <Input label="Sub County" value={wizardData.security.subCounty} onChange={(e) => updateSecurity("subCounty", e.target.value)} />
              <Input label="County" value={wizardData.security.county} onChange={(e) => updateSecurity("county", e.target.value)} />
              <Input label="District" value={wizardData.security.district} onChange={(e) => updateSecurity("district", e.target.value)} />
            </div>
            <Input label="Residential Address" value={wizardData.security.residentialAddress} onChange={(e) => updateSecurity("residentialAddress", e.target.value)} />
            <Input label="Security Location" value={wizardData.security.securityLocation} onChange={(e) => updateSecurity("securityLocation", e.target.value)} />
            <Input label="Security Ownership" value={wizardData.security.securityOwnership} onChange={(e) => updateSecurity("securityOwnership", e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Market Price (UGX)" type="number" value={wizardData.security.marketPrice} onChange={(e) => updateSecurity("marketPrice", e.target.value)} />
              <Input label="Estimated Value (UGX)" type="number" value={wizardData.security.estimatedValue} onChange={(e) => updateSecurity("estimatedValue", e.target.value)} />
              <Input label="Total Security Value (UGX)" type="number" value={wizardData.security.totalSecurityValue} onChange={(e) => updateSecurity("totalSecurityValue", e.target.value)} />
            </div>
            <Input label="Security Description" value={wizardData.security.securityDescription} onChange={(e) => updateSecurity("securityDescription", e.target.value)} />
            <Input label="LC Confirmation" value={wizardData.security.lcConfirmation} onChange={(e) => updateSecurity("lcConfirmation", e.target.value)} />
            <Input label="Security Boundaries" value={wizardData.security.securityBoundaries} onChange={(e) => updateSecurity("securityBoundaries", e.target.value)} />
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Spouse consent details (if applicable).
            </p>
            <Input label="Spouse Name" value={wizardData.spouseConsent.spouseName} onChange={(e) => updateSpouseConsent("spouseName", e.target.value)} />
            <Input label="Approved Amount (UGX)" type="number" value={wizardData.spouseConsent.approvedAmount} onChange={(e) => updateSpouseConsent("approvedAmount", e.target.value)} />
            <Input label="Telephone" value={wizardData.spouseConsent.telephone} onChange={(e) => updateSpouseConsent("telephone", e.target.value)} />
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loan officer appraisal details.
            </p>
            <Input label="Officer Name" value={wizardData.appraisal.officerName} onChange={(e) => updateAppraisal("officerName", e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Appraisal Notes</label>
              <textarea
                value={wizardData.appraisal.appraisalNotes}
                onChange={(e) => updateAppraisal("appraisalNotes", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Officer's appraisal notes..."
              />
            </div>
            <Select
              label="Recommendation"
              value={wizardData.appraisal.recommendation}
              onChange={(e) => updateAppraisal("recommendation", e.target.value)}
              options={[
                { value: "", label: "Select..." },
                { value: "Approve", label: "Approve" },
                { value: "Approve with conditions", label: "Approve with conditions" },
                { value: "Reject", label: "Reject" },
                { value: "Refer to committee", label: "Refer to committee" },
              ]}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comments</label>
              <textarea
                value={wizardData.appraisal.comments}
                onChange={(e) => updateAppraisal("comments", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Additional comments..."
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Credit committee review and decision.
            </p>
            <Select
              label="Decision"
              value={wizardData.committeeDecision.decision}
              onChange={(e) => updateCommittee("decision", e.target.value)}
              options={[
                { value: "", label: "Select..." },
                { value: "Approved", label: "Approved" },
                { value: "Approved with conditions", label: "Approved with conditions" },
                { value: "Rejected", label: "Rejected" },
                { value: "Deferred", label: "Deferred" },
              ]}
            />
            <Input label="Approved Amount (UGX)" type="number" value={wizardData.committeeDecision.approvedAmount} onChange={(e) => updateCommittee("approvedAmount", e.target.value)} />
            <Input label="Chairperson Name" value={wizardData.committeeDecision.chairpersonName} onChange={(e) => updateCommittee("chairpersonName", e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comments</label>
              <textarea
                value={wizardData.committeeDecision.comments}
                onChange={(e) => updateCommittee("comments", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Committee comments..."
              />
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Board of directors review and final disbursement decision.
            </p>
            <Select
              label="Decision"
              value={wizardData.boardDecision.decision}
              onChange={(e) => updateBoard("decision", e.target.value)}
              options={[
                { value: "", label: "Select..." },
                { value: "Approved", label: "Approved" },
                { value: "Approved with conditions", label: "Approved with conditions" },
                { value: "Rejected", label: "Rejected" },
                { value: "Deferred", label: "Deferred" },
              ]}
            />
            <Input label="Approved Amount (UGX)" type="number" value={wizardData.boardDecision.approvedAmount} onChange={(e) => updateBoard("approvedAmount", e.target.value)} />
            <Input label="Chairperson Name" value={wizardData.boardDecision.chairpersonName} onChange={(e) => updateBoard("chairpersonName", e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comments</label>
              <textarea
                value={wizardData.boardDecision.comments}
                onChange={(e) => updateBoard("comments", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors resize-none"
                placeholder="Board comments..."
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Applications"
        subtitle={`${total} total applications`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Download className="w-4 h-4" />} onClick={handleDownloadPDF}>
              Download PDF
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setWizardOpen(true); setCurrentStep(0) }}>
              New Application
            </Button>
          </div>
        }
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by code or member name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="max-w-[180px]"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={applications as unknown as Row[]}
          emptyMessage={loading ? "Loading applications..." : "No applications found"}
          emptyIcon={!loading ? <FileText className="w-12 h-12 mb-3 opacity-50" /> : undefined}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 8-Step Wizard Modal */}
      <Modal
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setWizardData(initialWizardData)
          setCurrentStep(0)
          setSubmitError("")
          setMemberSearch("")
        }}
        title={`New Loan Application — Step ${currentStep + 1} of 8`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Step Progress */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEP_TITLES.map((title, idx) => {
              const Icon = STEP_ICONS[idx]
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    idx === currentStep
                      ? "bg-[var(--color-primary)] text-white"
                      : idx < currentStep
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {idx < currentStep ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{title}</span>
                  <span className="sm:hidden">{idx + 1}</span>
                </div>
              )
            })}
          </div>

          {submitError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          <div className="min-h-[300px]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {STEP_ICONS[currentStep] && (() => { const I = STEP_ICONS[currentStep]; return <I className="w-5 h-5 inline mr-2" /> })()}
              {STEP_TITLES[currentStep]}
            </h3>
            {renderStepContent()}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Back
            </Button>

            <div className="flex items-center gap-3">
              {currentStep < 7 ? (
                <Button
                  disabled={!canProceed()}
                  onClick={() => setCurrentStep((s) => Math.min(7, s + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  loading={submitting}
                  onClick={handleSubmit}
                  icon={<Check className="w-4 h-4" />}
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedApp(null) }}
        title={`Application ${selectedApp?.applicationCode || ""}`}
        size="lg"
      >
        {selectedApp && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Member</p>
                <p className="text-sm font-medium">{selectedApp.member.farmerName}</p>
                <p className="text-xs text-gray-500">{selectedApp.member.memberCode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={getStatusVariant(selectedApp.status)}>{selectedApp.status.replace(/_/g, " ")}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Loan Amount</p>
                <p className="text-sm font-semibold">{formatUGX(selectedApp.loanAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Interest Rate</p>
                <p className="text-sm">{selectedApp.interestRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm">{selectedApp.loanDuration} months</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Monthly Installment</p>
                <p className="text-sm font-semibold">{formatUGX(selectedApp.monthlyInstallment || 0)}</p>
              </div>
              {selectedApp.loanPurpose && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Purpose</p>
                  <p className="text-sm">{selectedApp.loanPurpose}</p>
                </div>
              )}
            </div>

            {selectedApp.guarantors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Guarantors</h4>
                <div className="space-y-1">
                  {selectedApp.guarantors.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm p-2 rounded bg-gray-50 dark:bg-gray-800">
                      <span>{g.fullName}</span>
                      <span className="text-gray-500">{g.telephone || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
