import type { IceCandidatePayload, SignalPayload } from "../../../shared/protocol.ts"

export type PeerManagerOptions = {
  selfId: string
  iceServers: RTCIceServer[]
  sendSignal: (to: string, payload: SignalPayload) => void
  getAudioTrack: () => MediaStreamTrack | null
  getVideoTrack: () => MediaStreamTrack | null
  onStream: (peerId: string, stream: MediaStream | null) => void
  onPeerFailed: (peerId: string) => void
  onPeerRecovered?: (peerId: string) => void
}

type PeerEntry = {
  id: string
  connection: RTCPeerConnection
  stream: MediaStream | null
  audioSender: RTCRtpSender
  videoSender: RTCRtpSender
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  applyingRemoteAnswer: boolean
  hasRemoteDescription: boolean
  failedNotified: boolean
  pendingSignals: SignalPayload[]
}

const MAX_PENDING_SIGNALS = 20
const INITIAL_OFFER_DELAY_MS = 250

export class PeerManager {
  private readonly peers = new Map<string, PeerEntry>()
  private closed = false
  private readonly options: PeerManagerOptions

  constructor(options: PeerManagerOptions) {
    this.options = options
  }

  getStream(peerId: string): MediaStream | null {
    return this.peers.get(peerId)?.stream ?? null
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId)
  }

  ensurePeer(peerId: string): void {
    if (this.closed || this.peers.has(peerId)) return
    const entry = this.createEntry(peerId)
    this.peers.set(peerId, entry)
    if (!entry.polite) {
      window.setTimeout(() => {
        if (this.closed || !this.peers.has(peerId)) return
        if (!entry.hasRemoteDescription) void this.negotiate(entry)
      }, INITIAL_OFFER_DELAY_MS)
    }
    this.flushPending(entry)
  }

  removePeer(peerId: string): void {
    const entry = this.peers.get(peerId)
    if (!entry) return
    this.peers.delete(peerId)
    const { connection } = entry
    connection.ontrack = null
    connection.onicecandidate = null
    connection.onnegotiationneeded = null
    connection.onconnectionstatechange = null
    try {
      connection.close()
    } catch {
      return
    }
  }

  clear(): void {
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId)
  }

  close(): void {
    this.closed = true
    this.clear()
  }

  async handleSignal(from: string, payload: SignalPayload): Promise<void> {
    const entry = this.peers.get(from)
    if (!entry) return
    if (this.closed) return
    if (!entry.hasRemoteDescription && payload.kind === "candidate") {
      if (entry.pendingSignals.length < MAX_PENDING_SIGNALS) entry.pendingSignals.push(payload)
      return
    }
    if (payload.kind === "description") {
      await this.applyDescription(entry, payload.description)
      this.flushPending(entry)
      return
    }
    try {
      await entry.connection.addIceCandidate(
        payload.candidate ? toIceCandidate(payload.candidate) : undefined,
      )
    } catch {
      return
    }
  }

  async syncOutgoingTracks(): Promise<void> {
    if (this.closed) return
    const audioTrack = this.safeAudioTrack()
    const videoTrack = this.safeVideoTrack()
    await Promise.allSettled(
      [...this.peers.values()].map(async (entry) => {
        try {
          await entry.audioSender.replaceTrack(audioTrack)
        } catch {
          return
        }
        try {
          await entry.videoSender.replaceTrack(videoTrack)
        } catch {
          return
        }
      }),
    )
  }

  private safeAudioTrack(): MediaStreamTrack | null {
    try {
      return this.options.getAudioTrack()
    } catch {
      return null
    }
  }

  private safeVideoTrack(): MediaStreamTrack | null {
    try {
      return this.options.getVideoTrack()
    } catch {
      return null
    }
  }

  private flushPending(entry: PeerEntry): void {
    if (!entry.hasRemoteDescription || entry.pendingSignals.length === 0) return
    const pending = entry.pendingSignals.splice(0, entry.pendingSignals.length)
    void (async () => {
      for (const payload of pending) {
        if (payload.kind !== "candidate") continue
        try {
          await entry.connection.addIceCandidate(
            payload.candidate ? toIceCandidate(payload.candidate) : undefined,
          )
        } catch {
          continue
        }
      }
    })()
  }

  private createEntry(peerId: string): PeerEntry {
    const connection = new RTCPeerConnection({
      iceServers: this.options.iceServers,
      bundlePolicy: "max-bundle",
    })
    const entry: PeerEntry = {
      id: peerId,
      connection,
      stream: null,
      audioSender: connection.addTransceiver("audio", { direction: "sendrecv" }).sender,
      videoSender: connection.addTransceiver("video", { direction: "sendrecv" }).sender,
      polite: this.options.selfId > peerId,
      makingOffer: false,
      ignoreOffer: false,
      applyingRemoteAnswer: false,
      hasRemoteDescription: false,
      failedNotified: false,
      pendingSignals: [],
    }
    try {
      void entry.audioSender.replaceTrack(this.safeAudioTrack())?.catch(() => undefined)
    } catch {
      return entry
    }
    try {
      void entry.videoSender.replaceTrack(this.safeVideoTrack())?.catch(() => undefined)
    } catch {
      return entry
    }
    connection.ontrack = (event) => {
      const stream = entry.stream ?? new MediaStream()
      for (const track of event.streams[0]?.getTracks() ?? []) {
        if (!stream.getTracks().includes(track)) {
          try {
            stream.addTrack(track)
          } catch {
            continue
          }
        }
      }
      if (!stream.getTracks().includes(event.track)) {
        try {
          stream.addTrack(event.track)
        } catch {
          return
        }
      }
      entry.stream = stream
      this.options.onStream(peerId, stream)
    }
    connection.onicecandidate = ({ candidate }) => {
      if (this.closed) return
      this.options.sendSignal(peerId, {
        kind: "candidate",
        candidate: candidate ? serializeCandidate(candidate) : null,
      })
    }
    connection.onnegotiationneeded = () => {
      if (entry.ignoreOffer || this.closed) return
      if (entry.polite && !entry.hasRemoteDescription) return
      void this.negotiate(entry)
    }
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === "connected") {
        entry.failedNotified = false
        this.options.onPeerRecovered?.(peerId)
        void this.syncOutgoingTracks()
        return
      }
      if (state === "disconnected") {
        void this.syncOutgoingTracks()
        return
      }
      if (state === "failed") {
        if (!entry.failedNotified) {
          entry.failedNotified = true
          this.options.onPeerFailed(peerId)
        }
        if (!this.closed) {
          try {
            connection.restartIce()
          } catch {
            return
          }
        }
      }
    }
    return entry
  }

  private async negotiate(entry: PeerEntry): Promise<void> {
    if (this.closed) return
    try {
      entry.makingOffer = true
      await entry.connection.setLocalDescription()
      this.sendDescription(entry, entry.connection.localDescription)
    } catch {
      return
    } finally {
      entry.makingOffer = false
    }
  }

  private async applyDescription(
    entry: PeerEntry,
    description: { type: "offer" | "answer"; sdp?: string },
  ): Promise<void> {
    const connection = entry.connection
    const isOffer = description.type === "offer"
    const readyForOffer =
      !entry.makingOffer &&
      (connection.signalingState === "stable" || entry.applyingRemoteAnswer)
    const offerCollision = isOffer && !readyForOffer
    entry.ignoreOffer = !entry.polite && offerCollision
    if (entry.ignoreOffer) return
    try {
      if (offerCollision) {
        await connection.setLocalDescription({ type: "rollback" })
      }
      entry.applyingRemoteAnswer = description.type === "answer"
      await connection.setRemoteDescription(description)
      entry.hasRemoteDescription = true
    } catch {
      entry.applyingRemoteAnswer = false
      return
    }
    entry.applyingRemoteAnswer = false
    await this.syncOutgoingTracks()
    if (!isOffer) return
    try {
      await connection.setLocalDescription()
      this.sendDescription(entry, connection.localDescription)
    } catch {
      return
    }
  }

  private sendDescription(entry: PeerEntry, description: RTCSessionDescription | null): void {
    if (!description) return
    if (description.type !== "offer" && description.type !== "answer") return
    this.options.sendSignal(entry.id, {
      kind: "description",
      description: { type: description.type, sdp: description.sdp },
    })
  }
}

function serializeCandidate(candidate: RTCIceCandidate): IceCandidatePayload {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  }
}

function toIceCandidate(payload: IceCandidatePayload): RTCIceCandidateInit {
  return {
    candidate: payload.candidate,
    sdpMid: payload.sdpMid,
    sdpMLineIndex: payload.sdpMLineIndex,
    usernameFragment: payload.usernameFragment,
  }
}
