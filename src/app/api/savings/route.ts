import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateReference } from "@/lib/utils"
import { smsSavingsDeposit, smsSavingsWithdrawal } from "@/lib/sms"
import { notifySavingsDeposit, notifySavingsWithdrawal } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const type = searchParams.get("type") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { member: { farmerName: { contains: search } } },
        { member: { memberCode: { contains: search } } },
        { referenceNumber: { contains: search } },
      ]
    }

    if (type) {
      where.transactionType = type
    }

    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) {
        ;(where.transactionDate as Record<string, unknown>).gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        ;(where.transactionDate as Record<string, unknown>).lte = endDate
      }
    }

    const transactions = await prisma.savingsLedger.findMany({
      where,
      include: {
        member: {
          select: {
            farmerName: true,
            memberCode: true,
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    })

    const formatted = transactions.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.farmerName,
      memberCode: t.member.memberCode,
      transactionType: t.transactionType,
      amount: t.amount,
      withdrawalFee: t.withdrawalFee ?? 0,
      balanceAfter: t.balanceAfter,
      narration: t.narration,
      referenceNumber: t.referenceNumber,
      transactionDate: t.transactionDate.toISOString(),
    }))

    const summary = await prisma.savingsLedger.groupBy({
      by: ["transactionType"],
      _sum: { amount: true },
    })

    let totalDeposits = 0
    let totalWithdrawals = 0
    for (const s of summary) {
      if (s.transactionType === "Deposit") totalDeposits = s._sum.amount ?? 0
      if (s.transactionType === "Withdrawal") totalWithdrawals = s._sum.amount ?? 0
    }

    return NextResponse.json({
      transactions: formatted,
      summary: {
        totalDeposits,
        totalWithdrawals,
        netSavings: totalDeposits - totalWithdrawals,
      },
    })
  } catch (error) {
    console.error("GET /api/savings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch savings transactions" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, transactionType, amount, narration, sendSms } = body

    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 })
    }

    if (!transactionType || !["Deposit", "Withdrawal"].includes(transactionType)) {
      return NextResponse.json({ error: "Valid transaction type is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const lastTransaction = await prisma.savingsLedger.findFirst({
      where: { memberId },
      orderBy: { id: "desc" },
      select: { balanceAfter: true },
    })
    const currentBalance = lastTransaction?.balanceAfter ?? 0

    const WITHDRAWAL_FEE = 500
    let withdrawalFee = 0
    let newBalance = currentBalance

    if (transactionType === "Deposit") {
      newBalance = currentBalance + amount
    } else {
      withdrawalFee = WITHDRAWAL_FEE
      const totalDeduction = amount + withdrawalFee
      if (totalDeduction > currentBalance) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: UGX ${currentBalance.toLocaleString()}, Required: UGX ${totalDeduction.toLocaleString()} (includes UGX ${WITHDRAWAL_FEE} fee)` },
          { status: 400 }
        )
      }
      newBalance = currentBalance - totalDeduction
    }

    const referenceNumber = generateReference(
      transactionType === "Deposit" ? "DEP" : "WTH",
      Date.now()
    )

    const transaction = await prisma.savingsLedger.create({
      data: {
        memberId,
        transactionType,
        amount,
        withdrawalFee,
        balanceAfter: newBalance,
        narration: narration || null,
        referenceNumber,
        transactionDate: new Date(),
      },
    })

    await prisma.auditTrail.create({
      data: {
        actionType: `Savings${transactionType}`,
        description: `${transactionType} of UGX ${amount.toLocaleString()} by ${member.farmerName}`,
        amount,
        memberId,
        referenceNumber,
      },
    })

    if (transactionType === "Deposit") {
      smsSavingsDeposit(memberId, amount, newBalance, referenceNumber)
      notifySavingsDeposit(memberId, member.farmerName, amount, referenceNumber)
    } else {
      smsSavingsWithdrawal(memberId, amount, newBalance, referenceNumber)
      notifySavingsWithdrawal(memberId, member.farmerName, amount, referenceNumber)
    }

    return NextResponse.json(
      {
        message: `${transactionType} processed successfully`,
        transaction,
        newBalance,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/savings error:", error)
    return NextResponse.json(
      { error: "Failed to process transaction" },
      { status: 500 }
    )
  }
}
