// Фаза «Утро» — раздача припасов. См. docs/game-rules.md §4.1.
//
// Поток:
//   1. enterMorning(state): определяет conscious-цепочку, тянет N карт (или меньше,
//      если в колоде <N — см. decisions.md #17), кладёт их в pile, выставляет
//      phase = morning.distributing { currentSeat, pile }.
//      Если 0 conscious или колода пуста → пропускает фазу, идёт в day.
//   2. chooseSupply(state, action): валидирует, что текущий conscious игрок выбирает
//      карту из pile, перекладывает её в closedSupplies, передаёт остаток следующему
//      conscious в seat order. Когда pile пустеет — переход в day.

import type {
  GameError,
  GameEvent,
  GameState,
  MorningSubPhase,
  Phase,
  PlayerId,
  ReducerResult,
  SeatIndex,
  SupplyInstanceId,
} from '../types'

// ---------- Helpers ----------

/** Найти первую банку, начиная с fromSeat (включительно), где сидит conscious игрок. */
function nextConsciousSeat(state: GameState, fromSeat: SeatIndex): SeatIndex | null {
  for (let i = fromSeat; i < state.seats.length; i++) {
    const seat = state.seats[i]
    if (!seat || seat.removed || seat.occupantId === null) continue
    const p = state.players[seat.occupantId]
    if (p && p.consciousness === 'conscious') return seat.index
  }
  return null
}

function consciousCount(state: GameState): number {
  return Object.values(state.players).filter((p) => p.consciousness === 'conscious').length
}

function seatOfPlayer(state: GameState, playerId: PlayerId): SeatIndex | null {
  const seat = state.seats.find((s) => s.occupantId === playerId)
  return seat ? seat.index : null
}

function emptyDayActions(state: GameState): Record<PlayerId, boolean> {
  const out: Record<PlayerId, boolean> = {}
  for (const id of Object.keys(state.players)) out[id] = false
  return out
}

/** Перейти в day-фазу. Заполняет turnOrder и сбрасывает dayActions/rowed/fought. */
function transitionToDay(state: GameState): GameState {
  const turnOrder: SeatIndex[] = []
  for (const seat of state.seats) {
    if (seat.removed || seat.occupantId === null) continue
    const p = state.players[seat.occupantId]
    if (p && p.consciousness === 'conscious') turnOrder.push(seat.index)
  }

  const players: Record<PlayerId, GameState['players'][PlayerId]> = {}
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { ...p, rowed: false, fought: false, hasUsedShketSteal: false }
  }

  const firstSeat = turnOrder[0]
  const phase: Phase =
    firstSeat !== undefined
      ? { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: firstSeat } }
      : // Нет conscious игроков — теоретически уходим в вечер; пока маркируем scoring.
        { kind: 'scoring' }

  return {
    ...state,
    players,
    phase,
    turnOrder,
    currentTurnIndex: 0,
    dayActionsTaken: emptyDayActions({ ...state, players }),
  }
}

// ---------- Public API ----------

/**
 * Перейти в утро нового дня. Тянет min(N, deckSize) карт, где N — число conscious.
 * Если N=0 или колода пуста — пропускает утро, идёт сразу в day.
 *
 * Возвращает state без `events` — события генерируются позже reducer'ом.
 */
export function enterMorning(state: GameState): GameState {
  const n = consciousCount(state)
  const nextDay = state.day + 1
  const baseState: GameState = { ...state, day: nextDay }

  if (n === 0) {
    // Никого в сознании — пропускаем утро, идём в day (где dispatch обнаружит
    // отсутствие conscious и пойдёт дальше). В Фазе 2 — просто scoring.
    return { ...baseState, phase: { kind: 'scoring' } }
  }
  if (state.supplyDeck.length === 0) {
    // Колода пуста — пропускаем утро, переходим в день.
    return transitionToDay(baseState)
  }

  // Тянем min(N, deckSize) карт. Decision #17: раздают сколько есть.
  const drawCount = Math.min(n, state.supplyDeck.length)
  const pile = state.supplyDeck.slice(0, drawCount)
  const supplyDeck = state.supplyDeck.slice(drawCount)

  const firstSeat = nextConsciousSeat(baseState, 0)
  if (firstSeat === null) {
    // Защитный код: n>0 но никого не нашли — теоретически невозможно.
    return transitionToDay(baseState)
  }

  const subPhase: MorningSubPhase = { kind: 'distributing', currentSeat: firstSeat, pile }
  return {
    ...baseState,
    supplyDeck,
    phase: { kind: 'morning', subPhase },
  }
}

