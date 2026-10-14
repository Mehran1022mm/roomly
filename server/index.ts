import { createServer } from "node:http"
import type { Duplex } from "node:stream"
import { SIGNAL_PATH } from "../shared/protocol.ts"
import { loadConfig } from "./config.ts"
import { SHUTDOWN_GRACE_MS, UPGRADE_RESPONSE_GRACE_MS } from "./constants.ts"
import { createNextApp } from "./nextApp.ts"
import { createSignalingServer } from "./signaling.ts"

const isDev = process.argv.includes("--dev")
const config = loadConfig(isDev)
const app = createNextApp({ dev: isDev, hostname: config.host, port: config.port })
const handle = app.getRequestHandler()
const signaling = createSignalingServer(config)

await app.prepare()

const server = createServer((request, response) => {
  void handle(request, response)
})

server.on("error", () => {
  process.exitCode = 1
})

server.on("upgrade", (request, socket, head) => {
  const handled = signaling.handleUpgrade(request, socket as Duplex, head)
  if (handled) return
  let pathname = ""
  try {
    pathname = new URL(request.url ?? "/", "http://localhost").pathname
  } catch {
    socket.destroy()
    return
  }
  if (pathname === SIGNAL_PATH || pathname === `${SIGNAL_PATH}/`) {
    socket.destroy()
    return
  }
  guardUpgradeSocket(socket as Duplex)
})

function guardUpgradeSocket(socket: Duplex): void {
  let answered = false
  const originalWrite = socket.write.bind(socket)
  socket.write = ((...args: unknown[]): boolean => {
    answered = true
    return (originalWrite as (...writeArgs: unknown[]) => boolean)(...args)
  }) as typeof socket.write
  const timer = setTimeout(() => {
    if (!answered && !socket.destroyed) socket.destroy()
  }, UPGRADE_RESPONSE_GRACE_MS)
  timer.unref()
  socket.once("close", () => clearTimeout(timer))
}

function shutdown(signal: string): void {
  process.stdout.write(`Roomly received ${signal}, shutting down\n`)
  signaling.close()
  const force = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS)
  force.unref()
  new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
    .then(() => app.close())
    .catch(() => undefined)
    .finally(() => process.exit(0))
}

process.once("SIGTERM", () => shutdown("SIGTERM"))
process.once("SIGINT", () => shutdown("SIGINT"))

server.listen(config.port, config.host, () => {
  process.stdout.write(`Roomly ready on http://${config.host}:${config.port}\n`)
})
