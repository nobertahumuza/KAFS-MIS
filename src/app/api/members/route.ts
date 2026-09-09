import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateMemberCode, generateAccountNo } from "@/lib/utils"
import { smsAccountOpening } from "@/lib/sms"
import { notifyMemberRegistered, notifyAccountOpened } from "@/lib/notify"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { farmerName: { contains: search, mode: "insensitive" } },
        { memberCode: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.member.count({ where }),
    ])

    return NextResponse.json({
      data: members,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("GET /api/members error:", error)
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      farmerName,
      phoneNumber,
      email,
      gender,
      ninNumber,
      address,
      village,
      parish,
      subCounty,
      district,
      occupation,
      idDocumentType,
      idDocumentNumber,
      nextOfKinName,
      nextOfKinPhone,
    } = body

    if (!farmerName?.trim()) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      )
    }

    if (!phoneNumber?.trim()) {
      return NextResponse.json(
        { error: "Phone number is required" },
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

    const memberCode = generateMemberCode(nextIndex)

    const member = await prisma.member.create({
      data: {
        memberCode,
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
        idDocumentType: idDocumentType || null,
        idDocumentNumber: idDocumentNumber?.trim() || null,
        nextOfKinName: nextOfKinName?.trim() || null,
        nextOfKinPhone: nextOfKinPhone?.trim() || null,
        registrationDate: new Date(),
        status: "Active",
      },
    })

    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { id: "desc" },
      select: { accountNo: true },
    })

    let accNextIndex = 1
    if (lastCustomer?.accountNo) {
      const match = lastCustomer.accountNo.match(/(\d+)$/)
      if (match) accNextIndex = parseInt(match[1]) + 1
    }

    await prisma.customer.create({
      data: {
        accountNo: generateAccountNo(accNextIndex),
        memberId: member.id,
        fullName: farmerName.trim(),
        gender: gender || "Male",
        phoneNumber: phoneNumber.trim(),
        emailAddress: email?.trim() || null,
        district: district?.trim() || null,
        subCounty: subCounty?.trim() || null,
        occupation: occupation?.trim() || null,
        ninNumber: ninNumber?.trim() || null,
        idDocumentType: idDocumentType || null,
        idDocumentNumber: idDocumentNumber?.trim() || null,
        status: "Active",
      },
    })

    const accountNo = generateAccountNo(accNextIndex)

    smsAccountOpening(member.id, accountNo, "Savings", 0).catch(() => {})
    notifyMemberRegistered(member.id, farmerName.trim(), memberCode).catch(() => {})
    notifyAccountOpened(member.id, farmerName.trim(), accountNo).catch(() => {})

    return NextResponse.json(
      { message: "Member registered successfully", member },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/members error:", error)
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 }
    )
  }
}
