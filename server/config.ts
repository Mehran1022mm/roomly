import { randomBytes } from "node:crypto"
import { config as fileConfig } from "../config/roomly.config.ts"
import type { IceServerConfig } from "../shared/protocol.ts"
import { hashPassword, type PasswordHash } from "./secrets.ts"

export type ServerConfig = {
  port: number
  host: string
  isDev: boolean
  roomPassword: PasswordHash
  maxUsers: number
  authSecret: string
  adminPassword: PasswordHash | null
  adminEnabled: boolean
  iceServers: IceServerConfig[]
  stunUrls: string[]
  turnConfigured: boolean
  trustProxy: boolean
}

export const MIN_PASSWORD_LENGTH = 12
export const MIN_USERS = 2
export const MAX_USERS_LIMIT = 12
const DEFAULT_STUN = "stun:stun.l.google.com:19302"

function readRaw(name: string): string | undefined {
  const raw = process.env[name]
  if (raw === undefined) return undefined
  return raw.length > 0 ? raw : undefined
}

function readTrimmed(name: string): string | undefined {
  const raw = readRaw(name)
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readSecret(name: string): string | undefined {
  const raw = process.env[name]
  if (raw === undefined || raw.length === 0) return undefined
  return raw
}

function readIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = readTrimmed(name)
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || String(parsed) !== raw) {
    throw new Error(`${name} must be an integer, received "${raw}"`)
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}, received ${parsed}`)
  }
  return parsed
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = readTrimmed(name)
  if (raw === undefined) return fallback
  const normalized = raw.toLowerCase()
  if (normalized === "1" || normalized === "true") return true
  if (normalized === "0" || normalized === "false") return false
  throw new Error(`${name} must be 1, 0, true or false, received "${raw}"`)
}

function splitUrls(value: string): string[] {
  return value
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)]
}

function assertStunUrl(url: string): void {
  if (!url.startsWith("stun:") && !url.startsWith("stuns:")) {
    throw new Error(`STUN entry must start with stun: or stuns:, received "${url}"`)
  }
}

function assertTurnUrl(url: string): void {
  if (!url.startsWith("turn:") && !url.startsWith("turns:")) {
    throw new Error(`TURN entry must start with turn: or turns:, received "${url}"`)
  }
}

function resolveStunUrls(): string[] {
  const envOverride = readTrimmed("STUN_SERVER")
  const base = envOverride ? splitUrls(envOverride) : [...fileConfig.ice.stun]
  const fallback = base.length > 0 ? base : [DEFAULT_STUN]
  const useSelf = readBooleanEnv("SELF_STUN", fileConfig.ice.useSelfStun)
  const envHost = readTrimmed("SELF_STUN_HOST")
  const fileHost = fileConfig.ice.selfHost.trim()
  const selfHost = (envHost ?? fileHost).trim()
  const selfPort = readIntegerEnv(
    "SELF_STUN_PORT",
    fileConfig.ice.selfStunPort,
    1,
    65535,
  )
  const merged = [...fallback]
  if (useSelf && selfHost) {
    merged.unshift(`stun:${selfHost}:${selfPort}`)
  }
  const clean = dedupeUrls(merged)
  if (clean.length === 0) {
    throw new Error("STUN must contain at least one URL")
  }
  for (const url of clean) assertStunUrl(url)
  return clean
}

function resolveTurn(): { urls: string[]; username: string } {
  const envUrls = readTrimmed("TURN_SERVER")
  const urls = envUrls ? splitUrls(envUrls) : [...fileConfig.ice.turn.urls]
  const username = readTrimmed("TURN_USERNAME") ?? fileConfig.ice.turn.username
  for (const url of urls) assertTurnUrl(url)
  return { urls: dedupeUrls(urls), username }
}

function buildIceServers(stunUrls: string[], turn: { urls: string[]; username: string }): {
  servers: IceServerConfig[]
  turnConfigured: boolean
} {
  const servers: IceServerConfig[] = [{ urls: stunUrls }]
  if (turn.urls.length === 0) return { servers, turnConfigured: false }
  const turnPassword = readSecret("TURN_PASSWORD")
  if (!turn.username || !turnPassword) {
    throw new Error("TURN_USERNAME and TURN_PASSWORD must be set together")
  }
  servers.push({ urls: turn.urls, username: turn.username, credential: turnPassword })
  return { servers, turnConfigured: true }
}

export function loadConfig(isDev: boolean): ServerConfig {
  const roomSecret = readSecret("ROOM_PASSWORD")
  if (!roomSecret) {
    throw new Error("ROOM_PASSWORD is required. Set it in .env or the environment.")
  }
  if (!isDev && roomSecret.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ROOM_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters in production`)
  }
  const configuredSecret = readSecret("AUTH_SECRET")
  let authSecret = configuredSecret
  if (!authSecret) {
    if (isDev) {
      authSecret = randomBytes(32).toString("hex")
    } else {
      throw new Error("AUTH_SECRET is required in production. Generate one with: openssl rand -hex 32")
    }
  }
  const adminSecret = readSecret("ADMIN_PASSWORD")
  const adminPassword = adminSecret ? hashPassword(adminSecret) : null
  const adminEnabled = fileConfig.admin.enabled && adminPassword !== null
  const stunUrls = resolveStunUrls()
  const turn = resolveTurn()
  const turnPassword = readSecret("TURN_PASSWORD")
  if ((turn.urls.length > 0 || turnPassword) && !(turn.urls.length > 0 && turnPassword)) {
    throw new Error("TURN_SERVER and TURN_PASSWORD must be set together")
  }
  const built = buildIceServers(stunUrls, turn)
  return {
    port: readIntegerEnv("PORT", fileConfig.port, 1, 65535),
    host: readTrimmed("HOST") ?? (isDev ? "127.0.0.1" : fileConfig.host),
    isDev,
    roomPassword: hashPassword(roomSecret),
    maxUsers: readIntegerEnv("MAX_USERS", fileConfig.maxUsers, MIN_USERS, MAX_USERS_LIMIT),
    authSecret: authSecret as string,
    adminPassword,
    adminEnabled,
    iceServers: built.servers,
    stunUrls,
    turnConfigured: built.turnConfigured,
    trustProxy: readBooleanEnv("TRUST_PROXY", fileConfig.trustProxy),
  }
}
