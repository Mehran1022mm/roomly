"use client"

import { useState } from "react"
import { Megaphone, MicOff, ShieldCheck, Star, ChevronDown, ChevronUp, X } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { useRoomStore } from "@/lib/store/useRoomStore.ts"
import { IconButton } from "@/components/ui/Button.tsx"
import { Tooltip } from "@/components/ui/Tooltip.tsx"
import { cn } from "@/lib/utils/cn.ts"

export function ModerationIsland({
  onMuteAll,
  onAnnounce,
  onKick,
}: {
  onMuteAll: () => void
  onAnnounce: (text: string) => void
  onKick: (target: string) => void
}) {
  const { t } = useI18n()
  const participants = useRoomStore((state) => state.participants)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState("")
  const [kickArmed, setKickArmed] = useState(false)
  const list = Object.values(participants)
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    onAnnounce(text)
    setDraft("")
  }
  return (
    <div className="pointer-events-none flex w-full justify-center px-3 pt-1">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-1.5 rounded-panel border border-accent/40 bg-surface/95 px-2.5 py-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
            {t("moderation.title")}
          </span>
          <span className="flex-1" />
          <Tooltip label={t("moderation.muteAll")}>
            <IconButton label={t("moderation.muteAll")} size="sm" variant="secondary" onClick={onMuteAll}>
              <MicOff className="size-4" aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip label={expanded ? t("moderation.hide") : t("moderation.show")}>
            <IconButton
              label={expanded ? t("moderation.hide") : t("moderation.show")}
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronUp className="size-4" aria-hidden="true" />
              )}
            </IconButton>
          </Tooltip>
        </div>
        {expanded ? (
          <div className="panel-pop flex flex-col gap-2">
            <form onSubmit={submit} className="flex items-center gap-2">
              <label htmlFor="island-announce" className="sr-only">
                {t("moderation.announcePlaceholder")}
              </label>
              <input
                id="island-announce"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("moderation.announcePlaceholder")}
                dir="auto"
                className="field-control h-9 text-sm"
              />
              <IconButton
                type="submit"
                variant="primary"
                label={t("moderation.announce")}
                disabled={draft.trim().length === 0}
              >
                <Megaphone className="size-4" aria-hidden="true" />
              </IconButton>
            </form>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setKickArmed((current) => !current)}
                aria-expanded={kickArmed}
                className="self-start text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t("admin.kick")} ({list.length})
              </button>
              {kickArmed ? (
                <ul className="scroll-area flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {list.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex items-center gap-2 rounded-lg bg-elevated px-2 py-1.5 text-sm"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1 truncate" dir="auto">
                        <span className="min-w-0 flex-1 truncate">{participant.displayName}</span>
                        {participant.isAdmin ? (
                          <Star
                            className="size-3 shrink-0 fill-accent text-accent"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => onKick(participant.id)}
                        aria-label={`${t("admin.kick")} ${participant.displayName}`}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full",
                          "text-ink-muted transition-colors hover:bg-danger hover:text-danger-ink",
                        )}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
