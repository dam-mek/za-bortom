// Фаза «Вечер» — раскрытие карты навигации и её последствия. См. docs/game-rules.md §4.4.
//
// FSM:
//   sternPicking (опц. compass) → resolving.overboardLifeRing → resolving.sharkBait →
//   resolving.thirst → cleanup → enterMorning(next day) или scoring (4 чайки).
//
// Интерактивные точки:
//   • USE_LIFE_RING / EVENING_SKIP_LIFE_RING — для персонажей с закрытым кругом
//   • EVENING_USE_SHARK_BAIT / EVENING_SKIP_SHARK_BAIT — owner-ы открытой приманки
//   • EVENING_USE_WATER / EVENING_DECLINE_WATER — на каждое ранение от жажды
//
// Зонтик: автоматически снимает 1 ранение от жажды у владельца за вечер (decision #16).

import type { CharacterId } from '../constants'
import type {
  GameEvent,
  GameState,
  NavCardInstanceId,
  NavigationCard,
  Player,
  PlayerId,
  ReducerResult,
  ResolveStep,
  SupplyInstanceId,
} from '../types'
import {
  addOpen,
  addSeagull,
  applyWoundDelta,
  drawNavCards,
  err,
  playerByCharacter,
  removeFromHand,
  removeSeagull,
  seatOfPlayer,
} from './_helpers'
import { enterMorning } from './morning'

// ============================================================================
// Helpers
// ============================================================================

function evt(
  kind: string,
  payload: unknown,
  visibleTo: GameEvent['visibleTo'] = 'all',
): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo }
}

function getOpenSupplyOfKind(
  state: GameState,
  p: Player,
  kind: string,
): SupplyInstanceId | null {
  for (const sid of p.openSupplies) {
    if (state.supplyById[sid]?.kind === kind) return sid
  }
  return null
}

function hasClosedSupplyOfKind(state: GameState, p: Player, kind: string): boolean {
  return p.closedSupplies.some((sid) => state.supplyById[sid]?.kind === kind)
}

function thirstSourcesFor(card: NavigationCard, p: Player): number {
  let n = 0
  if (card.thirst.named.includes(p.character)) n++
  if (card.thirst.rowers && p.rowed) n++
  if (card.thirst.fighters && p.fought) n++
  return n
}

// ============================================================================
// EVENING_USE_COMPASS
// ============================================================================

export function eveningUseCompass(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'sternPicking') {
    return err('WRONG_PHASE', `EVENING_USE_COMPASS requires sternPicking`)
  }
  const sub = state.phase.subPhase
  if (sub.pickerId !== action.playerId) return err('NOT_YOUR_TURN', `Only picker can use compass`)
  if (sub.compassUsed) return err('ALREADY_USED_ABILITY', `Compass already used this evening`)
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'compass') return err('CARD_NOT_OWNED', `Not a compass`)
  if (!player.openSupplies.includes(action.supplyId)) {
    return err('CARD_NOT_OPEN', `Compass must be open`)
  }

  const { drawn, state: afterDraw } = drawNavCards(state, 1)
  if (drawn.length === 0) {
    return err('EMPTY_DECK', `Nav deck and discard both empty`)
  }
  return {
    ok: true,
    state: {
      ...afterDraw,
      phase: {
        kind: 'evening',
        subPhase: {
          kind: 'sternPicking',
          pickerId: sub.pickerId,
          pool: [...sub.pool, drawn[0]!],
          compassUsed: true,
        },
      },
    },
    events: [evt('COMPASS_USED', { playerId: action.playerId, extraCardId: drawn[0] }, [action.playerId])],
  }
}

// ============================================================================
// EVENING_SELECT_NAV_CARD
// ============================================================================

