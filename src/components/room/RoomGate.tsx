"use client"

import { LoaderCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { RoomView } from "./RoomView.tsx"
import { useRoomSession } from "@/lib/meeting/useRoomSession.ts"

export function RoomGate() {
  const session = useRoomSession()
  const { t } = useI18n()
  if (!session) {
    return (
      <main
        role="status"
        aria-label={t("lobby.joining")}
        className="flex h-dvh flex-col items-center justify-center gap-3 bg-canvas"
      >
        <LoaderCircle className="size-6 animate-spin text-ink-muted" aria-hidden="true" />
        <p className="text-sm text-ink-muted">{t("lobby.joining")}</p>
      </main>
    )
  }
  return <RoomView session={session} />
}
