import { getServerSession as nextAuthGetServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth-options"

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session?.user) {
    redirect("/login")
  }
  return session.user
}

export async function requireRole(roles: string[]) {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    redirect("/unauthorized")
  }
  return user
}
