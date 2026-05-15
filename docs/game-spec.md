> Merged from 02-game-spec.md + game-spec.md on 2026-05-15.

# Game spec — типы, Actions, reducer-contract

Технический документ. Описывает структуру `GameState`, перечень Actions и контракт reducer'а. Этого должно быть достаточно, чтобы реализовать `src/game/` без обращения к UI. Любые расхождения с [`docs/game-rules.md`](./game-rules.md) решаются в пользу game-rules.

## 1. Идентификаторы и общие типы

```ts
type PlayerId = string;            // UUID или peer-id; для ботов 'bot-1', 'bot-2'; выдаётся host'ом при join
type SeatIndex = number;           // 0..n-1, 0 = нос. (Версия A: 0 | 1 | 2 | 3 | 4 | 5)
type CardId = string;              // uuid; alias для SupplyInstanceId
type SupplyInstanceId = CardId;
type NavCardId = string;
type NavCardInstanceId = NavCardId;
type SeagullTokenId = string;
type WoundTokenId = string;
type FatigueTokenId = string;

type Consciousness = 'conscious' | 'unconscious' | 'dead';
type FatigueSide = 'rower' | 'fighter';   // или 'rowing' | 'fighting' — см. open question
```

> **Open question: терминология `FatigueSide`.**
> Версия A: `'rowing' | 'fighting'`. Версия B: `'rower' | 'fighter'`. Зафиксировать в `constants.ts`.

## 2. Персонажи (константы)

```ts
type CharacterId =
  | 'bosun' | 'cabin_boy' | 'snob' | 'captain' | 'lady' | 'cook';   // версия A
// Альтернатива (версия B): 'Bocman' | 'Shket' | 'Snob' | 'Kapitan' | 'Miledi' | 'Cherpak'
// См. open question в docs/game-rules.md §2.1

type AbilityKind =
  | 'highStrength'      // Боцман
  | 'stealClosed'       // Шкет
  | 'doublePaintings'   // Сноб
  | 'doubleMoney'       // Капитан
  | 'doubleJewelry'     // Миледи
  | 'noWoundOverboard'; // Черпак

const CHARACTERS: Record<CharacterId, Character> = {
  bosun:     { id: 'bosun',     name: 'Боцман',  strength: 8, survivalBonus: 4, ability: 'highStrength' },
  cabin_boy: { id: 'cabin_boy', name: 'Шкет',    strength: 3, survivalBonus: 9, ability: 'stealClosed' },
  snob:      { id: 'snob',      name: 'Сноб',    strength: 5, survivalBonus: 7, ability: 'doublePaintings' },
  captain:   { id: 'captain',   name: 'Капитан', strength: 7, survivalBonus: 5, ability: 'doubleMoney' },
  lady:      { id: 'lady',      name: 'Миледи',  strength: 4, survivalBonus: 8, ability: 'doubleJewelry' },
  cook:      { id: 'cook',      name: 'Черпак',  strength: 6, survivalBonus: 6, ability: 'noWoundOverboard' },
};

const POINT_MULTIPLIER_2X: Record<CharacterId, SupplyKind | null> = {
  bosun: null, cabin_boy: null,
  snob: 'painting', captain: 'money', lady: 'jewelry',
  cook: null,
};

const COOK_OVERBOARD_IMMUNITY = true;
const SHKET_CAN_STEAL_CLOSED = true;
```

## 3. Припасы

