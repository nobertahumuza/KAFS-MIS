import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateAccountNo } from "@/lib/utils"

export async function GET() {
  try {
    const currentYear = new Date().getFullYear().toString().slice(-2)
    const prefix = `ACC${currentYear}`

    const lastAccount = await prisma.customer.findFirst({
      orderBy: { id: "desc" },
      select: { accountNo: true },
    })

    let nextIndex = 1
    if (lastAccount?.accountNo) {
      const match = lastAccount.accountNo.match(new RegExp(`^${prefix}(\\d+)$`))
      if (match) {
        nextIndex = parseInt(match[1]) + 1
      }
    }

    return NextResponse.json({ code: generateAccountNo(nextIndex) })
  } catch (error) {
    console.error("Next account number error:", error)
    const year = new Date().getFullYear().toString().slice(-2)
    return NextResponse.json({ code: `ACC${year}00001` })
  }
}
