"use client"

import {
  AudioLines,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { supportsScreenShare } from "@/lib/webrtc/capabilities.ts"
import { IconButton } from "@/components/ui/Button.tsx"
import { Tooltip } from "@/components/ui/Tooltip.tsx"

export type ControlBarProps = {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  audioAvailable: boolean
  videoAvailable: boolean
  noiseSuppression: boolean
  chatOpen: boolean
  participantsOpen: boolean
  unreadCount: number
  participantCount: number
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleNoise: () => void
  onToggleScreenShare: () => void
  onToggleChat: () => void
  onToggleParticipants: () => void
  onLeave: () => void
}

export function ControlBar(props: ControlBarProps) {
  const { t } = useI18n()
  const [fullscreen, setFullscreen] = useState(false)
  const canShare = supportsScreenShare()
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      return
    }
  }
  const audioLabel = props.audioAvailable
    ? props.audioEnabled
      ? t("controls.microphoneOn")
      : t("controls.microphoneOff")
    : t("controls.microphoneUnavailable")
  const videoLabel = props.videoAvailable
    ? props.videoEnabled
      ? t("controls.cameraOn")
      : t("controls.cameraOff")
    : t("controls.cameraUnavailable")
  return (
    <div className="flex w-full justify-center px-3 pb-3 pt-1 sm:pb-4">
      <div
        role="toolbar"
        aria-label={t("room.title")}
        className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-1.5 rounded-panel border border-line bg-surface/95 p-2 shadow-lg backdrop-blur-sm sm:flex-nowrap sm:gap-2"
      >
        <ControlButton
          label={audioLabel}
          pressed={props.audioEnabled}
          disabled={!props.audioAvailable}
          variant={props.audioEnabled ? "secondary" : "danger"}
          onClick={props.onToggleAudio}
        >
          {props.audioEnabled ? (
            <Mic className="size-5" aria-hidden="true" />
          ) : (
            <MicOff className="size-5" aria-hidden="true" />
          )}
        </ControlButton>
        <ControlButton
          label={videoLabel}
          pressed={props.videoEnabled}
          disabled={!props.videoAvailable}
          variant={props.videoEnabled ? "secondary" : "danger"}
          onClick={props.onToggleVideo}
        >
          {props.videoEnabled ? (
            <Video className="size-5" aria-hidden="true" />
          ) : (
            <VideoOff className="size-5" aria-hidden="true" />
          )}
        </ControlButton>
        {canShare ? (
          <ControlButton
            label={props.screenSharing ? t("controls.stopSharing") : t("controls.shareScreen")}
            pressed={props.screenSharing}
            variant={props.screenSharing ? "primary" : "secondary"}
            onClick={props.onToggleScreenShare}
          >
            <MonitorUp className="size-5" aria-hidden="true" />
          </ControlButton>
        ) : null}
        <ControlButton
          label={props.noiseSuppression ? t("controls.noiseOn") : t("controls.noiseOff")}
          pressed={props.noiseSuppression}
          variant={props.noiseSuppression ? "primary" : "secondary"}
          onClick={props.onToggleNoise}
        >
          <AudioLines className="size-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton
          label={props.chatOpen ? t("controls.closeChat") : t("controls.openChat")}
          pressed={props.chatOpen}
          variant={props.chatOpen ? "primary" : "secondary"}
          onClick={props.onToggleChat}
          badge={
            props.unreadCount > 0 && !props.chatOpen ? (
              <Badge value={props.unreadCount > 99 ? "99+" : String(props.unreadCount)} />
            ) : null
          }
        >
          <MessageSquare className="size-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton
          label={props.participantsOpen ? t("controls.closeParticipants") : t("controls.openParticipants")}
          pressed={props.participantsOpen}
          variant={props.participantsOpen ? "primary" : "secondary"}
          onClick={props.onToggleParticipants}
          badge={<Badge value={String(props.participantCount)} />}
        >
          <Users className="size-5" aria-hidden="true" />
        </ControlButton>
        <span className="hidden sm:inline-flex">
          <ControlButton
            label={fullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
            pressed={fullscreen}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? (
              <Minimize2 className="size-5" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-5" aria-hidden="true" />
            )}
          </ControlButton>
        </span>
        <ControlButton
          label={t("controls.leave")}
          pressed={false}
          variant="danger"
          onClick={props.onLeave}
          className="ms-auto sm:ms-1"
        >
          <PhoneOff className="size-5" aria-hidden="true" />
        </ControlButton>
      </div>
    </div>
  )
}

function ControlButton({  label,
  pressed,
  disabled = false,
  variant = "ghost",
  onClick,
  badge = null,
  className,
  children,
}: {
  label: string
  pressed: boolean
  disabled?: boolean
  variant?: "primary" | "secondary" | "ghost" | "danger"
  onClick: () => void
  badge?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <IconButton
        label={label}
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        variant={variant}
        onClick={onClick}
        disabled={disabled}
        className={className ? `relative ${className}` : "relative"}
      >
        {children}
        {badge}
      </IconButton>
    </Tooltip>
  )
}

function Badge({ value }: { value: string }) {
  return (
    <span
      key={value}
      aria-hidden="true"
      className="badge-pop pointer-events-none absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-line bg-surface px-1 text-[0.65rem] font-semibold tabular-nums text-ink shadow-sm"
    >
      {value}
    </span>
  )
}