export function eveningSelectNavCard(
  state: GameState,
  action: { playerId: PlayerId; navCardId: NavCardInstanceId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'sternPicking') {
    return err('WRONG_PHASE', `EVENING_SELECT_NAV_CARD requires sternPicking`)
  }
  const sub = state.phase.subPhase
  if (sub.pickerId !== action.playerId) return err('NOT_YOUR_TURN', `Only picker can select`)

  // Если pool пуст — взять верх колоды, action.navCardId игнорируется (выбора нет).
  let pool = sub.pool
  let working = state
  let chosen: typeof action.navCardId
  if (pool.length === 0) {
    const { drawn, state: afterDraw } = drawNavCards(state, 1)
    if (drawn.length === 0) return err('EMPTY_DECK', `No nav cards available`)
    pool = drawn
    working = afterDraw
    chosen = drawn[0]!
  } else {
    if (!pool.includes(action.navCardId)) {
      return err('CARD_NOT_OWNED', `Card ${action.navCardId} not in pool`)
    }
    chosen = action.navCardId
  }
  const discarded = pool.filter((id) => id !== chosen)
  working = { ...working, navDiscard: [...working.navDiscard, ...discarded] }

  return resolveCard(working, chosen)
}

// ============================================================================
// Resolution kernel
// ============================================================================

function resolveCard(state: GameState, cardId: NavCardInstanceId): ReducerResult {
  const card = state.navById[cardId]
  if (!card) return err('INVALID_TARGET', `Unknown nav card ${cardId}`)

  // 1. Чайки
  let s = state
  if (card.seagull === 'normal') s = addSeagull(s)
  else if (card.seagull === 'crossed') s = removeSeagull(s)
  if (s.phase.kind === 'scoring') {
    // 4 чайки → игра окончена, остаток обработки не нужен.
    return {
      ok: true,
      state: { ...s, navDiscard: [...s.navDiscard, cardId] },
      events: [evt('SEAGULL_FOURTH_GAME_OVER', { cardId })],
    }
  }

  // 2. Установка overboard step.
  const pendingChars: CharacterId[] = []
  const confirmedOverboard: CharacterId[] = []
  for (const ch of card.overboard) {
    const p = playerByCharacter(s, ch)
    if (!p) continue
    const seat = seatOfPlayer(s, p.id)
    if (seat === null) continue // удалён из игры
    if (getOpenSupplyOfKind(s, p, 'life_ring')) continue // защищён — не падает
    if (hasClosedSupplyOfKind(s, p, 'life_ring')) {
      pendingChars.push(ch)
    } else {
      confirmedOverboard.push(ch)
    }
  }

  const step: ResolveStep = { kind: 'overboardLifeRing', pendingChars, confirmedOverboard }
  s = { ...s, phase: { kind: 'evening', subPhase: { kind: 'resolving', cardId, step } } }

  if (pendingChars.length === 0) {
    return progressAfterOverboardDecisions(s)
  }
  return {
    ok: true,
    state: s,
    events: [evt('SEAGULLS_APPLIED', { delta: card.seagull }), evt('OVERBOARD_LIFE_RING_PROMPT', { pendingChar: pendingChars[0] })],
  }
}

/** После всех решений по life_ring: применяем overboard, переходим к shark_bait. */
function progressAfterOverboardDecisions(state: GameState): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    throw new Error('invariant: resolving phase')
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'overboardLifeRing') {
    throw new Error('invariant: overboardLifeRing step')
  }
  const { confirmedOverboard, cardId } = { ...sub.step, cardId: sub.cardId }

  let s = state
  const overboardFinal: CharacterId[] = []
  const events: GameEvent[] = []
  for (const ch of confirmedOverboard) {
    const p = playerByCharacter(s, ch)
    if (!p) continue
    const seat = seatOfPlayer(s, p.id)
    if (seat === null) continue
    const wasOut = p.consciousness !== 'conscious'

    // Потеря всех открытых припасов.
    const lostOpen = [...p.openSupplies]
    let updated: Player = { ...p, openSupplies: [] }

    // Ранение от падения (кроме Черпака).
    if (p.character !== 'cherpak') {
      updated = applyWoundDelta(updated, +1)
    }

    if (wasOut) {
      // Тело уносит течением — удалён из игры со всеми припасами.
      const lostClosed = [...p.closedSupplies]
      updated = { ...updated, closedSupplies: [], consciousness: 'dead' }
      s = {
        ...s,
        players: { ...s.players, [p.id]: updated },
        seats: s.seats.map((st) => (st.occupantId === p.id ? { ...st, occupantId: null } : st)),
        supplyDiscard: [...s.supplyDiscard, ...lostOpen, ...lostClosed],
      }
      events.push(evt('OVERBOARD_SWEPT', { char: ch, playerId: p.id }))
    } else {
      s = {
        ...s,
        players: { ...s.players, [p.id]: updated },
        supplyDiscard: [...s.supplyDiscard, ...lostOpen],
      }
      overboardFinal.push(ch)
      events.push(evt('OVERBOARD_RESOLVED', { char: ch, woundedBy: 1 }))
    }
  }

  return setupSharkBait(s, cardId, overboardFinal, events)
}

