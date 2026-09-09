import { NextResponse } from "next/server"

export async function GET() {
  const info: Record<string, string> = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET (length: " + process.env.NEXTAUTH_SECRET.length + ")" : "NOT SET",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? "SET" : "NOT SET",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
    VERCEL: process.env.VERCEL || "NOT SET",
  }

  let dbStatus = "unknown"
  let dbError = ""
  try {
    const prisma = (await import("@/lib/prisma")).default
    const userCount = await prisma.user.count()
    info.USER_COUNT = String(userCount)
    dbStatus = "connected"
  } catch (e) {
    dbStatus = "failed"
    dbError = String(e)
  }

  return NextResponse.json({
    env: info,
    dbStatus,
    dbError: dbError || undefined,
  })
}
