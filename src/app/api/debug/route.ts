import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  const info: Record<string, string> = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET (length: " + process.env.NEXTAUTH_SECRET.length + ")" : "NOT SET",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
    DATABASE_URL: process.env.DATABASE_URL ? "SET (starts with: " + process.env.DATABASE_URL.substring(0, 12) + "...)" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
    VERCEL: process.env.VERCEL || "NOT SET",
  }

  let dbStatus = "unknown"
  let dbError = ""
  let userCount = 0
  try {
    const count = await prisma.user.count()
    userCount = count
    dbStatus = "connected"
  } catch (e) {
    dbStatus = "failed"
    dbError = String(e)
  }

  return NextResponse.json({
    env: info,
    dbStatus,
    dbError: dbError || undefined,
    userCount,
  })
}
