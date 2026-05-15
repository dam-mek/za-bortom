import { describe, expect, it } from 'vitest'
import { createRng, nextFloat, nextInt, pick, shuffle } from '@/game/prng'

describe('prng (mulberry32)', () => {
  it('детерминирован при одинаковом seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const [fa] = nextFloat(a)
    const [fb] = nextFloat(b)
    expect(fa).toBe(fb)
  })

  it('разные seed → разные значения', () => {
    const [fa] = nextFloat(createRng(1))
    const [fb] = nextFloat(createRng(2))
    expect(fa).not.toBe(fb)
  })

  it('nextFloat в [0, 1)', () => {
    let rng = createRng(123)
    for (let i = 0; i < 100; i++) {
      const [f, next] = nextFloat(rng)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      rng = next
    }
  })

  it('nextInt в [0, max)', () => {
    let rng = createRng(7)
    for (let i = 0; i < 100; i++) {
      const [n, next] = nextInt(rng, 10)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(10)
      rng = next
    }
  })

  it('shuffle: длина и набор сохраняются', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const [shuffled] = shuffle(createRng(99), arr)
    expect(shuffled).toHaveLength(arr.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr)
  })

  it('shuffle: входной массив не мутируется', () => {
    const arr = [1, 2, 3, 4, 5]
    const orig = [...arr]
    shuffle(createRng(1), arr)
    expect(arr).toEqual(orig)
  })

  it('pick возвращает элемент массива', () => {
    const arr = ['a', 'b', 'c'] as const
    const [v] = pick(createRng(5), arr)
    expect(arr).toContain(v)
  })

  it('pick на пустом массиве бросает', () => {
    expect(() => pick(createRng(0), [])).toThrow()
  })
})
