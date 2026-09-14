import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateAccountNo, generateMemberCode } from "@/lib/utils"
import { smsAccountOpening } from "@/lib/sms"

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
      applicationType = "Single",
      accountType,
      accountTypeOther,
      currency = "UGX",
      currencyOther,
      maritalStatus,
      dateOfBirth,
      placeOfBirth,
      nationality,
      employerBusiness,
      sourceOfFunds,
      purposeOfAccount,
      nextOfKinName,
      nextOfKinContact,
      beneficiary,
      idDocumentType,
      idDocumentNumber,
      status = "Draft",
    } = body

    if (!accountType) {
      return NextResponse.json(
        { error: "Account type is required" },
        { status: 400 }
      )
    }

    let resolvedMemberId = memberId
    let memberRecord = null

    if (!memberId && newMember) {
      const { farmerName, phoneNumber, email, gender, ninNumber, address, village, parish, subCounty, district, occupation } = newMember

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
          village: village?.trim() || null,
          parish: parish?.trim() || null,
          subCounty: subCounty?.trim() || null,
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

    // Sequential account numbering: KAFS-ACC-001, KAFS-ACC-002, ...
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

    // Determine gender from newMember or memberRecord
    const gender = newMember?.gender || memberRecord?.gender || "Male"
    const fullName = newMember?.farmerName?.trim() || memberRecord!.farmerName
    const phoneNumber = newMember?.phoneNumber?.trim() || memberRecord!.phoneNumber
    const emailAddress = newMember?.email?.trim() || memberRecord?.email || null
    const nin = newMember?.ninNumber?.trim() || memberRecord?.ninNumber || null
    const residentialAddress = newMember?.address?.trim() || memberRecord?.address || null
    const dist = newMember?.district?.trim() || memberRecord?.district || null
    const sub = newMember?.subCounty?.trim() || memberRecord?.subCounty || null
    const occ = newMember?.occupation?.trim() || memberRecord?.occupation || null

    const account = await prisma.customer.create({
      data: {
        memberId: resolvedMemberId,
        accountNo,
        accountType,
        accountTypeOther: accountTypeOther?.trim() || null,
        applicationType,
        currency,
        currencyOther: currency?.trim() === "Other" ? currencyOther?.trim() || null : null,
        fullName,
        gender,
        maritalStatus: maritalStatus || "Single",
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        placeOfBirth: placeOfBirth?.trim() || null,
        district: dist,
        county: body.county?.trim() || null,
        subCounty: sub,
        nationality: nationality?.trim() || "Ugandan",
        phoneNumber,
        emailAddress,
        residentialAddress,
        occupation: occ,
        employerBusiness: employerBusiness?.trim() || null,
        ninNumber: nin,
        sourceOfFunds: sourceOfFunds || null,
        purposeOfAccount: purposeOfAccount || null,
        nextOfKinName: nextOfKinName?.trim() || null,
        nextOfKinContact: nextOfKinContact?.trim() || null,
        beneficiary: beneficiary?.trim() || null,
        idDocumentType: idDocumentType || null,
        idDocumentNumber: idDocumentNumber?.trim() || null,
        status: status || "Draft",
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

    // Audit trail
    await prisma.auditTrail.create({
      data: {
        actionType: "AccountOpening",
        description: `Account opened: ${accountNo} for ${fullName}`,
        memberId: resolvedMemberId,
        accountNumber: accountNo,
      },
    })

    smsAccountOpening(resolvedMemberId, accountNo, accountType, 0)

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
