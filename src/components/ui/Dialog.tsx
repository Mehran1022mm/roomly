"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { IconButton } from "./Button.tsx"

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { t } = useI18n()
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      ref.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open ])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <IconButton label={t("common.close")} size="sm" onClick={onClose} className="-me-1 -mt-1">
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        {description ? (
          <p id={descriptionId} className="text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2">{children}</div>
      </div>
    </dialog>
  )
}
