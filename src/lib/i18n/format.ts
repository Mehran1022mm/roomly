import { formatTagOf, type Locale } from "./locales.ts"

export type Formatters = {
  time: (timestamp: number) => string
  date: (timestamp: number) => string
  dayKey: (timestamp: number) => string
}

const cache = new Map<Locale, Formatters>()

export function getFormatters(locale: Locale): Formatters {
  const cached = cache.get(locale)
  if (cached) return cached

  const tag = formatTagOf(locale)
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hour12: false })
  const date = new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", day: "numeric" })
  const dayKey = new Intl.DateTimeFormat(tag, { year: "numeric", month: "2-digit", day: "2-digit" })

  const formatters: Formatters = {
    time: (timestamp) => time.format(timestamp),
    date: (timestamp) => date.format(timestamp),
    dayKey: (timestamp) => dayKey.format(timestamp),
  }

  cache.set(locale, formatters)
  return formatters
}
