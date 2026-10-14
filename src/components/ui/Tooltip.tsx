"use client"

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils/cn.ts"
import { prefersReducedMotion } from "@/lib/theme/theme.ts"

type Placement = "top" | "bottom"
type DescribableProps = { "aria-describedby"?: string }
const DEFAULT_DELAY_MS = 260

export function Tooltip({
  label,
  placement = "top",
  delay = DEFAULT_DELAY_MS,
  children,
}: {
  label: string
  placement?: Placement
  delay?: number
  children: ReactNode
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])
  const show = useCallback(() => {
    clearTimer()
    if (prefersReducedMotion() || delay <= 0) {
      setVisible(true)
      return
    }
    timerRef.current = window.setTimeout(() => setVisible(true), delay)
  }, [clearTimer, delay])
  const hide = useCallback(() => {
    clearTimer()
    setVisible(false)
  }, [clearTimer])
  useEffect(() => clearTimer, [clearTimer])
  useEffect(() => {
    if (!visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [visible])
  const target = isValidElement(children)
    ? cloneElement(children as ReactElement<DescribableProps>, {
        "aria-describedby": visible
          ? describeBy(
              (children as ReactElement<DescribableProps>).props["aria-describedby"],
              id,
            )
          : (children as ReactElement<DescribableProps>).props["aria-describedby"],
      })
    : children
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return
        show()
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {target}
      <span
        id={id}
        role="tooltip"
        data-visible={visible}
        aria-hidden={!visible}
        className={cn(
          "pointer-events-none absolute inset-x-0 z-50 flex justify-center",
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        <span
          data-visible={visible}
          className="tooltip-bubble w-max max-w-[min(14rem,calc(100vw-2rem))] rounded-md bg-tooltip px-2 py-1 text-center text-xs leading-snug text-tooltip-ink shadow-lg"
        >
          {label}
        </span>
      </span>
    </span>
  )
}

function describeBy(existing: unknown, id: string): string {
  return typeof existing === "string" && existing.length > 0 ? `${existing} ${id}` : id
}
