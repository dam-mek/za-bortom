// Игровые константы. Источник истины — docs/game-rules.md.
// Нейминг согласно docs/decisions.md:
//   персонажи  — camelCase транслит
//   типы карт  — snake_case

export const CHARACTERS = [
  { id: 'bocman', strength: 8, survivalBonus: 4 },
  { id: 'shket', strength: 3, survivalBonus: 9 },
  { id: 'snob', strength: 5, survivalBonus: 7 },
  { id: 'kapitan', strength: 7, survivalBonus: 5 },
  { id: 'miledi', strength: 4, survivalBonus: 8 },
  { id: 'cherpak', strength: 6, survivalBonus: 6 },
] as const

export type CharacterId = (typeof CHARACTERS)[number]['id']

// Точные количества карт каждого типа — TODO, эмпирически по физической колоде.
// Когда уточним: вынести в SUPPLY_DECK_COMPOSITION (массив карт с id/type/weaponStrength/valuePoints).
export const SUPPLY_TYPES = [
  'water',
  'first_aid',
  'umbrella',
  'flare',
  'compass',
  'life_ring',
  'oar',
  'shark_bait',
  'club',
  'hook',
  'knife',
  'money',
  'jewelry',
  'painting',
] as const

export type SupplyType = (typeof SUPPLY_TYPES)[number]

// Значения weaponStrength и valuePoints — плейсхолдеры (см. decisions.md #21).
// TODO: сверить с физической колодой.
export const SUPPLY_PROPS: Record<
  SupplyType,
  {
    singleUse: boolean
    isWeapon: boolean
    isValuable: boolean
    weaponStrength?: number
    valuePoints?: number
  }
> = {
  water: { singleUse: true, isWeapon: false, isValuable: false },
  first_aid: { singleUse: true, isWeapon: false, isValuable: false },
  umbrella: { singleUse: false, isWeapon: false, isValuable: false },
  flare: { singleUse: true, isWeapon: true, isValuable: false, weaponStrength: 10 /* TODO */ },
  compass: { singleUse: false, isWeapon: false, isValuable: false },
  life_ring: { singleUse: false, isWeapon: false, isValuable: false },
  oar: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 1 },
  shark_bait: { singleUse: true, isWeapon: false, isValuable: false },
  club: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 2 /* TODO */ },
  hook: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 4 /* TODO */ },
  knife: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 3 /* TODO */ },
  money: { singleUse: false, isWeapon: false, isValuable: true, valuePoints: 1 /* TODO */ },
  jewelry: { singleUse: false, isWeapon: false, isValuable: true, valuePoints: 3 /* TODO */ },
  painting: { singleUse: false, isWeapon: false, isValuable: true, valuePoints: 2 /* TODO */ },
}

// Размеры колод (по правилам).
export const SUPPLY_DECK_SIZE = 42
export const NAVIGATION_DECK_SIZE = 24

// Жетоны.
export const TOTAL_SEAGULL_TOKENS = 4
export const TOTAL_FATIGUE_TOKENS = 12
export const TOTAL_WOUND_TOKENS = 24

// Множители за ценности при подсчёте очков (см. game-rules.md §7.3).
export const VALUE_MULTIPLIERS: Record<CharacterId, Partial<Record<SupplyType, number>>> = {
  bocman: {},
  shket: {},
  snob: { painting: 2 },
  kapitan: { money: 2 },
  miledi: { jewelry: 2 },
  cherpak: {},
}

// Таймаут ответа на swap/rob: молчание = ACCEPT (см. decisions.md #15).
export const RESPONSE_TIMEOUT_MS = 30_000

export type FatigueSide = 'rower' | 'fighter'
