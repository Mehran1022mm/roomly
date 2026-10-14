"use client"

import { Moon, Sun } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider.tsx"
import { toggleTheme } from "@/lib/theme/theme.ts"
import { IconButton } from "./Button.tsx"
import { Tooltip } from "./Tooltip.tsx"

export function ThemeToggle() {
  const { t } = useI18n()
  const label = t("controls.changeTheme")
  return (
    <Tooltip label={label} placement="bottom">
      <IconButton
        label={label}
        size="sm"
        onClick={toggleTheme}
        className="border border-line"
      >
        <Sun className="size-4 dark:hidden" aria-hidden="true" />
        <Moon className="hidden size-4 dark:block" aria-hidden="true" />
      </IconButton>
    </Tooltip>
  )
}