// ----------------------------------------------------------------------------
// USE_LIFE_RING / EVENING_SKIP_LIFE_RING
// ----------------------------------------------------------------------------

export function useLifeRing(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacter: CharacterId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `USE_LIFE_RING requires evening resolving phase`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'overboardLifeRing') {
    return err('WRONG_PHASE', `Not in overboardLifeRing step`)
  }
  const pending = sub.step.pendingChars
  if (pending.length === 0 || pending[0] !== action.targetCharacter) {
    return err('INVALID_TARGET', `Current pending=${pending[0]}, target=${action.targetCharacter}`)
  }
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'life_ring') return err('CARD_NOT_OWNED', `Not a life_ring`)
  if (
    !player.openSupplies.includes(action.supplyId) &&
    !player.closedSupplies.includes(action.supplyId)
  ) {
    return err('CARD_NOT_OWNED', `Player doesn't own ${action.supplyId}`)
  }
  const target = playerByCharacter(state, action.targetCharacter)
  if (!target) return err('INVALID_TARGET', `unknown target`)

  // Перенести life_ring в открытые припасы target'а.
  const removed = removeFromHand(player, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `internal`)
  let players = { ...state.players, [action.playerId]: removed.player }
  // Если playerId == target.id, removed.player уже не имеет круга → добавим в открытые.
  const fromForTarget = action.playerId === target.id ? removed.player : target
  const updatedTarget = addOpen(fromForTarget, action.supplyId)
  players = { ...players, [target.id]: updatedTarget }

  const newPending = pending.slice(1)
  const next: GameState = {
    ...state,
    players,
    phase: {
      kind: 'evening',
      subPhase: {
        kind: 'resolving',
        cardId: sub.cardId,
        step: {
          kind: 'overboardLifeRing',
          pendingChars: newPending,
          confirmedOverboard: sub.step.confirmedOverboard,
        },
      },
    },
  }
  const evts = [evt('LIFE_RING_USED', { byId: action.playerId, target: action.targetCharacter })]
  if (newPending.length === 0) {
    const r = progressAfterOverboardDecisions(next)
    if (!r.ok) return r
    return { ok: true, state: r.state, events: [...evts, ...r.events] }
  }
  return { ok: true, state: next, events: evts }
}

