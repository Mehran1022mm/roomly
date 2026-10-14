import { createHmac, timingSafeEqual } from "node:crypto"

export const ADMIN_COOKIE = "roomly_admin"
export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000

export function createAdminToken(secret: string, now: number): string {
  const expiresAt = now + ADMIN_TOKEN_TTL_MS
  const encoded = Buffer.from(JSON.stringify({ scope: "admin", expiresAt }), "utf8").toString(
    "base64url",
  )
  return `${encoded}.${sign(encoded, secret)}`
}

export function verifyAdminToken(token: string, secret: string, now: number): boolean {
  const separatorIndex = token.lastIndexOf(".")
  if (separatorIndex <= 0) return false
  const encoded = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  if (encoded.length === 0 || signature.length === 0) return false
  if (!safeEquals(signature, sign(encoded, secret))) return false
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (typeof parsed !== "object" || parsed === null) return false
    const candidate = parsed as { scope?: unknown; expiresAt?: unknown }
    if (candidate.scope !== "admin") return false
    if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) {
      return false
    }
    return candidate.expiresAt > now
  } catch {
    return false
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(`admin:${value}`).digest("base64url")
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}
