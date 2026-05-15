// Действие «Поменяться местами». См. docs/game-rules.md §4.2.2.
//
// Поток:
//   1. OFFER_SWAP { targetSeat }: валидация. Если target unconscious/dead — мгновенно
//      executeSwap. Иначе вход в awaitingSwapResponse.
//   2. PROPOSAL_ACCEPT: executeSwap.
//   3. PROPOSAL_REJECT: переход в fight (см. rules/fight.ts).
//
// executeSwap: меняет occupantId двух банок, advanceTurn. ВАЖНО: turnOrder/dayActionsTaken
// идут по seat'ам, не по players, поэтому после свопа очередь продолжается по новому
// owner'у этой банки. Это упрощённая интерпретация; формально rules говорят
// «boat order для действий не меняется». Уточним при необходимости.

import type { GameEvent, GameState, PlayerId, ReducerResult, SeatIndex } from '../types'
import { advanceTurn, err, isGameError, playerBySeat, requireMyDayTurn, seatOfPlayer } from './_helpers'

export function offerSwap(
  state: GameState,
  action: { playerId: PlayerId; targetSeat: SeatIndex },
): ReducerResult {
  const guard = requireMyDayTurn(state, action.playerId)
  if (isGameError(guard)) return { ok: false, error: guard }

  const target = playerBySeat(state, action.targetSeat)
  if (!target) return err('INVALID_TARGET', `No player at seat ${action.targetSeat}`)
  if (target.id === action.playerId) {
    return err('INVALID_TARGET', `Cannot swap with self`)
  }

  // Если без сознания / мёртв — своп без согласия.
  if (target.consciousness !== 'conscious') {
    return executeSwap(state, action.playerId, action.targetSeat, 'auto-unconscious')
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: {
        kind: 'day',
        subPhase: {
          kind: 'awaitingSwapResponse',
          attackerId: action.playerId,
          targetSeat: action.targetSeat,
        },
      },
    },
    events: [event('SWAP_OFFERED', { attackerId: action.playerId, targetSeat: action.targetSeat })],
  }
}

/** Выполнить своп: поменять occupantId двух банок. */
export function executeSwap(
  state: GameState,
  attackerId: PlayerId,
  targetSeat: SeatIndex,
  trigger: 'consent' | 'fight-victory' | 'auto-unconscious',
): ReducerResult {
  const attackerSeat = seatOfPlayer(state, attackerId)
  if (attackerSeat === null) return err('INVALID_TARGET', `Attacker ${attackerId} has no seat`)
  if (attackerSeat === targetSeat) return err('INVALID_TARGET', `Cannot swap with own seat`)
  const target = playerBySeat(state, targetSeat)
  if (!target) return err('INVALID_TARGET', `No player at seat ${targetSeat}`)

  const seats = state.seats.map((s) => {
    if (s.index === attackerSeat) return { ...s, occupantId: target.id }
    if (s.index === targetSeat) return { ...s, occupantId: attackerId }
    return s
  })

  // Очистить subPhase: переход обратно в waitingForAction (но не свой ход — потому что
  // attacker уже совершил действие, advanceTurn передаст ход дальше).
  const next: GameState = {
    ...state,
    seats,
    phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: attackerSeat } },
  }
  const advanced = advanceTurn(next, attackerId)
  return {
    ok: true,
    state: advanced,
    events: [
      event('SWAP_EXECUTED', {
        attackerId,
        defenderId: target.id,
        attackerNewSeat: targetSeat,
        defenderNewSeat: attackerSeat,
        trigger,
      }),
    ],
  }
}

function event(kind: string, payload: unknown): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo: 'all' }
}
