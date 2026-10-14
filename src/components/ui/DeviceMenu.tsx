"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Mic, Settings2, Video, X } from "lucide-react"
import { IconButton } from "./Button.tsx"
import { Tooltip } from "./Tooltip.tsx"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { mediaManager, type MediaDeviceList } from "@/lib/webrtc/mediaManager.ts"
import { cn } from "@/lib/utils/cn.ts"

export function DeviceMenu({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
}: {
  audioEnabled?: boolean
  videoEnabled?: boolean
  onToggleAudio?: () => void
  onToggleVideo?: () => void
}) {
  const { t } = useI18n()
  const label = t("devices.title")
  const [open, setOpen] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceList>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  })
  const [audioId, setAudioId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const meterRef = useRef<{ context: AudioContext | null; source: MediaStreamAudioSourceNode | null }>({
    context: null,
    source: null,
  })
  const load = useCallback(async () => {
    const selection = mediaManager.getDeviceSelection()
    setAudioId(selection.audioDeviceId)
    setVideoId(selection.videoDeviceId)
    setDevices(await mediaManager.listDevices())
  }, [])
  const stopMeter = useCallback(() => {
    setLevel(0)
    try {
      meterRef.current.source?.disconnect()
    } catch {
      return
    } finally {
      meterRef.current.source = null
      void meterRef.current.context?.close().catch(() => undefined)
      meterRef.current.context = null
    }
  }, [])
  useEffect(() => {
    if (!open) return
    const onChange = () => {
      const selection = mediaManager.getDeviceSelection()
      setAudioId(selection.audioDeviceId)
      setVideoId(selection.videoDeviceId)
      void mediaManager.listDevices().then(setDevices)
    }
    try {
      navigator.mediaDevices?.addEventListener("devicechange", onChange)
    } catch {
      return
    }
    return () => {
      try {
        navigator.mediaDevices?.removeEventListener("devicechange", onChange)
      } catch {
        return
      }
    }
  }, [open, stopMeter])
  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) void load()
    else stopMeter()
  }
  const closePanel = useCallback(() => {
    setOpen(false)
    stopMeter()
  }, [stopMeter])
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) closePanel()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel()
    }
    window.addEventListener("pointerdown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, closePanel])
  async function testMic(deviceId: string | null) {
    stopMeter()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      const context = new AudioContext()
      await context.resume().catch(() => undefined)
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      meterRef.current = { context, source }
      const samples = new Uint8Array(analyser.fftSize)
      const tick = () => {
        if (!meterRef.current.source) {
          for (const track of stream.getTracks()) {
            try {
              track.stop()
            } catch {
              continue
            }
          }
          return
        }
        analyser.getByteTimeDomainData(samples)
        let peak = 0
        for (const sample of samples) {
          const centered = Math.abs(sample - 128) / 128
          if (centered > peak) peak = centered
        }
        setLevel(peak)
        requestAnimationFrame(tick)
      }
      tick()
      window.setTimeout(() => {
        stopMeter()
        for (const track of stream.getTracks()) {
          try {
            track.stop()
          } catch {
            continue
          }
        }
      }, 8000)
    } catch {
      return
    }
  }
  return (
    <div ref={panelRef} className="relative">
      <Tooltip label={label} placement="bottom">
        <IconButton
          label={label}
          size="sm"
          onClick={toggleOpen}
          aria-expanded={open}
          className="border border-line"
        >
          <Settings2 className="size-4" aria-hidden="true" />
        </IconButton>
      </Tooltip>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute end-0 top-full z-50 mt-2 flex max-h-[70dvh] w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-panel border border-line bg-surface p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{label}</h2>
            <IconButton label={t("common.close")} size="sm" onClick={() => closePanel()}>
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={audioEnabled ?? mediaManager.isAudioEnabled()}
              aria-label={t("devices.microphoneEnabled")}
              onClick={() => {
                if (onToggleAudio) onToggleAudio()
                else mediaManager.setAudioEnabled(!mediaManager.isAudioEnabled())
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                (audioEnabled ?? mediaManager.isAudioEnabled())
                  ? "border-accent/50 bg-accent-soft text-ink"
                  : "border-line bg-elevated text-ink-muted",
              )}
            >
              <Mic className="size-4" aria-hidden="true" />
              {t("devices.microphoneEnabled")}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={videoEnabled ?? mediaManager.isVideoEnabled()}
              aria-label={t("devices.cameraEnabled")}
              onClick={() => {
                if (onToggleVideo) onToggleVideo()
                else mediaManager.setVideoEnabled(!mediaManager.isVideoEnabled())
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                (videoEnabled ?? mediaManager.isVideoEnabled())
                  ? "border-accent/50 bg-accent-soft text-ink"
                  : "border-line bg-elevated text-ink-muted",
              )}
            >
              <Video className="size-4" aria-hidden="true" />
              {t("devices.cameraEnabled")}
            </button>
          </div>
          <DeviceGroup
            icon={<Mic className="size-4 text-ink-muted" aria-hidden="true" />}
            title={t("devices.microphone")}
            devices={devices.audioInputs}
            selectedId={audioId}
            fallbackLabel={t("devices.systemDefault")}
            onSelect={(id) => {
              mediaManager.setAudioDeviceId(id)
              setAudioId(id)
            }}
            onTest={(id) => void testMic(id)}
            testLabel={t("devices.test")}
          />
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-100"
                style={{ width: `${Math.round(Math.min(level, 1) * 100)}%` }}
              />
            </div>
          </div>
          <DeviceGroup
            icon={<Video className="size-4 text-ink-muted" aria-hidden="true" />}
            title={t("devices.camera")}
            devices={devices.videoInputs}
            selectedId={videoId}
            fallbackLabel={t("devices.systemDefault")}
            onSelect={(id) => {
              mediaManager.setVideoDeviceId(id)
              setVideoId(id)
            }}
          />
          <p className="text-xs leading-relaxed text-ink-muted">{t("devices.hint")}</p>
        </div>
      ) : null}
    </div>
  )
}

