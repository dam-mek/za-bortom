import clsx from 'clsx'
import { CHARACTERS } from '@/game/constants'
import type { CharacterId } from '@/game/constants'
import type { GameState, Player, SupplyCard } from '@/game/types'

// State может быть полным (host/local) или отфильтрованным (client) — каст в Game.tsx.
// В рантайме bestFriend/worstEnemy могут быть null (UI рендерит "— скрыто —").
type AnyState = GameState
type AnyPlayer = Player

function characterMeta(id: CharacterId): { name: string; strength: number; bonus: number } {
  const c = CHARACTERS.find((x) => x.id === id)
  if (!c) return { name: id, strength: 0, bonus: 0 }
  const names: Record<CharacterId, string> = {
    bocman: 'Боцман',
    shket: 'Шкет',
    snob: 'Сноб',
    kapitan: 'Капитан',
    miledi: 'Миледи',
    cherpak: 'Черпак',
  }
  return { name: names[id], strength: c.strength, bonus: c.survivalBonus }
}

function CardChip({ card, hidden }: { card: SupplyCard | undefined; hidden?: boolean }) {
  if (hidden && !card) {
    return <span className="inline-block bg-sea-700/50 px-2 py-0.5 rounded text-xs">🂠 закрыто</span>
  }
  if (!card) return <span className="text-red-400">?</span>
  const labels: Record<string, string> = {
    water: '💧 вода',
    first_aid: '➕ аптечка',
    umbrella: '☂️ зонтик',
    flare: '🔫 ракета',
    compass: '🧭 компас',
    life_ring: '🛟 круг',
    oar: '🚣 весло',
    shark_bait: '🦈 приманка',
    club: '🥢 дубинка',
    hook: '🪝 багор',
    knife: '🔪 нож',
    money: '💵 деньги',
    jewelry: '💎 украшения',
    painting: '🖼️ картина',
  }
  return (
    <span className="inline-block bg-sea-700 px-2 py-0.5 rounded text-xs">
      {labels[card.kind] ?? card.kind}
      {card.weaponStrength ? ` (+${card.weaponStrength})` : ''}
      {card.valuePoints ? ` (${card.valuePoints})` : ''}
    </span>
  )
}

function PlayerCard({
  state,
  player,
  isCurrent,
  seatIndex,
}: {
  state: AnyState
  player: AnyPlayer
  isCurrent: boolean
  seatIndex: number
}) {
  const meta = characterMeta(player.character)
  const friendName = player.bestFriend ? characterMeta(player.bestFriend).name : '— скрыто —'
  const enemyName = player.worstEnemy ? characterMeta(player.worstEnemy).name : '— скрыто —'
  return (
    <div
      className={clsx(
        'rounded p-3 border-2 transition',
        isCurrent ? 'border-yellow-400 bg-sea-700' : 'border-sea-700 bg-sea-800',
        player.consciousness === 'dead' && 'opacity-40 grayscale',
        player.consciousness === 'unconscious' && 'opacity-70',
      )}
    >
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-semibold">
          [{seatIndex}] {player.displayName}
        </span>
        <span className="text-xs text-sea-300">
          {meta.name} ({meta.strength}/{meta.bonus})
        </span>
      </div>
      <div className="text-xs text-sea-300 mb-2">
        🤝 друг: {friendName} · 💀 враг: {enemyName}
      </div>
      <div className="text-xs mb-2">
        ❤️ ран: {player.wounds}/{meta.strength}
        {player.consciousness !== 'conscious' && (
          <span className="ml-2 text-red-400">{player.consciousness === 'dead' ? 'МЁРТВ' : 'без сознания'}</span>
        )}
        {player.rowed && <span className="ml-2 text-blue-300">🚣</span>}
        {player.fought && <span className="ml-2 text-orange-300">⚔️</span>}
        {player.hasUsedShketSteal && <span className="ml-2 text-purple-300">воровал</span>}
      </div>
      <div className="space-y-1">
        {player.openSupplies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-sea-300">Открыто:</span>
            {player.openSupplies.map((id) => (
              <CardChip key={id} card={state.supplyById[id]} />
            ))}
          </div>
        )}
        {player.closedSupplies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-sea-300">Закрыто ({player.closedSupplies.length}):</span>
            {player.closedSupplies.map((id) => (
              <CardChip key={id} card={state.supplyById[id]} hidden />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function BoatView({ state }: { state: AnyState }) {
  // Найти текущего «активного» — по фазе.
  const currentPlayerId = findCurrentPlayer(state)

  return (
    <section>
      <div className="flex gap-2 items-center mb-3 text-sm">
        <span>🪶 Чайки:</span>
        <span className="font-mono">
          {'●'.repeat(state.seagullTokens)}
          {'○'.repeat(4 - state.seagullTokens)}
        </span>
        <span className="ml-4">📜 Колода нав: {state.navDeck.length}</span>
        <span>· Сброс: {state.navDiscard.length}</span>
        <span>· Pool: {state.navPool.length}</span>
        <span className="ml-4">🎒 Колода прип: {state.supplyDeck.length}</span>
        <span>· Сброс: {state.supplyDiscard.length}</span>
        {state.removedCharacters.length > 0 && (
          <span className="ml-4 text-sea-300">
            Убраны: {state.removedCharacters.map((c) => characterMeta(c).name).join(', ')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {state.seats.map((seat) => {
          if (seat.removed) {
            return (
              <div key={seat.index} className="rounded p-3 border-2 border-dashed border-sea-700 text-sea-300 text-center">
                Банка [{seat.index}] — убрана
              </div>
            )
          }
          if (seat.occupantId === null) {
            return (
              <div key={seat.index} className="rounded p-3 border-2 border-dashed border-red-900 text-red-400 text-center">
                Банка [{seat.index}] — пуста (труп унесло)
              </div>
            )
          }
          const player = state.players[seat.occupantId]
          if (!player) return null
          return (
            <PlayerCard
              key={seat.index}
              state={state}
              player={player}
              isCurrent={player.id === currentPlayerId}
              seatIndex={seat.index}
            />
          )
        })}
      </div>
    </section>
  )
}

function findCurrentPlayer(state: AnyState): string | null {
  if (state.phase.kind === 'morning' && state.phase.subPhase.kind === 'distributing') {
    return state.seats[state.phase.subPhase.currentSeat]?.occupantId ?? null
  }
  if (state.phase.kind === 'day') {
    const sub = state.phase.subPhase
    switch (sub.kind) {
      case 'waitingForAction':
        return state.seats[sub.currentSeat]?.occupantId ?? null
      case 'rowing':
        return sub.playerId
      case 'awaitingSwapResponse':
      case 'awaitingRobResponse':
        return state.seats[sub.targetSeat]?.occupantId ?? null
      case 'completingRobPick':
        return sub.attackerId
      case 'fight':
        return sub.fight.pendingAlly?.invitedId ?? sub.fight.attackerId
    }
  }
  if (state.phase.kind === 'evening') {
    const sub = state.phase.subPhase
    if (sub.kind === 'sternPicking') return sub.pickerId
    if (sub.kind === 'resolving') {
      const step = sub.step
      if (step.kind === 'overboardLifeRing' && step.pendingChars[0]) {
        const ch = step.pendingChars[0]
        return Object.values(state.players).find((p) => p.character === ch)?.id ?? null
      }
      if (step.kind === 'sharkBait') return step.ownerQueue[0] ?? null
      if (step.kind === 'thirst' && step.queue[0]) {
        return Object.values(state.players).find((p) => p.character === step.queue[0]!.char)?.id ?? null
      }
    }
  }
  return null
}
