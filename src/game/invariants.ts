// Проверка инвариантов GameState. Гоняется в dev/тестах после каждого обновления.
// См. docs/game-spec.md §11.

import { CHARACTERS, NAVIGATION_DECK_SIZE, SUPPLY_DECK_SIZE, TOTAL_SEAGULL_TOKENS } from './constants'
import type { GameState, PlayerId } from './types'

export interface InvariantError {
  readonly code: string
  readonly message: string
}

export function checkInvariants(state: GameState): InvariantError[] {
  const errors: InvariantError[] = []
  const add = (code: string, message: string) => errors.push({ code, message })

  // 1. Сохранение карт припасов = 42
  const supplyByPlayers = Object.values(state.players).reduce(
    (acc, p) => acc + p.openSupplies.length + p.closedSupplies.length,
    0,
  )
  const supplyTotal =
    state.supplyDeck.length + state.supplyDiscard.length + supplyByPlayers
  if (supplyTotal !== SUPPLY_DECK_SIZE) {
    add(
      'SUPPLY_COUNT',
      `Supply cards total ${supplyTotal} ≠ ${SUPPLY_DECK_SIZE} (deck=${state.supplyDeck.length}, discard=${state.supplyDiscard.length}, players=${supplyByPlayers})`,
    )
  }

  // 2. Сохранение карт навигации = 24
  const navTotal =
    state.navDeck.length + state.navDiscard.length + state.navPool.length
  if (navTotal !== NAVIGATION_DECK_SIZE) {
    add(
      'NAV_COUNT',
      `Nav cards total ${navTotal} ≠ ${NAVIGATION_DECK_SIZE} (deck=${state.navDeck.length}, discard=${state.navDiscard.length}, pool=${state.navPool.length})`,
    )
  }

  // 3. Один персонаж = один игрок (среди живых/без сознания), removedCharacters не пересекаются
  const seenChars = new Set<string>()
  for (const p of Object.values(state.players)) {
    if (seenChars.has(p.character)) {
      add('DUPLICATE_CHARACTER', `Character ${p.character} assigned to multiple players`)
    }
    seenChars.add(p.character)
    if (state.removedCharacters.includes(p.character)) {
      add(
        'CHARACTER_BOTH_PLAYED_AND_REMOVED',
        `Character ${p.character} is in removedCharacters but also assigned to player ${p.id}`,
      )
    }
  }

  // 4. Сознание <-> wounds
  for (const p of Object.values(state.players)) {
    const ch = CHARACTERS.find((c) => c.id === p.character)
    if (!ch) {
      add('UNKNOWN_CHARACTER', `Player ${p.id} has unknown character ${p.character}`)
      continue
    }
    if (p.wounds < 0) {
      add('NEGATIVE_WOUNDS', `Player ${p.id} has negative wounds (${p.wounds})`)
    }
    const expected =
      p.wounds < ch.strength ? 'conscious' : p.wounds === ch.strength ? 'unconscious' : 'dead'
    if (p.consciousness !== expected) {
      add(
        'CONSCIOUSNESS_MISMATCH',
        `Player ${p.id} wounds=${p.wounds} strength=${ch.strength} → expected ${expected}, got ${p.consciousness}`,
      )
    }
  }

  // 5. Чайки 0..4
  if (state.seagullTokens < 0 || state.seagullTokens > TOTAL_SEAGULL_TOKENS) {
    add(
      'SEAGULL_RANGE',
      `seagullTokens=${state.seagullTokens} out of [0, ${TOTAL_SEAGULL_TOKENS}]`,
    )
  }
  if (
    state.seagullTokens === TOTAL_SEAGULL_TOKENS &&
    state.phase.kind !== 'scoring' &&
    state.phase.kind !== 'finished'
  ) {
    add(
      'SEAGULL_FULL_NOT_SCORING',
      `seagullTokens=${TOTAL_SEAGULL_TOKENS} but phase is "${state.phase.kind}", should be scoring/finished`,
    )
  }

  // 6. Банки: всего 6, removed = 6 - N игроков
  if (state.seats.length !== 6) {
    add('SEATS_LENGTH', `seats.length=${state.seats.length} ≠ 6`)
  }
  const removedSeats = state.seats.filter((s) => s.removed).length
  const expectedRemovedSeats = 6 - Object.keys(state.players).length
  if (removedSeats !== expectedRemovedSeats) {
    add(
      'SEATS_REMOVED_COUNT',
      `removed seats=${removedSeats} ≠ expected ${expectedRemovedSeats} for ${Object.keys(state.players).length} players`,
    )
  }
  // занятые банки → валидные игроки
  for (const s of state.seats) {
    if (!s.removed && s.occupantId !== null) {
      if (!(s.occupantId in state.players)) {
        add('SEAT_OCCUPANT_UNKNOWN', `Seat ${s.index} occupied by unknown player ${s.occupantId}`)
      }
    }
  }

  // 7. removedCharacters.length = 6 - N
  const expectedRemovedChars = 6 - Object.keys(state.players).length
  if (state.removedCharacters.length !== expectedRemovedChars) {
    add(
      'REMOVED_CHARACTERS_COUNT',
      `removedCharacters.length=${state.removedCharacters.length} ≠ ${expectedRemovedChars}`,
    )
  }

  // 8. turnOrder ⊆ занятые банки
  for (const seatIdx of state.turnOrder) {
    const seat = state.seats[seatIdx]
    if (!seat || seat.removed || seat.occupantId === null) {
      add('TURN_ORDER_INVALID_SEAT', `turnOrder contains seat ${seatIdx} which is not playable`)
    }
  }

  // 9. Финал: phase=finished ⇒ finalScores != null
  if (state.phase.kind === 'finished' && state.finalScores === null) {
    add('FINISHED_WITHOUT_SCORES', `phase=finished but finalScores is null`)
  }

  // 10. Все ссылки supplyId валидны
  const knownSupplyIds = new Set(Object.keys(state.supplyById))
  const checkSupplyId = (id: string, where: string) => {
    if (!knownSupplyIds.has(id)) {
      add('UNKNOWN_SUPPLY_ID', `Unknown supply id "${id}" referenced in ${where}`)
    }
  }
  for (const id of state.supplyDeck) checkSupplyId(id, 'supplyDeck')
  for (const id of state.supplyDiscard) checkSupplyId(id, 'supplyDiscard')
  for (const [pid, p] of Object.entries(state.players) as [PlayerId, GameState['players'][PlayerId]][]) {
    for (const id of p.openSupplies) checkSupplyId(id, `player ${pid} openSupplies`)
    for (const id of p.closedSupplies) checkSupplyId(id, `player ${pid} closedSupplies`)
  }

  return errors
}

/** Бросает с подробной диагностикой, если есть нарушения. Для использования в тестах/dev. */
export function assertInvariants(state: GameState): void {
  const errors = checkInvariants(state)
  if (errors.length > 0) {
    const lines = errors.map((e) => `  [${e.code}] ${e.message}`).join('\n')
    throw new Error(`checkInvariants failed:\n${lines}`)
  }
}
