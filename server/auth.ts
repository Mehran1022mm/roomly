import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

type TokenPayload = {
  id: string
  expiresAt: number
}

export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

export function matchesSecret(candidate: string, expected: string): boolean {
  return constantTimeEquals(candidate, expected)
}

export function createSessionToken(id: string, secret: string, now: number): string {
  const payload: TokenPayload = { id, expiresAt: now + TOKEN_TTL_MS }
  const encoded = encodePayload(payload)
  return `${encoded}.${sign(encoded, secret)}`
}

export function verifySessionToken(token: string, secret: string, now: number): string | null {
  const separatorIndex = token.lastIndexOf(".")
  if (separatorIndex <= 0) return null
  const encoded = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  if (encoded.length === 0 || signature.length === 0) return null
  if (!constantTimeEquals(signature, sign(encoded, secret))) return null
  const payload = decodePayload(encoded)
  if (!payload) return null
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) return null
  if (payload.id.length === 0) return null
  return payload.id
}

export function createParticipantId(): string {
  return randomUUID()
}

export function createMessageId(): string {
  return randomUUID()
}

export function createSecretHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex")
}

function encodePayload(payload: TokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodePayload(encoded: string): TokenPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (typeof parsed !== "object" || parsed === null) return null
    const candidate = parsed as Partial<TokenPayload>
    if (typeof candidate.id !== "string" || candidate.id.length === 0) return null
    if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) return null
    return { id: candidate.id, expiresAt: candidate.expiresAt }
  } catch {
    return null
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url")
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  if (leftBuffer.length !== rightBuffer.length) {
    const dummy = createHmac("sha256", "roomly-compare").update(right).digest()
    const probe = createHmac("sha256", "roomly-compare").update(left).digest()
    return probe.length === dummy.length && timingSafeEqual(probe, probe) && false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}
