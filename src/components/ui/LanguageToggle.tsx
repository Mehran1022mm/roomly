"use client"

import { Languages } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import type { Locale } from "@/lib/i18n/locales.ts"
import { IconButton } from "./Button.tsx"
import { Tooltip } from "./Tooltip.tsx"

const LABELS: Record<Locale, string> = {
  fa: "فارسی",
  en: "English",
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const label = t("controls.changeLanguage")
  const next: Locale = locale === "fa" ? "en" : "fa"
  const fullLabel = `${label} · ${LABELS[next]}` 
  return (
    <Tooltip label={fullLabel} placement="bottom">
      <IconButton
        label={fullLabel}
        size="sm"
        onClick={() => setLocale(next)}
        className="border border-line"
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="sr-only">{LABELS[next]}</span>
      </IconButton>
    </Tooltip>
  )
}
