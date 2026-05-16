// Host runtime: единый источник истины для GameState.
// Принимает connections от клиентов, обрабатывает их ACTION'ы через reducer,
// рассылает FilteredGameState каждому.

import type { Bot } from '@/bots/bot'
import type { Action } from '@/game/actions'
import { reduce } from '@/game/reducer'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { GameError, GameState, PlayerId } from '@/game/types'
import { filterStateForPlayer } from '@/game/visibility'
import type { ClientMessage, HostMessage, LobbyPlayer, LobbyState } from './protocol'
import type { HostTransport, NetConnection } from './transport'

export interface HostOptions {
  readonly transport: HostTransport
  readonly hostName: string
  /** Seed для PRNG. По умолчанию случайный. */
  readonly seed?: number
  /** Сколько максимум игроков можно принять (4..6). */
  readonly maxPlayers?: number
}

interface ClientSlot {
  readonly conn: NetConnection
  readonly clientToken: string
  readonly playerId: PlayerId
  ready: boolean
  disconnected: boolean
}

export interface HostController {
  /** Запуск: открыть transport, начать принимать клиентов. */
  start(): Promise<{ hostId: string; hostPlayerId: PlayerId }>
  /** Стартовать игру (только из лобби). Возвращает initial state. */
  startGame(): GameState | GameError
  /** Получить текущий state (host видит полный). */
  getState(): GameState | null
  /** Отправить action как host (например, для host-игрока). */
  dispatch(action: Action): GameError | null
  /** Получить current LobbyState (если ещё в лобби). */
  getLobby(): LobbyState
  /** Добавить бота в лобби. Возвращает выданный playerId. */
  addBot(name: string, makeBot: (pid: PlayerId) => Bot): PlayerId
  /** Привязать бота к существующему игроку (для self-play / host-бота). */
  attachBot(playerId: PlayerId, bot: Bot): void
  /** Подписка на изменения state на стороне host'а. */
  subscribe(handler: (state: GameState) => void): () => void
  /** Закрыть host. */
  close(): void
}

