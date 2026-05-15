// Общие хелперы для модулей правил. См. docs/game-spec.md §9.

import { CHARACTERS, TOTAL_SEAGULL_TOKENS } from '../constants'
import type { CharacterId } from '../constants'
import { shuffle } from '../prng'
import type {
  EveningSubPhase,
  GameError,
  GameState,
  NavCardInstanceId,
  Phase,
  Player,
  PlayerId,
  Seat,
  SeatIndex,
  SupplyInstanceId,
} from '../types'

// ---------- Ошибки ----------

export function err(
  code: GameError['code'],
  message: string,
): { readonly ok: false; readonly error: GameError } {
  return { ok: false, error: { kind: 'GameError', code, message } }
}

// ---------- Поиск ----------

export function seatOfPlayer(state: GameState, playerId: PlayerId): SeatIndex | null {
  const seat = state.seats.find((s) => s.occupantId === playerId)
  return seat ? seat.index : null
}

export function playerBySeat(state: GameState, seat: SeatIndex): Player | null {
  const s = state.seats[seat]
  if (!s || s.removed || s.occupantId === null) return null
  return state.players[s.occupantId] ?? null
}

export function playerByCharacter(state: GameState, ch: CharacterId): Player | null {
  for (const p of Object.values(state.players)) if (p.character === ch) return p
  return null
}

export function strengthOf(ch: CharacterId): number {
  const c = CHARACTERS.find((x) => x.id === ch)
  if (!c) throw new Error(`Unknown character ${ch}`)
  return c.strength
}

// ---------- Guard'ы для дневных действий ----------

export interface DayTurnGuard {
  readonly playerId: PlayerId
  readonly playerSeat: SeatIndex
}

/** Проверка: фаза = day.waitingForAction И playerId сидит на currentSeat. */
export function requireMyDayTurn(
  state: GameState,
  playerId: PlayerId,
): GameError | DayTurnGuard {
  if (state.phase.kind !== 'day') {
    return mkErr('WRONG_PHASE', `expected phase=day, got ${state.phase.kind}`)
  }
  const sub = state.phase.subPhase
  if (sub.kind !== 'waitingForAction') {
    return mkErr('WRONG_PHASE', `day sub-phase is ${sub.kind}, expected waitingForAction`)
  }
  const player = state.players[playerId]
  if (!player) return mkErr('INVALID_TARGET', `unknown player ${playerId}`)
  if (player.consciousness !== 'conscious') {
    return mkErr('UNCONSCIOUS_OR_DEAD', `player ${playerId} is ${player.consciousness}`)
  }
  const playerSeat = seatOfPlayer(state, playerId)
  if (playerSeat === null) return mkErr('INVALID_TARGET', `player ${playerId} has no seat`)
  if (playerSeat !== sub.currentSeat) {
    return mkErr(
      'NOT_YOUR_TURN',
      `current turn is seat ${sub.currentSeat}, player is at ${playerSeat}`,
    )
  }
  return { playerId, playerSeat }
}

export function isGameError(x: unknown): x is GameError {
  return typeof x === 'object' && x !== null && (x as GameError).kind === 'GameError'
}

// ---------- Реактивные guard'ы (вне драки) ----------

export function notInFight(state: GameState): GameError | null {
  if (state.phase.kind === 'day' && state.phase.subPhase.kind === 'fight') {
    return mkErr('NOT_ALLOWED_DURING_FIGHT', `action not allowed during fight`)
  }
  return null
}

// ---------- Advance turn / day → evening ----------

/** Отметить ход сделанным и сдвинуть указатель. При исчерпании очереди — в вечер. */
export function advanceTurn(state: GameState, playerId: PlayerId): GameState {
  const dayActionsTaken = { ...state.dayActionsTaken, [playerId]: true }
  let idx = state.currentTurnIndex + 1

  // Пропускаем без сознания / мёртвых / уже отстрелявшихся.
  while (idx < state.turnOrder.length) {
    const seatIdx = state.turnOrder[idx]!
    const p = playerBySeat(state, seatIdx)
    if (p && p.consciousness === 'conscious' && !dayActionsTaken[p.id]) break
    idx++
  }

  if (idx >= state.turnOrder.length) {
    return transitionToEvening({ ...state, dayActionsTaken })
  }

  const nextSeat = state.turnOrder[idx]!
  return {
    ...state,
    dayActionsTaken,
    currentTurnIndex: idx,
    phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: nextSeat } },
  }
}

