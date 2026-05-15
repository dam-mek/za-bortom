// Главный диспатчер reducer'а. См. docs/game-spec.md §9.
//
// Сейчас (Фаза 2) реализованы: START_GAME, CHOOSE_SUPPLY, PHASE_ADVANCE, TALLY_SCORES
// (через scoring.scoreGame). Остальные actions возвращают ok:false с UNKNOWN_ACTION,
// будут добавляться в следующих фазах.

import type { Action } from './actions'
import { enterMorning, chooseSupply } from './rules/morning'
import { scoreGame, determineWinners } from './rules/scoring'
import type { GameError, GameState, ReducerResult } from './types'

export function reduce(state: GameState, action: Action): ReducerResult {
  // Глобальные guard'ы.
  if (state.phase.kind === 'finished') {
    return err('GAME_FINISHED', `Game is finished; action ${action.kind} ignored`)
  }

  switch (action.kind) {
    // ---------- Lobby / setup ----------
    case 'START_GAME': {
      if (state.phase.kind !== 'setup') {
        return err('WRONG_PHASE', `START_GAME requires phase=setup, got ${state.phase.kind}`)
      }
      if (action.playerId !== state.hostId) {
        return err('NOT_HOST', `Only host can START_GAME (sender=${action.playerId})`)
      }
      return { ok: true, state: enterMorning(state), events: [] }
    }

    case 'LOBBY_JOIN':
    case 'LOBBY_LEAVE':
      // На MVP — lobby в основном живёт в net-слое; reducer ничего не делает.
      return err('UNKNOWN_ACTION', `Action ${action.kind} not handled by reducer in this phase`)

    // ---------- Morning ----------
    case 'CHOOSE_SUPPLY':
      return chooseSupply(state, action.playerId, action.supplyId)

    // ---------- Системные ----------
    case 'PHASE_ADVANCE':
      return handlePhaseAdvance(state)

    // ---------- Не реализовано в Фазе 2 ----------
    case 'ROW':
    case 'OFFER_SWAP':
    case 'OFFER_ROB':
    case 'SHKET_STEAL':
    case 'USE_FIRST_AID':
    case 'USE_UMBRELLA':
    case 'USE_FLARE':
    case 'SKIP_TURN':
    case 'ROW_KEEP_CARDS':
    case 'ROW_DECLARE_OAR':
    case 'PROPOSAL_ACCEPT':
    case 'PROPOSAL_REJECT':
    case 'ROB_PICK':
    case 'DECLARE_FIGHT':
    case 'FIGHT_RECRUIT_ALLY':
    case 'FIGHT_ALLY_RESPONSE':
    case 'FIGHT_ADD_WEAPON':
    case 'FIGHT_CLOSE_RECRUITMENT':
    case 'REVEAL_SUPPLY':
    case 'DISCARD_SUPPLY':
    case 'GIVE_SUPPLY':
    case 'USE_LIFE_RING':
    case 'EVENING_USE_COMPASS':
    case 'EVENING_SELECT_NAV_CARD':
    case 'EVENING_USE_SHARK_BAIT':
    case 'EVENING_USE_WATER':
    case 'EVENING_DECLINE_WATER':
      return err('UNKNOWN_ACTION', `Action ${action.kind} not implemented yet`)

    default: {
      // Exhaustiveness check.
      const _exhaustive: never = action
      void _exhaustive
      return err('INVALID_ACTION_SHAPE', `Unknown action`)
    }
  }
}

function handlePhaseAdvance(state: GameState): ReducerResult {
  // При phase=scoring → проставляем финальные очки + winner и переходим в finished.
  if (state.phase.kind === 'scoring') {
    const scores = scoreGame(state)
    const winners = determineWinners(state, scores)
    const winner = winners.length === 0 ? 'sea' : winners.length === 1 ? (winners[0] as string) : 'tie'
    return {
      ok: true,
      state: {
        ...state,
        phase: { kind: 'finished' },
        finalScores: scores,
        winner,
      },
      events: [],
    }
  }
  return err('WRONG_PHASE', `PHASE_ADVANCE not handled in phase ${state.phase.kind}`)
}

function err(code: GameError['code'], message: string): { ok: false; error: GameError } {
  return { ok: false, error: { kind: 'GameError', code, message } }
}
