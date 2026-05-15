// Драка. См. docs/game-rules.md §4.3.
//
// Поток:
//   - PROPOSAL_REJECT (от жертвы) → enterFight: атакующий и жертва объявлены, recruitment открыт.
//   - FIGHT_RECRUIT_ALLY { side, targetCharacter }: атакующий или жертва приглашает игрока.
//     Только одно приглашение в любой момент времени.
//   - FIGHT_ALLY_RESPONSE { accept, weapons }: приглашённый принимает или отказывает.
//     При принятии — он попадает на свою сторону + перечень оружия.
//   - FIGHT_ADD_WEAPON { weaponSupplyId }: текущий участник раскрывает/добавляет оружие.
//   - FIGHT_CLOSE_RECRUITMENT (только атакующий): окончание набора → resolveFight.
//
// Resolve:
//   atk_str = sum(player.strength для участников atk) + sum(weapon.weaponStrength для атак оружий)
//   def_str = аналогично для defender side
//   atk > def → атакующий побеждает (получает: своп / выбор карты).
//   atk <= def → жертва побеждает.
//   Все участники → fought=true.
//   Проигравшая сторона → +1 wound каждому.
//   Одноразовые оружия (flare) → discard.
//   После resolve: при победе атакующего и reason=swap → executeSwap. reason=rob →
//   completingRobPick. При победе жертвы → action атакующего потрачен, advanceTurn.

import { CHARACTERS } from '../constants'
import type { CharacterId } from '../constants'
import type {
  FightState,
  GameError,
  GameEvent,
  GameState,
  Phase,
  PlayerId,
  ReducerResult,
  SeatIndex,
  SupplyInstanceId,
} from '../types'
import {
  addOpen,
  advanceTurn,
  applyWoundDelta,
  err,
  isGameError,
  playerByCharacter,
  removeFromHand,
} from './_helpers'
import { executeSwap } from './swap'

type FightSide = 'attacker' | 'defender'

// ---------- Helpers ----------

function inFight(state: GameState): FightState | GameError {
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'fight') {
    return { kind: 'GameError', code: 'WRONG_PHASE', message: 'Not in fight subphase' }
  }
  return state.phase.subPhase.fight
}

function setFight(state: GameState, fight: FightState): GameState {
  return { ...state, phase: { kind: 'day', subPhase: { kind: 'fight', fight } } }
}

function isParticipant(fight: FightState, playerId: PlayerId): FightSide | null {
  if (fight.attackerId === playerId || fight.attackerAllies.includes(playerId)) return 'attacker'
  if (fight.defenderId === playerId || fight.defenderAllies.includes(playerId)) return 'defender'
  return null
}

function strengthOf(ch: string): number {
  const c = CHARACTERS.find((x) => x.id === ch)
  if (!c) throw new Error(`Unknown character ${ch}`)
  return c.strength
}

function ownerOfSupply(state: GameState, supplyId: SupplyInstanceId): PlayerId | null {
  for (const p of Object.values(state.players)) {
    if (p.openSupplies.includes(supplyId) || p.closedSupplies.includes(supplyId)) return p.id
  }
  return null
}

// ---------- Entry ----------

/** Перейти от reject-проposal в fight subphase. */
export function enterFight(
  state: GameState,
  attackerId: PlayerId,
  defenderId: PlayerId,
  targetSeat: SeatIndex,
  reason: FightState['reason'],
): GameState {
  const fight: FightState = {
    reason,
    attackerId,
    defenderId,
    targetSeat,
    attackerAllies: [],
    defenderAllies: [],
    attackerWeapons: [],
    defenderWeapons: [],
    pendingAlly: null,
    recruitmentClosed: false,
  }
  return setFight(state, fight)
}

// ---------- FIGHT_RECRUIT_ALLY ----------

