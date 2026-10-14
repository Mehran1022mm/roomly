"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Megaphone, X } from "lucide-react"
import { Button } from "@/components/ui/Button.tsx"
import { DeviceMenu } from "@/components/ui/DeviceMenu.tsx"
import { Dialog } from "@/components/ui/Dialog.tsx"
import { LanguageToggle } from "@/components/ui/LanguageToggle.tsx"
import { ThemeToggle } from "@/components/ui/ThemeToggle.tsx"
import { NoticeList, type NoticeItem } from "@/components/ui/Notice.tsx"
import { ModerationIsland } from "./ModerationIsland.tsx"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { ERROR_KEYS } from "@/lib/meeting/errors.ts"
import { MeetingSession, type MeetingNotice } from "@/lib/meeting/MeetingSession.ts"
import { clearSession, readSession, type RoomSession } from "@/lib/meeting/session.ts"
import { useRoomStore } from "@/lib/store/useRoomStore.ts"
import { ChatPanel } from "./ChatPanel.tsx"
import { ConnectionStatus } from "./ConnectionStatus.tsx"
import { ControlBar } from "./ControlBar.tsx"
import { ParticipantsPanel } from "./ParticipantsPanel.tsx"
import { VideoGrid, useFittedBox, useParticipantTiles, type ParticipantTileData } from "./VideoGrid.tsx"
import { VideoTile } from "./VideoTile.tsx"

