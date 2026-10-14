import { loadConfig } from "../../../../../server/config.ts"
import { sharedRoom } from "../../../../../server/signaling.ts"
import { APP_VERSION } from "../../../../../shared/appMeta.ts"
import { readAdmin } from "../guard.ts"

export async function GET() {
  if (!(await readAdmin())) {
    return Response.json({ ok: false }, { status: 401 })
  }
  const config = loadConfig(process.env.NODE_ENV !== "production")
  const room = sharedRoom()
  return Response.json(
    {
      ok: true,
      version: APP_VERSION,
      uptime: Math.round(process.uptime()),
      connected: room?.connectedCount() ?? 0,
      reserved: room?.reservedCount() ?? 0,
      maxUsers: config.maxUsers,
      stunUrls: config.stunUrls,
      turnConfigured: config.turnConfigured,
      participants: room?.listViews() ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
