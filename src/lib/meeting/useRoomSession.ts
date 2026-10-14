"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { readSession, SESSION_STORAGE_KEY, type RoomSession } from "@/lib/meeting/session.ts"

function readRaw(): string {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

let cachedRaw: string | null = null
let cached: RoomSession | null = null

function readSnapshot(): RoomSession | null {
  const raw = readRaw()
  if (raw === cachedRaw) return cached
  cachedRaw = raw
  if (raw === "") {
    cached = null
    return cached
  }
  cached = readSession()
  return cached
}

function getServerSnapshot(): RoomSession | null {
  return null
}

function subscribe(notify: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_STORAGE_KEY) notify()
  }
  const onCustom = () => notify()
  window.addEventListener("storage", onStorage)
  window.addEventListener("roomly:session", onCustom)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("roomly:session", onCustom)
  }
}

export function useRoomSession(): RoomSession | null {
  const session = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot)
  const router = useRouter()
  const redirect = useCallback(() => {
    router.replace("/")
  }, [router])
  useEffect(() => {
    if (session === null) {
      const timer = window.setTimeout(() => {
        if (readSnapshot() === null) redirect()
      }, 150)
      return () => window.clearTimeout(timer)
    }
  }, [session, redirect])
  return session
}