```ts
type SupplyKind =
  | 'water' | 'first_aid' | 'umbrella' | 'flare_gun'
  | 'compass' | 'life_ring' | 'oar' | 'shark_bait'
  | 'club' | 'hook' | 'knife'
  | 'money' | 'jewelry' | 'painting';
// Альтернатива (версия B): 'firstAid', 'flare', 'lifeRing', 'sharkBait' (camelCase)

interface SupplyCard {
  readonly id: SupplyInstanceId;
  readonly kind: SupplyKind;          // или type — alias
  readonly strengthBonus?: number;    // только у оружия; alias: weaponStrength
  readonly pointValue?: number;       // только у ценностей; alias: valuePoints
  readonly singleUse: boolean;
  readonly isWeapon?: boolean;        // canBeWeapon
  readonly isValuable?: boolean;
}

// Свойства типов припасов:
const SUPPLY_PROPS: Record<SupplyKind, {
  singleUse: boolean;
  canBeWeapon: boolean;
  weaponStrength?: number;
  dayActionOnly: boolean;
  reactive: boolean;
}> = {
  water:      { singleUse: true,  canBeWeapon: false, dayActionOnly: false, reactive: false },
  first_aid:  { singleUse: true,  canBeWeapon: false, dayActionOnly: true,  reactive: false },
  umbrella:   { singleUse: false, canBeWeapon: false, dayActionOnly: true,  reactive: false },
  flare_gun:  { singleUse: true,  canBeWeapon: true,  weaponStrength: 4 /*TODO уточнить*/, dayActionOnly: true, reactive: false },
  compass:    { singleUse: false, canBeWeapon: false, dayActionOnly: false, reactive: false },
  life_ring:  { singleUse: false, canBeWeapon: false, dayActionOnly: false, reactive: true },
  oar:        { singleUse: false, canBeWeapon: true,  weaponStrength: 1, dayActionOnly: false, reactive: false },
  shark_bait: { singleUse: true,  canBeWeapon: false, dayActionOnly: false, reactive: true },
  club:       { singleUse: false, canBeWeapon: true,  weaponStrength: 2 /*TODO*/, dayActionOnly: false, reactive: false },
  hook:       { singleUse: false, canBeWeapon: true,  weaponStrength: 4,           dayActionOnly: false, reactive: false },
  knife:      { singleUse: false, canBeWeapon: true,  weaponStrength: 3 /*TODO*/, dayActionOnly: false, reactive: false },
  money:      { singleUse: false, canBeWeapon: false, dayActionOnly: false, reactive: false },
  jewelry:    { singleUse: false, canBeWeapon: false, dayActionOnly: false, reactive: false },
  painting:   { singleUse: false, canBeWeapon: false, dayActionOnly: false, reactive: false },
};
```

## 4. Карты навигации

См. два варианта типизации в [`docs/game-rules.md`](./game-rules.md) §2.3. Здесь — единая структура с обоими вариантами как заметками:

```ts
type SeagullEffect = 'none' | 'normal' | 'crossed';    // вариант A
// или: seagulls: -1 | 0 | 1  (вариант B)

type OverboardTarget = CharacterId[] | 'all' | 'none'; // или просто Character[]

type ThirstTarget =
  | { type: 'characters'; list: CharacterId[] }
  | { type: 'rowers' }
  | { type: 'fighters' }
  | { type: 'none' };
// Вариант B добавляет 'rowers+named' и 'fighters+named'.

interface NavigationCard {
  readonly id: NavCardInstanceId;
  readonly seagull: SeagullEffect;          // или seagulls: -1 | 0 | 1
  readonly overboard: OverboardTarget;
  readonly thirst: ThirstTarget;
}

// Точный состав 24 карт навигации — TODO, заполнить эмпирически в fixtures.ts
```

## 5. Player, Seat, RoleCard

```ts
interface Player {
  readonly id: PlayerId;
  readonly displayName: string;             // имя; alias: name
  readonly isBot: boolean;
  readonly seatIndex: SeatIndex | null;     // null = удалён из лодки (мёртвый, упавший за борт)
  readonly characterId: CharacterId;        // public — alias для role.character
  readonly role: RoleCard;
  readonly bestFriendId: CharacterId;       // PRIVATE — alias: bestFriend (Character | self)
  readonly worstEnemyId: CharacterId;       // PRIVATE — alias: worstEnemy
  readonly consciousness: Consciousness;
  readonly wounds: number;
  readonly fatigue: FatigueSide | null;     // null если жетона нет
  readonly fatigueRowing?: boolean;         // версия A: два булевых флага вместо single field
  readonly fatigueFighting?: boolean;
  readonly openSupplies: SupplyInstanceId[]; // public; либо SupplyCard[] inline
  readonly closedSupplies: SupplyInstanceId[]; // contents PRIVATE, count public
  readonly hasUsedShketSteal: boolean;      // alias: shketStealUsedThisTurn
  readonly disconnected?: boolean;          // P2P статус; alias: !connected
}

interface Seat {
  readonly index: SeatIndex;
  readonly occupantId: PlayerId | null;     // null если игрок мёртв и убран
  readonly characterId?: CharacterId | null; // версия A: банка хранит характер
  readonly removed?: boolean;                // версия A: банка убрана при 4/5 игроках
}

interface RoleCard {
  readonly character: CharacterId;
  readonly strength: number;
  readonly survivalBonus: number;
  readonly ability: AbilityKind;
}
```

