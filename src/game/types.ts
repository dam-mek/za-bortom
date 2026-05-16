// Базовые типы GameState. Источник истины — docs/game-spec.md (с резолюциями из decisions.md).
// На Фазе 1 — структуры данных без обработчиков; подфазы day/evening/fight стоят минимальные.

import type { CharacterId, SupplyType } from './constants'
import type { RngState } from './prng'

// ---------- Идентификаторы ----------

export type PlayerId = string
export type SeatIndex = number
export type SupplyInstanceId = string
export type NavCardInstanceId = string

export type Consciousness = 'conscious' | 'unconscious' | 'dead'

// ---------- Карты ----------

export interface SupplyCard {
  readonly id: SupplyInstanceId
  readonly kind: SupplyType
  /** Только у оружия (oar/club/knife/hook/flare). */
  readonly weaponStrength?: number
  /** Только у ценностей (money/jewelry/painting). */
  readonly valuePoints?: number
  readonly singleUse: boolean
  readonly isWeapon: boolean
  readonly isValuable: boolean
}

// Карта навигации. thirst — композиция: { rowers, fighters, named[] } (см. decisions.md #6).
export type SeagullEffect = 'none' | 'normal' | 'crossed'

export interface ThirstEffect {
  readonly rowers: boolean
  readonly fighters: boolean
  readonly named: CharacterId[]
}

export interface NavigationCard {
  readonly id: NavCardInstanceId
  readonly seagull: SeagullEffect
  /** Персонажи, которые падают за борт. Пустой массив = никто. */
  readonly overboard: CharacterId[]
  readonly thirst: ThirstEffect
}

// ---------- Игрок и банка ----------

export interface Player {
  readonly id: PlayerId
  readonly displayName: string
  readonly isBot: boolean
  readonly character: CharacterId
  // Приватные карты — фильтруются для других игроков через visibility.ts
  readonly bestFriend: CharacterId
  readonly worstEnemy: CharacterId
  readonly consciousness: Consciousness
  readonly wounds: number
  /** Грёб ли сегодня (для thirst.rowers и для лога). */
  readonly rowed: boolean
  /** Дрался ли сегодня (для thirst.fighters). */
  readonly fought: boolean
  readonly openSupplies: SupplyInstanceId[]
  /** Содержимое приватно; снаружи — только длина. */
  readonly closedSupplies: SupplyInstanceId[]
  readonly hasUsedShketSteal: boolean
  readonly disconnected: boolean
}

export interface Seat {
  readonly index: SeatIndex
  /** null = персонаж убран при 4/5 игроках. */
  readonly occupantId: PlayerId | null
  /** true если банка целиком убрана из лодки. */
  readonly removed: boolean
}

// ---------- Фазы (минимум для Фазы 1) ----------

export type Phase =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'setup' }
  | { readonly kind: 'morning'; readonly subPhase: MorningSubPhase }
  | { readonly kind: 'day'; readonly subPhase: DaySubPhase }
  | { readonly kind: 'evening'; readonly subPhase: EveningSubPhase }
  | { readonly kind: 'scoring' }
  | { readonly kind: 'finished' }

export type MorningSubPhase =
  | { readonly kind: 'distributing'; readonly currentSeat: SeatIndex; readonly pile: SupplyInstanceId[] }
  | { readonly kind: 'done' }

export type DaySubPhase =
  | { readonly kind: 'waitingForAction'; readonly currentSeat: SeatIndex }
  | {
      readonly kind: 'rowing'
      readonly playerId: PlayerId
      readonly drawn: NavCardInstanceId[]
    }
  | {
      readonly kind: 'awaitingSwapResponse'
      readonly attackerId: PlayerId
      readonly targetSeat: SeatIndex
    }
  | {
      readonly kind: 'awaitingRobResponse'
      readonly attackerId: PlayerId
      readonly targetSeat: SeatIndex
    }
  | { readonly kind: 'completingRobPick'; readonly attackerId: PlayerId; readonly targetSeat: SeatIndex }
  | { readonly kind: 'fight'; readonly fight: FightState }

export interface FightState {
  readonly reason: 'swap' | 'rob'
  readonly attackerId: PlayerId
  readonly defenderId: PlayerId
  /** Банка, за которую сражение (место для свопа или место жертвы при ограблении). */
  readonly targetSeat: SeatIndex
  readonly attackerAllies: PlayerId[]
  readonly defenderAllies: PlayerId[]
  readonly attackerWeapons: SupplyInstanceId[]
  readonly defenderWeapons: SupplyInstanceId[]
  /** Активный приглашённый союзник, ждущий FIGHT_ALLY_RESPONSE. */
  readonly pendingAlly: { invitedId: PlayerId; side: 'attacker' | 'defender' } | null
  readonly recruitmentClosed: boolean
}

export type EveningSubPhase =
  | {
      readonly kind: 'sternPicking'
      readonly pickerId: PlayerId
      readonly pool: NavCardInstanceId[]
      readonly compassUsed: boolean
    }
  | {
      readonly kind: 'resolving'
      readonly cardId: NavCardInstanceId
      readonly step: ResolveStep
    }

