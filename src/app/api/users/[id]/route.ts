import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.username === "admin") {
      return NextResponse.json(
        { error: "Cannot delete the default admin account" },
        { status: 400 }
      )
    }

    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.fullName) updateData.fullName = body.fullName
    if (body.role) updateData.role = body.role

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, username: true, fullName: true, role: true, status: true },
    })

    return NextResponse.json({ message: "User updated successfully", user: updated })
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