> **Open question: хранение жетона усталости.**
> Версия A: два булевых поля `fatigueRowing` и `fatigueFighting` (так как у физического жетона две стороны и можно одновременно «грёб и дрался» — но в правилах второй жетон не выдаётся).
> Версия B: одно поле `fatigue: FatigueSide | null` — отражает, что в день у игрока ≤ 1 жетон. Если был жетон `rower` и игрок подрался — он не получает дополнительный, остаётся `rower`. Это совпадает с правилом «новые жетоны усталости не выдаются».
> Версия B проще и точнее — рекомендую её, но требует подтверждения.

> **Open question: маппинг персонажа на игрока.**
> Версия A держит отдельно `characterToPlayer: Partial<Record<CharacterId, PlayerId>>`, чтобы при свопе мест меняться местами на банках, но не игроками.
> Версия B — `Seat.occupantId` + `Player.seatIndex` (двунаправленные), а персонаж хранится в `Player.role.character`. Своп — меняет `seatIndex` у обоих игроков и `occupantId` в банках.
> Семантика одинаковая; выбор — стиль.

## 6. Фазы и подфазы

Верхнеуровневая фаза:

```ts
type Phase =
  | { kind: 'lobby' }
  | { kind: 'setup' }
  | { kind: 'morning'; subPhase: MorningSubPhase }
  | { kind: 'day'; subPhase: DaySubPhase }
  | { kind: 'evening'; subPhase: EveningSubPhase }
  | { kind: 'scoring' }
  | { kind: 'finished'; winner?: PlayerId | 'sea' | 'tie'; scores?: Record<PlayerId, number> };
// (alias 'type' вместо 'kind' в версии A)
```

> **Open question: дискриминатор фаз.**
> Версия A использует `type:`, версия B — `kind:`. Выбрать один.

### Morning

```ts
type MorningSubPhase =
  | { kind: 'distributingSupplies'; passingTo: PlayerId; pile: CardId[] };

// Полная инфо для версии A:
type MorningState = {
  currentSeatIndex: SeatIndex;
  cardsInHand: SupplyInstanceId[];   // карты, которые текущий выбирает
};
```

### Day

```ts
type DaySubPhase =
  | { kind: 'waitingForAction' }                            // alias: 'choose_action'
  | { kind: 'rowing'; player: PlayerId; drawn: NavCardId[] }
  | { kind: 'awaitingSwapResponse'; attacker: PlayerId; victim: PlayerId; targetSeat: SeatIndex }
  | { kind: 'awaitingRobResponse';  attacker: PlayerId; victim: PlayerId }
  | { kind: 'completingRobPick' }
  | { kind: 'shket_steal'; attacker: PlayerId; target: PlayerId; candidateIds: SupplyInstanceId[] }
  | { kind: 'first_aid_target'; user: PlayerId }
  | { kind: 'umbrella_target';  user: PlayerId }
  | { kind: 'flare_gun_resolve'; user: PlayerId; drawnCards: NavCardInstanceId[] }
  | { kind: 'fight'; fight: FightState };

// Контекст дня (фиксируется в начале дня и не меняется при свопах):
type DayContext = {
  currentSeatIndex: SeatIndex;
  turnOrderSnapshot: SeatIndex[];   // снимок порядка банок на момент старта дня
  turnOrderIdx: number;
  rowerCards: NavCardInstanceId[];  // карты «от гребцов», накапливаются за день
};
```

### Fight

