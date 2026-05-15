// Тесты Фазы 4: swap, rob, fight.

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

// ---------- Builder ----------

interface PlayerSetup {
  character: CharacterId
  wounds?: number
  consciousness?: 'conscious' | 'unconscious' | 'dead'
  open?: ReadonlyArray<Partial<SupplyCard> & { kind: SupplyCard['kind'] }>
  closed?: ReadonlyArray<Partial<SupplyCard> & { kind: SupplyCard['kind'] }>
}

/** Построить state в фазе day.waitingForAction с явным составом 4 игроков (по 1 на seat 0..3). */
function buildDay(playersSetup: PlayerSetup[]): GameState {
  if (playersSetup.length !== 4) throw new Error('test fixture supports 4 players')
  const chars = playersSetup.map((p) => p.character)
  if (new Set(chars).size !== chars.length) {
    throw new Error(`buildDay: duplicate characters in setup: ${chars.join(',')}`)
  }

  let supplyCounter = 1
  const supplyById: Record<string, SupplyCard> = {}
  const players: Record<PlayerId, Player> = {}
  const seats: Seat[] = playersSetup.map((ps, i) => {
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
      bestFriend: ch, // не важно для боёв
      worstEnemy: ch,
      consciousness: cons,
      wounds,
      rowed: false,
      fought: false,
      openSupplies: open,
      closedSupplies: closed,
      hasUsedShketSteal: false,
      disconnected: false,
    }
    return { index: i as SeatIndex, occupantId: id as PlayerId, removed: false }
  })
  // 5й и 6й seats — removed
  while (seats.length < 6) {
    seats.push({ index: seats.length as SeatIndex, occupantId: null, removed: true })
  }

  const turnOrder: SeatIndex[] = [0, 1, 2, 3]
  const dayActionsTaken: Record<PlayerId, boolean> = {}
  for (const id of Object.keys(players)) dayActionsTaken[id] = false

  const removedCharacters = CHARACTERS.map((c) => c.id).filter(
    (id) => !playersSetup.some((p) => p.character === id),
  )

  // Набить колоду припасов до 42 плейсхолдерами (вид water, чтобы не влияли на тесты).
  const supplyDeck: string[] = []
  const playerSupplyCount = Object.values(players).reduce(
    (acc, p) => acc + p.openSupplies.length + p.closedSupplies.length,
    0,
  )
  for (let i = playerSupplyCount; i < SUPPLY_DECK_SIZE; i++) {
    const id = `s-${supplyCounter++}`
    supplyById[id] = {
      id,
      kind: 'water',
      singleUse: true,
      isWeapon: false,
      isValuable: false,
    }
    supplyDeck.push(id)
  }

  // Набить колоду навигации 24 плейсхолдерами (пустые: seagull='none', overboard=[], thirst=пусто).
  const navById: Record<string, NavigationCard> = {}
  const navDeck: string[] = []
  for (let i = 0; i < NAVIGATION_DECK_SIZE; i++) {
    const id = `n-${i + 1}`
    navById[id] = {
      id,
      seagull: 'none',
      overboard: [],
      thirst: { rowers: false, fighters: false, named: [] },
    }
    navDeck.push(id)
  }

  return {
    gameId: 'f',
    hostId: 'p-1',
    seed: 1,
    rng: createRng(1),
    day: 1,
    players,
    seats,
    removedCharacters,
    supplyDeck,
    supplyDiscard: [],
    navDeck,
    navDiscard: [],
    navPool: [],
    supplyById,
    navById,
    seagullTokens: 0,
    phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: 0 } },
    turnOrder,
    currentTurnIndex: 0,
    dayActionsTaken,
    log: [],
    winner: null,
    finalScores: null,
  }
}

function expectOk<T extends { ok: boolean }>(r: T): asserts r is T & { ok: true } {
  if (!r.ok) throw new Error(`expected ok, got: ${JSON.stringify(r)}`)
}

// ============================================================================
// SWAP
// ============================================================================

