import type {
  ErrorCode,
  IceServerConfig,
  ServerMessage,
} from "../../../shared/protocol.ts"
import type { TranslationKey } from "../i18n/translate.ts"
import { buildSignalUrl, SignalClient, type SocketStatus } from "../signaling/client.ts"
import { useRoomStore, writeNoisePreference } from "../store/useRoomStore.ts"
import { mediaManager } from "../webrtc/mediaManager.ts"
import { clearRemoteStreams, deleteRemoteStream, setRemoteStream } from "../webrtc/remoteStreams.ts"
import { ActiveSpeakerDetector } from "../webrtc/activeSpeaker.ts"
import { permissionMessageKey } from "../webrtc/mediaErrors.ts"
import { PeerManager } from "../webrtc/peerManager.ts"
import { clearSession, writeSession, type RoomSession } from "./session.ts"

export type MeetingNotice = {
  id: string
  tone: "info" | "warning" | "danger"
  message: TranslationKey
}

export type MeetingSessionOptions = {
  identity: Pick<RoomSession, "id" | "displayName">
  getToken: () => string
  onNotice: (notice: MeetingNotice) => void
  onFatal: () => void
}

export class MeetingSession {
  private readonly store = useRoomStore
  private readonly client: SignalClient
  private peers: PeerManager | null = null
  private detector: ActiveSpeakerDetector | null = null
  private unsubscribeScreenShare: (() => void) | null = null
  private started = false
  private holdsMedia = false
  private recoveringMedia = false
  private joined = false
  private pendingMedia: { audioEnabled?: boolean; videoEnabled?: boolean } | null = null
  private readonly options: MeetingSessionOptions

  constructor(options: MeetingSessionOptions) {
    this.options = options
    this.client = new SignalClient({
      url: buildSignalUrl(window.location),
      onStatus: (status) => this.handleStatus(status),
      onOpen: () => this.handleOpen(),
      onMessage: (message) => this.handleMessage(message),
    })
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    this.store.getState().setSelf(this.options.identity.id, this.options.identity.displayName)
    this.unsubscribeScreenShare = mediaManager.subscribeToScreenShare(() => {
      void this.afterScreenShareChanged()
    })
    try {
      await this.startMedia()
    } catch {
      if (!this.started) return
      this.options.onNotice({
        id: "media",
        tone: "warning",
        message: "permissions.microphoneUnavailable",
      })
    }
    if (!this.started) return
    this.client.connect()
  }

  stop(options: { announceLeave?: boolean } = {}): void {
    if (!this.started) return
    this.started = false
    this.joined = false
    this.pendingMedia = null
    this.unsubscribeScreenShare?.()
    this.unsubscribeScreenShare = null
    if (options.announceLeave) this.client.send({ type: "leave" })
    this.peers?.close()
    this.peers = null
    this.detector?.stop()
    this.detector = null
    this.client.close()
    if (this.holdsMedia) {
      this.holdsMedia = false
      mediaManager.release()
    }
    clearRemoteStreams()
    this.store.getState().reset()
  }

  toggleAudio(): void {
    if (this.recoveringMedia) return
    if (!mediaManager.hasAudioDevice()) {
      void this.recoverMedia()
      return
    }
    const enabled = mediaManager.setAudioEnabled(!mediaManager.isAudioEnabled())
    this.publishMediaState({ audioEnabled: enabled })
  }

  toggleVideo(): void {
    if (this.recoveringMedia) return
    if (!mediaManager.hasVideoDevice() && !mediaManager.isScreenSharing()) {
      void this.recoverMedia()
      return
    }
    const enabled = mediaManager.setVideoEnabled(!mediaManager.isVideoEnabled())
    this.publishMediaState({ videoEnabled: enabled })
  }

