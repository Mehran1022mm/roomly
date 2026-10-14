export const PROTOCOL_VERSION = 1

export const SIGNAL_PATH = "/ws"

export const DISPLAY_NAME_MAX_LENGTH = 32

export const CHAT_MESSAGE_MAX_LENGTH = 1000

export const PARTICIPANT_ID_MAX_LENGTH = 128

export const SDP_MAX_LENGTH = 16384

export type ErrorCode =
  | "wrongPassword"
  | "roomFull"
  | "invalidName"
  | "messageTooLong"
  | "messageEmpty"
  | "rateLimited"
  | "unauthorized"
  | "serverError"
  | "replaced"

export type ParticipantView = {
  id: string
  displayName: string
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  isAdmin: boolean
}

export type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  sentAt: number
}

export type SessionDescriptionPayload = {
  type: "offer" | "answer"
  sdp?: string
}

export type IceCandidatePayload = {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
  usernameFragment: string | null
}

export type SignalPayload =
  | { kind: "description"; description: SessionDescriptionPayload }
  | { kind: "candidate"; candidate: IceCandidatePayload | null }

export type IceServerConfig = {
  urls: string[]
  username?: string
  credential?: string
}

export type ClientMessage =
  | { type: "join"; displayName: string; password: string; token?: string }
  | { type: "signal"; to: string; payload: SignalPayload }
  | {
      type: "mediaState"
      audioEnabled: boolean
      videoEnabled: boolean
      screenSharing: boolean
    }
  | { type: "chat"; text: string }
  | { type: "leave" }
  | { type: "moderate"; action: "kick"; target: string }
  | { type: "moderate"; action: "muteAll" }

export type ServerMessage =
  | {
      type: "joined"
      self: ParticipantView
      participants: ParticipantView[]
      iceServers: IceServerConfig[]
      token: string
      version: number
    }
  | { type: "peerJoined"; participant: ParticipantView }
  | { type: "peerLeft"; id: string }
  | { type: "signal"; from: string; payload: SignalPayload }
  | { type: "mediaState"; participant: ParticipantView }
  | { type: "chat"; message: ChatMessage }
  | { type: "adminMute" }
  | { type: "error"; code: ErrorCode }
