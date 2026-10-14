"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, MessageSquare, SendHorizontal } from "lucide-react"
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from "../../../shared/protocol.ts"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { IconButton } from "@/components/ui/Button.tsx"
import { cn } from "@/lib/utils/cn.ts"
import { Panel } from "./Panel.tsx"

const SCROLL_EPSILON = 56

export function ChatPanel({
  messages,
  selfId,
  sendError,
  onClose,
  onSend,
}: {
  messages: ChatMessage[]
  selfId: string | null
  sendError: string | null
  onClose: () => void
  onSend: (text: string) => boolean
}) {
  const { t, formatters } = useI18n()
  const [draft, setDraft] = useState("")
  const [atBottom, setAtBottom] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollToLatest = useCallback(() => {
    const element = listRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [])
  useLayoutEffect(() => {
    if (atBottom) scrollToLatest()
  }, [messages, atBottom, scrollToLatest])
  useLayoutEffect(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 112)}px`
  }, [draft])
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus()
  }, [])
  function handleScroll() {
    const element = listRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    setAtBottom(distance <= SCROLL_EPSILON)
  }
  function submit() {
    const text = draft.trim()
    if (text.length === 0) return
    if (onSend(text)) setDraft("")
  }
  const remaining = CHAT_MESSAGE_MAX_LENGTH - draft.length
  return (
    <Panel
      panelKey="chat"
      label={t("chat.title")}
      title={
        <>
          <MessageSquare className="size-4 text-ink-muted" aria-hidden="true" />
          {t("chat.title")}
        </>
      }
      onClose={onClose}
      closeLabel={t("controls.closeChat")}
      footer={
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="flex flex-col gap-1.5 border-t border-line p-2.5"
        >
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              {t("chat.placeholder")}
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={CHAT_MESSAGE_MAX_LENGTH + 100}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder={t("chat.placeholder")}
              dir="auto"
              className="scroll-area max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-line bg-elevated px-3 py-2 text-sm leading-5 placeholder:text-ink-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <IconButton
              type="submit"
              variant="primary"
              label={t("chat.send")}
              disabled={draft.trim().length === 0}
            >
              <SendHorizontal className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </IconButton>
          </div>
          <span
            aria-live="polite"
            className={cn(
              "self-end text-[0.65rem] tabular-nums",
              remaining < 0 ? "font-semibold text-danger" : "text-ink-muted",
            )}
          >
            {remaining}
          </span>
        </form>
      }
    >
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="scroll-area flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <MessageSquare className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-ink">{t("chat.empty")}</p>
            <p className="text-xs text-ink-muted">{t("chat.emptyHint")}</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = index > 0 ? messages[index - 1] : undefined
            const showDay =
              !previous || formatters.dayKey(previous.sentAt) !== formatters.dayKey(message.sentAt)
            return (
              <div key={message.id} className="flex flex-col gap-2">
                {showDay ? <DaySeparator timestamp={message.sentAt} /> : null}
                <MessageBubble message={message} isSelf={message.senderId === selfId} />
              </div>
            )
          })
        )}
      </div>
      {messages.length > 0 && !atBottom ? (
        <button
          type="button"
          onClick={() => {
            setAtBottom(true)
            scrollToLatest()
          }}
          className="mx-3 mb-1 flex items-center gap-1 self-center rounded-full border border-line bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronDown className="size-3" aria-hidden="true" />
          {t("chat.jumpToLatest")}
        </button>
      ) : null}
      {sendError ? (
        <p role="alert" className="mx-3 mb-1 text-xs font-medium text-danger">
          {sendError}
        </p>
      ) : null}
    </Panel>
  )
}

function MessageBubble({ message, isSelf }: { message: ChatMessage; isSelf: boolean }) {
  const { t, formatters } = useI18n()
  return (
    <div className={cn("flex flex-col gap-0.5", isSelf ? "items-end" : "items-start")}>
      <span className="px-1 text-xs font-medium text-ink-muted" dir="auto">
        {isSelf ? `${message.senderName} (${t("common.you")})` : message.senderName}
      </span>
      <div
        dir="auto"
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm leading-5",
          isSelf
            ? "rounded-br-md bg-accent text-accent-ink"
            : "rounded-bl-md border border-line bg-elevated text-ink",
        )}
      >
        {message.text}
      </div>
      <time
        dateTime={new Date(message.sentAt).toISOString()}
        className="px-1 text-[0.65rem] text-ink-muted"
      >
        {formatters.time(message.sentAt)}
      </time>
    </div>
  )
}

function DaySeparator({ timestamp }: { timestamp: number }) {
  const { formatters } = useI18n()
  return (
    <div className="my-1 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      <time
        dateTime={new Date(timestamp).toISOString()}
        className="rounded-full bg-elevated px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted"
      >
        {formatters.date(timestamp)}
      </time>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  )
}