  private async recoverMedia(): Promise<void> {
    if (this.recoveringMedia) return
    this.recoveringMedia = true
    try {
      const result = await mediaManager.retryMedia()
      if (!this.started) return
      this.store.getState().setLocalMedia({
        audioEnabled: result.audioEnabled,
        videoEnabled: result.videoEnabled,
        audioAvailable: mediaManager.hasAudioDevice(),
        videoAvailable: mediaManager.hasVideoDevice(),
      })
      if (result.audioFailure) {
        this.options.onNotice({
          id: "audio",
          tone: "warning",
          message: permissionMessageKey("microphone", result.audioFailure),
        })
      }
      if (result.videoFailure && !result.videoEnabled) {
        this.options.onNotice({
          id: "video",
          tone: "warning",
          message: permissionMessageKey("camera", result.videoFailure),
        })
      }
      this.publishMediaState({})
      this.attachLocalDetector()
    } finally {
      this.recoveringMedia = false
    }
  }

  async toggleNoiseSuppression(): Promise<void> {
    const next = !mediaManager.isNoiseSuppressionEnabled()
    const ok = await mediaManager.setNoiseSuppression(next)
    if (!this.started) return
    if (ok) {
      this.store.getState().setLocalMedia({ noiseSuppression: next })
      writeNoisePreference(next)
    } else {
      this.options.onNotice({
        id: "noise",
        tone: "warning",
        message: "permissions.microphoneBusy",
      })
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (mediaManager.isScreenSharing()) {
      mediaManager.stopScreenShare()
      return
    }
    const result = await mediaManager.startScreenShare()
    if (!this.started) return
    if (!result.stream && result.failure) {
      this.options.onNotice({
        id: "screen-share",
        tone: "warning",
        message: "permissions.screenShareUnavailable",
      })
    }
  }

  sendChatMessage(text: string): boolean {
    return this.client.send({ type: "chat", text })
  }

  kickParticipant(target: string): void {
    this.client.send({ type: "moderate", action: "kick", target })
  }

  muteEveryone(): void {
    this.client.send({ type: "moderate", action: "muteAll" })
  }

  private async startMedia(): Promise<void> {
    mediaManager.retain()
    this.holdsMedia = true
    const result = await mediaManager.start()
    if (!this.started) return
    const wantedNoise = this.store.getState().local.noiseSuppression
    if (!wantedNoise) {
      await mediaManager.setNoiseSuppression(false)
    }
    this.store.getState().setLocalMedia({
      audioEnabled: result.audioEnabled,
      videoEnabled: result.videoEnabled,
      audioAvailable: mediaManager.hasAudioDevice(),
      videoAvailable: mediaManager.hasVideoDevice(),
    })
    if (result.audioFailure) {
      this.options.onNotice({
        id: "audio",
        tone: "warning",
        message: permissionMessageKey("microphone", result.audioFailure),
      })
    }
    if (result.videoFailure) {
      this.options.onNotice({
        id: "video",
        tone: "warning",
        message: permissionMessageKey("camera", result.videoFailure),
      })
    }
    this.detector = new ActiveSpeakerDetector((speakerId) => {
      this.store.getState().setActiveSpeaker(speakerId)
    })
    this.attachLocalDetector()
  }

  private attachLocalDetector(): void {
    const selfId = this.store.getState().selfId ?? this.options.identity.id
    const stream = mediaManager.getCameraStream()
    if (stream && selfId) this.detector?.setLocalParticipant(selfId, stream)
  }

  private handleStatus(status: SocketStatus): void {
    if (!this.started) return
    this.store.getState().setStatus(status)
  }

  private handleOpen(): void {
    if (!this.started) return
    this.joined = false
    this.client.send({
      type: "join",
      displayName: this.options.identity.displayName,
      password: "",
      token: this.options.getToken(),
    })
  }

  private handleMessage(message: ServerMessage): void {
    if (!this.started) return
    switch (message.type) {
      case "joined":
        this.handleJoined(message)
        return
      case "peerJoined":
        this.store.getState().addParticipant(message.participant)
        this.peers?.ensurePeer(message.participant.id)
        return
      case "peerLeft":
        this.store.getState().removeParticipant(message.id)
        this.peers?.removePeer(message.id)
        this.detector?.remove(message.id)
        deleteRemoteStream(message.id)
        return
      case "signal":
        void this.peers?.handleSignal(message.from, message.payload)
        return
      case "mediaState":
        this.store.getState().updateParticipantMedia(message.participant)
        return
      case "chat":
        this.store.getState().addMessage(message.message)
        return
      case "adminMute":
        this.applyAdminMute()
        return
      case "error":
        this.handleError(message.code)
        return
    }
  }

  private applyAdminMute(): void {
    if (!this.started) return
    mediaManager.setAudioEnabled(false)
    this.store.getState().setLocalMedia({ audioEnabled: false })
    this.publishMediaState({})
    this.options.onNotice({ id: "admin-mute", tone: "info", message: "moderation.mutedByAdmin" })
  }

  private handleJoined(message: Extract<ServerMessage, { type: "joined" }>): void {
    writeSession({
      id: message.self.id,
      token: message.token,
      displayName: message.self.displayName,
    })
    const peerIds = [message.self.id, ...message.participants.map((participant) => participant.id)]
    const store = this.store.getState()
    store.setSelf(message.self.id, message.self.displayName, message.self.isAdmin)
    store.setParticipants(message.participants)
    const activeSpeakerId = this.store.getState().activeSpeakerId
    if (activeSpeakerId !== null && !peerIds.includes(activeSpeakerId)) {
      store.setActiveSpeaker(null)
    }
    this.detector?.retain(peerIds)
    clearRemoteStreams()
    this.peers?.close()
    this.peers = new PeerManager({
      selfId: message.self.id,
      iceServers: toRtcIceServers(message.iceServers),
      sendSignal: (to, payload) => {
        this.client.send({ type: "signal", to, payload })
      },
      getAudioTrack: () => mediaManager.getAudioTrack(),
      getVideoTrack: () => mediaManager.getOutgoingVideoTrack(),
      onStream: (peerId, stream) => {
        if (!stream) return
        setRemoteStream(peerId, stream)
        this.store.getState().setStreamReady(peerId, true)
        this.detector?.add(peerId, stream)
      },
      onPeerFailed: (peerId) => {
        this.options.onNotice({
          id: `peer-${peerId}`,
          tone: "warning",
          message: "errors.connectionFailed",
        })
      },
    })
    for (const participant of message.participants) this.peers.ensurePeer(participant.id)
    this.joined = true
    if (this.pendingMedia) {
      const pending = this.pendingMedia
      this.pendingMedia = null
      this.publishMediaState(pending)
    } else {
      this.publishMediaState({})
    }
    this.attachLocalDetector()
  }

  private handleError(code: ErrorCode): void {
    if (code === "unauthorized" || code === "wrongPassword" || code === "replaced") {
      clearSession()
      this.options.onFatal()
      return
    }
    this.store.getState().setBanner(code)
  }

  private async afterScreenShareChanged(): Promise<void> {
    if (!this.started) return
    await this.peers?.syncOutgoingTracks()
    if (!this.started) return
    this.publishMediaState({})
  }

  private publishMediaState(overrides: { audioEnabled?: boolean; videoEnabled?: boolean }): void {
    if (!this.joined) {
      this.pendingMedia = { ...this.pendingMedia, ...overrides }
      const screenSharing = mediaManager.isScreenSharing()
      const audioEnabled = overrides.audioEnabled ?? mediaManager.isAudioEnabled()
      const videoEnabled = screenSharing
        ? false
        : (overrides.videoEnabled ?? mediaManager.isVideoEnabled())
      this.store.getState().setLocalMedia({ audioEnabled, videoEnabled, screenSharing })
      return
    }
    const screenSharing = mediaManager.isScreenSharing()
    const audioEnabled = overrides.audioEnabled ?? mediaManager.isAudioEnabled()
    const videoEnabled = screenSharing
      ? false
      : (overrides.videoEnabled ?? mediaManager.isVideoEnabled())
    this.store.getState().setLocalMedia({ audioEnabled, videoEnabled, screenSharing })
    void this.peers?.syncOutgoingTracks()
    this.client.send({ type: "mediaState", audioEnabled, videoEnabled, screenSharing })
  }
}

function toRtcIceServers(servers: IceServerConfig[]): RTCIceServer[] {
  return servers.map((server) => {
    const config: RTCIceServer = { urls: server.urls }
    if (server.username !== undefined) config.username = server.username
    if (server.credential !== undefined) config.credential = server.credential
    return config
  })
}
