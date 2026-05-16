import { useState } from 'react'
import { useGameStore } from '@/store/game-store'
import type { PlayerSpec } from '@/game/state'

type Mode = 'menu' | 'local' | 'host' | 'client'

export function Lobby() {
  const [mode, setMode] = useState<Mode>('menu')
  if (mode === 'menu') return <Menu onPick={setMode} />
  if (mode === 'local') return <LocalSetup onBack={() => setMode('menu')} />
  if (mode === 'host') return <HostSetup onBack={() => setMode('menu')} />
  return <ClientSetup onBack={() => setMode('menu')} />
}

function Menu({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 text-center max-w-md">
        <h1 className="text-5xl font-semibold tracking-tight">За бортом</h1>
        <p className="text-sea-300">Выберите режим игры:</p>
        <div className="grid gap-3">
          <button
            onClick={() => onPick('local')}
            className="bg-sea-700 hover:bg-sea-500 transition px-6 py-3 rounded"
          >
            🪑 Hot-seat (за одним экраном)
          </button>
          <button
            onClick={() => onPick('host')}
            className="bg-sea-500 hover:bg-sea-300 transition px-6 py-3 rounded"
          >
            🏠 Создать комнату (P2P, host)
          </button>
          <button
            onClick={() => onPick('client')}
            className="bg-sea-700 hover:bg-sea-500 transition px-6 py-3 rounded"
          >
            🔗 Подключиться по коду
          </button>
        </div>
      </div>
    </main>
  )
}

function LocalSetup({ onBack }: { onBack: () => void }) {
  const [numPlayers, setNumPlayers] = useState(4)
  const [seed, setSeed] = useState(42)
  const startLocalGame = useGameStore((s) => s.startLocalGame)

  function start() {
    const players: PlayerSpec[] = Array.from({ length: numPlayers }, (_, i) => ({
      id: `p-${i + 1}`,
      displayName: `Игрок ${i + 1}`,
      isBot: false,
    }))
    startLocalGame(players, seed)
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 text-center max-w-md">
        <h2 className="text-3xl">Hot-seat</h2>
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
            className="w-full bg-sea-500 hover:bg-sea-300 transition px-6 py-3 rounded font-semibold"
          >
            Начать
          </button>
          <button onClick={onBack} className="w-full text-sea-300 hover:underline text-sm">
            ← назад
          </button>
        </div>
      </div>
    </main>
  )
}

function HostSetup({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('Хост')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createRoom = useGameStore((s) => s.createRoom)

  async function start() {
    setBusy(true)
    setError(null)
    const res = await createRoom(name, code || undefined)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 text-center max-w-md">
        <h2 className="text-3xl">Создать комнату</h2>
        <div className="space-y-4 bg-sea-800 p-6 rounded text-left">
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Имя:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-sea-700 rounded px-3 py-1 w-48"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Код комнаты:</span>
            <input
              placeholder="(auto)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-sea-700 rounded px-3 py-1 w-48 font-mono"
            />
          </label>
          <button
            onClick={start}
            disabled={busy || !name}
            className="w-full bg-sea-500 hover:bg-sea-300 transition px-6 py-3 rounded font-semibold disabled:opacity-50"
          >
            {busy ? 'Создаём…' : 'Создать'}
          </button>
          <button onClick={onBack} className="w-full text-sea-300 hover:underline text-sm">
            ← назад
          </button>
          {error && <div className="text-red-300 text-sm">⚠ {error}</div>}
        </div>
      </div>
    </main>
  )
}

function ClientSetup({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('Игрок')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const joinRoom = useGameStore((s) => s.joinRoom)

  async function start() {
    if (!code) return
    setBusy(true)
    setError(null)
    const res = await joinRoom(code, name)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 text-center max-w-md">
        <h2 className="text-3xl">Подключиться</h2>
        <div className="space-y-4 bg-sea-800 p-6 rounded text-left">
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Код комнаты:</span>
            <input
              placeholder="boat-xxxx"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-sea-700 rounded px-3 py-1 w-48 font-mono"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sea-300">Имя:</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-sea-700 rounded px-3 py-1 w-48"
            />
          </label>
          <button
            onClick={start}
            disabled={busy || !code || !name}
            className="w-full bg-sea-500 hover:bg-sea-300 transition px-6 py-3 rounded font-semibold disabled:opacity-50"
          >
            {busy ? 'Подключаемся…' : 'Подключиться'}
          </button>
          <button onClick={onBack} className="w-full text-sea-300 hover:underline text-sm">
            ← назад
          </button>
          {error && <div className="text-red-300 text-sm">⚠ {error}</div>}
        </div>
      </div>
    </main>
  )
}
