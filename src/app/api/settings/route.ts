import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany()
    const result: Record<string, string> = {}
    settings.forEach((s) => { result[s.settingKey] = s.settingValue || "" })
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error("GET /api/settings error:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const upserts = Object.entries(body).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { settingKey: key },
        update: { settingValue: String(value), updatedAt: new Date() },
        create: { settingKey: key, settingValue: String(value) },
      })
    )

    await Promise.all(upserts)

    return NextResponse.json({ message: "Settings saved" })
  } catch (error) {
    console.error("PUT /api/settings error:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
