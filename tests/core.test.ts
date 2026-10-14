import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createAdminToken, verifyAdminToken } from "../server/adminAuth.ts"
import { createSessionToken, verifySessionToken, matchesSecret } from "../server/auth.ts"
import { parseClientMessage, sanitizeDisplayName } from "../server/validate.ts"
import { createRateLimiter } from "../server/ratelimit.ts"
import { Room } from "../server/room.ts"
import { solveLayout, fitBox } from "../src/lib/layout/grid.ts"
import { translate } from "../src/lib/i18n/translate.ts"
import { en } from "../src/lib/i18n/dictionaries/en.ts"

describe("auth", () => {
  it("issues and verifies tokens", () => {
    const token = createSessionToken("abc", "secret123", 1000)
    assert.equal(verifySessionToken(token, "secret123", 2000), "abc")
  })
  it("rejects expired tokens", () => {
    const token = createSessionToken("abc", "secret123", 1000)
    assert.equal(verifySessionToken(token, "secret123", 1000 + 13 * 3600 * 1000), null)
  })
  it("rejects wrong secret", () => {
    const token = createSessionToken("abc", "secret123", 1000)
    assert.equal(verifySessionToken(token, "other", 2000), null)
  })
  it("rejects empty id payloads", () => {
    const bad = `${Buffer.from(JSON.stringify({ id: "", expiresAt: 9999 }), "utf8").toString("base64url")}.x`
    assert.equal(verifySessionToken(bad, "secret123", 1000), null)
  })
  it("compares secrets", () => {
    assert.equal(matchesSecret("pw", "pw"), true)
    assert.equal(matchesSecret("pw", "other"), false)
  })
})

describe("admin", () => {
  it("issues and verifies admin tokens", () => {
    const token = createAdminToken("secret123", 1000)
    assert.equal(verifyAdminToken(token, "secret123", 2000), true)
    assert.equal(verifyAdminToken(token, "wrong", 2000), false)
  })
})

describe("validate", () => {
  it("parses chat", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "chat", text: "hello" }))
    assert.equal(parsed.ok, true)
  })
  it("rejects malformed signal", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "signal", to: "", payload: {} }))
    assert.equal(parsed.ok, false)
  })
  it("rejects oversized sdp", () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        type: "signal",
        to: "peer",
        payload: { kind: "description", description: { type: "offer", sdp: "x".repeat(20000) } },
      }),
    )
    assert.equal(parsed.ok, false)
  })
  it("strips bidi overrides from names", () => {
    assert.equal(sanitizeDisplayName("a‮b").includes("‮"), false)
  })
  it("parses moderation actions", () => {
    const kick = parseClientMessage(JSON.stringify({ type: "moderate", action: "kick", target: "peer-1" }))
    assert.equal(kick.ok, true)
    const muteAll = parseClientMessage(JSON.stringify({ type: "moderate", action: "muteAll" }))
    assert.equal(muteAll.ok, true)
    const bad = parseClientMessage(JSON.stringify({ type: "moderate", action: "kick", target: "" }))
    assert.equal(bad.ok, false)
  })
})

describe("ratelimit", () => {
  it("enforces limits", () => {
    let now = 0
    const limiter = createRateLimiter(2, 1000, 10, () => now)
    assert.equal(limiter.allow("k"), true)
    assert.equal(limiter.allow("k"), true)
    assert.equal(limiter.allow("k"), false)
    now = 2000
    assert.equal(limiter.allow("k"), true)
    limiter.stop()
  })
})

describe("room", () => {
  it("enforces resume without duplicate join", () => {
    const joins: string[] = []
    const room = new Room(2, {
      onJoin: (p) => joins.push(p.id),
      onLeave: () => undefined,
      onEvict: () => undefined,
    })
    const fake = { readyState: 1 } as never
    room.add("id-1", "Alice", fake)
    assert.equal(room.isFull(), false)
    assert.equal(room.canAccept("id-1"), true)
    room.scheduleDisconnect("id-1", fake)
    assert.equal(room.canAccept("id-1"), true)
    const resumed = room.add("id-1", "Alice", fake)
    assert.equal(resumed.resumed, true)
    assert.equal(joins.length, 1)
  })
})

describe("layout", () => {
  it("solves grid", () => {
    const layout = solveLayout(4, 800, 600)
    assert.ok(layout.columns >= 1)
    assert.ok(layout.rowHeight > 0)
    const box = fitBox(800, 600)
    assert.ok(box.width > 0)
  })
})

describe("i18n", () => {
  it("pluralizes", () => {
    assert.equal(translate(en, "en", "participants.count", { count: 1 }), "1 person")
    assert.equal(translate(en, "en", "participants.count", { count: 5 }), "5 people")
  })
})

describe("config", () => {
  it("keeps multiple stun urls in order", async () => {
    process.env.STUN_SERVER = "stun:a:19302,stun:b:19302"
    process.env.ROOM_PASSWORD = "test-password-123"
    process.env.AUTH_SECRET = "test-secret"
    delete process.env.SELF_STUN
    const { loadConfig } = await import("../server/config.ts")
    const config = loadConfig(true)
    assert.deepEqual(config.stunUrls, ["stun:a:19302", "stun:b:19302"])
    assert.deepEqual(config.iceServers[0]?.urls, ["stun:a:19302", "stun:b:19302"])
    delete process.env.STUN_SERVER
    delete process.env.ROOM_PASSWORD
    delete process.env.AUTH_SECRET
  })
  it("prepends self stun only when enabled", async () => {
    process.env.ROOM_PASSWORD = "test-password-123"
    process.env.AUTH_SECRET = "test-secret"
    delete process.env.STUN_SERVER
    process.env.SELF_STUN = "1"
    process.env.SELF_STUN_HOST = "meet.example.com"
    const { loadConfig } = await import("../server/config.ts")
    const config = loadConfig(true)
    assert.equal(config.stunUrls[0], "stun:meet.example.com:3478")
    assert.ok(config.stunUrls.length > 1)
    delete process.env.SELF_STUN
    delete process.env.SELF_STUN_HOST
    delete process.env.ROOM_PASSWORD
    delete process.env.AUTH_SECRET
  })
})
