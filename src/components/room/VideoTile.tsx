"use client"

import { memo, useEffect, useMemo, useRef } from "react"
import { MicOff, MonitorUp, Star } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { cn } from "@/lib/utils/cn.ts"
import { mediaManager } from "@/lib/webrtc/mediaManager.ts"
import { getRemoteStream } from "@/lib/webrtc/remoteStreams.ts"

export type VideoTileProps = {
  participantId: string
  displayName: string
  isLocal: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  speaking: boolean
  streamReady: boolean
  isAdmin: boolean
  className?: string
  fill?: boolean
}

export const VideoTile = memo(function VideoTile({
  participantId,
  displayName,
  isLocal,
  audioEnabled,
  videoEnabled,
  screenSharing,
  speaking,
  streamReady,
  isAdmin,
  className,
  fill = false,
}: VideoTileProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const visibleVideo = (videoEnabled || screenSharing) && (isLocal || streamReady)
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    const stream = isLocal
      ? screenSharing
        ? mediaManager.getScreenStream()
        : mediaManager.getCameraStream()
      : getRemoteStream(participantId)
    element.srcObject = visibleVideo ? stream : null
    if (visibleVideo && stream) {
      element.muted = isLocal || stream.getAudioTracks().length === 0
      void element.play().catch(() => undefined)
    }
  }, [participantId, isLocal, visibleVideo, screenSharing, streamReady])
  const initials = useMemo(() => initialsOf(displayName), [displayName])
  const stateLabel = !audioEnabled
    ? t("room.mutedBadge")
    : screenSharing
      ? t("room.screenBadge")
      : displayName
  return (
    <article
      aria-label={isLocal ? `${displayName} (${t("common.you")})` : displayName}
      className={cn(
        "relative overflow-hidden rounded-tile bg-tile text-tile-ink",
        fill ? "size-full" : "aspect-video w-full",
        speaking && "ring-2 ring-accent ring-offset-2 ring-offset-canvas",
        className,
      )}
    >
      <video
        ref={videoRef}
        muted={isLocal}
        playsInline
        autoPlay
        aria-label={stateLabel}
        className={cn(
          "size-full object-cover",
          isLocal && !screenSharing && "-scale-x-100",
          visibleVideo ? "opacity-100" : "opacity-0",
        )}
      />
      {!visibleVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-tile">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-tile-ink/10 text-lg font-semibold text-tile-ink/90 sm:size-14 sm:text-xl"
          >
            {initials}
          </span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-inline-0 bottom-0 flex justify-start p-2">
        <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-black/45 py-1 pe-2 ps-2.5 text-tile-ink shadow-sm backdrop-blur-sm">
          <span className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm" dir="auto">
            {displayName}
          </span>
          {isLocal ? (
            <span className="shrink-0 text-[0.65rem] text-tile-ink/70">({t("common.you")})</span>
          ) : null}
          {isAdmin ? (
            <Star className="size-3 shrink-0 fill-amber-300 text-amber-300" aria-label={t("room.adminBadge")} role="img" />
          ) : null}
          {screenSharing ? (
            <MonitorUp className="size-3 shrink-0" aria-label={t("room.screenBadge")} role="img" />
          ) : null}
          {!audioEnabled ? (
            <MicOff className="size-3 shrink-0" aria-label={t("room.mutedBadge")} role="img" />
          ) : null}
        </span>
      </div>
    </article>
  )
})

export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) {
    const single = parts[0] ?? ""
    return Array.from(single).slice(0, 2).join("").toUpperCase()
  }
  const first = Array.from(parts[0] ?? "")[0] ?? ""
  const last = Array.from(parts[parts.length - 1] ?? "")[0] ?? ""
  return `${first}${last}`.toUpperCase()
}
