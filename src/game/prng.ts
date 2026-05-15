// Детерминированный PRNG. Mulberry32 — короткий 32-битный генератор.
// Функциональный API: rng — immutable, каждая операция возвращает новое RngState.
// См. docs/decisions.md #10, #11.

export interface RngState {
  /** Внутреннее состояние mulberry32 (32-битное беззнаковое). */
  readonly state: number
}

/** Создать rng из seed (любое число; будет приведено к u32). */
export function createRng(seed: number): RngState {
  return { state: seed >>> 0 }
}

/** Один шаг mulberry32. Возвращает float в [0, 1) и новое состояние. */
export function nextFloat(rng: RngState): [number, RngState] {
  let t = (rng.state + 0x6d2b79f5) >>> 0
  const nextState = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, { state: nextState }]
}

/** Случайное целое в [0, maxExclusive). */
export function nextInt(rng: RngState, maxExclusive: number): [number, RngState] {
  if (maxExclusive <= 0) throw new Error('nextInt: maxExclusive must be > 0')
  const [f, next] = nextFloat(rng)
  return [Math.floor(f * maxExclusive), next]
}

/** Fisher-Yates shuffle. Возвращает новый массив, исходный не мутируется. */
export function shuffle<T>(rng: RngState, arr: readonly T[]): [T[], RngState] {
  const out = arr.slice()
  let cur = rng
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(cur, i + 1)
    cur = next
    // swap
    const a = out[i] as T
    const b = out[j] as T
    out[i] = b
    out[j] = a
  }
  return [out, cur]
}

/** Случайный элемент массива. Бросает, если массив пуст. */
export function pick<T>(rng: RngState, arr: readonly T[]): [T, RngState] {
  if (arr.length === 0) throw new Error('pick: empty array')
  const [idx, next] = nextInt(rng, arr.length)
  // safe: idx ∈ [0, arr.length)
  return [arr[idx] as T, next]
}
