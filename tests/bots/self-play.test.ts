// Acceptance Phase 9: 4 бота играют полную партию.
// Деадлоков и невалидных action'ов быть не должно.

import { describe, expect, it } from 'vitest'
import { SimpleBot } from '@/bots/simple-bot'
import { createInMemoryNetwork } from '@/net/in-memory-transport'
import { createHost } from '@/net/host'

async function flushMicrotasks(n = 200) {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

describe('bots: self-play', () => {
  it('4 бота: партия завершается в финале (<50 дней)', async () => {
    const net = createInMemoryNetwork('h')
    const host = createHost({ transport: net.host, hostName: 'BotHost', seed: 12345 })
    const { hostPlayerId } = await host.start()
    // Привязываем host'у тоже бота.
    host.attachBot(hostPlayerId, new SimpleBot(hostPlayerId))
    // Добавляем 3 других бота.
    for (let i = 0; i < 3; i++) {
      host.addBot(`Bot${i + 2}`, (pid) => new SimpleBot(pid))
    }
    // Старт игры.
    const r = host.startGame()
    if (typeof r === 'object' && 'kind' in r && r.kind === 'GameError') {
      throw new Error(`startGame: ${r.message}`)
    }
    await flushMicrotasks()

    // Проверим финал. driveBots должен был сам всё прогнать.
    const final = host.getState()!
    expect(['scoring', 'finished']).toContain(final.phase.kind)

    if (final.phase.kind === 'scoring') {
      host.dispatch({ kind: 'PHASE_ADVANCE' })
    }
    const truly = host.getState()!
    expect(truly.phase.kind).toBe('finished')
    expect(truly.day).toBeLessThan(50)

    host.close()
  })

  it('детерминизм: одинаковый seed → одинаковый результат', async () => {
    async function play(seed: number) {
      const net = createInMemoryNetwork(`h-${seed}`)
      const host = createHost({ transport: net.host, hostName: 'BH', seed })
      const { hostPlayerId } = await host.start()
      host.attachBot(hostPlayerId, new SimpleBot(hostPlayerId))
      for (let i = 0; i < 3; i++) {
        host.addBot(`B${i}`, (pid) => new SimpleBot(pid))
      }
      host.startGame()
      await flushMicrotasks()
      let state = host.getState()!
      if (state.phase.kind === 'scoring') {
        host.dispatch({ kind: 'PHASE_ADVANCE' })
        state = host.getState()!
      }
      host.close()
      return { day: state.day, winner: state.winner }
    }
    const a = await play(777)
    const b = await play(777)
    expect(b.day).toBe(a.day)
    expect(b.winner).toBe(a.winner)
  })

  it('5 разных seed-ов: ни одна партия не зависает (<50 дней)', async () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const net = createInMemoryNetwork(`h-${seed}`)
      const host = createHost({ transport: net.host, hostName: 'BH', seed })
      const { hostPlayerId } = await host.start()
      host.attachBot(hostPlayerId, new SimpleBot(hostPlayerId))
      for (let i = 0; i < 3; i++) {
        host.addBot(`B${i}`, (pid) => new SimpleBot(pid))
      }
      host.startGame()
      await flushMicrotasks()
      const state = host.getState()!
      expect(['scoring', 'finished']).toContain(state.phase.kind)
      expect(state.day).toBeLessThan(50)
      host.close()
    }
  })
})