```ts
type FightSubPhase =
  | { kind: 'recruitingAllies'; attackerSide: PlayerId[]; victimSide: PlayerId[]; pendingResponses: PlayerId[] }
  | { kind: 'revealingWeapons' }
  | { kind: 'resolving' }
  | { kind: 'applyingConsequences' }
  | { kind: 'resolved'; winnerSide: 'attacker' | 'victim' };

type FightState = {
  reason: 'swap' | 'rob';
  attackerId: PlayerId;
  defenderId: PlayerId;
  target:
    | { type: 'swap_seat' }
    | { type: 'rob_open'; supplyId: SupplyInstanceId }
    | { type: 'rob_closed_random' };
  attackerAllies: PlayerId[];
  defenderAllies: PlayerId[];
  attackerWeapons: SupplyInstanceId[];   // открытые/раскрываемые
  defenderWeapons: SupplyInstanceId[];
  recruitmentClosed: boolean;
  pendingAllyRequest?: { target: PlayerId; side: 'attacker' | 'defender' };
  subPhase: FightSubPhase;
};
```

### Evening

```ts
type EveningSubPhase =
  | { kind: 'sternPicking'; pickerId: PlayerId; pool: CardId[] }        // ближайший к корме выбирает
  | { kind: 'compass_select'; drawnExtra: NavCardInstanceId; candidateIds: NavCardInstanceId[] }
  | { kind: 'resolvingCard'; step: NavResolveStep };

type NavResolveStep = 'seagulls' | 'overboard' | 'sharkBaitOptional' | 'thirst' | 'cleanup';

type EveningState = {
  subPhase: EveningSubPhase;
  navCard?: NavigationCard;
};

type PendingWaterUse = {
  target: CharacterId;
  triggered: boolean;
};
```

## 7. Полный GameState

```ts
interface GameState {
  // Идентификация и RNG
  readonly gameId: string;
  readonly hostId: PlayerId;
  readonly seed: number;             // или rngSeed: string — см. open question
  readonly rngState: RngState;
  readonly day: number;              // turnNumber, считаем игровые дни (1, 2, 3...)

  // Игроки и места
  readonly players: Record<PlayerId, Player>;
  readonly seats: Seat[];            // sorted by index
  readonly characters: Record<CharacterId, Character>;
  readonly characterToPlayer: Partial<Record<CharacterId, PlayerId>>;  // обратный маппинг
  readonly removedCharacters: CharacterId[];   // убраны при 4/5 игроков

  // Колоды
  readonly supplyDeck: SupplyInstanceId[];     // на носу, top = последний (или первый — зафиксировать)
  readonly supplyDiscard: SupplyInstanceId[];  // одноразовые после использования
  readonly navDeck: NavCardInstanceId[];
  readonly navDiscard: NavCardInstanceId[];
  readonly navBottom?: NavCardInstanceId[];    // версия B: явный буфер карт под колоду
  readonly navPool: NavCardInstanceId[];       // карты от гребцов; alias: rowerCards
  readonly currentNavCard: NavigationCard | null;  // раскрытая для разыгрывания

  // Полные данные карт
  readonly supplyById: Record<SupplyInstanceId, SupplyCard>;
  readonly navById: Record<NavCardInstanceId, NavigationCard>;

  // Жетоны
  readonly seagullTokens: number;              // 0..4; alias: seagullsOnStern
  readonly availableWoundTokens?: number;
  readonly availableFatigueTokens?: number;

  // Порядок ходов и состояние фазы
  readonly phase: Phase;
  readonly turnOrder: PlayerId[];              // порядок ходов в текущем дне (фиксирован)
  readonly currentTurnIndex: number;
  readonly dayActionsTaken: Record<PlayerId, boolean>;
  readonly pendingAction?: PendingAction | null;

  // Лог
  readonly log: GameEvent[];

  // Финал
  readonly winner: PlayerId | 'sea' | 'tie' | null;
  readonly finalScores: Record<PlayerId, ScoreBreakdown> | null;
}

interface GameEvent {
  readonly timestamp: number;
  readonly type: string;
  readonly payload: unknown;
  readonly visibleTo: PlayerId[] | 'all';      // для фильтрации лога
}
```

> **Open question: тип `seed`.**
> Версия A: `rngSeed: string` (передаётся в seedrandom).
> Версия B: `seed: number` + `rngState: RngState` (mulberry32, сериализуемый счётчик).
> Оба валидны. Выбор зависит от выбранной библиотеки RNG.

## 8. Actions

Все действия — discriminated union с полем `type` и обязательным `playerId` (кто инициирует).

