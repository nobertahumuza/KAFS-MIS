import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { smsLoanFine } from "@/lib/sms"

export async function POST(request: NextRequest) {
  try {
    const now = new Date()

    const overdueSchedules = await prisma.loanRepaymentSchedule.findMany({
      where: {
        status: "Pending",
        dueDate: { lt: now },
        loan: { loanStatus: "Active" },
      },
      include: {
        loan: {
          include: {
            member: { select: { id: true, farmerName: true, memberCode: true, phoneNumber: true } },
          },
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

    for (const schedule of overdueSchedules) {
      const loan = schedule.loan
      if (!loan) continue

      const overdueDays = Math.floor(
        (now.getTime() - new Date(schedule.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (overdueDays <= 0) continue

      const existingFine = await prisma.loanFine.findFirst({
        where: { loanId: loan.id, scheduleId: schedule.id },
      })

      if (existingFine) continue

      let fineAmount = 0
      let fineRate = 0
      let reason = ""

      if (loan.loanType === "Emergency") {
        fineRate = 10
        fineAmount = parseFloat(((loan.principalAmount * fineRate) / 100).toFixed(2))
        reason = `Emergency loan fine - ${overdueDays} days overdue (10% flat of principal)`
      } else {
        fineRate = 5
        fineAmount = parseFloat((((schedule.totalAmount ?? 0) * fineRate) / 100).toFixed(2))
        reason = `Late payment fine - ${overdueDays} days overdue (5% of monthly repayment)`
      }

      if (fineAmount <= 0) continue

      await prisma.loanFine.create({
        data: {
          loanId: loan.id,
          scheduleId: schedule.id,
          fineAmount,
          fineRate,
          reason,
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

    return NextResponse.json({
      message: "Penalty calculations completed",
      totalSchedulesChecked: overdueSchedules.length,
      penaltiesCreated: penaltiesCreated.length,
      totalFines,
      details: penaltiesCreated,
    })
  } catch (error) {
    console.error("POST /api/cron/penalties error:", error)
    return NextResponse.json({ error: "Failed to calculate penalties" }, { status: 500 })
  }
}
