import { sharedRoom } from "../../../../../server/signaling.ts"
import { readAdmin } from "../guard.ts"

export async function POST(request: Request) {
  if (!(await readAdmin())) {
    return Response.json({ ok: false }, { status: 401 })
  }
  let id = ""
  try {
    const body: unknown = await request.json()
    if (typeof body === "object" && body !== null) {
      const candidate = (body as { id?: unknown }).id
      if (typeof candidate === "string") id = candidate
    }
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  if (!id) return Response.json({ ok: false }, { status: 400 })
  const room = sharedRoom()
  if (!room) return Response.json({ ok: false }, { status: 503 })
  const removed = room.remove(id)
  return Response.json({ ok: removed !== null })
}
