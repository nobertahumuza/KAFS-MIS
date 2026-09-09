import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { entryCode: { contains: search } },
        { description: { contains: search } },
        { referenceNumber: { contains: search } },
      ]
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { accountCode: true, accountName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.journalEntry.count({ where }),
    ])

    return NextResponse.json({
      data: entries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/journal-entries error:", error)
    return NextResponse.json({ error: "Failed to fetch journal entries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entryDate, description, referenceNumber, lines } = body

    if (!entryDate) {
      return NextResponse.json({ error: "Entry date is required" }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({ error: "At least two journal lines are required" }, { status: 400 })
    }

    const totalDebit = lines.reduce((sum: number, l: { debit?: number }) => sum + (Number(l.debit) || 0), 0)
    const totalCredit = lines.reduce((sum: number, l: { credit?: number }) => sum + (Number(l.credit) || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: "Total debits must equal total credits" },
        { status: 400 }
      )
    }

    for (const line of lines) {
      if (!line.accountId) {
        return NextResponse.json({ error: "All lines must have an account" }, { status: 400 })
      }
      const debit = parseFloat(line.debit) || 0
      const credit = parseFloat(line.credit) || 0
      if (debit < 0 || credit < 0) {
        return NextResponse.json({ error: "Debit and credit amounts must be positive" }, { status: 400 })
      }
      if (debit === 0 && credit === 0) {
        return NextResponse.json({ error: "Each line must have a debit or credit amount" }, { status: 400 })
      }
    }

    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { id: "desc" },
      select: { entryCode: true },
    })
    let nextIndex = 1
    if (lastEntry?.entryCode) {
      const match = lastEntry.entryCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }
    const entryCode = `JE-${String(nextIndex).padStart(5, "0")}`

    const entry = await prisma.journalEntry.create({
      data: {
        entryCode,
        entryDate: new Date(entryDate),
        description: description.trim(),
        referenceNumber: referenceNumber?.trim() || null,
        totalDebit,
        totalCredit,
        status: "Draft",
        lines: {
          create: lines.map((l: {
            accountId: number
            debit?: number
            credit?: number
            memberId?: number
            narration?: string
          }) => ({
            accountId: Number(l.accountId),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            memberId: l.memberId ? Number(l.memberId) : null,
            narration: l.narration?.trim() || null,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { accountCode: true, accountName: true } },
          },
        },
      },
    })

    return NextResponse.json({ data: entry, message: "Journal entry created" }, { status: 201 })
  } catch (error) {
    console.error("POST /api/journal-entries error:", error)
    return NextResponse.json({ error: "Failed to create journal entry" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 })
    }

    const entry = await prisma.journalEntry.findUnique({ where: { id: parseInt(id) } })
    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    if (action === "post") {
      if (entry.status !== "Draft") {
        return NextResponse.json({ error: "Only draft entries can be posted" }, { status: 400 })
      }

      const updated = await prisma.journalEntry.update({
        where: { id: parseInt(id) },
        data: { status: "Posted" },
        include: {
          lines: {
            include: {
              account: { select: { accountCode: true, accountName: true } },
            },
          },
        },
      })

      for (const line of updated.lines) {
        await prisma.chartOfAccount.update({
          where: { id: line.accountId },
          data: {
            balance: {
              increment: line.debit - line.credit,
            },
          },
        })
      }

      return NextResponse.json({ data: updated, message: "Journal entry posted" })
    }

    if (action === "reverse") {
      if (entry.status !== "Posted") {
        return NextResponse.json({ error: "Only posted entries can be reversed" }, { status: 400 })
      }

      const updated = await prisma.journalEntry.update({
        where: { id: parseInt(id) },
        data: { status: "Reversed" },
        include: {
          lines: {
            include: {
              account: { select: { accountCode: true, accountName: true } },
            },
          },
        },
      })

      for (const line of updated.lines) {
        await prisma.chartOfAccount.update({
          where: { id: line.accountId },
          data: {
            balance: {
              decrement: line.debit - line.credit,
            },
          },
        })
      }

      return NextResponse.json({ data: updated, message: "Journal entry reversed" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("PUT /api/journal-entries error:", error)
    return NextResponse.json({ error: "Failed to update journal entry" }, { status: 500 })
  }
}
