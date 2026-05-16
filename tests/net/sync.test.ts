// Integration-тест P2P: host + 3 клиента через in-memory транспорт.
// Проверяем lobby flow, game-start, синхронизацию state, фильтрацию visibility.

import { describe, expect, it } from 'vitest'
import { createInMemoryNetwork } from '@/net/in-memory-transport'
import { createHost } from '@/net/host'
import { createClient } from '@/net/client'
import type { FilteredGameState } from '@/game/types'
import type { LobbyState } from '@/net/protocol'

/** Подождать тика, чтобы microtasks разрулились. */
async function flush(n = 5) {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

describe('P2P sync (in-memory transport)', () => {
  it('host + 3 клиента: lobby → start → синхронизация state', async () => {
    const net = createInMemoryNetwork('host-1')

    // 1. Host
    const host = createHost({ transport: net.host, hostName: 'Hosty', seed: 42 })
    const { hostId, hostPlayerId } = await host.start()
    expect(hostId).toBe('host-1')
    expect(hostPlayerId).toBe('p-1')

    // 2. Три клиента
    const clientStates: Record<string, FilteredGameState | null> = {}
    const clientLobbies: Record<string, LobbyState | null> = {}
    const clients = []
    for (let i = 0; i < 3; i++) {
      const cid = `client-${i + 2}`
      const transport = net.newClient(cid)
      const cli = createClient({
        transport,
        hostId: 'host-1',
        playerName: `Player${i + 2}`,
        clientToken: `tok-${cid}`,
      })
      cli.onState((view) => (clientStates[cid] = view))
      cli.onLobby((l) => (clientLobbies[cid] = l))
      const r = await cli.start()
      if ('error' in r) throw new Error(`client ${cid}: ${r.error}`)
      expect(r.playerId).toBe(`p-${i + 2}`)
      clients.push({ cid, cli, playerId: r.playerId })
    }
    await flush()

    // 3. Все клиенты помечают ready
    for (const c of clients) c.cli.setReady(true)
    await flush()

    // 4. Лобби должно показывать 4 игроков, canStart=true
    const lobbyAfter = host.getLobby()
    expect(lobbyAfter.players).toHaveLength(4)
    expect(lobbyAfter.canStart).toBe(true)

    // 5. Host стартует игру
    const startResult = host.startGame()
    if (typeof startResult === 'object' && 'kind' in startResult && startResult.kind === 'GameError') {
      throw new Error(`startGame failed: ${startResult.message}`)
    }
    await flush()

    // 6. Все клиенты получили state
    for (const c of clients) {
      expect(clientStates[c.cid]).not.toBeNull()
      expect(clientStates[c.cid]!.viewerId).toBe(c.playerId)
    }

    // 7. Visibility-фильтр работает: каждый клиент видит свои closed, не видит чужих
    for (const c of clients) {
      const view = clientStates[c.cid]!
      // Свои bestFriend известен
      expect(view.players[c.playerId]!.bestFriend).not.toBeNull()
      // Чужие bestFriend — null
      for (const otherId of Object.keys(view.players)) {
        if (otherId !== c.playerId) {
          expect(view.players[otherId]!.bestFriend).toBeNull()
        }
      }
    }

    host.close()
    for (const c of clients) c.cli.close()
  })

  it('action: клиент шлёт CHOOSE_SUPPLY, host применяет, все получают state-update', async () => {
    const net = createInMemoryNetwork('h')
    const host = createHost({ transport: net.host, hostName: 'H', seed: 7 })
    await host.start()
    const clients = []
    for (let i = 0; i < 3; i++) {
      const cid = `c${i + 2}`
      const cli = createClient({
        transport: net.newClient(cid),
        hostId: 'h',
        playerName: `P${i + 2}`,
        clientToken: `tok-${cid}`,
      })
      const r = await cli.start()
      if ('error' in r) throw new Error(r.error)
      clients.push({ cid, cli, playerId: r.playerId })
    }
    await flush()
    for (const c of clients) c.cli.setReady(true)
    await flush()
    host.startGame()
    await flush()

    // Текущий получатель в morning — банка [currentSeat].
    const state = host.getState()!
    if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') {
      throw new Error('expected morning')
    }
    const currentSeat = state.phase.subPhase.currentSeat
    const currentPid = state.seats[currentSeat]!.occupantId!
    const currentClient = clients.find((c) => c.playerId === currentPid)
    if (!currentClient) {
      // Текущий ход у host'а — пропустим этот тест-кейс (зависит от seed).
      return
    }

    // Клиент шлёт CHOOSE_SUPPLY
    const supplyId = state.phase.subPhase.pile[0]!
    let updateReceived: FilteredGameState | null = null
    currentClient.cli.onState((view) => (updateReceived = view))
    const ackErr = await currentClient.cli.dispatch({
      kind: 'CHOOSE_SUPPLY',
      playerId: currentPid,
      supplyId,
    })
    expect(ackErr).toBeNull()
    await flush()

    const updated = host.getState()!
    // У текущего игрока стало +1 закрытой карты
    expect(updated.players[currentPid]!.closedSupplies.length).toBe(2)
    // Клиент получил state-update
    expect(updateReceived).not.toBeNull()
    expect((updateReceived as unknown as FilteredGameState).players[currentPid]!.closedSupplies.length).toBe(2)

    host.close()
    for (const c of clients) c.cli.close()
  })

  it('reject: невалидный action возвращается клиенту с GameError', async () => {
    const net = createInMemoryNetwork('hh')
    const host = createHost({ transport: net.host, hostName: 'H', seed: 8 })
    await host.start()
    const cli = createClient({
      transport: net.newClient('c'),
      hostId: 'hh',
      playerName: 'X',
      clientToken: 'tok',
    })
    const r = await cli.start()
    if ('error' in r) throw new Error(r.error)
    await flush()
    // Игра не запущена — любой action → GAME_NOT_STARTED
    const err = await cli.dispatch({ kind: 'ROW', playerId: r.playerId })
    expect(err).not.toBeNull()
    expect(err!.code).toBe('GAME_NOT_STARTED')

    host.close()
    cli.close()
  })
})
