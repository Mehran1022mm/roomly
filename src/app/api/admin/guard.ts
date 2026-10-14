import { cookies } from "next/headers"
import { verifyAdminToken } from "../../../../server/adminAuth.ts"
import { loadConfig } from "../../../../server/config.ts"

export async function readAdmin(): Promise<boolean> {
  const config = loadConfig(process.env.NODE_ENV !== "production")
  if (!config.adminEnabled || !config.adminPassword) return false
  const store = await cookies()
  const token = store.get("roomly_admin")?.value ?? ""
  if (!token) return false
  return verifyAdminToken(token, config.authSecret, Date.now())
}