function DeviceGroup({
  icon,
  title,
  devices,
  selectedId,
  fallbackLabel,
  onSelect,
  onTest,
  testLabel,
}: {
  icon: React.ReactNode
  title: string
  devices: MediaDeviceInfo[]
  selectedId: string | null
  fallbackLabel: string
  onSelect: (id: string | null) => void
  onTest?: (id: string | null) => void
  testLabel?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        <DeviceRow
          label={fallbackLabel}
          selected={selectedId === null}
          onSelect={() => {
            onSelect(null)
            onTest?.(null)
          }}
          testLabel={testLabel}
          onTest={onTest ? () => onTest(null) : undefined}
        />
        {devices.map((device, index) => (
          <DeviceRow
            key={device.deviceId || `${device.kind}-${index}`}
            label={device.label || `${title} ${index + 1}`}
            selected={selectedId !== null && device.deviceId === selectedId}
            onSelect={() => {
              onSelect(device.deviceId || null)
              onTest?.(device.deviceId || null)
            }}
            testLabel={testLabel}
            onTest={onTest ? () => onTest(device.deviceId || null) : undefined}
          />
        ))}
      </ul>
    </div>
  )
}

function DeviceRow({
  label,
  selected,
  onSelect,
  onTest,
  testLabel,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  onTest?: () => void
  testLabel?: string
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm transition-colors",
        selected ? "border-accent/50 bg-accent-soft" : "border-line bg-elevated",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 text-start"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
          )}
        >
          {selected ? <Check className="size-3" aria-hidden="true" /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate" dir="auto">
          {label}
        </span>
      </button>
      {onTest && testLabel ? (
        <button
          type="button"
          onClick={onTest}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {testLabel}
        </button>
      ) : null}
    </li>
  )
}

