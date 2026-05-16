import { useEffect } from 'react'
import { useGameStore } from '@/store/game-store'
import type { Phase } from '@/game/types'

export type AtmosphereKind = 'morning' | 'day' | 'evening' | 'night' | 'neutral'

// Палитра CSS-переменных по атмосфере. См. docs/design-roadmap.md §3.
//
// Базовая модель:
//   --bg-page   — цвет «страницы за бортом»: море/небо, доминирует визуально.
//   --bg-paper  — цвет «бумаги журнала»: карты, панели, инвентарь. Остаётся пергаментом.
//
// Атмосфера меняет --bg-page сильно (как в макете — день = яркий cyan),
// и слегка подкрашивает --bg-paper для согласованности.
const ATMOS_PALETTES: Record<AtmosphereKind, Record<string, string>> = {
  morning: {
    '--bg-page': '#f0a040',
    '--bg-page-deep': '#d97a2a',
    '--bg-paper': '#f8e8c8',
    '--bg-paper-deep': '#d9b87a',
    '--ink': '#2a1f12',
    '--ink-faint': '#6b5535',
    '--atmos-tint': '#f0a040',
    '--atmos-tint-soft': 'rgba(240, 160, 64, 0.30)',
    '--atmos-tint-deep': 'rgba(240, 160, 64, 0.65)',
    '--atmos-fog': 'rgba(255, 220, 150, 0.15)',
  },
  day: {
    '--bg-page': '#0EA5E9',
    '--bg-page-deep': '#0879b3',
    '--bg-paper': '#f1e6cf',
    '--bg-paper-deep': '#d9c8a0',
    '--ink': '#1a2438',
    '--ink-faint': '#4a5572',
    '--atmos-tint': '#0EA5E9',
    '--atmos-tint-soft': 'rgba(14, 165, 233, 0.35)',
    '--atmos-tint-deep': 'rgba(14, 165, 233, 0.80)',
    '--atmos-fog': 'rgba(255, 255, 255, 0)',
  },
  evening: {
    '--bg-page': '#2a276f',
    '--bg-page-deep': '#15113a',
    '--bg-paper': '#d8c8a8',
    '--bg-paper-deep': '#93805d',
    '--ink': '#1f1a35',
    '--ink-faint': '#5a4d75',
    '--atmos-tint': '#3F3DA8',
    '--atmos-tint-soft': 'rgba(63, 61, 168, 0.40)',
    '--atmos-tint-deep': 'rgba(63, 61, 168, 0.75)',
    '--atmos-fog': 'rgba(180, 170, 200, 0.40)',
  },
  night: {
    '--bg-page': '#06080f',
    '--bg-page-deep': '#020308',
    '--bg-paper': '#1a1530',
    '--bg-paper-deep': '#0a0b14',
    '--ink': '#e8dcc0',
    '--ink-faint': '#9c8f7a',
    '--atmos-tint': '#0a0b14',
    '--atmos-tint-soft': 'rgba(10, 11, 20, 0.55)',
    '--atmos-tint-deep': 'rgba(10, 11, 20, 0.85)',
    '--atmos-fog': 'rgba(0, 0, 0, 0)',
  },
  neutral: {
    '--bg-page': '#cdb88a',
    '--bg-page-deep': '#a08c5d',
    '--bg-paper': '#f1e6cf',
    '--bg-paper-deep': '#d9c8a0',
    '--ink': '#1a2438',
    '--ink-faint': '#4a5572',
    '--atmos-tint': '#7a98b8',
    '--atmos-tint-soft': 'rgba(122, 152, 184, 0.20)',
    '--atmos-tint-deep': 'rgba(122, 152, 184, 0.50)',
    '--atmos-fog': 'rgba(255, 248, 230, 0.08)',
  },
}

export function phaseToAtmosphere(phase: Phase | undefined | null): AtmosphereKind {
  if (!phase) return 'neutral'
  switch (phase.kind) {
    case 'lobby':
    case 'setup':
      return 'neutral'
    case 'morning':
      return 'morning'
    case 'day':
      return 'day'
    case 'evening':
      return 'evening'
    case 'scoring':
    case 'finished':
      return 'night'
  }
}

/**
 * Устанавливает CSS-переменные на <html> в зависимости от фазы.
 * Бережно держит transition в CSS (см. index.css).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const phase = useGameStore((s) => s.state?.phase)
  const atmosphere = phaseToAtmosphere(phase ?? null)

  useEffect(() => {
    const root = document.documentElement
    const palette = ATMOS_PALETTES[atmosphere]
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value)
    }
    root.dataset.atmosphere = atmosphere
  }, [atmosphere])

  return <>{children}</>
}

export function useAtmosphere(): AtmosphereKind {
  const phase = useGameStore((s) => s.state?.phase)
  return phaseToAtmosphere(phase ?? null)
}
