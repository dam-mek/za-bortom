// Тесты Фазы 5: вечер (навигация).

import { describe, expect, it } from 'vitest'
import type { CharacterId } from '@/game/constants'
import { CHARACTERS, NAVIGATION_DECK_SIZE, SUPPLY_DECK_SIZE } from '@/game/constants'
import { assertInvariants } from '@/game/invariants'
import { createRng } from '@/game/prng'
import { reduce } from '@/game/reducer'
import type {
  GameState,
  NavigationCard,
  Player,
  PlayerId,
  Seat,
  SeatIndex,
  SupplyCard,
} from '@/game/types'

// ============================================================================
// Fixture
// ============================================================================

interface PlayerSetup {
  character: CharacterId
  wounds?: number
  consciousness?: 'conscious' | 'unconscious' | 'dead'
  rowed?: boolean
  fought?: boolean
  open?: ReadonlyArray<Partial<SupplyCard> & { kind: SupplyCard['kind'] }>
  closed?: ReadonlyArray<Partial<SupplyCard> & { kind: SupplyCard['kind'] }>
}

interface EveningSetup {
  players: PlayerSetup[]
  navCard: {
    seagull?: 'none' | 'normal' | 'crossed'
    overboard?: CharacterId[]
    thirst?: { rowers?: boolean; fighters?: boolean; named?: CharacterId[] }
  }
  seagullTokens?: number
}

/** Создаёт GameState в фазе evening.sternPicking с одной целевой картой в pool. */
function buildEvening(setup: EveningSetup): { state: GameState; navCardId: string } {
  if (setup.players.length !== 4) throw new Error('fixture supports 4 players')
  const chars = setup.players.map((p) => p.character)
  if (new Set(chars).size !== chars.length) {
    throw new Error(`duplicate characters: ${chars.join(',')}`)
  }

  let supplyCounter = 1
  const supplyById: Record<string, SupplyCard> = {}
  const players: Record<PlayerId, Player> = {}
  const seats: Seat[] = setup.players.map((ps, i) => {
    const ch = ps.character
    const strength = CHARACTERS.find((c) => c.id === ch)!.strength
    const cons: Player['consciousness'] = ps.consciousness ?? 'conscious'
    const wounds =
      ps.wounds ?? (cons === 'dead' ? strength + 1 : cons === 'unconscious' ? strength : 0)
    const open: string[] = []
    const closed: string[] = []
    const ingest = (kind: 'open' | 'closed', list: PlayerSetup['open']) => {
      for (const s of list ?? []) {
        const id = `s-${supplyCounter++}`
        supplyById[id] = {
          id,
          kind: s.kind,
          singleUse: s.singleUse ?? false,
          isWeapon: s.isWeapon ?? false,
          isValuable: s.isValuable ?? false,
          ...(s.weaponStrength !== undefined ? { weaponStrength: s.weaponStrength } : {}),
          ...(s.valuePoints !== undefined ? { valuePoints: s.valuePoints } : {}),
        }
        ;(kind === 'open' ? open : closed).push(id)
      }
    }
    ingest('open', ps.open)
    ingest('closed', ps.closed)

    const id = `p-${i + 1}`
    players[id] = {
      id,
      displayName: `P${i + 1}`,
      isBot: false,
      character: ch,
      bestFriend: ch,
      worstEnemy: ch,
      consciousness: cons,
      wounds,
      rowed: ps.rowed ?? false,
      fought: ps.fought ?? false,
      openSupplies: open,
      closedSupplies: closed,
      hasUsedShketSteal: false,
      disconnected: false,
    }
    return { index: i as SeatIndex, occupantId: id as PlayerId, removed: false }
  })
  while (seats.length < 6) {
    seats.push({ index: seats.length as SeatIndex, occupantId: null, removed: true })
  }

  // Целевая карта навигации.
  const navCardId = 'nv-target'
  const navCard: NavigationCard = {
    id: navCardId,
    seagull: setup.navCard.seagull ?? 'none',
    overboard: setup.navCard.overboard ?? [],
    thirst: {
      rowers: setup.navCard.thirst?.rowers ?? false,
      fighters: setup.navCard.thirst?.fighters ?? false,
      named: setup.navCard.thirst?.named ?? [],
    },
  }
  const navById: Record<string, NavigationCard> = { [navCardId]: navCard }
  // Заполнить остальные 23 пустыми
  for (let i = 0; i < NAVIGATION_DECK_SIZE - 1; i++) {
    const id = `nv-filler-${i}`
    navById[id] = {
      id,
      seagull: 'none',
      overboard: [],
      thirst: { rowers: false, fighters: false, named: [] },
    }
  }

  // Набить supply deck до 42 (плейсхолдеры water).
  const supplyDeck: string[] = []
  const playerSupplyCount = Object.values(players).reduce(
    (acc, p) => acc + p.openSupplies.length + p.closedSupplies.length,
    0,
  )
  for (let i = playerSupplyCount; i < SUPPLY_DECK_SIZE; i++) {
    const id = `s-${supplyCounter++}`
    supplyById[id] = { id, kind: 'water', singleUse: true, isWeapon: false, isValuable: false }
    supplyDeck.push(id)
  }

  // Picker — последний в сознании, ближе к корме.
  let pickerId: PlayerId | null = null
  for (let i = seats.length - 1; i >= 0; i--) {
    const s = seats[i]
    if (!s || s.removed || s.occupantId === null) continue
    const p = players[s.occupantId]
    if (p && p.consciousness === 'conscious') {
      pickerId = s.occupantId
      break
    }
  }
  if (!pickerId) throw new Error('no conscious picker available')

  const removedCharacters = CHARACTERS.map((c) => c.id).filter(
    (id) => !setup.players.some((p) => p.character === id),
  )

  const state: GameState = {
    gameId: 'e',
    hostId: 'p-1',
    seed: 1,
    rng: createRng(1),
    day: 1,
    players,
    seats,
    removedCharacters,
    supplyDeck,
    supplyDiscard: [],
    navDeck: Object.keys(navById).filter((id) => id !== navCardId),
    navDiscard: [],
    navPool: [],
    supplyById,
    navById,
    seagullTokens: setup.seagullTokens ?? 0,
    phase: {
      kind: 'evening',
      subPhase: { kind: 'sternPicking', pickerId, pool: [navCardId], compassUsed: false },
    },
    turnOrder: [0, 1, 2, 3],
    currentTurnIndex: 0,
    dayActionsTaken: Object.fromEntries(Object.keys(players).map((id) => [id, true])),
    log: [],
    winner: null,
    finalScores: null,
  }
  return { state, navCardId }
}

