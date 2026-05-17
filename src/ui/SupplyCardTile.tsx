import clsx from 'clsx'
import { motion } from 'motion/react'
import { SUPPLY_ICON, SUPPLY_NAME } from '@/ui/icons'
import { SUPPLY_TOOLTIPS } from '@/ui/card-tooltips'
import { InfoBadge } from '@/ui/InfoBadge'
import type { SupplyCard } from '@/game/types'

/**
 * Унифицированная карточка-«предмет» — одна и та же визуальная единица
 * используется в инвентаре, в селекторах, в drawer'е и в выборе из общей кучи.
 * См. docs/design-roadmap.md §6 / §13.
 *
 * Состояния:
 *  - open (default): пергаментная карточка с SVG-иконкой, названием, статами и info-badge.
 *  - closed:          деревянная обратная сторона (если содержимое неизвестно).
 *  - empty:           «пусто» (пустой слот в инвентаре).
 *  - selectable:      кликабельная — добавляются hover и selection-состояние.
 */
export type SupplyTileMode = 'open' | 'closed' | 'empty' | 'selectable'

interface SupplyCardTileProps {
  card?: SupplyCard
  mode?: SupplyTileMode
  selected?: boolean
  onClick?: () => void
  /** Размер тайла — стандартный или компактный (в формах). */
  compact?: boolean
}

export function SupplyCardTile({
  card,
  mode,
  selected,
  onClick,
  compact = false,
}: SupplyCardTileProps) {
  // Если режим явно не задан — выводим из card.
  const effective: SupplyTileMode =
    mode ?? (card ? (onClick ? 'selectable' : 'open') : 'empty')

  // === EMPTY ===
  if (effective === 'empty') {
    return (
      <TileShell compact={compact} bgClass="bg-slot-empty/70">
        <div className="flex h-full items-center justify-center">
          <span className="font-stamp text-[12px] tracking-stamp text-ink/40">
            пусто
          </span>
        </div>
      </TileShell>
    )
  }

  // === CLOSED — нет данных или специально закрыто (без «?»). ===
  if (effective === 'closed' && !card) {
    return (
      <TileShell compact={compact} bgClass="bg-frame-wood-deep">
        <div
          className="absolute inset-1 rounded-sm border border-paper/15"
          style={{
            background:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 8px, transparent 8px, transparent 16px), linear-gradient(180deg, #8B6F4E 0%, #5e4831 100%)',
          }}
        />
        <div className="relative flex h-full flex-col items-center justify-center text-paper/85">
          <div className="font-stamp text-[14px] tracking-stamp">в кармане</div>
        </div>
      </TileShell>
    )
  }

  if (!card) return null

  // === OPEN / SELECTABLE — настоящая карточка с SVG ===
  const Icon = SUPPLY_ICON[card.kind]
  const name = SUPPLY_NAME[card.kind]
  const interactive = effective === 'selectable' || !!onClick
  const isClosed = effective === 'closed'

  const content = (
    <>
      <div className="absolute right-1 top-1 z-20">
        <InfoBadge content={SUPPLY_TOOLTIPS[card.kind]} size={13} />
      </div>
      {isClosed && (
        <div className="absolute left-1 top-1 z-20 rounded-sm bg-frame-wood-deep px-1 py-0.5 font-stamp text-[8px] tracking-stamp text-paper">
          в кармане
        </div>
      )}
      <div
        className={clsx(
          'flex h-full flex-col items-center justify-center gap-1',
          isClosed && 'opacity-90',
        )}
      >
        <div className="text-paper">
          <Icon size={compact ? 24 : 30} />
        </div>
        <div className="px-1 text-center font-stamp text-[12px] leading-tight tracking-stamp text-paper">
          {name.toUpperCase()}
        </div>
        <div className="flex items-center gap-2">
          {(card.weaponStrength ?? 0) > 0 && (
            <div className="font-mono text-[11px] font-bold text-paper/90">
              ⚔ {card.weaponStrength}
            </div>
          )}
          {(card.valuePoints ?? 0) > 0 && (
            <div className="font-mono text-[11px] font-bold text-accent">
              ◆ {card.valuePoints}
            </div>
          )}
        </div>
      </div>
    </>
  )

  const supplyBg = 'linear-gradient(180deg, #8aa9c2 0%, #6B8EA8 60%, #3F5366 100%)'

  if (interactive) {
    return (
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'tween', duration: 0.1 }}
        onClick={onClick}
        className={clsx(
          'relative overflow-hidden rounded-sm text-paper transition',
          compact ? 'h-[78px] w-[96px]' : 'h-[96px] w-full',
        )}
        style={{
          background: supplyBg,
          boxShadow: selected
            ? 'inset 0 0 0 2px rgba(242,197,0,0.9), 0 4px 14px rgba(107,142,168,0.45)'
            : 'inset 0 0 0 1px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 4px rgba(0,0,0,0.18)',
        }}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <TileShell compact={compact} bgStyle={{ background: supplyBg }}>
      {content}
    </TileShell>
  )
}

function TileShell({
  children,
  bgClass,
  bgStyle,
  compact,
}: {
  children: React.ReactNode
  bgClass?: string
  bgStyle?: React.CSSProperties
  compact: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={clsx(
        'relative overflow-hidden rounded-sm p-2',
        compact ? 'h-[78px] w-[96px]' : 'h-[152px] w-full',
        bgClass,
      )}
      style={{
        boxShadow:
          'inset 0 0 0 1px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
        ...bgStyle,
      }}
    >
      {children}
    </motion.div>
  )
}
