/**
 * Резолвер картинок из src/assets/media. Если файла нет — возвращает null,
 * UI рендерит SVG-fallback. См. docs/design-roadmap.md §12.
 */

import type { CharacterId, SupplyType } from '@/game/constants'

type ImageMap = Record<string, string>

// Glob возвращает { path: url }. eager + ?url → строки, готовые к <img src>.
const characterImages = import.meta.glob(
  '@/assets/media/characters/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as ImageMap
const supplyImages = import.meta.glob(
  '@/assets/media/supplies/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as ImageMap
const navigationImages = import.meta.glob(
  '@/assets/media/navigation/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as ImageMap
const backgroundImages = import.meta.glob(
  '@/assets/media/backgrounds/*.{webp,png,jpg,jpeg}',
  { eager: true, query: '?url', import: 'default' },
) as ImageMap

const EXT_PRIORITY = ['webp', 'png', 'jpg', 'jpeg'] as const

function lookup(map: ImageMap, key: string): string | null {
  // Glob-ключи — полные абсолютные пути от корня проекта.
  // Ищем по подстроке /<key>.<ext> в любом из вариантов.
  for (const ext of EXT_PRIORITY) {
    const needle = `/${key}.${ext}`
    for (const [path, url] of Object.entries(map)) {
      if (path.endsWith(needle)) return url
    }
  }
  return null
}

export function getCharacterImage(id: CharacterId): string | null {
  return lookup(characterImages, id)
}

export function getSupplyImage(kind: SupplyType): string | null {
  return lookup(supplyImages, kind)
}

export function getNavImage(kind: string): string | null {
  return lookup(navigationImages, kind)
}

export type BackgroundKey = 'morning' | 'day' | 'evening' | 'night'
export function getBackgroundImage(phase: BackgroundKey): string | null {
  return lookup(backgroundImages, phase)
}
