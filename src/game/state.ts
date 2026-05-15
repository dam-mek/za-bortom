// Фабрика начального состояния. См. docs/game-rules.md §3 (подготовка) и docs/game-spec.md §5/§7.

import { CHARACTERS, NAVIGATION_DECK_SIZE, SUPPLY_DECK_SIZE, SUPPLY_PROPS } from './constants'
import type { CharacterId, SupplyType } from './constants'
import { createRng, shuffle } from './prng'
import type { RngState } from './prng'
import type {
  GameState,
  NavCardInstanceId,
  NavigationCard,
  Player,
  PlayerId,
  Seat,
  SeatIndex,
  SupplyCard,
  SupplyInstanceId,
} from './types'

export interface PlayerSpec {
  readonly id: PlayerId
  readonly displayName: string
  readonly isBot: boolean
}

export interface CreateInitialStateOptions {
  readonly gameId: string
  readonly hostId: PlayerId
  readonly seed: number
  readonly players: readonly PlayerSpec[]
}

/**
 * Состав 42 карт припасов. Это **плейсхолдер** — точные количества TODO,
 * сверить с физической колодой. См. docs/decisions.md #21.
 * Сумма должна быть ровно SUPPLY_DECK_SIZE = 42.
 */
const SUPPLY_DECK_COMPOSITION: ReadonlyArray<readonly [SupplyType, number]> = [
  ['water', 6],
  ['first_aid', 4],
  ['umbrella', 2],
  ['flare', 2],
  ['compass', 2],
  ['life_ring', 2],
  ['oar', 4],
  ['shark_bait', 2],
  ['club', 2],
  ['hook', 2],
  ['knife', 2],
  ['money', 4],
  ['jewelry', 4],
  ['painting', 4],
]

/** Создать 42 экземпляра припасов с детерминированными id. */
function buildSupplyCards(): SupplyCard[] {
  const cards: SupplyCard[] = []
  let n = 0
  for (const [type, count] of SUPPLY_DECK_COMPOSITION) {
    const props = SUPPLY_PROPS[type]
    for (let i = 0; i < count; i++) {
      cards.push({
        id: `s-${++n}`,
        kind: type,
        singleUse: props.singleUse,
        isWeapon: props.isWeapon,
        isValuable: props.isValuable,
        ...(props.weaponStrength !== undefined ? { weaponStrength: props.weaponStrength } : {}),
        ...(props.valuePoints !== undefined ? { valuePoints: props.valuePoints } : {}),
      })
    }
  }
  if (cards.length !== SUPPLY_DECK_SIZE) {
    throw new Error(`SUPPLY_DECK_COMPOSITION sum (${cards.length}) ≠ SUPPLY_DECK_SIZE (${SUPPLY_DECK_SIZE})`)
  }
  return cards
}

/**
 * Создать 24 карты навигации. Это **плейсхолдер** — реальные эффекты TODO,
 * заполнить из физической колоды (см. fixtures.ts позже).
 * Сейчас распределение взято «по ощущениям», чтобы:
 *   - суммарно было 24 карты
 *   - 12 карт давали +1 чайку, 4 убирали (-1), 8 без чаек
 *   - часть карт включала overboard / thirst
 */
function buildNavigationCards(): NavigationCard[] {
  const cards: NavigationCard[] = []
  // Чайки: 12 обычных + 4 перечёркнутых + 8 пустых = 24
  const seagullPattern: Array<NavigationCard['seagull']> = [
    ...Array<'normal'>(12).fill('normal'),
    ...Array<'crossed'>(4).fill('crossed'),
    ...Array<'none'>(8).fill('none'),
  ]
  // Overboard: даём ~12 карт с одним персонажем за бортом (rotate по characters)
  const chars = CHARACTERS.map((c) => c.id)
  // Жажда: ~8 карт с rowers, ~4 c fighters, ~10 с одним named
  for (let i = 0; i < 24; i++) {
    const seagull = seagullPattern[i] ?? 'none'
    const overboard: CharacterId[] = i < 12 ? [chars[i % chars.length] as CharacterId] : []
    const thirstRowers = i % 3 === 0
    const thirstFighters = i % 5 === 0
    const thirstNamed: CharacterId[] = i % 4 === 1 ? [chars[(i + 1) % chars.length] as CharacterId] : []
    cards.push({
      id: `n-${i + 1}`,
      seagull,
      overboard,
      thirst: { rowers: thirstRowers, fighters: thirstFighters, named: thirstNamed },
    })
  }
  return cards
}

/**
 * Подготовка состояния по правилам:
 *  1. Изъять из колод персонажей при <6 игроках.
 *  2. Раздать роли (характеры) — по 1 на игрока.
 *  3. Раздать карты друга и врага из оставшихся персонажей (с возможным совпадением — нарцисс/психопат).
 *  4. Перемешать припасы, выдать каждому 1 закрытую карту.
 *  5. Положить персонажей на банки в рандомном порядке (банки 0..N-1 от носа).
 *
 * NB: distributing 1 закрытой карты — это, строго говоря, морнинг первого дня.
 * По правилам он происходит на старте; мы делаем это здесь же, чтобы state был
 * сразу пригоден для входа в фазу `day` первого дня. Если нужно идти через morning —
 * перенесём логику в reducer.
 */
