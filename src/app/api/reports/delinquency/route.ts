import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const now = new Date()

    const overdueLoans = await prisma.loan.findMany({
      where: {
        loanStatus: "Active",
        dueDate: { lt: now },
      },
      include: {
        member: {
          select: { id: true, farmerName: true, memberCode: true, phoneNumber: true },
        },
        repayments: {
          orderBy: { paymentDate: "desc" },
          take: 1,
        },
        fines: {
          where: { status: "Pending" },
        },
      },
      orderBy: { dueDate: "asc" },
    })

    const loansWithRisk = overdueLoans.map((loan) => {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(loan.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
      )

      let riskLevel: string
      if (daysOverdue <= 30) {
        riskLevel = "Low"
      } else if (daysOverdue <= 60) {
        riskLevel = "Medium"
      } else if (daysOverdue <= 90) {
        riskLevel = "High"
      } else {
        riskLevel = "Critical"
      }

      const pendingFines = loan.fines.reduce((sum, f) => sum + (f.fineAmount ?? 0), 0)

      return {
        loanId: loan.id,
        loanCode: loan.loanCode,
        memberId: loan.memberId,
        memberName: loan.member.farmerName,
        memberCode: loan.member.memberCode,
        phoneNumber: loan.member.phoneNumber,
        principalAmount: loan.principalAmount,
        currentBalance: loan.currentBalance,
        disbursementDate: loan.disbursementDate.toISOString(),
        dueDate: loan.dueDate?.toISOString() ?? null,
        daysOverdue,
        riskLevel,
        pendingFines,
        lastPayment: loan.repayments[0]
          ? {
              amount: loan.repayments[0].amountPaid,
              date: loan.repayments[0].paymentDate.toISOString(),
            }
          : null,
      }
    })

    const totalAtRisk = loansWithRisk.reduce((sum, l) => sum + l.currentBalance, 0)
    const totalPendingFines = loansWithRisk.reduce((sum, l) => sum + l.pendingFines, 0)

    const riskBreakdown = {
      Low: loansWithRisk.filter((l) => l.riskLevel === "Low"),
      Medium: loansWithRisk.filter((l) => l.riskLevel === "Medium"),
      High: loansWithRisk.filter((l) => l.riskLevel === "High"),
      Critical: loansWithRisk.filter((l) => l.riskLevel === "Critical"),
    }

    const totalActiveLoans = await prisma.loan.count({ where: { loanStatus: "Active" } })
    const delinquencyRate = totalActiveLoans > 0
      ? parseFloat(((loansWithRisk.length / totalActiveLoans) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      generatedAt: now.toISOString(),
      summary: {
        totalOverdueLoans: loansWithRisk.length,
        totalActiveLoans,
        delinquencyRate,
        totalAtRiskPortfolio: totalAtRisk,
        totalPendingFines,
        riskBreakdown: {
          low: { count: riskBreakdown.Low.length, amount: riskBreakdown.Low.reduce((s, l) => s + l.currentBalance, 0) },
          medium: { count: riskBreakdown.Medium.length, amount: riskBreakdown.Medium.reduce((s, l) => s + l.currentBalance, 0) },
          high: { count: riskBreakdown.High.length, amount: riskBreakdown.High.reduce((s, l) => s + l.currentBalance, 0) },
          critical: { count: riskBreakdown.Critical.length, amount: riskBreakdown.Critical.reduce((s, l) => s + l.currentBalance, 0) },
        },
      },
      loans: loansWithRisk,
    })
  } catch (error) {
    console.error("GET /api/reports/delinquency error:", error)
    return NextResponse.json({ error: "Failed to generate delinquency report" }, { status: 500 })
  }
}
