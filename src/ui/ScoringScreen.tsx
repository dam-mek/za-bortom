import { motion } from 'motion/react'
import { useGameStore } from '@/store/game-store'
import { characterMeta } from './character-meta'
import {
  WaxSealIcon,
  AnchorIcon,
  ScrollIcon,
  CompassIcon,
  SeagullIcon,
} from './icons'
import type { GameState, PlayerId, ScoreBreakdown } from '@/game/types'

/**
 * Финальный экран — страница журнала с итогами.
 * См. docs/design-roadmap.md §13 (Финальный scoring-экран).
 */
export function ScoringScreen({ state }: { state: GameState }) {
  const reset = useGameStore((s) => s.reset)
  const events = useGameStore((s) => s.events)
  const mode = useGameStore((s) => s.mode)
  const getFullState = useGameStore((s) => s.getFullState)

  const scores = state.finalScores
  const sortedEntries: [PlayerId, ScoreBreakdown][] = scores
    ? Object.entries(scores).sort((a, b) => b[1].total - a[1].total)
    : []
  const winnerLabel =
    state.winner === 'sea'
      ? 'Море. Никто не выжил.'
      : state.winner === 'tie'
        ? 'Ничья'
        : state.winner
          ? state.players[state.winner]?.displayName ?? state.winner
          : '—'

  function exportLog() {
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
    a.download = `za-bortom-final-day${state.day}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-ink">
      {/* Ночной фон — глухая ночь, в подсчёте уже всё рассказано. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top, #1a2438 0%, #0f1422 60%, #060814 100%)',
        }}
      />
      <Stars />

      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-sm border border-ink/40 bg-paper/95 p-8 shadow-journal"
          style={{
            background:
              'radial-gradient(ellipse at center, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 80%, #b89e6b 110%)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.5), 0 22px 60px rgba(0,0,0,0.55)',
          }}
        >
          {/* Зернистость. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
          <div className="pointer-events-none absolute right-3 top-3 text-ink/15">
            <CompassIcon size={56} />
          </div>

          {/* Заголовок. */}
          <header className="relative text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-ink-faint">
              — последняя страница журнала —
            </div>
            <h1 className="mt-1 font-hand text-[64px] leading-none text-card-enemy-deep">
              День {state.day}. Финал.
            </h1>
            <div className="mt-2 flex items-center justify-center gap-2 font-serif italic text-[13px] text-ink-faint">
              <SeagullIcon size={14} />
              <span>четыре чайки — земля рядом</span>
              <SeagullIcon size={14} />
            </div>
          </header>

          {/* Печать-победитель. */}
          <motion.div
            initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', damping: 14 }}
            className="relative mx-auto my-7 inline-block w-full text-center"
          >
            <div className="relative inline-flex flex-col items-center gap-1 rounded-full border-[4px] border-card-enemy-deep bg-card-enemy/15 px-8 py-5">
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-card-enemy-deep">
                <WaxSealIcon size={28} />
              </div>
              <div className="mt-4 font-stamp text-[11px] tracking-stamp text-card-enemy-deep">
                {state.winner === 'sea' || state.winner === 'tie'
                  ? 'ИСХОД'
                  : 'КАПИТАН ШЛЮПКИ'}
              </div>
              <div className="font-hand text-[38px] leading-none text-ink">
                {winnerLabel}
              </div>
            </div>
          </motion.div>

          {/* Таблица итогов. */}
          {scores && (
            <section className="relative">
              <div className="mb-2 flex items-center gap-2">
                <ScrollIcon size={14} />
                <h2 className="font-stamp text-[11px] tracking-stamp text-ink">
                  СВОДКА ОЧКОВ
                </h2>
              </div>
              <div className="overflow-x-auto rounded-sm border border-ink/25 bg-paper/70">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-paper-deep/50">
                      <Th className="text-left">Место</Th>
                      <Th className="text-left">Игрок</Th>
                      <Th>Выж.</Th>
                      <Th>Ценн.</Th>
                      <Th>Друг</Th>
                      <Th>Враг</Th>
                      <Th>Психо.</Th>
                      <Th className="text-right">Итого</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map(([pid, b], idx) => {
                      const p = state.players[pid]
                      if (!p) return null
                      const val = b.valuables.reduce((a, v) => a + v.value, 0)
                      const isWinner = pid === state.winner
                      return (
                        <motion.tr
                          key={pid}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + idx * 0.08 }}
                          className={
                            isWinner
                              ? 'bg-accent/20'
                              : idx % 2 === 0
                                ? ''
                                : 'bg-paper-deep/20'
                          }
                        >
                          <Td className="text-left">
                            <span className="font-stamp text-[14px] text-card-enemy-deep">
                              {idx + 1}.
                            </span>
                          </Td>
                          <Td className="text-left">
                            <div className="font-hand text-[18px] leading-none">
                              {p.displayName}
                            </div>
                            <div className="font-mono text-[9px] text-ink-faint">
                              {characterMeta(p.character).name}{' '}
                              {p.consciousness === 'dead' && '· †'}
                            </div>
                          </Td>
                          <Td>
                            <CountUp value={b.survival} delay={0.6 + idx * 0.08} />
                          </Td>
                          <Td>
                            <CountUp value={val} delay={0.65 + idx * 0.08} />
                          </Td>
                          <Td>
                            <CountUp
                              value={b.bestFriendBonus?.points ?? 0}
                              delay={0.7 + idx * 0.08}
                            />
                          </Td>
                          <Td>
                            <CountUp
                              value={b.worstEnemyBonus?.points ?? 0}
                              delay={0.75 + idx * 0.08}
                            />
                          </Td>
                          <Td>
                            <CountUp
                              value={b.psychopathDeathBonus.points}
                              delay={0.8 + idx * 0.08}
                            />
                          </Td>
                          <Td className="text-right">
                            <motion.span
                              initial={{ scale: 0.6 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.9 + idx * 0.08 }}
                              className={`font-mono text-[16px] font-bold ${isWinner ? 'text-card-enemy-deep' : 'text-ink'}`}
                            >
                              {b.total}
                            </motion.span>
                          </Td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Действия. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border-2 border-card-enemy-deep bg-card-enemy px-5 py-2 font-stamp text-[12px] tracking-stamp text-paper shadow-emboss transition hover:brightness-110"
            >
              <AnchorIcon size={14} />
              СНОВА В ПЛАВАНИЕ
            </button>
            <button
              type="button"
              onClick={exportLog}
              className="inline-flex items-center gap-2 rounded-sm border-2 border-ink/40 bg-paper/70 px-4 py-2 font-stamp text-[11px] tracking-stamp text-ink shadow-emboss transition hover:bg-paper"
            >
              <ScrollIcon size={14} />
              ЭКСПОРТ ЖУРНАЛА
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`border border-ink/20 px-2 py-1.5 text-center font-stamp text-[10px] tracking-stamp text-ink ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td
      className={`border border-ink/15 px-2 py-1.5 text-center font-mono ${className}`}
    >
      {children}
    </td>
  )
}

function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      {value}
    </motion.span>
  )
}

function Stars() {
  // Случайные «звёзды» — фиксированные позиции, чтобы не дёргались между ререндерами.
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: (i * 137.5) % 100,
    y: (i * 53.7) % 100,
    size: ((i * 7) % 3) + 1,
    delay: (i % 8) * 0.5,
  }))
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{
            duration: 3 + (s.id % 4),
            repeat: Infinity,
            delay: s.delay,
          }}
        />
      ))}
    </div>
  )
}
