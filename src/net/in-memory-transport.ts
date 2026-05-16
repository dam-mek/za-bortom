// In-memory транспорт для тестов: эмулирует host + N клиентов в одном процессе.
// Создаём пару (hostTransport, factory) — host «слушает», клиенты «подключаются».

import type { ClientTransport, HostTransport, NetConnection } from './transport'

/** Создать связку из 1 host'а и фабрики клиентов. */
export function createInMemoryNetwork(hostId = 'host'): {
  host: HostTransport
  newClient: (clientId: string) => ClientTransport
} {
  type Listener<T> = (v: T) => void

  const connectionListeners: Listener<NetConnection>[] = []

  function makeConnection(localId: string, remoteId: string): {
    local: NetConnection
    remote: NetConnection
  } {
    const localDataHandlers: Listener<unknown>[] = []
    const localCloseHandlers: Listener<void>[] = []
    const remoteDataHandlers: Listener<unknown>[] = []
    const remoteCloseHandlers: Listener<void>[] = []
    let closed = false

    function close() {
      if (closed) return
      closed = true
      // emit close on both sides (async to mimic real)
      queueMicrotask(() => {
        for (const h of localCloseHandlers) h()
        for (const h of remoteCloseHandlers) h()
      })
    }

    const local: NetConnection = {
      remoteId,
      send(data) {
        if (closed) return
        // Передача на другую сторону — асинхронная (через microtask).
        queueMicrotask(() => {
          for (const h of remoteDataHandlers) h(data)
        })
      },
      onData(handler) {
        localDataHandlers.push(handler)
        return () => {
          const i = localDataHandlers.indexOf(handler)
          if (i >= 0) localDataHandlers.splice(i, 1)
        }
      },
      onClose(handler) {
        localCloseHandlers.push(handler)
        return () => {
          const i = localCloseHandlers.indexOf(handler)
          if (i >= 0) localCloseHandlers.splice(i, 1)
        }
      },
      close,
    }
    const remote: NetConnection = {
      remoteId: localId,
      send(data) {
        if (closed) return
        queueMicrotask(() => {
          for (const h of localDataHandlers) h(data)
        })
      },
      onData(handler) {
        remoteDataHandlers.push(handler)
        return () => {
          const i = remoteDataHandlers.indexOf(handler)
          if (i >= 0) remoteDataHandlers.splice(i, 1)
        }
      },
      onClose(handler) {
        remoteCloseHandlers.push(handler)
        return () => {
          const i = remoteCloseHandlers.indexOf(handler)
          if (i >= 0) remoteCloseHandlers.splice(i, 1)
        }
      },
      close,
    }
    return { local, remote }
  }

  const host: HostTransport = {
    async open() {
      return hostId
    },
    onConnection(handler) {
      connectionListeners.push(handler)
      return () => {
        const i = connectionListeners.indexOf(handler)
        if (i >= 0) connectionListeners.splice(i, 1)
      }
    },
    close() {
      connectionListeners.length = 0
    },
  }

  function newClient(clientId: string): ClientTransport {
    return {
      async connect(targetId: string): Promise<NetConnection> {
        if (targetId !== hostId) {
          throw new Error(`In-memory transport: only host id "${hostId}" allowed, got "${targetId}"`)
        }
        const { local, remote } = makeConnection(clientId, hostId)
        // remote — это сторона host'а
        queueMicrotask(() => {
          for (const h of connectionListeners) {
            // Меняем remoteId у remote с hostId на clientId (host видит клиента)
            const hostSideConn: NetConnection = { ...remote, remoteId: clientId }
            // Но onData/onClose должны привязываться к remote, а не к копии — упростим:
            // используем remote как есть, но с правильным remoteId через прокси.
            h(hostSideConn)
          }
        })
        return local
      },
      close() {
        // noop в моке
      },
    }
  }

  return { host, newClient }
}
