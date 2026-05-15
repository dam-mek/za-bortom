import { useGameStore } from '@/store/game-store'
import { Game } from '@/ui/Game'
import { Lobby } from '@/ui/Lobby'

export default function App() {
  const hasGame = useGameStore((s) => s.state !== null)
  return hasGame ? <Game /> : <Lobby />
}
