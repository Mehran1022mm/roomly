const ANALYSIS_INTERVAL_MS = 120
const SPEECH_THRESHOLD = 0.035
const SWITCH_RATIO = 1.4
const MIN_SWITCH_GAP_MS = 500
const SILENCE_HOLD_MS = 600

type VoiceEntry = {
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  samples: Uint8Array<ArrayBuffer>
}

export class ActiveSpeakerDetector {
  private context: AudioContext | null = null
  private readonly voices = new Map<string, VoiceEntry>()
  private timer: number | null = null
  private levels = new Map<string, number>()
  private currentId: string | null = null
  private lastSwitchAt = 0
  private lastLoudAt = 0
  private stopped = false
  private readonly onChange: (speakerId: string | null) => void

  constructor(onChange: (speakerId: string | null) => void) {
    this.onChange = onChange
  }

  add(peerId: string, stream: MediaStream): void {
    if (this.stopped) return
    if (stream.getAudioTracks().length === 0) {
      this.remove(peerId)
      return
    }
    const previous = this.voices.get(peerId)
    if (previous) {
      this.detach(previous)
      this.voices.delete(peerId)
      this.levels.delete(peerId)
    }
    const context = this.ensureContext()
    if (!context) return
    void context.resume().catch(() => undefined)
    try {
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      this.voices.set(peerId, { source, analyser, samples: new Uint8Array(analyser.fftSize) })
      this.ensureTimer()
    } catch {
      return
    }
  }

  remove(peerId: string): void {
    const entry = this.voices.get(peerId)
    if (!entry) return
    this.voices.delete(peerId)
    this.detach(entry)
    this.levels.delete(peerId)
    if (this.currentId === peerId) this.publish(null)
    if (this.voices.size === 0) this.clearTimer()
  }

  retain(peerIds: Iterable<string>): void {
    const keep = new Set(peerIds)
    for (const peerId of [...this.voices.keys()]) {
      if (!keep.has(peerId)) this.remove(peerId)
    }
  }

  setLocalParticipant(peerId: string, stream: MediaStream | null): void {
    if (stream) this.add(peerId, stream)
    else this.remove(peerId)
  }

  stop(): void {
    this.stopped = true
    this.clearTimer()
    for (const entry of this.voices.values()) this.detach(entry)
    this.voices.clear()
    this.levels.clear()
    void this.context?.close().catch(() => undefined)
    this.context = null
  }

  private detach(entry: VoiceEntry): void {
    try {
      entry.source.disconnect()
    } catch {
      return
    } finally {
      try {
        entry.analyser.disconnect()
      } catch {
        return
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    if (typeof window === "undefined") return null
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      this.context = new Ctor()
      return this.context
    } catch {
      return null
    }
  }

  private ensureTimer(): void {
    if (this.timer !== null || this.stopped) return
    this.timer = window.setInterval(() => this.analyze(), ANALYSIS_INTERVAL_MS)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private analyze(): void {
    if (this.voices.size === 0) {
      this.clearTimer()
      return
    }
    let loudestId: string | null = null
    let loudestLevel = 0
    for (const [peerId, entry] of this.voices) {
      const level = measureLevel(entry)
      this.levels.set(peerId, level)
      if (level > loudestLevel) {
        loudestLevel = level
        loudestId = peerId
      }
    }
    const now = performance.now()
    if (!loudestId || loudestLevel < SPEECH_THRESHOLD) {
      if (this.currentId !== null && now - this.lastLoudAt >= SILENCE_HOLD_MS) {
        this.publish(null)
      }
      return
    }
    this.lastLoudAt = now
    if (loudestId === this.currentId) return
    if (now - this.lastSwitchAt < MIN_SWITCH_GAP_MS) return
    if (this.currentId !== null) {
      const currentLevel = this.levels.get(this.currentId) ?? 0
      if (loudestLevel < currentLevel * SWITCH_RATIO) return
    }
    this.lastSwitchAt = now
    this.publish(loudestId)
  }

  private publish(speakerId: string | null): void {
    if (speakerId === this.currentId) return
    this.currentId = speakerId
    this.onChange(speakerId)
  }
}

function measureLevel(entry: VoiceEntry): number {
  entry.analyser.getByteTimeDomainData(entry.samples)
  let sumSquares = 0
  for (const sample of entry.samples) {
    const centered = (sample - 128) / 128
    sumSquares += centered * centered
  }
  return Math.sqrt(sumSquares / entry.samples.length)
}
