import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const account = await prisma.customer.findFirst({ where: { memberId } })
    const lastSavings = await prisma.savingsLedger.findFirst({
      where: { memberId },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })
    const totalDeposits = await prisma.savingsLedger.aggregate({
      _sum: { amount: true },
      where: { memberId, transactionType: "Deposit" },
    })
    const totalWithdrawals = await prisma.savingsLedger.aggregate({
      _sum: { amount: true },
      where: { memberId, transactionType: "Withdrawal" },
    })
    const activeLoans = await prisma.loan.count({
      where: { memberId, loanStatus: "Active" },
    })
    const totalShares = member.totalShares || 0

    return NextResponse.json({
      ...member,
      account: account ? {
        accountNo: account.accountNo,
        status: account.status,
      } : null,
      savingsBalance: lastSavings?.balanceAfter || 0,
      totalDeposits: totalDeposits._sum.amount || 0,
      totalWithdrawals: totalWithdrawals._sum.amount || 0,
      activeLoans,
      totalShares,
    })
  } catch (error) {
    console.error("GET /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch member" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = parseInt(id)
    const body = await request.json()

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      "farmerName", "phoneNumber", "email", "gender", "ninNumber",
      "address", "village", "parish", "subCounty", "district",
      "occupation", "idDocumentType", "idDocumentNumber",
      "nextOfKinName", "nextOfKinPhone", "status",
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: updateData,
    })

    return NextResponse.json({ message: "Member updated successfully", member: updated })
  } catch (error) {
    console.error("PATCH /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin-only: deleting a member is irreversible.
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { error: "Only an administrator can delete a member" },
        { status: 403 }
      )
    }

    const { id } = await params
    const memberId = parseInt(id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Never erase money records. Block deletion when the member has ANY
    // financial footprint; each relation below cascades from Member, so a
    // delete here would take the records with it.
    const footprint = await Promise.all([
      prisma.loan.count({ where: { memberId } }),
      prisma.loanApplication.count({ where: { memberId } }),
      prisma.savingsLedger.count({ where: { memberId } }),
      prisma.sharesLedger.count({ where: { memberId } }),
      prisma.fixedAccount.count({ where: { memberId } }),
      prisma.loanGuarantor.count({ where: { memberId } }),
      prisma.savingsInterest.count({ where: { memberId } }),
      prisma.loanAdvance.count({ where: { memberId } }),
      prisma.membershipFee.count({ where: { memberId } }),
      prisma.charityDeduction.count({ where: { memberId } }),
      prisma.serviceFeeDeduction.count({ where: { memberId } }),
      prisma.memberExpense.count({ where: { memberId } }),
      prisma.expense.count({ where: { memberId } }),
      prisma.jointAccountMember.count({ where: { memberId } }),
    ])
    const labels = [
      "loans",
      "loan applications",
      "savings transactions",
      "share records",
      "fixed accounts",
      "loan guarantees",
      "savings interest",
      "loan advances",
      "membership fees",
      "charity deductions",
      "service fee deductions",
      "member expenses",
      "expenses",
      "joint account memberships",
    ]
    const found = labels.filter((_, i) => footprint[i] > 0)
    if (found.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete ${member.farmerName}: member has financial records (${found.join(
            ", "
          )}). Money records are never deleted.`,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      async (tx) => {
        // audit_trail / sms_logs keep a NO ACTION foreign key to members:
        // detach (never delete) their rows so the member row can go while the
        // history stays intact.
        await tx.auditTrail.updateMany({
          where: { memberId },
          data: { memberId: null },
        })
        await tx.smsLog.updateMany({
          where: { memberId },
          data: { memberId: null },
        })
        await tx.customer.deleteMany({ where: { memberId } })
        await tx.member.delete({ where: { id: memberId } })

        await tx.auditTrail.create({
          data: {
            actionType: "MemberDelete",
            description: `Duplicate member ${member.memberCode} (${member.farmerName}) deleted by ${session.user.name || "administrator"}`,
            recordId: memberId,
            tableName: "members",
          },
        })
      },
      { timeout: 60_000, maxWait: 10_000 }
    )

    return NextResponse.json({ message: "Member deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/members/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 })
  }
}
