// Production-обёртка над PeerJS. Реализует HostTransport / ClientTransport.
// Используется на сайте; в тестах вместо неё — in-memory-transport.

import Peer, { type DataConnection } from 'peerjs'
import type { ClientTransport, HostTransport, NetConnection } from './transport'

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
      return new Promise<string>((resolve, reject) => {
        peer = peerId ? new Peer(peerId) : new Peer()
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
      return new Promise<NetConnection>((resolve, reject) => {
        peer = new Peer()
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