export function RoomView({ session }: { session: RoomSession }) {
  const { t } = useI18n()
  const router = useRouter()
  const status = useRoomStore((state) => state.status)
  const selfId = useRoomStore((state) => state.selfId)
  const displayName = useRoomStore((state) => state.displayName)
  const selfIsAdmin = useRoomStore((state) => state.selfIsAdmin)
  const local = useRoomStore((state) => state.local)
  const messages = useRoomStore((state) => state.messages)
  const unreadCount = useRoomStore((state) => state.unreadCount)
  const chatOpen = useRoomStore((state) => state.chatOpen)
  const participantsOpen = useRoomStore((state) => state.participantsOpen)
  const participants = useRoomStore((state) => state.participants)
  const banner = useRoomStore((state) => state.banner)
  const announcement = useRoomStore((state) => state.announcement)
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const [leaving, setLeaving] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const meetingRef = useRef<MeetingSession | null>(null)
  const tiles = useParticipantTiles()
  const sessionId = session.id
  const sessionDisplayName = session.displayName
  const pushNotice = useCallback((notice: MeetingNotice) => {
    setNotices((current) => [
      ...current.filter((item) => item.id !== notice.id).slice(-4),
      { id: notice.id, tone: notice.tone, message: notice.message },
    ])
  }, [])
  useEffect(() => {
    const meeting = new MeetingSession({
      identity: { id: sessionId, displayName: sessionDisplayName },
      getToken: () => readSession()?.token ?? "",
      onNotice: pushNotice,
      onFatal: () => {
        clearSession()
        router.replace("/")
      },
    })
    meetingRef.current = meeting
    void meeting.start()
    return () => {
      meeting.stop()
      meetingRef.current = null
    }
  }, [sessionId, sessionDisplayName, pushNotice, router])
  const leave = useCallback(() => {
    clearSession()
    meetingRef.current?.stop({ announceLeave: true })
    router.replace("/")
  }, [router])
  const presenters = tiles.filter((tile) => tile.screenSharing)
  const presenter = presenters.length > 0 ? presenters[0] : null
  const filmstrip = presenter
    ? tiles.filter((tile) => tile.participantId !== presenter.participantId)
    : []
  const panelOpen = chatOpen || participantsOpen
  const visibleNotices = useMemo<NoticeItem[]>(
    () =>
      banner === null
        ? notices
        : [...notices, { id: "banner", tone: "danger", message: ERROR_KEYS[banner] } as NoticeItem].slice(-5),
    [banner, notices],
  )
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-canvas">
      <a
        href="#meeting-controls"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("controls.leave")}
      </a>
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight" dir="auto">
          {t("room.title")}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <DeviceMenu
            audioEnabled={local.audioEnabled}
            videoEnabled={local.videoEnabled}
            onToggleAudio={() => meetingRef.current?.toggleAudio()}
            onToggleVideo={() => meetingRef.current?.toggleVideo()}
          />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <ConnectionStatus status={status} />
      {announcement ? (
        <div className="flex justify-center px-3 pt-1">
          <div
            role="alert"
            className="notice-pop flex w-full max-w-2xl items-start gap-2 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2 text-sm text-ink shadow-sm"
          >
            <Megaphone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words" dir="auto">
              <span className="font-semibold">{announcement.senderName}: </span>
              {announcement.text}
            </p>
            <button
              type="button"
              onClick={() => useRoomStore.getState().clearAnnouncement()}
              aria-label={t("announcement.dismiss")}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      <NoticeList
        items={visibleNotices}
        onDismiss={(id) => {
          if (id === "banner") useRoomStore.getState().setBanner(null)
          else setNotices((current) => current.filter((item) => item.id !== id))
        }}
        className="mx-3 mb-1 max-h-32 overflow-y-auto sm:mx-4"
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section aria-label={t("room.title")} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {presenter && presenter.participantId ? (
            <ScreenShareLayout presenter={presenter} filmstrip={filmstrip} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3">
              <VideoGrid tiles={tiles} />
            </div>
          )}
          <div id="meeting-controls">
            {selfIsAdmin ? (
              <ModerationIsland
                onMuteAll={() => meetingRef.current?.muteEveryone()}
                onAnnounce={(text) => meetingRef.current?.sendChatMessage(text)}
                onKick={(target) => meetingRef.current?.kickParticipant(target)}
              />
            ) : null}
            <ControlBar
              audioEnabled={local.audioEnabled}
              videoEnabled={local.videoEnabled}
              screenSharing={local.screenSharing}
              audioAvailable={local.audioAvailable}
              videoAvailable={local.videoAvailable}
              noiseSuppression={local.noiseSuppression}
              chatOpen={chatOpen}
              participantsOpen={participantsOpen}
              unreadCount={unreadCount}
              participantCount={tiles.length}
              onToggleAudio={() => meetingRef.current?.toggleAudio()}
              onToggleVideo={() => meetingRef.current?.toggleVideo()}
              onToggleNoise={() => void meetingRef.current?.toggleNoiseSuppression()}
              onToggleScreenShare={() => void meetingRef.current?.toggleScreenShare()}
              onToggleChat={() => {
                const state = useRoomStore.getState()
                const next = !state.chatOpen
                state.setChatOpen(next)
                if (next) state.setParticipantsOpen(false)
              }}
              onToggleParticipants={() => {
                const state = useRoomStore.getState()
                const next = !state.participantsOpen
                state.setParticipantsOpen(next)
                if (next) state.setChatOpen(false)
              }}
              onLeave={() => setLeaving(true)}
            />
          </div>
        </section>
        {panelOpen ? (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[68dvh] border-t border-line bg-surface shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:border-s lg:border-t-0 lg:shadow-none">
            <div className="h-[68dvh] lg:h-full">
              {chatOpen ? (
                <ChatPanel
                  messages={messages}
                  selfId={selfId}
                  sendError={chatError}
                  onClose={() => useRoomStore.getState().setChatOpen(false)}
                  onSend={(text) => {
                    const ok = meetingRef.current?.sendChatMessage(text) ?? false
                    if (!ok) {
                      setChatError(t("errors.rateLimited"))
                      window.setTimeout(() => setChatError(null), 3000)
                    }
                    return ok
                  }}
                />
              ) : (
                <ParticipantsPanel
                  selfName={displayName}
                  selfIsAdmin={selfIsAdmin}
                  local={local}
                  participants={Object.values(participants)}
                  onClose={() => useRoomStore.getState().setParticipantsOpen(false)}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
      <Dialog
        open={leaving}
        onClose={() => setLeaving(false)}
        title={t("leave.title")}
        description={t("leave.body")}
      >
        <Button onClick={() => setLeaving(false)}>{t("leave.cancel")}</Button>
        <Button variant="danger" onClick={leave}>
          {t("leave.confirm")}
        </Button>
      </Dialog>
    </main>
  )
}

function ScreenShareLayout({
  presenter,
  filmstrip,
}: {
  presenter: ParticipantTileData
  filmstrip: ParticipantTileData[]
}) {
  const { box, hostRef } = useFittedBox()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5 sm:p-3 lg:flex-row lg:gap-3">
      <div ref={hostRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <div style={{ width: box.width, height: box.height }}>
          <VideoTile {...presenter} fill />
        </div>
      </div>
      {filmstrip.length > 0 ? (
        <div
          role="list"
          className="scroll-area flex min-h-0 shrink-0 gap-2 overflow-x-auto pb-1 lg:w-44 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
        >
          {filmstrip.map((tile) => (
            <div key={tile.participantId} role="listitem" className="w-32 shrink-0 lg:w-full">
              <VideoTile {...tile} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