```ts
type Action =
  // Lobby / setup
  | { type: 'LOBBY_JOIN'; playerId: PlayerId; name: string }
  | { type: 'LOBBY_LEAVE'; playerId: PlayerId }
  | { type: 'LOBBY_START_GAME'; playerId: PlayerId }   // только host; alias: 'START_GAME' { players, seed }

  // Morning
  | { type: 'MORNING_CHOOSE_SUPPLY'; playerId: PlayerId; supplyInstanceId: SupplyInstanceId }
  // alias: { type: 'CHOOSE_SUPPLY'; playerId; cardId }

  // Day — выбор основного действия
  | { type: 'DAY_CHOOSE_ROW'; playerId: PlayerId }                                  // alias: 'BEGIN_ROW'
  | { type: 'DAY_CHOOSE_SWAP'; playerId: PlayerId; targetPlayerId: PlayerId }       // alias: 'OFFER_SWAP' { targetSeat }
  | { type: 'DAY_CHOOSE_ROB';  playerId: PlayerId; targetPlayerId: PlayerId }       // alias: 'OFFER_ROB'
  | { type: 'DAY_CHOOSE_SHKET_STEAL'; playerId: PlayerId; targetPlayerId: PlayerId }// alias: 'SHKET_STEAL'
  | { type: 'DAY_CHOOSE_FIRST_AID'; playerId: PlayerId }
  | { type: 'DAY_CHOOSE_UMBRELLA';  playerId: PlayerId }
  | { type: 'DAY_CHOOSE_FLARE_GUN'; playerId: PlayerId }
  | { type: 'DAY_CHOOSE_SKIP';      playerId: PlayerId }                            // alias: 'SKIP_TURN'

  // Подфазы дневных действий
  | { type: 'DAY_ROW_KEEP_CARDS'; playerId: PlayerId; cardIds: NavCardInstanceId[] }  // 0/1/2+ (с веслом)
  | { type: 'DAY_ROW_DECLARE_OAR'; playerId: PlayerId; oarSupplyId: SupplyInstanceId } // раскрыть весло перед взятием карт
  | { type: 'DAY_FIRST_AID_TARGET'; playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacterId: CharacterId }
  | { type: 'DAY_UMBRELLA_TARGET';  playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacterId: CharacterId }
  | { type: 'DAY_FLARE_GUN_RESOLVE'; playerId: PlayerId; supplyId: SupplyInstanceId }
  // aliases (версия B): USE_FIRST_AID/USE_UMBRELLA/USE_FLARE { targetPlayerId, cardId }

  // Шкет — целевая карта (после перемешивания жертвы)
  | { type: 'SHKET_VICTIM_SHUFFLE_DONE'; playerId: PlayerId }
  | { type: 'SHKET_DRAW'; playerId: PlayerId; supplyId: SupplyInstanceId }

  // Реакция на свопы/ограбления
  | { type: 'PROPOSAL_ACCEPT'; playerId: PlayerId }   // alias: RESPOND_SWAP/RESPOND_ROB { response: 'accept' }
  | { type: 'PROPOSAL_REJECT'; playerId: PlayerId }   // → драка; alias: response: 'refuse'
  | { type: 'ROB_REVEAL_OPEN_PICK'; playerId: PlayerId; supplyId: SupplyInstanceId } // атакующий выбирает открытую
  | { type: 'ROB_CLOSED_RANDOM_DRAW'; playerId: PlayerId; drawnSupplyId: SupplyInstanceId }
  | { type: 'ROB_VICTIM_SHUFFLE_DONE'; playerId: PlayerId }
  // alias (версия B): COMPLETE_ROB_PICK { pick: { kind: 'open'; cardId } | { kind: 'closed' } }

  // Драка
  | { type: 'DECLARE_FIGHT'; playerId: PlayerId }       // обычно авто-триггер при REFUSE; оставлен для полноты
  | { type: 'FIGHT_RECRUIT_ALLY'; playerId: PlayerId; targetId: PlayerId; side: 'attacker' | 'defender' }
  // alias: 'REQUEST_ALLY' { targetPlayerId, side }
  | { type: 'FIGHT_ALLY_ACCEPT';  playerId: PlayerId; weapons: SupplyInstanceId[] }
  | { type: 'FIGHT_ALLY_DECLINE'; playerId: PlayerId }
  // alias: 'RESPOND_ALLY' { accept: boolean }
  | { type: 'FIGHT_ADD_WEAPON'; playerId: PlayerId; weaponSupplyId: SupplyInstanceId }
  // alias: 'DECLARE_WEAPONS' { cardIds }
  | { type: 'FIGHT_CLOSE_RECRUITMENT'; playerId: PlayerId }   // только атакующий; alias: 'CLOSE_ALLY_RECRUITMENT'
  | { type: 'FIGHT_RESOLVE'; playerId: PlayerId }             // host-only автотриггер; alias: 'RESOLVE_FIGHT'

  // Реактивные / в-любой-момент (кроме драки)
  | { type: 'REVEAL_SUPPLY'; playerId: PlayerId; supplyId: SupplyInstanceId }   // alias: 'OPEN_SUPPLY'
  | { type: 'DISCARD_SUPPLY'; playerId: PlayerId; supplyId: SupplyInstanceId }  // alias: 'DISCARD'
  | { type: 'GIVE_SUPPLY'; playerId: PlayerId; targetPlayerId: PlayerId; supplyId: SupplyInstanceId; faceUp?: boolean }
  // alias: 'TRADE_GIVE' { faceUp: boolean }
  | { type: 'TRADE_SWAP' /* TODO: design — двусторонняя сделка */ }
  | { type: 'PASS_OAR'; playerId: PlayerId; targetPlayerId: PlayerId; cardId: SupplyInstanceId } // частный случай GIVE_SUPPLY
  | { type: 'USE_LIFE_RING_REACTIVE'; playerId: PlayerId; supplyId: SupplyInstanceId; targetPlayerId?: PlayerId } // при падении за борт

  // Вечер
  | { type: 'EVENING_USE_COMPASS'; playerId: PlayerId; supplyId: SupplyInstanceId }
  | { type: 'EVENING_SELECT_NAV_CARD'; playerId: PlayerId; navCardId: NavCardInstanceId }
  // alias: 'STERN_PICK' { cardId }
  | { type: 'EVENING_USE_SHARK_BAIT'; playerId: PlayerId; supplyId: SupplyInstanceId }
  // alias: 'USE_SHARK_BAIT' { cardId }
  | { type: 'EVENING_SKIP_SHARK_BAIT'; playerId: PlayerId }
  | { type: 'EVENING_USE_WATER'; playerId: PlayerId; supplyId: SupplyInstanceId; targetCharacterId: CharacterId }
  // alias: 'USE_WATER_FOR_THIRST' { targetPlayerId, cardId }
  | { type: 'EVENING_DECLINE_WATER'; playerId: PlayerId; targetCharacterId: CharacterId }

  // Системные
  | { type: 'PHASE_ADVANCE' }         // host-only, диспатчится после завершения подфазы; alias: 'ADVANCE_NAV_STEP' / 'END_DAY'
  | { type: 'TALLY_SCORES' };
```

