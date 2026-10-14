export type Theme = "light" | "dark"
export type TransitionMode = "fade" | "slide"
export const THEME_STORAGE_KEY = "roomly_theme"
const TRANSITION_MS = 220

type ViewTransitionHandle = { finished: Promise<void> }
type StartViewTransition = (callback: () => void | Promise<void>) => ViewTransitionHandle
type TransitionDocument = Document & { startViewTransition?: StartViewTransition }

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function syncMotionPreference(): () => void {
  const root = document.documentElement
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  const apply = () => {
    if (query.matches) root.dataset.motion = "reduced"
    else delete root.dataset.motion
  }
  apply()
  query.addEventListener("change", apply)
  return () => query.removeEventListener("change", apply)
}

function getStartViewTransition(): StartViewTransition | undefined {
  if (typeof document === "undefined") return undefined
  const start = (document as TransitionDocument).startViewTransition
  return typeof start === "function" ? start.bind(document) : undefined
}

export function runTransition(mutate: () => void, mode: TransitionMode = "fade"): void {
  const reduced = prefersReducedMotion()
  const start = getStartViewTransition()
  const root = typeof document === "undefined" ? null : document.documentElement
  if (reduced || !root) {
    mutate()
    return
  }
  if (!start) {
    root.classList.add("is-transitioning")
    mutate()
    const token = root.dataset.transitionToken ?? "0"
    const next = String(Number(token) + 1)
    root.dataset.transitionToken = next
    window.setTimeout(() => {
      if (root.dataset.transitionToken === next) {
        root.classList.remove("is-transitioning")
        delete root.dataset.transitionToken
      }
    }, TRANSITION_MS)
    return
  }
  const currentMode = root.dataset.transitionMode
  root.dataset.transitionMode = mode
  void start(() => {
    mutate()
  }).finished.finally(() => {
    if (root.dataset.transitionMode === mode && currentMode === undefined) {
      delete root.dataset.transitionMode
    } else if (currentMode !== undefined) {
      root.dataset.transitionMode = currentMode
    }
  })
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    return
  }
}

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark"
}

export function toggleTheme(): void {
  const next: Theme = readTheme() === "light" ? "dark" : "light"
  runTransition(() => applyTheme(next))
}
