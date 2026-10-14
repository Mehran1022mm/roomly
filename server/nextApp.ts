import { createRequire } from "node:module"

type NextFactory = typeof import("next").default

export type NextAppOptions = {
  dev: boolean
  hostname: string
  port: number
}

export type NextApp = ReturnType<NextFactory>

const require = createRequire(import.meta.url)

export function createNextApp(options: NextAppOptions): NextApp {
  const factory = require("next") as NextFactory
  return factory(options)
}
