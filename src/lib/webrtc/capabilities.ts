export const CAPABILITY_LABELS = {
  mediaDevices: "navigator.mediaDevices",
  getUserMedia: "getUserMedia",
  getDisplayMedia: "getDisplayMedia",
  peerConnection: "RTCPeerConnection",
  secureContext: "HTTPS",
  audioContext: "AudioContext",
} as const

export type CapabilityKey = keyof typeof CAPABILITY_LABELS

export type CapabilityReport = {
  supported: boolean
  missing: CapabilityKey[]
  screenShare: boolean
}

export function detectCapabilities(): CapabilityReport {
  if (typeof window === "undefined") {
    return { supported: false, missing: ["peerConnection"], screenShare: false }
  }
  const missing: CapabilityKey[] = []
  if (!window.isSecureContext) missing.push("secureContext")
  if (typeof RTCPeerConnection === "undefined") missing.push("peerConnection")
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    missing.push("getUserMedia")
  }
  if (
    typeof window.AudioContext === "undefined" &&
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext ===
      "undefined"
  ) {
    missing.push("audioContext")
  }
  const screenShare = supportsScreenShare()
  return { supported: missing.length === 0, missing, screenShare }
}

export function supportsScreenShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  )
}