export function skipLifeRing(state: GameState, action: { playerId: PlayerId }): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `EVENING_SKIP_LIFE_RING requires resolving phase`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'overboardLifeRing') {
    return err('WRONG_PHASE', `Not in overboardLifeRing step`)
  }
  const pending = sub.step.pendingChars
  if (pending.length === 0) return err('WRONG_PHASE', `No pending decision`)
  const pendingChar = pending[0]!
  const pendingPlayer = playerByCharacter(state, pendingChar)
  if (!pendingPlayer) return err('INVALID_TARGET', `pending player gone`)
  if (action.playerId !== pendingPlayer.id) {
    return err('NOT_YOUR_TURN', `Only ${pendingPlayer.id} can decide`)
  }

  const newPending = pending.slice(1)
  const newConfirmed = [...sub.step.confirmedOverboard, pendingChar]
  const next: GameState = {
    ...state,
    phase: {
      kind: 'evening',
      subPhase: {
        kind: 'resolving',
        cardId: sub.cardId,
        step: {
          kind: 'overboardLifeRing',
          pendingChars: newPending,
          confirmedOverboard: newConfirmed,
        },
      },
    },
  }
  const evts = [evt('LIFE_RING_DECLINED', { playerId: action.playerId, char: pendingChar })]
  if (newPending.length === 0) {
    const r = progressAfterOverboardDecisions(next)
    if (!r.ok) return r
    return { ok: true, state: r.state, events: [...evts, ...r.events] }
  }
  return { ok: true, state: next, events: evts }
}

// ============================================================================
// Shark bait
// ============================================================================

function setupSharkBait(
  state: GameState,
  cardId: NavCardInstanceId,
  overboardChars: CharacterId[],
  carriedEvents: GameEvent[],
): ReducerResult {
  if (overboardChars.length === 0) return setupThirst(state, cardId, carriedEvents)
  // Владельцы открытой приманки в сознании, в порядке от кормы к носу.
  const owners: PlayerId[] = []
  for (let i = state.seats.length - 1; i >= 0; i--) {
    const seat = state.seats[i]
    if (!seat || seat.occupantId === null) continue
    const p = state.players[seat.occupantId]
    if (!p || p.consciousness !== 'conscious') continue
    if (getOpenSupplyOfKind(state, p, 'shark_bait')) owners.push(p.id)
  }
  if (owners.length === 0) return setupThirst(state, cardId, carriedEvents)

  const next: GameState = {
    ...state,
    phase: {
      kind: 'evening',
      subPhase: {
        kind: 'resolving',
        cardId,
        step: { kind: 'sharkBait', overboardChars, ownerQueue: owners },
      },
    },
  }
  return {
    ok: true,
    state: next,
    events: [...carriedEvents, evt('SHARK_BAIT_PROMPT', { ownerId: owners[0] })],
  }
}

export function useSharkBait(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `EVENING_USE_SHARK_BAIT requires resolving`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'sharkBait') return err('WRONG_PHASE', `Not in shark_bait step`)
  if (sub.step.ownerQueue[0] !== action.playerId) {
    return err('NOT_YOUR_TURN', `Current shark_bait decision is for ${sub.step.ownerQueue[0]}`)
  }
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'shark_bait') return err('CARD_NOT_OWNED', `Not shark_bait`)
  if (!player.openSupplies.includes(action.supplyId)) {
    return err('CARD_NOT_OPEN', `shark_bait must be open`)
  }

  let s = state
  // +1 ранение каждому в overboardChars (если ещё в игре).
  const evts: GameEvent[] = []
  for (const ch of sub.step.overboardChars) {
    const p = playerByCharacter(s, ch)
    if (!p) continue
    const seat = seatOfPlayer(s, p.id)
    if (seat === null) continue
    const updated = applyWoundDelta(p, +1)
    s = { ...s, players: { ...s.players, [p.id]: updated } }
    evts.push(evt('SHARK_BAIT_WOUND', { char: ch, newWounds: updated.wounds }))
  }
  // Приманку — в discard.
  const removed = removeFromHand(player, action.supplyId)
  if (removed) {
    s = { ...s, players: { ...s.players, [action.playerId]: removed.player } }
  }
  s = { ...s, supplyDiscard: [...s.supplyDiscard, action.supplyId] }

  const r = setupThirst(s, sub.cardId, [...evts, evt('SHARK_BAIT_USED', { byId: action.playerId })])
  return r
}