export function fightRecruitAlly(
  state: GameState,
  action: {
    playerId: PlayerId
    targetCharacter: CharacterId
    side: FightSide
  },
): ReducerResult {
  const f = inFight(state)
  if (isGameError(f)) return { ok: false, error: f }

  if (f.pendingAlly) {
    return err('BUSINESS_RULE_VIOLATION', `Another ally invite pending`)
  }
  if (f.recruitmentClosed) {
    return err('BUSINESS_RULE_VIOLATION', `Recruitment is closed`)
  }
  // Только attacker может приглашать на свою сторону, defender — на свою.
  if (action.side === 'attacker' && action.playerId !== f.attackerId) {
    return err('NOT_YOUR_TURN', `Only attacker recruits attacker-side allies`)
  }
  if (action.side === 'defender' && action.playerId !== f.defenderId) {
    return err('NOT_YOUR_TURN', `Only defender recruits defender-side allies`)
  }

  const target = playerByCharacter(state, action.targetCharacter)
  if (!target) return err('INVALID_TARGET', `No player with character ${action.targetCharacter}`)
  if (target.consciousness !== 'conscious') {
    return err('UNCONSCIOUS_OR_DEAD', `Cannot recruit unconscious/dead player`)
  }
  if (isParticipant(f, target.id) !== null) {
    return err('INVALID_TARGET', `Player ${target.id} is already in fight`)
  }

  return {
    ok: true,
    state: setFight(state, { ...f, pendingAlly: { invitedId: target.id, side: action.side } }),
    events: [
      event('FIGHT_RECRUIT_REQUESTED', {
        inviterId: action.playerId,
        invitedId: target.id,
        side: action.side,
      }),
    ],
  }
}

// ---------- FIGHT_ALLY_RESPONSE ----------

export function fightAllyResponse(
  state: GameState,
  action: { playerId: PlayerId; accept: boolean; weapons: SupplyInstanceId[] },
): ReducerResult {
  const f = inFight(state)
  if (isGameError(f)) return { ok: false, error: f }
  if (!f.pendingAlly || f.pendingAlly.invitedId !== action.playerId) {
    return err('NOT_YOUR_TURN', `No pending invite for ${action.playerId}`)
  }
  if (!action.accept) {
    return {
      ok: true,
      state: setFight(state, { ...f, pendingAlly: null }),
      events: [event('FIGHT_ALLY_DECLINED', { playerId: action.playerId })],
    }
  }

  // Принимает: добавляем в сторону, валидируем оружие (each weapon must be in player's
  // hand — open or closed). Закрытые автоматически раскрываются.
  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)

  let working = state
  let p = player
  const sideWeapons: SupplyInstanceId[] = []
  for (const wid of action.weapons) {
    const card = state.supplyById[wid]
    if (!card || !card.isWeapon) {
      return err('CARD_NOT_OWNED', `Supply ${wid} is not a weapon`)
    }
    if (!p.openSupplies.includes(wid) && !p.closedSupplies.includes(wid)) {
      return err('CARD_NOT_OWNED', `Player doesn't own weapon ${wid}`)
    }
    if (p.closedSupplies.includes(wid)) {
      const removed = removeFromHand(p, wid)
      if (removed) p = addOpen(removed.player, wid)
    }
    sideWeapons.push(wid)
  }
  working = { ...working, players: { ...working.players, [action.playerId]: p } }

  const side = f.pendingAlly.side
  const updatedFight: FightState =
    side === 'attacker'
      ? {
          ...f,
          attackerAllies: [...f.attackerAllies, action.playerId],
          attackerWeapons: [...f.attackerWeapons, ...sideWeapons],
          pendingAlly: null,
        }
      : {
          ...f,
          defenderAllies: [...f.defenderAllies, action.playerId],
          defenderWeapons: [...f.defenderWeapons, ...sideWeapons],
          pendingAlly: null,
        }

  return {
    ok: true,
    state: setFight(working, updatedFight),
    events: [
      event('FIGHT_ALLY_JOINED', {
        playerId: action.playerId,
        side,
        weapons: sideWeapons.length,
      }),
    ],
  }
}

// ---------- FIGHT_ADD_WEAPON ----------