> **Open question: единые имена action'ов.**
> Версия A использует префиксы `DAY_*`, `MORNING_*`, `EVENING_*`, `FIGHT_*`, `SHKET_*` — длинно, но фаза видна сразу.
> Версия B использует короче и без префикса — `BEGIN_ROW`, `OFFER_SWAP`, `USE_FIRST_AID`, `REQUEST_ALLY`, и т.д.
> Зафиксировать один набор и удалить алиасы.

> **Open question: target swap по `targetSeat` vs `targetPlayerId`.**
> Версия A: `targetPlayerId`. Версия B: `targetSeat: SeatIndex` (более устойчиво к рассинхрону, если игроки в свопе меняются местами).
> Версия B логически точнее: своп идёт на банку, а не на игрока.

## 9. Reducer contract

```ts
// Чистая функция. Никаких сайд-эффектов. Использует state.rngState через rng.ts.
function reduce(state: GameState, action: Action, rng?: PRNG): ReducerResult;

type ReducerResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ReducerError };

// GameError — НЕ exception, а значение.
interface ReducerError {
  readonly kind?: 'GameError';
  readonly code: ErrorCode;
  readonly message: string;
  readonly hint?: string;
}

type ErrorCode =
  | 'WRONG_PHASE'              // alias: 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'UNCONSCIOUS_OR_DEAD'      // alias: 'UNCONSCIOUS_PLAYER' / 'DEAD_PLAYER'
  | 'CARD_NOT_OWNED'           // alias: 'INVALID_SUPPLY'
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
  | 'BUSINESS_RULE_VIOLATION';
```

