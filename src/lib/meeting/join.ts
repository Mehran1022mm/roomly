import type { ErrorCode } from "../../../shared/protocol.ts"
import { buildSignalUrl, SignalClient } from "../signaling/client.ts"
import { writeSession, type RoomSession } from "./session.ts"

const JOIN_TIMEOUT_MS = 12000

export type JoinResult = { ok: true; session: RoomSession } | { ok: false; error: ErrorCode }

export function joinRoom(displayName: string, password: string): Promise<JoinResult> {
  return new Promise((resolve) => {
    let settled = false
    const controller = new AbortController()
    const finish = (result: JoinResult) => {
      if (settled) return
      settled = true
      controller.abort()
      window.clearTimeout(timer)
      client.close()
      resolve(result)
    }
    const client = new SignalClient({
      url: buildSignalUrl(window.location),
      onStatus: () => undefined,
      onOpen: () => {
        client.send({ type: "join", displayName, password })
      },
      onMessage: (message) => {
        if (message.type === "joined") {
          const session: RoomSession = {
            id: message.self.id,
            token: message.token,
            displayName: message.self.displayName,
          }
          writeSession(session)
          finish({ ok: true, session })
          return
        }
        if (message.type === "error") {
          finish({ ok: false, error: message.code })
        }
      },
    })
    const timer = window.setTimeout(() => {
      finish({ ok: false, error: "serverError" })
    }, JOIN_TIMEOUT_MS)
    controller.signal.addEventListener("abort", () => {
      window.clearTimeout(timer)
    })
    client.connect()
  })
}
