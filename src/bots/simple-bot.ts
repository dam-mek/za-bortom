// Эвристический бот. См. docs/bots.md.
//
// Принцип: «лучше тупо, чем сложно». Бот выбирает действие по приоритетам.
// Не блефует, не торгуется. Возвращает null, если сейчас не его очередь.

import type { Action } from '@/game/actions'
import { CHARACTERS } from '@/game/constants'
import type { CharacterId, SupplyType } from '@/game/constants'
import type {
  FilteredGameState,
  FilteredPlayer,
  NavCardInstanceId,
  NavigationCard,
  PlayerId,
  ResolveStep,
  SeatIndex,
  SupplyCard,
  SupplyInstanceId,
} from '@/game/types'
import type { Bot } from './bot'

function strengthOf(ch: CharacterId): number {
  return CHARACTERS.find((c) => c.id === ch)?.strength ?? 0
}

export class SimpleBot implements Bot {
  constructor(public readonly playerId: PlayerId) {}

  decide(view: FilteredGameState): Action | null {
    const me = view.players[this.playerId]
    if (!me || me.consciousness === 'dead') return null

    const phase = view.phase

    // ---------- Morning ----------
    if (phase.kind === 'morning' && phase.subPhase.kind === 'distributing') {
      const currentSeat = view.seats[phase.subPhase.currentSeat]
      if (currentSeat?.occupantId !== this.playerId) return null
      const pick = this.chooseSupplyFromPile(view, phase.subPhase.pile, me)
      return { kind: 'CHOOSE_SUPPLY', playerId: this.playerId, supplyId: pick }
    }

    // ---------- Day ----------
    if (phase.kind === 'day') {
      const sub = phase.subPhase
      switch (sub.kind) {
        case 'waitingForAction': {
          const seat = view.seats[sub.currentSeat]
          if (seat?.occupantId !== this.playerId) return null
          return this.dayDecision(view, me)
        }
        case 'rowing': {
          if (sub.playerId !== this.playerId) return null
          return this.rowKeepDecision(view, sub.drawn)
        }
        case 'awaitingSwapResponse':
        case 'awaitingRobResponse': {
          const defenderId = view.seats[sub.targetSeat]?.occupantId
          if (defenderId !== this.playerId) return null
          return this.proposalDecision(view, me, sub.attackerId)
        }
        case 'completingRobPick': {
          if (sub.attackerId !== this.playerId) return null
          return this.robPickDecision(view, sub.targetSeat)
        }
        case 'fight': {
          return this.fightDecision(view, me)
        }
      }
    }

    // ---------- Evening ----------
    if (phase.kind === 'evening') {
      const sub = phase.subPhase
      if (sub.kind === 'sternPicking') {
        if (sub.pickerId !== this.playerId) return null
        // Возможно есть открытый compass и пул > 0 → использовать.
        const compassId = openSupplyOfKind(view, me, 'compass')
        if (compassId && !sub.compassUsed && view.navDeck.length > 0) {
          return { kind: 'EVENING_USE_COMPASS', playerId: this.playerId, supplyId: compassId }
        }
        return this.selectNavCard(view, sub.pool)
      }
      if (sub.kind === 'resolving') {
        return this.resolvingDecision(view, sub.step, me)
      }
    }

    // ---------- Scoring ----------
    // PHASE_ADVANCE — пусть инициирует host, не бот.
    return null
  }

  // ============================================================
  // Morning
  // ============================================================