/** Создать host-controller. */
export function createHost(opts: HostOptions): HostController {
  const slots = new Map<PlayerId, ClientSlot>()
  const bots = new Map<PlayerId, Bot>()
  let hostId = ''
  let hostPlayerId: PlayerId = ''
  let state: GameState | null = null
  let nextPlayerNum = 1
  const subscribers: Array<(s: GameState) => void> = []
  const maxPlayers = opts.maxPlayers ?? 6
  const isBot = new Set<PlayerId>()

  function broadcast() {
    if (!state) return
    for (const sub of subscribers) sub(state)
    for (const slot of slots.values()) {
      if (slot.disconnected) continue
      if (slot.playerId === hostPlayerId) continue
      if (isBot.has(slot.playerId)) continue
      const view = filterStateForPlayer(state, slot.playerId)
      send(slot.conn, { kind: 'state-update', view })
    }
  }

  function emit() {
    broadcast()
    driveBots()
  }

  /** После каждого state-update проходим ботов: пусть ходят, пока могут. */
  function driveBots() {
    if (!state) return
    if (bots.size === 0) return
    let iterations = 0
    const maxIter = 2000
    while (iterations++ < maxIter) {
      let acted = false
      for (const bot of bots.values()) {
        if (!state) break
        const view = filterStateForPlayer(state, bot.playerId)
        const action = bot.decide(view)
        if (!action) continue
        const r = reduce(state, action)
        if (r.ok) {
          state = r.state
          broadcast()
          acted = true
          break // перезапуск цикла — state изменился
        } else {
          // Бот вернул невалидное действие — пробуем SKIP fallback и идём дальше.
          if (
            state.phase.kind === 'day' &&
            state.phase.subPhase.kind === 'waitingForAction' &&
            state.seats[state.phase.subPhase.currentSeat]?.occupantId === bot.playerId
          ) {
            const skip = reduce(state, { kind: 'SKIP_TURN', playerId: bot.playerId })
            if (skip.ok) {
              state = skip.state
              broadcast()
              acted = true
              break
            }
          }
          // Логируем и НЕ повторяем тот же action (бот в следующей итерации может выдать другой).
          console.warn('[bot]', bot.playerId, 'invalid', action, r.error)
        }
      }
      if (!acted) break
    }
    if (iterations >= maxIter) {
      console.error('[bot] driveBots exceeded max iterations — possible deadlock')
    }
  }

  function send(conn: NetConnection, msg: HostMessage): void {
    conn.send(msg)
  }

  function broadcastLobby() {
    const lobby = computeLobby()
    for (const slot of slots.values()) {
      if (slot.disconnected) continue
      if (slot.playerId === hostPlayerId) continue
      send(slot.conn, { kind: 'lobby-update', lobby })
    }
  }

  function computeLobby(): LobbyState {
    const players: LobbyPlayer[] = []
    for (const slot of slots.values()) {
      const isHost = slot.playerId === hostPlayerId
      const bot = isBot.has(slot.playerId)
      players.push({
        id: slot.playerId,
        displayName: nameOf(slot.playerId),
        isBot: bot,
        ready: isHost || bot ? true : slot.ready,
        disconnected: slot.disconnected,
      })
    }
    const conscious = players.filter((p) => !p.disconnected)
    return {
      hostId: hostPlayerId,
      players,
      canStart: conscious.length >= 4 && conscious.length <= maxPlayers && conscious.every((p) => p.ready),
    }
  }

  const playerNames = new Map<PlayerId, string>()
  function nameOf(pid: PlayerId): string {
    return playerNames.get(pid) ?? pid
  }

  function addPlayer(displayName: string): PlayerId {
    const pid = `p-${nextPlayerNum++}`
    playerNames.set(pid, displayName)
    return pid
  }

  function handleClientMessage(slot: ClientSlot, raw: unknown) {
    if (!raw || typeof raw !== 'object' || !('kind' in raw)) return
    const msg = raw as ClientMessage
    switch (msg.kind) {
      case 'ready': {
        slot.ready = msg.ready
        broadcastLobby()
        return
      }
      case 'action': {
        if (!state) {
          send(slot.conn, {
            kind: 'action-rejected',
            actionId: msg.actionId,
            error: { kind: 'GameError', code: 'GAME_NOT_STARTED', message: 'Game has not started' },
          })
          return
        }
        const r = reduce(state, msg.action)
        if (r.ok) {
          state = r.state
          send(slot.conn, { kind: 'action-accepted', actionId: msg.actionId })
          emit()
        } else {
          send(slot.conn, {
            kind: 'action-rejected',
            actionId: msg.actionId,
            error: r.error,
          })
        }
        return
      }
      case 'request-state': {
        if (state) {
          send(slot.conn, {
            kind: 'state-update',
            view: filterStateForPlayer(state, slot.playerId),
          })
        }
        return
      }
      case 'ping': {
        send(slot.conn, { kind: 'pong', nonce: msg.nonce })
        return
      }
      case 'leave': {
        slot.disconnected = true
        broadcastLobby()
        return
      }
      case 'join-request': {
        // Должно обрабатываться раньше, на момент new connection. Игнорируем.
        return
      }
    }
  }

  function handleNewConnection(conn: NetConnection) {
    let slot: ClientSlot | null = null
    const offData = conn.onData((raw) => {
      // Первое сообщение должно быть join-request.
      if (!slot) {
        if (!raw || typeof raw !== 'object' || !('kind' in raw)) return
        const msg = raw as ClientMessage
        if (msg.kind !== 'join-request') {
          send(conn, { kind: 'join-rejected', reason: 'First message must be join-request' })
          conn.close()
          return
        }
        // Reconnect?
        let existingSlot: ClientSlot | null = null
        for (const s of slots.values()) {
          if (s.clientToken === msg.clientToken) {
            existingSlot = s
            break
          }
        }
        if (existingSlot) {
          // Reconnect
          existingSlot.disconnected = false
          slot = existingSlot
          // ;(existingSlot as { conn: NetConnection }).conn = conn  // обновить conn — но conn readonly
          // Простой путь: пересоздать slot c новым conn
          const newSlot: ClientSlot = {
            conn,
            clientToken: existingSlot.clientToken,
            playerId: existingSlot.playerId,
            ready: existingSlot.ready,
            disconnected: false,
          }
          slots.set(existingSlot.playerId, newSlot)
          slot = newSlot
        } else {
          // Новый игрок: только если в лобби.
          if (state !== null && state.phase.kind !== 'lobby') {
            send(conn, { kind: 'join-rejected', reason: 'Game already started' })
            conn.close()
            return
          }
          if (slots.size >= maxPlayers) {
            send(conn, { kind: 'join-rejected', reason: 'Room full' })
            conn.close()
            return
          }
          const pid = addPlayer(msg.name)
          slot = {
            conn,
            clientToken: msg.clientToken,
            playerId: pid,
            ready: false,
            disconnected: false,
          }
          slots.set(pid, slot)
        }

        send(conn, { kind: 'join-accepted', playerId: slot.playerId, lobby: computeLobby() })
        broadcastLobby()

        // Если игра уже идёт (reconnect случай) — отправить state.
        if (state && state.phase.kind !== 'lobby') {
          send(conn, {
            kind: 'state-update',
            view: filterStateForPlayer(state, slot.playerId),
          })
        }
        return
      }
      handleClientMessage(slot, raw)
    })

    conn.onClose(() => {
      offData()
      if (slot) slot.disconnected = true
      broadcastLobby()
      // Подписчики на network state могут хотеть знать.
      for (const s of slots.values()) {
        if (s.disconnected) continue
        if (s.playerId === hostPlayerId) continue
        if (slot) send(s.conn, { kind: 'player-disconnected', playerId: slot.playerId })
      }
    })
  }

  return {
    async start() {
      hostId = await opts.transport.open()
      // Host сам — игрок №1.
      hostPlayerId = addPlayer(opts.hostName)
      // Создаём слот для host'а без conn (он не подключается через сеть).
      const fakeConn: NetConnection = {
        remoteId: hostId,
        send: () => {},
        onData: () => () => {},
        onClose: () => () => {},
        close: () => {},
      }
      slots.set(hostPlayerId, {
        conn: fakeConn,
        clientToken: 'host-token',
        playerId: hostPlayerId,
        ready: true,
        disconnected: false,
      })
      opts.transport.onConnection((conn) => handleNewConnection(conn))
      return { hostId, hostPlayerId }
    },

    startGame() {
      const lobby = computeLobby()
      if (!lobby.canStart) {
        return { kind: 'GameError', code: 'BUSINESS_RULE_VIOLATION', message: 'Not enough ready players' }
      }
      const players: PlayerSpec[] = []
      for (const slot of slots.values()) {
        players.push({
          id: slot.playerId,
          displayName: nameOf(slot.playerId),
          isBot: false,
        })
      }
      const seed = opts.seed ?? Math.floor(Math.random() * 0x7fffffff)
      const initial = createInitialState({ gameId: 'net', hostId: hostPlayerId, seed, players })
      const r = reduce(initial, { kind: 'START_GAME', playerId: hostPlayerId })
      if (!r.ok) return r.error
      state = r.state
      // Разослать всем GAME_START + view.
      for (const slot of slots.values()) {
        if (slot.disconnected) continue
        if (slot.playerId === hostPlayerId) continue
        send(slot.conn, {
          kind: 'game-start',
          view: filterStateForPlayer(state, slot.playerId),
          you: slot.playerId,
        })
      }
      emit()
      return state
    },

    getState() {
      return state
    },

    dispatch(action) {
      if (!state) {
        return { kind: 'GameError', code: 'GAME_NOT_STARTED', message: 'No game state' }
      }
      const r = reduce(state, action)
      if (r.ok) {
        state = r.state
        emit()
        return null
      }
      return r.error
    },

    getLobby: computeLobby,

    attachBot(playerId, bot) {
      isBot.add(playerId)
      bots.set(playerId, bot)
      // Если игра уже идёт — пнём ботов.
      if (state) driveBots()
    },

    addBot(name, makeBot) {
      if (state !== null) throw new Error('Cannot add bot after game started')
      if (slots.size >= maxPlayers) throw new Error('Room full')
      const pid = addPlayer(name)
      isBot.add(pid)
      const fakeConn: NetConnection = {
        remoteId: pid,
        send: () => {},
        onData: () => () => {},
        onClose: () => () => {},
        close: () => {},
      }
      slots.set(pid, {
        conn: fakeConn,
        clientToken: `bot-${pid}`,
        playerId: pid,
        ready: true,
        disconnected: false,
      })
      bots.set(pid, makeBot(pid))
      broadcastLobby()
      return pid
    },

    subscribe(handler) {
      subscribers.push(handler)
      return () => {
        const i = subscribers.indexOf(handler)
        if (i >= 0) subscribers.splice(i, 1)
      }
    },

    close() {
      for (const slot of slots.values()) slot.conn.close()
      opts.transport.close()
    },
  }
}
