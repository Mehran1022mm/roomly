"use client"

import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils/cn.ts"

export type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "password"
  placeholder?: string
  autoComplete?: string
  maxLength?: number
  required?: boolean
  autoFocus?: boolean
  error?: string | null
  disabled?: boolean
  showPasswordLabel?: string
  hidePasswordLabel?: string
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  required = false,
  autoFocus = false,
  error = null,
  disabled = false,
  showPasswordLabel = "Show",
  hidePasswordLabel = "Hide",
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === "password"
  const inputType = isPassword && revealed ? "text" : type
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("field-control", isPassword && "pe-11")}
          data-invalid={error ? "true" : "false"}
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={revealed}
            disabled={disabled}
            onClick={() => setRevealed((current) => !current)}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
