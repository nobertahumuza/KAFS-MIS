import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateLoanCode, generateApplicationCode } from "@/lib/utils"
import { smsLoanDisbursement } from "@/lib/sms"
import { notifyLoanDisbursed } from "@/lib/notify"

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
        { loanCode: { contains: search } },
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
      ]
    }

    if (status) {
      where.loanStatus = status
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          member: {
            select: { id: true, farmerName: true, memberCode: true, phoneNumber: true },
          },
          repayments: {
            orderBy: { paymentDate: "desc" },
            take: 1,
          },
          repaymentSchedules: {
            where: { status: "Pending" },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
          fines: {
            where: { status: "Pending" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loan.count({ where }),
    ])

    const summary = await prisma.loan.aggregate({
      _sum: { principalAmount: true, currentBalance: true },
      _count: { id: true },
    })

    const overdueCount = await prisma.loan.count({
      where: { loanStatus: "Active", dueDate: { lt: new Date() } },
    })

    const pendingFines = await prisma.loanFine.aggregate({
      where: { status: "Pending" },
      _sum: { fineAmount: true },
    })

    return NextResponse.json({
      data: loans.map((loan) => ({
        ...loan,
        disbursementDate: loan.disbursementDate.toISOString(),
        dueDate: loan.dueDate?.toISOString() ?? null,
        createdAt: loan.createdAt.toISOString(),
        nextDue: loan.repaymentSchedules[0]
          ? {
              dueDate: loan.repaymentSchedules[0].dueDate.toISOString(),
              totalAmount: loan.repaymentSchedules[0].totalAmount,
              installmentNo: loan.repaymentSchedules[0].installmentNo,
            }
          : null,
        pendingFinesCount: loan.fines.length,
        lastPayment: loan.repayments[0]
          ? {
              amountPaid: loan.repayments[0].amountPaid,
              paymentDate: loan.repayments[0].paymentDate.toISOString(),
            }
          : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: {
        totalDisbursed: summary._sum.principalAmount ?? 0,
        outstandingBalance: summary._sum.currentBalance ?? 0,
        totalLoans: summary._count.id,
        overdueCount,
        pendingFinesTotal: pendingFines._sum.fineAmount ?? 0,
      },
    })
  } catch (error) {
    console.error("GET /api/loans error:", error)
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, principalAmount, interestRate, duration, purpose } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    if (!principalAmount || principalAmount <= 0) {
      return NextResponse.json({ error: "Valid principal amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const rate = parseFloat(interestRate) || 2.5
    const loanDuration = parseInt(duration) || 12
    const totalInterest = principalAmount * (rate / 100) * loanDuration
    const totalPayable = principalAmount + totalInterest

    const lastLoan = await prisma.loan.findFirst({
      orderBy: { id: "desc" },
      select: { loanCode: true },
    })
    let nextIndex = 1
    if (lastLoan?.loanCode) {
      const match = lastLoan.loanCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }

    const loanCode = generateLoanCode(nextIndex)
    const monthlyInstallment = totalPayable / loanDuration

    const now = new Date()
    const dueDate = new Date(now)
    dueDate.setMonth(dueDate.getMonth() + loanDuration)

    const lastApp = await prisma.loanApplication.findFirst({
      orderBy: { id: "desc" },
      select: { applicationCode: true },
    })
    let appIndex = 1
    if (lastApp?.applicationCode) {
      const match = lastApp.applicationCode.match(/(\d+)$/)
      if (match) appIndex = parseInt(match[1]) + 1
    }

    const application = await prisma.loanApplication.create({
      data: {
        applicationCode: generateApplicationCode(appIndex),
        memberId,
        loanAmount: principalAmount,
        loanPurpose: purpose || null,
        loanDuration,
        loanPeriodMonths: loanDuration,
        interestRate: rate,
        monthlyInstallment,
        status: "Disbursed",
        submittedAt: now,
        disbursedAt: now,
        disbursementDate: now,
        dueDate,
      },
    })

    const loan = await prisma.loan.create({
      data: {
        loanCode,
        memberId,
        principalAmount,
        interestRate: rate,
        currentBalance: totalPayable,
        loanPurpose: purpose || null,
        loanStatus: "Active",
        disbursementDate: now,
        dueDate,
      },
      include: {
        member: { select: { farmerName: true, memberCode: true } },
      },
    })

    await prisma.loanDisbursement.create({
      data: {
        applicationId: application.id,
        loanId: loan.id,
        amountDisbursed: principalAmount,
        disbursementDate: now,
        disbursementMethod: "Cash",
      },
    })

    const schedulePromises = []
    for (let i = 1; i <= loanDuration; i++) {
      const scheduleDate = new Date(now)
      scheduleDate.setMonth(scheduleDate.getMonth() + i)

      schedulePromises.push(
        prisma.loanRepaymentSchedule.create({
          data: {
            applicationId: application.id,
            loanId: loan.id,
            installmentNo: i,
            dueDate: scheduleDate,
            principalAmount: principalAmount / loanDuration,
            interestAmount: totalInterest / loanDuration,
            totalAmount: monthlyInstallment,
            balance: totalPayable - monthlyInstallment * i,
            status: "Pending",
          },
        })
      )
    }
    await Promise.all(schedulePromises)

    await prisma.auditTrail.create({
      data: {
        actionType: "LoanDisbursement",
        description: `Loan ${loanCode} disbursed to ${member.farmerName} - UGX ${principalAmount.toLocaleString()}`,
        amount: principalAmount,
        memberId,
      },
    })

    const dueDateStr = dueDate.toISOString().split("T")[0]
    smsLoanDisbursement(memberId, loanCode, principalAmount, Math.round(monthlyInstallment), dueDateStr)
    notifyLoanDisbursed(memberId, member.farmerName, loanCode, principalAmount)

    return NextResponse.json(
      { message: "Loan disbursed successfully", loan },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/loans error:", error)
    return NextResponse.json({ error: "Failed to disburse loan" }, { status: 500 })
  }
}
