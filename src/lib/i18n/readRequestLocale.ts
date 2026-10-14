import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales.ts"

export async function readRequestLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  if (isLocale(value)) return value
  const headerList = await headers()
  const accepted = headerList.get("accept-language") ?? ""
  for (const part of accepted.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? ""
    if (tag.startsWith("fa")) return "fa"
    if (tag.startsWith("en")) return "en"
  }
  return DEFAULT_LOCALE
}
