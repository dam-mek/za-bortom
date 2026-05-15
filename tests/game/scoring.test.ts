import { describe, expect, it } from 'vitest'
import { CHARACTERS } from '@/game/constants'
import type { CharacterId, SupplyType } from '@/game/constants'
import { determineWinners, scoreGame, scorePlayer } from '@/game/rules/scoring'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { GameState, Player, SupplyCard } from '@/game/types'

// ---------- Builders ----------

function makePlayers(n: number): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i + 1}`,
    displayName: `P${i + 1}`,
    isBot: false,
  }))
}

function strengthOf(ch: CharacterId): number {
  return CHARACTERS.find((c) => c.id === ch)!.strength
}

/**
 * Построить state из «спецификаций игроков»: для каждого задаём character, friend, enemy,
 * статус (alive/unconscious/dead), список припасов. Остальные поля по дефолту.
 */
interface PlayerOverride {
  id?: string
  character: CharacterId
  bestFriend: CharacterId
  worstEnemy: CharacterId
  status?: 'alive' | 'unconscious' | 'dead'
  supplies?: ReadonlyArray<{ kind: SupplyType; valuePoints?: number; weaponStrength?: number }>
}

function buildScoringState(overrides: PlayerOverride[]): GameState {
  const players = makePlayers(overrides.length)
  const base = createInitialState({
    gameId: 'sc',
    hostId: players[0]!.id,
    seed: 12345,
    players,
  })

  // Перепишем players с учётом overrides.
  const newPlayers: Record<string, Player> = {}
  const supplyById: Record<string, SupplyCard> = { ...base.supplyById }
  // Снести все стартовые припасы у игроков (чтобы тест был чистый).
  for (const id of Object.keys(base.players)) {
    const p = base.players[id]!
    for (const sid of [...p.openSupplies, ...p.closedSupplies]) delete supplyById[sid]
  }

  let supplyCounter = 1
  overrides.forEach((ov, idx) => {
    const id = ov.id ?? `p-${idx + 1}`
    const ch = ov.character
    const strength = strengthOf(ch)
    const status = ov.status ?? 'alive'
    const wounds = status === 'dead' ? strength + 1 : status === 'unconscious' ? strength : 0
    const consciousness =
      status === 'dead' ? 'dead' : status === 'unconscious' ? 'unconscious' : 'conscious'

    const closedSupplies: string[] = []
    for (const s of ov.supplies ?? []) {
      const sid = `sc-${supplyCounter++}`
      supplyById[sid] = {
        id: sid,
        kind: s.kind,
        singleUse: false,
        isWeapon: s.weaponStrength !== undefined,
        isValuable: s.valuePoints !== undefined,
        ...(s.weaponStrength !== undefined ? { weaponStrength: s.weaponStrength } : {}),
        ...(s.valuePoints !== undefined ? { valuePoints: s.valuePoints } : {}),
      }
      closedSupplies.push(sid)
    }

    newPlayers[id] = {
      id,
      displayName: `P${idx + 1}`,
      isBot: false,
      character: ch,
      bestFriend: ov.bestFriend,
      worstEnemy: ov.worstEnemy,
      consciousness,
      wounds,
      rowed: false,
      fought: false,
      openSupplies: [],
      closedSupplies,
      hasUsedShketSteal: false,
      disconnected: false,
    }
  })

  return {
    ...base,
    players: newPlayers,
    supplyById,
    supplyDeck: [],
    supplyDiscard: [],
    removedCharacters: CHARACTERS.map((c) => c.id).filter(
      (id) => !overrides.some((o) => o.character === id),
    ),
  }
}

// ---------- Tests ----------

describe('scoring — выживание', () => {
  it('обычное выживание = survivalBonus', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1') // bocman survivalBonus=4
    expect(score.survival).toBe(4)
    expect(score.survivalReason).toBe('alive_normal')
  })

  it('мёртвый = 0 за выживание', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob', status: 'dead' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.survival).toBe(0)
    expect(score.survivalReason).toBe('dead')
  })

  it('нарцисс (friend === character) = 2 × survivalBonus', () => {
    const state = buildScoringState([
      { character: 'shket', bestFriend: 'shket', worstEnemy: 'snob' }, // shket bonus=9
      { character: 'bocman', bestFriend: 'snob', worstEnemy: 'kapitan' },
      { character: 'snob', bestFriend: 'kapitan', worstEnemy: 'miledi' },
      { character: 'kapitan', bestFriend: 'snob', worstEnemy: 'bocman' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.survival).toBe(18)
    expect(score.survivalReason).toBe('alive_narcissist')
  })

  it('психопат (enemy === character) = 0 за выживание', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'bocman' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.survival).toBe(0)
    expect(score.survivalReason).toBe('alive_psychopath')
  })

  it('нарцисс + психопат одновременно = ×1 survivalBonus', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'bocman', worstEnemy: 'bocman' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.survival).toBe(4)
    expect(score.survivalReason).toBe('alive_both')
  })
})

describe('scoring — ценности и множители', () => {
  it('Миледи: jewelry × 2', () => {
    const state = buildScoringState([
      {
        character: 'miledi',
        bestFriend: 'bocman',
        worstEnemy: 'shket',
        supplies: [{ kind: 'jewelry', valuePoints: 3 }],
      },
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'kapitan', bestFriend: 'snob', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.valuables).toEqual([{ kind: 'jewelry', value: 6 }])
  })

  it('Капитан: money × 2', () => {
    const state = buildScoringState([
      {
        character: 'kapitan',
        bestFriend: 'bocman',
        worstEnemy: 'shket',
        supplies: [
          { kind: 'money', valuePoints: 1 },
          { kind: 'money', valuePoints: 1 },
        ],
      },
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.valuables.reduce((acc, v) => acc + v.value, 0)).toBe(4)
  })

  it('Сноб: painting × 2', () => {
    const state = buildScoringState([
      {
        character: 'snob',
        bestFriend: 'bocman',
        worstEnemy: 'shket',
        supplies: [{ kind: 'painting', valuePoints: 2 }],
      },
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.valuables).toEqual([{ kind: 'painting', value: 4 }])
  })

  it('не-владелец множителя: jewelry × 1', () => {
    const state = buildScoringState([
      {
        character: 'bocman',
        bestFriend: 'shket',
        worstEnemy: 'snob',
        supplies: [{ kind: 'jewelry', valuePoints: 3 }],
      },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.valuables).toEqual([{ kind: 'jewelry', value: 3 }])
  })
})

describe('scoring — friend / enemy', () => {
  it('живой друг → +survivalBonus друга', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'kapitan' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' }, // shket alive → bocman +9
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.bestFriendBonus?.points).toBe(9) // shket survivalBonus
  })

  it('мёртвый враг → +strength врага', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'kapitan' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman', status: 'dead' }, // strength=7
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.worstEnemyBonus?.points).toBe(7)
  })

  it('живой враг → 0 за врага', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'kapitan' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.worstEnemyBonus?.points).toBe(0)
  })

  it('friend === enemy (не свой): жив → survivalBonus, мёртв → strength', () => {
    // shket — и друг, и враг bocman'а. shket жив → +9.
    const aliveCase = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'shket' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const sAlive = scorePlayer(aliveCase, 'p-1')
    expect(sAlive.bestFriendBonus?.points).toBe(9)
    expect(sAlive.worstEnemyBonus).toBeNull()

    // shket мёртв → +strength=3.
    const deadCase = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'shket' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob', status: 'dead' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak' },
    ])
    const sDead = scorePlayer(deadCase, 'p-1')
    expect(sDead.bestFriendBonus?.points).toBe(3)
  })
})

describe('scoring — психопат-бонус за мёртвых', () => {
  it('+3 за каждого мёртвого, кроме себя и лучшего друга', () => {
    // bocman психопат (worstEnemy = bocman). bestFriend = shket. shket жив, snob и kapitan мертвы.
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'bocman' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket', status: 'dead' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman', status: 'dead' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.psychopathDeathBonus).toEqual({ count: 2, points: 6 })
  })

  it('исключает лучшего друга из подсчёта (если он мёртв)', () => {
    // bocman психопат. friend=shket. shket мёртв → не считается. snob и kapitan тоже мертвы.
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'bocman' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob', status: 'dead' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket', status: 'dead' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman', status: 'dead' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.psychopathDeathBonus.count).toBe(2) // snob + kapitan, shket исключён
  })

  it('не-психопат → бонус 0', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'kapitan' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket', status: 'dead' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman', status: 'dead' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.psychopathDeathBonus).toEqual({ count: 0, points: 0 })
  })
})

describe('scoring — комплексный пример', () => {
  it('total = survival + valuables + friend + enemy + psycho', () => {
    // Миледи (survival=8) с украшениями (3*2=6), друг shket жив (+9), враг kapitan мёртв (+7).
    const state = buildScoringState([
      {
        character: 'miledi',
        bestFriend: 'shket',
        worstEnemy: 'kapitan',
        supplies: [{ kind: 'jewelry', valuePoints: 3 }],
      },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob' },
      { character: 'bocman', bestFriend: 'snob', worstEnemy: 'miledi' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'bocman', status: 'dead' },
    ])
    const score = scorePlayer(state, 'p-1')
    expect(score.total).toBe(8 + 6 + 9 + 7) // 30
  })
})

describe('scoring — winners / море побеждает', () => {
  it('все мёртвы → нет победителя (море)', () => {
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'shket', worstEnemy: 'snob', status: 'dead' },
      { character: 'shket', bestFriend: 'bocman', worstEnemy: 'snob', status: 'dead' },
      { character: 'snob', bestFriend: 'bocman', worstEnemy: 'shket', status: 'dead' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'cherpak', status: 'dead' },
    ])
    expect(determineWinners(state, scoreGame(state))).toEqual([])
  })

  it('tiebreaker: при равенстве — живой выигрывает у мёртвого', () => {
    // Только 4 игрока (miledi и cherpak — removed). Friend/enemy=miledi=отсутствующий
    // персонаж → ссылки игнорируются (нет points).
    // p-1 (bocman, alive): survival=4, valuables=0, friend=miledi (нет), enemy=miledi (нет) → 4.
    // p-2 (shket, dead): survival=0, valuables: jewelry valuePoints=4 (shket без множителя) → 4.
    const state = buildScoringState([
      { character: 'bocman', bestFriend: 'miledi', worstEnemy: 'miledi' },
      {
        character: 'shket',
        bestFriend: 'miledi',
        worstEnemy: 'miledi',
        status: 'dead',
        supplies: [{ kind: 'jewelry', valuePoints: 4 }],
      },
      { character: 'snob', bestFriend: 'miledi', worstEnemy: 'miledi', status: 'dead' },
      { character: 'kapitan', bestFriend: 'miledi', worstEnemy: 'miledi', status: 'dead' },
    ])
    const scores = scoreGame(state)
    expect(scores['p-1']!.total).toBe(4)
    expect(scores['p-2']!.total).toBe(4)
    const winners = determineWinners(state, scores)
    expect(winners).toEqual(['p-1']) // живой выигрывает
  })
})
