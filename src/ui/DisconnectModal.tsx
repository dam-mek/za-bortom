import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/store/game-store'
import { AnchorIcon, QuillIcon } from './icons'

/**
 * DisconnectModal — «порванная телеграмма». См. docs/design-roadmap.md §13.
 */
export function DisconnectModal() {
  const disconnected = useGameStore((s) => s.disconnected)
  const reset = useGameStore((s) => s.reset)

  return (
    <AnimatePresence>
      {disconnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: -30, rotate: -2, opacity: 0 }}
            animate={{ y: 0, rotate: -1.5, opacity: 1 }}
            exit={{ y: 20, rotate: 2, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="relative w-full max-w-md text-ink"
            style={{
              filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.45))',
            }}
          >
            {/* SVG-маска порванной телеграммы. Используем clipPath с зубчатым краем. */}
            <svg width="0" height="0" className="absolute">
              <defs>
                <clipPath id="torn-telegram" clipPathUnits="objectBoundingBox">
                  <path d="M 0,0.02 L 0.05,0 L 0.10,0.025 L 0.18,0.005 L 0.26,0.03 L 0.35,0.01 L 0.44,0.025 L 0.52,0.005 L 0.61,0.03 L 0.70,0.012 L 0.78,0.028 L 0.87,0.008 L 0.94,0.025 L 1,0.015 L 1,0.985 L 0.94,0.965 L 0.87,0.99 L 0.78,0.97 L 0.7,0.992 L 0.61,0.97 L 0.52,0.995 L 0.44,0.97 L 0.35,0.99 L 0.26,0.965 L 0.18,0.99 L 0.1,0.97 L 0.05,0.995 L 0,0.98 Z" />
                </clipPath>
              </defs>
            </svg>

            <div
              className="relative px-7 py-7"
              style={{
                clipPath: 'url(#torn-telegram)',
                background:
                  'linear-gradient(180deg, #f3e9d2 0%, #e7d5af 50%, #d9c8a0 100%)',
              }}
            >
              {/* Зернистость / штемпеля. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                }}
              />

              <div className="relative">
                <div className="flex items-center justify-between border-b border-dashed border-ink/40 pb-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-faint">
                    телеграмма · радиограф №42
                  </span>
                  <span className="font-mono text-[9px] text-ink-faint">⁂ ⁂ ⁂</span>
                </div>

                {/* Большой штамп СВЯЗЬ ОБОРВАНА. */}
                <motion.div
                  initial={{ scale: 0.9, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: -6, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="my-4 inline-block rotate-[-6deg] rounded-sm border-[3px] border-card-enemy-deep bg-card-enemy/20 px-3 py-1"
                  style={{
                    boxShadow:
                      'inset 0 0 0 1px rgba(140,44,61,0.45), 2px 2px 0 rgba(140,44,61,0.25)',
                  }}
                >
                  <span className="font-stamp text-[24px] tracking-stamp text-card-enemy-deep">
                    СВЯЗЬ ОБОРВАНА
                  </span>
                </motion.div>

                <div className="space-y-2 font-hand text-[20px] leading-snug text-ink">
                  <p>Капитан исчез из эфира. Шлюпка дрейфует одна.</p>
                </div>

                <ul className="mt-3 space-y-1 font-serif text-[12px] italic text-ink-faint">
                  <li>— хост закрыл вкладку или выключил компьютер</li>
                  <li>— разрыв соединения у хоста</li>
                  <li>— WebRTC не пробился сквозь NAT/firewall</li>
                </ul>

                <div className="mt-4 border-t border-dashed border-ink/40 pt-2 font-serif text-[11px] italic text-ink-faint">
                  Host migration в этой версии не реализован — партия завершена.
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                    <QuillIcon size={11} />
                    радист
                  </span>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-card-enemy-deep bg-card-enemy px-4 py-1.5 font-stamp text-[11px] tracking-stamp text-paper shadow-emboss transition hover:brightness-110"
                  >
                    <AnchorIcon size={14} />
                    НА БЕРЕГ
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