> **Open question: возвращаемый тип reducer.**
> Версия A: `{ ok: true | false, ... }` (явный tag).
> Версия B: `GameState | GameError` (union с признаком `kind: 'GameError'`).
> Семантически идентично; выбрать стилистически.

**Свойства reducer'а:**

- Pure: не имеет побочных эффектов, не читает внешнее.
- Детерминирован при фиксированном RNG/seed.
- Не бросает исключений — возвращает ошибку как значение.
- Полный: для каждой комбинации (phase × action.type) есть либо валидный переход, либо явная ошибка с понятным `code`.

Каркас:

```ts
function reduce(state: GameState, action: Action): GameState | ReducerError {
  // 1. Валидация структуры action (опц. zod в dev)
  if (!isValidActionShape(action)) return { code: 'INVALID_ACTION_SHAPE', message: '...' };

  // 2. Глобальные инварианты
  if (state.phase.kind === 'finished') return { code: 'GAME_FINISHED', message: '...' };

  // 3. Диспатч по action.type
  switch (action.type) {
    case 'BEGIN_ROW':     return handleBeginRow(state, action);
    case 'CHOOSE_SUPPLY': return handleChooseSupply(state, action);
    // ... etc
  }
}
```

Каждый обработчик:

1. Проверяет, что action разрешён в текущей фазе (см. [`docs/state-machine.md`](./state-machine.md)).
2. Проверяет специфичные инварианты (тот ли игрок, есть ли карта, и т.д.).
3. Применяет изменения иммутабельно (через Immer или вручную).
4. Может вызвать переход фазы — обновляет `state.phase` явно.

## 10. Фильтрация state

```ts
function filterStateForPlayer(state: GameState, viewerId: PlayerId): FilteredGameState;
```

Что **скрывается** у других игроков:

- `bestFriendId`, `worstEnemyId` — не отправляются.
- `closedSupplies` других — только `count`, без `instanceId`.
- `supplyDeck` — только `length`.
- `navDeck` — только `length`.
- Промежуточные карты в `MorningSubPhase.pile`, `DayContext.rowerCards`, `EveningSubPhase.pool` — видны только тому, у кого они в руках.
- `seed` / `rngSeed` — не отправляются.

Что **добавляется** в `FilteredGameState`:

- `viewerId` — для удобства UI.
- `myClosedSupplies` — явный список своих закрытых.
- `myFriendId`, `myEnemyId` — явные поля.

Лог фильтруется: `event.visibleTo === 'all' || event.visibleTo.includes(viewerId)`.

Подробнее — см. [`docs/visibility-model.md`](./visibility-model.md) и [`docs/network-protocol.md`](./network-protocol.md).

## 11. Инварианты

Реализовать в `src/game/invariants.ts`. Запускать в `__DEV__`/тестах каждое обновление, в проде — выборочно или отключить.

```ts
function checkInvariants(state: GameState): InvariantError[];
function assertInvariants(state: GameState): void;
```

Список инвариантов:

1. **Сохранение карт припасов**: `supplyDeck + supplyDiscard + Σ(player.openSupplies + player.closedSupplies)` = `42`.
2. **Сохранение карт навигации**: `navDeck + navDiscard + rowerCards + revealedNow` = `24`.
3. **Один персонаж = один игрок**: каждый `characterId` встречается ровно один раз в `characterToPlayer`, плюс совпадает с `players[*].characterId`.
4. **Сознание**: `wounds < strength ⇒ conscious`, `wounds === strength ⇒ unconscious`, `wounds > strength ⇒ dead`. У каждого игрока `wounds ≤ role.strength + 1`.
5. **Чайки**: `0 ≤ seagullTokens ≤ 4`. Если `=== 4` → `phase.kind ∈ {'scoring', 'finished'}`.
6. **Банки**: количество `seats` соответствует количеству игроков плюс удалённые персонажи (для 4/5 игроков). Каждая банка — либо null, либо у валидного живого/без-сознания игрока.
7. **Фаза**: подфаза consistent с фазой (нельзя `evening.subPhase` при `phase.kind === 'morning'`).
8. **`turnOrder`** ⊆ `players` и в правильном порядке банок.
9. **Финал**: если `phase=finished`, `finalScores != null`.
10. **Сумма ран** ≤ `availableWoundTokens` (24 жетона).

