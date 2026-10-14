import { NextResponse } from "next/server"
import { loadConfig } from "../../../../../server/config.ts"
import { createAdminToken } from "../../../../../server/adminAuth.ts"
import { verifyPassword } from "../../../../../server/secrets.ts"

const attempts = new Map<string, { count: number; resetAt: number }>()

function throttled(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60000 })
    return false
  }
  entry.count += 1
  return entry.count > 10
}

export async function POST(request: Request) {
  const config = loadConfig(process.env.NODE_ENV !== "production")
  if (!config.adminEnabled || !config.adminPassword) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (throttled(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  let password = ""
  try {
    const body: unknown = await request.json()
    if (typeof body === "object" && body !== null) {
      const candidate = (body as { password?: unknown }).password
      if (typeof candidate === "string") password = candidate
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (
    !config.adminPassword ||
    !verifyPassword(password, config.adminPassword.salt, config.adminPassword.hash)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const token = createAdminToken(config.authSecret, Date.now())
  const response = NextResponse.json({ ok: true })
  response.cookies.set("roomly_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  })
  return response
}
