import { motion } from 'motion/react'
import { BoatSilhouette } from './BoatSilhouette'
import { PlayerCard } from './PlayerCard'
import { ProwIcon, AnchorIcon } from './icons'
import { useGameStore } from '@/store/game-store'
import type { FightRole } from './PlayerCard'
import type { FightState, GameState, PlayerId } from '@/game/types'

/**
 * Линейный ряд банок «нос → корма» (слева → справа). См. docs/design-roadmap.md §4, §6, §9.
 * Внешняя рама — кирпично-красная #7C2424 как в макете.
 *
 * АДАПТИВНОСТЬ: N игроков = N мест. Removed-банки НЕ отображаются вообще.
 * Видны только живые места (включая опустевшие — там был игрок, но труп унесло).
 */
export function BoatView({ state }: { state: GameState }) {
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const currentPlayerId = findCurrentPlayer(state)
  const fight = extractFight(state)
  const liveSeats = state.seats.filter((s) => !s.removed)

  return (
    <section className="relative">
      <div
        className="relative rounded-md p-3 pb-2 shadow-journal"
        style={{
          background: 'linear-gradient(180deg, #7C2424 0%, #5d1818 100%)',
          boxShadow:
            'inset 0 0 0 2px rgba(255,200,180,0.18), inset 0 0 0 4px #4f1313, 0 8px 24px rgba(20, 0, 0, 0.25)',
        }}
      >
        {/* Внутренняя «доска» — пергаментная подложка под ряд банок. */}
        <div
          className="relative rounded-sm px-12 py-4"
          style={{
            background:
              'linear-gradient(180deg, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 100%)',
          }}
        >
          {/* Маркеры носа и кормы — внутри рамы, в зарезервированных колонках. */}
          <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center text-ink-faint">
            <ProwIcon size={32} />
            <span className="mt-1 font-stamp text-[11px] tracking-stamp text-ink">НОС</span>
          </div>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center text-ink-faint">
            <AnchorIcon size={30} />
            <span className="mt-1 font-stamp text-[11px] tracking-stamp text-ink">КОРМА</span>
          </div>

          {/* Стрелка направления гребли (пунктирная). */}
          {/* 
          <div className="pointer-events-none absolute inset-x-12 top-1.5 flex items-center justify-center text-ink-faint/40">
            <div className="flex-1 border-t border-dashed border-ink-faint/40" />
            <span className="mx-2 font-mono text-[9px] uppercase tracking-wider">
              направление хода
            </span>
            <div className="flex-1 border-t border-dashed border-ink-faint/40" />
            <span className="ml-1 text-ink-faint/60">▶</span>
          </div>*/}

          {/* Ряд банок — только не-removed места. */}
          <div className="flex justify-center gap-3 pt-4">
            {liveSeats.map((seat, idx) => {
              const tilt =
                idx === 0
                  ? -1
                  : idx === liveSeats.length - 1
                    ? 1
                    : 0

              if (seat.occupantId === null) {
                return <EmptySeat key={seat.index} index={seat.index} />
              }
              const player = state.players[seat.occupantId]
              if (!player) return null

              const fightRole = roleInFight(player.id, fight)
              const isCurrent = player.id === currentPlayerId
              const isYou = !!myPlayerId && player.id === myPlayerId

              return (
                <motion.div
                  key={seat.index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.35 }}
                  style={{ transform: `translateY(${tilt}px)` }}
                >
                  <PlayerCard
                    state={state}
                    player={player}
                    seatIndex={seat.index}
                    isCurrent={isCurrent}
                    isYou={isYou}
                    fightRole={fightRole}
                  />
                </motion.div>
              )
            })}
          </div>

          {/* Силуэт лодки под рядом. */}
          <div className="mt-1 px-6">
            <BoatSilhouette height={56} />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Опустевшая банка — в ней был игрок, но он погиб и труп унесло за борт.
 * Это уже не «отсутствующее место в сетапе», а игровое событие — банка остаётся в ряду.
 */
function EmptySeat({ index }: { index: number }) {
  return (
    <div className="flex w-[160px] shrink-0 items-center justify-center">
      <div className="flex h-[280px] w-full flex-col items-center justify-center rounded-sm border border-dashed border-ink/30 bg-paper-deep/30 text-center">
        <div className="font-stamp text-[10px] tracking-stamp text-ink-faint">
          Банка #{index + 1}
        </div>
        <div className="mt-2 font-hand text-[15px] text-ink-faint">опустела</div>
        <div className="mt-1 font-serif italic text-[10px] text-ink-faint/70">
          (труп унесло)
        </div>
      </div>
    </div>
  )
}

// === Утилиты ===

function extractFight(state: GameState): FightState | null {
  if (state.phase.kind === 'day' && state.phase.subPhase.kind === 'fight') {
    return state.phase.subPhase.fight
  }
  return null
}

function roleInFight(playerId: PlayerId, fight: FightState | null): FightRole | null {
  if (!fight) return null
  if (playerId === fight.attackerId) return 'attacker'
  if (playerId === fight.defenderId) return 'defender'
  if (fight.attackerAllies.includes(playerId)) return 'ally-of-attacker'
  if (fight.defenderAllies.includes(playerId)) return 'ally-of-defender'
  return 'neutral'
}

function findCurrentPlayer(state: GameState): PlayerId | null {
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
        return (
          Object.values(state.players).find((p) => p.character === step.queue[0]!.char)?.id ??
          null
        )
      }
    }
  }
  return null
}
