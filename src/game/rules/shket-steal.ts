// Способность Шкета: украсть случайную закрытую карту у другого игрока без драки.
// См. docs/game-rules.md §4.2.4 и decisions.md (упрощение: воровство = действие на день).

import { nextInt } from '../prng'
import type { GameEvent, GameState, PlayerId, ReducerResult, SeatIndex } from '../types'
import {
  addClosed,
  advanceTurn,
  err,
  isGameError,
  playerBySeat,
  removeFromHand,
  requireMyDayTurn,
} from './_helpers'

export function shketSteal(
  state: GameState,
  action: { playerId: PlayerId; targetSeat: SeatIndex },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const player = state.players[action.playerId]!
  if (player.character !== 'shket') {
    return err('BUSINESS_RULE_VIOLATION', `Only Shket can use SHKET_STEAL`)
  }
  if (player.hasUsedShketSteal) {
    return err('ALREADY_USED_ABILITY', `Shket already stole today`)
  }
  const target = playerBySeat(state, action.targetSeat)
  if (!target) return err('INVALID_TARGET', `No player at seat ${action.targetSeat}`)
  if (target.id === action.playerId) {
    return err('INVALID_TARGET', `Cannot steal from yourself`)
  }
  if (target.closedSupplies.length === 0) {
    return err('CARD_NOT_OWNED', `Target ${target.id} has no closed supplies`)
  }

  // Жертва перемешивает (моделируем через rng) и Шкет тянет один случайный id.
  const [idx, nextRng] = nextInt(state.rng, target.closedSupplies.length)
  const stolenId = target.closedSupplies[idx]!

  const targetAfter = removeFromHand(target, stolenId)
  if (!targetAfter) return err('CARD_NOT_OWNED', `internal: target lost card`)
  const shketAfter = addClosed(
    { ...player, hasUsedShketSteal: true },
    stolenId,
  )

  const players = {
    ...state.players,
    [target.id]: targetAfter.player,
    [action.playerId]: shketAfter,
  }

  return {
    ok: true,
    state: advanceTurn({ ...state, players, rng: nextRng }, action.playerId),
    events: [
      // Само воровство публично, но supplyId — приватно (только Шкет знает что украл).
      {
        timestamp: 0,
        kind: 'SHKET_STEAL',
        payload: { thiefId: action.playerId, victimId: target.id, supplyId: stolenId } satisfies {
          thiefId: PlayerId
          victimId: PlayerId
          supplyId: string
        },
        visibleTo: [action.playerId],
      },
      {
        timestamp: 0,
        kind: 'SHKET_STEAL_PUBLIC',
        payload: { thiefId: action.playerId, victimId: target.id },
        visibleTo: 'all',
      } satisfies GameEvent,
    ],
  }
}
