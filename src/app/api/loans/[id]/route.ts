import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          select: {
            id: true, farmerName: true, memberCode: true, phoneNumber: true,
            gender: true, parish: true, district: true, occupation: true,
          },
        },
        repaymentSchedules: {
          orderBy: { installmentNo: "asc" },
        },
        repayments: {
          orderBy: { paymentDate: "desc" },
        },
        fines: true,
        disbursements: true,
      },
    })

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...loan,
      disbursementDate: loan.disbursementDate.toISOString(),
      dueDate: loan.dueDate?.toISOString() ?? null,
      createdAt: loan.createdAt.toISOString(),
      repaymentSchedules: loan.repaymentSchedules.map((s) => ({
        ...s,
        dueDate: s.dueDate.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      repayments: loan.repayments.map((r) => ({
        ...r,
        paymentDate: r.paymentDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      fines: loan.fines.map((f) => ({
        ...f,
        paidDate: f.paidDate?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch loan" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const existing = await prisma.loan.findUnique({ where: { id: loanId } })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    const body = await request.json()
    const { loanStatus, interestRate, loanPurpose, dueDate } = body

    const updateData: Record<string, unknown> = {}
    if (loanStatus !== undefined) updateData.loanStatus = loanStatus
    if (interestRate !== undefined) updateData.interestRate = parseFloat(interestRate)
    if (loanPurpose !== undefined) updateData.loanPurpose = loanPurpose
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)

    const loan = await prisma.loan.update({
      where: { id: loanId },
      data: updateData,
      include: {
        member: { select: { farmerName: true, memberCode: true } },
      },
    })

    return NextResponse.json({ message: "Loan updated successfully", loan })
  } catch (error) {
    console.error("PUT /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to update loan" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const loanId = parseInt(id)

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
    }

    const existing = await prisma.loan.findUnique({ where: { id: loanId } })
    if (!existing) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    if (existing.currentBalance < existing.principalAmount) {
      return NextResponse.json(
        { error: "Cannot delete a loan with outstanding repayments" },
        { status: 400 }
      )
    }

    await prisma.loanRepaymentSchedule.deleteMany({ where: { loanId } })
    await prisma.loanRepayment.deleteMany({ where: { loanId } })
    await prisma.loanFine.deleteMany({ where: { loanId } })
    await prisma.loan.delete({ where: { id: loanId } })

    return NextResponse.json({ message: "Loan deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/loans/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete loan" }, { status: 500 })
  }
}
