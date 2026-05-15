// Применение специальных припасов днём. См. docs/game-rules.md §4.2.5.
//
// USE_FIRST_AID: одноразовое, снимает 1 рану у себя/другого. Без сознания → в сознание
//   если wounds < strength. Карта уходит в discard.
// USE_UMBRELLA: открывает зонтик у себя или другого. Многоразовая, остаётся.
// USE_FLARE: одноразовое. 3 карты с верха колоды → подсчёт чаек → карты в discard
//   (рециклинг). Если стало 4 чайки → scoring.

import type { CharacterId } from '../constants'
import { SUPPLY_PROPS } from '../constants'
import type { GameEvent, GameState, PlayerId, ReducerResult, SupplyInstanceId } from '../types'
import {
  addOpen,
  addSeagull,
  advanceTurn,
  applyWoundDelta,
  drawNavCards,
  err,
  isGameError,
  playerByCharacter,
  removeFromHand,
  removeSeagull,
  requireMyDayTurn,
} from './_helpers'

// ---------- USE_FIRST_AID ----------

export function useFirstAid(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacter: CharacterId },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const player = state.players[action.playerId]!
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'first_aid') {
    return err('CARD_NOT_OWNED', `Supply ${action.supplyId} is not first_aid`)
  }
  if (!player.openSupplies.includes(action.supplyId) && !player.closedSupplies.includes(action.supplyId)) {
    return err('CARD_NOT_OWNED', `Player ${action.playerId} doesn't own ${action.supplyId}`)
  }

  const target = playerByCharacter(state, action.targetCharacter)
  if (!target) return err('INVALID_TARGET', `No player with character ${action.targetCharacter}`)
  if (target.consciousness === 'dead') {
    return err('UNCONSCIOUS_OR_DEAD', `Cannot heal dead player ${target.id}`)
  }
  if (target.wounds <= 0) {
    return err('BUSINESS_RULE_VIOLATION', `Target ${target.id} has no wounds to heal`)
  }

  // Убрать карту из руки, добавить в discard.
  const removed = removeFromHand(player, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `internal: card not in hand`)
  const players = {
    ...state.players,
    [action.playerId]: removed.player,
  }
  const healed = applyWoundDelta(target, -1)
  players[target.id] = healed

  return {
    ok: true,
    state: advanceTurn(
      {
        ...state,
        players,
        supplyDiscard: [...state.supplyDiscard, action.supplyId],
      },
      action.playerId,
    ),
    events: [
      event(
        'FIRST_AID',
        {
          playerId: action.playerId,
          targetCharacter: action.targetCharacter,
          newConsciousness: healed.consciousness,
        },
        'all',
      ),
    ],
  }
}

// ---------- USE_UMBRELLA ----------

export function useUmbrella(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacter: CharacterId },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const player = state.players[action.playerId]!
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'umbrella') {
    return err('CARD_NOT_OWNED', `Supply ${action.supplyId} is not umbrella`)
  }
  // Зонтик должен быть в hand игрока (открытый или закрытый).
  const isOpen = player.openSupplies.includes(action.supplyId)
  const isClosed = player.closedSupplies.includes(action.supplyId)
  if (!isOpen && !isClosed) {
    return err('CARD_NOT_OWNED', `Player doesn't own umbrella ${action.supplyId}`)
  }
  const target = playerByCharacter(state, action.targetCharacter)
  if (!target) return err('INVALID_TARGET', `No player with character ${action.targetCharacter}`)

  // Если зонтик уже открыт у player и target == player — это no-op? По правилам активация
  // зонтика == выложить открытым перед собой/другим. Если уже открыт И уже у нужного игрока — error.
  if (isOpen && target.id === action.playerId) {
    return err('CARD_ALREADY_OPEN', `Umbrella is already open in your hand`)
  }

  // Убираем у player, кладём в open к target.
  const fromPlayer = removeFromHand(player, action.supplyId)
  if (!fromPlayer) return err('CARD_NOT_OWNED', `internal`)
  let players = { ...state.players, [action.playerId]: fromPlayer.player }
  // Если target == player — просто открываем у player. Иначе передаём.
  const recipient = target.id === action.playerId ? fromPlayer.player : target
  const recipientWithUmbrella = addOpen(recipient, action.supplyId)
  players = { ...players, [recipient.id]: recipientWithUmbrella }

  return {
    ok: true,
    state: advanceTurn({ ...state, players }, action.playerId),
    events: [
      event('UMBRELLA', { playerId: action.playerId, target: action.targetCharacter }, 'all'),
    ],
  }
}

// ---------- USE_FLARE ----------

export function useFlare(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const player = state.players[action.playerId]!
  const card = state.supplyById[action.supplyId]
  if (!card || card.kind !== 'flare') {
    return err('CARD_NOT_OWNED', `Supply ${action.supplyId} is not flare`)
  }
  if (!player.openSupplies.includes(action.supplyId) && !player.closedSupplies.includes(action.supplyId)) {
    return err('CARD_NOT_OWNED', `Player doesn't own flare ${action.supplyId}`)
  }
  if (!SUPPLY_PROPS.flare.singleUse) {
    // Sanity check.
    throw new Error('flare must be singleUse')
  }

  // Тянем 3 карты.
  const { drawn, state: afterDraw } = drawNavCards(state, 3)
  // Применяем только чайки.
  let s2: GameState = afterDraw
  for (const navId of drawn) {
    const nav = afterDraw.navById[navId]
    if (!nav) continue
    if (nav.seagull === 'normal') s2 = addSeagull(s2)
    else if (nav.seagull === 'crossed') s2 = removeSeagull(s2)
  }
  // Карты в discard (рециклинг сам перемешает позже).
  s2 = { ...s2, navDiscard: [...s2.navDiscard, ...drawn] }

  // Убрать flare из руки в discard.
  const removed = removeFromHand(player, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `internal`)
  s2 = {
    ...s2,
    players: { ...s2.players, [action.playerId]: removed.player },
    supplyDiscard: [...s2.supplyDiscard, action.supplyId],
  }

  // Если фаза стала scoring (4 чайки) — не advanceTurn.
  if (s2.phase.kind === 'scoring') {
    return { ok: true, state: s2, events: [flareEvent(action.playerId, drawn.length, true)] }
  }
  return {
    ok: true,
    state: advanceTurn(s2, action.playerId),
    events: [flareEvent(action.playerId, drawn.length, false)],
  }
}

function flareEvent(playerId: PlayerId, seen: number, gameOver: boolean): GameEvent {
  return {
    timestamp: 0,
    kind: 'FLARE',
    payload: { playerId, seen, gameOver },
    visibleTo: 'all',
  }
}

function event(kind: string, payload: unknown, visibleTo: GameEvent['visibleTo']): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo }
}
