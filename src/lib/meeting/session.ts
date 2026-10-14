export const SESSION_STORAGE_KEY = "roomly_session"

export type RoomSession = {
  id: string
  token: string
  displayName: string
}

export function readSession(): RoomSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const candidate = parsed as Partial<RoomSession>
    if (
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      typeof candidate.token !== "string" ||
      candidate.token.length === 0 ||
      typeof candidate.displayName !== "string" ||
      candidate.displayName.trim().length === 0
    ) {
      return null
    }
    return { id: candidate.id, token: candidate.token, displayName: candidate.displayName }
  } catch {
    return null
  }
}

export function writeSession(session: RoomSession): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    window.dispatchEvent(new Event("roomly:session"))
  } catch {
    return
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    window.dispatchEvent(new Event("roomly:session"))
  } catch {
    return
  }
}
