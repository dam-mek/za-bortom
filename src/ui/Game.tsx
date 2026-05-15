import { useGameStore } from '@/store/game-store'
import { ActionPanel } from './ActionPanel'
import { BoatView } from './BoatView'
import { LogPane } from './LogPane'

function describePhase(state: ReturnType<typeof useGameStore.getState>['state']): string {
  if (!state) return ''
  const p = state.phase
  switch (p.kind) {
    case 'lobby':
      return 'лобби'
    case 'setup':
      return 'подготовка'
    case 'morning':
      return `утро (${p.subPhase.kind})`
    case 'day':
      return `день (${p.subPhase.kind})`
    case 'evening': {
      if (p.subPhase.kind === 'resolving') return `вечер (resolving / ${p.subPhase.step.kind})`
      return `вечер (${p.subPhase.kind})`
    }
    case 'scoring':
      return 'подсчёт'
    case 'finished':
      return 'окончена'
  }
}

export function Game() {
  const state = useGameStore((s) => s.state)
  const lastError = useGameStore((s) => s.lastError)
  const reset = useGameStore((s) => s.reset)
  if (!state) return null

  return (
    <main className="min-h-screen p-4 font-mono text-white grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <section className="space-y-4">
        <header className="flex justify-between items-baseline">
          <h1 className="text-2xl">
            <span className="text-sea-300">День {state.day} · </span>
            <span>{describePhase(state)}</span>
          </h1>
          <button onClick={reset} className="text-sea-300 hover:underline text-sm">
            ← к началу
          </button>
        </header>
        <BoatView state={state} />
        <ActionPanel state={state} />
        {lastError && (
          <div className="text-red-300 bg-red-900/30 border border-red-700 p-3 rounded text-sm">
            ⚠ <strong>{lastError.code}</strong>: {lastError.message}
          </div>
        )}
      </section>
      <aside>
        <LogPane />
      </aside>
    </main>
  )
}
