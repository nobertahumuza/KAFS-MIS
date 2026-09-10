import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { smsLoanFine } from "@/lib/sms"

const FINE_RATE = 5

export async function POST(request: NextRequest) {
  try {
    const now = new Date()

    const overdueLoans = await prisma.loan.findMany({
      where: {
        loanStatus: "Active",
        dueDate: { lt: now },
      },
      include: {
        member: { select: { id: true, farmerName: true, memberCode: true, phoneNumber: true } },
        repaymentSchedules: {
          where: { status: "Pending" },
          orderBy: { dueDate: "asc" },
        },
      },
    })

    const penaltiesCreated: {
      loanId: number
      loanCode: string
      memberName: string
      fineAmount: number
      overdueDays: number
      smsSent: boolean
    }[] = []

    let totalFines = 0

    for (const loan of overdueLoans) {
      for (const schedule of loan.repaymentSchedules) {
        const overdueDays = Math.floor(
          (now.getTime() - new Date(schedule.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (overdueDays <= 0) continue

        const existingFine = await prisma.loanFine.findFirst({
          where: { loanId: loan.id, scheduleId: schedule.id },
        })

        if (existingFine) continue

        const overdueAmount = (schedule.totalAmount ?? 0) - (schedule.amountPaid ?? 0)
        const fineAmount = parseFloat(((overdueAmount * FINE_RATE) / 100).toFixed(2))

        if (fineAmount <= 0) continue

        await prisma.loanFine.create({
          data: {
            loanId: loan.id,
            scheduleId: schedule.id,
            fineAmount,
            fineRate: FINE_RATE,
            reason: `Late payment fine - ${overdueDays} days overdue`,
            status: "Pending",
          },
        })

        await prisma.loanRepaymentSchedule.update({
          where: { id: schedule.id },
          data: { fineAmount: (schedule.fineAmount ?? 0) + fineAmount },
        })

        totalFines += fineAmount

        let smsSent = false
        if (loan.member.phoneNumber) {
          try {
            const dueDateStr = new Date(schedule.dueDate).toISOString().split("T")[0]
            await smsLoanFine(loan.member.id, loan.loanCode, fineAmount, overdueDays, dueDateStr)
            smsSent = true
          } catch {
            smsSent = false
          }
        }

        penaltiesCreated.push({
          loanId: loan.id,
          loanCode: loan.loanCode,
          memberName: loan.member.farmerName,
          fineAmount,
          overdueDays,
          smsSent,
        })
      }
    }

    return NextResponse.json({
      message: "Penalty calculations completed",
      totalLoansChecked: overdueLoans.length,
      penaltiesCreated: penaltiesCreated.length,
      totalFines,
      details: penaltiesCreated,
    })
  } catch (error) {
    console.error("POST /api/cron/penalties error:", error)
    return NextResponse.json({ error: "Failed to calculate penalties" }, { status: 500 })
  }
}
