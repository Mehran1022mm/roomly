import { classifyMediaError, isCancellation, type MediaFailure } from "./mediaErrors.ts"

export type MediaStartResult = {
  audioEnabled: boolean
  videoEnabled: boolean
  audioFailure: MediaFailure | null
  videoFailure: MediaFailure | null
}

export type ScreenShareResult = {
  stream: MediaStream | null
  failure: MediaFailure | null
}

export type ScreenShareListener = () => void

export type MediaDeviceList = {
  audioInputs: MediaDeviceInfo[]
  videoInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
}

export type DeviceSelection = {
  audioDeviceId: string | null
  videoDeviceId: string | null
}

const MEDIA_REQUEST_TIMEOUT_MS = 20000
const TEARDOWN_GRACE_MS = 1500

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
}

const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: { frameRate: { ideal: 30, max: 30 } },
  audio: false,
}

type RequestOutcome = {
  stream: MediaStream | null
  failure: MediaFailure | null
}

class MediaManager {
  private cameraStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private audioEnabled = false
  private videoEnabled = false
  private audioIntended: boolean | null = null
  private videoIntended: boolean | null = null
  private listeners = new Set<ScreenShareListener>()
  private pending: Promise<MediaStartResult> | null = null
  private generation = 0
  private lastAudioFailure: MediaFailure | null = null
  private lastVideoFailure: MediaFailure | null = null
  private holders = 0
  private teardownTimer: ReturnType<typeof setTimeout> | null = null
  private noiseSuppression = true
  private audioDeviceId: string | null = readDevicePreference(AUDIO_DEVICE_KEY)
  private videoDeviceId: string | null = readDevicePreference(VIDEO_DEVICE_KEY)