function selectCard(state: GameState, navCardId: string): GameState {
  if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'sternPicking') {
    throw new Error('expected sternPicking')
  }
  const pickerId = state.phase.subPhase.pickerId
  const r = reduce(state, { kind: 'EVENING_SELECT_NAV_CARD', playerId: pickerId, navCardId })
  if (!r.ok) throw new Error(`select failed: ${r.error.message}`)
  return r.state
}

function expectOk<T extends { ok: boolean }>(r: T): asserts r is T & { ok: true } {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`)
}

// ============================================================================
// Seagulls
// ============================================================================

describe('Seagulls', () => {
  it('normal: +1 жетон', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { seagull: 'normal' },
    })
    const after = selectCard(state, navCardId)
    expect(after.seagullTokens).toBe(1)
    assertInvariants(after)
  })

  it('crossed: -1 жетон, минимум 0', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { seagull: 'crossed' },
      seagullTokens: 2,
    })
    const after = selectCard(state, navCardId)
    expect(after.seagullTokens).toBe(1)
  })

  it('crossed на 0 чайках остаётся 0', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { seagull: 'crossed' },
    })
    const after = selectCard(state, navCardId)
    expect(after.seagullTokens).toBe(0)
  })

  it('4-я чайка → phase=scoring', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { seagull: 'normal' },
      seagullTokens: 3,
    })
    const after = selectCard(state, navCardId)
    expect(after.phase.kind).toBe('scoring')
    expect(after.seagullTokens).toBe(4)
  })
})

// ============================================================================
// Overboard
// ============================================================================

describe('Overboard', () => {
  it('обычный → +1 wound и потеря открытых припасов, остаётся в лодке', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          open: [{ kind: 'money', valuePoints: 1, isValuable: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const moneyId = state.players['p-1']!.openSupplies[0]!
    const after = selectCard(state, navCardId)
    const p1 = after.players['p-1']!
    expect(p1.wounds).toBe(1)
    expect(p1.openSupplies).not.toContain(moneyId)
    expect(after.supplyDiscard).toContain(moneyId)
    // Остался в лодке
    expect(after.seats[0]!.occupantId).toBe('p-1')
    assertInvariants(after)
  })

  it('Черпак (cook) → нет ранения, теряет открытые', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'cherpak',
          open: [{ kind: 'money', valuePoints: 1, isValuable: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['cherpak'] },
    })
    const moneyId = state.players['p-1']!.openSupplies[0]!
    const after = selectCard(state, navCardId)
    expect(after.players['p-1']!.wounds).toBe(0)
    expect(after.players['p-1']!.openSupplies).not.toContain(moneyId)
  })

  it('открытый life_ring → не падает, всё цело', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          open: [
            { kind: 'life_ring' },
            { kind: 'money', valuePoints: 1, isValuable: true },
          ],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const moneyId = state.players['p-1']!.openSupplies.find(
      (id) => state.supplyById[id]!.kind === 'money',
    )!
    const after = selectCard(state, navCardId)
    expect(after.players['p-1']!.wounds).toBe(0)
    expect(after.players['p-1']!.openSupplies).toContain(moneyId)
  })

  it('закрытый life_ring + USE_LIFE_RING → реактивно спасает', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          closed: [{ kind: 'life_ring' }],
          open: [{ kind: 'money', valuePoints: 1, isValuable: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const ringId = state.players['p-1']!.closedSupplies[0]!
    const moneyId = state.players['p-1']!.openSupplies[0]!
    const afterSelect = selectCard(state, navCardId)
    // Должен быть в overboardLifeRing step
    if (
      afterSelect.phase.kind !== 'evening' ||
      afterSelect.phase.subPhase.kind !== 'resolving' ||
      afterSelect.phase.subPhase.step.kind !== 'overboardLifeRing'
    ) {
      throw new Error('expected overboardLifeRing step')
    }
    const r = reduce(afterSelect, {
      kind: 'USE_LIFE_RING',
      playerId: 'p-1',
      supplyId: ringId,
      targetCharacter: 'bocman',
    })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(0)
    expect(r.state.players['p-1']!.openSupplies).toContain(ringId)
    expect(r.state.players['p-1']!.openSupplies).toContain(moneyId)
  })

  it('закрытый life_ring + EVENING_SKIP_LIFE_RING → падает', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          closed: [{ kind: 'life_ring' }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, { kind: 'EVENING_SKIP_LIFE_RING', playerId: 'p-1' })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(1)
  })

  it('без сознания + за борт без круга → corpse swept (dead, seat=null)', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          consciousness: 'unconscious',
          open: [{ kind: 'money', valuePoints: 1, isValuable: true }],
          closed: [{ kind: 'water', singleUse: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const moneyId = state.players['p-1']!.openSupplies[0]!
    const waterId = state.players['p-1']!.closedSupplies[0]!
    const after = selectCard(state, navCardId)
    expect(after.players['p-1']!.consciousness).toBe('dead')
    expect(after.seats[0]!.occupantId).toBeNull()
    expect(after.supplyDiscard).toContain(moneyId)
    expect(after.supplyDiscard).toContain(waterId)
    assertInvariants(after)
  })

  it('без сознания + открытый круг → не падает, остаётся в лодке', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          consciousness: 'unconscious',
          open: [{ kind: 'life_ring' }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const after = selectCard(state, navCardId)
    expect(after.players['p-1']!.consciousness).toBe('unconscious')
    expect(after.seats[0]!.occupantId).toBe('p-1')
  })
})

// ============================================================================
// Shark bait
// ============================================================================

describe('Shark bait', () => {
  it('Использовать → всем за бортом +1 wound', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        {
          character: 'shket',
          open: [{ kind: 'shark_bait', singleUse: true }],
        },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const baitId = state.players['p-2']!.openSupplies[0]!
    const afterSelect = selectCard(state, navCardId)
    // bocman без life_ring → сразу попадает в overboardFinal → переход к shark_bait step.
    if (
      afterSelect.phase.kind !== 'evening' ||
      afterSelect.phase.subPhase.kind !== 'resolving' ||
      afterSelect.phase.subPhase.step.kind !== 'sharkBait'
    ) {
      throw new Error(`expected sharkBait step, got ${JSON.stringify(afterSelect.phase)}`)
    }
    // p-1 уже получил +1 от падения
    expect(afterSelect.players['p-1']!.wounds).toBe(1)
    const r = reduce(afterSelect, {
      kind: 'EVENING_USE_SHARK_BAIT',
      playerId: 'p-2',
      supplyId: baitId,
    })
    expectOk(r)
    // +1 от приманки → total 2
    expect(r.state.players['p-1']!.wounds).toBe(2)
    expect(r.state.supplyDiscard).toContain(baitId)
  })

  it('Skip → ранений не добавлено', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        {
          character: 'shket',
          open: [{ kind: 'shark_bait', singleUse: true }],
        },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { overboard: ['bocman'] },
    })
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, { kind: 'EVENING_SKIP_SHARK_BAIT', playerId: 'p-2' })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(1) // только от падения
  })

  it('Никто overboard → шаг пропускается', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          open: [{ kind: 'shark_bait', singleUse: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: {},
    })
    const after = selectCard(state, navCardId)
    // Никого нет за бортом — пропускаем shark_bait, идём в thirst (тоже пусто) → cleanup → morning.
    expect(after.phase.kind).toBe('morning')
  })
})

// ============================================================================
// Thirst
// ============================================================================

describe('Thirst', () => {
  it('Имя в карте + грёб = 2 раны → 2 раза decline → +2 wounds', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', rowed: true }, // указан + грёб
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'], rowers: true } },
    })
    let cur = selectCard(state, navCardId)
    // Должны быть в thirst step с 2 wounds для bocman
    if (
      cur.phase.kind !== 'evening' ||
      cur.phase.subPhase.kind !== 'resolving' ||
      cur.phase.subPhase.step.kind !== 'thirst'
    ) {
      throw new Error('expected thirst step')
    }
    expect(cur.phase.subPhase.step.queue[0]!.remainingWounds).toBe(2)
    // Decline дважды
    for (let i = 0; i < 2; i++) {
      const r = reduce(cur, {
        kind: 'EVENING_DECLINE_WATER',
        playerId: 'p-1',
        targetCharacter: 'bocman',
      })
      expectOk(r)
      cur = r.state
    }
    expect(cur.players['p-1']!.wounds).toBe(2)
  })

  it('1 вода = -1 ранение', () => {
    const { state, navCardId } = buildEvening({
      players: [
        {
          character: 'bocman',
          closed: [{ kind: 'water', singleUse: true }],
        },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'] } },
    })
    const waterId = state.players['p-1']!.closedSupplies[0]!
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, {
      kind: 'EVENING_USE_WATER',
      playerId: 'p-1',
      supplyId: waterId,
      targetCharacter: 'bocman',
    })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(0)
    expect(r.state.supplyDiscard).toContain(waterId)
  })

  it('Открытый зонтик: 1 источник = 0 ран (зонтик поглотил)', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', open: [{ kind: 'umbrella' }] },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'] } },
    })
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, {
      kind: 'EVENING_DECLINE_WATER',
      playerId: 'p-1',
      targetCharacter: 'bocman',
    })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(0)
  })

  it('Зонтик прикрывает только 1 ранение за вечер (2 источника = 1 рана)', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', rowed: true, open: [{ kind: 'umbrella' }] },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'], rowers: true } },
    })
    let cur = selectCard(state, navCardId)
    for (let i = 0; i < 2; i++) {
      const r = reduce(cur, {
        kind: 'EVENING_DECLINE_WATER',
        playerId: 'p-1',
        targetCharacter: 'bocman',
      })
      expectOk(r)
      cur = r.state
    }
    expect(cur.players['p-1']!.wounds).toBe(1)
  })

  it('Без сознания + жажда без воды → death', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', consciousness: 'unconscious' }, // wounds=8 (strength)
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'] } },
    })
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, {
      kind: 'EVENING_DECLINE_WATER',
      playerId: 'p-2',
      targetCharacter: 'bocman',
    })
    expectOk(r)
    expect(r.state.players['p-1']!.consciousness).toBe('dead')
  })

  it('Без сознания + другой отдал воду → спасён', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', consciousness: 'unconscious' },
        {
          character: 'shket',
          open: [{ kind: 'water', singleUse: true }],
        },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: { thirst: { named: ['bocman'] } },
    })
    const waterId = state.players['p-2']!.openSupplies[0]!
    const afterSelect = selectCard(state, navCardId)
    const r = reduce(afterSelect, {
      kind: 'EVENING_USE_WATER',
      playerId: 'p-2',
      supplyId: waterId,
      targetCharacter: 'bocman',
    })
    expectOk(r)
    // bocman не получил ранения → consciousness=unconscious (wounds=strength=8)
    expect(r.state.players['p-1']!.consciousness).toBe('unconscious')
    expect(r.state.players['p-1']!.wounds).toBe(8)
  })
})

// ============================================================================
// Compass
// ============================================================================

describe('Compass', () => {
  it('Использовать → +1 карта в pool', () => {
    const { state } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan', open: [{ kind: 'compass' }] },
      ],
      navCard: {},
    })
    const compassId = state.players['p-4']!.openSupplies[0]!
    const r = reduce(state, {
      kind: 'EVENING_USE_COMPASS',
      playerId: 'p-4',
      supplyId: compassId,
    })
    expectOk(r)
    if (r.state.phase.kind !== 'evening' || r.state.phase.subPhase.kind !== 'sternPicking') {
      throw new Error('expected sternPicking')
    }
    expect(r.state.phase.subPhase.pool.length).toBe(2)
    expect(r.state.phase.subPhase.compassUsed).toBe(true)
  })

  it('Compass дважды → ALREADY_USED_ABILITY', () => {
    const { state } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan', open: [{ kind: 'compass' }] },
      ],
      navCard: {},
    })
    const compassId = state.players['p-4']!.openSupplies[0]!
    const r1 = reduce(state, {
      kind: 'EVENING_USE_COMPASS',
      playerId: 'p-4',
      supplyId: compassId,
    })
    expectOk(r1)
    const r2 = reduce(r1.state, {
      kind: 'EVENING_USE_COMPASS',
      playerId: 'p-4',
      supplyId: compassId,
    })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('ALREADY_USED_ABILITY')
  })
})

// ============================================================================
// Cleanup + переход в morning
// ============================================================================

describe('Cleanup + переход в morning', () => {
  it('rowed/fought сбрасываются, фаза = morning, day+1', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman', rowed: true, fought: true },
        { character: 'shket', rowed: true },
        { character: 'snob', fought: true },
        { character: 'kapitan' },
      ],
      navCard: {}, // карта без эффектов
    })
    const beforeDay = state.day
    const after = selectCard(state, navCardId)
    expect(after.phase.kind).toBe('morning')
    expect(after.day).toBe(beforeDay + 1)
    for (const p of Object.values(after.players)) {
      expect(p.rowed).toBe(false)
      expect(p.fought).toBe(false)
    }
    assertInvariants(after)
  })

  it('Карта уходит в navDiscard', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: {},
    })
    const after = selectCard(state, navCardId)
    expect(after.navDiscard).toContain(navCardId)
  })
})

// ============================================================================
// Acceptance: полный мини-цикл (morning → day SKIP × 4 → evening → morning)
// ============================================================================

describe('Acceptance: полный цикл day→evening→next day', () => {
  it('Из buildEvening: select empty card → переход в morning, готов следующий день', () => {
    const { state, navCardId } = buildEvening({
      players: [
        { character: 'bocman' },
        { character: 'shket' },
        { character: 'snob' },
        { character: 'kapitan' },
      ],
      navCard: {},
    })
    const after = selectCard(state, navCardId)
    expect(after.phase.kind).toBe('morning')
    // У всех 4 conscious → раздача 4 карт
    if (after.phase.kind === 'morning' && after.phase.subPhase.kind === 'distributing') {
      expect(after.phase.subPhase.pile.length).toBe(4)
    }
    assertInvariants(after)
  })
})
