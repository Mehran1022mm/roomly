"use client"

import { Mic, MicOff, Star, Users, Video, VideoOff } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { initialsOf } from "./VideoTile.tsx"
import { cn } from "@/lib/utils/cn.ts"
import type { RemoteParticipant } from "@/lib/store/useRoomStore.ts"
import { Panel } from "./Panel.tsx"

export function ParticipantsPanel({
  selfName,
  selfIsAdmin,
  local,
  participants,
  onClose,
}: {
  selfName: string
  selfIsAdmin: boolean
  local: { audioEnabled: boolean; videoEnabled: boolean }
  participants: RemoteParticipant[]
  onClose: () => void
}) {
  const { t } = useI18n()
  const total = participants.length + 1
  return (
    <Panel
      panelKey="participants"
      label={t("participants.title")}
      title={
        <>
          <Users className="size-4 text-ink-muted" aria-hidden="true" />
          {t("participants.title")}
          <span className="text-xs font-normal text-ink-muted">
            {t("participants.count", { count: total })}
          </span>
        </>
      }
      onClose={onClose}
      closeLabel={t("controls.closeParticipants")}
      footer={
        total === 1 ? (
          <p className="border-t border-line bg-elevated/50 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            {t("participants.empty")}
          </p>
        ) : undefined
      }
    >
      <ul className="scroll-area flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        <ParticipantRow
          name={selfName}
          isSelf
          isAdmin={selfIsAdmin}
          audioEnabled={local.audioEnabled}
          videoEnabled={local.videoEnabled}
        />
        {participants.map((participant) => (
          <ParticipantRow
            key={participant.id}
            name={participant.displayName}
            isAdmin={participant.isAdmin}
            audioEnabled={participant.audioEnabled}
            videoEnabled={participant.videoEnabled}
            speaking={participant.speaking}
          />
        ))}
      </ul>
    </Panel>
  )
}

function ParticipantRow({
  name,
  audioEnabled,
  videoEnabled,
  speaking = false,
  isSelf = false,
  isAdmin = false,
}: {
  name: string
  audioEnabled: boolean
  videoEnabled: boolean
  speaking?: boolean
  isSelf?: boolean
  isAdmin?: boolean
}) {
  const { t } = useI18n()
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2 py-2",
        speaking && "bg-accent-soft",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          speaking ? "bg-accent text-accent-ink" : "bg-elevated text-ink-muted",
        )}
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm" dir="auto">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {isAdmin ? (
          <Star
            className="size-3.5 shrink-0 fill-accent text-accent"
            aria-label={t("room.adminBadge")}
            role="img"
          />
        ) : null}
        {isSelf ? <span className="shrink-0 text-ink-muted"> ({t("common.you")})</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5" role="img" aria-label={`${audioEnabled ? t("common.on") : t("common.off")}, ${videoEnabled ? t("common.on") : t("common.off")}`}>
        {audioEnabled ? (
          <Mic className="size-3.5 text-ink-muted" aria-hidden="true" />
        ) : (
          <MicOff className="size-3.5 text-danger" aria-hidden="true" />
        )}
        {videoEnabled ? (
          <Video className="size-3.5 text-ink-muted" aria-hidden="true" />
        ) : (
          <VideoOff className="size-3.5 text-ink-muted" aria-hidden="true" />
        )}
      </span>
    </li>
  )
}
