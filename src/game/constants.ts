// Игровые константы. Источник истины — docs/game-rules.md.
// TODO (open question): casing идентификаторов персонажей и припасов
// (snake_case vs PascalCase транслит / camelCase vs snake_case типов карт).
// До решения — используем транслит PascalCase для персонажей и camelCase для типов карт,
// как в CLAUDE.md §«Конвенции».

export const CHARACTERS = [
  { id: 'Bocman', strength: 8, survivalBonus: 4 },
  { id: 'Shket', strength: 3, survivalBonus: 9 },
  { id: 'Snob', strength: 5, survivalBonus: 7 },
  { id: 'Kapitan', strength: 7, survivalBonus: 5 },
  { id: 'Miledi', strength: 4, survivalBonus: 8 },
  { id: 'Cherpak', strength: 6, survivalBonus: 6 },
] as const

export type CharacterId = (typeof CHARACTERS)[number]['id']

// Перечень типов припасов. Точные количества — TODO, эмпирически по физической колоде.
// Когда уточним: вынести в SUPPLY_DECK_COMPOSITION (массив карт с id/type/weaponStrength/valuePoints).
export const SUPPLY_TYPES = [
  'water',
  'firstAid',
  'umbrella',
  'flare',
  'compass',
  'lifeRing',
  'oar',
  'sharkBait',
  'club',
  'hook',
  'knife',
  'money',
  'jewelry',
  'painting',
] as const

export type SupplyType = (typeof SUPPLY_TYPES)[number]

// Точные числа уточнить эмпирически. См. game-rules.md §6 (TODO-сноска).
export const SUPPLY_PROPS: Record<
  SupplyType,
  {
    singleUse: boolean
    isWeapon: boolean
    isValuable: boolean
    // TODO: уточнить значения по карте
    weaponStrength?: number
    valuePoints?: number
  }
> = {
  water: { singleUse: true, isWeapon: false, isValuable: false },
  firstAid: { singleUse: true, isWeapon: false, isValuable: false },
  umbrella: { singleUse: false, isWeapon: false, isValuable: false },
  flare: { singleUse: true, isWeapon: true, isValuable: false /* TODO weaponStrength */ },
  compass: { singleUse: false, isWeapon: false, isValuable: false },
  lifeRing: { singleUse: false, isWeapon: false, isValuable: false },
  oar: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 1 },
  sharkBait: { singleUse: true, isWeapon: false, isValuable: false },
  club: { singleUse: false, isWeapon: true, isValuable: false /* TODO weaponStrength */ },
  hook: { singleUse: false, isWeapon: true, isValuable: false, weaponStrength: 4 },
  knife: { singleUse: false, isWeapon: true, isValuable: false /* TODO weaponStrength */ },
  money: { singleUse: false, isWeapon: false, isValuable: true /* TODO valuePoints */ },
  jewelry: { singleUse: false, isWeapon: false, isValuable: true /* TODO valuePoints */ },
  painting: { singleUse: false, isWeapon: false, isValuable: true /* TODO valuePoints */ },
}

// Размеры колод (по правилам)
export const SUPPLY_DECK_SIZE = 42
export const NAVIGATION_DECK_SIZE = 24

// Жетоны
export const TOTAL_SEAGULL_TOKENS = 4
export const TOTAL_FATIGUE_TOKENS = 12
export const TOTAL_WOUND_TOKENS = 24

// Множители за ценности при подсчёте очков
export const VALUE_MULTIPLIERS: Record<CharacterId, Partial<Record<SupplyType, number>>> = {
  Bocman: {},
  Shket: {},
  Snob: { painting: 2 },
  Kapitan: { money: 2 },
  Miledi: { jewelry: 2 },
  Cherpak: {},
}
