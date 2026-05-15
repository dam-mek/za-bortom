// Реактивные действия с припасами: REVEAL / DISCARD / GIVE. См. game-rules §4.2.7.
// Доступны в любой момент дня, кроме фазы fight (decision: notInFight guard).

import type { CharacterId } from '../constants'
import type { GameEvent, GameState, PlayerId, ReducerResult, SupplyInstanceId } from '../types'
import { addClosed, addOpen, err, notInFight, playerByCharacter, removeFromHand } from './_helpers'

// ---------- REVEAL_SUPPLY ----------

export function revealSupply(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId },
): ReducerResult {
  // REVEAL можно даже в драке (раскрытие оружия) — не блокируем notInFight.
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `Unknown player ${action.playerId}`)
  if (player.openSupplies.includes(action.supplyId)) {
    return err('CARD_ALREADY_OPEN', `Supply ${action.supplyId} is already open`)
  }
  if (!player.closedSupplies.includes(action.supplyId)) {
    return err('CARD_NOT_OWNED', `Player doesn't own closed supply ${action.supplyId}`)
  }
  const updated = addOpen(
    { ...player, closedSupplies: player.closedSupplies.filter((id) => id !== action.supplyId) },
    action.supplyId,
  )
  return {
    ok: true,
    state: { ...state, players: { ...state.players, [action.playerId]: updated } },
    events: [
      {
        timestamp: 0,
        kind: 'REVEAL_SUPPLY',
        payload: { playerId: action.playerId, supplyId: action.supplyId },
        visibleTo: 'all',
      },
    ],
  }
}

// ---------- DISCARD_SUPPLY ----------

export function discardSupply(
  state: GameState,
  action: { playerId: PlayerId; supplyId: SupplyInstanceId },
): ReducerResult {
  const fight = notInFight(state)
  if (fight) return { ok: false, error: fight }
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `Unknown player ${action.playerId}`)
  const removed = removeFromHand(player, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `Player doesn't own ${action.supplyId}`)
  return {
    ok: true,
    state: {
      ...state,
      players: { ...state.players, [action.playerId]: removed.player },
      supplyDiscard: [...state.supplyDiscard, action.supplyId],
    },
    events: [
      {
        timestamp: 0,
        kind: 'DISCARD_SUPPLY',
        payload: { playerId: action.playerId, supplyId: action.supplyId },
        visibleTo: 'all',
      },
    ],
  }
}

// ---------- GIVE_SUPPLY ----------

/**
 * Передать припас другому игроку.
 *  - Если karta closed и faceUp=true → раскрыть + положить в open получателя.
 *  - Если closed и faceUp=false → передать в closed (получатель видит, остальные нет).
 *  - Если open и faceUp=true → передать в open.
 *  - Если open и faceUp=false → ошибка (нельзя «закрыть» открытую карту).
 */
export function giveSupply(
  state: GameState,
  action: {
    playerId: PlayerId
    targetCharacter: CharacterId
    supplyId: SupplyInstanceId
    faceUp: boolean
  },
): ReducerResult {
  const fight = notInFight(state)
  if (fight) return { ok: false, error: fight }
  const giver = state.players[action.playerId]
  if (!giver) return err('INVALID_TARGET', `Unknown player ${action.playerId}`)
  const recipient = playerByCharacter(state, action.targetCharacter)
  if (!recipient) return err('INVALID_TARGET', `No player with character ${action.targetCharacter}`)
  if (recipient.id === action.playerId) {
    return err('INVALID_TARGET', `Cannot give supply to yourself`)
  }

  const removed = removeFromHand(giver, action.supplyId)
  if (!removed) return err('CARD_NOT_OWNED', `Player doesn't own ${action.supplyId}`)

  if (removed.wasOpen && !action.faceUp) {
    return err('CARD_ALREADY_OPEN', `Cannot transfer open card as closed`)
  }
  const goesOpen = removed.wasOpen || action.faceUp
  const recipientAfter = goesOpen
    ? addOpen(recipient, action.supplyId)
    : addClosed(recipient, action.supplyId)

  const players: Record<PlayerId, GameState['players'][PlayerId]> = {
    ...state.players,
    [action.playerId]: removed.player,
    [recipient.id]: recipientAfter,
  }
  return {
    ok: true,
    state: { ...state, players },
    events: [
      {
        timestamp: 0,
        kind: 'GIVE_SUPPLY',
        payload: {
          fromId: action.playerId,
          toId: recipient.id,
          supplyId: action.supplyId,
          faceUp: goesOpen,
        },
        visibleTo: goesOpen ? 'all' : [action.playerId, recipient.id],
      } satisfies GameEvent,
    ],
  }
}
