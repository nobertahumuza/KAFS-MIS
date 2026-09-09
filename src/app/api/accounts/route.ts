import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateAccountNo, generateMemberCode } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { accountNo: { contains: search } },
        { fullName: { contains: search } },
        { phoneNumber: { contains: search } },
        { member: { memberCode: { contains: search } } },
      ]
    }

    const [accounts, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              memberCode: true,
              farmerName: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      data: accounts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/accounts error:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      memberId,
      newMember,
      accountType,
      applicationType = "Single",
      initialDeposit,
    } = body

    if (!accountType) {
      return NextResponse.json(
        { error: "Account type is required" },
        { status: 400 }
      )
    }

    if (initialDeposit === undefined || initialDeposit === null || initialDeposit < 0) {
      return NextResponse.json(
        { error: "A valid initial deposit is required" },
        { status: 400 }
      )
    }

    let resolvedMemberId = memberId
    let memberRecord = null

    if (!memberId && newMember) {
      const { farmerName, phoneNumber, email, gender, ninNumber, address, parish, district, occupation } = newMember

      if (!farmerName?.trim()) {
        return NextResponse.json(
          { error: "Member full name is required" },
          { status: 400 }
        )
      }
      if (!phoneNumber?.trim()) {
        return NextResponse.json(
          { error: "Member phone number is required" },
          { status: 400 }
        )
      }

      const lastMember = await prisma.member.findFirst({
        orderBy: { id: "desc" },
        select: { memberCode: true },
      })

      let nextIndex = 1
      if (lastMember?.memberCode) {
        const match = lastMember.memberCode.match(/(\d+)$/)
        if (match) nextIndex = parseInt(match[1]) + 1
      }

      memberRecord = await prisma.member.create({
        data: {
          memberCode: generateMemberCode(nextIndex),
          farmerName: farmerName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email?.trim() || null,
          gender: gender || "Male",
          ninNumber: ninNumber?.trim() || null,
          address: address?.trim() || null,
          parish: parish?.trim() || null,
          district: district?.trim() || null,
          occupation: occupation?.trim() || null,
          registrationDate: new Date(),
          status: "Active",
        },
      })
      resolvedMemberId = memberRecord.id
    } else if (memberId) {
      memberRecord = await prisma.member.findUnique({ where: { id: memberId } })
      if (!memberRecord) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Either memberId or newMember data is required" },
        { status: 400 }
      )
    }

    const lastAccount = await prisma.customer.findFirst({
      orderBy: { id: "desc" },
      select: { accountNo: true },
    })

    let nextAccIndex = 1
    if (lastAccount?.accountNo) {
      const match = lastAccount.accountNo.match(/(\d+)$/)
      if (match) nextAccIndex = parseInt(match[1]) + 1
    }

    const accountNo = generateAccountNo(nextAccIndex)

    const account = await prisma.customer.create({
      data: {
        memberId: resolvedMemberId,
        accountNo,
        accountType,
        applicationType,
        fullName: memberRecord!.farmerName,
        gender: memberRecord!.gender || "Male",
        phoneNumber: memberRecord!.phoneNumber,
        emailAddress: memberRecord!.email,
        ninNumber: memberRecord!.ninNumber,
        residentialAddress: memberRecord!.address,
        district: memberRecord!.district,
        subCounty: memberRecord?.subCounty || null,
        occupation: memberRecord!.occupation,
        status: "Active",
      },
      include: {
        member: {
          select: {
            id: true,
            memberCode: true,
            farmerName: true,
          },
        },
      },
    })

    if (initialDeposit > 0) {
      const lastSavings = await prisma.savingsLedger.findFirst({
        where: { memberId: resolvedMemberId },
        orderBy: { id: "desc" },
        select: { balanceAfter: true },
      })
      const currentBalance = lastSavings?.balanceAfter ?? 0

      const referenceNumber = `REF-DEP-${Date.now()}`

      await prisma.savingsLedger.create({
        data: {
          memberId: resolvedMemberId,
          transactionType: "Deposit",
          amount: initialDeposit,
          withdrawalFee: 0,
          balanceAfter: currentBalance + initialDeposit,
          narration: "Initial deposit on account opening",
          referenceNumber,
          transactionDate: new Date(),
        },
      })

      await prisma.auditTrail.create({
        data: {
          actionType: "AccountOpening",
          description: `Account opened: ${accountNo} for ${memberRecord!.farmerName}`,
          amount: initialDeposit,
          memberId: resolvedMemberId,
          accountNumber: accountNo,
          referenceNumber,
        },
      })
    }

    return NextResponse.json(
      {
        message: "Account opened successfully",
        account,
        member: memberRecord
          ? { id: memberRecord.id, memberCode: memberRecord.memberCode, farmerName: memberRecord.farmerName }
          : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/accounts error:", error)
    return NextResponse.json(
      { error: "Failed to open account" },
      { status: 500 }
    )
  }
}
