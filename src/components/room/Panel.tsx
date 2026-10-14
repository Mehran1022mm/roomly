"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { IconButton } from "@/components/ui/Button.tsx"
import { cn } from "@/lib/utils/cn.ts"

export function Panel({
  panelKey,
  label,
  title,
  onClose,
  closeLabel,
  children,
  footer,
}: {
  panelKey: string
  label: string
  title: ReactNode
  onClose: () => void
  closeLabel: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <aside
      aria-label={label}
      className="flex h-full min-h-0 w-full flex-col border-line bg-surface sm:w-80 sm:border-s"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">{title}</h2>
        <IconButton label={closeLabel} size="sm" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </header>
      <div key={panelKey} className={cn("panel-pop flex min-h-0 flex-1 flex-col")}>
        {children}
      </div>
      {footer}
    </aside>
  )
}
