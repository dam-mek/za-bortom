import { describe, expect, it } from 'vitest'
import {
  CHARACTERS,
  NAVIGATION_DECK_SIZE,
  SUPPLY_DECK_SIZE,
  SUPPLY_TYPES,
} from '@/game/constants'

describe('Phase 0 smoke', () => {
  it('имеет 6 уникальных персонажей', () => {
    expect(CHARACTERS).toHaveLength(6)
    const ids = new Set(CHARACTERS.map((c) => c.id))
    expect(ids.size).toBe(6)
  })

  it('размеры колод соответствуют правилам', () => {
    expect(SUPPLY_DECK_SIZE).toBe(42)
    expect(NAVIGATION_DECK_SIZE).toBe(24)
  })

  it('покрывает все 14 типов припасов', () => {
    expect(SUPPLY_TYPES.length).toBe(14)
  })
})
