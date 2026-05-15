import { useState } from 'react'
import { useGameStore } from '@/store/game-store'
import type { PlayerSpec } from '@/game/state'

export function Lobby() {
  const [numPlayers, setNumPlayers] = useState(4)
  const [seed, setSeed] = useState(42)
  const startGame = useGameStore((s) => s.startGame)

  function start() {
    const players: PlayerSpec[] = Array.from({ length: numPlayers }, (_, i) => ({
      id: `p-${i + 1}`,
      displayName: `Игрок ${i + 1}`,
      isBot: false,
    }))
    startGame(players, seed)
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 text-center max-w-md">
        <h1 className="text-5xl font-semibold tracking-tight">За бортом</h1>
        <p className="text-sea-300">
          Локальная игра (hot-seat) — все игроки за одним экраном, без скрытой информации.
          Для проверки игровой логики.
        </p>
        <div className="space-y-4 bg-sea-800 p-6 rounded text-left">
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Игроков:</span>
            <select
              value={numPlayers}
              onChange={(e) => setNumPlayers(Number(e.target.value))}
              className="bg-sea-700 rounded px-3 py-1"
            >
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="bg-sea-700 rounded px-3 py-1 w-32"
            />
          </label>
          <button
            onClick={start}
            className="w-full bg-sea-500 hover:bg-sea-300 transition px-6 py-3 rounded text-white font-semibold"
          >
            Начать игру
          </button>
        </div>
      </div>
    </main>
  )
}
