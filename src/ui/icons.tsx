/**
 * Каталог SVG-иконок проекта. Все в едином стиле: чернильные штрихи,
 * stroke=currentColor, strokeWidth=1.5, viewBox 0 0 24 24.
 * См. docs/design-roadmap.md §7.
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

// === Морские / навигационные ===

export function AnchorIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14" />
      <path d="M8 11h8" />
      <path d="M5 16c0 3 3 5 7 5s7-2 7-5" />
      <path d="M3 17l2-1" />
      <path d="M21 17l-2-1" />
    </svg>
  )
}

export function ProwIcon(p: IconProps) {
  // Острый нос лодки, профиль слева.
  return (
    <svg {...base(p)}>
      <path d="M3 12 L20 7 L20 17 Z" />
      <path d="M20 7 v10" />
      <path d="M5 14 q3 1 6 0" />
    </svg>
  )
}

export function WheelIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M5 5l2 2" />
      <path d="M17 17l2 2" />
      <path d="M19 5l-2 2" />
      <path d="M7 17l-2 2" />
    </svg>
  )
}

export function CompassIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 L14 12 L12 17 L10 12 Z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SeagullIcon(p: IconProps) {
  // Силуэт летящей чайки: тело по центру, два крыла-«дуги» с лёгким изломом.
  return (
    <svg {...base(p)}>
      <path d="M2 13 Q5 9 7.5 11 Q10 13 12 11" />
      <path d="M22 13 Q19 9 16.5 11 Q14 13 12 11" />
      <path d="M12 11 q-0.4 1.2 0 2.2 q0.4 -1 0 -2.2 Z" fill="currentColor" stroke="none" />
      <path d="M11.6 13.2 q0.4 0.6 0.8 0" />
    </svg>
  )
}

// === Карты припасов ===

export function WaterDropIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3 C8 9 6 13 6 16 a6 6 0 0 0 12 0 C18 13 16 9 12 3 Z" />
      <path d="M9 16 a3 3 0 0 0 3 3" />
    </svg>
  )
}

export function FirstAidIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
      <path d="M9 3h6v3H9z" />
    </svg>
  )
}

export function UmbrellaIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 12 a9 6 0 0 1 18 0 Z" />
      <path d="M12 12v8" />
      <path d="M12 20 a2 2 0 0 0 4 0" />
      <path d="M8 12 q0 -2 4 -2 q4 0 4 2" />
    </svg>
  )
}

export function FlareIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 18 L10 14 L14 18" />
      <path d="M10 14 L10 6" />
      <path d="M10 6 L8 4 M10 6 L12 4 M10 6 L10 2" />
      <path d="M16 10 L20 8" />
      <path d="M16 14 L20 14" />
      <path d="M16 18 L20 20" />
    </svg>
  )
}

export function LifeRingIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 4 v3" />
      <path d="M12 17 v3" />
      <path d="M4 12 h3" />
      <path d="M17 12 h3" />
    </svg>
  )
}

export function OarIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <ellipse cx="6.5" cy="6.5" rx="3.5" ry="2.5" transform="rotate(-45 6.5 6.5)" />
      <path d="M8.5 8.5 L20 20" />
    </svg>
  )
}

export function SharkBaitIcon(p: IconProps) {
  // Акулий плавник над волной.
  return (
    <svg {...base(p)}>
      <path d="M8 16 L12 6 L14 16" />
      <path d="M2 18 Q5 16 8 18 Q11 20 14 18 Q17 16 20 18 Q23 20 22 18" />
    </svg>
  )
}

// === Оружие ===

export function ClubIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 18 L14 10" />
      <path d="M14 4 C18 4 20 6 20 10 C20 14 18 16 14 16 C12 16 10 15 9 14 L14 9 C15 8 16 8 17 9" />
    </svg>
  )
}

export function HookIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3 v8" />
      <path d="M12 11 a4 4 0 1 0 -4 4" />
      <circle cx="12" cy="3" r="1.5" />
    </svg>
  )
}

export function KnifeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 21 L13 11" />
      <path d="M13 11 L18 6 L21 3 L21 9 L16 14 Z" />
      <path d="M13 11 L8 16" />
    </svg>
  )
}

// === Ценности ===

export function CoinIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8 v8" />
      <path d="M14 8 v8" />
      <path d="M10 10 h4" />
      <path d="M10 14 h4" />
    </svg>
  )
}

export function GemIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9 L12 3 L18 9 L12 21 Z" />
      <path d="M6 9 L18 9" />
      <path d="M12 3 L9 9 L12 21" />
      <path d="M12 3 L15 9 L12 21" />
    </svg>
  )
}

export function PaintingIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <rect x="5" y="6" width="14" height="12" />
      <path d="M5 16 L9 12 L13 15 L19 9" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  )
}

// === Статусы ===

export function SkullIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9 a6 6 0 1 1 12 0 v4 a2 2 0 0 1 -2 2 h-1 v3 h-6 v-3 h-1 a2 2 0 0 1 -2 -2 Z" />
      <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1.2" fill="currentColor" stroke="none" />
      <path d="M11 15 L12 17 L13 15" />
    </svg>
  )
}

export function CrossedBladesIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 3 L13 13 L15 11 L5 5 Z" fill="currentColor" stroke="currentColor" />
      <path d="M21 3 L11 13 L9 11 L19 5 Z" fill="currentColor" stroke="currentColor" />
      <path d="M9 17 L7 21" />
      <path d="M15 17 L17 21" />
    </svg>
  )
}

export function PicklockIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="6" cy="18" r="3" />
      <path d="M8 16 L20 4" />
      <path d="M16 4 L20 4 L20 8" />
      <path d="M14 6 L18 10" />
    </svg>
  )
}

// === Журнал / интерфейс ===

export function ScrollIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 4 h11 a3 3 0 0 1 3 3 v13 a2 2 0 0 1 -2 2 h-11 a3 3 0 0 1 -3 -3 v-12 a3 3 0 0 1 3 -3 Z" />
      <path d="M5 4 a3 3 0 0 0 0 6 h2 v-6" />
      <path d="M9 9 h7" />
      <path d="M9 13 h7" />
      <path d="M9 17 h5" />
    </svg>
  )
}

export function WaxSealIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path
        d="M12 3 L14 5 L17 4 L17 7 L20 9 L18 12 L20 15 L17 17 L17 20 L14 19 L12 21 L10 19 L7 20 L7 17 L4 15 L6 12 L4 9 L7 7 L7 4 L10 5 Z"
        fill="currentColor"
        stroke="currentColor"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="rgba(255,255,255,0.6)" />
    </svg>
  )
}

export function QuillIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 4 Q14 5 9 10 Q5 14 4 20" />
      <path d="M9 10 Q11 13 14 14" />
      <path d="M4 20 L8 20" />
      <path d="M4 20 L4 16" />
    </svg>
  )
}

export function InfoIcon({ size = 20, ...rest }: IconProps) {
  // «i»-символ без внешнего круга (его рисует кнопка-обёртка).
  // Крупная точка сверху + жирная палочка снизу — читается даже при 14px.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="12" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <path d="M12 11 v10" />
    </svg>
  )
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
    </svg>
  )
}

// === Утилитарные ===

export function ChevronUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 15 L12 9 L18 15" />
    </svg>
  )
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5 v14" />
      <path d="M5 12 h14" />
    </svg>
  )
}

export function FistIcon(p: IconProps) {
  // Сжатый кулак — маркер «жажду получают бойцы» на картах навигации.
  return (
    <svg {...base(p)}>
      {/* Четыре пальца */}
      <rect x="6" y="5" width="2.8" height="6" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="9.6" y="4" width="2.8" height="7" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="13.2" y="5" width="2.8" height="6" rx="1.4" fill="currentColor" stroke="none" />
      {/* Ладонь */}
      <rect x="5" y="10" width="14" height="7" rx="2" fill="currentColor" stroke="none" />
      {/* Большой палец */}
      <path d="M5 13 Q3 13 3 15 Q3 17 5 17" fill="currentColor" stroke="none" />
    </svg>
  )
}

