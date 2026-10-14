export const LOCALES = ["fa", "en"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fa"

export const LOCALE_COOKIE = "roomly_locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr"
}

export function baseTagOf(locale: Locale): "fa" | "en" {
  return locale === "fa" ? "fa" : "en"
}

export function formatTagOf(locale: Locale): string {
  return locale === "fa" ? "fa-IR-u-nu-latn" : "en-US"
}
