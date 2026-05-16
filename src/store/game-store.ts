// Store: поддерживает 3 режима — hot-seat / host (сеть, авторитет) / client.

import { create } from 'zustand'
import type { Action } from '@/game/actions'
import { reduce } from '@/game/reducer'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { FilteredGameState, GameError, GameEvent, GameState, PlayerId } from '@/game/types'
import { SimpleBot } from '@/bots/simple-bot'
import type { ClientController } from '@/net/client'
import { createClient } from '@/net/client'
import type { HostController } from '@/net/host'
import { createHost } from '@/net/host'
import { createPeerjsClientTransport, createPeerjsHostTransport } from '@/net/peerjs-transport'
import type { LobbyState } from '@/net/protocol'

type Mode = 'local' | 'host' | 'client'

interface GameStore {
  mode: Mode
  state: GameState | FilteredGameState | null
  /** Для host: контроллер; null в других режимах. */
  host: HostController | null
  /** Для client: контроллер. */
  client: ClientController | null
  /** Сетевое лобби (host или client). */
  lobby: LobbyState | null
  /** Свой playerId — для client это назначается host'ом. */
  myPlayerId: PlayerId | null
  /** Code/peer id комнаты для шеринга. */
  roomCode: string | null
  events: GameEvent[]
  lastError: GameError | null
  /** True, если соединение с host'ом потеряно (client-режим). */
  disconnected: boolean

  // Local hot-seat
  startLocalGame: (players: PlayerSpec[], seed: number) => void

  // Host mode
  createRoom: (hostName: string, roomCode?: string) => Promise<{ ok: true; code: string } | { ok: false; error: string }>
  hostStartGame: () => GameError | null
  hostAddBot: (name?: string) => void

  // Client mode
  joinRoom: (
    hostCode: string,
    playerName: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  setReady: (ready: boolean) => void

  // Common
  dispatch: (action: Action) => Promise<boolean>
  reset: () => void
}

function clientToken(): string {
  const KEY = 'za-bortom:clientToken'
  let t = localStorage.getItem(KEY)
  if (!t) {
    t = `tok-${Math.random().toString(36).slice(2)}-${Date.now()}`
    localStorage.setItem(KEY, t)
  }
  return t
}

export const useGameStore = create<GameStore>((set, get) => ({
  mode: 'local',
  state: null,
  host: null,
  client: null,
  lobby: null,
  myPlayerId: null,
  roomCode: null,
  events: [],
  lastError: null,
  disconnected: false,

  // ---------- Local hot-seat ----------
  startLocalGame: (players, seed) => {
    const initial = createInitialState({
      gameId: 'local',
      hostId: players[0]!.id,
      seed,
      players,
    })
    set({ mode: 'local', state: initial, events: [], lastError: null, myPlayerId: null })
    const r = reduce(initial, { kind: 'START_GAME', playerId: players[0]!.id })
    if (r.ok) set({ state: r.state, events: r.events, lastError: null })
  },

  // ---------- Host ----------
  createRoom: async (hostName, roomCode) => {
    try {
      const code = roomCode ?? `boat-${Math.random().toString(36).slice(2, 6)}`
      const transport = createPeerjsHostTransport(code)
      const host = createHost({ transport, hostName })
      const { hostPlayerId } = await host.start()
      set({
        mode: 'host',
        host,
        myPlayerId: hostPlayerId,
        roomCode: code,
        lobby: host.getLobby(),
      })
      host.subscribe((state) => {
        set({ state })
        // Если в лобби обновилось, тоже синкаем.
        if (state.phase.kind === 'lobby') set({ lobby: host.getLobby() })
      })
      // Polling lobby при изменениях клиентов (host меняет внутренне через broadcastLobby)
      // — для упрощения пересчитаем через setInterval:
      const lobbyTimer = setInterval(() => set({ lobby: host.getLobby() }), 500)
      // cleanup при reset — оставим утечкой пока (browser cleanup при выходе)
      void lobbyTimer
      return { ok: true, code }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  hostAddBot: (name) => {
    const host = get().host
    if (!host) return
    const botName = name ?? `Bot${Math.floor(Math.random() * 100)}`
    host.addBot(botName, (pid) => new SimpleBot(pid))
    set({ lobby: host.getLobby() })
  },

  hostStartGame: () => {
    const host = get().host
    if (!host) return { kind: 'GameError', code: 'NOT_HOST', message: 'No host' } as GameError
    const r = host.startGame()
    // r может быть GameState или GameError. Различаем через 'kind' с типом GameError.
    if ('kind' in r && r.kind === 'GameError') {
      set({ lastError: r })
      return r
    }
    set({ state: r as GameState })
    return null
  },

  // ---------- Client ----------
  joinRoom: async (hostCode, playerName) => {
    try {
      const transport = createPeerjsClientTransport()
      const client = createClient({
        transport,
        hostId: hostCode,
        playerName,
        clientToken: clientToken(),
      })
      const r = await client.start()
      if ('error' in r) return { ok: false, error: r.error }
      set({
        mode: 'client',
        client,
        myPlayerId: r.playerId,
        lobby: r.lobby,
        roomCode: hostCode,
      })
      client.onLobby((lobby) => set({ lobby }))
      client.onState((view) => set({ state: view }))
      client.onGameStart((view) => set({ state: view }))
      client.onClose(() => {
        set({ disconnected: true })
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  setReady: (ready) => {
    get().client?.setReady(ready)
  },

  // ---------- Common dispatch ----------
  dispatch: async (action) => {
    const { mode, state, events, host, client } = get()
    if (mode === 'local') {
      if (!state) return false
      const r = reduce(state as GameState, action)
      if (r.ok) {
        set({ state: r.state, events: [...events, ...r.events], lastError: null })
        return true
      }
      set({ lastError: r.error })
      return false
    }
    if (mode === 'host' && host) {
      const err = host.dispatch(action)
      if (err) {
        set({ lastError: err })
        return false
      }
      return true
    }
    if (mode === 'client' && client) {
      const err = await client.dispatch(action)
      if (err) {
        set({ lastError: err })
        return false
      }
      return true
    }
    return false
  },

  reset: () => {
    const { host, client } = get()
    host?.close()
    client?.close()
    set({
      mode: 'local',
      state: null,
      host: null,
      client: null,
      lobby: null,
      myPlayerId: null,
      roomCode: null,
      events: [],
      lastError: null,
      disconnected: false,
    })
  },
}))
