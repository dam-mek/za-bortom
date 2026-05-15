// Действие «Погрести». См. docs/game-rules.md §4.2.1.
//
// Поток:
//   1. ROW: валидируем, считаем открытые/закрытые вёсла, раскрываем закрытые,
//      тянем 2+oarCount карт навигации (с рециклингом), entry в subPhase=rowing.
//   2. ROW_KEEP_CARDS: 0/1/2/... карт (≤ drawn) идут в navPool, остальные — в discard
//      (под низ колоды семантически = в discard, потому что recycling сам перемешает).
//      player.rowed=true, advance turn.

import type {
  GameEvent,
  GameState,
  NavCardInstanceId,
  PlayerId,
  ReducerResult,
  SupplyInstanceId,
} from '../types'
import {
  addOpen,
  advanceTurn,
  drawNavCards,
  err,
  isGameError,
  removeFromHand,
  requireMyDayTurn,
} from './_helpers'

/** Найти все вёсла у игрока. Возвращает list { id, isOpen }. */
function findOars(state: GameState, playerId: PlayerId): { id: SupplyInstanceId; isOpen: boolean }[] {
  const p = state.players[playerId]
  if (!p) return []
  const result: { id: SupplyInstanceId; isOpen: boolean }[] = []
  for (const id of p.openSupplies) {
    if (state.supplyById[id]?.kind === 'oar') result.push({ id, isOpen: true })
  }
  for (const id of p.closedSupplies) {
    if (state.supplyById[id]?.kind === 'oar') result.push({ id, isOpen: false })
  }
  return result
}

export function row(state: GameState, action: { playerId: PlayerId }): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const oars = findOars(state, action.playerId)
  // Раскрываем закрытые вёсла (необратимо).
  let working = state
  let player = working.players[action.playerId]!
  for (const oar of oars) {
    if (!oar.isOpen) {
      const removed = removeFromHand(player, oar.id)
      if (removed) player = addOpen(removed.player, oar.id)
    }
  }
  working = { ...working, players: { ...working.players, [action.playerId]: player } }

  const drawCount = 2 + oars.length
  const { drawn, state: afterDraw } = drawNavCards(working, drawCount)

  if (drawn.length === 0) {
    // Колода и discard пусты — действие потрачено впустую, выдаём усталость и идём дальше.
    const players = {
      ...afterDraw.players,
      [action.playerId]: { ...afterDraw.players[action.playerId]!, rowed: true },
    }
    return {
      ok: true,
      state: advanceTurn({ ...afterDraw, players }, action.playerId),
      events: [event('ROW_EMPTY_DECK', { playerId: action.playerId }, 'all')],
    }
  }

  return {
    ok: true,
    state: {
      ...afterDraw,
      phase: {
        kind: 'day',
        subPhase: { kind: 'rowing', playerId: action.playerId, drawn },
      },
    },
    events: [event('ROW_DRAWN', { playerId: action.playerId, count: drawn.length }, [action.playerId])],
  }
}

export function rowKeepCards(
  state: GameState,
  action: { playerId: PlayerId; cardIds: NavCardInstanceId[] },
): ReducerResult {
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'rowing') {
    return err('WRONG_PHASE', `ROW_KEEP_CARDS requires rowing sub-phase, got ${state.phase.kind}`)
  }
  const sub = state.phase.subPhase
  if (sub.playerId !== action.playerId) {
    return err('NOT_YOUR_TURN', `Rowing belongs to ${sub.playerId}, sender ${action.playerId}`)
  }

  // Все cardIds должны быть из drawn, без дублей.
  const drawnSet = new Set(sub.drawn)
  const kept = action.cardIds
  if (new Set(kept).size !== kept.length) {
    return err('INVALID_TARGET', `Duplicate card ids in ROW_KEEP_CARDS`)
  }
  for (const id of kept) {
    if (!drawnSet.has(id)) {
      return err('CARD_NOT_OWNED', `Card ${id} was not drawn this row`)
    }
  }
  const discarded = sub.drawn.filter((id) => !kept.includes(id))

  const player = state.players[action.playerId]!
  const updatedPlayer = { ...player, rowed: true }
  const next: GameState = {
    ...state,
    players: { ...state.players, [action.playerId]: updatedPlayer },
    navPool: [...state.navPool, ...kept],
    navDiscard: [...state.navDiscard, ...discarded],
  }

  return {
    ok: true,
    state: advanceTurn(next, action.playerId),
    events: [
      event(
        'ROW_KEPT',
        { playerId: action.playerId, kept: kept.length, discarded: discarded.length },
        'all',
      ),
    ],
  }
}

function event(kind: string, payload: unknown, visibleTo: GameEvent['visibleTo']): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo }
}
