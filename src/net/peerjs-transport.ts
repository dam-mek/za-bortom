// Production-обёртка над PeerJS. Реализует HostTransport / ClientTransport.
// Используется на сайте; в тестах вместо неё — in-memory-transport.

import Peer, { type DataConnection, type PeerOptions } from 'peerjs'
import type { ClientTransport, HostTransport, NetConnection } from './transport'

// ---------- ICE servers (STUN/TURN) ----------
//
// Зачем нужен TURN: без него WebRTC не пробивает двойной NAT (VPN, corporate
// firewall, симметричный CGNAT). PeerJS по умолчанию даёт только Google STUN,
// чего часто не хватает.
//
// Креды берём с нашего же домена /api/turn — это Cloudflare Pages Function,
// которая обращается к Cloudflare TURN API под секретом и отдаёт временные
// (24h) ICE-серверы. См. functions/api/turn.ts.
//
// Если TURN не настроен / Function упала — fallback на публичные STUN,
// чтобы хотя бы между «прозрачными» сетями работало.

interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

const FALLBACK_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

let iceServersCache: { servers: IceServer[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 часов (CF выдаёт на 24h)

async function fetchIceServers(): Promise<IceServer[]> {
  // Используем кэш если свежий.
  if (iceServersCache && Date.now() - iceServersCache.fetchedAt < CACHE_TTL_MS) {
    return iceServersCache.servers
  }

  try {
    const res = await fetch('/api/turn', { method: 'GET' })
    if (!res.ok) {
      console.warn('[net] /api/turn responded', res.status, '— using STUN fallback')
      return FALLBACK_ICE_SERVERS
    }
    const data = (await res.json()) as { iceServers?: IceServer | IceServer[] }
    // CF возвращает iceServers как один объект (urls — массив), нормализуем.
    const raw = data.iceServers
    if (!raw) return FALLBACK_ICE_SERVERS
    const servers = Array.isArray(raw) ? raw : [raw]
    iceServersCache = { servers, fetchedAt: Date.now() }
    return servers
  } catch (e) {
    console.warn('[net] failed to fetch /api/turn — using STUN fallback:', e)
    return FALLBACK_ICE_SERVERS
  }
}

async function buildPeerOptions(): Promise<PeerOptions> {
  const iceServers = await fetchIceServers()
  return {
    config: {
      iceServers,
      // iceTransportPolicy: 'all' — пробуем сначала прямое соединение,
      // если не получается — релэим через TURN.
      iceTransportPolicy: 'all',
    },
  }
}

// ---------- Connection wrapper ----------

function wrapConnection(conn: DataConnection): NetConnection {
  const dataHandlers: Array<(d: unknown) => void> = []
  const closeHandlers: Array<() => void> = []
  let closed = false

  conn.on('data', (data) => {
    for (const h of dataHandlers) h(data)
  })
  conn.on('close', () => {
    if (closed) return
    closed = true
    for (const h of closeHandlers) h()
  })
  conn.on('error', () => {
    // Логируем где-то; пока тихо.
  })

  return {
    remoteId: conn.peer,
    send(data) {
      if (!closed) conn.send(data)
    },
    onData(handler) {
      dataHandlers.push(handler)
      return () => {
        const i = dataHandlers.indexOf(handler)
        if (i >= 0) dataHandlers.splice(i, 1)
      }
    },
    onClose(handler) {
      closeHandlers.push(handler)
      return () => {
        const i = closeHandlers.indexOf(handler)
        if (i >= 0) closeHandlers.splice(i, 1)
      }
    },
    close() {
      if (!closed) {
        closed = true
        conn.close()
      }
    },
  }
}

/** Создать host transport. peerId — если задан, фиксируем (короткий код); иначе автогенерация. */
export function createPeerjsHostTransport(peerId?: string): HostTransport {
  let peer: Peer | null = null
  const handlers: Array<(c: NetConnection) => void> = []

  return {
    async open() {
      const options = await buildPeerOptions()
      return new Promise<string>((resolve, reject) => {
        peer = peerId ? new Peer(peerId, options) : new Peer(options)
        peer.on('open', (id) => resolve(id))
        peer.on('error', (err) => reject(err))
        peer.on('connection', (conn) => {
          conn.on('open', () => {
            const wrapped = wrapConnection(conn)
            for (const h of handlers) h(wrapped)
          })
        })
      })
    },
    onConnection(handler) {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i >= 0) handlers.splice(i, 1)
      }
    },
    close() {
      peer?.destroy()
      peer = null
      handlers.length = 0
    },
  }
}

/** Создать client transport. */
export function createPeerjsClientTransport(): ClientTransport {
  let peer: Peer | null = null

  return {
    async connect(hostId: string) {
      const options = await buildPeerOptions()
      return new Promise<NetConnection>((resolve, reject) => {
        peer = new Peer(options)
        peer.on('open', () => {
          const conn = peer!.connect(hostId, { reliable: true })
          conn.on('open', () => resolve(wrapConnection(conn)))
          conn.on('error', (err) => reject(err))
        })
        peer.on('error', (err) => reject(err))
      })
    },
    close() {
      peer?.destroy()
      peer = null
    },
  }
}
