import { useGameStore } from '@/store/game-store'
import type { GameState } from '@/game/types'
import { ActionPanel } from './ActionPanel'
import { BoatView } from './BoatView'
import { HelpButton } from './Help'
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
  const rawState = useGameStore((s) => s.state)
  const events = useGameStore((s) => s.events)
  const lastError = useGameStore((s) => s.lastError)
  const reset = useGameStore((s) => s.reset)
  const mode = useGameStore((s) => s.mode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const debugMode = useGameStore((s) => s.debugMode)
  const toggleDebugMode = useGameStore((s) => s.toggleDebugMode)
  const getFullState = useGameStore((s) => s.getFullState)
  if (!rawState) return null
  // В client-режиме state — FilteredGameState; в нём players[id].bestFriend может быть null,
  // некоторые supplyById/navById отсутствуют. UI рендерит "?" / "— скрыто —".
  const state = rawState as GameState

  function exportLog() {
    // Если host — используем полный state. Иначе берём фильтрованный из rawState.
    const full = getFullState() ?? state
    const blob = new Blob(
      [
        JSON.stringify(
          { events, state: full, exportedAt: new Date().toISOString(), mode },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `za-bortom-day${state.day}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen p-4 font-mono text-white grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <section className="space-y-4">
        <header className="flex justify-between items-baseline">
          <h1 className="text-2xl">
            <span className="text-sea-300">День {state.day} · </span>
            <span>{describePhase(state)}</span>
            {mode !== 'local' && myPlayerId && (
              <span className="ml-3 text-sm text-yellow-300">
                · вы: {state.players[myPlayerId]?.displayName ?? myPlayerId} ({mode})
              </span>
            )}
          </h1>
          <div className="flex gap-4 items-baseline">
            <HelpButton />
            {mode === 'host' && (
              <button
                onClick={toggleDebugMode}
                className={`text-sm hover:underline ${debugMode ? 'text-yellow-300' : 'text-sea-300'}`}
                title="Показать полный state (cheat-mode для отладки)"
              >
                👁 {debugMode ? 'Debug: вкл' : 'Debug'}
              </button>
            )}
            <button onClick={exportLog} className="text-sea-300 hover:underline text-sm">
              💾 Лог
            </button>
            <button onClick={reset} className="text-sea-300 hover:underline text-sm">
              ← к началу
            </button>
          </div>
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