describe('SWAP', () => {
  it('PROPOSAL_ACCEPT: банки меняются местами', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r1 = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    expect(r1.state.phase.kind).toBe('day')
    if (r1.state.phase.kind === 'day') {
      expect(r1.state.phase.subPhase.kind).toBe('awaitingSwapResponse')
    }
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_ACCEPT', playerId: 'p-2' })
    expectOk(r2)
    // Банки поменялись
    expect(r2.state.seats[0]!.occupantId).toBe('p-2')
    expect(r2.state.seats[1]!.occupantId).toBe('p-1')
    // Ход атакующего использован
    expect(r2.state.dayActionsTaken['p-1']).toBe(true)
    assertInvariants(r2.state)
  })

  it('Жертва без сознания → авто-своп без согласия', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket', consciousness: 'unconscious' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 1 })
    expectOk(r)
    expect(r.state.seats[0]!.occupantId).toBe('p-2')
    expect(r.state.seats[1]!.occupantId).toBe('p-1')
  })

  it('Жертва отказывается → переход в fight', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r1 = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_REJECT', playerId: 'p-2' })
    expectOk(r2)
    expect(r2.state.phase.kind).toBe('day')
    if (r2.state.phase.kind === 'day' && r2.state.phase.subPhase.kind === 'fight') {
      const f = r2.state.phase.subPhase.fight
      expect(f.reason).toBe('swap')
      expect(f.attackerId).toBe('p-1')
      expect(f.defenderId).toBe('p-2')
      expect(f.targetSeat).toBe(1)
    } else {
      throw new Error('expected fight subphase')
    }
  })

  it('Свопить себя нельзя', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET')
  })

  it('PROPOSAL_ACCEPT не от жертвы → NOT_YOUR_TURN', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r1 = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_ACCEPT', playerId: 'p-3' })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('NOT_YOUR_TURN')
  })
})

// ============================================================================
// ROB
// ============================================================================

describe('ROB', () => {
  it('PROPOSAL_ACCEPT → completingRobPick, attacker берёт открытую', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket', open: [{ kind: 'money', valuePoints: 1, isValuable: true }] },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const victimMoney = state.players['p-2']!.openSupplies[0]!
    const r1 = reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_ACCEPT', playerId: 'p-2' })
    expectOk(r2)
    if (r2.state.phase.kind !== 'day' || r2.state.phase.subPhase.kind !== 'completingRobPick') {
      throw new Error('expected completingRobPick')
    }
    const r3 = reduce(r2.state, {
      kind: 'ROB_PICK',
      playerId: 'p-1',
      pick: { kind: 'open', supplyId: victimMoney },
    })
    expectOk(r3)
    expect(r3.state.players['p-1']!.openSupplies).toContain(victimMoney)
    expect(r3.state.players['p-2']!.openSupplies).not.toContain(victimMoney)
    expect(r3.state.dayActionsTaken['p-1']).toBe(true)
  })

  it('Закрытая случайная: -1 у жертвы, +1 у атакующего, карта остаётся closed', () => {
    const state = buildDay([
      { character: 'bocman' },
      {
        character: 'shket',
        closed: [
          { kind: 'water', singleUse: true },
          { kind: 'first_aid', singleUse: true },
        ],
      },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const victimClosedBefore = state.players['p-2']!.closedSupplies.length
    const r1 = reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_ACCEPT', playerId: 'p-2' })
    expectOk(r2)
    const r3 = reduce(r2.state, {
      kind: 'ROB_PICK',
      playerId: 'p-1',
      pick: { kind: 'closed' },
    })
    expectOk(r3)
    expect(r3.state.players['p-2']!.closedSupplies.length).toBe(victimClosedBefore - 1)
    expect(r3.state.players['p-1']!.closedSupplies.length).toBe(1)
  })

  it('Жертва без припасов → CARD_NOT_OWNED', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r = reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_NOT_OWNED')
  })

  it('Отказ → fight (reason=rob)', () => {
    const state = buildDay([
      { character: 'bocman' },
      { character: 'shket', closed: [{ kind: 'water', singleUse: true }] },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r1 = reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat: 1 })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_REJECT', playerId: 'p-2' })
    expectOk(r2)
    if (r2.state.phase.kind === 'day' && r2.state.phase.subPhase.kind === 'fight') {
      expect(r2.state.phase.subPhase.fight.reason).toBe('rob')
    } else {
      throw new Error('expected fight')
    }
  })

  it('Жертва без сознания → сразу к выбору карты', () => {
    const state = buildDay([
      { character: 'bocman' },
      {
        character: 'shket',
        consciousness: 'unconscious',
        open: [{ kind: 'jewelry', valuePoints: 3, isValuable: true }],
      },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const r = reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat: 1 })
    expectOk(r)
    if (r.state.phase.kind !== 'day' || r.state.phase.subPhase.kind !== 'completingRobPick') {
      throw new Error('expected completingRobPick')
    }
  })
})

// ============================================================================
// FIGHT
// ============================================================================

