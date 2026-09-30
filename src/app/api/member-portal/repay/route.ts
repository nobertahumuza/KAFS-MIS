import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsLoanRepayment } from "@/lib/sms"
import { computeAllocation, computeRepaymentState } from "@/lib/loan-repayment"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberCode, phoneNumber, loanId, amountPaid: rawAmountPaid } = body
    const amountPaid = Number(rawAmountPaid)

    if (!memberCode?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json({ error: "Member code and phone number are required" }, { status: 400 })
    }

    if (!loanId || !Number.isFinite(amountPaid) || amountPaid <= 0) {
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
      include: {
        member: { select: { farmerName: true, phoneNumber: true } },
        repayments: {
          orderBy: { paymentDate: "desc" },
          take: 1,
          select: { paymentDate: true },
        },
      },
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

    const paymentDate = new Date()

    const state = computeRepaymentState(
      {
        id: loan.id,
        loanCode: loan.loanCode,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        currentBalance: loan.currentBalance,
        outstandingPrincipal: loan.outstandingPrincipal,
        disbursementDate: loan.disbursementDate,
        lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
      },
      paymentDate,
      0
    )

    const result = computeAllocation(
      {
        id: loan.id,
        loanCode: loan.loanCode,
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        currentBalance: loan.currentBalance,
        outstandingPrincipal: loan.outstandingPrincipal,
        disbursementDate: loan.disbursementDate,
        lastPaymentDate: loan.repayments[0]?.paymentDate ?? null,
      },
      state,
      { amountPaid, finePaid: 0, paymentDate }
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const allocation = result.allocation
    const referenceNumber = generateReference("REPAY", Date.now())

    const repayment = await prisma.$transaction(async (tx) => {
      const created = await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          amountPaid,
          finePaid: 0,
          interestPaid: allocation.interestPaid,
          principalPaid: allocation.principalPaid,
          balanceAfter: allocation.newBalance,
          paymentDate,
          referenceNumber,
        },
      })

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          currentBalance: allocation.newBalance,
          outstandingPrincipal: allocation.newOutstandingPrincipal,
          ...(allocation.loanCleared ? { loanStatus: "Cleared" } : {}),
        },
      })

      const pendingSchedule = await tx.loanRepaymentSchedule.findFirst({
        where: { loanId: loan.id, status: { in: ["Pending", "Partial"] } },
        orderBy: { dueDate: "asc" },
      })
      if (pendingSchedule) {
        const paidSoFar = (pendingSchedule.amountPaid ?? 0) + amountPaid
        const expected = pendingSchedule.totalAmount ?? 0
        const fullyPaid = expected > 0 ? paidSoFar >= expected : paidSoFar > 0
        await tx.loanRepaymentSchedule.update({
          where: { id: pendingSchedule.id },
          data: { amountPaid: paidSoFar, status: fullyPaid ? "Paid" : "Partial" },
        })
      }

      await tx.auditTrail.create({
        data: {
          actionType: "LoanRepayment",
          description:
            `Member repayment of UGX ${amountPaid.toLocaleString()} for loan ${loan.loanCode} ` +
            `(interest UGX ${allocation.interestPaid.toLocaleString()}, ` +
            `principal UGX ${allocation.principalPaid.toLocaleString()})`,
          amount: amountPaid,
          memberId: member.id,
          referenceNumber,
          tableName: "loan_repayments",
          recordId: created.id,
        },
      })

      if (allocation.writtenOff > 0) {
        await tx.auditTrail.create({
          data: {
            actionType: "LoanWriteOff",
            description:
              `Booked interest of UGX ${allocation.writtenOff.toLocaleString()} written off on loan ` +
              `${loan.loanCode} because outstanding principal was cleared before all booked interest accrued`,
            amount: allocation.writtenOff,
            memberId: member.id,
            referenceNumber,
            tableName: "loans",
            recordId: loan.id,
          },
        })
      }

      return created
    })

    smsLoanRepayment(member.id, amountPaid, allocation.newBalance, referenceNumber)

    return NextResponse.json({
      message: allocation.loanCleared ? "Loan fully repaid" : "Repayment recorded successfully",
      repayment: {
        id: repayment.id,
        amountPaid: repayment.amountPaid,
        interestPaid: repayment.interestPaid,
        principalPaid: repayment.principalPaid,
        balanceAfter: repayment.balanceAfter,
        referenceNumber: repayment.referenceNumber,
        paymentDate: repayment.paymentDate.toISOString(),
      },
      newBalance: allocation.newBalance,
      outstandingPrincipal: allocation.newOutstandingPrincipal,
      loanCleared: allocation.loanCleared,
    }, { status: 201 })
  } catch (error) {
    console.error("POST /api/member-portal/repay error:", error)
    return NextResponse.json({ error: "Failed to process repayment" }, { status: 500 })
  }
}
