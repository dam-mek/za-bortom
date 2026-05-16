import { useGameStore } from '@/store/game-store'

export function WaitingRoom() {
  const mode = useGameStore((s) => s.mode)
  const lobby = useGameStore((s) => s.lobby)
  const roomCode = useGameStore((s) => s.roomCode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const hostStartGame = useGameStore((s) => s.hostStartGame)
  const setReady = useGameStore((s) => s.setReady)
  const reset = useGameStore((s) => s.reset)
  const lastError = useGameStore((s) => s.lastError)

  if (!lobby) {
    return (
      <main className="min-h-screen flex items-center justify-center font-mono text-white">
        Загрузка лобби…
        <button onClick={reset} className="ml-4 text-sea-300 hover:underline">отмена</button>
      </main>
    )
  }

  const me = lobby.players.find((p) => p.id === myPlayerId)
  const isReady = me?.ready ?? false

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-white p-6">
      <div className="space-y-6 max-w-md w-full">
        <div className="text-center">
          <h2 className="text-3xl mb-2">Лобби</h2>
          {roomCode && (
            <div className="text-sea-300">
              Код комнаты:{' '}
              <span className="font-mono text-yellow-300 select-all">{roomCode}</span>
            </div>
          )}
        </div>

        <div className="bg-sea-800 p-4 rounded space-y-2">
          {lobby.players.map((p) => (
            <div
              key={p.id}
              className={`flex justify-between items-center p-2 rounded ${
                p.id === myPlayerId ? 'bg-sea-700' : ''
              }`}
            >
              <span>
                {p.displayName} {p.id === lobby.hostId && '👑'}{' '}
                {p.id === myPlayerId && <span className="text-sea-300">(вы)</span>}
              </span>
              <span className="text-sm">
                {p.disconnected ? (
                  <span className="text-red-300">⚠ оффлайн</span>
                ) : p.ready ? (
                  <span className="text-green-300">✓ готов</span>
                ) : (
                  <span className="text-sea-300">— ждёт —</span>
                )}
              </span>
            </div>
          ))}
          {lobby.players.length < 4 && (
            <div className="text-sea-300 text-sm pt-2">
              Нужно ещё {4 - lobby.players.length} игрок(а/ов).
            </div>
          )}
        </div>

        {mode === 'client' && (
          <button
            onClick={() => setReady(!isReady)}
            className={`w-full px-6 py-3 rounded font-semibold ${
              isReady ? 'bg-green-700 hover:bg-green-600' : 'bg-sea-500 hover:bg-sea-300'
            }`}
          >
            {isReady ? '✓ Готов — нажмите чтобы отменить' : 'Я готов'}
          </button>
        )}

        {mode === 'host' && (
          <button
            onClick={() => hostStartGame()}
            disabled={!lobby.canStart}
            className="w-full bg-sea-500 hover:bg-sea-300 px-6 py-3 rounded font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {lobby.canStart ? '🚀 Начать игру' : 'Ждём всех (готовых ≥4)'}
          </button>
        )}

        {lastError && (
          <div className="text-red-300 text-sm">⚠ {lastError.code}: {lastError.message}</div>
        )}

        <button onClick={reset} className="w-full text-sea-300 hover:underline text-sm">
          ← покинуть
        </button>
      </div>
    </main>
  )
}