export function fightAddWeapon(
  state: GameState,
  action: { playerId: PlayerId; weaponSupplyId: SupplyInstanceId },
): ReducerResult {
  const f = inFight(state)
  if (isGameError(f)) return { ok: false, error: f }
  if (f.recruitmentClosed) {
    return err('BUSINESS_RULE_VIOLATION', `Recruitment closed; cannot add weapons`)
  }
  const side = isParticipant(f, action.playerId)
  if (!side) return err('INVALID_TARGET', `Player ${action.playerId} is not in fight`)

  const player = state.players[action.playerId]
  if (!player) return err('INVALID_TARGET', `unknown player`)
  const card = state.supplyById[action.weaponSupplyId]
  if (!card || !card.isWeapon) {
    return err('CARD_NOT_OWNED', `Supply ${action.weaponSupplyId} is not a weapon`)
  }
  if (
    !player.openSupplies.includes(action.weaponSupplyId) &&
    !player.closedSupplies.includes(action.weaponSupplyId)
  ) {
    return err('CARD_NOT_OWNED', `Player doesn't own weapon ${action.weaponSupplyId}`)
  }
  // Уже в списке?
  if (
    f.attackerWeapons.includes(action.weaponSupplyId) ||
    f.defenderWeapons.includes(action.weaponSupplyId)
  ) {
    return err('CARD_ALREADY_OPEN', `Weapon ${action.weaponSupplyId} is already in fight`)
  }

  let working = state
  let p = player
  if (p.closedSupplies.includes(action.weaponSupplyId)) {
    const removed = removeFromHand(p, action.weaponSupplyId)
    if (removed) p = addOpen(removed.player, action.weaponSupplyId)
    working = { ...working, players: { ...working.players, [action.playerId]: p } }
  }

  const updatedFight: FightState =
    side === 'attacker'
      ? { ...f, attackerWeapons: [...f.attackerWeapons, action.weaponSupplyId] }
      : { ...f, defenderWeapons: [...f.defenderWeapons, action.weaponSupplyId] }

  return {
    ok: true,
    state: setFight(working, updatedFight),
    events: [event('FIGHT_WEAPON_ADDED', { playerId: action.playerId, side, supplyId: action.weaponSupplyId })],
  }
}

// ---------- FIGHT_CLOSE_RECRUITMENT ----------

export function fightCloseRecruitment(
  state: GameState,
  action: { playerId: PlayerId },
): ReducerResult {
  const f = inFight(state)
  if (isGameError(f)) return { ok: false, error: f }
  if (action.playerId !== f.attackerId) {
    return err('NOT_HOST', `Only attacker can close recruitment`)
  }
  if (f.pendingAlly) {
    return err('BUSINESS_RULE_VIOLATION', `Pending ally invite must be resolved first`)
  }
  return resolveFight(state, f)
}

// ---------- Resolve ----------

function sideStrength(
  state: GameState,
  playerIds: PlayerId[],
  weaponIds: SupplyInstanceId[],
): number {
  let total = 0
  for (const pid of playerIds) {
    const p = state.players[pid]
    if (p) total += strengthOf(p.character)
  }
  for (const wid of weaponIds) {
    const c = state.supplyById[wid]
    if (c?.weaponStrength) total += c.weaponStrength
  }
  return total
}

function resolveFight(state: GameState, f: FightState): ReducerResult {
  const atkSide = [f.attackerId, ...f.attackerAllies]
  const defSide = [f.defenderId, ...f.defenderAllies]
  const atkStr = sideStrength(state, atkSide, f.attackerWeapons)
  const defStr = sideStrength(state, defSide, f.defenderWeapons)
  const attackerWins = atkStr > defStr // при равенстве жертва побеждает (decision rules)

  // Все участники: fought=true. Проигравшим: +1 wound.
  const allParticipants = [...atkSide, ...defSide]
  const losers = attackerWins ? defSide : atkSide
  const winners = attackerWins ? atkSide : defSide

  const newPlayers = { ...state.players }
  for (const pid of allParticipants) {
    const p = newPlayers[pid]
    if (!p) continue
    newPlayers[pid] = { ...p, fought: true }
  }
  for (const pid of losers) {
    const p = newPlayers[pid]
    if (!p) continue
    newPlayers[pid] = applyWoundDelta(p, +1)
  }

  // Одноразовые оружия (flare) → в discard, убрать из open рук.
  const allWeapons = [...f.attackerWeapons, ...f.defenderWeapons]
  const toDiscard: SupplyInstanceId[] = []
  for (const wid of allWeapons) {
    const c = state.supplyById[wid]
    if (c?.singleUse) {
      toDiscard.push(wid)
      const ownerId = ownerOfSupply(state, wid)
      if (ownerId) {
        const owner = newPlayers[ownerId]
        if (owner) {
          newPlayers[ownerId] = {
            ...owner,
            openSupplies: owner.openSupplies.filter((id) => id !== wid),
            closedSupplies: owner.closedSupplies.filter((id) => id !== wid),
          }
        }
      }
    }
  }

  let next: GameState = {
    ...state,
    players: newPlayers,
    supplyDiscard: [...state.supplyDiscard, ...toDiscard],
  }

  // События до перехода фазы.
  const resolveEvents: GameEvent[] = [
    event('FIGHT_RESOLVED', {
      winnerSide: attackerWins ? 'attacker' : 'defender',
      atkStr,
      defStr,
      winners,
      losers,
    }),
  ]

  // Применить исход
  if (attackerWins) {
    // attacker получает желаемое
    if (f.reason === 'swap') {
      // Вернуть subPhase в waitingForAction для executeSwap (он ожидает не-fight subphase).
      const interim: GameState = {
        ...next,
        phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: f.targetSeat } } as Phase,
      }
      const swapRes = executeSwap(interim, f.attackerId, f.targetSeat, 'fight-victory')
      if (!swapRes.ok) return swapRes
      return { ok: true, state: swapRes.state, events: [...resolveEvents, ...swapRes.events] }
    } else {
      // rob: вход в completingRobPick
      next = {
        ...next,
        phase: {
          kind: 'day',
          subPhase: { kind: 'completingRobPick', attackerId: f.attackerId, targetSeat: f.targetSeat },
        },
      }
      return { ok: true, state: next, events: resolveEvents }
    }
  } else {
    // defender wins: атакующий теряет своё действие
    return { ok: true, state: advanceTurn(next, f.attackerId), events: resolveEvents }
  }
}

