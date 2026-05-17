import { characterMeta } from '@/ui/character-meta'
import { SupplyCardTile } from '@/ui/SupplyCardTile'
import type { GameState, Player } from '@/game/types'

/**
 * Нижняя полоса инвентаря. Заблокированные цвета:
 *   - фон-контейнер: #5E5E5E
 *   - пустой слот:   #7BB0D6
 * Карты — унифицированный SupplyCardTile с SVG-иконками, названиями и info-badge.
 * Закрытые карты НЕ показывают «?»: показывают свою иконку с пометкой «в кармане».
 * См. docs/design-roadmap.md §4 (низ).
 */
export function InventoryRail({
  state,
  actor,
  title = 'Инвентарь',
}: {
  state: GameState
  actor: Player | null
  title?: string
}) {
  const meta = actor ? characterMeta(actor.character) : null
  const open = actor ? actor.openSupplies : []
  const closed = actor ? actor.closedSupplies : []

  return (
    <section
      className="relative overflow-hidden rounded-md p-3.5 shadow-journal"
      style={{
        background: 'linear-gradient(180deg, #6e6e6e 0%, #5E5E5E 50%, #3a3a3a 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(0,0,0,0.25), 0 6px 18px rgba(0,0,0,0.35)',
      }}
    >
      {/* Зернистость металла. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
        {/* Заголовок-меточка: на мобайле сверху горизонтально, на десктопе — слева вертикально. */}
        <div className="flex shrink-0 items-baseline gap-2 lg:block lg:pt-1">
          <div className="font-stamp text-[11px] tracking-stamp text-paper/80 lg:text-[12px]">
            {title}
          </div>
          {meta && actor && (
            <div className="flex items-baseline gap-2 lg:mt-1 lg:flex-col lg:items-stretch lg:gap-0">
              <div className="font-hand text-[22px] leading-none text-accent lg:text-[28px]">
                {meta.name}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-paper/70 lg:text-[11px]">
                {actor.displayName}
              </div>
            </div>
          )}
          {!actor && (
            <div className="font-hand text-[18px] text-paper/50">— пусто —</div>
          )}
        </div>

        {/* Слоты с картами. */}
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(120px,180px))] gap-2.5">
          {open.map((id) => {
            const card = state.supplyById[id]
            return <SupplyCardTile key={id} card={card} mode="open" />
          })}
          {closed.map((id, i) => {
            const card = state.supplyById[id]
            return (
              <SupplyCardTile
                key={id ?? `c-${i}`}
                card={card}
                mode="closed"
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

// === Утилита: вычислить «актёра» — игрока, чей ход сейчас.
export function findActorPlayerId(state: GameState): string | null {
  const p = state.phase
  if (p.kind === 'morning' && p.subPhase.kind === 'distributing') {
    return state.seats[p.subPhase.currentSeat]?.occupantId ?? null
  }
  if (p.kind === 'day') {
    const s = p.subPhase
    if (s.kind === 'waitingForAction') return state.seats[s.currentSeat]?.occupantId ?? null
    if (s.kind === 'rowing') return s.playerId
    if (s.kind === 'awaitingSwapResponse' || s.kind === 'awaitingRobResponse') {
      return state.seats[s.targetSeat]?.occupantId ?? null
    }
    if (s.kind === 'completingRobPick') return s.attackerId
    if (s.kind === 'fight') return s.fight.pendingAlly?.invitedId ?? s.fight.attackerId
  }
  if (p.kind === 'evening' && p.subPhase.kind === 'sternPicking') return p.subPhase.pickerId
  return null
}

export function getActor(state: GameState, myPlayerId: string | null): Player | null {
  // В multiplayer показываем СВОЙ инвентарь. В hot-seat — текущего актёра.
  if (myPlayerId) return state.players[myPlayerId] ?? null
  const actorId = findActorPlayerId(state)
  return actorId ? (state.players[actorId] ?? null) : null
}
