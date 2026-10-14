import { WebSocket } from "ws"
import type { ParticipantView, ServerMessage } from "../shared/protocol.ts"

export type Participant = ParticipantView & {
  socket: WebSocket
  connected: boolean
  announceTimer: NodeJS.Timeout | null
  reservationTimer: NodeJS.Timeout | null
}

export const DISCONNECT_ANNOUNCE_MS = 5000
export const RESERVATION_MS = 45000

export type RoomEvents = {
  onJoin: (participant: Participant) => void
  onLeave: (participant: Participant) => void
  onEvict: (participant: Participant) => void
}

export type AddResult = {
  participant: Participant
  resumed: boolean
}

export class Room {
  private readonly participants = new Map<string, Participant>()
  private readonly maxUsers: number
  private readonly events: RoomEvents

  constructor(maxUsers: number, events: RoomEvents) {
    this.maxUsers = maxUsers
    this.events = events
  }

  isFull(): boolean {
    let connected = 0
    for (const participant of this.participants.values()) {
      if (participant.connected) connected += 1
      if (connected >= this.maxUsers) return true
    }
    return false
  }

  connectedCount(): number {
    let connected = 0
    for (const participant of this.participants.values()) {
      if (participant.connected) connected += 1
    }
    return connected
  }

  reservedCount(): number {
    return this.participants.size
  }

  has(id: string): boolean {
    return this.participants.has(id)
  }

  get(id: string): Participant | null {
    return this.participants.get(id) ?? null
  }

  listViews(): ParticipantView[] {
    const views: ParticipantView[] = []
    for (const participant of this.participants.values()) {
      if (participant.connected) views.push(toView(participant))
    }
    return views
  }

  canAccept(id: string): boolean {
    const existing = this.participants.get(id)
    if (existing && existing.connected === false) return true
    return !this.isFull()
  }

  add(id: string, displayName: string, socket: WebSocket, isAdmin = false): AddResult {
    const previous = this.participants.get(id)
    if (previous && previous.connected === false) {
      clearTimers(previous)
      const participant: Participant = {
        id,
        displayName: previous.displayName,
        audioEnabled: previous.audioEnabled,
        videoEnabled: previous.videoEnabled,
        screenSharing: previous.screenSharing,
        isAdmin: previous.isAdmin || isAdmin,
        socket,
        connected: true,
        announceTimer: null,
        reservationTimer: null,
      }
      this.participants.set(id, participant)
      return { participant, resumed: true }
    }
    if (previous) {
      clearTimers(previous)
      if (isSocketOpen(previous.socket)) this.events.onEvict(previous)
    }
    const participant: Participant = {
      id,
      displayName,
      audioEnabled: previous?.audioEnabled ?? true,
      videoEnabled: previous?.videoEnabled ?? false,
      screenSharing: previous?.screenSharing ?? false,
      isAdmin: (previous?.isAdmin ?? false) || isAdmin,
      socket,
      connected: true,
      announceTimer: null,
      reservationTimer: null,
    }
    this.participants.set(id, participant)
    this.events.onJoin(participant)
    return { participant, resumed: false }
  }

  scheduleDisconnect(id: string, socket: WebSocket): void {
    const participant = this.participants.get(id)
    if (!participant || participant.socket !== socket || !participant.connected) return
    clearTimers(participant)
    participant.connected = false
    participant.announceTimer = startTimer(DISCONNECT_ANNOUNCE_MS, () => {
      const current = this.participants.get(id)
      if (!current || current.connected) return
      this.events.onLeave(current)
    })
    participant.reservationTimer = startTimer(RESERVATION_MS, () => {
      this.remove(id)
    })
  }

  remove(id: string, socket?: WebSocket): Participant | null {
    const participant = this.participants.get(id)
    if (!participant) return null
    if (socket && participant.socket !== socket) return null
    clearTimers(participant)
    this.participants.delete(id)
    if (participant.connected) this.events.onLeave(participant)
    return participant
  }

  broadcast(message: ServerMessage, exceptId?: string): void {
    const payload = JSON.stringify(message)
    for (const participant of this.participants.values()) {
      if (!participant.connected || participant.id === exceptId) continue
      send(participant.socket, payload)
    }
  }
}

export function send(socket: WebSocket, payload: string): boolean {
  if (!isSocketOpen(socket)) return false
  try {
    socket.send(payload)
    return true
  } catch {
    return false
  }
}

export function toView(participant: Participant): ParticipantView {
  return {
    id: participant.id,
    displayName: participant.displayName,
    audioEnabled: participant.audioEnabled,
    videoEnabled: participant.videoEnabled,
    screenSharing: participant.screenSharing,
    isAdmin: participant.isAdmin,
  }
}

function isSocketOpen(socket: WebSocket): boolean {
  return socket.readyState === WebSocket.OPEN
}

function startTimer(delay: number, run: () => void): NodeJS.Timeout {
  const timer = setTimeout(run, delay)
  timer.unref()
  return timer
}

function clearTimers(participant: Participant): void {
  if (participant.announceTimer) clearTimeout(participant.announceTimer)
  if (participant.reservationTimer) clearTimeout(participant.reservationTimer)
  participant.announceTimer = null
  participant.reservationTimer = null
}
