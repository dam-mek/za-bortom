// Главный диспатчер reducer'а. См. docs/game-spec.md §9.

import type { Action } from './actions'
import { advanceTurn, err, isGameError, requireMyDayTurn } from './rules/_helpers'
import {
  acceptProposal,
  fightAddWeapon,
  fightAllyResponse,
  fightCloseRecruitment,
  fightRecruitAlly,
  rejectProposal,
} from './rules/fight'
import {
  declineWater,
  eveningSelectNavCard,
  eveningUseCompass,
  skipLifeRing,
  skipSharkBait,
  useLifeRing,
  useSharkBait,
  useWater,
} from './rules/evening'
import { chooseSupply, enterMorning } from './rules/morning'
import { offerRob, robPick } from './rules/rob'
import { row, rowKeepCards } from './rules/row'
import { determineWinners, scoreGame } from './rules/scoring'
import { shketSteal } from './rules/shket-steal'
import { offerSwap } from './rules/swap'
import { discardSupply, giveSupply, revealSupply } from './rules/trade'
import { useFirstAid, useFlare, useUmbrella } from './rules/use-supply'
import type { GameState, ReducerResult } from './types'

export function reduce(state: GameState, action: Action): ReducerResult {
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
      return err('UNKNOWN_ACTION', `Action ${action.kind} not handled by reducer in this phase`)

    // ---------- Morning ----------
    case 'CHOOSE_SUPPLY':
      return chooseSupply(state, action.playerId, action.supplyId)

    // ---------- Day actions ----------
    case 'ROW':
      return row(state, action)
    case 'ROW_KEEP_CARDS':
      return rowKeepCards(state, action)
    case 'SHKET_STEAL':
      return shketSteal(state, action)
    case 'USE_FIRST_AID':
      return useFirstAid(state, action)
    case 'USE_UMBRELLA':
      return useUmbrella(state, action)
    case 'USE_FLARE':
      return useFlare(state, action)
    case 'OFFER_SWAP':
      return offerSwap(state, action)
    case 'OFFER_ROB':
      return offerRob(state, action)
    case 'SKIP_TURN': {
      const guard = requireMyDayTurn(state, action.playerId)
      if (isGameError(guard)) return { ok: false, error: guard }
      return { ok: true, state: advanceTurn(state, action.playerId), events: [] }
    }

    // ---------- Swap/Rob response ----------
    case 'PROPOSAL_ACCEPT':
      return acceptProposal(state, action)
    case 'PROPOSAL_REJECT':
      return rejectProposal(state, action)
    case 'ROB_PICK':
      return robPick(state, action)

    // ---------- Fight ----------
    case 'FIGHT_RECRUIT_ALLY':
      return fightRecruitAlly(state, action)
    case 'FIGHT_ALLY_RESPONSE':
      return fightAllyResponse(state, action)
    case 'FIGHT_ADD_WEAPON':
      return fightAddWeapon(state, action)
    case 'FIGHT_CLOSE_RECRUITMENT':
      return fightCloseRecruitment(state, action)
    case 'DECLARE_FIGHT':
      // Драка автотриггерится при PROPOSAL_REJECT, явное объявление не используется.
      return err('UNKNOWN_ACTION', `DECLARE_FIGHT is auto-triggered via PROPOSAL_REJECT`)

    // ---------- Reactive ----------
    case 'REVEAL_SUPPLY':
      return revealSupply(state, action)
    case 'DISCARD_SUPPLY':
      return discardSupply(state, action)
    case 'GIVE_SUPPLY':
      return giveSupply(state, action)

    // ---------- Системные ----------
    case 'PHASE_ADVANCE':
      return handlePhaseAdvance(state)

    // ---------- Evening (Фаза 5) ----------
    case 'EVENING_USE_COMPASS':
      return eveningUseCompass(state, action)
    case 'EVENING_SELECT_NAV_CARD':
      return eveningSelectNavCard(state, action)
    case 'USE_LIFE_RING':
      return useLifeRing(state, action)
    case 'EVENING_SKIP_LIFE_RING':
      return skipLifeRing(state, action)
    case 'EVENING_USE_SHARK_BAIT':
      return useSharkBait(state, action)
    case 'EVENING_SKIP_SHARK_BAIT':
      return skipSharkBait(state, action)
    case 'EVENING_USE_WATER':
      return useWater(state, action)
    case 'EVENING_DECLINE_WATER':
      return declineWater(state, action)

    default: {
      const _exhaustive: never = action
      void _exhaustive
      return err('INVALID_ACTION_SHAPE', `Unknown action`)
    }
  }
}

function handlePhaseAdvance(state: GameState): ReducerResult {
  if (state.phase.kind === 'scoring') {
    const scores = scoreGame(state)
    const winners = determineWinners(state, scores)
    const winner =
      winners.length === 0 ? 'sea' : winners.length === 1 ? (winners[0] as string) : 'tie'
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
