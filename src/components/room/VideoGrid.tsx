"use client"

import { useCallback, useEffect, useMemo, useState, type RefCallback } from "react"
import { useRoomStore } from "@/lib/store/useRoomStore.ts"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { fitBox, GRID_GAP, solveLayout, type FittedBox, type GridLayout } from "@/lib/layout/grid.ts"
import { VideoTile } from "./VideoTile.tsx"

type Size = { width: number; height: number }

export type { FittedBox, GridLayout } from "@/lib/layout/grid.ts"
export { fitBox, solveLayout } from "@/lib/layout/grid.ts"

function useElementSize(measure: (size: Size) => void): RefCallback<HTMLDivElement> {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!element) return
    let disposed = false
    const run = () => {
      if (disposed) return
      measure({ width: element.clientWidth, height: element.clientHeight })
    }
    run()
    const frame = window.requestAnimationFrame(run)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run)
    observer?.observe(element)
    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [element, measure])
  return setElement
}

export function useGridLayout(count: number): {
  layout: GridLayout
  hostRef: RefCallback<HTMLDivElement>
} {
  const [layout, setLayout] = useState<GridLayout>({ columns: 1, rows: 0, rowHeight: 0 })
  const measure = useCallback(
    ({ width, height }: Size) => {
      const next = solveLayout(count, width, height)
      setLayout((current) =>
        current.columns === next.columns &&
        current.rows === next.rows &&
        Math.abs(current.rowHeight - next.rowHeight) < 1
          ? current
          : next,
      )
    },
    [count],
  )
  return { layout, hostRef: useElementSize(measure) }
}

export function useFittedBox(): { box: FittedBox; hostRef: RefCallback<HTMLDivElement> } {
  const [box, setBox] = useState<FittedBox>({ width: 0, height: 0 })
  const measure = useCallback(({ width, height }: Size) => {
    const next = fitBox(width, height)
    setBox((current) =>
      Math.abs(current.width - next.width) < 1 && Math.abs(current.height - next.height) < 1
        ? current
        : next,
    )
  }, [])
  return { box, hostRef: useElementSize(measure) }
}

export type ParticipantTileData = {
  participantId: string
  displayName: string
  isLocal: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  speaking: boolean
  streamReady: boolean
  isAdmin: boolean
}

export function VideoGrid({ tiles }: { tiles: ParticipantTileData[] }) {
  const { layout, hostRef } = useGridLayout(tiles.length)
  const { t } = useI18n()
  if (tiles.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-tile border border-dashed border-line p-6 text-center text-sm text-ink-muted">
        {t("participants.empty")}
      </div>
    )
  }
  return (
    <div
      ref={hostRef}
      role="list"
      aria-label={String(tiles.length)}
      className="grid min-h-0 flex-1 content-center"
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gridTemplateRows:
          layout.rowHeight > 0 ? `repeat(${layout.rows}, ${Math.floor(layout.rowHeight)}px)` : undefined,
        gap: GRID_GAP,
      }}
    >
      {tiles.map((tile) => (
        <div key={tile.participantId} role="listitem" className="min-h-0 min-w-0">
          <VideoTile {...tile} fill />
        </div>
      ))}
    </div>
  )
}

export function useParticipantTiles(): ParticipantTileData[] {
  const selfId = useRoomStore((state) => state.selfId)
  const displayName = useRoomStore((state) => state.displayName)
  const selfIsAdmin = useRoomStore((state) => state.selfIsAdmin)
  const local = useRoomStore((state) => state.local)
  const activeSpeakerId = useRoomStore((state) => state.activeSpeakerId)
  const participants = useRoomStore((state) => state.participants)
  return useMemo(() => {
    const tiles: ParticipantTileData[] = []
    if (selfId) {
      tiles.push({
        participantId: selfId,
        displayName,
        isLocal: true,
        audioEnabled: local.audioEnabled,
        videoEnabled: local.videoEnabled,
        screenSharing: local.screenSharing,
        speaking: activeSpeakerId === selfId,
        streamReady: true,
        isAdmin: selfIsAdmin,
      })
    }
    for (const participant of Object.values(participants)) {
      tiles.push({
        participantId: participant.id,
        displayName: participant.displayName,
        isLocal: false,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        screenSharing: participant.screenSharing,
        speaking: participant.speaking,
        streamReady: participant.streamReady,
        isAdmin: participant.isAdmin,
      })
    }
    return tiles
  }, [selfId, displayName, selfIsAdmin, local, activeSpeakerId, participants])
}
