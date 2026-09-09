import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("GET /api/users error:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fullName, username, password, role } = body

    if (!fullName?.trim()) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 })
    }
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 })
    }

    const bcrypt = await import("bcryptjs")
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        username: username.trim(),
        password: hashedPassword,
        role: role || "Teller",
        status: "Active",
      },
      select: { id: true, fullName: true, username: true, role: true, status: true, createdAt: true },
    })

    return NextResponse.json({ message: "User created successfully", user }, { status: 201 })
  } catch (error) {
    console.error("POST /api/users error:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, password, status, role } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (role) updateData.role = role
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
      }
      const bcrypt = await import("bcryptjs")
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: { id: true, fullName: true, username: true, role: true, status: true },
    })

    return NextResponse.json({ message: "User updated successfully", user })
  } catch (error) {
    console.error("PATCH /api/users error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