## 12. PRNG

Два варианта реализации (выбрать один):

```ts
// Вариант A: seedrandom-style, PRNG как объект
interface PRNG {
  next(): number;       // [0, 1)
  shuffle<T>(arr: T[]): T[];
  pick<T>(arr: T[]): T;
}
function createPRNG(seed: string): PRNG;

// Вариант B: чистая функция, state сериализуемый (mulberry32)
interface RngState {
  readonly seed: number;
  readonly counter: number;
}
function nextInt(rng: RngState, maxExclusive: number): [number, RngState];
function shuffle<T>(rng: RngState, arr: readonly T[]): [T[], RngState];
function pickRandom<T>(rng: RngState, arr: readonly T[]): [T, RngState];
function mulberry32(seed: number): () => number;
```

> **Open question: PRNG-API.**
> Версия A: мутабельный PRNG-объект, инжектится в reducer параметром.
> Версия B: чистый функциональный API, `rngState` — часть `GameState`, каждая операция возвращает новое state.
> Вариант B лучше для воспроизводимости и replay'ев, но verbose. Вариант A проще писать.

**Правило (общее):** reducer НИКОГДА не использует `Math.random()`. Все случайные операции получают PRNG через параметр или через `state.rngState`. Это даёт:

- Тесты с фиксированным seed.
- Replay'и игр.
- Один и тот же seed на host'е → одинаковые результаты «случайных» операций.

## 13. Подсчёт очков (детально)

```ts
function scoreGame(state: GameState): Record<PlayerId, ScoreBreakdown>;

interface ScoreBreakdown {
  survival: number;          // 0 / survivalBonus / 2*survivalBonus
  survivalReason: 'dead' | 'alive_normal' | 'alive_narcissist' | 'alive_psychopath' | 'alive_both';
  valuables: { kind: SupplyKind; value: number }[];
  bestFriendBonus: { friendId: CharacterId; alive: boolean; points: number } | null;
  worstEnemyBonus: { enemyId: CharacterId; alive: boolean; points: number } | null;
  psychopathDeathBonus: { count: number; points: number };
  total: number;
}
```

Алгоритм для одного игрока (см. также §11.4 [`docs/game-rules.md`](./game-rules.md)):

```
survival_points  = compute_survival(player)
valuables_points = compute_valuables(player)
friend/enemy     = compute_friend_enemy(player)   // с учётом совпадения friend === enemy
psycho_points    = psychopath_bonus_if_applicable(player)
total = sum(...)
```

Где `compute_survival`:

- Мёртв → 0
- Жив, не нарцисс, не психопат → `survivalBonus`
- Жив, нарцисс, не психопат → `2 * survivalBonus`
- Жив, психопат, не нарцисс → 0
- Жив, и нарцисс, и психопат → `survivalBonus` (×1)

## 14. Сериализация и диффы

```ts
function serialize(state: GameState): string;       // JSON.stringify с заменой Map/Set
function deserialize(json: string): GameState;
```

- Полное состояние сериализуется в JSON. Размер — до ~50 KB.
- Для сети — пересылается полный snapshot после каждого действия (после view-filter). См. [`docs/network-protocol.md`](./network-protocol.md).
- Опционально: дифф через структурное сравнение (не на старте).
- Если в state есть `Map`/`Set` — нужны replacer/reviver. Проще держать всё на plain объектах/массивах. Если используем Immer — он работает с plain JS.

## 15. Что НЕ в game state

Эти данные хранятся отдельно (`src/store/` или `src/net/`):

- Соединения PeerJS, peer IDs клиентов.
- UI state: модалки, выбранные карты, hover.
- Чат-сообщения (если будут).
- Тайминги анимаций.

Game state — чистая логика. Всё, что переезжает в state, должно быть детерминированно воспроизводимым из `rngSeed` + history of actions.
