// Client runtime: подключается к host'у, отправляет actions, принимает state.

import type { Action } from '@/game/actions'
import type { FilteredGameState, GameError, PlayerId } from '@/game/types'
import type { ClientMessage, HostMessage, LobbyState } from './protocol'
import type { ClientTransport, NetConnection } from './transport'

export interface ClientOptions {
  readonly transport: ClientTransport
  readonly hostId: string
  readonly playerName: string
  readonly clientToken: string
}

export interface ClientController {
  /** Открыть соединение и отправить join-request. */
  start(): Promise<{ playerId: PlayerId; lobby: LobbyState } | { error: string }>
  setReady(ready: boolean): void
  /** Отправить action на host. Возвращает promise, который разрешается ACK/error. */
  dispatch(action: Action): Promise<GameError | null>
  /** Подписка на STATE_UPDATE. */
  onState(handler: (view: FilteredGameState, lastActionId?: string) => void): () => void
  /** Подписка на LOBBY_UPDATE. */
  onLobby(handler: (lobby: LobbyState) => void): () => void
  /** Подписка на GAME_START. */
  onGameStart(handler: (view: FilteredGameState) => void): () => void
  /** Подписка на disconnect. */
  onClose(handler: () => void): () => void
  /** Получить свой playerId (после join-accepted). */
  getMyPlayerId(): PlayerId | null
  close(): void
}

let actionCounter = 0
function nextActionId(): string {
  return `act-${++actionCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function createClient(opts: ClientOptions): ClientController {
  let conn: NetConnection | null = null
  let myPlayerId: PlayerId | null = null
  const stateHandlers: Array<(v: FilteredGameState, id?: string) => void> = []
  const lobbyHandlers: Array<(l: LobbyState) => void> = []
  const gameStartHandlers: Array<(v: FilteredGameState) => void> = []
  const closeHandlers: Array<() => void> = []
  const pendingAcks = new Map<
    string,
    { resolve: (err: GameError | null) => void }
  >()

  function send(msg: ClientMessage) {
    if (!conn) throw new Error('not connected')
    conn.send(msg)
  }

  function handleHostMessage(raw: unknown) {
    if (!raw || typeof raw !== 'object' || !('kind' in raw)) return
    const msg = raw as HostMessage
    switch (msg.kind) {
      case 'join-accepted':
        myPlayerId = msg.playerId
        for (const h of lobbyHandlers) h(msg.lobby)
        return
      case 'join-rejected':
        return
      case 'lobby-update':
        for (const h of lobbyHandlers) h(msg.lobby)
        return
      case 'game-start':
        for (const h of gameStartHandlers) h(msg.view)
        for (const h of stateHandlers) h(msg.view)
        return
      case 'state-update':
        for (const h of stateHandlers) h(msg.view, msg.lastActionId)
        return
      case 'action-accepted': {
        const p = pendingAcks.get(msg.actionId)
        if (p) {
          p.resolve(null)
          pendingAcks.delete(msg.actionId)
        }
        return
      }
      case 'action-rejected': {
        const p = pendingAcks.get(msg.actionId)
        if (p) {
          p.resolve(msg.error)
          pendingAcks.delete(msg.actionId)
        }
        return
      }
      case 'player-disconnected':
      case 'player-reconnected':
      case 'pong':
      case 'game-over':
      case 'host-going-down':
        return
    }
  }

  return {
    async start() {
      try {
        conn = await opts.transport.connect(opts.hostId)
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
      conn.onData(handleHostMessage)
      conn.onClose(() => {
        for (const h of closeHandlers) h()
      })
      // Отправить join-request и подождать первого LOBBY (через listener).
      return new Promise<{ playerId: PlayerId; lobby: LobbyState } | { error: string }>((resolve) => {
        const off = (() => {
          const handler = (raw: unknown) => {
            if (!raw || typeof raw !== 'object' || !('kind' in raw)) return
            const m = raw as HostMessage
            if (m.kind === 'join-accepted') {
              resolve({ playerId: m.playerId, lobby: m.lobby })
            } else if (m.kind === 'join-rejected') {
              resolve({ error: m.reason })
            } else return
            off?.()
          }
          return conn!.onData(handler)
        })()
        send({ kind: 'join-request', name: opts.playerName, clientToken: opts.clientToken })
      })
    },

    setReady(ready) {
      send({ kind: 'ready', ready })
    },

    async dispatch(action) {
      const actionId = nextActionId()
      return new Promise<GameError | null>((resolve) => {
        pendingAcks.set(actionId, { resolve })
        send({ kind: 'action', actionId, action })
      })
    },

    onState(handler) {
      stateHandlers.push(handler)
      return () => {
        const i = stateHandlers.indexOf(handler)
        if (i >= 0) stateHandlers.splice(i, 1)
      }
    },
    onLobby(handler) {
      lobbyHandlers.push(handler)
      return () => {
        const i = lobbyHandlers.indexOf(handler)
        if (i >= 0) lobbyHandlers.splice(i, 1)
      }
    },
    onGameStart(handler) {
      gameStartHandlers.push(handler)
      return () => {
        const i = gameStartHandlers.indexOf(handler)
        if (i >= 0) gameStartHandlers.splice(i, 1)
      }
    },
    onClose(handler) {
      closeHandlers.push(handler)
      return () => {
        const i = closeHandlers.indexOf(handler)
        if (i >= 0) closeHandlers.splice(i, 1)
      }
    },
    getMyPlayerId() {
      return myPlayerId
    },
    close() {
      conn?.close()
      opts.transport.close()
    },
  }
}