/** Переход day → evening. Picker — ближайший к корме conscious. См. game-rules.md §4.4. */
export function transitionToEvening(state: GameState): GameState {
  let pickerSeat: Seat | null = null
  for (let i = state.seats.length - 1; i >= 0; i--) {
    const s = state.seats[i]
    if (!s || s.removed || s.occupantId === null) continue
    const p = state.players[s.occupantId]
    if (p && p.consciousness === 'conscious') {
      pickerSeat = s
      break
    }
  }
  if (!pickerSeat || pickerSeat.occupantId === null) {
    return { ...state, phase: { kind: 'scoring' } }
  }
  const sub: EveningSubPhase = {
    kind: 'sternPicking',
    pickerId: pickerSeat.occupantId,
    pool: [...state.navPool],
  }
  return { ...state, phase: { kind: 'evening', subPhase: sub } }
}

// ---------- Колода навигации с рециклингом ----------

/**
 * Тянуть count карт с верха navDeck. При нехватке — перетасовать navDiscard и
 * добрать оттуда (decision #18 — рециклинг). Если карт совсем нет — возвращает
 * меньше, чем запрошено.
 */
export function drawNavCards(
  state: GameState,
  count: number,
): { readonly drawn: NavCardInstanceId[]; readonly state: GameState } {
  if (count <= 0) return { drawn: [], state }
  const drawn: NavCardInstanceId[] = []
  let deck = [...state.navDeck]
  let discard = [...state.navDiscard]
  let rng = state.rng

  while (drawn.length < count) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const [reshuffled, nextRng] = shuffle(rng, discard)
      deck = reshuffled
      discard = []
      rng = nextRng
    }
    const top = deck.shift()
    if (top === undefined) break
    drawn.push(top)
  }
  return { drawn, state: { ...state, navDeck: deck, navDiscard: discard, rng } }
}

// ---------- Чайки ----------

/** +1 чайка. Если стало 4 — фаза → scoring. */
export function addSeagull(state: GameState): GameState {
  const next = Math.min(state.seagullTokens + 1, TOTAL_SEAGULL_TOKENS)
  const phase: Phase = next >= TOTAL_SEAGULL_TOKENS ? { kind: 'scoring' } : state.phase
  return { ...state, seagullTokens: next, phase }
}

/** -1 чайка (минимум 0). */
export function removeSeagull(state: GameState): GameState {
  return { ...state, seagullTokens: Math.max(0, state.seagullTokens - 1) }
}

// ---------- Перемещение припасов ----------

export function removeFromHand(
  player: Player,
  supplyId: SupplyInstanceId,
): { player: Player; wasOpen: boolean } | null {
  if (player.openSupplies.includes(supplyId)) {
    return {
      player: { ...player, openSupplies: player.openSupplies.filter((id) => id !== supplyId) },
      wasOpen: true,
    }
  }
  if (player.closedSupplies.includes(supplyId)) {
    return {
      player: { ...player, closedSupplies: player.closedSupplies.filter((id) => id !== supplyId) },
      wasOpen: false,
    }
  }
  return null
}

export function addOpen(player: Player, supplyId: SupplyInstanceId): Player {
  return { ...player, openSupplies: [...player.openSupplies, supplyId] }
}

export function addClosed(player: Player, supplyId: SupplyInstanceId): Player {
  return { ...player, closedSupplies: [...player.closedSupplies, supplyId] }
}

// ---------- Wounds / consciousness ----------

export function applyWoundDelta(player: Player, delta: number): Player {
  const ch = CHARACTERS.find((c) => c.id === player.character)
  if (!ch) throw new Error(`Unknown character ${player.character}`)
  const wounds = Math.max(0, player.wounds + delta)
  const consciousness: Player['consciousness'] =
    wounds < ch.strength ? 'conscious' : wounds === ch.strength ? 'unconscious' : 'dead'
  return { ...player, wounds, consciousness }
}

// ---------- private ----------

function mkErr(code: GameError['code'], message: string): GameError {
  return { kind: 'GameError', code, message }
}