  private chooseSupplyFromPile(
    view: FilteredGameState,
    pile: SupplyInstanceId[],
    me: FilteredPlayer,
  ): SupplyInstanceId {
    // Приоритеты: water > first_aid (если ранен) > umbrella > oar > life_ring >
    //             compass (если бот ближе к корме) > weapon > valuable > any.
    const has = (kind: SupplyType): boolean =>
      [...me.openSupplies, ...me.closedSupplies].some(
        (id) => view.supplyById[id]?.kind === kind,
      )

    const score = (card: SupplyCard | undefined): number => {
      if (!card) return -1
      switch (card.kind) {
        case 'water':
          return has('water') ? 50 : 100
        case 'first_aid':
          return me.wounds > 0 ? 90 : 40
        case 'umbrella':
          return has('umbrella') ? 30 : 70
        case 'oar':
          return has('oar') ? 30 : 65
        case 'life_ring':
          return has('life_ring') ? 25 : 60
        case 'compass':
          return this.isClosestToStern(view) ? 75 : 35
        case 'hook':
          return strengthOf(me.character) < 6 ? 55 : 30
        case 'knife':
          return strengthOf(me.character) < 6 ? 45 : 25
        case 'club':
          return strengthOf(me.character) < 6 ? 35 : 20
        case 'flare':
          return 50
        case 'shark_bait':
          return 35
        case 'money':
        case 'jewelry':
        case 'painting': {
          // Бонус если множитель совпадает с character.
          const mult =
            (me.character === 'kapitan' && card.kind === 'money') ||
            (me.character === 'miledi' && card.kind === 'jewelry') ||
            (me.character === 'snob' && card.kind === 'painting')
          return mult ? 50 : 30
        }
      }
    }

    let best = pile[0]!
    let bestScore = -Infinity
    for (const id of pile) {
      const s = score(view.supplyById[id])
      if (s > bestScore) {
        bestScore = s
        best = id
      }
    }
    return best
  }

  private isClosestToStern(view: FilteredGameState): boolean {
    for (let i = view.seats.length - 1; i >= 0; i--) {
      const s = view.seats[i]
      if (!s || s.removed || s.occupantId === null) continue
      const p = view.players[s.occupantId]
      if (p?.consciousness === 'conscious') return s.occupantId === this.playerId
    }
    return false
  }

  // ============================================================
  // Day
  // ============================================================

  private dayDecision(view: FilteredGameState, me: FilteredPlayer): Action {
    // Если ранен и есть first_aid → лечусь.
    const faId = ownedSupplyOfKind(view, me, 'first_aid')
    if (me.wounds > 0 && faId) {
      return {
        kind: 'USE_FIRST_AID',
        playerId: this.playerId,
        supplyId: faId,
        targetCharacter: me.character,
      }
    }
    // Если у меня шкет-способность и есть кого ограбить (с закрытыми) — иногда воруем.
    if (me.character === 'shket' && !me.hasUsedShketSteal) {
      const target = this.pickShketVictim(view)
      if (target !== null) {
        return { kind: 'SHKET_STEAL', playerId: this.playerId, targetSeat: target }
      }
    }
    // Иначе — гребу, если есть подстраховка (вода или зонтик).
    const hasWater = ownedSupplyOfKind(view, me, 'water') !== null
    const hasUmbrella =
      me.openSupplies.some((id) => view.supplyById[id]?.kind === 'umbrella')
    if (hasWater || hasUmbrella) {
      return { kind: 'ROW', playerId: this.playerId }
    }
    // Без подстраховки — бездельничаю.
    return { kind: 'SKIP_TURN', playerId: this.playerId }
  }

  private pickShketVictim(view: FilteredGameState): SeatIndex | null {
    // Цель: с закрытыми картами, не я.
    for (const seat of view.seats) {
      if (seat.removed || seat.occupantId === null) continue
      if (seat.occupantId === this.playerId) continue
      const p = view.players[seat.occupantId]
      if (!p) continue
      if (p.closedSupplies.length > 0) return seat.index
    }
    return null
  }

  // ---------- Row ----------

  private rowKeepDecision(view: FilteredGameState, drawn: NavCardInstanceId[]): Action {
    const me = view.players[this.playerId]!
    const myEnemy = me.worstEnemy
    const scores = drawn.map((id) => ({ id, score: this.scoreNavCard(view, view.navById[id], me, myEnemy) }))
    // Оставляем 0, 1 или 2 с лучшим score.
    scores.sort((a, b) => b.score - a.score)
    const keep: NavCardInstanceId[] = []
    for (const item of scores) {
      if (item.score > 0 && keep.length < 2) keep.push(item.id)
    }
    return { kind: 'ROW_KEEP_CARDS', playerId: this.playerId, cardIds: keep }
  }

