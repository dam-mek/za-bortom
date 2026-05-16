// Тесты visibility-фильтра. См. docs/visibility-model.md.

import { describe, expect, it } from 'vitest'
import { filterStateForPlayer } from '@/game/visibility'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import { reduce } from '@/game/reducer'
import type { GameState } from '@/game/types'

function makePlayers(n: number): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i + 1}`,
    displayName: `P${i + 1}`,
    isBot: false,
  }))
}

function startGame(): GameState {
  const players = makePlayers(4)
  let s = createInitialState({ gameId: 'g', hostId: players[0]!.id, seed: 42, players })
  const r = reduce(s, { kind: 'START_GAME', playerId: players[0]!.id })
  if (!r.ok) throw new Error(r.error.message)
  s = r.state
  return s
}

describe('filterStateForPlayer — приватность', () => {
  it('rng не отправляется клиенту', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    // FilteredGameState не имеет поля rng по типу — проверяем что физически нет.
    expect((view as unknown as Record<string, unknown>).rng).toBeUndefined()
  })

  it('viewerId выставлен', () => {
    const state = startGame()
    expect(filterStateForPlayer(state, 'p-1').viewerId).toBe('p-1')
  })

  it('bestFriend/worstEnemy: свои видны, чужие скрыты', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    expect(view.players['p-1']!.bestFriend).toBe(state.players['p-1']!.bestFriend)
    expect(view.players['p-1']!.worstEnemy).toBe(state.players['p-1']!.worstEnemy)
    expect(view.players['p-2']!.bestFriend).toBeNull()
    expect(view.players['p-2']!.worstEnemy).toBeNull()
  })

  it('после phase=finished все friend/enemy раскрыты', () => {
    const state: GameState = { ...startGame(), phase: { kind: 'finished' } }
    const view = filterStateForPlayer(state, 'p-1')
    for (const p of Object.values(view.players)) {
      expect(p.bestFriend).not.toBeNull()
      expect(p.worstEnemy).not.toBeNull()
    }
  })

  it('closedSupplies: свои id видны, чужие — фейковые', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    // Свои closed имеют те же id и есть в supplyById
    for (const id of view.players['p-1']!.closedSupplies) {
      expect(view.supplyById[id]).toBeDefined()
    }
    // Чужие closed — placeholder id, нет в supplyById
    for (const id of view.players['p-2']!.closedSupplies) {
      expect(id.startsWith('hidden-')).toBe(true)
      expect(view.supplyById[id]).toBeUndefined()
    }
  })

  it('supplyDeck/navDeck: содержат placeholder id той же длины', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    expect(view.supplyDeck.length).toBe(state.supplyDeck.length)
    expect(view.navDeck.length).toBe(state.navDeck.length)
    for (const id of view.supplyDeck) {
      expect(view.supplyById[id]).toBeUndefined()
    }
    for (const id of view.navDeck) {
      expect(view.navById[id]).toBeUndefined()
    }
  })

  it('supplyById содержит только видимые карты', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    // Видимое для p-1: open всех + свои closed + supplyDiscard + (morning.pile если p-1 — получатель)
    let expectedCount =
      Object.values(state.players).reduce((a, p) => a + p.openSupplies.length, 0) +
      state.players['p-1']!.closedSupplies.length +
      state.supplyDiscard.length
    if (state.phase.kind === 'morning' && state.phase.subPhase.kind === 'distributing') {
      const currentOccupant = state.seats[state.phase.subPhase.currentSeat]?.occupantId
      if (currentOccupant === 'p-1') {
        expectedCount += state.phase.subPhase.pile.length
      }
    }
    expect(Object.keys(view.supplyById).length).toBe(expectedCount)
  })

  it('JSON-сериализация не содержит чужих closedSupplies id', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    const json = JSON.stringify(view)
    // ID чужих closed-карт не должны встречаться в JSON-views.
    for (const otherId of ['p-2', 'p-3', 'p-4']) {
      for (const sid of state.players[otherId]!.closedSupplies) {
        expect(json).not.toContain(sid)
      }
    }
  })

  it('JSON-сериализация не содержит чужих bestFriend/worstEnemy', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    const json = JSON.stringify(view)
    // P-1 знает свои → они в JSON. P-2..P-4 → не должны быть.
    // Проверяем по полю: для каждого других friend/enemy указаны как null.
    expect(json).not.toMatch(/"p-2"[^}]*"bestFriend":"(?!null)/)
  })
})

describe('filterStateForPlayer — приватные pile/pool/drawn', () => {
  it('morning.pile: видна только текущему получателю', () => {
    const state = startGame()
    if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') {
      throw new Error('expected morning.distributing')
    }
    const currentSeat = state.phase.subPhase.currentSeat
    const currentOccupant = state.seats[currentSeat]!.occupantId!
    const otherPlayerId = Object.keys(state.players).find((id) => id !== currentOccupant)!

    const viewCurrent = filterStateForPlayer(state, currentOccupant)
    const viewOther = filterStateForPlayer(state, otherPlayerId)

    if (viewCurrent.phase.kind === 'morning' && viewCurrent.phase.subPhase.kind === 'distributing') {
      // Текущий видит реальные id из supplyById
      for (const id of viewCurrent.phase.subPhase.pile) {
        expect(viewCurrent.supplyById[id]).toBeDefined()
      }
    }
    if (viewOther.phase.kind === 'morning' && viewOther.phase.subPhase.kind === 'distributing') {
      // Другой видит placeholders
      for (const id of viewOther.phase.subPhase.pile) {
        expect(id.startsWith('hidden-')).toBe(true)
      }
    }
  })

  it('day.rowing.drawn: видна только гребцу', () => {
    // Прокатимся через morning до day, вызовем ROW
    let state = startGame()
    // Закончим morning
    while (state.phase.kind === 'morning' && state.phase.subPhase.kind === 'distributing') {
      const sub = state.phase.subPhase
      const occ = state.seats[sub.currentSeat]!.occupantId!
      const r = reduce(state, { kind: 'CHOOSE_SUPPLY', playerId: occ, supplyId: sub.pile[0]! })
      if (!r.ok) throw new Error(r.error.message)
      state = r.state
    }
    if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'waitingForAction') {
      throw new Error('expected day.waitingForAction')
    }
    const rower = state.seats[state.phase.subPhase.currentSeat]!.occupantId!
    const r = reduce(state, { kind: 'ROW', playerId: rower })
    if (!r.ok) throw new Error(r.error.message)
    state = r.state

    const viewRower = filterStateForPlayer(state, rower)
    const otherId = Object.keys(state.players).find((id) => id !== rower)!
    const viewOther = filterStateForPlayer(state, otherId)

    if (viewRower.phase.kind === 'day' && viewRower.phase.subPhase.kind === 'rowing') {
      for (const id of viewRower.phase.subPhase.drawn) {
        expect(viewRower.navById[id]).toBeDefined()
      }
    }
    if (viewOther.phase.kind === 'day' && viewOther.phase.subPhase.kind === 'rowing') {
      for (const id of viewOther.phase.subPhase.drawn) {
        expect(id.startsWith('hidden-')).toBe(true)
      }
    }
  })
})

describe('filterStateForPlayer — структурная целостность', () => {
  it('publicly видимые поля скопированы (seats, day, seagullTokens)', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    expect(view.day).toBe(state.day)
    expect(view.seats).toEqual(state.seats)
    expect(view.seagullTokens).toBe(state.seagullTokens)
    expect(view.removedCharacters).toEqual(state.removedCharacters)
  })

  it('openSupplies всех игроков видны', () => {
    const state = startGame()
    const view = filterStateForPlayer(state, 'p-1')
    for (const [id, p] of Object.entries(state.players)) {
      expect(view.players[id]!.openSupplies).toEqual(p.openSupplies)
    }
  })
})