// === Каталог: supplyType → иконка ===

import type { SupplyType } from '@/game/constants'
import type { ComponentType } from 'react'

export const SUPPLY_ICON: Record<SupplyType, ComponentType<IconProps>> = {
  water: WaterDropIcon,
  first_aid: FirstAidIcon,
  umbrella: UmbrellaIcon,
  flare: FlareIcon,
  compass: CompassIcon,
  life_ring: LifeRingIcon,
  oar: OarIcon,
  shark_bait: SharkBaitIcon,
  club: ClubIcon,
  hook: HookIcon,
  knife: KnifeIcon,
  money: CoinIcon,
  jewelry: GemIcon,
  painting: PaintingIcon,
}

// === Персонажи: SVG-иконки (fallback и значок-маркер на карте) ===

export function BocmanIcon(p: IconProps) {
  // Боцман — крепкий мужчина в фуражке с якорной кокардой.
  return (
    <svg {...base(p)}>
      <path d="M5 9 q0 -3 7 -3 q7 0 7 3 l1 1 H4 Z" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M7 11 v2 a5 4 0 0 0 10 0 v-2" />
      <path d="M7 16 q5 3 10 0" />
      <path d="M9 19 v3 M15 19 v3" />
    </svg>
  )
}

export function ShketIcon(p: IconProps) {
  // Шкет — мальчишка с торчащими волосами и кепкой набок.
  return (
    <svg {...base(p)}>
      <path d="M6 10 q0 -4 6 -4 q6 0 6 4 l2 0" />
      <path d="M6 10 q6 -1 12 0 v1 a6 5 0 0 1 -12 0 Z" />
      <path d="M8 14 q4 3 8 0" />
      <path d="M10 9 v-2 M12 9 v-3 M14 9 v-2" />
      <path d="M9 18 v4 M15 18 v4" />
    </svg>
  )
}