export function skipSharkBait(state: GameState, action: { playerId: PlayerId }): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `EVENING_SKIP_SHARK_BAIT requires resolving`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'sharkBait') return err('WRONG_PHASE', `Not in shark_bait step`)
  if (sub.step.ownerQueue[0] !== action.playerId) return err('NOT_YOUR_TURN', `Wrong owner`)

  const remaining = sub.step.ownerQueue.slice(1)
  if (remaining.length === 0) {
    return setupThirst(state, sub.cardId, [evt('SHARK_BAIT_DECLINED', { playerId: action.playerId })])
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: {
        kind: 'evening',
        subPhase: {
          kind: 'resolving',
          cardId: sub.cardId,
          step: { kind: 'sharkBait', overboardChars: sub.step.overboardChars, ownerQueue: remaining },
        },
      },
    },
    events: [evt('SHARK_BAIT_DECLINED', { playerId: action.playerId })],
  }
}

// ============================================================================
// Thirst
// ============================================================================

function setupThirst(
  state: GameState,
  cardId: NavCardInstanceId,
  carriedEvents: GameEvent[],
): ReducerResult {
  const card = state.navById[cardId]
  if (!card) return err('INVALID_TARGET', `Unknown nav card ${cardId}`)

  const queue: { char: CharacterId; remainingWounds: number }[] = []
  for (const seat of state.seats) {
    if (seat.removed || seat.occupantId === null) continue
    const p = state.players[seat.occupantId]
    if (!p) continue
    if (p.consciousness === 'dead') continue
    const sources = thirstSourcesFor(card, p)
    if (sources > 0) queue.push({ char: p.character, remainingWounds: sources })
  }

  if (queue.length === 0) return cleanupAndAdvance(state, cardId, carriedEvents)

  return {
    ok: true,
    state: {
      ...state,
      phase: {
        kind: 'evening',
        subPhase: {
          kind: 'resolving',
          cardId,
          step: { kind: 'thirst', queue, umbrellaUsedBy: [] },
        },
      },
    },
    events: [
      ...carriedEvents,
      evt('THIRST_PROMPT', { char: queue[0]!.char, wounds: queue[0]!.remainingWounds }),
    ],
  }
}

export function useWater(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacter: CharacterId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `EVENING_USE_WATER requires resolving`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'thirst') return err('WRONG_PHASE', `Not in thirst step`)
  const queue = sub.step.queue
  if (queue.length === 0) return err('WRONG_PHASE', `No thirst pending`)
  if (queue[0]!.char !== action.targetCharacter) {
    return err('INVALID_TARGET', `Current thirst is for ${queue[0]!.char}`)
  }

  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)
  if (player.consciousness !== 'conscious') {
    return err('UNCONSCIOUS_OR_DEAD', `unconscious can't give water`)
  }
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'water') return err('CARD_NOT_OWNED', `Not water`)
  if (
    !player.openSupplies.includes(action.supplyId) &&
    !player.closedSupplies.includes(action.supplyId)
  ) {
    return err('CARD_NOT_OWNED', `Player doesn't own ${action.supplyId}`)
  }

  const removed = removeFromHand(player, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `internal`)
  let s: GameState = {
    ...state,
    players: { ...state.players, [action.playerId]: removed.player },
    supplyDiscard: [...state.supplyDiscard, action.supplyId],
  }

  const head = queue[0]!
  const newRemaining = head.remainingWounds - 1
  let newQueue: ReadonlyArray<{ char: CharacterId; remainingWounds: number }>
  if (newRemaining <= 0) newQueue = queue.slice(1)
  else newQueue = [{ char: head.char, remainingWounds: newRemaining }, ...queue.slice(1)]

  s = {
    ...s,
    phase: {
      kind: 'evening',
      subPhase: {
        kind: 'resolving',
        cardId: sub.cardId,
        step: { kind: 'thirst', queue: newQueue, umbrellaUsedBy: sub.step.umbrellaUsedBy },
      },
    },
  }
  const evts = [evt('WATER_USED', { byId: action.playerId, target: action.targetCharacter })]
  if (newQueue.length === 0) return cleanupAndAdvance(s, sub.cardId, evts)
  return { ok: true, state: s, events: evts }
}

