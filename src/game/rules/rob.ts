// Действие «Ограбить». См. docs/game-rules.md §4.2.3.
//
// Поток:
//   1. OFFER_ROB { targetSeat }: валидация. Если жертва без сознания/мертва — сразу
//      enterCompletingRobPick. Иначе awaitingRobResponse.
//   2. PROPOSAL_ACCEPT: enterCompletingRobPick.
//   3. PROPOSAL_REJECT: переход в fight (см. rules/fight.ts).
//   4. ROB_PICK { pick }: атакующий забирает выбранную карту (open) или случайную (closed).

import { nextInt } from '../prng'
import type { RobPick } from '../actions'
import type {
  GameEvent,
  GameState,
  PlayerId,
  ReducerResult,
  SeatIndex,
  SupplyInstanceId,
} from '../types'
import {
  addClosed,
  addOpen,
  advanceTurn,
  err,
  isGameError,
  playerBySeat,
  removeFromHand,
  requireMyDayTurn,
} from './_helpers'

export function offerRob(
  state: GameState,
  action: { playerId: PlayerId; targetSeat: SeatIndex },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const target = playerBySeat(state, action.targetSeat)
  if (!target) return err('INVALID_TARGET', `No player at seat ${action.targetSeat}`)
  if (target.id === action.playerId) {
    return err('INVALID_TARGET', `Cannot rob yourself`)
  }
  if (target.openSupplies.length === 0 && target.closedSupplies.length === 0) {
    return err('CARD_NOT_OWNED', `Target has no supplies to rob`)
  }

  if (target.consciousness !== 'conscious') {
    // Жертва без сознания/мертва — сразу к выбору карты.
    return enterCompletingRobPick(state, action.playerId, action.targetSeat)
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: {
        kind: 'day',
        subPhase: {
          kind: 'awaitingRobResponse',
          attackerId: action.playerId,
          targetSeat: action.targetSeat,
        },
      },
    },
    events: [event('ROB_OFFERED', { attackerId: action.playerId, targetSeat: action.targetSeat })],
  }
}

/** Войти в подфазу completingRobPick (атакующий уже победил/получил согласие). */
export function enterCompletingRobPick(
  state: GameState,
  attackerId: PlayerId,
  targetSeat: SeatIndex,
): ReducerResult {
  return {
    ok: true,
    state: {
      ...state,
      phase: {
        kind: 'day',
        subPhase: { kind: 'completingRobPick', attackerId, targetSeat },
      },
    },
    events: [],
  }
}

/** ROB_PICK: атакующий выбирает карту (открытую или случайную закрытую). */
export function robPick(
  state: GameState,
  action: { playerId: PlayerId; pick: RobPick },
): ReducerResult {
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'completingRobPick') {
    return err('WRONG_PHASE', `ROB_PICK requires completingRobPick subphase`)
  }
  const sub = state.phase.subPhase
  if (action.playerId !== sub.attackerId) {
    return err('NOT_YOUR_TURN', `Only attacker can ROB_PICK`)
  }
  const attacker = state.players[sub.attackerId]
  const victim = playerBySeat(state, sub.targetSeat)
  if (!attacker || !victim) return err('INVALID_TARGET', `attacker/victim missing`)

  let pickedId: SupplyInstanceId
  let wasOpen: boolean

  if (action.pick.kind === 'open') {
    pickedId = action.pick.supplyId
    if (!victim.openSupplies.includes(pickedId)) {
      return err('CARD_NOT_OWNED', `Card ${pickedId} is not in victim's open supplies`)
    }
    wasOpen = true
  } else {
    // closed: случайная
    if (victim.closedSupplies.length === 0) {
      return err('CARD_NOT_OWNED', `Victim has no closed supplies`)
    }
    const [idx, nextRng] = nextInt(state.rng, victim.closedSupplies.length)
    pickedId = victim.closedSupplies[idx]!
    wasOpen = false
    state = { ...state, rng: nextRng }
  }

  // Перенести карту от victim к attacker, сохраняя open/closed status.
  const victimAfter = removeFromHand(victim, pickedId)
  if (!victimAfter) return err('CARD_NOT_OWNED', `internal: card disappeared`)
  const attackerAfter = wasOpen ? addOpen(attacker, pickedId) : addClosed(attacker, pickedId)

  const players = {
    ...state.players,
    [victim.id]: victimAfter.player,
    [attacker.id]: attackerAfter,
  }

  return {
    ok: true,
    state: advanceTurn({ ...state, players }, sub.attackerId),
    events: [
      {
        timestamp: 0,
        kind: 'ROB_COMPLETED',
        payload: {
          attackerId: sub.attackerId,
          victimId: victim.id,
          supplyId: pickedId,
          wasOpen,
        },
        // Открытая взятка видна всем; случайная — только attacker и victim.
        visibleTo: wasOpen ? 'all' : [attacker.id, victim.id],
      } satisfies GameEvent,
    ],
  }
}

function event(kind: string, payload: unknown): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo: 'all' }
}
