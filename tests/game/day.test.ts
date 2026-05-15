// Тесты дневных действий (Фаза 3 roadmap'a): ROW, USE_*, SHKET_STEAL, реактивные,
// SKIP_TURN и полный круг день → вечер.

import { beforeEach, describe, expect, it } from 'vitest'
import type { CharacterId } from '@/game/constants'
import { CHARACTERS } from '@/game/constants'
import { assertInvariants } from '@/game/invariants'
import { reduce } from '@/game/reducer'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { GameState, NavigationCard, Player, SupplyCard, SupplyInstanceId } from '@/game/types'

// ---------- helpers ----------

function makePlayers(n: number): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i + 1}`,
    displayName: `P${i + 1}`,
    isBot: false,
  }))
}

function startGame(state: GameState): GameState {
  const r = reduce(state, { kind: 'START_GAME', playerId: state.hostId })
  if (!r.ok) throw new Error(`START_GAME: ${r.error.message}`)
  return r.state
}

/** Прокрутить утро автоматически (каждый conscious берёт первую карту из pile). */
function finishMorning(state: GameState): GameState {
  let cur = state
  while (cur.phase.kind === 'morning' && cur.phase.subPhase.kind === 'distributing') {
    const sub = cur.phase.subPhase
    const seat = cur.seats[sub.currentSeat]!
    const pid = seat.occupantId!
    const r = reduce(cur, { kind: 'CHOOSE_SUPPLY', playerId: pid, supplyId: sub.pile[0]! })
    if (!r.ok) throw new Error(`CHOOSE_SUPPLY: ${r.error.message}`)
    cur = r.state
  }
  return cur
}

function makeReadyState(seed = 1): GameState {
  const players = makePlayers(4)
  return finishMorning(
    startGame(createInitialState({ gameId: 'g', hostId: players[0]!.id, seed, players })),
  )
}

function currentDaySeat(state: GameState): { seat: number; player: Player } {
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'waitingForAction') {
    throw new Error(`not day.waitingForAction: ${state.phase.kind}`)
  }
  const seat = state.phase.subPhase.currentSeat
  const occ = state.seats[seat]!.occupantId!
  return { seat, player: state.players[occ]! }
}

/** Хирургически добавить карту в открытые/закрытые припасы игрока (для теста). */
function giveCardToPlayer(
  state: GameState,
  playerId: string,
  card: Omit<SupplyCard, 'id'>,
  options: { open: boolean } = { open: false },
): { state: GameState; supplyId: SupplyInstanceId } {
  const id = `t-${Math.random().toString(36).slice(2, 9)}`
  const full: SupplyCard = { id, ...card }
  const supplyById = { ...state.supplyById, [id]: full }
  const p = state.players[playerId]!
  const newP = options.open
    ? { ...p, openSupplies: [...p.openSupplies, id] }
    : { ...p, closedSupplies: [...p.closedSupplies, id] }
  return {
    state: { ...state, supplyById, players: { ...state.players, [playerId]: newP } },
    supplyId: id,
  }
}

// ---------- ROW ----------

describe('ROW', () => {
  it('тянет 2 карты, переходит в rowing subphase', () => {
    const state = makeReadyState(11)
    const { player } = currentDaySeat(state)
    const r = reduce(state, { kind: 'ROW', playerId: player.id })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.phase.kind).toBe('day')
    if (r.state.phase.kind === 'day' && r.state.phase.subPhase.kind === 'rowing') {
      expect(r.state.phase.subPhase.drawn.length).toBe(2)
    } else {
      throw new Error('expected rowing subphase')
    }
  })

  it('ROW_KEEP_CARDS: 1 карта в navPool, 1 в discard, rowed=true, advance turn', () => {
    const state = makeReadyState(12)
    const { player } = currentDaySeat(state)
    const r1 = reduce(state, { kind: 'ROW', playerId: player.id })
    if (!r1.ok) throw new Error(r1.error.message)
    if (r1.state.phase.kind !== 'day' || r1.state.phase.subPhase.kind !== 'rowing') throw new Error('no rowing')
    const drawn = r1.state.phase.subPhase.drawn
    const keep = [drawn[0]!]
    const r2 = reduce(r1.state, {
      kind: 'ROW_KEEP_CARDS',
      playerId: player.id,
      cardIds: keep,
    })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.state.navPool).toEqual(keep)
    expect(r2.state.navDiscard).toContain(drawn[1])
    expect(r2.state.players[player.id]!.rowed).toBe(true)
    assertInvariants(r2.state)
  })

  it('ROW с 1 открытым веслом → берёт 3 карты', () => {
    let state = makeReadyState(13)
    const { player } = currentDaySeat(state)
    const oarCard: Omit<SupplyCard, 'id'> = {
      kind: 'oar',
      singleUse: false,
      isWeapon: true,
      isValuable: false,
      weaponStrength: 1,
    }
    const out = giveCardToPlayer(state, player.id, oarCard, { open: true })
    state = out.state
    const r = reduce(state, { kind: 'ROW', playerId: player.id })
    expect(r.ok).toBe(true)
    if (!r.ok || r.state.phase.kind !== 'day' || r.state.phase.subPhase.kind !== 'rowing') {
      throw new Error('expected rowing')
    }
    expect(r.state.phase.subPhase.drawn.length).toBe(3)
  })

  it('ROW с 2 закрытыми вёслами → берёт 4 карты, оба весла открыты', () => {
    let state = makeReadyState(14)
    const { player } = currentDaySeat(state)
    const oar = { kind: 'oar', singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 1 } as const
    state = giveCardToPlayer(state, player.id, oar).state
    state = giveCardToPlayer(state, player.id, oar).state
    const r = reduce(state, { kind: 'ROW', playerId: player.id })
    expect(r.ok).toBe(true)
    if (!r.ok || r.state.phase.kind !== 'day' || r.state.phase.subPhase.kind !== 'rowing') {
      throw new Error('expected rowing')
    }
    expect(r.state.phase.subPhase.drawn.length).toBe(4)
    const after = r.state.players[player.id]!
    const openOars = after.openSupplies.filter((id) => r.state.supplyById[id]?.kind === 'oar').length
    expect(openOars).toBe(2)
    expect(after.closedSupplies.filter((id) => r.state.supplyById[id]?.kind === 'oar')).toHaveLength(0)
  })

  it('ROW_KEEP_CARDS с чужим cardId → CARD_NOT_OWNED', () => {
    const state = makeReadyState(15)
    const { player } = currentDaySeat(state)
    const r1 = reduce(state, { kind: 'ROW', playerId: player.id })
    if (!r1.ok) throw new Error(r1.error.message)
    const r2 = reduce(r1.state, {
      kind: 'ROW_KEEP_CARDS',
      playerId: player.id,
      cardIds: ['fake-nav'],
    })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('CARD_NOT_OWNED')
  })

  it('ROW не своим ходом → NOT_YOUR_TURN', () => {
    const state = makeReadyState(16)
    const { seat } = currentDaySeat(state)
    const wrongSeat = state.seats.find((s) => !s.removed && s.occupantId && s.index !== seat)!
    const r = reduce(state, { kind: 'ROW', playerId: wrongSeat.occupantId! })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_YOUR_TURN')
  })
})

// ---------- USE_FIRST_AID ----------

describe('USE_FIRST_AID', () => {
  it('лечит 1 рану у себя', () => {
    let state = makeReadyState(21)
    const { player } = currentDaySeat(state)
    // Дать игроку рану и first_aid
    state = {
      ...state,
      players: { ...state.players, [player.id]: { ...player, wounds: 2 } },
    }
    const fa: Omit<SupplyCard, 'id'> = { kind: 'first_aid', singleUse: true, isWeapon: false, isValuable: false }
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, fa)
    const r = reduce(s1, {
      kind: 'USE_FIRST_AID',
      playerId: player.id,
      supplyId,
      targetCharacter: player.character,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[player.id]!.wounds).toBe(1)
    expect(r.state.supplyDiscard).toContain(supplyId)
  })

  it('возвращает в сознание (wounds=strength → wounds-1 < strength)', () => {
    let state = makeReadyState(22)
    const { player } = currentDaySeat(state)
    const strength = CHARACTERS.find((c) => c.id === player.character)!.strength
    // Найти жертву (другой conscious) и вырубить её
    const victim = Object.values(state.players).find(
      (p) => p.id !== player.id && p.consciousness === 'conscious',
    )!
    const vStrength = CHARACTERS.find((c) => c.id === victim.character)!.strength
    state = {
      ...state,
      players: {
        ...state.players,
        [victim.id]: { ...victim, wounds: vStrength, consciousness: 'unconscious' },
      },
    }
    const fa = { kind: 'first_aid', singleUse: true, isWeapon: false, isValuable: false } as const
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, fa)
    const r = reduce(s1, {
      kind: 'USE_FIRST_AID',
      playerId: player.id,
      supplyId,
      targetCharacter: victim.character,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const v2 = r.state.players[victim.id]!
    expect(v2.wounds).toBe(vStrength - 1)
    expect(v2.consciousness).toBe('conscious')
    void strength
  })

  it('не лечит мёртвого', () => {
    let state = makeReadyState(23)
    const { player } = currentDaySeat(state)
    const victim = Object.values(state.players).find((p) => p.id !== player.id)!
    const vS = CHARACTERS.find((c) => c.id === victim.character)!.strength
    state = {
      ...state,
      players: {
        ...state.players,
        [victim.id]: { ...victim, wounds: vS + 1, consciousness: 'dead' },
      },
    }
    const fa = { kind: 'first_aid', singleUse: true, isWeapon: false, isValuable: false } as const
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, fa)
    const r = reduce(s1, {
      kind: 'USE_FIRST_AID',
      playerId: player.id,
      supplyId,
      targetCharacter: victim.character,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('UNCONSCIOUS_OR_DEAD')
  })
})

// ---------- USE_UMBRELLA ----------

describe('USE_UMBRELLA', () => {
  it('кладёт зонтик открытым перед target', () => {
    const state = makeReadyState(31)
    const { player } = currentDaySeat(state)
    const target = Object.values(state.players).find((p) => p.id !== player.id)!
    const umb = { kind: 'umbrella', singleUse: false, isWeapon: false, isValuable: false } as const
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, umb)
    const r = reduce(s1, {
      kind: 'USE_UMBRELLA',
      playerId: player.id,
      supplyId,
      targetCharacter: target.character,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[target.id]!.openSupplies).toContain(supplyId)
    expect(r.state.players[player.id]!.closedSupplies).not.toContain(supplyId)
  })
})

// ---------- USE_FLARE ----------

describe('USE_FLARE', () => {
  it('подсматривает 3 верхние карты nav, начисляет чайки', () => {
    let state = makeReadyState(41)
    const { player } = currentDaySeat(state)
    // Соберём 3 nav-карты с фиксированными seagulls: normal, normal, crossed.
    const ids = ['nv-test-1', 'nv-test-2', 'nv-test-3']
    const nav: Record<string, NavigationCard> = {}
    nav['nv-test-1'] = { id: 'nv-test-1', seagull: 'normal', overboard: [], thirst: { rowers: false, fighters: false, named: [] } }
    nav['nv-test-2'] = { id: 'nv-test-2', seagull: 'normal', overboard: [], thirst: { rowers: false, fighters: false, named: [] } }
    nav['nv-test-3'] = { id: 'nv-test-3', seagull: 'crossed', overboard: [], thirst: { rowers: false, fighters: false, named: [] } }
    state = {
      ...state,
      navById: { ...state.navById, ...nav },
      navDeck: [...ids, ...state.navDeck],
    }
    const flare = { kind: 'flare', singleUse: true, isWeapon: true, isValuable: false } as const
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, flare)
    const before = s1.seagullTokens
    const r = reduce(s1, { kind: 'USE_FLARE', playerId: player.id, supplyId })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // 2 normal - 1 crossed = +1
    expect(r.state.seagullTokens).toBe(before + 1)
    expect(r.state.supplyDiscard).toContain(supplyId)
  })

  it('при 4 чайках → фаза scoring (game over)', () => {
    let state = makeReadyState(42)
    state = { ...state, seagullTokens: 3 } // одна чайка до конца
    const { player } = currentDaySeat(state)
    // Кладём 3 конкретные карты на верх — 1 normal + 2 none, чтобы итог точно +1.
    const empty = { rowers: false, fighters: false, named: [] as never[] }
    state = {
      ...state,
      navById: {
        ...state.navById,
        'nv-S1': { id: 'nv-S1', seagull: 'normal', overboard: [], thirst: empty },
        'nv-S2': { id: 'nv-S2', seagull: 'none', overboard: [], thirst: empty },
        'nv-S3': { id: 'nv-S3', seagull: 'none', overboard: [], thirst: empty },
      },
      navDeck: ['nv-S1', 'nv-S2', 'nv-S3', ...state.navDeck],
    }
    const flare = { kind: 'flare', singleUse: true, isWeapon: true, isValuable: false } as const
    const { state: s1, supplyId } = giveCardToPlayer(state, player.id, flare)
    const r = reduce(s1, { kind: 'USE_FLARE', playerId: player.id, supplyId })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.phase.kind).toBe('scoring')
    expect(r.state.seagullTokens).toBe(4)
  })
})

// ---------- SHKET_STEAL ----------

describe('SHKET_STEAL', () => {
  function shketReadyState(seed: number): { state: GameState; shketId: string; victimSeat: number } {
    let state = makeReadyState(seed)
    // Найти игрока с character=shket; если такого нет — переписать у первого.
    let shket = Object.values(state.players).find((p) => p.character === 'shket')
    if (!shket) {
      const first = Object.values(state.players)[0]!
      const oldChar = first.character
      // Поменяем character первого на shket и пересортируем seats; также обновим друзей.
      shket = { ...first, character: 'shket' as CharacterId }
      const players = { ...state.players, [first.id]: shket }
      state = { ...state, players }
      void oldChar
    }
    // Найти жертву на текущем seat'е (любую отличную от шкета, conscious, с закрытыми)
    const { seat } = currentDaySeat(state)
    // Сдвинуть текущий ход на шкета: проще пересоздать turnOrder так, чтобы первым был шкет.
    const shketSeat = state.seats.find((s) => s.occupantId === shket!.id)!.index
    state = {
      ...state,
      phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: shketSeat } },
      currentTurnIndex: state.turnOrder.indexOf(shketSeat),
    }
    const victim = Object.values(state.players).find(
      (p) => p.id !== shket!.id && p.closedSupplies.length > 0,
    )!
    const victimSeat = state.seats.find((s) => s.occupantId === victim.id)!.index
    return { state, shketId: shket!.id, victimSeat }
    void seat
  }

  it('ворует случайную закрытую карту: жертва -1, шкет +1', () => {
    const { state, shketId, victimSeat } = shketReadyState(51)
    const victimId = state.seats[victimSeat]!.occupantId!
    const victimClosedBefore = state.players[victimId]!.closedSupplies.length
    const shketClosedBefore = state.players[shketId]!.closedSupplies.length
    const r = reduce(state, { kind: 'SHKET_STEAL', playerId: shketId, targetSeat: victimSeat })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[victimId]!.closedSupplies.length).toBe(victimClosedBefore - 1)
    expect(r.state.players[shketId]!.closedSupplies.length).toBe(shketClosedBefore + 1)
    expect(r.state.players[shketId]!.hasUsedShketSteal).toBe(true)
  })

  it('не может воровать дважды за ход', () => {
    const { state, shketId, victimSeat } = shketReadyState(52)
    const r1 = reduce(state, { kind: 'SHKET_STEAL', playerId: shketId, targetSeat: victimSeat })
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    // Шкет уже advance'нулся, попытаемся снова с того же state'а (имитируем повтор):
    // искусственно вернём ход шкету.
    const shketSeat = r1.state.seats.find((s) => s.occupantId === shketId)!.index
    const cheat: GameState = {
      ...r1.state,
      phase: { kind: 'day', subPhase: { kind: 'waitingForAction', currentSeat: shketSeat } },
    }
    const r2 = reduce(cheat, { kind: 'SHKET_STEAL', playerId: shketId, targetSeat: victimSeat })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('ALREADY_USED_ABILITY')
  })

  it('не-шкет не может использовать → BUSINESS_RULE_VIOLATION', () => {
    const state = makeReadyState(53)
    const { player, seat } = currentDaySeat(state)
    if (player.character === 'shket') return // пропускаем — повезло, игрок шкет
    const victim = state.seats.find((s) => !s.removed && s.occupantId && s.index !== seat)!
    const r = reduce(state, {
      kind: 'SHKET_STEAL',
      playerId: player.id,
      targetSeat: victim.index,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('BUSINESS_RULE_VIOLATION')
  })
})

// ---------- Реактивные ----------

describe('reactive: REVEAL/DISCARD/GIVE_SUPPLY', () => {
  it('REVEAL_SUPPLY: переносит карту из closed в open', () => {
    const state = makeReadyState(61)
    const { player } = currentDaySeat(state)
    const sid = player.closedSupplies[0]!
    const r = reduce(state, { kind: 'REVEAL_SUPPLY', playerId: player.id, supplyId: sid })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[player.id]!.openSupplies).toContain(sid)
    expect(r.state.players[player.id]!.closedSupplies).not.toContain(sid)
  })

  it('REVEAL_SUPPLY на уже открытой → CARD_ALREADY_OPEN', () => {
    let state = makeReadyState(62)
    const { player } = currentDaySeat(state)
    const sid = player.closedSupplies[0]!
    state = {
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          openSupplies: [...player.openSupplies, sid],
          closedSupplies: player.closedSupplies.filter((id) => id !== sid),
        },
      },
    }
    const r = reduce(state, { kind: 'REVEAL_SUPPLY', playerId: player.id, supplyId: sid })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CARD_ALREADY_OPEN')
  })

  it('DISCARD_SUPPLY: удаляет из руки и кладёт в discard', () => {
    const state = makeReadyState(63)
    const { player } = currentDaySeat(state)
    const sid = player.closedSupplies[0]!
    const r = reduce(state, { kind: 'DISCARD_SUPPLY', playerId: player.id, supplyId: sid })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[player.id]!.closedSupplies).not.toContain(sid)
    expect(r.state.supplyDiscard).toContain(sid)
  })

  it('GIVE_SUPPLY: closed→closed (faceUp=false) у другого игрока', () => {
    const state = makeReadyState(64)
    const { player } = currentDaySeat(state)
    const target = Object.values(state.players).find((p) => p.id !== player.id)!
    const sid = player.closedSupplies[0]!
    const r = reduce(state, {
      kind: 'GIVE_SUPPLY',
      playerId: player.id,
      targetCharacter: target.character,
      supplyId: sid,
      faceUp: false,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[target.id]!.closedSupplies).toContain(sid)
    expect(r.state.players[player.id]!.closedSupplies).not.toContain(sid)
  })

  it('GIVE_SUPPLY: closed→open (faceUp=true)', () => {
    const state = makeReadyState(65)
    const { player } = currentDaySeat(state)
    const target = Object.values(state.players).find((p) => p.id !== player.id)!
    const sid = player.closedSupplies[0]!
    const r = reduce(state, {
      kind: 'GIVE_SUPPLY',
      playerId: player.id,
      targetCharacter: target.character,
      supplyId: sid,
      faceUp: true,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[target.id]!.openSupplies).toContain(sid)
  })

  it('GIVE_SUPPLY самому себе → INVALID_TARGET', () => {
    const state = makeReadyState(66)
    const { player } = currentDaySeat(state)
    const sid = player.closedSupplies[0]!
    const r = reduce(state, {
      kind: 'GIVE_SUPPLY',
      playerId: player.id,
      targetCharacter: player.character,
      supplyId: sid,
      faceUp: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('INVALID_TARGET')
  })
})

// ---------- День → вечер ----------

describe('SKIP_TURN и переход в evening', () => {
  it('после 4 SKIP_TURN фаза = evening.sternPicking', () => {
    let state = makeReadyState(71)
    for (let i = 0; i < 4; i++) {
      const { player } = currentDaySeat(state)
      const r = reduce(state, { kind: 'SKIP_TURN', playerId: player.id })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      state = r.state
    }
    expect(state.phase.kind).toBe('evening')
    if (state.phase.kind === 'evening') {
      expect(state.phase.subPhase.kind).toBe('sternPicking')
    }
  })

  it('picker — ближайший к корме (макс seatIndex)', () => {
    let state = makeReadyState(72)
    for (let i = 0; i < 4; i++) {
      const { player } = currentDaySeat(state)
      const r = reduce(state, { kind: 'SKIP_TURN', playerId: player.id })
      if (!r.ok) throw new Error(r.error.message)
      state = r.state
    }
    if (state.phase.kind !== 'evening' || state.phase.subPhase.kind !== 'sternPicking') {
      throw new Error('expected sternPicking')
    }
    const pickerId = state.phase.subPhase.pickerId
    const pickerSeat = state.seats.find((s) => s.occupantId === pickerId)!.index
    // Среди conscious это макс seatIndex.
    const maxConsciousSeat = state.seats
      .filter((s) => !s.removed && s.occupantId)
      .filter((s) => state.players[s.occupantId!]!.consciousness === 'conscious')
      .map((s) => s.index)
      .reduce((a, b) => Math.max(a, b))
    expect(pickerSeat).toBe(maxConsciousSeat)
  })
})

// ---------- Полный «день N» с ROW (acceptance Phase 3) ----------

describe('full-day integration', () => {
  it('4 игрока: ROW → keep 1 → следующий... всё проходит, переход в evening, navPool=4', () => {
    let state = makeReadyState(81)
    for (let i = 0; i < 4; i++) {
      const { player } = currentDaySeat(state)
      const r1 = reduce(state, { kind: 'ROW', playerId: player.id })
      if (!r1.ok) throw new Error(`ROW ${i}: ${r1.error.message}`)
      const phase = r1.state.phase
      if (phase.kind !== 'day' || phase.subPhase.kind !== 'rowing') {
        throw new Error('expected rowing')
      }
      const drawn = phase.subPhase.drawn
      const r2 = reduce(r1.state, {
        kind: 'ROW_KEEP_CARDS',
        playerId: player.id,
        cardIds: [drawn[0]!],
      })
      if (!r2.ok) throw new Error(`KEEP ${i}: ${r2.error.message}`)
      state = r2.state
    }
    expect(state.phase.kind).toBe('evening')
    expect(state.navPool.length).toBe(4)
    assertInvariants(state)
  })
})

// reset between tests
beforeEach(() => {
  // noop — every test makes its own state
})
