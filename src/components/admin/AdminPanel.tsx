"use client"

import { useCallback, useState } from "react"
import { LoaderCircle, LogIn, RefreshCw, SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/Button.tsx"
import { LanguageToggle } from "@/components/ui/LanguageToggle.tsx"
import { BrandMark } from "@/components/ui/Notice.tsx"
import { TextField } from "@/components/ui/TextField.tsx"
import { ThemeToggle } from "@/components/ui/ThemeToggle.tsx"
import { Footer } from "@/components/ui/Footer.tsx"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import type { ParticipantView } from "../../../shared/protocol.ts"

type StatusResponse = {
  ok: boolean
  version?: string
  uptime?: number
  connected?: number
  reserved?: number
  maxUsers?: number
  stunUrls?: string[]
  turnConfigured?: boolean
  participants?: ParticipantView[]
}

export function AdminPanel() {
  const { t } = useI18n()
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const load = useCallback(async () => {
    setStatusError(null)
    try {
      const response = await fetch("/api/admin/status", { cache: "no-store" })
      if (response.status === 401) {
        setAuthed(false)
        return
      }
      const data = (await response.json()) as StatusResponse
      if (!data.ok) {
        setStatusError(t("admin.loadFailed"))
        return
      }
      setStatus(data)
    } catch {
      setStatusError(t("admin.loadFailed"))
    }
  }, [t])
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (signingIn || password.length === 0) return
    setSigningIn(true)
    setLoginError(null)
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        setLoginError(t("admin.loginFailed"))
        return
      }
      setPassword("")
      setAuthed(true)
      await load()
    } finally {
      setSigningIn(false)
    }
  }
  async function kick(id: string) {
    await fetch("/api/admin/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    await load()
  }
  async function sendAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = announcement.trim()
    if (!text) return
    await fetch("/api/admin/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    setAnnouncement("")
  }
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <a
        href={authed ? "#admin-status" : "#admin-form"}
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("admin.title")}
      </a>
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-6 sm:px-6">
        <div className="w-full max-w-sm">
          {!authed ? (
            <form
              id="admin-form"
              onSubmit={login}
              aria-busy={signingIn}
              className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 shadow-sm sm:p-6"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <h1 className="text-xl font-semibold tracking-tight">{t("admin.title")}</h1>
              </div>
              <TextField
                label={t("admin.password")}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={t("admin.passwordPlaceholder")}
                autoComplete="current-password"
                required
                disabled={signingIn}
                error={loginError}
              />
              <Button type="submit" variant="primary" size="lg" block disabled={signingIn}>
                {signingIn ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    <span>{t("admin.signingIn")}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" aria-hidden="true" />
                    <span>{t("admin.login")}</span>
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div id="admin-status" className="mx-auto flex w-full max-w-lg flex-col gap-4">
              <section className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-lg font-semibold">{t("admin.status")}</h1>
                  <Button variant="secondary" size="sm" onClick={() => void load()}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    <span>{t("admin.refresh")}</span>
                  </Button>
                </div>
                {statusError ? (
                  <p role="alert" className="text-sm font-medium text-danger">
                    {statusError}
                  </p>
                ) : null}
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-elevated px-3 py-2">
                    <dt className="text-xs text-ink-muted">{t("admin.connected")}</dt>
                    <dd className="text-base font-semibold">{status?.connected ?? "—"}</dd>
                  </div>
                  <div className="rounded-xl bg-elevated px-3 py-2">
                    <dt className="text-xs text-ink-muted">{t("admin.capacity")}</dt>
                    <dd className="text-base font-semibold">
                      {status?.connected ?? "—"}/{status?.maxUsers ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-elevated px-3 py-2">
                    <dt className="text-xs text-ink-muted">{t("admin.turnRelay")}</dt>
                    <dd className="text-base font-semibold">
                      {status?.turnConfigured ? t("admin.enabled") : t("admin.disabled")}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-elevated px-3 py-2">
                    <dt className="text-xs text-ink-muted">{t("admin.stunServers")}</dt>
                    <dd className="text-base font-semibold">{status?.stunUrls?.length ?? "—"}</dd>
                  </div>
                </dl>
                <ul className="flex flex-col gap-1" dir="ltr">
                  {(status?.stunUrls ?? []).map((url) => (
                    <li key={url} className="truncate font-mono text-xs text-ink-muted">
                      {url}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-5 shadow-sm">
                <h2 className="text-base font-semibold">{t("admin.participants")}</h2>
                {(status?.participants ?? []).length === 0 ? (
                  <p className="text-sm text-ink-muted">{t("admin.noParticipants")}</p>
                ) : (
                  <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                    {(status?.participants ?? []).map((participant) => (
                      <li
                        key={participant.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-elevated px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                          {participant.displayName}
                        </span>
                        <Button variant="danger" size="sm" onClick={() => void kick(participant.id)}>
                          {t("admin.kick")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-5 shadow-sm">
                <h2 className="text-base font-semibold">{t("admin.announce")}</h2>
                <form onSubmit={sendAnnouncement} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label htmlFor="admin-announce" className="sr-only">
                    {t("admin.announcePlaceholder")}
                  </label>
                  <input
                    id="admin-announce"
                    value={announcement}
                    onChange={(event) => setAnnouncement(event.target.value)}
                    placeholder={t("admin.announcePlaceholder")}
                    dir="auto"
                    className="field-control"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={announcement.trim().length === 0}
                    className="shrink-0"
                  >
                    <SendHorizontal className="size-4" aria-hidden="true" />
                    <span>{t("admin.send")}</span>
                  </Button>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  )
}