// ---------- PROPOSAL_REJECT → fight ----------

/**
 * Обработать reject: создать fight subphase. attackerId и targetSeat — из awaiting* subphase.
 */
export function rejectProposal(state: GameState, action: { playerId: PlayerId }): ReducerResult {
  if (state.phase.kind !== 'day') return err('WRONG_PHASE', `not day`)
  const sub = state.phase.subPhase
  if (sub.kind !== 'awaitingSwapResponse' && sub.kind !== 'awaitingRobResponse') {
    return err('WRONG_PHASE', `PROPOSAL_REJECT requires awaiting* subphase`)
  }
  const reason: FightState['reason'] = sub.kind === 'awaitingSwapResponse' ? 'swap' : 'rob'
  // defender = тот, кто сидит на targetSeat
  const defender = state.players[state.seats[sub.targetSeat]?.occupantId ?? '']
  if (!defender) return err('INVALID_TARGET', `defender vanished`)
  if (action.playerId !== defender.id) {
    return err('NOT_YOUR_TURN', `Only defender (${defender.id}) can reject; got ${action.playerId}`)
  }
  const next = enterFight(state, sub.attackerId, defender.id, sub.targetSeat, reason)
  return {
    ok: true,
    state: next,
    events: [event('FIGHT_DECLARED', { attackerId: sub.attackerId, defenderId: defender.id, reason })],
  }
}

// ---------- PROPOSAL_ACCEPT ----------

/** Помочь reducer'у: accept ведёт либо к swap, либо к robPick (в зависимости от subphase). */
export function acceptProposal(state: GameState, action: { playerId: PlayerId }): ReducerResult {
  if (state.phase.kind !== 'day') return err('WRONG_PHASE', `not day`)
  const sub = state.phase.subPhase
  if (sub.kind === 'awaitingSwapResponse') {
    const defender = state.players[state.seats[sub.targetSeat]?.occupantId ?? '']
    if (!defender) return err('INVALID_TARGET', `defender vanished`)
    if (action.playerId !== defender.id) {
      return err('NOT_YOUR_TURN', `Only defender (${defender.id}) can accept`)
    }
    return executeSwap(state, sub.attackerId, sub.targetSeat, 'consent')
  }
  if (sub.kind === 'awaitingRobResponse') {
    const defender = state.players[state.seats[sub.targetSeat]?.occupantId ?? '']
    if (!defender) return err('INVALID_TARGET', `defender vanished`)
    if (action.playerId !== defender.id) {
      return err('NOT_YOUR_TURN', `Only defender (${defender.id}) can accept`)
    }
    return {
      ok: true,
      state: {
        ...state,
        phase: {
          kind: 'day',
          subPhase: {
            kind: 'completingRobPick',
            attackerId: sub.attackerId,
            targetSeat: sub.targetSeat,
          },
        },
      },
      events: [event('ROB_ACCEPTED', { attackerId: sub.attackerId, defenderId: defender.id })],
    }
  }
  return err('WRONG_PHASE', `PROPOSAL_ACCEPT requires awaiting* subphase`)
}

function event(kind: string, payload: unknown): GameEvent {
  return { timestamp: 0, kind, payload, visibleTo: 'all' }
}
