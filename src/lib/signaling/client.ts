import { SIGNAL_PATH, type ClientMessage, type ServerMessage } from "../../../shared/protocol.ts"

export type SocketStatus = "connecting" | "connected" | "reconnecting" | "disconnected"

export type SignalClientOptions = {
  url: string
  onStatus: (status: SocketStatus) => void
  onOpen: () => void
  onMessage: (message: ServerMessage) => void
}

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8000
const BACKOFF_FACTOR = 1.7
const JITTER_RATIO = 0.3
const HEARTBEAT_MS = 20000

export function buildSignalUrl(location: Location): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${location.host}${SIGNAL_PATH}`
}

export class SignalClient {
  private socket: WebSocket | null = null
  private attempts = 0
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private disposed = false
  private readonly options: SignalClientOptions

  constructor(options: SignalClientOptions) {
    this.options = options
  }

  connect(): void {
    if (this.socket) return
    this.disposed = false
    this.options.onStatus(this.attempts === 0 ? "connecting" : "reconnecting")
    let socket: WebSocket
    try {
      socket = new WebSocket(this.options.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket
    socket.onopen = () => {
      this.attempts = 0
      this.options.onStatus("connected")
      this.startHeartbeat()
      this.options.onOpen()
    }
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = this.parse(event.data)
      if (message) this.options.onMessage(message)
    }
    socket.onerror = () => {
      try {
        socket.close()
      } catch {
        return
      }
    }
    socket.onclose = () => {
      this.stopHeartbeat()
      if (this.socket === socket) this.socket = null
      if (!this.disposed) this.scheduleReconnect()
      else this.options.onStatus("disconnected")
    }
  }

  send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false
    try {
      this.socket.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }

  close(): void {
    this.disposed = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    const socket = this.socket
    this.socket = null
    try {
      socket?.close(1000, "client closed")
    } catch {
      return
    } finally {
      this.options.onStatus("disconnected")
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
      try {
        this.socket.send(JSON.stringify({ type: "ping" }))
      } catch {
        return
      }
    }, HEARTBEAT_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.disposed) return
    this.attempts += 1
    this.options.onStatus("reconnecting")
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, this.attempts - 1))
    const jittered = delay * (1 + (Math.random() * 2 - 1) * JITTER_RATIO)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, jittered)
  }

  private parse(raw: string): ServerMessage | null {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null) return null
      const message = parsed as Partial<ServerMessage>
      return typeof message.type === "string" ? (message as ServerMessage) : null
    } catch {
      return null
    }
  }
}
