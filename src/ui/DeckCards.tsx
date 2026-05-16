import { motion } from 'motion/react'
import { InfoBadge } from '@/ui/InfoBadge'
import { DECK_TOOLTIPS } from '@/ui/card-tooltips'
import { ScrollIcon, CompassIcon } from '@/ui/icons'

/**
 * Карта-«колода» с числом «осталось». Заблокированные цвета:
 *   - припасы:   #6B8EA8 (фон) → #3F5366 (глубокая тень)
 *   - навигация: #5BB5A8 (фон) → #2f6e64
 * См. docs/design-roadmap.md §2, §4.
 */

interface DeckProps {
  remaining: number
  discard?: number
}

export function SupplyDeckCard({ remaining, discard }: DeckProps) {
  return (
    <DeckCardShell
      bgGradient="linear-gradient(180deg, #8aa9c2 0%, #6B8EA8 50%, #3F5366 100%)"
      label="ПРИПАСЫ"
      icon={<ScrollIcon size={28} />}
      remaining={remaining}
      discard={discard}
      tooltip={DECK_TOOLTIPS.supplies}
    />
  )
}

export function NavDeckCard({ remaining, discard }: DeckProps) {
  return (
    <DeckCardShell
      bgGradient="linear-gradient(180deg, #7ec9bf 0%, #5BB5A8 50%, #2f6e64 100%)"
      label="НАВИГАЦИЯ"
      icon={<CompassIcon size={28} />}
      remaining={remaining}
      discard={discard}
      tooltip={DECK_TOOLTIPS.navigation}
    />
  )
}

interface ShellProps extends DeckProps {
  bgGradient: string
  label: string
  icon: React.ReactNode
  tooltip: { title: string; body: string }
}

function DeckCardShell({
  bgGradient,
  label,
  icon,
  remaining,
  discard,
  tooltip,
}: ShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative w-[140px] shrink-0"
    >
      {/* Тень-стопка под основной картой — намёк на колоду. */}
      <div
        aria-hidden
        className="absolute inset-x-1 top-1 bottom-0 rounded-sm opacity-60"
        style={{ background: bgGradient, filter: 'brightness(0.7)' }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0.5 top-0.5 bottom-0 rounded-sm opacity-80"
        style={{ background: bgGradient, filter: 'brightness(0.85)' }}
      />

      <div
        className="relative overflow-hidden rounded-sm p-3 text-paper shadow-journal"
        style={{
          background: bgGradient,
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.18), 0 6px 16px rgba(20,16,8,0.35)',
        }}
      >
        {/* Зернистость. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="absolute right-2 top-2 ring-2 ring-paper/30 rounded-full">
          <InfoBadge content={tooltip} size={20} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="text-paper">{icon}</div>
          <div className="mt-2 font-stamp text-[13px] tracking-stamp text-paper">
            {label}
          </div>
          <div className="mt-3 font-stamp text-[11px] uppercase tracking-stamp text-paper/80">
            осталось
          </div>
          <div className="font-mono text-[44px] font-bold leading-none text-accent drop-shadow">
            {remaining}
          </div>
          {discard !== undefined && (
            <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-paper/80">
              сброс · {discard}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
