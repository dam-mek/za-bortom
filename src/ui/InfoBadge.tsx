import { useId, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { InfoIcon } from '@/ui/icons'
import type { TooltipContent } from '@/ui/card-tooltips'

/**
 * Маленький кружок «i» в углу карты. Hover (desktop) / tap (touch) — показывает
 * tooltip с описанием. См. docs/design-roadmap.md §8.
 *
 * Tooltip рендерится через React Portal в document.body, чтобы не обрезаться
 * родительскими `overflow: hidden` (карты, контейнеры). Позиция вычисляется
 * относительно badge'а через getBoundingClientRect.
 *
 * Tooltip остаётся открытым, пока курсор находится на кнопке ИЛИ на самом
 * tooltip'е (общий wrapper-state). Это убирает мигание при переходе мыши
 * с иконки на подсказку.
 */
export function InfoBadge({
  content,
  className = '',
  size = 18,
}: {
  content: TooltipContent
  className?: string
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const id = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showing = open || pinned

  // Позиционирование tooltip относительно badge'а.
  useLayoutEffect(() => {
    if (!showing) return
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const TOOLTIP_W = 288 // w-72
    // Выравниваем правый край tooltip с правым краем badge'а.
    let left = rect.right - TOOLTIP_W
    // Если уходит за левый край экрана — сдвигаем.
    if (left < 8) left = 8
    // Если правый край за пределами — тоже корректируем.
    if (left + TOOLTIP_W > window.innerWidth - 8) {
      left = window.innerWidth - TOOLTIP_W - 8
    }
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: left + window.scrollX,
    })
  }, [showing])

  // Закрытие пинованного tooltip'а по клику снаружи.
  useEffect(() => {
    if (!pinned) return
    function onClick(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !tooltipRef.current?.contains(t)) {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pinned])

  const tooltipNode =
    showing && pos
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={tooltipRef}
              id={id}
              role="tooltip"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                width: 288,
                zIndex: 9999,
              }}
              className="rounded-sm border border-ink/40 bg-paper p-3.5 text-ink shadow-journal"
            >
              <div className="font-stamp text-[14px] tracking-stamp text-ink">
                {content.title}
              </div>
              {content.subtitle && (
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  {content.subtitle}
                </div>
              )}
              <div className="mt-2 font-serif text-[14px] leading-snug text-ink">
                {content.body}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-describedby={showing ? id : undefined}
        aria-label="Подсказка"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((p) => !p)
        }}
        className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-paper text-ink shadow-sm transition hover:bg-accent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ width: size + 8, height: size + 8 }}
      >
        <InfoIcon size={size - 4} />
      </button>
      {tooltipNode}
    </span>
  )
}
