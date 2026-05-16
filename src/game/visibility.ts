// Фильтрация GameState для конкретного игрока. См. docs/visibility-model.md.
//
// Что скрывается:
//   • rng — не отправляется клиенту вообще
//   • bestFriend/worstEnemy чужих игроков → null (раскрытие в финале)
//   • closedSupplies чужих → массив фейковых id (длина видна, содержимое нет)
//   • supplyDeck/navDeck → массивы фейковых id той же длины
//   • morning.distributing.pile → видна только текущему получателю
//   • day.rowing.drawn → видна только гребцу
//   • evening.sternPicking.pool → видна только пикеру
//
// Карта, разыгрываемая вечером (evening.resolving.cardId), уже раскрыта — публична.

import type {
  FilteredGameState,
  FilteredPlayer,
  GameState,
  NavCardInstanceId,
  NavigationCard,
  Phase,
  Player,
  PlayerId,
  SupplyCard,
  SupplyInstanceId,
} from './types'

/** Главная функция: создаёт отфильтрованное состояние для viewer'а. */
export function filterStateForPlayer(state: GameState, viewerId: PlayerId): FilteredGameState {
  const visibleSupplyIds = collectVisibleSupplyIds(state, viewerId)
  const visibleNavIds = collectVisibleNavIds(state, viewerId)

  // Отфильтрованные supplyById/navById — только видимые карты.
  const supplyById: Record<SupplyInstanceId, SupplyCard> = {}
  for (const id of visibleSupplyIds) {
    const c = state.supplyById[id]
    if (c) supplyById[id] = c
  }
  const navById: Record<NavCardInstanceId, NavigationCard> = {}
  for (const id of visibleNavIds) {
    const c = state.navById[id]
    if (c) navById[id] = c
  }

  // Отфильтрованные игроки.
  const players: Record<PlayerId, FilteredPlayer> = {}
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = filterPlayer(p, id === viewerId, state.phase.kind === 'finished')
  }

  // Колоды: заменить ID на фейковые, чтобы клиент мог считать длину без знания содержимого.
  const supplyDeck = state.supplyDeck.map((_, i) => `hidden-supply-${i}`)
  const navDeck = state.navDeck.map((_, i) => `hidden-nav-${i}`)

  // Фильтрация фазы (приватные pile/pool/drawn).
  let phase = filterPhase(state.phase, viewerId)
  // Morning pile: видна только текущему получателю (тому, кто сидит на currentSeat).
  if (phase.kind === 'morning' && phase.subPhase.kind === 'distributing') {
    const currentSeat = state.seats[phase.subPhase.currentSeat]
    const currentOccupant = currentSeat?.occupantId ?? null
    if (currentOccupant !== viewerId) {
      phase = {
        ...phase,
        subPhase: {
          ...phase.subPhase,
          pile: phase.subPhase.pile.map((_, i) => `hidden-pile-${i}`),
        },
      }
    }
  }

  // Из state выкидываем rng, supplyById, navById, players — заменяем своими.
  const { rng: _rng, players: _p, supplyById: _s, navById: _n, ...rest } = state
  void _rng
  void _p
  void _s
  void _n

  return {
    ...rest,
    viewerId,
    players,
    supplyById,
    navById,
    supplyDeck,
    navDeck,
    phase,
  }
}

/** Собрать id припасов, которые viewer имеет право видеть. */
function collectVisibleSupplyIds(state: GameState, viewerId: PlayerId): Set<SupplyInstanceId> {
  const ids = new Set<SupplyInstanceId>()
  // Все открытые карты — публичны.
  for (const p of Object.values(state.players)) {
    for (const id of p.openSupplies) ids.add(id)
    if (p.id === viewerId) {
      // Свои закрытые тоже видны.
      for (const id of p.closedSupplies) ids.add(id)
    }
  }
  // Discard — публичен.
  for (const id of state.supplyDiscard) ids.add(id)
  // Morning pile: видна только текущему получателю.
  if (state.phase.kind === 'morning' && state.phase.subPhase.kind === 'distributing') {
    const currentSeat = state.seats[state.phase.subPhase.currentSeat]
    if (currentSeat?.occupantId === viewerId) {
      for (const id of state.phase.subPhase.pile) ids.add(id)
    }
  }
  return ids
}

/** Собрать id навигационных карт, которые viewer имеет право видеть. */
function collectVisibleNavIds(state: GameState, viewerId: PlayerId): Set<NavCardInstanceId> {
  const ids = new Set<NavCardInstanceId>()
  // Discard — публичен (карты, которые уже разыгрывались).
  for (const id of state.navDiscard) ids.add(id)
  // Приватные pile/pool: видны только их владельцу.
  if (state.phase.kind === 'day' && state.phase.subPhase.kind === 'rowing') {
    if (state.phase.subPhase.playerId === viewerId) {
      for (const id of state.phase.subPhase.drawn) ids.add(id)
    }
  }
  if (state.phase.kind === 'evening' && state.phase.subPhase.kind === 'sternPicking') {
    if (state.phase.subPhase.pickerId === viewerId) {
      for (const id of state.phase.subPhase.pool) ids.add(id)
    }
  }
  // Активная карта вечера — публична.
  if (state.phase.kind === 'evening' && state.phase.subPhase.kind === 'resolving') {
    ids.add(state.phase.subPhase.cardId)
  }
  return ids
}

/** Отредактировать одного игрока. */
function filterPlayer(p: Player, isSelf: boolean, gameFinished: boolean): FilteredPlayer {
  const reveal = isSelf || gameFinished
  // Содержимое чужих закрытых карт скрыто — заменяем на фейковые id.
  const closedSupplies = isSelf
    ? p.closedSupplies
    : p.closedSupplies.map((_, i) => `hidden-${p.id}-${i}`)
  return {
    ...p,
    bestFriend: reveal ? p.bestFriend : null,
    worstEnemy: reveal ? p.worstEnemy : null,
    closedSupplies,
  }
}

/** Отредактировать фазу — скрыть приватные pile/pool/drawn. */
function filterPhase(phase: Phase, viewerId: PlayerId): Phase {
  if (phase.kind === 'morning' && phase.subPhase.kind === 'distributing') {
    const sub = phase.subPhase
    const seat = sub.currentSeat
    // Получатель = тот, кто сидит на currentSeat. У нас в state нет прямого
    // playerId в subPhase, нужно знать снаружи. Без mapping seat→player здесь
    // мы оставляем pile как есть — host знает порядок (через filterStateForPlayer
    // передаём viewerId но не передаём currently-passing-to). Для безопасности:
    // если caller передал viewerId == получатель, оставим pile, иначе fake.
    // Так как у filterPhase нет state, требуется передавать дополнительно.
    // Решение: pile filter делается выше в filterStateForPlayer, где есть state.
    // Здесь — просто возвращаем как есть (фильтр перенесём).
    void seat
    return phase
  }
  if (phase.kind === 'day' && phase.subPhase.kind === 'rowing') {
    const sub = phase.subPhase
    if (sub.playerId !== viewerId) {
      return {
        ...phase,
        subPhase: {
          ...sub,
          drawn: sub.drawn.map((_, i) => `hidden-rowing-${i}`),
        },
      }
    }
  }
  if (phase.kind === 'evening' && phase.subPhase.kind === 'sternPicking') {
    const sub = phase.subPhase
    if (sub.pickerId !== viewerId) {
      return {
        ...phase,
        subPhase: {
          ...sub,
          pool: sub.pool.map((_, i) => `hidden-pool-${i}`),
        },
      }
    }
  }
  return phase
}