  subscribeToScreenShare(listener: ScreenShareListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getCameraStream(): MediaStream | null {
    return this.cameraStream
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream
  }

  isScreenSharing(): boolean {
    return this.screenStream !== null
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled
  }

  isVideoEnabled(): boolean {
    return this.videoEnabled
  }

  getAudioTrack(): MediaStreamTrack | null {
    return this.audioEnabled ? (this.cameraStream?.getAudioTracks()[0] ?? null) : null
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.cameraStream?.getVideoTracks()[0] ?? null
  }

  getOutgoingVideoTrack(): MediaStreamTrack | null {
    if (this.screenStream) return this.screenStream.getVideoTracks()[0] ?? null
    return this.videoEnabled ? this.getVideoTrack() : null
  }

  hasAudioDevice(): boolean {
    return (this.cameraStream?.getAudioTracks().length ?? 0) > 0
  }

  hasVideoDevice(): boolean {
    return (this.cameraStream?.getVideoTracks().length ?? 0) > 0
  }

  retain(): void {
    this.holders += 1
    this.cancelTeardown()
  }

  release(): void {
    if (this.holders > 0) this.holders -= 1
    if (this.holders > 0) return
    this.scheduleTeardown()
  }

  private scheduleTeardown(): void {
    this.cancelTeardown()
    this.teardownTimer = setTimeout(() => {
      this.teardownTimer = null
      if (this.holders > 0) return
      this.teardown()
    }, TEARDOWN_GRACE_MS)
  }

  private cancelTeardown(): void {
    if (this.teardownTimer === null) return
    clearTimeout(this.teardownTimer)
    this.teardownTimer = null
  }

  private teardown(): void {
    this.generation += 1
    this.pending = null
    const wasSharing = this.screenStream !== null
    this.stopScreenStream()
    if (wasSharing) this.notify()
    if (this.cameraStream) {
      stopStream(this.cameraStream)
      this.cameraStream = null
    }
    this.audioEnabled = false
    this.videoEnabled = false
    this.lastAudioFailure = null
    this.lastVideoFailure = null
  }

  async retryMedia(): Promise<MediaStartResult> {
    this.lastAudioFailure = null
    this.lastVideoFailure = null
    if (!this.pending) {
      this.pending = this.acquire(this.generation).finally(() => {
        this.pending = null
      })
    }
    return this.pending
  }

  async retryAudio(): Promise<MediaStartResult> {
    return this.retryMedia()
  }

  async start(): Promise<MediaStartResult> {
    if (this.pending) return this.pending
    if (this.cameraStream) return this.currentResult()
    const generation = this.generation
    this.pending = this.acquire(generation).finally(() => {
      this.pending = null
    })
    return this.pending
  }

  setAudioEnabled(enabled: boolean): boolean {
    this.audioIntended = enabled
    this.audioEnabled = enabled
    return this.audioEnabled
  }

  isNoiseSuppressionEnabled(): boolean {
    return this.noiseSuppression
  }

  async setNoiseSuppression(enabled: boolean): Promise<boolean> {
    this.noiseSuppression = enabled
    const track = this.cameraStream?.getAudioTracks()[0] ?? null
    if (!track) return enabled
    try {
      await track.applyConstraints({
        echoCancellation: enabled,
        noiseSuppression: enabled,
        autoGainControl: enabled,
      })
      return true
    } catch {
      return false
    }
  }

  setVideoEnabled(enabled: boolean): boolean {
    this.videoIntended = enabled
    this.videoEnabled = enabled
    return this.videoEnabled
  }

  async startScreenShare(): Promise<ScreenShareResult> {
    if (this.screenStream) return { stream: this.screenStream, failure: null }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS)
      const track = stream.getVideoTracks()[0]
      if (!track) {
        stopStream(stream)
        return { stream: null, failure: { kind: "missing", name: "NoVideoTrack" } }
      }
      if (typeof track.contentHint === "string") track.contentHint = "detail"
      track.addEventListener("ended", this.handleScreenEnded)
      this.screenStream = stream
      this.notify()
      return { stream, failure: null }
    } catch (error) {
      if (isCancellation(error)) return { stream: null, failure: null }
      return { stream: null, failure: classifyMediaError(error) }
    }
  }

  stopScreenShare(): void {
    if (!this.screenStream) return
    this.stopScreenStream()
    this.notify()
  }

  private stopScreenStream(): void {
    const stream = this.screenStream
    this.screenStream = null
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    track?.removeEventListener("ended", this.handleScreenEnded)
    stopStream(stream)
  }

  private async acquire(generation: number): Promise<MediaStartResult> {
    const audioConstraints = this.audioConstraints()
    const videoConstraints = this.videoConstraints()
    const combined = await this.request({ audio: audioConstraints, video: videoConstraints })
    if (combined.stream) {
      if (!this.adopt(combined.stream, generation)) return this.currentResult()
      return this.currentResult()
    }
    if (combined.failure && isTerminal(combined.failure)) {
      this.lastAudioFailure = combined.failure
      this.lastVideoFailure = combined.failure
      return this.currentResult()
    }
    const [audioOnly, videoOnly] = await Promise.all([
      this.request({ audio: audioConstraints, video: false }),
      this.request({ audio: false, video: videoConstraints }),
    ])
    const combinedFallback = mergeStreams(audioOnly.stream, videoOnly.stream)
    this.cameraStream = null
    this.adopt(combinedFallback, generation)
    return this.settle(
      this.hasAudioDevice() ? null : (audioOnly.failure ?? combined.failure),
      this.hasVideoDevice() ? null : (videoOnly.failure ?? combined.failure),
    )
  }

  private audioConstraints(): MediaTrackConstraints {
    const base: MediaTrackConstraints = {
      echoCancellation: this.noiseSuppression,
      noiseSuppression: this.noiseSuppression,
      autoGainControl: this.noiseSuppression,
    }
    if (this.audioDeviceId) base.deviceId = { exact: this.audioDeviceId }
    return base
  }

  private videoConstraints(): MediaTrackConstraints {
    const base: MediaTrackConstraints = { ...VIDEO_CONSTRAINTS }
    if (this.videoDeviceId) base.deviceId = { exact: this.videoDeviceId }
    return base
  }

  private currentResult(): MediaStartResult {
    this.applyIntent()
    return {
      audioEnabled: this.audioEnabled,
      videoEnabled: this.videoEnabled,
      audioFailure: this.audioEnabled ? null : this.lastAudioFailure,
      videoFailure: this.videoEnabled ? null : this.lastVideoFailure,
    }
  }

  private adopt(stream: MediaStream | null, generation: number): boolean {
    if (!stream) return false
    if (generation !== this.generation) {
      if (this.holders > 0) {
        this.cameraStream = mergeInto(this.cameraStream, stream)
        this.applyIntent()
        this.lastAudioFailure = this.audioEnabled ? null : this.lastAudioFailure
        this.lastVideoFailure = this.videoEnabled ? null : this.lastVideoFailure
        return true
      }
      stopStream(stream)
      return false
    }
    this.cameraStream = mergeInto(this.cameraStream, stream)
    this.applyIntent()
    if (!this.audioEnabled) this.lastAudioFailure ??= { kind: "missing", name: "NoAudioTrack" }
    if (!this.videoEnabled) this.lastVideoFailure ??= { kind: "missing", name: "NoVideoTrack" }
    return true
  }

  private applyIntent(): void {
    const audioAvailable = this.hasAudioDevice()
    const videoAvailable = this.hasVideoDevice()
    this.audioEnabled = this.audioIntended ?? audioAvailable
    if (!audioAvailable) this.audioEnabled = false
    this.videoEnabled = this.videoIntended ?? videoAvailable
    if (!videoAvailable) this.videoEnabled = false
  }

  private async request(constraints: MediaStreamConstraints): Promise<RequestOutcome> {
    let expired = false
    const request = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (expired) {
        stopStream(stream)
        return null
      }
      return stream
    })
    let timer: number | undefined
    try {
      const stream = await Promise.race([
        request,
        new Promise<null>((resolve) => {
          timer = window.setTimeout(() => {
            expired = true
            resolve(null)
          }, MEDIA_REQUEST_TIMEOUT_MS)
        }),
      ])
      if (stream) return { stream, failure: null }
      return { stream: null, failure: { kind: "unknown", name: "MediaRequestTimeout" } }
    } catch (error) {
      return { stream: null, failure: classifyMediaError(error) }
    } finally {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }

  private settle(
    audioFailure: MediaFailure | null,
    videoFailure: MediaFailure | null,
  ): MediaStartResult {
    if (audioFailure) this.lastAudioFailure = audioFailure
    if (videoFailure) this.lastVideoFailure = videoFailure
    return this.currentResult()
  }

  private readonly handleScreenEnded = (): void => {
    this.stopScreenShare()
  }

  getDeviceSelection(): DeviceSelection {
    return { audioDeviceId: this.audioDeviceId, videoDeviceId: this.videoDeviceId }
  }

  async listDevices(): Promise<MediaDeviceList> {
    const empty: MediaDeviceList = { audioInputs: [], videoInputs: [], audioOutputs: [] }
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return empty
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        audioInputs: devices.filter((device) => device.kind === "audioinput"),
        videoInputs: devices.filter((device) => device.kind === "videoinput"),
        audioOutputs: devices.filter((device) => device.kind === "audiooutput"),
      }
    } catch {
      return empty
    }
  }

  setAudioDeviceId(deviceId: string | null): void {
    this.audioDeviceId = deviceId
    writeDevicePreference(AUDIO_DEVICE_KEY, deviceId)
  }

  setVideoDeviceId(deviceId: string | null): void {
    this.videoDeviceId = deviceId
    writeDevicePreference(VIDEO_DEVICE_KEY, deviceId)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

function mergeStreams(first: MediaStream | null, second: MediaStream | null): MediaStream | null {
  if (!first) return second
  if (!second) return first
  const output = new MediaStream()
  for (const track of first.getTracks()) {
    try {
      output.addTrack(track)
    } catch {
      continue
    }
  }
  for (const track of second.getTracks()) {
    const duplicate =
      track.kind === "audio" ? output.getAudioTracks().length > 0 : output.getVideoTracks().length > 0
    if (duplicate) {
      try {
        track.stop()
      } catch {
        continue
      }
      continue
    }
    try {
      output.addTrack(track)
    } catch {
      continue
    }
  }
  return output.getTracks().length > 0 ? output : null
}

function mergeInto(existing: MediaStream | null, incoming: MediaStream | null): MediaStream | null {
  if (!incoming) return existing
  if (!existing) return incoming
  for (const track of incoming.getTracks()) {
    const kind = track.kind
    const hasKind =
      kind === "audio"
        ? existing.getAudioTracks().length > 0
        : existing.getVideoTracks().length > 0
    if (!hasKind) {
      try {
        existing.addTrack(track)
      } catch {
        continue
      }
    } else {
      try {
        track.stop()
      } catch {
        continue
      }
    }
  }
  return existing
}

const AUDIO_DEVICE_KEY = "roomly_audio_device"
const VIDEO_DEVICE_KEY = "roomly_video_device"

function readDevicePreference(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeDevicePreference(key: string, deviceId: string | null): void {
  try {
    if (deviceId) window.localStorage.setItem(key, deviceId)
    else window.localStorage.removeItem(key)
  } catch {
    return
  }
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      continue
    }
  }
}

function isTerminal(failure: MediaFailure): boolean {
  return failure.kind === "denied" || failure.kind === "insecure"
}

export const mediaManager = new MediaManager()