  private scoreNavCard(
    view: FilteredGameState,
    card: NavigationCard | undefined,
    me: FilteredPlayer,
    myEnemy: CharacterId | null,
  ): number {
    if (!card) return 0
    let score = 0
    if (card.seagull === 'normal') score += 5
    if (card.seagull === 'crossed') score -= 3
    if (card.overboard.includes(me.character)) score -= 10
    if (myEnemy && card.overboard.includes(myEnemy)) score += 5
    if (card.thirst.named.includes(me.character)) {
      score -= ownedSupplyOfKind(view, me, 'water') !== null ? 2 : 5
    }
    if (myEnemy && card.thirst.named.includes(myEnemy)) score += 3
    if (card.thirst.rowers && me.rowed) score -= 4
    if (card.thirst.fighters && me.fought) score -= 4
    return score
  }

  // ---------- Proposal response (swap/rob) ----------

  private proposalDecision(
    view: FilteredGameState,
    me: FilteredPlayer,
    attackerId: PlayerId,
  ): Action {
    const attacker = view.players[attackerId]
    if (!attacker) return { kind: 'PROPOSAL_ACCEPT', playerId: this.playerId }
    const myStr = strengthOf(me.character)
    const atkStr = strengthOf(attacker.character)
    // Если моя сила >= атакующего — дерёмся.
    if (myStr >= atkStr) {
      return { kind: 'PROPOSAL_REJECT', playerId: this.playerId }
    }
    // Иначе — соглашаемся.
    return { kind: 'PROPOSAL_ACCEPT', playerId: this.playerId }
  }

  // ---------- ROB_PICK (атакующий выбирает карту жертвы) ----------

  private robPickDecision(view: FilteredGameState, targetSeat: SeatIndex): Action {
    const victim = view.players[view.seats[targetSeat]?.occupantId ?? '']
    if (!victim) {
      return { kind: 'ROB_PICK', playerId: this.playerId, pick: { kind: 'closed' } }
    }
    // Предпочитаем открытую вкусняшку (jewelry > money > painting > water > weapon > прочее).
    const priority: SupplyType[] = ['jewelry', 'money', 'painting', 'water', 'hook', 'knife', 'club']
    for (const kind of priority) {
      const found = victim.openSupplies.find((id) => view.supplyById[id]?.kind === kind)
      if (found) return { kind: 'ROB_PICK', playerId: this.playerId, pick: { kind: 'open', supplyId: found } }
    }
    // Иначе любая открытая.
    if (victim.openSupplies.length > 0) {
      return {
        kind: 'ROB_PICK',
        playerId: this.playerId,
        pick: { kind: 'open', supplyId: victim.openSupplies[0]! },
      }
    }
    // Иначе случайная закрытая.
    return { kind: 'ROB_PICK', playerId: this.playerId, pick: { kind: 'closed' } }
  }

  // ---------- Fight ----------

  private fightDecision(view: FilteredGameState, me: FilteredPlayer): Action | null {
    if (view.phase.kind !== 'day' || view.phase.subPhase.kind !== 'fight') return null
    const f = view.phase.subPhase.fight
    // Если бота приглашают в союзники.
    if (f.pendingAlly && f.pendingAlly.invitedId === this.playerId) {
      // Бот принимает только если он друг приглашающей стороны.
      const inviterPlayerId = f.pendingAlly.side === 'attacker' ? f.attackerId : f.defenderId
      const inviter = view.players[inviterPlayerId]
      const accept = inviter?.character === me.bestFriend
      return { kind: 'FIGHT_ALLY_RESPONSE', playerId: this.playerId, accept, weapons: [] }
    }
    // Если бот — атакующий и нет pendingAlly, закрываем recruitment.
    if (f.attackerId === this.playerId && !f.pendingAlly) {
      return { kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: this.playerId }
    }
    return null
  }

  // ============================================================
  // Evening
  // ============================================================

