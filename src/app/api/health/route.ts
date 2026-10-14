import { APP_VERSION } from "../../../../shared/appMeta.ts"

export function GET() {
  return Response.json(
    { status: "ok", version: APP_VERSION, uptime: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } },
  )
}
