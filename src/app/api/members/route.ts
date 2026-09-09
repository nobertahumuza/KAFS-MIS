import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateMemberCode } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { farmerName: { contains: search } },
        { memberCode: { contains: search } },
        { phoneNumber: { contains: search } },
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
      parish,
      district,
      occupation,
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

    const member = await prisma.member.create({
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
        nextOfKinName: nextOfKinName?.trim() || null,
        nextOfKinPhone: nextOfKinPhone?.trim() || null,
        registrationDate: new Date(),
        status: "Active",
      },
    })

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
