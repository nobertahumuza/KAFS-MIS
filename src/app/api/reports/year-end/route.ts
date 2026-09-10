import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET() {
  try {
    await requireAuth()

    const now = new Date()

    const activeFiscalYear = await prisma.fiscalYear.findFirst({
      where: { status: "Active" },
      orderBy: { year: "desc" },
    })

    let currentYearInfo = null
    let summary = { totalIncome: 0, totalExpenses: 0, netIncome: 0, daysRemaining: 0 }

    if (activeFiscalYear) {
      const startDate = new Date(activeFiscalYear.year, 0, 1)
      const endDate = new Date(activeFiscalYear.year, 11, 31, 23, 59, 59, 999)

      const [totalDeposits, totalExpenses] = await Promise.all([
        prisma.savingsLedger.aggregate({
          _sum: { amount: true },
          where: { transactionType: "Deposit", transactionDate: { gte: startDate, lte: endDate } },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: { expenseDate: { gte: startDate, lte: endDate } },
        }),
      ])

      const totalIncome = totalDeposits._sum.amount ?? 0
      const totalExpensesVal = totalExpenses._sum.amount ?? 0
      const netIncome = totalIncome - totalExpensesVal

      const endOfYear = new Date(activeFiscalYear.year, 11, 31)
      const daysRemaining = Math.max(0, Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

      currentYearInfo = {
        id: activeFiscalYear.id,
        year: String(activeFiscalYear.year),
        startDate: activeFiscalYear.startDate.toISOString(),
        endDate: activeFiscalYear.endDate.toISOString(),
        status: activeFiscalYear.status,
        totalIncome,
        totalExpenses: totalExpensesVal,
        netIncome,
        closedAt: activeFiscalYear.closedAt?.toISOString() ?? null,
        closedBy: activeFiscalYear.closedBy != null ? String(activeFiscalYear.closedBy) : null,
      }

      summary = { totalIncome, totalExpenses: totalExpensesVal, netIncome, daysRemaining }
    }

    const closedFiscalYears = await prisma.fiscalYear.findMany({
      where: { status: "Closed" },
      orderBy: { year: "desc" },
    })

    const closedYears = await Promise.all(
      closedFiscalYears.map(async (fy) => {
        const startDate = new Date(fy.year, 0, 1)
        const endDate = new Date(fy.year, 11, 31, 23, 59, 59, 999)

        const [totalDeposits, totalExpenses] = await Promise.all([
          prisma.savingsLedger.aggregate({
            _sum: { amount: true },
            where: { transactionType: "Deposit", transactionDate: { gte: startDate, lte: endDate } },
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: { expenseDate: { gte: startDate, lte: endDate } },
          }),
        ])

        const totalIncome = totalDeposits._sum.amount ?? 0
        const totalExpensesVal = totalExpenses._sum.amount ?? 0

        return {
          id: fy.id,
          year: String(fy.year),
          startDate: fy.startDate.toISOString(),
          endDate: fy.endDate.toISOString(),
          status: fy.status,
          totalIncome,
          totalExpenses: totalExpensesVal,
          netIncome: totalIncome - totalExpensesVal,
          closedAt: fy.closedAt?.toISOString() ?? null,
          closedBy: fy.closedBy != null ? String(fy.closedBy) : null,
        }
      })
    )

    return NextResponse.json({
      currentYear: currentYearInfo,
      closedYears,
      summary,
    })
  } catch (error) {
    console.error("GET /api/reports/year-end error:", error)
    return NextResponse.json({ error: "Failed to fetch year-end data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    let closingYear: number
    try {
      const body = await request.json()
      closingYear = body.fiscalYear || new Date().getFullYear()
    } catch {
      closingYear = new Date().getFullYear()
    }

    const activeFiscalYear = await prisma.fiscalYear.findFirst({
      where: { year: closingYear, status: "Active" },
    })

    if (!activeFiscalYear) {
      return NextResponse.json(
        { error: `No active fiscal year found for ${closingYear}` },
        { status: 400 }
      )
    }

    const startDate = new Date(closingYear, 0, 1)
    const endDate = new Date(closingYear, 11, 31, 23, 59, 59, 999)

    const [
      totalDeposits,
      totalWithdrawals,
      totalLoanDisbursements,
      totalLoanRepayments,
      totalExpenses,
      totalSharesPurchased,
      totalSavingsInterest,
      totalLoanInterest,
      totalFines,
    ] = await Promise.all([
      prisma.savingsLedger.aggregate({
        _sum: { amount: true },
        where: { transactionType: "Deposit", transactionDate: { gte: startDate, lte: endDate } },
      }),
      prisma.savingsLedger.aggregate({
        _sum: { amount: true },
        where: { transactionType: "Withdrawal", transactionDate: { gte: startDate, lte: endDate } },
      }),
      prisma.loanDisbursement.aggregate({
        _sum: { amountDisbursed: true },
        where: { disbursementDate: { gte: startDate, lte: endDate } },
      }),
      prisma.loanRepayment.aggregate({
        _sum: { amountPaid: true },
        where: { paymentDate: { gte: startDate, lte: endDate } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { expenseDate: { gte: startDate, lte: endDate } },
      }),
      prisma.sharesLedger.aggregate({
        _sum: { totalAmount: true },
        where: { transactionDate: { gte: startDate, lte: endDate } },
      }),
      prisma.savingsInterest.aggregate({
        _sum: { interestEarned: true },
        where: { fiscalYear: closingYear },
      }),
      prisma.loanInterest.aggregate({
        _sum: { interestAmount: true },
        where: { period: { startsWith: String(closingYear) } },
      }),
      prisma.loanFine.aggregate({
        _sum: { fineAmount: true },
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
    ])

    const totalMembers = await prisma.member.count({ where: { status: "Active" } })

    const totalSavingsBalanceResult = await prisma.savingsLedger.aggregate({
      _sum: { balanceAfter: true },
      where: { transactionDate: { lte: endDate } },
    })

    const totalLoanOutstandingResult = await prisma.loan.aggregate({
      _sum: { currentBalance: true },
      where: { loanStatus: "Active" },
    })

    const totalShareValueResult = await prisma.member.aggregate({
      _sum: { shareValue: true },
      where: { status: "Active" },
    })

    const finalBalances = {
      totalMembers,
      totalSavingsBalance: totalSavingsBalanceResult._sum.balanceAfter ?? 0,
      totalLoanOutstanding: totalLoanOutstandingResult._sum.currentBalance ?? 0,
      totalShareValue: totalShareValueResult._sum.shareValue ?? 0,
    }

    await prisma.fiscalYear.update({
      where: { id: activeFiscalYear.id },
      data: {
        status: "Closed",
        closedAt: new Date(),
        closedBy: parseInt((user as { id: string }).id) || null,
      },
    })

    const existingNextYear = await prisma.fiscalYear.findFirst({
      where: { year: closingYear + 1 },
    })

    let nextFiscalYear
    if (!existingNextYear) {
      nextFiscalYear = await prisma.fiscalYear.create({
        data: {
          year: closingYear + 1,
          startDate: new Date(closingYear + 1, 0, 1),
          endDate: new Date(closingYear + 1, 11, 31, 23, 59, 59, 999),
          status: "Active",
        },
      })
    } else {
      nextFiscalYear = await prisma.fiscalYear.update({
        where: { id: existingNextYear.id },
        data: { status: "Active" },
      })
    }

    await prisma.auditTrail.create({
      data: {
        actionType: "YearEndClose",
        description: `Fiscal year ${closingYear} closed. New fiscal year ${closingYear + 1} created.`,
        amount: totalDeposits._sum.amount ?? 0,
      },
    })

    return NextResponse.json({
      message: `Fiscal year ${closingYear} closed successfully`,
      closedYear: {
        year: closingYear,
        closedAt: new Date().toISOString(),
        summary: {
          totalDeposits: totalDeposits._sum.amount ?? 0,
          totalWithdrawals: totalWithdrawals._sum.amount ?? 0,
          totalLoanDisbursements: totalLoanDisbursements._sum.amountDisbursed ?? 0,
          totalLoanRepayments: totalLoanRepayments._sum.amountPaid ?? 0,
          totalExpenses: totalExpenses._sum.amount ?? 0,
          totalSharesPurchased: totalSharesPurchased._sum.totalAmount ?? 0,
          totalSavingsInterestPaid: totalSavingsInterest._sum.interestEarned ?? 0,
          totalLoanInterestCharged: totalLoanInterest._sum.interestAmount ?? 0,
          totalFinesCharged: totalFines._sum.fineAmount ?? 0,
        },
        finalBalances,
      },
      nextFiscalYear: {
        year: nextFiscalYear.year,
        startDate: nextFiscalYear.startDate.toISOString(),
        endDate: nextFiscalYear.endDate.toISOString(),
        status: nextFiscalYear.status,
      },
    })
  } catch (error) {
    console.error("POST /api/reports/year-end error:", error)
    return NextResponse.json({ error: "Failed to close fiscal year" }, { status: 500 })
  }
}
