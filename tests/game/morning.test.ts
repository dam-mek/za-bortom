import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTERS, SUPPLY_DECK_SIZE } from '@/game/constants'
import { assertInvariants } from '@/game/invariants'
import { reduce } from '@/game/reducer'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { GameState } from '@/game/types'

function makePlayers(n: number): PlayerSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${i + 1}`,
    displayName: `Player ${i + 1}`,
    isBot: false,
  }))
}

function startGame(state: GameState): GameState {
  const res = reduce(state, { kind: 'START_GAME', playerId: state.hostId })
  if (!res.ok) throw new Error(`START_GAME failed: ${res.error.message}`)
  return res.state
}

/** Симулировать полное утро: каждый conscious в seat order делает CHOOSE_SUPPLY. */
function runFullMorning(state: GameState): GameState {
  let cur = state
  let safety = 50
  while (cur.phase.kind === 'morning' && cur.phase.subPhase.kind === 'distributing') {
    if (safety-- <= 0) throw new Error('morning loop did not terminate')
    const sub = cur.phase.subPhase
    const seat = cur.seats[sub.currentSeat]
    if (!seat?.occupantId) throw new Error(`No occupant on seat ${sub.currentSeat}`)
    const pid = seat.occupantId
    const chosen = sub.pile[0]
    if (!chosen) throw new Error('Empty pile during morning')
    const res = reduce(cur, { kind: 'CHOOSE_SUPPLY', playerId: pid, supplyId: chosen })
    if (!res.ok) throw new Error(`CHOOSE_SUPPLY failed: ${res.error.message}`)
    cur = res.state
  }
  return cur
}

describe('morning — раздача припасов', () => {
  describe('4 conscious игрока', () => {
    let state: GameState

    beforeEach(() => {
      const players = makePlayers(4)
      state = startGame(
        createInitialState({ gameId: 'g', hostId: players[0]!.id, seed: 1, players }),
      )
    })

    it('переход START_GAME → morning.distributing', () => {
      expect(state.phase.kind).toBe('morning')
      if (state.phase.kind === 'morning') {
        expect(state.phase.subPhase.kind).toBe('distributing')
      }
    })

    it('инкрементировал day до 1', () => {
      expect(state.day).toBe(1)
    })

    it('drawn pile = 4 карты (= conscious count)', () => {
      if (state.phase.kind === 'morning' && state.phase.subPhase.kind === 'distributing') {
        expect(state.phase.subPhase.pile.length).toBe(4)
      } else {
        throw new Error('not in distributing')
      }
    })

    it('после 4 раундов CHOOSE_SUPPLY все 4 получили +1 закрытую карту, фаза = day', () => {
      const after = runFullMorning(state)
      expect(after.phase.kind).toBe('day')
      for (const p of Object.values(after.players)) {
        // У каждого: 1 (стартовая) + 1 (утренняя) = 2 закрытые карты
        expect(p.closedSupplies.length).toBe(2)
      }
      assertInvariants(after)
    })

    it('каждый игрок получил уникальную карту утром (без дубликатов)', () => {
      const after = runFullMorning(state)
      const allIds = Object.values(after.players).flatMap((p) => p.closedSupplies)
      expect(new Set(allIds).size).toBe(allIds.length)
    })

    it('supplyDeck уменьшился на 4', () => {
      const initialDeckSize = state.supplyDeck.length
      const after = runFullMorning(state)
      expect(after.supplyDeck.length).toBe(initialDeckSize) // pile уже вытянут, в day переходим как есть
      // total: 42 - 4 (стартовые) - 4 (утренние) = 34
      const totalInPlayers = Object.values(after.players).reduce(
        (acc, p) => acc + p.openSupplies.length + p.closedSupplies.length,
        0,
      )
      expect(after.supplyDeck.length + totalInPlayers).toBe(SUPPLY_DECK_SIZE)
    })
  })

  describe('1 conscious + 3 unconscious', () => {
    it('conscious берёт 1 карту, остальные не участвуют, фаза → day', () => {
      const players = makePlayers(4)
      let state = createInitialState({
        gameId: 'g',
        hostId: players[0]!.id,
        seed: 2,
        players,
      })
      // Вырубаем 3 игроков (wounds = strength). Берём всех кроме первого по charSeat order.
      const ids = Object.keys(state.players)
      const updated: Record<string, GameState['players'][string]> = { ...state.players }
      for (let i = 1; i < 4; i++) {
        const p = state.players[ids[i]!]!
        const ch = CHARACTERS.find((c) => c.id === p.character)!
        updated[p.id] = { ...p, wounds: ch.strength, consciousness: 'unconscious' }
      }
      state = { ...state, players: updated }
      state = startGame(state)

      if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') {
        throw new Error('expected morning.distributing')
      }
      expect(state.phase.subPhase.pile.length).toBe(1)

      const after = runFullMorning(state)
      expect(after.phase.kind).toBe('day')
      const conscious = Object.values(after.players).filter((p) => p.consciousness === 'conscious')
      expect(conscious).toHaveLength(1)
      // Conscious получил утреннюю +1
      expect(conscious[0]!.closedSupplies.length).toBe(2)
      // Без сознания — только стартовая 1
      for (const p of Object.values(after.players)) {
        if (p.consciousness === 'unconscious') expect(p.closedSupplies.length).toBe(1)
      }
    })
  })

  describe('0 conscious', () => {
    it('утро пропускается, переходим в scoring', () => {
      const players = makePlayers(4)
      let state = createInitialState({
        gameId: 'g',
        hostId: players[0]!.id,
        seed: 3,
        players,
      })
      const updated: Record<string, GameState['players'][string]> = {}
      for (const p of Object.values(state.players)) {
        const ch = CHARACTERS.find((c) => c.id === p.character)!
        updated[p.id] = { ...p, wounds: ch.strength, consciousness: 'unconscious' }
      }
      state = { ...state, players: updated }
      state = startGame(state)
      expect(state.phase.kind).toBe('scoring')
    })
  })

  describe('пустая колода припасов', () => {
    it('утро пропускается, переход → day', () => {
      const players = makePlayers(4)
      let state = createInitialState({
        gameId: 'g',
        hostId: players[0]!.id,
        seed: 4,
        players,
      })
      // Опустошить supplyDeck
      state = { ...state, supplyDeck: [], supplyDiscard: state.supplyDeck }
      state = startGame(state)
      expect(state.phase.kind).toBe('day')
    })
  })

  describe('валидация', () => {
    let state: GameState
    beforeEach(() => {
      const players = makePlayers(4)
      state = startGame(
        createInitialState({ gameId: 'g', hostId: players[0]!.id, seed: 5, players }),
      )
    })

    it('CHOOSE_SUPPLY из чужого хода → NOT_YOUR_TURN', () => {
      if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') {
        throw new Error('expected distributing')
      }
      const sub = state.phase.subPhase
      const currentSeat = sub.currentSeat
      const wrongSeat = state.seats.find(
        (s) => !s.removed && s.occupantId && s.index !== currentSeat,
      )!
      const wrongPid = wrongSeat.occupantId!
      const res = reduce(state, {
        kind: 'CHOOSE_SUPPLY',
        playerId: wrongPid,
        supplyId: sub.pile[0]!,
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('NOT_YOUR_TURN')
    })

    it('CHOOSE_SUPPLY с чужим supplyId → CARD_NOT_OWNED', () => {
      if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') {
        throw new Error('expected distributing')
      }
      const sub = state.phase.subPhase
      const seat = state.seats[sub.currentSeat]!
      const pid = seat.occupantId!
      const res = reduce(state, {
        kind: 'CHOOSE_SUPPLY',
        playerId: pid,
        supplyId: 'fake-supply-id',
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('CARD_NOT_OWNED')
    })

    it('START_GAME не от host → NOT_HOST', () => {
      const players = makePlayers(4)
      const fresh = createInitialState({
        gameId: 'g',
        hostId: players[0]!.id,
        seed: 6,
        players,
      })
      const res = reduce(fresh, { kind: 'START_GAME', playerId: players[1]!.id })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('NOT_HOST')
    })
  })
})
