"use client"

import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { APP_VERSION } from "../../../shared/appMeta.ts"

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="flex items-center justify-center gap-1.5 px-4 pb-5 text-xs text-ink-muted">
      <span dir="ltr">Roomly v{APP_VERSION}</span>
      <span aria-hidden="true">·</span>
      <span>
        © {new Date().getFullYear()} Mehran1022 · {t("footer.rights")}
      </span>
    </footer>
  )
}
