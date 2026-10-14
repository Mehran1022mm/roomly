"use client"

import { LoaderCircle, WifiOff } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import type { TranslationKey } from "@/lib/i18n/translate.ts"
import type { SocketStatus } from "@/lib/signaling/client.ts"
import { cn } from "@/lib/utils/cn.ts"

const STATUS_KEYS: Record<SocketStatus, TranslationKey> = {
  connected: "status.connected",
  connecting: "status.connecting",
  reconnecting: "status.reconnecting",
  disconnected: "status.disconnected",
}

export function ConnectionStatus({ status }: { status: SocketStatus }) {
  const { t } = useI18n()
  if (status === "connected") return null
  return (
    <div className="pointer-events-none flex justify-center px-3 pt-1">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm",
          status === "disconnected"
            ? "border-danger/40 bg-danger-soft text-danger"
            : "border-line bg-surface/90 text-ink",
        )}
      >
        {status === "disconnected" ? (
          <WifiOff className="size-3.5" aria-hidden="true" />
        ) : (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        )}
        <span>{t(STATUS_KEYS[status])}</span>
      </div>
    </div>
  )
}
