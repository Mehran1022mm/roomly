"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { LoaderCircle, LogIn } from "lucide-react"
import { Button } from "@/components/ui/Button.tsx"
import { DeviceMenu } from "@/components/ui/DeviceMenu.tsx"
import { LanguageToggle } from "@/components/ui/LanguageToggle.tsx"
import { BrandMark, NoticeList, PrivacyNote } from "@/components/ui/Notice.tsx"
import { TextField } from "@/components/ui/TextField.tsx"
import { ThemeToggle } from "@/components/ui/ThemeToggle.tsx"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { ERROR_KEYS } from "@/lib/meeting/errors.ts"
import { DISPLAY_NAME_MAX_LENGTH } from "../../../shared/protocol.ts"
import { Footer } from "@/components/ui/Footer.tsx"
import { joinRoom } from "@/lib/meeting/join.ts"
import { useCapabilities } from "@/lib/webrtc/useCapabilities.ts"
import { UnsupportedNotice } from "./UnsupportedNotice.tsx"

type FieldErrors = { displayName: string | null; password: string | null }

export function Lobby() {
  const { t } = useI18n()
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({ displayName: null, password: null })
  const [generalError, setGeneralError] = useState<string | null>(null)
  const capabilities = useCapabilities()
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const trimmedName = displayName.trim()
    if (trimmedName.length === 0) {
      setErrors({ displayName: t("errors.invalidName"), password: null })
      return
    }
    if (password.length === 0) {
      setErrors({ displayName: null, password: t("errors.passwordRequired") })
      return
    }
    setSubmitting(true)
    setErrors({ displayName: null, password: null })
    setGeneralError(null)
    const result = await joinRoom(trimmedName, password)
    if (result.ok) {
      router.replace("/room")
      router.refresh()
      return
    }
    setSubmitting(false)
    if (result.error === "wrongPassword") {
      setErrors({ displayName: null, password: t(ERROR_KEYS[result.error]) })
      return
    }
    if (result.error === "invalidName") {
      setErrors({ displayName: t(ERROR_KEYS[result.error]), password: null })
      return
    }
    if (result.error === "roomFull") {
      setGeneralError(t(ERROR_KEYS[result.error]))
      return
    }
    setGeneralError(t(ERROR_KEYS[result.error]))
  }
  if (!capabilities.supported) return <UnsupportedNotice />
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#lobby-form"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("lobby.join")}
      </a>
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <DeviceMenu />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="w-full max-w-sm">
          <form
            id="lobby-form"
            onSubmit={handleSubmit}
            aria-busy={submitting}
            className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 shadow-sm sm:p-6"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold tracking-tight">{t("lobby.heading")}</h1>
              <p className="text-sm leading-relaxed text-ink-muted">{t("lobby.subheading")}</p>
            </div>
            {submitting ? (
              <NoticeList
                items={[{ id: "preparing", tone: "info", message: "lobby.preparing" }]}
              />
            ) : null}
            {generalError ? (
              <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                {generalError}
              </p>
            ) : null}
            <TextField
              label={t("lobby.displayName")}
              value={displayName}
              onChange={setDisplayName}
              placeholder={t("lobby.displayNamePlaceholder")}
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              required
              disabled={submitting}
              error={errors.displayName}
            />
            <TextField
              label={t("lobby.password")}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t("lobby.passwordPlaceholder")}
              autoComplete="current-password"
              required
              disabled={submitting}
              error={errors.password}
            />
            <Button type="submit" variant="primary" size="lg" block disabled={submitting}>
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  <span>{t("lobby.joining")}</span>
                </>
              ) : (
                <>
                  <LogIn className="size-4" aria-hidden="true" />
                  <span>{t("lobby.join")}</span>
                </>
              )}
            </Button>
            <PrivacyNote />
          </form>
        </div>
      </div>
      <Footer />
    </main>
  )
}
