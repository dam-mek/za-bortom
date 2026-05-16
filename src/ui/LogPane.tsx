import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/store/game-store'
import { ScrollIcon, ChevronUpIcon, ChevronDownIcon } from './icons'
import type { GameEvent } from '@/game/types'

/**
 * Судовой журнал — collapsible панель записей.
 * См. docs/design-roadmap.md §13 (LogPane).
 */
export function LogPane() {
  const events = useGameStore((s) => s.events)
  const [open, setOpen] = useState(false)

  const recent = events.slice(-100).reverse()

  return (
    <section
      className="relative overflow-hidden rounded-sm border border-ink/25 shadow-journal"
      style={{
        background:
          'linear-gradient(180deg, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.45), 0 6px 16px rgba(0,0,0,0.22)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-ink/15 bg-paper-deep/50 px-4 py-2.5 text-ink hover:bg-paper-deep/70"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-card-enemy-deep">
            <ScrollIcon size={18} />
          </span>
          <h2 className="font-stamp text-[14px] tracking-stamp text-ink">
            СУДОВОЙ ЖУРНАЛ
          </h2>
          <span className="font-mono text-[12px] text-ink-faint">
            · {events.length} записей
          </span>
        </div>
        {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="max-h-[50vh] overflow-y-auto p-3">
              {events.length === 0 ? (
                <div className="text-center font-hand text-[18px] italic text-ink-faint">
                  записей пока нет…
                </div>
              ) : (
                <ul className="space-y-1">
                  {recent.map((e, i) => (
                    <LogEntry
                      key={events.length - i}
                      event={e}
                      index={events.length - i}
                    />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function LogEntry({ event, index }: { event: GameEvent; index: number }) {
  const payload =
    typeof event.payload === 'object' && event.payload !== null
      ? Object.entries(event.payload as Record<string, unknown>)
          .map(([k, v]) => `${k}=${formatValue(v)}`)
          .join(' · ')
      : String(event.payload)
  return (
    <li className="flex items-baseline gap-2.5 border-b border-dashed border-ink/15 pb-1">
      <span className="w-12 shrink-0 font-mono text-[11px] text-ink-faint">
        #{index}
      </span>
      <span className="shrink-0 font-stamp text-[12px] tracking-stamp text-card-enemy-deep">
        {event.kind}
      </span>
      <span className="flex-1 font-serif text-[13px] text-ink">{payload}</span>
    </li>
  )
}

function formatValue(v: unknown): string {
  if (v === null) return '∅'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.length}]`
  if (typeof v === 'object') return '{…}'
  return String(v)
}
