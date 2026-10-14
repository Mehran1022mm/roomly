"use client"

import { useSyncExternalStore } from "react"
import { detectCapabilities, type CapabilityReport } from "@/lib/webrtc/capabilities.ts"

const supported: CapabilityReport = { supported: true, missing: [], screenShare: false }

let cached: CapabilityReport | null = null

function subscribe(): () => void {
  return () => undefined
}

function getSnapshot(): CapabilityReport {
  cached ??= detectCapabilities()
  return cached
}

function getServerSnapshot(): CapabilityReport {
  return supported
}

export function useCapabilities(): CapabilityReport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
