import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import { WebSocket, WebSocketServer, type WebSocket as WsSocket } from "ws"
import {
  PROTOCOL_VERSION,
  SIGNAL_PATH,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from "../shared/protocol.ts"
import {
  CHAT_LIMIT,
  CHAT_WINDOW_MS,
  JOIN_LIMIT,
  JOIN_TIMEOUT_MS,
  JOIN_WINDOW_MS,
  MAX_PAYLOAD_BYTES,
  MAX_SOCKETS_PER_IP,
  MEDIA_STATE_LIMIT,
  MEDIA_STATE_WINDOW_MS,
  RATE_LIMIT_MAX_ENTRIES,
  SIGNAL_LIMIT,
  SIGNAL_WINDOW_MS,
} from "./constants.ts"
import {
  createMessageId,
  createParticipantId,
  createSessionToken,
  verifySessionToken,
} from "./auth.ts"
import { verifyPassword } from "./secrets.ts"
import type { ServerConfig } from "./config.ts"
import { createRateLimiter, type RateLimiter } from "./ratelimit.ts"
import { Room, send, toView, type Participant } from "./room.ts"
import { isValidDisplayName, parseClientMessage, sanitizeDisplayName } from "./validate.ts"

export type Session = {
  participant: Participant
  userKey: string
}

type JoinMessage = Extract<ClientMessage, { type: "join" }>

export type SignalingServer = {
  wss: WebSocketServer
  room: Room
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => boolean
  close: () => void
}

export function createSignalingServer(config: ServerConfig): SignalingServer {
  const joinLimiter = createRateLimiter(JOIN_LIMIT, JOIN_WINDOW_MS, RATE_LIMIT_MAX_ENTRIES)
  const chatLimiter = createRateLimiter(CHAT_LIMIT, CHAT_WINDOW_MS, RATE_LIMIT_MAX_ENTRIES)
  const signalLimiter = createRateLimiter(SIGNAL_LIMIT, SIGNAL_WINDOW_MS, RATE_LIMIT_MAX_ENTRIES)
  const mediaLimiter = createRateLimiter(
    MEDIA_STATE_LIMIT,
    MEDIA_STATE_WINDOW_MS,
    RATE_LIMIT_MAX_ENTRIES,
  )
  const limiters: RateLimiter[] = [joinLimiter, chatLimiter, signalLimiter, mediaLimiter]
  const sessionsBySocket = new WeakMap<WsSocket, Session>()
  const liveSockets = new Set<WsSocket>()
  const socketIsAlive = new WeakMap<WsSocket, boolean>()
  const joinTimers = new WeakMap<WsSocket, NodeJS.Timeout>()
  const socketsByIp = new Map<string, number>()

  const room = new Room(config.maxUsers, {
    onJoin(participant) {
      room.broadcast({ type: "peerJoined", participant: toView(participant) }, participant.id)
    },
    onLeave(participant) {
      room.broadcast({ type: "peerLeft", id: participant.id })
    },
    onEvict(participant) {
      const evicted = sessionsBySocket.get(participant.socket)
      if (evicted) sessionsBySocket.delete(evicted.participant.socket)
      try {
        participant.socket.close(4000, "replaced")
      } catch {
        return
      }
    },
  })

  function trackIp(userKey: string): boolean {
    const count = socketsByIp.get(userKey) ?? 0
    if (count >= MAX_SOCKETS_PER_IP) return false
    socketsByIp.set(userKey, count + 1)
    return true
  }

  function untrackIp(userKey: string): void {
    const count = socketsByIp.get(userKey) ?? 0
    if (count <= 1) socketsByIp.delete(userKey)
    else socketsByIp.set(userKey, count - 1)
  }

  function sendMessage(socket: WsSocket, message: ServerMessage): void {
    send(socket, JSON.stringify(message))
  }

  function sendError(socket: WsSocket, code: ErrorCode): void {
    sendMessage(socket, { type: "error", code })
  }

  function ownerOf(session: Session): Participant | null {
    const current = room.get(session.participant.id)
    return current && current.socket === session.participant.socket ? current : null
  }

  function confirmJoin(socket: WsSocket, participant: Participant, now: number): void {
    sendMessage(socket, {
      type: "joined",
      self: toView(participant),
      participants: room.listViews().filter((view) => view.id !== participant.id),
      iceServers: config.iceServers,
      token: createSessionToken(participant.id, config.authSecret, now),
      version: PROTOCOL_VERSION,
    })
  }

  function handleJoin(socket: WsSocket, message: JoinMessage, userKey: string): void {
    if (sessionsBySocket.has(socket)) return
    if (!joinLimiter.allow(userKey)) {
      sendError(socket, "rateLimited")
      return
    }
    const now = Date.now()
    const token = typeof message.token === "string" ? message.token : undefined
    if (token) {
      const verifiedId = verifySessionToken(token, config.authSecret, now)
      if (verifiedId) {
        if (!room.canAccept(verifiedId)) {
          sendError(socket, "roomFull")
          return
        }
        const restored = room.get(verifiedId)
        const displayName = restored
          ? restored.displayName
          : sanitizeDisplayName(message.displayName)
        if (!isValidDisplayName(displayName)) {
          sendError(socket, "invalidName")
          return
        }
        const added = room.add(verifiedId, displayName, socket)
        sessionsBySocket.set(socket, { participant: added.participant, userKey })
        const timer = joinTimers.get(socket)
        if (timer) {
          clearTimeout(timer)
          joinTimers.delete(socket)
        }
        confirmJoin(socket, added.participant, now)
        return
      }
    }
    const roomMatch = verifyPassword(
      message.password,
      config.roomPassword.salt,
      config.roomPassword.hash,
    )
    const adminMatch =
      config.adminPassword !== null &&
      verifyPassword(message.password, config.adminPassword.salt, config.adminPassword.hash)
    if (!roomMatch && !adminMatch) {
      sendError(socket, "wrongPassword")
      return
    }
    const joiningAsAdmin = !roomMatch && adminMatch
    const displayName = sanitizeDisplayName(message.displayName)
    if (!isValidDisplayName(displayName)) {
      sendError(socket, "invalidName")
      return
    }
    if (room.isFull()) {
      sendError(socket, "roomFull")
      return
    }
    const added = room.add(createParticipantId(), displayName, socket, joiningAsAdmin)
    sessionsBySocket.set(socket, { participant: added.participant, userKey })
    const timer = joinTimers.get(socket)
    if (timer) {
      clearTimeout(timer)
      joinTimers.delete(socket)
    }
    confirmJoin(socket, added.participant, now)
  }

  function handleSignal(session: Session, message: Extract<ClientMessage, { type: "signal" }>): void {
    const sender = ownerOf(session)
    if (!sender) return
    if (!signalLimiter.allow(sender.id)) return
    if (message.to === sender.id) return
    const target = room.get(message.to)
    if (!target || !target.connected) return
    sendMessage(target.socket, { type: "signal", from: sender.id, payload: message.payload })
  }

  function handleMediaState(
    session: Session,
    message: Extract<ClientMessage, { type: "mediaState" }>,
  ): void {
    const participant = ownerOf(session)
    if (!participant) return
    if (!mediaLimiter.allow(participant.id)) return
    participant.audioEnabled = message.audioEnabled
    participant.videoEnabled = message.videoEnabled
    participant.screenSharing = message.screenSharing
    room.broadcast({ type: "mediaState", participant: toView(participant) }, participant.id)
  }

  function handleChat(session: Session, message: Extract<ClientMessage, { type: "chat" }>): void {
    const sender = ownerOf(session)
    if (!sender) return
    if (!chatLimiter.allow(sender.id)) {
      sendError(sender.socket, "rateLimited")
      return
    }
    room.broadcast({
      type: "chat",
      message: {
        id: createMessageId(),
        senderId: sender.id,
        senderName: sender.displayName,
        text: message.text,
        sentAt: Date.now(),
      },
    })
  }

  function handleLeave(session: Session): void {
    room.remove(session.participant.id, session.participant.socket)
    sessionsBySocket.delete(session.participant.socket)
  }

  function handleModerate(session: Session, message: Extract<ClientMessage, { type: "moderate" }>): void {
    const sender = ownerOf(session)
    if (!sender || !sender.isAdmin) return
    if (message.action === "kick") {
      if (message.target === sender.id) return
      room.remove(message.target)
      return
    }
    room.broadcast({ type: "adminMute" }, sender.id)
  }

  function handleMessage(socket: WsSocket, raw: string, userKey: string): void {
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) {
      if (parsed.reason !== "malformed") sendError(socket, parsed.reason)
      return
    }
    const message = parsed.message
    if (message.type === "join") {
      handleJoin(socket, message, userKey)
      return
    }
    const session = sessionsBySocket.get(socket)
    if (!session) {
      sendError(socket, "unauthorized")
      return
    }
    switch (message.type) {
      case "signal":
        handleSignal(session, message)
        return
      case "mediaState":
        handleMediaState(session, message)
        return
      case "chat":
        handleChat(session, message)
        return
      case "leave":
        handleLeave(session)
        return
      case "moderate":
        handleModerate(session, message)
        return
    }
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES })
  const heartbeat = setInterval(() => {
    for (const socket of liveSockets) {
      if (socketIsAlive.get(socket) !== true) {
        try {
          socket.terminate()
        } catch {
          continue
        }
        continue
      }
      socketIsAlive.set(socket, false)
      try {
        socket.ping()
      } catch {
        continue
      }
    }
  }, 25000)
  heartbeat.unref()

  wss.on("connection", (socket: WsSocket, request: IncomingMessage) => {
    const userKey = resolveUserKey(request, config)
    const socketRecord = socket as WsSocket & { roomlyIp?: string }
    socketRecord.roomlyIp = userKey
    liveSockets.add(socket)
    socketIsAlive.set(socket, true)
    const joinTimer = setTimeout(() => {
      try {
        socket.terminate()
      } catch {
        return
      }
    }, JOIN_TIMEOUT_MS)
    joinTimer.unref()
    joinTimers.set(socket, joinTimer)
    socket.on("message", (data) => {
      if (typeof data !== "string" && !Buffer.isBuffer(data)) {
        socket.close(1009, "binary not supported")
        return
      }
      const text = data.toString()
      if (text.length > MAX_PAYLOAD_BYTES) return
      handleMessage(socket, text, userKey)
    })
    socket.on("pong", () => {
      socketIsAlive.set(socket, true)
    })
    socket.on("error", () => {
      try {
        socket.terminate()
      } catch {
        return
      }
    })
    socket.on("close", () => {
      const timer = joinTimers.get(socket)
      if (timer) {
        clearTimeout(timer)
        joinTimers.delete(socket)
      }
      liveSockets.delete(socket)
      untrackIp(userKey)
      const session = sessionsBySocket.get(socket)
      if (!session) return
      sessionsBySocket.delete(socket)
      room.scheduleDisconnect(session.participant.id, socket)
    })
  })

  wss.on("error", () => {
    return
  })

  function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const origin = request.headers.origin as string | undefined
    if (origin && !isOriginAllowed(request, origin)) {
      try {
        socket.write("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      } catch {
        return true
      }
      socket.destroy()
      return true
    }
    let pathname = SIGNAL_PATH
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname
    } catch {
      socket.destroy()
      return true
    }
    if (pathname !== SIGNAL_PATH) return false
    const userKey = resolveUserKey(request, config)
    if (!trackIp(userKey)) {
      try {
        socket.write("HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      } catch {
        return true
      }
      socket.destroy()
      return true
    }
    const releaseOnFail = () => untrackIp(userKey)
    wss.handleUpgrade(request, socket, head, (websocket) => {
      websocket.once("close", releaseOnFail)
      wss.emit("connection", websocket, request)
    })
    return true
  }

  const api = {
    wss,
    room,
    handleUpgrade,
    close() {
      clearInterval(heartbeat)
      for (const limiter of limiters) limiter.stop()
      for (const socket of liveSockets) {
        try {
          socket.close(1001, "server shutting down")
        } catch {
          continue
        }
      }
      liveSockets.clear()
      try {
        wss.close()
      } catch {
        return
      }
    },
  }
  publishRoom(room)
  return api
}

export function publishRoom(room: Room): void {
  const store = globalThis as unknown as { roomlyRoom?: Room }
  store.roomlyRoom = room
}

export function sharedRoom(): Room | null {
  const store = globalThis as unknown as { roomlyRoom?: Room }
  return store.roomlyRoom ?? null
}

export function resolveUserKey(request: IncomingMessage, config: ServerConfig): string {
  if (config.trustProxy) {
    const forwarded = request.headers["x-forwarded-for"]
    const headerValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
    const first = headerValue?.split(",")[0]?.trim()
    if (first && isSingleLabelIp(first)) return first
  }
  return request.socket.remoteAddress ?? "unknown"
}

function isSingleLabelIp(value: string): boolean {
  if (value.length === 0 || value.length > 64) return false
  if (value.includes(" ")) return false
  return /^[0-9a-zA-Z.:]+$/.test(value)
}

function isOriginAllowed(request: IncomingMessage, origin: string): boolean {
  let parsed: URL | null = null
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  const host = request.headers.host ?? ""
  if (!host) return true
  return parsed.host === host
}

export { WebSocket }
