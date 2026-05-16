// Bot interface. См. docs/bots.md.

import type { Action } from '@/game/actions'
import type { FilteredGameState, PlayerId } from '@/game/types'

export interface Bot {
  readonly playerId: PlayerId
  /**
   * Получает отфильтрованный state и возвращает Action, если боту сейчас нужно
   * действовать. null = ничего делать не нужно (не его очередь).
   */
  decide(view: FilteredGameState): Action | null
}
