import Link from "next/link"
import { BrandMark } from "@/components/ui/Notice.tsx"
import { Button } from "@/components/ui/Button.tsx"
import { LanguageToggle } from "@/components/ui/LanguageToggle.tsx"
import { ThemeToggle } from "@/components/ui/ThemeToggle.tsx"
import { Footer } from "@/components/ui/Footer.tsx"
import { readRequestLocale } from "@/lib/i18n/readRequestLocale.ts"
import { getFormatters } from "@/lib/i18n/format.ts"
import { translate } from "@/lib/i18n/translate.ts"
import { en } from "@/lib/i18n/dictionaries/en.ts"
import { fa } from "@/lib/i18n/dictionaries/fa.ts"

const dictionaries = { en, fa }

export default async function NotFound() {
  const locale = await readRequestLocale()
  const dictionary = dictionaries[locale]
  void getFormatters(locale)
  const t = (key: Parameters<typeof translate>[2]) => translate(dictionary, locale, key)
  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-6 sm:px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-panel border border-line bg-surface p-6 text-center shadow-sm">
          <p dir="ltr" className="font-mono text-5xl font-bold text-accent">
            404
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{t("notFound.title")}</h1>
          <p className="text-sm leading-relaxed text-ink-muted">{t("notFound.body")}</p>
          <Link href="/">
            <Button variant="primary" size="lg">
              {t("notFound.home")}
            </Button>
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  )
}