describe('FIGHT', () => {
  function offerAndReject(state: GameState, kind: 'swap' | 'rob', targetSeat = 1): GameState {
    const r1 =
      kind === 'swap'
        ? reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat })
        : reduce(state, { kind: 'OFFER_ROB', playerId: 'p-1', targetSeat })
    expectOk(r1)
    const defenderId = state.seats[targetSeat]!.occupantId!
    const r2 = reduce(r1.state, { kind: 'PROPOSAL_REJECT', playerId: defenderId })
    expectOk(r2)
    return r2.state
  }

  it('Без союзников: bocman(8) vs shket(3) → атакующий побеждает (swap)', () => {
    let state = buildDay([
      { character: 'bocman' }, // atk str=8
      { character: 'shket' }, // def str=3
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    state = offerAndReject(state, 'swap')
    const r = reduce(state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r)
    // Атакующий победил → банки поменялись
    expect(r.state.seats[0]!.occupantId).toBe('p-2')
    expect(r.state.seats[1]!.occupantId).toBe('p-1')
    // Усталость: все участники fought=true
    expect(r.state.players['p-1']!.fought).toBe(true)
    expect(r.state.players['p-2']!.fought).toBe(true)
    // Проигравший shket: +1 wound
    expect(r.state.players['p-2']!.wounds).toBe(1)
    // Победитель не получает ран
    expect(r.state.players['p-1']!.wounds).toBe(0)
    assertInvariants(r.state)
  })

  it('Равенство сил: 6 vs 6 → побеждает жертва (rob)', () => {
    // shket(3) + knife(weaponStrength=3) = 6 vs cherpak(6) → tie → defender побеждает.
    let state = buildDay([
      {
        character: 'shket',
        open: [{ kind: 'knife', weaponStrength: 3, isWeapon: true }],
      },
      { character: 'cherpak', closed: [{ kind: 'water', singleUse: true }] },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const knifeId = state.players['p-1']!.openSupplies[0]!
    state = offerAndReject(state, 'rob')
    const r1 = reduce(state, {
      kind: 'FIGHT_ADD_WEAPON',
      playerId: 'p-1',
      weaponSupplyId: knifeId,
    })
    expectOk(r1)
    const r = reduce(r1.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r)
    // Жертва побеждает → атакующий получил рану, ничего не забрал.
    expect(r.state.players['p-1']!.wounds).toBe(1)
    expect(r.state.players['p-2']!.wounds).toBe(0)
    expect(r.state.players['p-2']!.closedSupplies.length).toBe(1)
    expect(r.state.dayActionsTaken['p-1']).toBe(true)
    assertInvariants(r.state)
  })

  it('Союзник: 3 (атакующий shket) + 5 (snob союзник) = 8 vs 8 (bocman) → tie → жертва побеждает', () => {
    // Раскладка: p-1 shket(3) атакует p-2 bocman(8). Union p-3 snob(5) идёт за атакующего.
    let state = buildDay([
      { character: 'shket' }, // p-1 atk
      { character: 'bocman' }, // p-2 def
      { character: 'snob' }, // p-3 будущий союзник
      { character: 'kapitan' },
    ])
    state = offerAndReject(state, 'swap', 1)
    // Атакующий приглашает snob (p-3)
    const r1 = reduce(state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-1',
      targetCharacter: 'snob',
      side: 'attacker',
    })
    expectOk(r1)
    // snob принимает (без оружия)
    const r2 = reduce(r1.state, {
      kind: 'FIGHT_ALLY_RESPONSE',
      playerId: 'p-3',
      accept: true,
      weapons: [],
    })
    expectOk(r2)
    // Закрытие набора
    const r3 = reduce(r2.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r3)
    // Силы: атк = 3+5=8; защ = 8. tie → defender. Атакующий и snob ранены.
    expect(r3.state.players['p-2']!.wounds).toBe(0) // победитель
    expect(r3.state.players['p-1']!.wounds).toBe(1)
    expect(r3.state.players['p-3']!.wounds).toBe(1)
    expect(r3.state.players['p-3']!.fought).toBe(true)
    // Свопа не было
    expect(r3.state.seats[0]!.occupantId).toBe('p-1')
    expect(r3.state.seats[1]!.occupantId).toBe('p-2')
  })

  it('Оружие: shket(3) + hook(4) = 7 vs miledi(4) → атакующий побеждает', () => {
    let state = buildDay([
      {
        character: 'shket',
        open: [{ kind: 'hook', weaponStrength: 4, isWeapon: true }],
      },
      { character: 'miledi' }, // str 4
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const hookId = state.players['p-1']!.openSupplies[0]!
    state = offerAndReject(state, 'swap')
    // Атакующий добавляет hook в драку
    const r1 = reduce(state, {
      kind: 'FIGHT_ADD_WEAPON',
      playerId: 'p-1',
      weaponSupplyId: hookId,
    })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r2)
    // 3+4=7 > 4 → атакующий выигрывает (своп)
    expect(r2.state.seats[0]!.occupantId).toBe('p-2')
    expect(r2.state.seats[1]!.occupantId).toBe('p-1')
    // hook многоразовый → остался в открытых
    expect(r2.state.players['p-1']!.openSupplies).toContain(hookId)
  })

  it('Одноразовое оружие flare → discard после драки', () => {
    let state = buildDay([
      {
        character: 'shket',
        open: [{ kind: 'flare', weaponStrength: 10, isWeapon: true, singleUse: true }],
      },
      { character: 'bocman' }, // str 8
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const flareId = state.players['p-1']!.openSupplies[0]!
    state = offerAndReject(state, 'swap')
    const r1 = reduce(state, {
      kind: 'FIGHT_ADD_WEAPON',
      playerId: 'p-1',
      weaponSupplyId: flareId,
    })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r2)
    // 3+10=13 > 8 → атакующий выиграл, flare ушёл в discard.
    expect(r2.state.supplyDiscard).toContain(flareId)
    expect(r2.state.players['p-1']!.openSupplies).not.toContain(flareId)
  })

  it('FIGHT_ADD_WEAPON: закрытое оружие автоматически раскрывается', () => {
    let state = buildDay([
      {
        character: 'shket',
        closed: [{ kind: 'knife', weaponStrength: 3, isWeapon: true }],
      },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const knifeId = state.players['p-1']!.closedSupplies[0]!
    state = offerAndReject(state, 'swap')
    const r1 = reduce(state, {
      kind: 'FIGHT_ADD_WEAPON',
      playerId: 'p-1',
      weaponSupplyId: knifeId,
    })
    expectOk(r1)
    expect(r1.state.players['p-1']!.openSupplies).toContain(knifeId)
    expect(r1.state.players['p-1']!.closedSupplies).not.toContain(knifeId)
  })

  it('Только attacker может закрыть recruitment', () => {
    let state = buildDay([
      { character: 'shket' },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    state = offerAndReject(state, 'swap')
    const r = reduce(state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-2' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_HOST')
  })

  it('Защитник может приглашать союзников на свою сторону', () => {
    let state = buildDay([
      { character: 'shket' }, // p-1 atk 3
      { character: 'miledi' }, // p-2 def 4
      { character: 'cherpak' }, // p-3 будущий defender союзник 6
      { character: 'bocman' }, // p-4
    ])
    state = offerAndReject(state, 'swap', 1)
    // Defender приглашает cherpak
    const r1 = reduce(state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-2',
      targetCharacter: 'cherpak',
      side: 'defender',
    })
    expectOk(r1)
    const r2 = reduce(r1.state, {
      kind: 'FIGHT_ALLY_RESPONSE',
      playerId: 'p-3',
      accept: true,
      weapons: [],
    })
    expectOk(r2)
    if (r2.state.phase.kind !== 'day' || r2.state.phase.subPhase.kind !== 'fight') {
      throw new Error('expected fight')
    }
    expect(r2.state.phase.subPhase.fight.defenderAllies).toEqual(['p-3'])
    // Закрыть
    const r3 = reduce(r2.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r3)
    // 3 vs 4+6=10 → защитник побеждает, атакующий ранен
    expect(r3.state.players['p-1']!.wounds).toBe(1)
    expect(r3.state.players['p-3']!.wounds).toBe(0)
    expect(r3.state.players['p-3']!.fought).toBe(true)
  })

  it('Союзник отказывается → pendingAlly очищается, recruitment продолжается', () => {
    let state = buildDay([
      { character: 'shket' },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    state = offerAndReject(state, 'swap')
    const r1 = reduce(state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-1',
      targetCharacter: 'snob',
      side: 'attacker',
    })
    expectOk(r1)
    const r2 = reduce(r1.state, {
      kind: 'FIGHT_ALLY_RESPONSE',
      playerId: 'p-3',
      accept: false,
      weapons: [],
    })
    expectOk(r2)
    if (r2.state.phase.kind !== 'day' || r2.state.phase.subPhase.kind !== 'fight') {
      throw new Error('expected fight')
    }
    expect(r2.state.phase.subPhase.fight.pendingAlly).toBeNull()
    expect(r2.state.phase.subPhase.fight.attackerAllies).toEqual([])
  })

  it('Двойное приглашение пока одно pending → BUSINESS_RULE_VIOLATION', () => {
    let state = buildDay([
      { character: 'shket' },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    state = offerAndReject(state, 'swap')
    const r1 = reduce(state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-1',
      targetCharacter: 'snob',
      side: 'attacker',
    })
    expectOk(r1)
    const r2 = reduce(r1.state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-1',
      targetCharacter: 'kapitan',
      side: 'attacker',
    })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('BUSINESS_RULE_VIOLATION')
  })

  it('Во время драки DISCARD_SUPPLY и GIVE_SUPPLY заблокированы', () => {
    let state = buildDay([
      {
        character: 'shket',
        open: [{ kind: 'money', valuePoints: 1, isValuable: true }],
      },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const moneyId = state.players['p-1']!.openSupplies[0]!
    state = offerAndReject(state, 'swap')
    const rDiscard = reduce(state, {
      kind: 'DISCARD_SUPPLY',
      playerId: 'p-1',
      supplyId: moneyId,
    })
    expect(rDiscard.ok).toBe(false)
    if (!rDiscard.ok) expect(rDiscard.error.code).toBe('NOT_ALLOWED_DURING_FIGHT')
    const rGive = reduce(state, {
      kind: 'GIVE_SUPPLY',
      playerId: 'p-1',
      targetCharacter: 'bocman',
      supplyId: moneyId,
      faceUp: true,
    })
    expect(rGive.ok).toBe(false)
    if (!rGive.ok) expect(rGive.error.code).toBe('NOT_ALLOWED_DURING_FIGHT')
  })

  it('Wounds доводят до unconscious / dead', () => {
    let state = buildDay([
      { character: 'shket' }, // str 3
      { character: 'bocman' }, // str 8
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    // Загоним shket'у 2 раны заранее → +1 после боя = 3 = unconscious.
    state = {
      ...state,
      players: { ...state.players, 'p-1': { ...state.players['p-1']!, wounds: 2 } },
    }
    state = offerAndReject(state, 'swap')
    const r = reduce(state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r)
    expect(r.state.players['p-1']!.wounds).toBe(3)
    expect(r.state.players['p-1']!.consciousness).toBe('unconscious')
  })

  it('Атакующий с равным числом в rob → жертва побеждает и сохраняет припасы', () => {
    // shket(3) + oar(1) = 4 vs miledi(4) → tie → defender wins, припасы остаются.
    let state = buildDay([
      {
        character: 'shket',
        open: [{ kind: 'oar', weaponStrength: 1, isWeapon: true }],
      },
      { character: 'miledi', closed: [{ kind: 'water', singleUse: true }] },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const oarId = state.players['p-1']!.openSupplies[0]!
    state = offerAndReject(state, 'rob')
    const r1 = reduce(state, {
      kind: 'FIGHT_ADD_WEAPON',
      playerId: 'p-1',
      weaponSupplyId: oarId,
    })
    expectOk(r1)
    const r2 = reduce(r1.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(r2)
    // 4 vs 4 → defender. Жертва сохранила closed, атакующий ранен.
    expect(r2.state.players['p-2']!.closedSupplies.length).toBe(1)
    expect(r2.state.players['p-1']!.wounds).toBe(1)
    assertInvariants(r2.state)
  })
})

// ============================================================================
// Acceptance: примеры из правил
// ============================================================================

describe('FIGHT — примеры из правил', () => {
  it('Tie с союзником: 3 + 5 = 8 vs 8 → жертва побеждает', () => {
    // Этот же тест что в FIGHT > Союзник, дублируем для документации acceptance
    let state = buildDay([
      { character: 'shket' },
      { character: 'bocman' },
      { character: 'snob' },
      { character: 'kapitan' },
    ])
    const swap = reduce(state, { kind: 'OFFER_SWAP', playerId: 'p-1', targetSeat: 1 })
    expectOk(swap)
    const rej = reduce(swap.state, { kind: 'PROPOSAL_REJECT', playerId: 'p-2' })
    expectOk(rej)
    state = rej.state
    const recruit = reduce(state, {
      kind: 'FIGHT_RECRUIT_ALLY',
      playerId: 'p-1',
      targetCharacter: 'snob',
      side: 'attacker',
    })
    expectOk(recruit)
    const join = reduce(recruit.state, {
      kind: 'FIGHT_ALLY_RESPONSE',
      playerId: 'p-3',
      accept: true,
      weapons: [],
    })
    expectOk(join)
    const close = reduce(join.state, { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: 'p-1' })
    expectOk(close)
    // 3+5=8 vs 8 → defender win
    expect(close.state.seats[1]!.occupantId).toBe('p-2') // не свопнулись
    expect(close.state.players['p-2']!.wounds).toBe(0)
  })
})
