import {
  CHAT_MESSAGE_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  PARTICIPANT_ID_MAX_LENGTH,
  SDP_MAX_LENGTH,
  type ClientMessage,
} from "../shared/protocol.ts"

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: "malformed" | "messageEmpty" | "messageTooLong" }

export function parseClientMessage(raw: string): ParseResult {
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    return { ok: false, reason: "malformed" }
  }
  if (typeof decoded !== "object" || decoded === null) {
    return { ok: false, reason: "malformed" }
  }
  const message = decoded as Partial<ClientMessage> & Record<string, unknown>
  switch (message.type) {
    case "join": {
      if (message.displayName !== undefined && typeof message.displayName !== "string") {
        return { ok: false, reason: "malformed" }
      }
      if (message.password !== undefined && typeof message.password !== "string") {
        return { ok: false, reason: "malformed" }
      }
      if (message.token !== undefined && typeof message.token !== "string") {
        return { ok: false, reason: "malformed" }
      }
      return {
        ok: true,
        message: {
          type: "join",
          displayName: typeof message.displayName === "string" ? message.displayName : "",
          password: typeof message.password === "string" ? message.password : "",
          token: typeof message.token === "string" ? message.token : undefined,
        },
      }
    }
    case "signal": {
      if (typeof message.to !== "string" || message.to.length === 0) {
        return { ok: false, reason: "malformed" }
      }
      if (message.to.length > PARTICIPANT_ID_MAX_LENGTH) {
        return { ok: false, reason: "malformed" }
      }
      if (!isSignalPayload(message.payload)) {
        return { ok: false, reason: "malformed" }
      }
      return {
        ok: true,
        message: { type: "signal", to: message.to, payload: message.payload },
      }
    }
    case "mediaState": {
      if (
        typeof message.audioEnabled !== "boolean" ||
        typeof message.videoEnabled !== "boolean" ||
        typeof message.screenSharing !== "boolean"
      ) {
        return { ok: false, reason: "malformed" }
      }
      return {
        ok: true,
        message: {
          type: "mediaState",
          audioEnabled: message.audioEnabled,
          videoEnabled: message.videoEnabled,
          screenSharing: message.screenSharing,
        },
      }
    }
    case "chat": {
      if (typeof message.text !== "string") {
        return { ok: false, reason: "malformed" }
      }
      const text = sanitizeChatText(message.text)
      if (text.length === 0) return { ok: false, reason: "messageEmpty" }
      if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
        return { ok: false, reason: "messageTooLong" }
      }
      return { ok: true, message: { type: "chat", text } }
    }
    case "leave":
      return { ok: true, message: { type: "leave" } }
    case "moderate": {
      if (message.action === "kick") {
        if (typeof message.target !== "string" || message.target.length === 0) {
          return { ok: false, reason: "malformed" }
        }
        if (message.target.length > PARTICIPANT_ID_MAX_LENGTH) {
          return { ok: false, reason: "malformed" }
        }
        return { ok: true, message: { type: "moderate", action: "kick", target: message.target } }
      }
      if (message.action === "muteAll") {
        return { ok: true, message: { type: "moderate", action: "muteAll" } }
      }
      return { ok: false, reason: "malformed" }
    }
    default:
      return { ok: false, reason: "malformed" }
  }
}

export function sanitizeDisplayName(value: string): string {
  return truncate(stripUnsafeCharacters(value).replace(/\s+/g, " ").trim(), DISPLAY_NAME_MAX_LENGTH)
}

export function sanitizeChatText(value: string): string {
  return stripUnsafeCharacters(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function isValidDisplayName(value: string): boolean {
  return value.length > 0
}

function truncate(value: string, limit: number): string {
  const points = Array.from(value)
  return points.length <= limit ? value : points.slice(0, limit).join("")
}

function stripUnsafeCharacters(value: string): string {
  let output = ""
  for (const character of value) {
    if (!isUnsafeCharacter(character)) output += character
  }
  return output
}

function isUnsafeCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false
  if (code < 0x20) return true
  if (code === 0x7f) return true
  if (code >= 0x80 && code <= 0x9f) return true
  if (code === 0x200b || code === 0x200e || code === 0x200f) return true
  if (code === 0x2028 || code === 0x2029) return true
  if (code >= 0x202a && code <= 0x202e) return true
  if (code >= 0x2066 && code <= 0x2069) return true
  if (code === 0xfeff) return true
  return false
}

function isSignalPayload(value: unknown): value is Extract<ClientMessage, { type: "signal" }>["payload"] {
  if (typeof value !== "object" || value === null) return false
  const payload = value as Record<string, unknown>
  if (payload.kind === "description") {
    const description = payload.description as Record<string, unknown> | undefined
    if (typeof description !== "object" || description === null) return false
    if (description.type !== "offer" && description.type !== "answer") return false
    if (description.sdp !== undefined) {
      if (typeof description.sdp !== "string") return false
      if (description.sdp.length === 0 || description.sdp.length > SDP_MAX_LENGTH) return false
    }
    return true
  }
  if (payload.kind === "candidate") {
    const candidate = payload.candidate
    if (candidate === null) return true
    if (typeof candidate !== "object" || candidate === null) return false
    const record = candidate as Record<string, unknown>
    if (typeof record.candidate !== "string") return false
    if (record.candidate.length === 0 || record.candidate.length > 4096) return false
    if (record.sdpMid !== null && record.sdpMid !== undefined && typeof record.sdpMid !== "string") {
      return false
    }
    if (
      record.sdpMLineIndex !== null &&
      record.sdpMLineIndex !== undefined &&
      typeof record.sdpMLineIndex !== "number"
    ) {
      return false
    }
    if (
      record.usernameFragment !== null &&
      record.usernameFragment !== undefined &&
      typeof record.usernameFragment !== "string"
    ) {
      return false
    }
    return true
  }
  return false
}