/** Применить действие CHOOSE_SUPPLY. */
export function chooseSupply(
  state: GameState,
  playerId: PlayerId,
  supplyId: SupplyInstanceId,
): ReducerResult {
  if (state.phase.kind !== 'morning') {
    return err('WRONG_PHASE', `CHOOSE_SUPPLY allowed only in morning, current=${state.phase.kind}`)
  }
  const sub = state.phase.subPhase
  if (sub.kind !== 'distributing') {
    return err('WRONG_PHASE', `Morning sub-phase is "${sub.kind}", expected "distributing"`)
  }

  const player = state.players[playerId]
  if (!player) return err('INVALID_TARGET', `Unknown player ${playerId}`)
  if (player.consciousness !== 'conscious') {
    return err('UNCONSCIOUS_OR_DEAD', `Player ${playerId} is ${player.consciousness}`)
  }

  const playerSeat = seatOfPlayer(state, playerId)
  if (playerSeat !== sub.currentSeat) {
    return err('NOT_YOUR_TURN', `It's seat ${sub.currentSeat}'s pick, player is at seat ${playerSeat}`)
  }

  if (!sub.pile.includes(supplyId)) {
    return err('CARD_NOT_OWNED', `Supply ${supplyId} is not in the morning pile`)
  }

  // Применить: убрать карту из pile, добавить в closedSupplies игрока.
  const newPile = sub.pile.filter((id) => id !== supplyId)
  const updatedPlayer = {
    ...player,
    closedSupplies: [...player.closedSupplies, supplyId],
  }
  const players = { ...state.players, [playerId]: updatedPlayer }

  // Определить следующего conscious. Если pile пуст — переход в day.
  let nextState: GameState = { ...state, players }

  if (newPile.length === 0) {
    nextState = { ...nextState, phase: { kind: 'morning', subPhase: { kind: 'done' } } }
    nextState = transitionToDay(nextState)
  } else {
    const nextSeat = nextConsciousSeat(nextState, (sub.currentSeat + 1) as SeatIndex)
    if (nextSeat === null) {
      // Никого больше не осталось в сознании, но карты ещё есть — теоретически
      // невозможно, т.к. drawCount = consciousCount. Сбрасываем pile в discard.
      nextState = {
        ...nextState,
        supplyDiscard: [...nextState.supplyDiscard, ...newPile],
        phase: { kind: 'morning', subPhase: { kind: 'done' } },
      }
      nextState = transitionToDay(nextState)
    } else {
      nextState = {
        ...nextState,
        phase: {
          kind: 'morning',
          subPhase: { kind: 'distributing', currentSeat: nextSeat, pile: newPile },
        },
      }
    }
  }

  // Timestamp проставит host перед broadcast (см. net/host.ts). В reducer'е
  // нельзя использовать Date.now() — это нарушает чистоту/детерминизм (CLAUDE.md §6).
  const events: GameEvent[] = [
    {
      timestamp: 0,
      kind: 'CHOSE_SUPPLY',
      payload: { playerId, supplyId },
      visibleTo: [playerId], // содержимое карты приватно
    },
  ]
  return { ok: true, state: nextState, events }
}

// ---------- private ----------

function err(code: GameError['code'], message: string): { ok: false; error: GameError } {
  return { ok: false, error: { kind: 'GameError', code, message } }
}

// helper used outside (для тестов и reducer.ts)
export const _morningInternals = { nextConsciousSeat, consciousCount, transitionToDay }
