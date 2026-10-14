import type { Metadata, Viewport } from "next"
import { Inter, Vazirmatn } from "next/font/google"
import { I18nProvider } from "@/lib/i18n/I18nProvider.tsx"
import { readRequestLocale } from "@/lib/i18n/readRequestLocale.ts"
import { directionOf } from "@/lib/i18n/locales.ts"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme.ts"
import "./globals.css"

const latinFont = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
  adjustFontFallback: false,
})

const persianFont = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-fa",
  display: "swap",
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: "Roomly",
  description: "Private video meeting for a small circle of people.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

const themeBootstrap = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await readRequestLocale()
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${latinFont.variable} ${persianFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-dvh antialiased">
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  )
}