export function declineWater(
  state: GameState,
  action: { playerId: PlayerId; targetCharacter: CharacterId },
): ReducerResult {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'resolving') {
    return err('WRONG_PHASE', `EVENING_DECLINE_WATER requires resolving`)
  }
  const sub = state.phase.subPhase
  if (sub.step.kind !== 'thirst') return err('WRONG_PHASE', `Not in thirst step`)
  const queue = sub.step.queue
  if (queue.length === 0) return err('WRONG_PHASE', `No thirst pending`)
  if (queue[0]!.char !== action.targetCharacter) {
    return err('INVALID_TARGET', `Current thirst is for ${queue[0]!.char}`)
  }
  // Кто может декларировать decline? Любой conscious игрок.
  const decider = state.players[action.playerId]
  if (!decider) return err('INVALID_TARGET', `unknown player`)
  if (decider.consciousness !== 'conscious') {
    return err('UNCONSCIOUS_OR_DEAD', `unconscious can't decline`)
  }

  const head = queue[0]!
  const target = playerByCharacter(state, head.char)
  if (!target) {
    // skip
    const newQueue = queue.slice(1)
    const s: GameState = {
      ...state,
      phase: {
        kind: 'evening',
        subPhase: {
          kind: 'resolving',
          cardId: sub.cardId,
          step: { kind: 'thirst', queue: newQueue, umbrellaUsedBy: sub.step.umbrellaUsedBy },
        },
      },
    }
    if (newQueue.length === 0) return cleanupAndAdvance(s, sub.cardId, [])
    return { ok: true, state: s, events: [] }
  }

  let s = state
  let umbrellaUsedBy = sub.step.umbrellaUsedBy
  let woundApplied = false
  const umbrellaSid = getOpenSupplyOfKind(state, target, 'umbrella')
  if (umbrellaSid && !umbrellaUsedBy.includes(target.character)) {
    // Зонтик поглощает 1 ранение в этот вечер.
    umbrellaUsedBy = [...umbrellaUsedBy, target.character]
  } else {
    // Применяем ранение.
    const updated = applyWoundDelta(target, +1)
    s = { ...s, players: { ...s.players, [target.id]: updated } }
    woundApplied = true
  }

  const newRemaining = head.remainingWounds - 1
  let newQueue: ReadonlyArray<{ char: CharacterId; remainingWounds: number }>
  if (newRemaining <= 0) newQueue = queue.slice(1)
  else newQueue = [{ char: head.char, remainingWounds: newRemaining }, ...queue.slice(1)]

  s = {
    ...s,
    phase: {
      kind: 'evening',
      subPhase: {
        kind: 'resolving',
        cardId: sub.cardId,
        step: { kind: 'thirst', queue: newQueue, umbrellaUsedBy },
      },
    },
  }
  const evts = [
    evt(woundApplied ? 'THIRST_WOUND' : 'THIRST_UMBRELLA', { char: target.character }),
  ]
  if (newQueue.length === 0) return cleanupAndAdvance(s, sub.cardId, evts)
  return { ok: true, state: s, events: evts }
}

// ============================================================================
// Cleanup + переход к следующему утру
// ============================================================================

function cleanupAndAdvance(
  state: GameState,
  cardId: NavCardInstanceId,
  carriedEvents: GameEvent[],
): ReducerResult {
  // Карта → в discard.
  let s: GameState = { ...state, navDiscard: [...state.navDiscard, cardId] }
  // Сброс жетонов усталости (rowed/fought).
  const players: Record<PlayerId, Player> = {}
  for (const [id, p] of Object.entries(s.players)) {
    players[id] = { ...p, rowed: false, fought: false }
  }
  s = { ...s, players }
  // Переход в утро следующего дня.
  s = enterMorning(s)
  return {
    ok: true,
    state: s,
    events: [...carriedEvents, evt('EVENING_DONE', { cardId })],
  }
}
