import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsLoanRepayment } from "@/lib/sms"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberCode, phoneNumber, loanId, amountPaid } = body

    if (!memberCode?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json({ error: "Member code and phone number are required" }, { status: 400 })
    }

    if (!loanId || !amountPaid || amountPaid <= 0) {
      return NextResponse.json({ error: "Valid loan and amount are required" }, { status: 400 })
    }

    const member = await prisma.member.findFirst({
      where: {
        memberCode: memberCode.trim(),
        phoneNumber: { contains: phoneNumber.trim().replace(/\s/g, "") },
      },
    })

    if (!member) {
      return NextResponse.json({ error: "Invalid member code or phone number" }, { status: 401 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { member: { select: { farmerName: true, phoneNumber: true } } },
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (loan.memberId !== member.id) {
      return NextResponse.json({ error: "This loan does not belong to you" }, { status: 403 })
    }

    if (loan.loanStatus !== "Active") {
      return NextResponse.json({ error: "Cannot repay a non-active loan" }, { status: 400 })
    }

    if (amountPaid > loan.currentBalance) {
      return NextResponse.json({ error: `Payment exceeds outstanding balance of UGX ${loan.currentBalance.toLocaleString()}` }, { status: 400 })
    }

    const newBalance = loan.currentBalance - amountPaid
    const referenceNumber = generateReference("REPAY", Date.now())

    const repayment = await prisma.loanRepayment.create({
      data: {
        loanId: loan.id,
        amountPaid,
        finePaid: 0,
        balanceAfter: newBalance,
        paymentDate: new Date(),
        referenceNumber,
      },
    })

    const updateData: Record<string, unknown> = { currentBalance: newBalance }
    if (newBalance <= 0) {
      updateData.loanStatus = "Cleared"
    }
    await prisma.loan.update({ where: { id: loan.id }, data: updateData })

    const pendingSchedule = await prisma.loanRepaymentSchedule.findFirst({
      where: { loanId: loan.id, status: "Pending" },
      orderBy: { dueDate: "asc" },
    })
    if (pendingSchedule) {
      await prisma.loanRepaymentSchedule.update({
        where: { id: pendingSchedule.id },
        data: { amountPaid: { increment: amountPaid }, status: "Paid" },
      })
    }

    await prisma.auditTrail.create({
      data: {
        actionType: "LoanRepayment",
        description: `Member repayment of UGX ${amountPaid.toLocaleString()} for loan ${loan.loanCode}`,
        amount: amountPaid,
        memberId: member.id,
        referenceNumber,
      },
    })

    smsLoanRepayment(member.id, amountPaid, newBalance, referenceNumber)

    return NextResponse.json({
      message: newBalance <= 0 ? "Loan fully repaid" : "Repayment recorded successfully",
      repayment: {
        id: repayment.id,
        amountPaid: repayment.amountPaid,
        balanceAfter: repayment.balanceAfter,
        referenceNumber: repayment.referenceNumber,
        paymentDate: repayment.paymentDate.toISOString(),
      },
      newBalance,
      loanCleared: newBalance <= 0,
    }, { status: 201 })
  } catch (error) {
    console.error("POST /api/member-portal/repay error:", error)
    return NextResponse.json({ error: "Failed to process repayment" }, { status: 500 })
  }
}
