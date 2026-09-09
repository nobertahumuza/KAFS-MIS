import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const appId = parseInt(id)

    if (isNaN(appId)) {
      return NextResponse.json({ error: "Invalid application ID" }, { status: 400 })
    }

    const application = await prisma.loanApplication.findUnique({
      where: { id: appId },
      include: {
        member: {
          select: {
            id: true, farmerName: true, memberCode: true, phoneNumber: true,
            gender: true, parish: true, district: true, occupation: true,
            nextOfKinName: true, nextOfKinPhone: true,
          },
        },
        guarantors: { orderBy: { guarantorOrder: "asc" } },
        securities: true,
        spouseConsent: true,
        appraisal: true,
        committeeDecision: true,
        boardDecision: true,
        disbursements: true,
        documents: true,
        auditLogs: { orderBy: { performedAt: "desc" } },
        agreement: true,
      },
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...application,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      disbursedAt: application.disbursedAt?.toISOString() ?? null,
      disbursementDate: application.disbursementDate?.toISOString() ?? null,
      dueDate: application.dueDate?.toISOString() ?? null,
      createdAt: application.createdAt.toISOString(),
      modifiedAt: application.modifiedAt.toISOString(),
    })
  } catch (error) {
    console.error("GET /api/loan-applications/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const appId = parseInt(id)

    if (isNaN(appId)) {
      return NextResponse.json({ error: "Invalid application ID" }, { status: 400 })
    }

    const existing = await prisma.loanApplication.findUnique({ where: { id: appId } })
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      status,
      guarantors,
      securities,
      spouseConsent,
      appraisal,
      committeeDecision,
      boardDecision,
      loanAmount,
      loanPurpose,
      loanDuration,
      interestRate,
      repaymentMode,
    } = body

    const statusFlow: Record<string, string[]> = {
      Draft: ["Submitted"],
      Submitted: ["Officer_Appraisal", "Rejected"],
      Officer_Appraisal: ["Committee_Review", "Rejected"],
      Committee_Review: ["Board_Review", "Rejected"],
      Board_Review: ["Approved", "Rejected"],
      Approved: ["Disbursed"],
    }

    if (status && status !== existing.status) {
      const allowed = statusFlow[existing.status]
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from "${existing.status}" to "${status}"` },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = { modifiedAt: new Date() }

    if (status !== undefined) {
      updateData.status = status
      if (status === "Submitted" && !existing.submittedAt) {
        updateData.submittedAt = new Date()
      }
      if (status === "Disbursed") {
        updateData.disbursedAt = new Date()
        updateData.disbursementDate = new Date()
      }
    }

    if (loanAmount !== undefined) updateData.loanAmount = parseFloat(loanAmount)
    if (loanPurpose !== undefined) updateData.loanPurpose = loanPurpose
    if (loanDuration !== undefined) {
      updateData.loanDuration = parseInt(loanDuration)
      updateData.loanPeriodMonths = parseInt(loanDuration)
    }
    if (interestRate !== undefined) updateData.interestRate = parseFloat(interestRate)
    if (repaymentMode !== undefined) updateData.repaymentMode = repaymentMode

    const application = await prisma.loanApplication.update({
      where: { id: appId },
      data: updateData,
      include: {
        member: { select: { farmerName: true, memberCode: true } },
      },
    })

    if (status) {
      await prisma.loanAuditLog.create({
        data: {
          applicationId: appId,
          action: `Status changed to ${status}`,
          details: `Application status updated from "${existing.status}" to "${status}"`,
        },
      })
    }

    if (Array.isArray(guarantors)) {
      await prisma.loanGuarantor.deleteMany({ where: { applicationId: appId } })
      if (guarantors.length > 0) {
        await prisma.loanGuarantor.createMany({
          data: guarantors.map((g: Record<string, unknown>, idx: number) => ({
            applicationId: appId,
            guarantorOrder: idx + 1,
            fullName: g.fullName as string,
            accountNumber: (g.accountNumber as string) || null,
            telephone: (g.telephone as string) || null,
            memberId: (g.memberId as number) || null,
          })),
        })
      }
    }

    if (securities && typeof securities === "object") {
      const s = securities as Record<string, unknown>
      const existingSecurity = await prisma.loanSecurity.findFirst({
        where: { applicationId: appId },
      })

      if (existingSecurity) {
        await prisma.loanSecurity.update({
          where: { id: existingSecurity.id },
          data: {
            permanentHome: (s.permanentHome as string) ?? existingSecurity.permanentHome,
            village: (s.village as string) ?? existingSecurity.village,
            parish: (s.parish as string) ?? existingSecurity.parish,
            subCounty: (s.subCounty as string) ?? existingSecurity.subCounty,
            county: (s.county as string) ?? existingSecurity.county,
            district: (s.district as string) ?? existingSecurity.district,
            residentialAddress: (s.residentialAddress as string) ?? existingSecurity.residentialAddress,
            securityLocation: (s.securityLocation as string) ?? existingSecurity.securityLocation,
            securityOwnership: (s.securityOwnership as string) ?? existingSecurity.securityOwnership,
            marketPrice: (s.marketPrice as number) ?? existingSecurity.marketPrice,
            securityDescription: (s.securityDescription as string) ?? existingSecurity.securityDescription,
            estimatedValue: (s.estimatedValue as number) ?? existingSecurity.estimatedValue,
            totalSecurityValue: (s.totalSecurityValue as number) ?? existingSecurity.totalSecurityValue,
            lcConfirmation: (s.lcConfirmation as string) ?? existingSecurity.lcConfirmation,
            securityBoundaries: (s.securityBoundaries as string) ?? existingSecurity.securityBoundaries,
          },
        })
      } else {
        await prisma.loanSecurity.create({
          data: {
            applicationId: appId,
            permanentHome: (s.permanentHome as string) || null,
            village: (s.village as string) || null,
            parish: (s.parish as string) || null,
            subCounty: (s.subCounty as string) || null,
            county: (s.county as string) || null,
            district: (s.district as string) || null,
            residentialAddress: (s.residentialAddress as string) || null,
            securityLocation: (s.securityLocation as string) || null,
            securityOwnership: (s.securityOwnership as string) || null,
            marketPrice: (s.marketPrice as number) || 0,
            securityDescription: (s.securityDescription as string) || null,
            estimatedValue: (s.estimatedValue as number) || 0,
            totalSecurityValue: (s.totalSecurityValue as number) || 0,
            lcConfirmation: (s.lcConfirmation as string) || null,
            securityBoundaries: (s.securityBoundaries as string) || null,
          },
        })
      }
    }

    if (spouseConsent && typeof spouseConsent === "object") {
      const sc = spouseConsent as Record<string, unknown>
      const existingConsent = await prisma.loanSpouseConsent.findFirst({
        where: { applicationId: appId },
      })

      if (existingConsent) {
        await prisma.loanSpouseConsent.update({
          where: { id: existingConsent.id },
          data: {
            spouseName: (sc.spouseName as string) ?? existingConsent.spouseName,
            approvedAmount: (sc.approvedAmount as number) ?? existingConsent.approvedAmount,
            telephone: (sc.telephone as string) ?? existingConsent.telephone,
          },
        })
      } else if (sc.spouseName) {
        await prisma.loanSpouseConsent.create({
          data: {
            applicationId: appId,
            spouseName: sc.spouseName as string,
            approvedAmount: (sc.approvedAmount as number) || 0,
            telephone: (sc.telephone as string) || null,
          },
        })
      }
    }

    if (appraisal && typeof appraisal === "object") {
      const a = appraisal as Record<string, unknown>
      const existingAppraisal = await prisma.loanAppraisal.findFirst({
        where: { applicationId: appId },
      })

      if (existingAppraisal) {
        await prisma.loanAppraisal.update({
          where: { id: existingAppraisal.id },
          data: {
            appraisalNotes: (a.appraisalNotes as string) ?? existingAppraisal.appraisalNotes,
            recommendation: (a.recommendation as string) ?? existingAppraisal.recommendation,
            comments: (a.comments as string) ?? existingAppraisal.comments,
            officerName: (a.officerName as string) ?? existingAppraisal.officerName,
            appraisalDate: new Date(),
          },
        })
      } else {
        await prisma.loanAppraisal.create({
          data: {
            applicationId: appId,
            appraisalNotes: (a.appraisalNotes as string) || null,
            recommendation: (a.recommendation as string) || null,
            comments: (a.comments as string) || null,
            officerName: (a.officerName as string) || null,
            appraisalDate: new Date(),
          },
        })
      }
    }

    if (committeeDecision && typeof committeeDecision === "object") {
      const cd = committeeDecision as Record<string, unknown>
      const existingDecision = await prisma.loanCommitteeDecision.findFirst({
        where: { applicationId: appId },
      })

      if (existingDecision) {
        await prisma.loanCommitteeDecision.update({
          where: { id: existingDecision.id },
          data: {
            decision: (cd.decision as string) ?? existingDecision.decision,
            approvedAmount: (cd.approvedAmount as number) ?? existingDecision.approvedAmount,
            chairpersonName: (cd.chairpersonName as string) ?? existingDecision.chairpersonName,
            comments: (cd.comments as string) ?? existingDecision.comments,
            decisionDate: new Date(),
          },
        })
      } else {
        await prisma.loanCommitteeDecision.create({
          data: {
            applicationId: appId,
            decision: (cd.decision as string) || null,
            approvedAmount: (cd.approvedAmount as number) || 0,
            chairpersonName: (cd.chairpersonName as string) || null,
            comments: (cd.comments as string) || null,
            decisionDate: new Date(),
          },
        })
      }
    }

    if (boardDecision && typeof boardDecision === "object") {
      const bd = boardDecision as Record<string, unknown>
      const existingDecision = await prisma.loanBoardDecision.findFirst({
        where: { applicationId: appId },
      })

      if (existingDecision) {
        await prisma.loanBoardDecision.update({
          where: { id: existingDecision.id },
          data: {
            decision: (bd.decision as string) ?? existingDecision.decision,
            approvedAmount: (bd.approvedAmount as number) ?? existingDecision.approvedAmount,
            chairpersonName: (bd.chairpersonName as string) ?? existingDecision.chairpersonName,
            comments: (bd.comments as string) ?? existingDecision.comments,
            decisionDate: new Date(),
          },
        })
      } else {
        await prisma.loanBoardDecision.create({
          data: {
            applicationId: appId,
            decision: (bd.decision as string) || null,
            approvedAmount: (bd.approvedAmount as number) || 0,
            chairpersonName: (bd.chairpersonName as string) || null,
            comments: (bd.comments as string) || null,
            decisionDate: new Date(),
          },
        })
      }
    }

    return NextResponse.json({ message: "Application updated successfully", application })
  } catch (error) {
    console.error("PUT /api/loan-applications/[id] error:", error)
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}
