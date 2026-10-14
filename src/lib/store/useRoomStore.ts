import { create } from "zustand"
import type { ChatMessage, ErrorCode, ParticipantView } from "../../../shared/protocol.ts"
import type { SocketStatus } from "../signaling/client.ts"

export type RemoteParticipant = ParticipantView & {
  streamReady: boolean
  speaking: boolean
}

export type LocalMediaState = {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  audioAvailable: boolean
  videoAvailable: boolean
  noiseSuppression: boolean
}

export type Announcement = {
  id: string
  text: string
  senderName: string
}

type RoomState = {
  status: SocketStatus
  selfId: string | null
  displayName: string
  selfIsAdmin: boolean
  participants: Record<string, RemoteParticipant>
  messages: ChatMessage[]
  unreadCount: number
  chatOpen: boolean
  participantsOpen: boolean
  local: LocalMediaState
  activeSpeakerId: string | null
  banner: ErrorCode | null
  announcement: Announcement | null
  setStatus: (status: SocketStatus) => void
  setSelf: (selfId: string, displayName: string, isAdmin?: boolean) => void
  setParticipants: (participants: ParticipantView[]) => void
  addParticipant: (participant: ParticipantView) => void
  removeParticipant: (peerId: string) => void
  updateParticipantMedia: (participant: ParticipantView) => void
  setStreamReady: (peerId: string, ready: boolean) => void
  setActiveSpeaker: (peerId: string | null) => void
  setLocalMedia: (state: Partial<LocalMediaState>) => void
  addMessage: (message: ChatMessage) => void
  setChatOpen: (open: boolean) => void
  setParticipantsOpen: (open: boolean) => void
  setBanner: (banner: ErrorCode | null) => void
  clearAnnouncement: () => void
  reset: () => void
}

const MAX_MESSAGES = 200

function freshLocalMedia(): LocalMediaState {
  return {
    audioEnabled: true,
    videoEnabled: false,
    screenSharing: false,
    audioAvailable: true,
    videoAvailable: true,
    noiseSuppression: readNoisePreference(),
  }
}

function freshState() {
  return {
    status: "connecting" as SocketStatus,
    selfId: null as string | null,
    displayName: "",
    selfIsAdmin: false,
    participants: {} as Record<string, RemoteParticipant>,
    messages: [] as ChatMessage[],
    unreadCount: 0,
    chatOpen: false,
    participantsOpen: false,
    local: freshLocalMedia(),
    activeSpeakerId: null as string | null,
    banner: null as ErrorCode | null,
    announcement: null as Announcement | null,
  }
}

const NOISE_STORAGE_KEY = "roomly_noise"

function readNoisePreference(): boolean {
  try {
    return window.localStorage.getItem(NOISE_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function writeNoisePreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(NOISE_STORAGE_KEY, enabled ? "on" : "off")
  } catch {
    return
  }
}

export const useRoomStore = create<RoomState>((set) => ({
  ...freshState(),
  setStatus: (status) => set({ status }),
  setSelf: (selfId, displayName, isAdmin = false) => set({ selfId, displayName, selfIsAdmin: isAdmin }),
  setParticipants: (participants) =>
    set((state) => {
      const next: Record<string, RemoteParticipant> = {}
      for (const participant of participants) {
        const existing = state.participants[participant.id]
        next[participant.id] = {
          ...participant,
          streamReady: existing?.streamReady ?? false,
          speaking: state.activeSpeakerId === participant.id,
        }
      }
      return { participants: next }
    }),
  addParticipant: (participant) =>
    set((state) => {
      if (state.participants[participant.id]) {
        const existing = state.participants[participant.id]
        if (!existing) return state
        return {
          participants: {
            ...state.participants,
            [participant.id]: { ...existing, ...participant },
          },
        }
      }
      return {
        participants: {
          ...state.participants,
          [participant.id]: { ...participant, streamReady: false, speaking: false },
        },
      }
    }),
  removeParticipant: (peerId) =>
    set((state) => {
      if (!state.participants[peerId]) return state
      const participants = { ...state.participants }
      delete participants[peerId]
      return {
        participants,
        activeSpeakerId: state.activeSpeakerId === peerId ? null : state.activeSpeakerId,
      }
    }),
  updateParticipantMedia: (participant) =>
    set((state) => {
      const existing = state.participants[participant.id]
      if (!existing) return state
      return {
        participants: {
          ...state.participants,
          [participant.id]: {
            ...existing,
            displayName: participant.displayName,
            audioEnabled: participant.audioEnabled,
            videoEnabled: participant.videoEnabled,
            screenSharing: participant.screenSharing,
            isAdmin: participant.isAdmin,
          },
        },
      }
    }),
  setStreamReady: (peerId, ready) =>
    set((state) => {
      const existing = state.participants[peerId]
      if (!existing || existing.streamReady === ready) return state
      return {
        participants: { ...state.participants, [peerId]: { ...existing, streamReady: ready } },
      }
    }),
  setActiveSpeaker: (peerId) =>
    set((state) => {
      if (state.activeSpeakerId === peerId) return state
      const participants = { ...state.participants }
      if (state.activeSpeakerId && participants[state.activeSpeakerId]) {
        const previous = participants[state.activeSpeakerId]
        if (previous) participants[state.activeSpeakerId] = { ...previous, speaking: false }
      }
      if (peerId && participants[peerId]) {
        const current = participants[peerId]
        if (current) participants[peerId] = { ...current, speaking: true }
      }
      return { activeSpeakerId: peerId, participants }
    }),
  setLocalMedia: (partial) => set((current) => ({ local: { ...current.local, ...partial } })),
  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((item) => item.id === message.id)) return state
      const senderIsAdmin =
        message.senderId === "admin" ||
        (message.senderId === state.selfId && state.selfIsAdmin) ||
        state.participants[message.senderId]?.isAdmin === true
      return {
        messages: [...state.messages, message].slice(-MAX_MESSAGES),
        unreadCount:
          state.chatOpen || message.senderId === state.selfId
            ? state.unreadCount
            : state.unreadCount + 1,
        announcement: senderIsAdmin
          ? { id: message.id, text: message.text, senderName: message.senderName }
          : state.announcement,
      }
    }),
  setChatOpen: (open) =>
    set((state) => ({ chatOpen: open, unreadCount: open ? 0 : state.unreadCount })),
  setParticipantsOpen: (open) => set({ participantsOpen: open }),
  setBanner: (banner) => set({ banner }),
  clearAnnouncement: () => set({ announcement: null }),
  reset: () => set({ ...freshState() }),
}))
