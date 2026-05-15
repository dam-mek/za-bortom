import { useGameStore } from '@/store/game-store'

export function LogPane() {
  const events = useGameStore((s) => s.events)
  return (
    <section className="bg-sea-800/50 rounded p-3 h-full max-h-[80vh] overflow-y-auto">
      <h2 className="font-semibold mb-2 text-sea-300">Лог событий ({events.length})</h2>
      <ul className="space-y-1 text-xs font-mono">
        {events
          .slice(-100)
          .reverse()
          .map((e, i) => (
            <li key={events.length - i} className="text-sea-300">
              <span className="text-yellow-300">{e.kind}</span>:{' '}
              <span className="text-white/70">{JSON.stringify(e.payload)}</span>
            </li>
          ))}
        {events.length === 0 && <li className="text-sea-300">— пусто —</li>}
      </ul>
    </section>
  )
}