export function SnobIcon(p: IconProps) {
  // Сноб — цилиндр и монокль.
  return (
    <svg {...base(p)}>
      <rect x="7" y="2" width="10" height="6" />
      <path d="M5 8 h14" />
      <circle cx="12" cy="13" r="4" />
      <circle cx="14.5" cy="12.5" r="1.5" />
      <path d="M16 13 l2 2" />
      <path d="M8 17 q4 3 8 0" />
      <path d="M9 18 v4 M15 18 v4" />
    </svg>
  )
}

export function KapitanIcon(p: IconProps) {
  // Капитан — фуражка с козырьком, борода клинышком.
  return (
    <svg {...base(p)}>
      <path d="M4 8 q8 -4 16 0 l-2 2 H6 Z" />
      <path d="M11 7 l1 -1 l1 1" />
      <path d="M6 10 v2 a6 4 0 0 0 12 0 v-2" />
      <path d="M10 14 l2 4 l2 -4" />
      <path d="M8 16 q4 1 8 0" />
      <path d="M9 19 v3 M15 19 v3" />
    </svg>
  )
}

export function MilediIcon(p: IconProps) {
  // Миледи — голова с вуалью / шляпкой и длинными волосами.
  return (
    <svg {...base(p)}>
      <path d="M5 9 q0 -5 7 -5 q7 0 7 5" />
      <path d="M3 10 q9 -3 18 0" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M9 14 q-2 4 -2 8 M15 14 q2 4 2 8" />
      <path d="M10 16 q2 1 4 0" />
    </svg>
  )
}

export function CherpakIcon(p: IconProps) {
  // Черпак — простой парень с ведром (черпает воду из лодки).
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="6" r="3" />
      <path d="M5 13 q4 -3 8 0 v4 H5 Z" />
      <path d="M7 17 v4 M11 17 v4" />
      <path d="M14 11 h6 l-1 8 h-4 Z" />
      <path d="M14 11 q3 -2 6 0" />
    </svg>
  )
}

import type { CharacterId } from '@/game/constants'

export const CHARACTER_ICON: Record<CharacterId, ComponentType<IconProps>> = {
  bocman: BocmanIcon,
  shket: ShketIcon,
  snob: SnobIcon,
  kapitan: KapitanIcon,
  miledi: MilediIcon,
  cherpak: CherpakIcon,
}

// === Каталог: supplyType → русское название ===

export const SUPPLY_NAME: Record<SupplyType, string> = {
  water: 'Вода',
  first_aid: 'Аптечка',
  umbrella: 'Зонт',
  flare: 'Ракетница',
  compass: 'Компас',
  life_ring: 'Спас. круг',
  oar: 'Весло',
  shark_bait: 'Приманка',
  club: 'Дубинка',
  hook: 'Багор',
  knife: 'Нож',
  money: 'Деньги',
  jewelry: 'Украшения',
  painting: 'Картина',
}
