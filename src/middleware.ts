import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Authentication guard for the whole MIS.
 *
 * Every page and API route requires a signed-in staff session unless it is
 * explicitly public below. This closes the gap where write endpoints such as
 * POST /api/savings and POST /api/loan-applications accepted anonymous
 * requests (role checks still live in the individual routes).
 *
 * Public by design:
 *  - "/", "/login", "/unauthorized"  anonymous entry points
 *  - "/member-portal"                member self-service portal page
 *  - "/api/auth/*"                   NextAuth (login, session, csrf, ...)
 *  - "/api/member-portal*"           portal login / repayment, which
 *                                    authenticate the member with
 *                                    memberCode + phone number
 *  - "/api/member-expenses"          portal expense feature (same portal
 *                                    trust model)
 *      TODO(portal-sessions): give portal members a real session token and
 *      remove both portal allowlists.
 *  - "/api/cron/*"                   Vercel cron jobs. Enforced only once
 *                                    CRON_SECRET is configured, so the
 *                                    existing schedule keeps working; set
 *                                    CRON_SECRET in the environment to start
 *                                    rejecting anonymous triggers.
 */

const PUBLIC_PAGES = new Set(["/", "/login", "/unauthorized", "/member-portal"])

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/member-portal",
  "/api/member-expenses",
]

function isPublic(pathname: string) {
  if (PUBLIC_PAGES.has(pathname)) return true
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Cron jobs: allow anonymous calls only while no secret is configured.
  if (pathname.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET
    if (!secret) return NextResponse.next()
    if (request.headers.get("authorization") === `Bearer ${secret}`) {
      return NextResponse.next()
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPublic(pathname)) return NextResponse.next()

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (token) return NextResponse.next()

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|svg|gif|ico|webp|map|txt|woff2?)$).*)",
  ],
}
