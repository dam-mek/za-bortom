// Контекстная панель действий. См. docs/design-roadmap.md §13 (ActionPanel — гибрид).
// Простые действия (ROW/SKIP) — нижняя rail-полоса.
// Сложные формы (FIGHT/SWAP/EVENING/...) — карточные блоки внутри drawer'а.

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import clsx from 'clsx'
import { useGameStore } from '@/store/game-store'
import { characterMeta } from '@/ui/character-meta'
import { SUPPLY_NAME } from '@/ui/icons'
import { SupplyCardTile } from '@/ui/SupplyCardTile'
import {
  OarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CrossedBladesIcon,
  PicklockIcon,
  SeagullIcon,
  WaterDropIcon,
  LifeRingIcon,
  SharkBaitIcon,
  CompassIcon,
} from '@/ui/icons'
import type { CharacterId, SupplyType } from '@/game/constants'
import type {
  GameState,
  NavigationCard,
  Player,
  SupplyCard,
  SupplyInstanceId,
} from '@/game/types'

// ===== Базовая кнопка =====

type ButtonVariant = 'primary' | 'danger' | 'success' | 'ghost' | 'accent'

function Button({
  onClick,
  disabled,
  children,
  variant = 'primary',
  size = 'md',
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}) {
  const palette: Record<ButtonVariant, string> = {
    primary:
      'bg-ink text-paper hover:bg-ink/85 shadow-emboss border border-ink/40',
    danger:
      'bg-card-enemy text-paper hover:bg-card-enemy/90 shadow-emboss border border-card-enemy-deep',
    success:
      'bg-card-nav-shadow text-paper hover:bg-card-nav-shadow/90 shadow-emboss border border-card-nav-shadow',
    accent:
      'bg-accent text-ink font-bold hover:brightness-105 shadow-gold border border-ink/30',
    ghost:
      'bg-paper/40 text-ink hover:bg-paper/70 border border-ink/30',
  }
  const sizing =
    size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-4 py-2 text-[14px]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'rounded-sm font-stamp tracking-stamp uppercase transition disabled:cursor-not-allowed disabled:opacity-30',
        palette[variant],
        sizing,
      )}
    >
      {children}
    </button>
  )
}

// ===== Универсальная карточка-блок =====

function PanelCard({
  title,
  accent,
  children,
}: {
  title: string
  accent?: 'enemy' | 'friend' | 'nav' | 'accent'
  children: React.ReactNode
}) {
  const stripe: Record<string, string> = {
    enemy: 'bg-card-enemy',
    friend: 'bg-card-friend',
    nav: 'bg-card-nav-shadow',
    accent: 'bg-accent',
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-sm border border-ink/25 bg-paper/90 shadow-journal"
    >
      <header className="flex items-center gap-2 border-b border-ink/15 bg-paper-deep/70 px-3.5 py-2">
        <span
          aria-hidden
          className={clsx('h-3 w-3 rounded-full', stripe[accent ?? 'accent'] ?? 'bg-ink')}
        />
        <h3 className="font-stamp text-[14px] tracking-stamp text-ink">
          {title.toUpperCase()}
        </h3>
      </header>
      <div className="p-3">{children}</div>
    </motion.section>
  )
}

