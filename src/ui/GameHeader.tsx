import { motion } from 'motion/react'
import { useGameStore } from '@/store/game-store'
import { InfoBadge } from '@/ui/InfoBadge'
import { SEAGULL_TOOLTIP } from '@/ui/card-tooltips'
import {
  SeagullIcon,
  ScrollIcon,
  QuillIcon,
  WheelIcon,
} from '@/ui/icons'
import { HelpButton } from '@/ui/Help'
import type { GameState } from '@/game/types'

const PHASE_LABEL: Record<string, string> = {
  lobby: 'Лобби',
  setup: 'Подготовка',
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  scoring: 'Подсчёт',
  finished: 'Игра окончена',
}

const SUBPHASE_LABEL: Record<string, string> = {
  distributing: 'раздача припасов',
  done: 'готово',
  waitingForAction: 'ожидание хода',
  rowing: 'гребля',
  awaitingSwapResponse: 'обмен',
  awaitingRobResponse: 'грабёж',
  completingRobPick: 'выбор добычи',
  fight: 'драка',
  sternPicking: 'выбор карт',
  resolving: 'разрешение',
}

function describeSubPhase(state: GameState): string | null {
  const p = state.phase
  if (p.kind === 'morning') return SUBPHASE_LABEL[p.subPhase.kind] ?? null
  if (p.kind === 'day') return SUBPHASE_LABEL[p.subPhase.kind] ?? null
  if (p.kind === 'evening') return SUBPHASE_LABEL[p.subPhase.kind] ?? null
  return null
}

/**
 * Хедер главного экрана: штамп дня/фазы, чайки, кнопки управления.
 * См. docs/design-roadmap.md §4 (HEADER).
 */
export function GameHeader({ state }: { state: GameState }) {
  const mode = useGameStore((s) => s.mode)
  const debugMode = useGameStore((s) => s.debugMode)
  const toggleDebugMode = useGameStore((s) => s.toggleDebugMode)
  const reset = useGameStore((s) => s.reset)
  const events = useGameStore((s) => s.events)
  const getFullState = useGameStore((s) => s.getFullState)

  const phaseLabel = PHASE_LABEL[state.phase.kind] ?? state.phase.kind
  const sub = describeSubPhase(state)

  const alive = Object.values(state.players).filter(
    (p) => p.consciousness !== 'dead',
  ).length
  const total = Object.values(state.players).length

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
    a.download = `za-bortom-day${state.day}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header
      className="flex items-center justify-between gap-4 rounded-sm border border-ink/20 px-4 py-3 shadow-emboss"
      style={{
        background:
          'linear-gradient(180deg, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 100%)',
      }}
    >
      {/* Левая часть: штамп фазы. */}
      <div className="flex items-center gap-5">
        <PhaseStamp day={state.day} phase={phaseLabel} subPhase={sub} />
        <div className="flex flex-col gap-1 font-mono text-[13px] text-ink">
          <div>
            <span className="text-ink-faint">живых:</span>{' '}
            <span className="font-bold text-ink">
              {alive}/{total}
            </span>
          </div>
          {mode !== 'local' && (
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">
              {mode}
            </div>
          )}
        </div>
      </div>

      {/* Правая часть: чайки + кнопки. */}
      <div className="flex items-center gap-6">
        <SeagullTokens count={state.seagullTokens} />
        <div className="flex items-center gap-4 text-ink">
          <HelpButton />
          {mode === 'host' && (
            <button
              type="button"
              onClick={toggleDebugMode}
              className={`flex items-center gap-1.5 font-serif text-[14px] transition hover:text-ink ${
                debugMode ? 'text-accent' : 'text-ink-faint'
              }`}
              title="Показать полный state"
            >
              <WheelIcon size={16} />
              {debugMode ? 'Отладка вкл' : 'Отладка'}
            </button>
          )}
          <button
            type="button"
            onClick={exportLog}
            className="flex items-center gap-1.5 font-serif text-[14px] text-ink-faint transition hover:text-ink"
          >
            <ScrollIcon size={16} />
            Журнал
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 font-serif text-[14px] text-ink-faint transition hover:text-ink"
          >
            <QuillIcon size={16} />
            На берег
          </button>
        </div>
      </div>
    </header>
  )
}

function PhaseStamp({
  day,
  phase,
  subPhase,
}: {
  day: number
  phase: string
  subPhase: string | null
}) {
  return (
    <motion.div
      key={`${day}-${phase}`}
      initial={{ rotate: -2, opacity: 0, scale: 0.95 }}
      animate={{ rotate: -1.5, opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', damping: 18 }}
      className="relative inline-flex flex-col rounded-sm border-2 border-card-enemy-deep bg-paper px-5 py-2.5 shadow-emboss"
      style={{
        boxShadow:
          'inset 0 0 0 1px rgba(140,44,61,0.35), 0 4px 12px rgba(80,30,30,0.25)',
      }}
    >
      <div className="font-mono text-[11px] uppercase tracking-stamp text-card-enemy-deep">
        Шлюпка №7 · журнал
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-stamp text-[16px] tracking-stamp text-card-enemy-deep">
          День
        </span>
        <span className="font-stamp text-[34px] leading-none text-card-enemy">
          {day}
        </span>
        <span className="font-stamp text-[16px] tracking-stamp text-ink">
          ·
        </span>
        <span className="font-stamp text-[20px] tracking-stamp text-ink">
          {phase}
        </span>
      </div>
      {subPhase && (
        <div className="font-hand text-[16px] italic text-ink-faint">
          {subPhase}
        </div>
      )}
    </motion.div>
  )
}

function SeagullTokens({ count }: { count: number }) {
  const dots = [0, 1, 2, 3]
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-ink-faint">
        <SeagullIcon size={26} />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {dots.map((i) => (
            <span
              key={i}
              className={`inline-block h-3.5 w-3.5 rounded-full border border-ink/50 transition ${
                i < count
                  ? 'bg-card-enemy shadow-[0_0_8px_rgba(140,44,61,0.7)]'
                  : 'bg-paper/60'
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          чаек · {count}/4
        </span>
      </div>
      <InfoBadge content={SEAGULL_TOOLTIP} size={16} />
    </div>
  )
}
