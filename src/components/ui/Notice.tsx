"use client"

import { useEffect } from "react"
import { AlertCircle, AlertTriangle, Info, ShieldCheck, Video, X } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import type { TranslationKey } from "@/lib/i18n/translate.ts"
import { cn } from "@/lib/utils/cn.ts"

export type NoticeTone = "info" | "warning" | "danger"

export type NoticeItem = {
  id: string
  tone: NoticeTone
  message: TranslationKey
}

const MAX_VISIBLE = 3
const INFO_DISMISS_MS = 6000

const toneIcons = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
}

export function NoticeList({
  items,
  onDismiss,
  className,
}: {
  items: NoticeItem[]
  onDismiss?: (id: string) => void
  className?: string
}) {
  const { t } = useI18n()
  useEffect(() => {
    if (!onDismiss) return
    const timers = items
      .filter((item) => item.tone === "info")
      .map((item) => window.setTimeout(() => onDismiss(item.id), INFO_DISMISS_MS))
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [items, onDismiss])
  if (items.length === 0) return null
  const visible = items.slice(-MAX_VISIBLE)
  const hiddenCount = items.length - visible.length
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {hiddenCount > 0 ? (
        <li
          aria-hidden="true"
          className="self-center rounded-full bg-elevated px-2.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-ink-muted"
        >
          +{hiddenCount}
        </li>
      ) : null}
      {visible.map((item) => {
        const Icon = toneIcons[item.tone]
        return (
          <li
            key={item.id}
            role="status"
            className={cn(
              "notice-pop flex items-stretch gap-0 overflow-hidden rounded-xl border border-line bg-surface text-sm shadow-sm",
              item.tone === "danger" && "border-danger/40",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "w-1 shrink-0",
                item.tone === "danger" && "bg-danger",
                item.tone === "warning" && "bg-accent",
                item.tone === "info" && "bg-line-strong",
              )}
            />
            <Icon
              aria-hidden="true"
              className={cn(
                "ms-2.5 mt-2.5 size-4 shrink-0",
                item.tone === "danger" && "text-danger",
                item.tone === "warning" && "text-accent",
                item.tone === "info" && "text-ink-muted",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 break-words px-2 py-2",
                item.tone === "danger" ? "text-danger" : "text-ink",
              )}
            >
              {t(item.message)}
            </span>
            {onDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                aria-label={t("common.close")}
                className="flex w-9 shrink-0 items-center justify-center self-stretch text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function BrandMark() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
        <Video className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-semibold tracking-tight">{t("app.name")}</span>
        <span className="text-xs text-ink-muted">{t("app.tagline")}</span>
      </div>
    </div>
  )
}

export function PrivacyNote() {
  const { t } = useI18n()
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{t("lobby.privacyNote")}</span>
    </p>
  )
}
