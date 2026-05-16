import { useGameStore } from '@/store/game-store'
import { Game } from '@/ui/Game'
import { Lobby } from '@/ui/Lobby'
import { WaitingRoom } from '@/ui/WaitingRoom'

export default function App() {
  const mode = useGameStore((s) => s.mode)
  const state = useGameStore((s) => s.state)
  const lobby = useGameStore((s) => s.lobby)

  // Сетевой режим без активной игры → лобби ожидания
  if ((mode === 'host' || mode === 'client') && !state && lobby) {
    return <WaitingRoom />
  }
  // Сетевой режим с игрой ИЛИ локальный режим с игрой
  if (state) return <Game />
  // По умолчанию — лобби выбора режима
  return <Lobby />
}
