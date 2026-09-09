import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateApplicationCode } from "@/lib/utils"
import { notifyLoanApplication } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { applicationCode: { contains: search } },
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [applications, total] = await Promise.all([
      prisma.loanApplication.findMany({
        where,
        include: {
          member: {
            select: { id: true, farmerName: true, memberCode: true, phoneNumber: true },
          },
          guarantors: true,
          securities: true,
          appraisal: true,
          committeeDecision: true,
          boardDecision: true,
          spouseConsent: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loanApplication.count({ where }),
    ])

    return NextResponse.json({
      data: applications.map((app) => ({
        ...app,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        disbursedAt: app.disbursedAt?.toISOString() ?? null,
        disbursementDate: app.disbursementDate?.toISOString() ?? null,
        dueDate: app.dueDate?.toISOString() ?? null,
        createdAt: app.createdAt.toISOString(),
        modifiedAt: app.modifiedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/loan-applications error:", error)
    return NextResponse.json({ error: "Failed to fetch loan applications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      memberId,
      loanAmount,
      loanPurpose,
      loanDuration,
      interestRate,
      repaymentMode,
      guarantors,
      securities,
      spouseConsent,
      appraisal,
      committeeDecision,
      boardDecision,
      status,
    } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    if (!loanAmount || loanAmount <= 0) {
      return NextResponse.json({ error: "Valid loan amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const lastApp = await prisma.loanApplication.findFirst({
      orderBy: { id: "desc" },
      select: { applicationCode: true },
    })
    let nextIndex = 1
    if (lastApp?.applicationCode) {
      const match = lastApp.applicationCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }

    const duration = parseInt(loanDuration) || 12
    const rate = parseFloat(interestRate) || 10
    const totalInterest = loanAmount * (rate / 100) * duration
    const monthlyInstallment = (loanAmount + totalInterest) / duration

    const application = await prisma.loanApplication.create({
      data: {
        applicationCode: generateApplicationCode(nextIndex),
        memberId,
        loanAmount,
        loanPurpose: loanPurpose || null,
        loanDuration: duration,
        loanPeriodMonths: duration,
        interestRate: rate,
        monthlyInstallment,
        repaymentMode: repaymentMode || "Monthly",
        status: status || "Submitted",
        submittedAt: new Date(),
      },
    })

    if (Array.isArray(guarantors) && guarantors.length > 0) {
      await prisma.loanGuarantor.createMany({
        data: guarantors.map((g: Record<string, unknown>, idx: number) => ({
          applicationId: application.id,
          guarantorOrder: idx + 1,
          fullName: g.fullName as string,
          accountNumber: (g.accountNumber as string) || null,
          telephone: (g.telephone as string) || null,
          memberId: (g.memberId as number) || null,
        })),
      })
    }

    if (securities && typeof securities === "object") {
      const s = securities as Record<string, unknown>
      await prisma.loanSecurity.create({
        data: {
          applicationId: application.id,
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

    if (spouseConsent && typeof spouseConsent === "object") {
      const sc = spouseConsent as Record<string, unknown>
      if (sc.spouseName) {
        await prisma.loanSpouseConsent.create({
          data: {
            applicationId: application.id,
            spouseName: sc.spouseName as string,
            approvedAmount: (sc.approvedAmount as number) || 0,
            telephone: (sc.telephone as string) || null,
          },
        })
      }
    }

    if (appraisal && typeof appraisal === "object") {
      const a = appraisal as Record<string, unknown>
      if (a.appraisalNotes || a.recommendation) {
        await prisma.loanAppraisal.create({
          data: {
            applicationId: application.id,
            appraisalNotes: (a.appraisalNotes as string) || null,
            recommendation: (a.recommendation as string) || null,
            comments: (a.comments as string) || null,
            officerName: (a.officerName as string) || null,
          },
        })
      }
    }

    if (committeeDecision && typeof committeeDecision === "object") {
      const cd = committeeDecision as Record<string, unknown>
      if (cd.decision) {
        await prisma.loanCommitteeDecision.create({
          data: {
            applicationId: application.id,
            decision: cd.decision as string,
            approvedAmount: (cd.approvedAmount as number) || 0,
            chairpersonName: (cd.chairpersonName as string) || null,
            comments: (cd.comments as string) || null,
          },
        })
      }
    }

    if (boardDecision && typeof boardDecision === "object") {
      const bd = boardDecision as Record<string, unknown>
      if (bd.decision) {
        await prisma.loanBoardDecision.create({
          data: {
            applicationId: application.id,
            decision: bd.decision as string,
            approvedAmount: (bd.approvedAmount as number) || 0,
            chairpersonName: (bd.chairpersonName as string) || null,
            comments: (bd.comments as string) || null,
          },
        })
      }
    }

    await prisma.loanAuditLog.create({
      data: {
        applicationId: application.id,
        action: "Application Created",
        details: `Loan application ${application.applicationCode} created for UGX ${loanAmount.toLocaleString()}`,
      },
    })

    const memberData = await prisma.member.findUnique({ where: { id: memberId }, select: { farmerName: true } })
    if (memberData) {
      notifyLoanApplication(memberId, memberData.farmerName, application.applicationCode, loanAmount)
    }

    return NextResponse.json(
      { message: "Loan application created successfully", application },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/loan-applications error:", error)
    return NextResponse.json({ error: "Failed to create loan application" }, { status: 500 })
  }
}
