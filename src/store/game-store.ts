// Локальный hot-seat store. Хранит GameState, события, последнюю ошибку.
// Все 4-6 игроков играют за одним экраном — никакой фильтрации visibility.
// Сеть и host-authoritative модель появятся в Фазе 7.

import { create } from 'zustand'
import type { Action } from '@/game/actions'
import { reduce } from '@/game/reducer'
import type { PlayerSpec } from '@/game/state'
import { createInitialState } from '@/game/state'
import type { GameError, GameEvent, GameState } from '@/game/types'

interface GameStore {
  state: GameState | null
  events: GameEvent[]
  lastError: GameError | null

  startGame: (players: PlayerSpec[], seed: number) => void
  dispatch: (action: Action) => boolean
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  events: [],
  lastError: null,

  startGame: (players, seed) => {
    const initial = createInitialState({
      gameId: 'local',
      hostId: players[0]!.id,
      seed,
      players,
    })
    set({ state: initial, events: [], lastError: null })
    // Сразу запускаем игру (выход из setup → morning).
    const r = reduce(initial, { kind: 'START_GAME', playerId: players[0]!.id })
    if (r.ok) {
      set({ state: r.state, events: r.events, lastError: null })
    }
  },

  dispatch: (action) => {
    const { state, events } = get()
    if (!state) return false
    const result = reduce(state, action)
    if (result.ok) {
      set({
        state: result.state,
        events: [...events, ...result.events],
        lastError: null,
      })
      return true
    }
    set({ lastError: result.error })
    return false
  },

  reset: () => set({ state: null, events: [], lastError: null }),
}))
