import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsLoanRepayment } from "@/lib/sms"
import { notifyLoanRepaid } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const loanId = searchParams.get("loanId") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (loanId) {
      where.loanId = parseInt(loanId)
    }

    const [repayments, total] = await Promise.all([
      prisma.loanRepayment.findMany({
        where,
        include: {
          loan: {
            select: {
              loanCode: true,
              memberId: true,
              member: { select: { farmerName: true, memberCode: true } },
            },
          },
        },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loanRepayment.count({ where }),
    ])

    return NextResponse.json({
      data: repayments.map((r) => ({
        id: r.id,
        loanId: r.loanId,
        loanCode: r.loan.loanCode,
        memberName: r.loan.member.farmerName,
        memberCode: r.loan.member.memberCode,
        amountPaid: r.amountPaid,
        finePaid: r.finePaid ?? 0,
        balanceAfter: r.balanceAfter,
        paymentDate: r.paymentDate.toISOString(),
        referenceNumber: r.referenceNumber,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/loans/repayments error:", error)
    return NextResponse.json({ error: "Failed to fetch repayments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { loanId, amountPaid, finePaid, scheduleId } = body

    if (!loanId) {
      return NextResponse.json({ error: "Loan ID is required" }, { status: 400 })
    }

    if (!amountPaid || amountPaid <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { select: { farmerName: true, phoneNumber: true } },
      },
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (loan.loanStatus !== "Active") {
      return NextResponse.json(
        { error: "Cannot record repayment for a non-active loan" },
        { status: 400 }
      )
    }

    const totalFinePaid = parseFloat(finePaid) || 0
    const newBalance = loan.currentBalance - amountPaid - totalFinePaid

    if (newBalance < 0) {
      return NextResponse.json(
        { error: `Payment exceeds outstanding balance of UGX ${loan.currentBalance.toLocaleString()}` },
        { status: 400 }
      )
    }

    const referenceNumber = generateReference("REPAY", Date.now())

    const repayment = await prisma.loanRepayment.create({
      data: {
        loanId,
        amountPaid,
        finePaid: totalFinePaid,
        balanceAfter: newBalance,
        paymentDate: new Date(),
        referenceNumber,
      },
    })

    const updateData: Record<string, unknown> = { currentBalance: newBalance }
    if (newBalance <= 0) {
      updateData.loanStatus = "Cleared"
    }
    await prisma.loan.update({ where: { id: loanId }, data: updateData })

    if (scheduleId) {
      await prisma.loanRepaymentSchedule.update({
        where: { id: scheduleId },
        data: { amountPaid: { increment: amountPaid }, status: "Paid" },
      })
    } else {
      const pendingSchedule = await prisma.loanRepaymentSchedule.findFirst({
        where: { loanId, status: "Pending" },
        orderBy: { dueDate: "asc" },
      })
      if (pendingSchedule) {
        await prisma.loanRepaymentSchedule.update({
          where: { id: pendingSchedule.id },
          data: { amountPaid: { increment: amountPaid }, status: "Paid" },
        })
      }
    }

    if (totalFinePaid > 0 && scheduleId) {
      const fine = await prisma.loanFine.findFirst({
        where: { loanId, scheduleId, status: "Pending" },
      })
      if (fine) {
        await prisma.loanFine.update({
          where: { id: fine.id },
          data: {
            paidAmount: totalFinePaid,
            paidDate: new Date(),
            status: "Paid",
          },
        })
      }
    }

    await prisma.auditTrail.create({
      data: {
        actionType: "LoanRepayment",
        description: `Repayment of UGX ${amountPaid.toLocaleString()} for loan ${loan.loanCode}`,
        amount: amountPaid,
        memberId: loan.memberId,
        referenceNumber,
      },
    })

    smsLoanRepayment(loan.memberId, amountPaid, newBalance, referenceNumber)
    notifyLoanRepaid(loan.memberId, loan.member.farmerName, amountPaid, referenceNumber)

    return NextResponse.json(
      {
        message: newBalance <= 0 ? "Loan fully repaid" : "Repayment recorded successfully",
        repayment,
        newBalance,
        loanCleared: newBalance <= 0,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/loans/repayments error:", error)
    return NextResponse.json({ error: "Failed to record repayment" }, { status: 500 })
  }
}
