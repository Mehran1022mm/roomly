import { createMessageId } from "../../../../../server/auth.ts"
import { sharedRoom } from "../../../../../server/signaling.ts"
import { readAdmin } from "../guard.ts"

export async function POST(request: Request) {
  if (!(await readAdmin())) {
    return Response.json({ ok: false }, { status: 401 })
  }
  let text = ""
  try {
    const body: unknown = await request.json()
    if (typeof body === "object" && body !== null) {
      const candidate = (body as { text?: unknown }).text
      if (typeof candidate === "string") text = candidate.trim()
    }
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  if (!text || text.length > 1000) return Response.json({ ok: false }, { status: 400 })
  const room = sharedRoom()
  if (!room) return Response.json({ ok: false }, { status: 503 })
  room.broadcast({
    type: "chat",
    message: {
      id: createMessageId(),
      senderId: "admin",
      senderName: "Admin",
      text,
      sentAt: Date.now(),
    },
  })
  return Response.json({ ok: true })
}