export function createInitialState(opts: CreateInitialStateOptions): GameState {
  const { gameId, hostId, seed, players } = opts
  if (players.length < 4 || players.length > 6) {
    throw new Error(`createInitialState: need 4-6 players, got ${players.length}`)
  }
  let rng: RngState = createRng(seed)

  // --- персонажи: убрать (6 - N) при <6 игроках ---
  const allChars: CharacterId[] = CHARACTERS.map((c) => c.id)
  const [shuffledChars, rng1] = shuffle(rng, allChars)
  rng = rng1
  const includedChars = shuffledChars.slice(0, players.length)
  const removedCharacters = shuffledChars.slice(players.length)

  // --- роли: shuffle players и присвоить каждому одного персонажа ---
  const [shuffledPlayers, rng2] = shuffle(rng, players)
  rng = rng2
  const playerCharacter: Record<PlayerId, CharacterId> = {}
  shuffledPlayers.forEach((p, idx) => {
    playerCharacter[p.id] = includedChars[idx] as CharacterId
  })

  // --- друзья: shuffle включённых характеров, раздать по одному на игрока ---
  const [shuffledFriends, rng3] = shuffle(rng, includedChars)
  rng = rng3
  const playerFriend: Record<PlayerId, CharacterId> = {}
  shuffledPlayers.forEach((p, idx) => {
    playerFriend[p.id] = shuffledFriends[idx] as CharacterId
  })

  // --- враги: то же ---
  const [shuffledEnemies, rng4] = shuffle(rng, includedChars)
  rng = rng4
  const playerEnemy: Record<PlayerId, CharacterId> = {}
  shuffledPlayers.forEach((p, idx) => {
    playerEnemy[p.id] = shuffledEnemies[idx] as CharacterId
  })

  // --- припасы: build, shuffle ---
  const supplyCards = buildSupplyCards()
  const [shuffledSupply, rng5] = shuffle(rng, supplyCards)
  rng = rng5
  const supplyById: Record<SupplyInstanceId, SupplyCard> = {}
  for (const s of shuffledSupply) supplyById[s.id] = s

  // выдать каждому игроку по 1 закрытой карте
  const playerClosed: Record<PlayerId, SupplyInstanceId[]> = {}
  for (const p of shuffledPlayers) playerClosed[p.id] = []
  const supplyIds = shuffledSupply.map((s) => s.id)
  shuffledPlayers.forEach((p, idx) => {
    const id = supplyIds[idx]
    if (id) playerClosed[p.id] = [id]
  })
  const remainingSupplyDeck = supplyIds.slice(shuffledPlayers.length)

  // --- навигация ---
  const navCards = buildNavigationCards()
  const [shuffledNav, rng6] = shuffle(rng, navCards)
  rng = rng6
  const navById: Record<NavCardInstanceId, NavigationCard> = {}
  for (const n of shuffledNav) navById[n.id] = n
  const navDeck = shuffledNav.map((n) => n.id)

  // --- банки: 6 всего; для 4/5 игроков лишние помечены removed ---
  // Распределяем persons по банкам в shuffled-order
  const [shuffledSeatChars, rng7] = shuffle(rng, includedChars)
  rng = rng7
  // playerByChar нужен, чтобы посадить владельца на банку с его персонажем
  const playerByChar: Partial<Record<CharacterId, PlayerId>> = {}
  for (const p of shuffledPlayers) playerByChar[playerCharacter[p.id] as CharacterId] = p.id

  const seats: Seat[] = []
  for (let i = 0; i < 6; i++) {
    if (i < shuffledSeatChars.length) {
      const ch = shuffledSeatChars[i] as CharacterId
      seats.push({
        index: i as SeatIndex,
        occupantId: playerByChar[ch] ?? null,
        removed: false,
      })
    } else {
      seats.push({ index: i as SeatIndex, occupantId: null, removed: true })
    }
  }

  // --- собрать Player'ов ---
  const playerMap: Record<PlayerId, Player> = {}
  for (const p of shuffledPlayers) {
    playerMap[p.id] = {
      id: p.id,
      displayName: p.displayName,
      isBot: p.isBot,
      character: playerCharacter[p.id] as CharacterId,
      bestFriend: playerFriend[p.id] as CharacterId,
      worstEnemy: playerEnemy[p.id] as CharacterId,
      consciousness: 'conscious',
      wounds: 0,
      rowed: false,
      fought: false,
      openSupplies: [],
      closedSupplies: playerClosed[p.id] ?? [],
      hasUsedShketSteal: false,
      disconnected: false,
    }
  }

  // turnOrder = живые банки от носа к корме
  const turnOrder: SeatIndex[] = seats
    .filter((s) => !s.removed && s.occupantId !== null)
    .map((s) => s.index)

  const dayActionsTaken: Record<PlayerId, boolean> = {}
  for (const p of shuffledPlayers) dayActionsTaken[p.id] = false

  const state: GameState = {
    gameId,
    hostId,
    seed,
    rng,
    day: 0,
    players: playerMap,
    seats,
    removedCharacters,
    supplyDeck: remainingSupplyDeck,
    supplyDiscard: [],
    navDeck,
    navDiscard: [],
    navPool: [],
    supplyById,
    navById,
    seagullTokens: 0,
    phase: { kind: 'setup' },
    turnOrder,
    currentTurnIndex: 0,
    dayActionsTaken,
    log: [],
    winner: null,
    finalScores: null,
  }

  // Контрольная проверка: сумма карт по местам и колодам = 42 supply + 24 nav
  if (NAVIGATION_DECK_SIZE !== navCards.length) {
    throw new Error(`nav deck size mismatch: ${navCards.length} ≠ ${NAVIGATION_DECK_SIZE}`)
  }

  return state
}
