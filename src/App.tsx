import { useGameStore } from '@/store/game-store'
import { DisconnectModal } from '@/ui/DisconnectModal'
import { Game } from '@/ui/Game'
import { Lobby } from '@/ui/Lobby'
import { WaitingRoom } from '@/ui/WaitingRoom'

export default function App() {
  const mode = useGameStore((s) => s.mode)
  const state = useGameStore((s) => s.state)
  const lobby = useGameStore((s) => s.lobby)

  const screen =
    (mode === 'host' || mode === 'client') && !state && lobby ? (
      <WaitingRoom />
    ) : state ? (
      <Game />
    ) : (
      <Lobby />
    )
  return (
    <>
      {screen}
      <DisconnectModal />
    </>
  )
}
