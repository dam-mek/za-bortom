import { useGameStore } from '@/store/game-store'

export function DisconnectModal() {
  const disconnected = useGameStore((s) => s.disconnected)
  const reset = useGameStore((s) => s.reset)
  if (!disconnected) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 font-mono">
      <div className="bg-sea-800 rounded p-6 max-w-md mx-4 space-y-4 text-white">
        <h2 className="text-2xl">🔌 Соединение потеряно</h2>
        <p className="text-sea-300">
          Хост отключился от игры. В текущей версии host migration не реализован — партия завершена.
          Возможные причины:
        </p>
        <ul className="text-sea-300 text-sm list-disc list-inside">
          <li>хост закрыл вкладку или выключил компьютер</li>
          <li>проблема с интернетом у хоста</li>
          <li>WebRTC-соединение разорвалось (NAT/firewall)</li>
        </ul>
        <button
          onClick={reset}
          className="w-full bg-sea-500 hover:bg-sea-300 px-6 py-3 rounded font-semibold"
        >
          ← В лобби
        </button>
      </div>
    </div>
  )
}
