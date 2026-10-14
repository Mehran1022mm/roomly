"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { en, type Dictionary } from "./dictionaries/en.ts"
import { fa } from "./dictionaries/fa.ts"
import { getFormatters, type Formatters } from "./format.ts"
import { directionOf, LOCALE_COOKIE, type Locale } from "./locales.ts"
import { translate, type TranslationKey, type TranslationParams } from "./translate.ts"
import { runTransition, syncMotionPreference } from "@/lib/theme/theme.ts"

const dictionaries: Record<Locale, Dictionary> = { fa, en }

export type I18nContextValue = {
  locale: Locale
  t: (key: TranslationKey, params?: TranslationParams) => string
  formatters: Formatters
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  useEffect(() => syncMotionPreference(), [])
  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = directionOf(locale)
  }, [locale])
  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      const root = document.documentElement
      root.style.setProperty("--slide-sign", directionOf(next) === "rtl" ? "1" : "-1")
      runTransition(() => setLocaleState(next), "slide")
    },
    [locale],
  )
  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale]
    return {
      locale,
      formatters: getFormatters(locale),
      setLocale,
      t: (key, params) => translate(dictionary, locale, key, params),
    }
  }, [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within I18nProvider")
  return context
}
