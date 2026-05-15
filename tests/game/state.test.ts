import { describe, expect, it } from 'vitest'
import { NAVIGATION_DECK_SIZE, SUPPLY_DECK_SIZE } from '@/game/constants'
import { assertInvariants, checkInvariants } from '@/game/invariants'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'

function makePlayers(n: number): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: false,
  }))
}

describe('createInitialState', () => {
  for (const n of [4, 5, 6] as const) {
    describe(`${n} players`, () => {
      const players = makePlayers(n)
      const state = createInitialState({
        gameId: `g-${n}`,
        hostId: players[0]!.id,
        seed: 42,
        players,
      })

      it('создаёт валидный state без нарушений инвариантов', () => {
        expect(checkInvariants(state)).toEqual([])
      })

      it(`removedCharacters имеет длину ${6 - n}`, () => {
        expect(state.removedCharacters.length).toBe(6 - n)
      })

      it('у каждого игрока ровно 1 закрытая карта припасов и 0 открытых', () => {
        for (const p of Object.values(state.players)) {
          expect(p.closedSupplies.length).toBe(1)
          expect(p.openSupplies.length).toBe(0)
        }
      })

      it(`в supplyDeck осталось ${SUPPLY_DECK_SIZE - n} карт`, () => {
        expect(state.supplyDeck.length).toBe(SUPPLY_DECK_SIZE - n)
      })

      it(`в navDeck ровно ${NAVIGATION_DECK_SIZE} карт`, () => {
        expect(state.navDeck.length).toBe(NAVIGATION_DECK_SIZE)
      })

      it(`занято ровно ${n} банок, ${6 - n} убрано`, () => {
        const occupied = state.seats.filter((s) => !s.removed && s.occupantId !== null)
        const removed = state.seats.filter((s) => s.removed)
        expect(occupied).toHaveLength(n)
        expect(removed).toHaveLength(6 - n)
      })

      it('у каждого игрока валидный character / friend / enemy из включённых персонажей', () => {
        const included = new Set(
          Object.values(state.players).map((p) => p.character),
        )
        for (const p of Object.values(state.players)) {
          expect(included.has(p.bestFriend)).toBe(true)
          expect(included.has(p.worstEnemy)).toBe(true)
        }
      })

      it('детерминизм: одинаковый seed → одинаковый state', () => {
        const a = createInitialState({
          gameId: `g-${n}-a`,
          hostId: players[0]!.id,
          seed: 12345,
          players,
        })
        const b = createInitialState({
          gameId: `g-${n}-a`,
          hostId: players[0]!.id,
          seed: 12345,
          players,
        })
        expect(b.players).toEqual(a.players)
        expect(b.supplyDeck).toEqual(a.supplyDeck)
        expect(b.navDeck).toEqual(a.navDeck)
      })
    })
  }

  it('бросает на 3 игроках и на 7 игроках', () => {
    expect(() =>
      createInitialState({ gameId: 'g', hostId: 'p-1', seed: 0, players: makePlayers(3) }),
    ).toThrow()
    expect(() =>
      createInitialState({ gameId: 'g', hostId: 'p-1', seed: 0, players: makePlayers(7) }),
    ).toThrow()
  })

  it('сумма карт state.supplyDeck + у игроков = 42 (инвариант 1)', () => {
    const state = createInitialState({
      gameId: 'g',
      hostId: 'p-1',
      seed: 7,
      players: makePlayers(5),
    })
    const byPlayers = Object.values(state.players).reduce(
      (acc, p) => acc + p.openSupplies.length + p.closedSupplies.length,
      0,
    )
    expect(state.supplyDeck.length + state.supplyDiscard.length + byPlayers).toBe(SUPPLY_DECK_SIZE)
  })

  it('assertInvariants не бросает на initial state', () => {
    const state = createInitialState({
      gameId: 'g',
      hostId: 'p-1',
      seed: 99,
      players: makePlayers(4),
    })
    expect(() => assertInvariants(state)).not.toThrow()
  })
})
