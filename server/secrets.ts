import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SALT_BYTES = 16
const KEY_BYTES = 64

export type PasswordHash = {
  salt: string
  hash: string
}

export function hashPassword(password: string): PasswordHash {
  const salt = randomBytes(SALT_BYTES).toString("hex")
  return { salt, hash: derive(password, salt) }
}

export function verifyPassword(
  candidate: string,
  salt: string,
  hash: string,
): boolean {
  if (!candidate || !salt || !hash) return false
  let expected: Buffer
  try {
    expected = Buffer.from(hash, "hex")
  } catch {
    return false
  }
  let actual: Buffer
  try {
    actual = Buffer.from(derive(candidate, salt), "hex")
  } catch {
    return false
  }
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function derive(password: string, saltHex: string): string {
  return scryptSync(password, Buffer.from(saltHex, "hex"), KEY_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString("hex")
}
