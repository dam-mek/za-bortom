// Подсчёт очков. См. docs/game-rules.md §7 и decisions.md #22 (tiebreaker).

import { CHARACTERS, VALUE_MULTIPLIERS } from '../constants'
import type { CharacterId } from '../constants'
import type {
  GameState,
  Player,
  PlayerId,
  ScoreBreakdown,
  SupplyCard,
  ValuableScore,
} from '../types'

function isAlive(p: Player): boolean {
  return p.consciousness !== 'dead'
}

function characterStrength(ch: CharacterId): number {
  const c = CHARACTERS.find((x) => x.id === ch)
  if (!c) throw new Error(`Unknown character: ${ch}`)
  return c.strength
}

function characterSurvivalBonus(ch: CharacterId): number {
  const c = CHARACTERS.find((x) => x.id === ch)
  if (!c) throw new Error(`Unknown character: ${ch}`)
  return c.survivalBonus
}

function playerByCharacter(state: GameState, ch: CharacterId): Player | null {
  for (const p of Object.values(state.players)) {
    if (p.character === ch) return p
  }
  return null
}

function getAllSupplies(state: GameState, p: Player): SupplyCard[] {
  const out: SupplyCard[] = []
  for (const id of [...p.openSupplies, ...p.closedSupplies]) {
    const card = state.supplyById[id]
    if (card) out.push(card)
  }
  return out
}

/** Очки за выживание с учётом нарцисс/психопат. */
function computeSurvival(player: Player): {
  points: number
  reason: ScoreBreakdown['survivalReason']
} {
  const bonus = characterSurvivalBonus(player.character)
  const narcissist = player.bestFriend === player.character
  const psychopath = player.worstEnemy === player.character

  if (!isAlive(player)) return { points: 0, reason: 'dead' }

  if (narcissist && psychopath) return { points: bonus, reason: 'alive_both' }
  if (narcissist) return { points: bonus * 2, reason: 'alive_narcissist' }
  if (psychopath) return { points: 0, reason: 'alive_psychopath' }
  return { points: bonus, reason: 'alive_normal' }
}

/** Ценности (money/jewelry/painting) с множителями персонажа. */
function computeValuables(state: GameState, player: Player): ValuableScore[] {
  const supplies = getAllSupplies(state, player)
  const result: ValuableScore[] = []
  const multipliers = VALUE_MULTIPLIERS[player.character]
  for (const card of supplies) {
    if (!card.isValuable) continue
    const pv = card.valuePoints ?? 0
    const mult = multipliers[card.kind] ?? 1
    result.push({ kind: card.kind, value: pv * mult })
  }
  return result
}

/** Friend + enemy с учётом совпадения (friend === enemy, не свой). */
function computeFriendEnemy(
  state: GameState,
  player: Player,
): {
  friend: ScoreBreakdown['bestFriendBonus']
  enemy: ScoreBreakdown['worstEnemyBonus']
} {
  const fId = player.bestFriend
  const eId = player.worstEnemy
  const isNarcissist = fId === player.character
  const isPsycho = eId === player.character

  // Спецслучай: friend === enemy, и это не сам игрок.
  if (fId === eId && !isNarcissist) {
    const target = playerByCharacter(state, fId)
    if (!target) return { friend: null, enemy: null }
    const points = isAlive(target) ? characterSurvivalBonus(fId) : characterStrength(fId)
    const block = { friendId: fId, alive: isAlive(target), points }
    return { friend: block, enemy: null }
  }

  let friend: ScoreBreakdown['bestFriendBonus'] = null
  let enemy: ScoreBreakdown['worstEnemyBonus'] = null

  if (!isNarcissist) {
    const friendPlayer = playerByCharacter(state, fId)
    if (friendPlayer && isAlive(friendPlayer)) {
      friend = { friendId: fId, alive: true, points: characterSurvivalBonus(fId) }
    } else if (friendPlayer) {
      friend = { friendId: fId, alive: false, points: 0 }
    }
  }

  if (!isPsycho) {
    const enemyPlayer = playerByCharacter(state, eId)
    if (enemyPlayer && !isAlive(enemyPlayer)) {
      enemy = { enemyId: eId, alive: false, points: characterStrength(eId) }
    } else if (enemyPlayer) {
      enemy = { enemyId: eId, alive: true, points: 0 }
    }
  }

  return { friend, enemy }
}

/** Бонус психопата: +3 за каждого мёртвого в лодке, кроме себя и лучшего друга. */
function computePsychopathDeathBonus(
  state: GameState,
  player: Player,
): { count: number; points: number } {
  const psycho = player.worstEnemy === player.character
  if (!psycho) return { count: 0, points: 0 }
  const narcissist = player.bestFriend === player.character

  let count = 0
  for (const other of Object.values(state.players)) {
    if (other.id === player.id) continue
    if (other.consciousness !== 'dead') continue
    // Исключаем лучшего друга (если он не сам игрок — иначе уже исключён).
    if (!narcissist && other.character === player.bestFriend) continue
    count++
  }
  return { count, points: count * 3 }
}

/** Полный breakdown для одного игрока. */
export function scorePlayer(state: GameState, playerId: PlayerId): ScoreBreakdown {
  const player = state.players[playerId]
  if (!player) throw new Error(`scorePlayer: unknown player ${playerId}`)

  const survival = computeSurvival(player)
  const valuables = computeValuables(state, player)
  const fe = computeFriendEnemy(state, player)
  const psy = computePsychopathDeathBonus(state, player)

  const valuablesTotal = valuables.reduce((acc, v) => acc + v.value, 0)
  const friendPoints = fe.friend?.points ?? 0
  const enemyPoints = fe.enemy?.points ?? 0
  const total = survival.points + valuablesTotal + friendPoints + enemyPoints + psy.points

  return {
    survival: survival.points,
    survivalReason: survival.reason,
    valuables,
    bestFriendBonus: fe.friend,
    worstEnemyBonus: fe.enemy,
    psychopathDeathBonus: psy,
    total,
  }
}

/** Подсчёт очков всех игроков. */
export function scoreGame(state: GameState): Record<PlayerId, ScoreBreakdown> {
  const result: Record<PlayerId, ScoreBreakdown> = {}
  for (const id of Object.keys(state.players)) {
    result[id] = scorePlayer(state, id)
  }
  return result
}

/**
 * Определить победителя. Tiebreaker: жив > мёртв; при равенстве в этой категории —
 * совместная победа (массив id). См. decisions.md #22.
 */
export function determineWinners(
  state: GameState,
  scores: Record<PlayerId, ScoreBreakdown>,
): PlayerId[] {
  const entries = Object.entries(scores)
  if (entries.length === 0) return []
  // Если никто не выжил — море побеждает, очки не считаются.
  const anyoneAlive = Object.values(state.players).some(isAlive)
  if (!anyoneAlive) return []

  const maxScore = Math.max(...entries.map(([, b]) => b.total))
  const candidates = entries.filter(([, b]) => b.total === maxScore).map(([id]) => id)
  if (candidates.length === 1) return candidates

  // Tiebreaker: жив > мёртв.
  const aliveWinners = candidates.filter((id) => {
    const p = state.players[id]
    return p && isAlive(p)
  })
  if (aliveWinners.length > 0) return aliveWinners
  return candidates
}
