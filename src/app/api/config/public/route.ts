import { loadConfig } from "../../../../../server/config.ts"
import { APP_VERSION } from "../../../../../shared/appMeta.ts"

export async function GET() {
  const config = loadConfig(process.env.NODE_ENV !== "production")
  return Response.json(
    {
      version: APP_VERSION,
      maxUsers: config.maxUsers,
      stunCount: config.stunUrls.length,
      turnConfigured: config.turnConfigured,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