function Collapsible({
  label,
  children,
  defaultOpen = false,
}: {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-sm border border-ink/20 bg-paper/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-ink hover:bg-paper-deep/40"
      >
        <span className="font-stamp text-[12px] tracking-stamp">
          {label.toUpperCase()}
        </span>
        {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== Селектор карт (для drawer-форм) =====
// Используется в обертках с onClick. Каждый предмет — полноценная карточка
// SupplyCardTile с SVG-иконкой, названием и info-badge.

function CardChip({
  card,
  onClick,
  selected,
}: {
  card: SupplyCard | undefined
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <SupplyCardTile
      card={card}
      mode={onClick ? 'selectable' : 'open'}
      onClick={onClick}
      selected={selected}
      compact
    />
  )
}

function NavCardChip({ card }: { card: NavigationCard | undefined }) {
  if (!card) {
    return <span className="font-mono text-[10px] text-ink-faint">?</span>
  }
  const tags: { icon: React.ReactNode; label: string; color: string }[] = []
  if (card.seagull === 'normal') {
    tags.push({
      icon: <SeagullIcon size={11} />,
      label: '+1',
      color: 'text-card-enemy',
    })
  }
  if (card.seagull === 'crossed') {
    tags.push({
      icon: <SeagullIcon size={11} />,
      label: 'крест',
      color: 'text-ink-faint',
    })
  }
  if (card.overboard.length) {
    tags.push({
      icon: <LifeRingIcon size={11} />,
      label: card.overboard.map((c) => characterMeta(c).name).join(', '),
      color: 'text-horizon-indigo',
    })
  }
  const thirstParts: string[] = []
  if (card.thirst.rowers) thirstParts.push('гребцы')
  if (card.thirst.fighters) thirstParts.push('бойцы')
  if (card.thirst.named.length)
    thirstParts.push(card.thirst.named.map((c) => characterMeta(c).name).join(', '))
  if (thirstParts.length) {
    tags.push({
      icon: <WaterDropIcon size={11} />,
      label: thirstParts.join('+'),
      color: 'text-card-supply-shadow',
    })
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-ink/25 bg-paper/70 px-2 py-0.5">
      {tags.length === 0 ? (
        <span className="font-serif text-[11px] italic text-ink-faint">
          нейтральная
        </span>
      ) : (
        tags.map((t, i) => (
          <span key={i} className={`inline-flex items-center gap-1 ${t.color}`}>
            {t.icon}
            <span className="font-mono text-[10px]">{t.label}</span>
          </span>
        ))
      )}
    </span>
  )
}

// ===== Селекты =====

function CharSelect({
  value,
  onChange,
  state,
  exclude = [],
}: {
  value: CharacterId | ''
  onChange: (v: CharacterId) => void
  state: GameState
  exclude?: CharacterId[]
}) {
  const chars = Object.values(state.players)
    .map((p) => p.character)
    .filter((c) => !exclude.includes(c))
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CharacterId)}
      className="rounded-sm border border-ink/30 bg-paper px-2 py-1 font-serif text-[12px] text-ink"
    >
      <option value="">— персонаж —</option>
      {chars.map((c) => (
        <option key={c} value={c}>
          {characterMeta(c).name}
        </option>
      ))}
    </select>
  )
}

function SupplySelect({
  player,
  filterKind,
  value,
  onChange,
  state,
}: {
  player: Player
  filterKind?: SupplyType
  value: SupplyInstanceId | ''
  onChange: (v: SupplyInstanceId) => void
  state: GameState
}) {
  const ids = [...player.openSupplies, ...player.closedSupplies].filter((id) => {
    if (!filterKind) return true
    return state.supplyById[id]?.kind === filterKind
  })
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm border border-ink/30 bg-paper px-2 py-1 font-serif text-[12px] text-ink"
    >
      <option value="">— карта —</option>
      {ids.map((id) => {
        const c = state.supplyById[id]
        const open = player.openSupplies.includes(id)
        return (
          <option key={id} value={id}>
            {c ? SUPPLY_NAME[c.kind] : '?'} {open ? '(открыта)' : '(в кармане)'}
          </option>
        )
      })}
    </select>
  )
}

// ===== Подпанели =====

function MorningPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing')
    return null
  const sub = state.phase.subPhase
  const seat = state.seats[sub.currentSeat]
  if (!seat?.occupantId) return null
  const playerId = seat.occupantId
  const player = state.players[playerId]!

  return (
    <PanelCard title="Раздача припасов" accent="nav">
      <div className="mb-2 font-serif text-[12px] text-ink">
        Ход{' '}
        <span className="font-stamp tracking-stamp">{player.displayName}</span>
        {' — '}
        выберите карту из общей кучи:
      </div>
      <div className="flex flex-wrap gap-2">
        {sub.pile.map((sid) => (
          <CardChip
            key={sid}
            card={state.supplyById[sid]}
            onClick={() =>
              dispatch({ kind: 'CHOOSE_SUPPLY', playerId, supplyId: sid })
            }
          />
        ))}
      </div>
    </PanelCard>
  )
}

function DayActionsPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [targetSeat, setTargetSeat] = useState<string>('')
  const [supplyChoice, setSupplyChoice] = useState<string>('')
  const [supplyTarget, setSupplyTarget] = useState<CharacterId | ''>('')

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'waitingForAction')
    return null
  const sub = state.phase.subPhase
  const seat = state.seats[sub.currentSeat]
  if (!seat?.occupantId) return null
  const playerId = seat.occupantId
  const player = state.players[playerId]!

  function dispatchUse(kind: 'USE_FIRST_AID' | 'USE_UMBRELLA') {
    if (!supplyChoice || !supplyTarget) return
    dispatch({
      kind,
      playerId,
      supplyId: supplyChoice,
      targetCharacter: supplyTarget,
    })
    setSupplyChoice('')
    setSupplyTarget('')
  }

  const otherSeats = state.seats
    .filter((s) => !s.removed && s.occupantId && s.occupantId !== playerId)
    .map((s) => s.index)

  return (
    <PanelCard title={`Ход — ${player.displayName}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => dispatch({ kind: 'ROW', playerId })}>
          <span className="inline-flex items-center gap-1">
            <OarIcon size={12} /> Грести
          </span>
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ kind: 'SKIP_TURN', playerId })}>
          Бездельничать
        </Button>
        {player.character === 'shket' && !player.hasUsedShketSteal && (
          <Collapsible label="Шкет: украсть">
            <div className="flex flex-wrap gap-1">
              {otherSeats.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    dispatch({ kind: 'SHKET_STEAL', playerId, targetSeat: s })
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    <PicklockIcon size={11} /> у банки #{s + 1}
                  </span>
                </Button>
              ))}
            </div>
          </Collapsible>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <Collapsible label="Поменяться местами / Ограбить">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetSeat}
              onChange={(e) => setTargetSeat(e.target.value)}
              className="rounded-sm border border-ink/30 bg-paper px-2 py-1 font-serif text-[12px] text-ink"
            >
              <option value="">— банка —</option>
              {otherSeats.map((s) => (
                <option key={s} value={s}>
                  банка #{s + 1} ·{' '}
                  {state.players[state.seats[s]!.occupantId!]?.displayName}
                </option>
              ))}
            </select>
            <Button
              disabled={!targetSeat}
              onClick={() =>
                dispatch({
                  kind: 'OFFER_SWAP',
                  playerId,
                  targetSeat: Number(targetSeat),
                })
              }
            >
              Своп
            </Button>
            <Button
              disabled={!targetSeat}
              variant="danger"
              onClick={() =>
                dispatch({
                  kind: 'OFFER_ROB',
                  playerId,
                  targetSeat: Number(targetSeat),
                })
              }
            >
              Ограбить
            </Button>
          </div>
        </Collapsible>

        <Collapsible label="Использовать припас">
          <div className="flex flex-wrap items-center gap-2">
            <SupplySelect
              player={player}
              value={supplyChoice}
              onChange={setSupplyChoice}
              state={state}
            />
            <CharSelect
              value={supplyTarget}
              onChange={setSupplyTarget}
              state={state}
            />
            <Button onClick={() => dispatchUse('USE_FIRST_AID')}>Аптечка</Button>
            <Button onClick={() => dispatchUse('USE_UMBRELLA')}>Зонт</Button>
            <Button
              variant="danger"
              onClick={() =>
                supplyChoice &&
                dispatch({ kind: 'USE_FLARE', playerId, supplyId: supplyChoice })
              }
            >
              Ракета
            </Button>
          </div>
        </Collapsible>
      </div>
    </PanelCard>
  )
}

function RowingPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [selected, setSelected] = useState<string[]>([])

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'rowing')
    return null
  const sub = state.phase.subPhase
  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }
  return (
    <PanelCard title="Гребля — выбор карт навигации" accent="nav">
      <div className="mb-2 font-serif text-[12px] text-ink">
        {state.players[sub.playerId]?.displayName} тянет{' '}
        <span className="font-mono font-bold">{sub.drawn.length}</span> карт.
        Отметьте те, которые хотите оставить вечером (остальные пойдут в сброс).
      </div>
      <div className="space-y-1">
        {sub.drawn.map((id) => {
          const checked = selected.includes(id)
          return (
            <label
              key={id}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1 transition',
                checked
                  ? 'border-accent bg-accent/15'
                  : 'border-ink/20 bg-paper/40 hover:bg-paper/70',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                className="accent-card-enemy"
              />
              <NavCardChip card={state.navById[id]} />
            </label>
          )
        })}
      </div>
      <div className="mt-3">
        <Button
          variant="accent"
          onClick={() => {
            dispatch({
              kind: 'ROW_KEEP_CARDS',
              playerId: sub.playerId,
              cardIds: selected,
            })
            setSelected([])
          }}
        >
          Оставить выбранные ({selected.length})
        </Button>
      </div>
    </PanelCard>
  )
}

function ProposalPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'day') return null
  const sub = state.phase.subPhase
  if (sub.kind !== 'awaitingSwapResponse' && sub.kind !== 'awaitingRobResponse')
    return null
  const defenderId = state.seats[sub.targetSeat]?.occupantId
  if (!defenderId) return null
  const defender = state.players[defenderId]!
  const attacker = state.players[sub.attackerId]!
  return (
    <PanelCard
      title={sub.kind === 'awaitingSwapResponse' ? 'Предложение свопа' : 'Предложение ограбления'}
      accent="enemy"
    >
      <div className="mb-3 font-serif text-[13px] text-ink">
        <span className="font-hand text-[18px] text-card-enemy-deep">
          {attacker.displayName}
        </span>{' '}
        →{' '}
        <span className="font-hand text-[18px] text-ink">
          {defender.displayName}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="success"
          onClick={() =>
            dispatch({ kind: 'PROPOSAL_ACCEPT', playerId: defenderId })
          }
        >
          Принять
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            dispatch({ kind: 'PROPOSAL_REJECT', playerId: defenderId })
          }
        >
          <span className="inline-flex items-center gap-1">
            <CrossedBladesIcon size={12} /> Отказать (драка)
          </span>
        </Button>
      </div>
    </PanelCard>
  )
}

function RobPickPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'completingRobPick')
    return null
  const sub = state.phase.subPhase
  const victim = state.players[state.seats[sub.targetSeat]?.occupantId ?? '']
  if (!victim) return null
  return (
    <PanelCard title="Выбор добычи" accent="enemy">
      <div className="mb-2 font-serif text-[12px] text-ink">
        {state.players[sub.attackerId]?.displayName} грабит{' '}
        <span className="font-hand text-[16px]">{victim.displayName}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {victim.openSupplies.map((id) => (
          <CardChip
            key={id}
            card={state.supplyById[id]}
            onClick={() =>
              dispatch({
                kind: 'ROB_PICK',
                playerId: sub.attackerId,
                pick: { kind: 'open', supplyId: id },
              })
            }
          />
        ))}
        <Button
          disabled={victim.closedSupplies.length === 0}
          variant="danger"
          onClick={() =>
            dispatch({
              kind: 'ROB_PICK',
              playerId: sub.attackerId,
              pick: { kind: 'closed' },
            })
          }
        >
          Случайная из закрытых ({victim.closedSupplies.length})
        </Button>
      </div>
    </PanelCard>
  )
}

function FightPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [allyTarget, setAllyTarget] = useState<CharacterId | ''>('')
  const [weaponSid, setWeaponSid] = useState<string>('')

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'fight')
    return null
  const f = state.phase.subPhase.fight
  const atk = state.players[f.attackerId]!
  const def = state.players[f.defenderId]!
  const participants = [
    atk,
    def,
    ...f.attackerAllies.map((id) => state.players[id]!),
    ...f.defenderAllies.map((id) => state.players[id]!),
  ]

  return (
    <PanelCard title="Драка" accent="enemy">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-sm bg-card-enemy/15 p-2">
          <div className="font-stamp text-[9px] uppercase tracking-stamp text-card-enemy-deep">
            атакующий
          </div>
          <div className="font-hand text-[18px] text-ink">{atk.displayName}</div>
          <div className="font-mono text-[10px] text-ink-faint">
            + {f.attackerAllies.length} союзн. · оружий {f.attackerWeapons.length}
          </div>
        </div>
        <div className="rounded-sm bg-card-supply/15 p-2">
          <div className="font-stamp text-[9px] uppercase tracking-stamp text-card-supply-shadow">
            защитник
          </div>
          <div className="font-hand text-[18px] text-ink">{def.displayName}</div>
          <div className="font-mono text-[10px] text-ink-faint">
            + {f.defenderAllies.length} союзн. · оружий {f.defenderWeapons.length}
          </div>
        </div>
      </div>

      {f.pendingAlly && (
        <div className="mb-3 rounded-sm border border-accent/50 bg-accent/15 p-2">
          <div className="mb-2 font-serif text-[12px] text-ink">
            {state.players[f.pendingAlly.invitedId]?.displayName} приглашён за{' '}
            <span className="font-bold">
              {f.pendingAlly.side === 'attacker' ? 'атакующего' : 'защитника'}
            </span>
            . Ответ:
          </div>
          <div className="flex gap-2">
            <Button
              variant="success"
              onClick={() =>
                dispatch({
                  kind: 'FIGHT_ALLY_RESPONSE',
                  playerId: f.pendingAlly!.invitedId,
                  accept: true,
                  weapons: [],
                })
              }
            >
              Принять
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                dispatch({
                  kind: 'FIGHT_ALLY_RESPONSE',
                  playerId: f.pendingAlly!.invitedId,
                  accept: false,
                  weapons: [],
                })
              }
            >
              Отказаться
            </Button>
          </div>
        </div>
      )}

      {!f.pendingAlly && !f.recruitmentClosed && (
        <Collapsible label="Пригласить союзника">
          <div className="flex flex-wrap items-center gap-2">
            <CharSelect
              value={allyTarget}
              onChange={setAllyTarget}
              state={state}
            />
            <Button
              size="sm"
              disabled={!allyTarget}
              onClick={() => {
                dispatch({
                  kind: 'FIGHT_RECRUIT_ALLY',
                  playerId: f.attackerId,
                  targetCharacter: allyTarget as CharacterId,
                  side: 'attacker',
                })
                setAllyTarget('')
              }}
            >
              За {atk.displayName}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!allyTarget}
              onClick={() => {
                dispatch({
                  kind: 'FIGHT_RECRUIT_ALLY',
                  playerId: f.defenderId,
                  targetCharacter: allyTarget as CharacterId,
                  side: 'defender',
                })
                setAllyTarget('')
              }}
            >
              За {def.displayName}
            </Button>
          </div>
        </Collapsible>
      )}

      <div className="mt-2">
        <Collapsible label="Добавить оружие">
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12px]">
                <span className="w-28 font-hand text-[14px] text-ink">
                  {p.displayName}
                </span>
                <SupplySelect
                  player={p}
                  value={weaponSid}
                  onChange={setWeaponSid}
                  state={state}
                />
                <Button
                  size="sm"
                  disabled={!weaponSid}
                  onClick={() => {
                    dispatch({
                      kind: 'FIGHT_ADD_WEAPON',
                      playerId: p.id,
                      weaponSupplyId: weaponSid,
                    })
                    setWeaponSid('')
                  }}
                >
                  +
                </Button>
              </div>
            ))}
          </div>
        </Collapsible>
      </div>

      <div className="mt-3">
        <Button
          variant="accent"
          onClick={() =>
            dispatch({ kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: f.attackerId })
          }
        >
          Завершить набор · решить
        </Button>
      </div>
    </PanelCard>
  )
}

function EveningPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'evening') return null
  const sub = state.phase.subPhase

  if (sub.kind === 'sternPicking') {
    const picker = state.players[sub.pickerId]!
    return (
      <PanelCard title="Вечер — выбор карты" accent="friend">
        <div className="mb-2 font-serif text-[12px] text-ink">
          {picker.displayName} (банка от кормы) выбирает карту навигации.
        </div>
        {sub.pool.length === 0 ? (
          <Button
            onClick={() =>
              dispatch({
                kind: 'EVENING_SELECT_NAV_CARD',
                playerId: sub.pickerId,
                navCardId: '',
              })
            }
          >
            Пул пуст — верх колоды
          </Button>
        ) : (
          <div className="space-y-1">
            {sub.pool.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  dispatch({
                    kind: 'EVENING_SELECT_NAV_CARD',
                    playerId: sub.pickerId,
                    navCardId: id,
                  })
                }
                className="block w-full rounded-sm border border-ink/20 bg-paper/60 px-2 py-1 text-left hover:bg-paper"
              >
                <NavCardChip card={state.navById[id]} />
              </button>
            ))}
          </div>
        )}
        {!sub.compassUsed &&
          picker.openSupplies.some(
            (sid) => state.supplyById[sid]?.kind === 'compass',
          ) && (
            <div className="mt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  const compassSid = picker.openSupplies.find(
                    (sid) => state.supplyById[sid]?.kind === 'compass',
                  )!
                  dispatch({
                    kind: 'EVENING_USE_COMPASS',
                    playerId: sub.pickerId,
                    supplyId: compassSid,
                  })
                }}
              >
                <span className="inline-flex items-center gap-1">
                  <CompassIcon size={12} /> использовать компас
                </span>
              </Button>
            </div>
          )}
      </PanelCard>
    )
  }

  // resolving
  const step = sub.step
  if (step.kind === 'overboardLifeRing') {
    const ch = step.pendingChars[0]
    if (!ch) return <PanelCard title="Применение"><span className="font-serif text-[12px]">…</span></PanelCard>
    const p = Object.values(state.players).find((p) => p.character === ch)
    if (!p) return null
    const closedRing = p.closedSupplies.find(
      (sid) => state.supplyById[sid]?.kind === 'life_ring',
    )
    return (
      <PanelCard title="За борт" accent="enemy">
        <div className="mb-2 font-serif text-[13px] text-ink">
          {p.displayName} ({characterMeta(ch).name}) падает за борт.
          {closedRing && ' Есть закрытый круг — открыть?'}
        </div>
        <div className="flex gap-2">
          {closedRing && (
            <Button
              variant="success"
              onClick={() =>
                dispatch({
                  kind: 'USE_LIFE_RING',
                  playerId: p.id,
                  supplyId: closedRing,
                  targetCharacter: ch,
                })
              }
            >
              <span className="inline-flex items-center gap-1">
                <LifeRingIcon size={12} /> спастись
              </span>
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() =>
              dispatch({ kind: 'EVENING_SKIP_LIFE_RING', playerId: p.id })
            }
          >
            Пропустить
          </Button>
        </div>
      </PanelCard>
    )
  }
  if (step.kind === 'sharkBait') {
    const ownerId = step.ownerQueue[0]
    if (!ownerId) return null
    const owner = state.players[ownerId]!
    const baitSid = owner.openSupplies.find(
      (sid) => state.supplyById[sid]?.kind === 'shark_bait',
    )
    return (
      <PanelCard title="Акулы" accent="enemy">
        <div className="mb-2 font-serif text-[13px] text-ink">
          За бортом:{' '}
          {step.overboardChars.map((c) => characterMeta(c).name).join(', ')}.
          У {owner.displayName} открытая приманка — применить?
        </div>
        <div className="flex gap-2">
          {baitSid && (
            <Button
              variant="danger"
              onClick={() =>
                dispatch({
                  kind: 'EVENING_USE_SHARK_BAIT',
                  playerId: ownerId,
                  supplyId: baitSid,
                })
              }
            >
              <span className="inline-flex items-center gap-1">
                <SharkBaitIcon size={12} /> применить
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              dispatch({ kind: 'EVENING_SKIP_SHARK_BAIT', playerId: ownerId })
            }
          >
            Пропустить
          </Button>
        </div>
      </PanelCard>
    )
  }
  if (step.kind === 'thirst') {
    const head = step.queue[0]
    if (!head) return null
    const target = Object.values(state.players).find((p) => p.character === head.char)
    if (!target) return null
    const conscious = Object.values(state.players).filter(
      (p) => p.consciousness === 'conscious',
    )
    return (
      <PanelCard title="Жажда" accent="nav">
        <div className="mb-2 font-serif text-[13px] text-ink">
          {target.displayName} ({characterMeta(head.char).name}) — осталось{' '}
          <span className="font-bold text-card-enemy">{head.remainingWounds}</span>{' '}
          ран. Кто даст воду?
        </div>
        <div className="flex flex-wrap gap-2">
          {conscious.map((giver) => {
            const waterSid = [...giver.openSupplies, ...giver.closedSupplies].find(
              (sid) => state.supplyById[sid]?.kind === 'water',
            )
            if (!waterSid) return null
            return (
              <Button
                key={giver.id}
                variant="success"
                onClick={() =>
                  dispatch({
                    kind: 'EVENING_USE_WATER',
                    playerId: giver.id,
                    supplyId: waterSid,
                    targetCharacter: head.char,
                  })
                }
              >
                <span className="inline-flex items-center gap-1">
                  <WaterDropIcon size={12} /> {giver.displayName}
                </span>
              </Button>
            )
          })}
          <Button
            variant="ghost"
            onClick={() =>
              dispatch({
                kind: 'EVENING_DECLINE_WATER',
                playerId: conscious[0]!.id,
                targetCharacter: head.char,
              })
            }
          >
            Никто не даёт
          </Button>
        </div>
      </PanelCard>
    )
  }
  return null
}

function ScoringPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'scoring') return null
  return (
    <PanelCard title="Четыре чайки — игра окончена" accent="enemy">
      <div className="mb-2 font-serif text-[13px] text-ink">
        Все жетоны чаек выпали. Самое время свести итоги.
      </div>
      <Button variant="accent" onClick={() => dispatch({ kind: 'PHASE_ADVANCE' })}>
        Подсчитать
      </Button>
    </PanelCard>
  )
}

function FinishedPanel({ state }: { state: GameState }) {
  if (state.phase.kind !== 'finished') return null
  const scores = state.finalScores
  const winner =
    state.winner === 'sea'
      ? 'Море. Никто не выжил.'
      : state.winner === 'tie'
        ? 'Ничья'
        : state.winner
          ? state.players[state.winner]?.displayName ?? state.winner
          : '—'
  return (
    <PanelCard title="Победитель" accent="accent">
      <div className="mb-3 font-hand text-[28px] leading-none text-ink">
        {winner}
      </div>
      {scores && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-paper-deep/40">
                <th className="border border-ink/20 px-2 py-1 text-left font-stamp text-[10px] tracking-stamp">
                  Игрок
                </th>
                <th className="border border-ink/20 px-2 py-1 text-right">Выж.</th>
                <th className="border border-ink/20 px-2 py-1 text-right">Ценн.</th>
                <th className="border border-ink/20 px-2 py-1 text-right">Друг</th>
                <th className="border border-ink/20 px-2 py-1 text-right">Враг</th>
                <th className="border border-ink/20 px-2 py-1 text-right">Психо.</th>
                <th className="border border-ink/20 px-2 py-1 text-right font-bold">
                  Итого
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(scores).map(([pid, b]) => {
                const p = state.players[pid]
                if (!p) return null
                const val = b.valuables.reduce((a, v) => a + v.value, 0)
                return (
                  <tr key={pid} className="border-t border-ink/20">
                    <td className="border border-ink/20 px-2 py-1">
                      <span className="font-hand text-[14px]">{p.displayName}</span>{' '}
                      <span className="font-mono text-[9px] text-ink-faint">
                        ({characterMeta(p.character).name})
                      </span>
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                      {b.survival}
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                      {val}
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                      {b.bestFriendBonus?.points ?? 0}
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                      {b.worstEnemyBonus?.points ?? 0}
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                      {b.psychopathDeathBonus.points}
                    </td>
                    <td className="border border-ink/20 px-2 py-1 text-right font-mono font-bold">
                      {b.total}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  )
}

// ===== Главный компонент =====

export function ActionPanel({ state }: { state: GameState }) {
  return (
    <div className="flex flex-col gap-2">
      <MorningPanel state={state} />
      <DayActionsPanel state={state} />
      <RowingPanel state={state} />
      <ProposalPanel state={state} />
      <RobPickPanel state={state} />
      <FightPanel state={state} />
      <EveningPanel state={state} />
      <ScoringPanel state={state} />
      <FinishedPanel state={state} />
    </div>
  )
}
