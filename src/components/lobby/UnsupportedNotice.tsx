"use client"

import { BrandMark } from "@/components/ui/Notice.tsx"
import { Button } from "@/components/ui/Button.tsx"
import { LanguageToggle } from "@/components/ui/LanguageToggle.tsx"
import { ThemeToggle } from "@/components/ui/ThemeToggle.tsx"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { CAPABILITY_LABELS } from "@/lib/webrtc/capabilities.ts"
import { useCapabilities } from "@/lib/webrtc/useCapabilities.ts"

export function UnsupportedNotice() {
  const { t } = useI18n()
  const report = useCapabilities()
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex w-full max-w-md flex-col gap-5 rounded-panel border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold">{t("unsupported.title")}</h1>
            <p className="text-sm leading-relaxed text-ink-muted">{t("unsupported.body")}</p>
          </div>
          <ul className="flex flex-col gap-1.5" aria-label={t("unsupported.title")}>
            {report.missing.map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                <span dir="ltr" className="font-mono text-xs">
                  {CAPABILITY_LABELS[key]}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" block onClick={() => window.location.reload()}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    </main>
  )
}
