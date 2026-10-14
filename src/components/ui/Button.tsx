"use client"

import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils/cn.ts"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-sm hover:brightness-108 active:brightness-95",
  secondary:
    "bg-elevated text-ink border border-line hover:border-line-strong hover:bg-surface active:bg-accent-soft",
  ghost: "text-ink hover:bg-elevated active:bg-accent-soft",
  danger: "bg-danger text-danger-ink hover:brightness-108 active:brightness-95",
}

const motionClasses =
  "transition-[background-color,border-color,color,filter,opacity,transform,box-shadow] duration-150 active:scale-95 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
}

const iconSizeClasses: Record<Size, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium",
        motionClasses,
        variantClasses[variant],
        sizeClasses[size],
        block && "w-full",
        className,
      )}
      {...rest}
    />
  )
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  label: string
}

export function IconButton({
  variant = "ghost",
  size = "md",
  label,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        motionClasses,
        variantClasses[variant],
        iconSizeClasses[size],
        className,
      )}
      {...rest}
    />
  )
}
