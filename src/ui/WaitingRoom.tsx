import { motion, AnimatePresence } from 'motion/react'
import clsx from 'clsx'
import { useGameStore } from '@/store/game-store'
import {
  WheelIcon,
  QuillIcon,
  AnchorIcon,
  WaxSealIcon,
  CompassIcon,
} from './icons'

/**
 * WaitingRoom — судовая ведомость. См. docs/design-roadmap.md §13.
 */
export function WaitingRoom() {
  const mode = useGameStore((s) => s.mode)
  const lobby = useGameStore((s) => s.lobby)
  const roomCode = useGameStore((s) => s.roomCode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const hostStartGame = useGameStore((s) => s.hostStartGame)
  const hostAddBot = useGameStore((s) => s.hostAddBot)
  const setReady = useGameStore((s) => s.setReady)
  const reset = useGameStore((s) => s.reset)
  const lastError = useGameStore((s) => s.lastError)

  if (!lobby) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <div className="text-center">
          <div className="font-hand text-[28px]">Загрузка лобби…</div>
          <button
            onClick={reset}
            className="mt-4 font-serif text-[12px] text-ink-faint hover:underline"
          >
            ← отмена
          </button>
        </div>
      </main>
    )
  }

  const me = lobby.players.find((p) => p.id === myPlayerId)
  const isReady = me?.ready ?? false

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 60%, #b89e6b 110%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div className="pointer-events-none absolute right-6 top-6 text-ink/12">
        <CompassIcon size={72} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full text-ink"
        >
          {/* Заголовок-штамп. */}
          <header className="mb-6 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-ink-faint">
              — судовая ведомость —
            </div>
            <h2 className="mt-1 font-hand text-[48px] leading-none text-card-enemy-deep">
              Шлюпка отчаливает
            </h2>
            {roomCode && (
              <motion.div
                initial={{ rotate: -3, scale: 0.9 }}
                animate={{ rotate: -2, scale: 1 }}
                className="mt-3 inline-block rounded-sm border-2 border-card-enemy bg-paper/80 px-4 py-1.5 shadow-emboss"
              >
                <div className="font-stamp text-[9px] tracking-stamp text-card-enemy-deep">
                  код комнаты
                </div>
                <div className="select-all font-mono text-[20px] font-bold text-ink">
                  {roomCode}
                </div>
              </motion.div>
            )}
          </header>

          {/* Ведомость. */}
          <section
            className="relative rounded-sm border border-ink/30 bg-paper/90 p-5 shadow-journal"
            style={{
              boxShadow:
                'inset 0 0 0 1px rgba(255,255,255,0.5), 0 8px 22px rgba(0,0,0,0.18)',
            }}
          >
            <div className="absolute -top-3 left-6 bg-paper px-3 font-stamp text-[12px] tracking-stamp text-card-enemy-deep">
              КОМАНДА · {lobby.players.length}/6
            </div>

            <ul className="divide-y divide-ink/15">
              <AnimatePresence>
                {lobby.players.map((p, idx) => (
                  <motion.li
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: idx * 0.05 }}
                    className={clsx(
                      'flex items-center justify-between py-2 px-2 rounded-sm',
                      p.id === myPlayerId && 'bg-accent/15',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-ink-faint">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      {p.id === lobby.hostId && (
                        <span title="капитан" className="text-card-enemy-deep">
                          <WheelIcon size={14} />
                        </span>
                      )}
                      {p.isBot && (
                        <span
                          title="бот"
                          className="rounded-sm border border-ink/30 px-1 font-mono text-[8px] uppercase tracking-wider text-ink-faint"
                        >
                          бот
                        </span>
                      )}
                      <span className="font-hand text-[22px] text-ink">
                        {p.displayName}
                      </span>
                      {p.id === myPlayerId && (
                        <span className="font-serif text-[10px] italic text-ink-faint">
                          (вы)
                        </span>
                      )}
                    </div>
                    <div className="font-stamp text-[10px] tracking-stamp">
                      {p.disconnected ? (
                        <span className="text-card-enemy-deep">
                          ОФФЛАЙН
                        </span>
                      ) : p.ready ? (
                        <span className="text-card-nav-shadow">✓ ГОТОВ</span>
                      ) : (
                        <span className="text-ink-faint">— ждёт —</span>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {lobby.players.length < 4 && (
              <div className="mt-3 rounded-sm border border-card-enemy/30 bg-card-enemy/10 p-2 text-center font-serif text-[12px] italic text-card-enemy-deep">
                Минимум 4 человека в шлюпке — нужно ещё{' '}
                {4 - lobby.players.length}.
              </div>
            )}
          </section>

          {/* Управление. */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {mode === 'host' && lobby.players.length < 6 && (
              <button
                type="button"
                onClick={() => hostAddBot()}
                className="inline-flex items-center gap-2 rounded-sm border-2 border-ink/40 bg-paper/70 px-4 py-2 font-stamp text-[11px] tracking-stamp text-ink shadow-emboss transition hover:bg-paper"
              >
                <QuillIcon size={14} /> ДОБАВИТЬ БОТА
              </button>
            )}

            {mode === 'client' && (
              <button
                type="button"
                onClick={() => setReady(!isReady)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border-2 px-5 py-2 font-stamp text-[11px] tracking-stamp shadow-emboss transition',
                  isReady
                    ? 'border-card-nav-shadow bg-card-nav-shadow text-paper'
                    : 'border-ink/40 bg-paper/70 text-ink hover:bg-paper',
                )}
              >
                <AnchorIcon size={14} />
                {isReady ? 'ГОТОВ · ОТМЕНИТЬ' : 'Я ГОТОВ'}
              </button>
            )}

            {mode === 'host' && (
              <button
                type="button"
                onClick={() => hostStartGame()}
                disabled={!lobby.canStart}
                className="inline-flex items-center gap-2 rounded-full border-2 border-card-enemy-deep bg-card-enemy px-5 py-2 font-stamp text-[12px] tracking-stamp text-paper shadow-emboss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <WaxSealIcon size={16} />
                {lobby.canStart ? 'ПОДНЯТЬ ЯКОРЬ' : 'ЖДЁМ КОМАНДУ'}
              </button>
            )}
          </div>

          {lastError && (
            <div className="mt-3 rounded-sm border border-card-enemy/50 bg-card-enemy/10 p-2 text-center font-serif text-[12px] text-card-enemy-deep">
              <span className="font-stamp text-[10px] tracking-stamp">
                {lastError.code}:
              </span>{' '}
              {lastError.message}
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="mx-auto mt-4 block font-serif text-[12px] text-ink-faint hover:underline"
          >
            ← покинуть шлюпку
          </button>
        </motion.div>
      </div>
    </main>
  )
}