  private selectNavCard(view: FilteredGameState, pool: NavCardInstanceId[]): Action {
    if (pool.length === 0) {
      // Pool пуст — поведение reducer'а возьмёт верх колоды, но мы должны передать valid navCardId.
      // Берём любой из navDeck (placeholder); reducer обработает.
      const first = view.navDeck[0]
      return {
        kind: 'EVENING_SELECT_NAV_CARD',
        playerId: this.playerId,
        navCardId: first ?? '',
      }
    }
    const me = view.players[this.playerId]!
    const myEnemy = me.worstEnemy
    let best = pool[0]!
    let bestScore = -Infinity
    for (const id of pool) {
      // Для пикера scoreNavCard работает — мы знаем содержимое pool (фильтр оставляет).
      const s = this.scoreNavCard(view, view.navById[id], me, myEnemy)
      if (s > bestScore) {
        bestScore = s
        best = id
      }
    }
    return { kind: 'EVENING_SELECT_NAV_CARD', playerId: this.playerId, navCardId: best }
  }

  private resolvingDecision(
    view: FilteredGameState,
    step: ResolveStep,
    me: FilteredPlayer,
  ): Action | null {
    if (step.kind === 'overboardLifeRing') {
      const pendingChar = step.pendingChars[0]
      if (!pendingChar) return null
      if (pendingChar !== me.character) return null
      // Открыть круг (мы — pendingChar): спасает от потери открытых припасов и раны.
      const ringId = ownedSupplyOfKind(view, me, 'life_ring')
      if (ringId) {
        return {
          kind: 'USE_LIFE_RING',
          playerId: this.playerId,
          supplyId: ringId,
          targetCharacter: me.character,
        }
      }
      return { kind: 'EVENING_SKIP_LIFE_RING', playerId: this.playerId }
    }
    if (step.kind === 'sharkBait') {
      const currentOwnerId = step.ownerQueue[0]
      if (currentOwnerId !== this.playerId) return null
      // Использовать приманку, если враг за бортом.
      const myEnemy = me.worstEnemy
      const enemyOverboard = myEnemy ? step.overboardChars.includes(myEnemy) : false
      if (enemyOverboard) {
        const baitId = openSupplyOfKind(view, me, 'shark_bait')
        if (baitId) {
          return { kind: 'EVENING_USE_SHARK_BAIT', playerId: this.playerId, supplyId: baitId }
        }
      }
      return { kind: 'EVENING_SKIP_SHARK_BAIT', playerId: this.playerId }
    }
    if (step.kind === 'thirst') {
      const head = step.queue[0]
      if (!head) return null
      const target = Object.values(view.players).find((p) => p.character === head.char)
      if (!target) {
        return {
          kind: 'EVENING_DECLINE_WATER',
          playerId: this.playerId,
          targetCharacter: head.char,
        }
      }
      // Спасаем себя или друга. Не спасаем врага.
      const isMe = target.id === this.playerId
      const isFriend = target.character === me.bestFriend
      if (isMe || isFriend) {
        // Используем свою воду если есть.
        const waterId = ownedSupplyOfKind(view, me, 'water')
        if (waterId) {
          return {
            kind: 'EVENING_USE_WATER',
            playerId: this.playerId,
            supplyId: waterId,
            targetCharacter: head.char,
          }
        }
      }
      return {
        kind: 'EVENING_DECLINE_WATER',
        playerId: this.playerId,
        targetCharacter: head.char,
      }
    }
    return null
  }
}

// ============================================================
// Helpers
// ============================================================

function ownedSupplyOfKind(
  view: FilteredGameState,
  p: FilteredPlayer,
  kind: SupplyType,
): SupplyInstanceId | null {
  for (const id of [...p.openSupplies, ...p.closedSupplies]) {
    if (view.supplyById[id]?.kind === kind) return id
  }
  return null
}

function openSupplyOfKind(
  view: FilteredGameState,
  p: FilteredPlayer,
  kind: SupplyType,
): SupplyInstanceId | null {
  for (const id of p.openSupplies) {
    if (view.supplyById[id]?.kind === kind) return id
  }
  return null
}
