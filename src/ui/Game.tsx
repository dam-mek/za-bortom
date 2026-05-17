import { useGameStore } from '@/store/game-store'
import type { GameState } from '@/game/types'
import { ActionPanel } from './ActionPanel'
import { BoatView } from './BoatView'
import { GameHeader } from './GameHeader'
import { InventoryRail, findActorPlayerId, getActor } from './InventoryRail'
import { LogPane } from './LogPane'
import { POVPanel } from './POVPanel'
import { POVDrawer } from './POVDrawer'
import { ScoringScreen } from './ScoringScreen'
import { SupplyDeckCard, NavDeckCard } from './DeckCards'

/**
 * Главный игровой экран. Layout см. docs/design-roadmap.md §4.
 *
 * Адаптив: mobile-first.
 *  - На мобильном (< 1024px): вертикальный стек. POV — шторкой снизу (POVDrawer).
 *    Колоды — горизонтальная пара под лодкой.
 *  - На десктопе (lg:): 3-колоночный layout — POV слева, лодка по центру,
 *    колоды справа.
 */
export function Game() {
  const rawState = useGameStore((s) => s.state)
  const mode = useGameStore((s) => s.mode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const lastError = useGameStore((s) => s.lastError)

  if (!rawState) return null
  const state = rawState as GameState

  // Финальный экран — отдельная страница журнала.
  if (state.phase.kind === 'finished') {
    return <ScoringScreen state={state} />
  }

  // POV: в multiplayer — свой POV, в hot-seat — POV текущего ходящего.
  const povPlayerId: string | null =
    mode === 'local' ? findActorPlayerId(state) : (myPlayerId ?? null)
  const actor = getActor(state, myPlayerId ?? null)
  const inventoryTitle =
    mode === 'local' ? 'Инвентарь хода' : 'Ваш инвентарь'

  return (
    <main className="relative min-h-screen p-2 pb-32 text-ink lg:p-4">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 lg:gap-4">
        <GameHeader state={state} />

        {/* Главный ряд: десктоп — 3 колонки, мобайл — стек. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
          {/* POV слева — только десктоп. На мобайле — POVDrawer внизу. */}
          {povPlayerId && (
            <div className="hidden lg:block">
              <POVPanel
                state={state}
                myPlayerId={povPlayerId}
                hotSeat={mode === 'local'}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <BoatView state={state} />
          </div>

          {/* Колоды: десктоп — aside справа, мобайл — горизонтальная пара. */}
          <aside className="flex shrink-0 flex-row justify-center gap-3 lg:w-[160px] lg:flex-col">
            <SupplyDeckCard
              remaining={state.supplyDeck.length}
              discard={state.supplyDiscard.length}
            />
            <NavDeckCard
              remaining={state.navDeck.length}
              discard={state.navDiscard.length}
            />
          </aside>
        </div>

        <InventoryRail state={state} actor={actor} title={inventoryTitle} />

        <div
          className="rounded-sm border border-ink/20 p-3 shadow-emboss"
          style={{
            background:
              'linear-gradient(180deg, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 100%)',
          }}
        >
          <ActionPanel state={state} />
        </div>

        {lastError && (
          <div className="rounded-sm border-2 border-card-enemy/70 bg-card-enemy/20 p-3 text-card-enemy-deep">
            <span className="font-stamp text-[13px] tracking-stamp">
              {lastError.code}
            </span>
            <span className="ml-2 font-serif text-[14px]">{lastError.message}</span>
          </div>
        )}

        <LogPane />
      </div>

      {/* Шторка POV — только мобайл. Фиксированно прижата к низу. */}
      {povPlayerId && (
        <POVDrawer
          state={state}
          myPlayerId={povPlayerId}
          hotSeat={mode === 'local'}
        />
      )}
    </main>
  )
}
