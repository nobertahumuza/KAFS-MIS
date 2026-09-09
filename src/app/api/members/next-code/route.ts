import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateMemberCode } from "@/lib/utils"

export async function GET() {
  try {
    const lastMember = await prisma.member.findFirst({
      orderBy: { id: "desc" },
      select: { memberCode: true },
    })

    let nextIndex = 1
    if (lastMember?.memberCode) {
      const match = lastMember.memberCode.match(/(\d+)$/)
      if (match) nextIndex = parseInt(match[1]) + 1
    }

    return NextResponse.json({ code: generateMemberCode(nextIndex) })
  } catch (error) {
    console.error("Next member code error:", error)
    return NextResponse.json({ code: "KAFS-001" })
  }
}