/** Шаг разрешения карты навигации. См. rules/evening.ts. */
export type ResolveStep =
  | {
      readonly kind: 'overboardLifeRing'
      /** Очередь решений для падающих с закрытым кругом (head = текущий). */
      readonly pendingChars: CharacterId[]
      /** Те, кто гарантированно упадёт (нет круга или отказались). */
      readonly confirmedOverboard: CharacterId[]
    }
  | {
      readonly kind: 'sharkBait'
      readonly overboardChars: CharacterId[]
      /** Очередь conscious-владельцев открытой приманки (head = текущий). */
      readonly ownerQueue: PlayerId[]
    }
  | {
      readonly kind: 'thirst'
      /** Очередь персонажей с оставшимися ранениями от жажды. */
      readonly queue: ReadonlyArray<{ readonly char: CharacterId; readonly remainingWounds: number }>
      /** Кто уже применил защиту зонтика этим вечером (1 за вечер на персонажа). */
      readonly umbrellaUsedBy: readonly CharacterId[]
    }

// Старый алиас сохраняем для совместимости — теперь не используется.
export type NavResolveStep = ResolveStep

// ---------- События / ошибки ----------

export interface GameEvent {
  readonly timestamp: number
  readonly kind: string
  readonly payload: unknown
  readonly visibleTo: PlayerId[] | 'all'
}

export type ErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'UNCONSCIOUS_OR_DEAD'
  | 'CARD_NOT_OWNED'
  | 'CARD_NOT_OPEN'
  | 'CARD_ALREADY_OPEN'
  | 'INVALID_TARGET'
  | 'EMPTY_DECK'
  | 'ALREADY_USED_ABILITY'
  | 'NOT_ALLOWED_DURING_FIGHT'
  | 'INVALID_ACTION_SHAPE'
  | 'GAME_FINISHED'
  | 'NOT_HOST'
  | 'GAME_NOT_STARTED'
  | 'UNKNOWN_ACTION'
  | 'BUSINESS_RULE_VIOLATION'

export interface GameError {
  readonly kind: 'GameError'
  readonly code: ErrorCode
  readonly message: string
  readonly hint?: string
}

// ---------- Подсчёт очков ----------

export interface ValuableScore {
  readonly kind: SupplyType
  readonly value: number
}

export interface ScoreBreakdown {
  readonly survival: number
  readonly survivalReason: 'dead' | 'alive_normal' | 'alive_narcissist' | 'alive_psychopath' | 'alive_both'
  readonly valuables: ValuableScore[]
  readonly bestFriendBonus: { readonly friendId: CharacterId; readonly alive: boolean; readonly points: number } | null
  readonly worstEnemyBonus: { readonly enemyId: CharacterId; readonly alive: boolean; readonly points: number } | null
  readonly psychopathDeathBonus: { readonly count: number; readonly points: number }
  readonly total: number
}

// ---------- GameState ----------

export interface GameState {
  readonly gameId: string
  readonly hostId: PlayerId
  readonly seed: number
  readonly rng: RngState
  /** Игровые дни 1, 2, 3... (0 в lobby/setup). */
  readonly day: number

  // Игроки и места
  readonly players: Record<PlayerId, Player>
  readonly seats: Seat[] // отсортированы по index, длина = 6 (некоторые .removed для 4/5 игроков)
  readonly removedCharacters: CharacterId[]

  // Колоды (массивы id; полные данные в supplyById / navById)
  readonly supplyDeck: SupplyInstanceId[]
  readonly supplyDiscard: SupplyInstanceId[]
  readonly navDeck: NavCardInstanceId[]
  readonly navDiscard: NavCardInstanceId[]
  /** Карты «от гребцов», накапливаются за день, разыгрываются вечером. */
  readonly navPool: NavCardInstanceId[]

  readonly supplyById: Record<SupplyInstanceId, SupplyCard>
  readonly navById: Record<NavCardInstanceId, NavigationCard>

  // Жетоны
  readonly seagullTokens: number

  // Фаза и порядок ходов
  readonly phase: Phase
  /** Снимок порядка банок на момент начала дня. */
  readonly turnOrder: SeatIndex[]
  readonly currentTurnIndex: number
  readonly dayActionsTaken: Record<PlayerId, boolean>

  // Лог
  readonly log: GameEvent[]

  // Финал
  readonly winner: PlayerId | 'sea' | 'tie' | null
  readonly finalScores: Record<PlayerId, ScoreBreakdown> | null
}

// ---------- Reducer contract ----------

export type ReducerResult =
  | { readonly ok: true; readonly state: GameState; readonly events: GameEvent[] }
  | { readonly ok: false; readonly error: GameError }

// ---------- Filtered view (для сети) ----------

/** Игрок с точки зрения зрителя. Для других игроков friend/enemy скрыты. */
export interface FilteredPlayer extends Omit<Player, 'bestFriend' | 'worstEnemy'> {
  /** Для self — известно; для других — null (раскрывается в финале). */
  readonly bestFriend: CharacterId | null
  readonly worstEnemy: CharacterId | null
}

/**
 * Отфильтрованное состояние для конкретного игрока. Не содержит rng, скрывает
 * содержимое чужих закрытых карт, колод и приватных pile/pool.
 * См. docs/visibility-model.md.
 */
export interface FilteredGameState extends Omit<GameState, 'players' | 'rng' | 'supplyById' | 'navById'> {
  readonly viewerId: PlayerId
  readonly players: Record<PlayerId, FilteredPlayer>
  /** Только записи карт, которые viewer может видеть. */
  readonly supplyById: Record<SupplyInstanceId, SupplyCard>
  readonly navById: Record<NavCardInstanceId, NavigationCard>
}

// Реэкспорт чтобы потребители брали из одного места
export type { CharacterId, FatigueSide, SupplyType } from './constants'
