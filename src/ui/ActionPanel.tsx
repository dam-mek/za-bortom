// Контекстная панель действий. Рендерится в зависимости от текущей подфазы.
// Не претендует на красоту — всё кнопками, без анимаций. Для тестирования логики.

import { useState } from 'react'
import { useGameStore } from '@/store/game-store'
import type { CharacterId, SupplyType } from '@/game/constants'
import type { GameState, NavigationCard, Player, SupplyCard, SupplyInstanceId } from '@/game/types'

function Button({
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'success'
}) {
  const colors =
    variant === 'danger'
      ? 'bg-red-700 hover:bg-red-600'
      : variant === 'success'
        ? 'bg-green-700 hover:bg-green-600'
        : 'bg-sea-700 hover:bg-sea-500'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colors} disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm`}
    >
      {children}
    </button>
  )
}

function describeCard(card: SupplyCard | undefined): string {
  if (!card) return '?'
  const labels: Record<SupplyType, string> = {
    water: '💧вода',
    first_aid: '➕аптечка',
    umbrella: '☂️зонт',
    flare: '🔫ракета',
    compass: '🧭компас',
    life_ring: '🛟круг',
    oar: '🚣весло',
    shark_bait: '🦈приманка',
    club: '🥢дубинка',
    hook: '🪝багор',
    knife: '🔪нож',
    money: '💵деньги',
    jewelry: '💎украшения',
    painting: '🖼️картина',
  }
  return labels[card.kind] ?? card.kind
}

function describeNav(card: NavigationCard | undefined): string {
  if (!card) return '?'
  const parts: string[] = []
  if (card.seagull === 'normal') parts.push('🪶+')
  if (card.seagull === 'crossed') parts.push('🪶−')
  if (card.overboard.length) parts.push(`🌊 ${card.overboard.join(',')}`)
  const t = card.thirst
  const thirstParts: string[] = []
  if (t.rowers) thirstParts.push('гребцы')
  if (t.fighters) thirstParts.push('бойцы')
  if (t.named.length) thirstParts.push(t.named.join(','))
  if (thirstParts.length) parts.push(`💧 ${thirstParts.join('+')}`)
  return parts.join(' / ') || '— нейтральная —'
}

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
      className="bg-sea-700 rounded px-2 py-1 text-sm"
    >
      <option value="">— персонаж —</option>
      {chars.map((c) => (
        <option key={c} value={c}>
          {c}
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
      className="bg-sea-700 rounded px-2 py-1 text-sm"
    >
      <option value="">— карта —</option>
      {ids.map((id) => (
        <option key={id} value={id}>
          {describeCard(state.supplyById[id])} ({player.openSupplies.includes(id) ? 'O' : 'C'})
        </option>
      ))}
    </select>
  )
}

// ----------------------------------------------------------------------------
// Sub-panels per phase
// ----------------------------------------------------------------------------

function MorningPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'morning' || state.phase.subPhase.kind !== 'distributing') return null
  const sub = state.phase.subPhase
  const seat = state.seats[sub.currentSeat]
  if (!seat?.occupantId) return null
  const playerId = seat.occupantId
  return (
    <div className="space-y-2">
      <div>🌅 Утро · ход банки [{sub.currentSeat}] · {state.players[playerId]?.displayName}</div>
      <div className="flex flex-wrap gap-2">
        {sub.pile.map((sid) => (
          <Button
            key={sid}
            onClick={() => dispatch({ kind: 'CHOOSE_SUPPLY', playerId, supplyId: sid })}
          >
            Взять: {describeCard(state.supplyById[sid])}
          </Button>
        ))}
      </div>
    </div>
  )
}

function DayActionsPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [targetSeat, setTargetSeat] = useState<string>('')
  const [supplyChoice, setSupplyChoice] = useState<string>('')
  const [supplyTarget, setSupplyTarget] = useState<CharacterId | ''>('')

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'waitingForAction') return null
  const sub = state.phase.subPhase
  const seat = state.seats[sub.currentSeat]
  if (!seat?.occupantId) return null
  const playerId = seat.occupantId
  const player = state.players[playerId]!

  function dispatchUse(kind: 'USE_FIRST_AID' | 'USE_UMBRELLA') {
    if (!supplyChoice || !supplyTarget) return
    dispatch({ kind, playerId, supplyId: supplyChoice, targetCharacter: supplyTarget })
    setSupplyChoice('')
    setSupplyTarget('')
  }

  const allSeats = state.seats
    .filter((s) => !s.removed && s.occupantId && s.occupantId !== playerId)
    .map((s) => s.index)

  return (
    <div className="space-y-3">
      <div>☀️ День · ход [{sub.currentSeat}] · {player.displayName}</div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => dispatch({ kind: 'ROW', playerId })}>🚣 Погрести</Button>
        <Button onClick={() => dispatch({ kind: 'SKIP_TURN', playerId })}>⏭ Бездельничать</Button>
        {player.character === 'shket' && !player.hasUsedShketSteal && (
          <details className="inline-block">
            <summary className="cursor-pointer bg-purple-700 hover:bg-purple-600 px-3 py-1.5 rounded text-sm">
              🥷 Шкет: украсть
            </summary>
            <div className="mt-2 p-2 bg-sea-800 rounded flex flex-wrap gap-1">
              {allSeats.map((s) => (
                <Button
                  key={s}
                  onClick={() => dispatch({ kind: 'SHKET_STEAL', playerId, targetSeat: s })}
                >
                  у банки [{s}]
                </Button>
              ))}
            </div>
          </details>
        )}
      </div>

      <details>
        <summary className="cursor-pointer text-sm bg-sea-800 px-3 py-1.5 rounded inline-block">
          ⚔️ Поменяться местами / Ограбить
        </summary>
        <div className="mt-2 p-2 bg-sea-800 rounded flex gap-2 items-center flex-wrap">
          <select
            value={targetSeat}
            onChange={(e) => setTargetSeat(e.target.value)}
            className="bg-sea-700 rounded px-2 py-1 text-sm"
          >
            <option value="">— банка —</option>
            {allSeats.map((s) => (
              <option key={s} value={s}>
                банка [{s}] · {state.players[state.seats[s]!.occupantId!]?.displayName}
              </option>
            ))}
          </select>
          <Button
            disabled={!targetSeat}
            onClick={() => dispatch({ kind: 'OFFER_SWAP', playerId, targetSeat: Number(targetSeat) })}
          >
            OFFER_SWAP
          </Button>
          <Button
            disabled={!targetSeat}
            onClick={() => dispatch({ kind: 'OFFER_ROB', playerId, targetSeat: Number(targetSeat) })}
          >
            OFFER_ROB
          </Button>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-sm bg-sea-800 px-3 py-1.5 rounded inline-block">
          📦 Использовать припас
        </summary>
        <div className="mt-2 p-2 bg-sea-800 rounded space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <SupplySelect player={player} value={supplyChoice} onChange={setSupplyChoice} state={state} />
            <CharSelect value={supplyTarget} onChange={setSupplyTarget} state={state} />
            <Button onClick={() => dispatchUse('USE_FIRST_AID')}>FIRST_AID</Button>
            <Button onClick={() => dispatchUse('USE_UMBRELLA')}>UMBRELLA</Button>
            <Button
              onClick={() => supplyChoice && dispatch({ kind: 'USE_FLARE', playerId, supplyId: supplyChoice })}
            >
              FLARE
            </Button>
          </div>
        </div>
      </details>
    </div>
  )
}

function RowingPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [selected, setSelected] = useState<string[]>([])

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'rowing') return null
  const sub = state.phase.subPhase
  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }
  return (
    <div className="space-y-2">
      <div>
        🚣 Гребля · {state.players[sub.playerId]?.displayName} тянет {sub.drawn.length} карт навигации
      </div>
      <div className="space-y-1">
        {sub.drawn.map((id) => (
          <label key={id} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
            <span className="text-sm">{describeNav(state.navById[id])}</span>
          </label>
        ))}
      </div>
      <Button
        onClick={() => {
          dispatch({ kind: 'ROW_KEEP_CARDS', playerId: sub.playerId, cardIds: selected })
          setSelected([])
        }}
      >
        Оставить выбранные ({selected.length})
      </Button>
    </div>
  )
}

function ProposalPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'day') return null
  const sub = state.phase.subPhase
  if (sub.kind !== 'awaitingSwapResponse' && sub.kind !== 'awaitingRobResponse') return null
  const defenderId = state.seats[sub.targetSeat]?.occupantId
  if (!defenderId) return null
  const defender = state.players[defenderId]!
  return (
    <div className="space-y-2">
      <div>
        🤝 Предложение {sub.kind === 'awaitingSwapResponse' ? 'свопа' : 'ограбления'} от{' '}
        {state.players[sub.attackerId]?.displayName} → {defender.displayName}
      </div>
      <div className="flex gap-2">
        <Button variant="success" onClick={() => dispatch({ kind: 'PROPOSAL_ACCEPT', playerId: defenderId })}>
          Принять
        </Button>
        <Button variant="danger" onClick={() => dispatch({ kind: 'PROPOSAL_REJECT', playerId: defenderId })}>
          Отказать (→ драка)
        </Button>
      </div>
    </div>
  )
}

function RobPickPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'completingRobPick') return null
  const sub = state.phase.subPhase
  const victim = state.players[state.seats[sub.targetSeat]?.occupantId ?? '']
  if (!victim) return null
  return (
    <div className="space-y-2">
      <div>
        🪤 {state.players[sub.attackerId]?.displayName} грабит {victim.displayName}: выбери карту
      </div>
      <div className="flex flex-wrap gap-2">
        {victim.openSupplies.map((id) => (
          <Button
            key={id}
            onClick={() =>
              dispatch({
                kind: 'ROB_PICK',
                playerId: sub.attackerId,
                pick: { kind: 'open', supplyId: id },
              })
            }
          >
            Открытая: {describeCard(state.supplyById[id])}
          </Button>
        ))}
        <Button
          disabled={victim.closedSupplies.length === 0}
          onClick={() =>
            dispatch({ kind: 'ROB_PICK', playerId: sub.attackerId, pick: { kind: 'closed' } })
          }
        >
          Случайная из закрытых ({victim.closedSupplies.length})
        </Button>
      </div>
    </div>
  )
}

function FightPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const [allyTarget, setAllyTarget] = useState<CharacterId | ''>('')
  const [weaponSid, setWeaponSid] = useState<string>('')

  if (state.phase.kind !== 'day' || state.phase.subPhase.kind !== 'fight') return null
  const f = state.phase.subPhase.fight
  const atk = state.players[f.attackerId]!
  const def = state.players[f.defenderId]!

  return (
    <div className="space-y-3">
      <div className="bg-red-900/40 p-3 rounded">
        ⚔️ Драка ({f.reason}) · банка [{f.targetSeat}]
        <div className="text-sm mt-1">
          <span className="text-red-300">Атакующий:</span> {atk.displayName} + {f.attackerAllies.length} союзников ·
          оружий: {f.attackerWeapons.length}
        </div>
        <div className="text-sm">
          <span className="text-blue-300">Защитник:</span> {def.displayName} + {f.defenderAllies.length} союзников ·
          оружий: {f.defenderWeapons.length}
        </div>
        {f.pendingAlly && (
          <div className="text-yellow-300 text-sm mt-1">
            ⏳ Приглашён {state.players[f.pendingAlly.invitedId]?.displayName} (за{' '}
            {f.pendingAlly.side === 'attacker' ? 'атакующего' : 'защитника'})
          </div>
        )}
      </div>

      {f.pendingAlly && (
        <div className="bg-sea-800 p-2 rounded">
          <div className="text-sm mb-2">
            Ответ от {state.players[f.pendingAlly.invitedId]?.displayName}:
          </div>
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
            Принять (без оружия)
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
      )}

      {!f.pendingAlly && (
        <details>
          <summary className="cursor-pointer text-sm bg-sea-800 px-3 py-1.5 rounded inline-block">
            Пригласить союзника
          </summary>
          <div className="mt-2 p-2 bg-sea-800 rounded flex gap-2 items-center">
            <CharSelect value={allyTarget} onChange={setAllyTarget} state={state} />
            <Button
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
              Атакующему ({atk.displayName})
            </Button>
            <Button
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
              Защитнику ({def.displayName})
            </Button>
          </div>
        </details>
      )}

      <details>
        <summary className="cursor-pointer text-sm bg-sea-800 px-3 py-1.5 rounded inline-block">
          Добавить оружие
        </summary>
        <div className="mt-2 p-2 bg-sea-800 rounded space-y-2">
          {[atk, def, ...f.attackerAllies.map((id) => state.players[id]!), ...f.defenderAllies.map((id) => state.players[id]!)].map(
            (p) => (
              <div key={p.id} className="flex gap-2 items-center text-sm">
                <span className="w-24">{p.displayName}:</span>
                <SupplySelect
                  player={p}
                  value={weaponSid}
                  onChange={setWeaponSid}
                  state={state}
                />
                <Button
                  disabled={!weaponSid}
                  onClick={() => {
                    dispatch({ kind: 'FIGHT_ADD_WEAPON', playerId: p.id, weaponSupplyId: weaponSid })
                    setWeaponSid('')
                  }}
                >
                  Добавить
                </Button>
              </div>
            ),
          )}
        </div>
      </details>

      <Button
        variant="danger"
        onClick={() => dispatch({ kind: 'FIGHT_CLOSE_RECRUITMENT', playerId: f.attackerId })}
      >
        ✅ Завершить набор и решить
      </Button>
    </div>
  )
}

function EveningPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'evening') return null
  const sub = state.phase.subPhase

  if (sub.kind === 'sternPicking') {
    const picker = state.players[sub.pickerId]!
    return (
      <div className="space-y-2">
        <div>
          🌅 Вечер · {picker.displayName} (банка от кормы) выбирает карту навигации
        </div>
        {sub.pool.length === 0 ? (
          <Button
            onClick={() =>
              dispatch({
                kind: 'EVENING_SELECT_NAV_CARD',
                playerId: sub.pickerId,
                navCardId: '' /* triggers reducer to take from top */,
              })
            }
          >
            Pool пуст — взять верх колоды
          </Button>
        ) : (
          <div className="space-y-1">
            {sub.pool.map((id) => (
              <Button
                key={id}
                onClick={() =>
                  dispatch({ kind: 'EVENING_SELECT_NAV_CARD', playerId: sub.pickerId, navCardId: id })
                }
              >
                Раскрыть: {describeNav(state.navById[id])}
              </Button>
            ))}
          </div>
        )}
        {!sub.compassUsed &&
          picker.openSupplies.some((sid) => state.supplyById[sid]?.kind === 'compass') && (
            <Button
              onClick={() => {
                const compassSid = picker.openSupplies.find(
                  (sid) => state.supplyById[sid]?.kind === 'compass',
                )!
                dispatch({ kind: 'EVENING_USE_COMPASS', playerId: sub.pickerId, supplyId: compassSid })
              }}
            >
              🧭 Использовать компас (+1 карта)
            </Button>
          )}
      </div>
    )
  }

  // resolving
  const step = sub.step
  if (step.kind === 'overboardLifeRing') {
    const ch = step.pendingChars[0]
    if (!ch) return <div>Применяется падение за борт…</div>
    const p = Object.values(state.players).find((p) => p.character === ch)
    if (!p) return null
    const closedRing = p.closedSupplies.find((sid) => state.supplyById[sid]?.kind === 'life_ring')
    return (
      <div className="space-y-2">
        <div className="text-yellow-300">
          🌊 {p.displayName} ({ch}) падает за борт. Есть закрытый круг — открыть?
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
              🛟 Открыть круг (спастись)
            </Button>
          )}
          <Button variant="danger" onClick={() => dispatch({ kind: 'EVENING_SKIP_LIFE_RING', playerId: p.id })}>
            Пропустить (упасть)
          </Button>
        </div>
      </div>
    )
  }
  if (step.kind === 'sharkBait') {
    const ownerId = step.ownerQueue[0]
    if (!ownerId) return null
    const owner = state.players[ownerId]!
    const baitSid = owner.openSupplies.find((sid) => state.supplyById[sid]?.kind === 'shark_bait')
    return (
      <div className="space-y-2">
        <div className="text-orange-300">
          🦈 За бортом: {step.overboardChars.join(', ')}. У {owner.displayName} открытая приманка — использовать?
        </div>
        <div className="flex gap-2">
          {baitSid && (
            <Button
              variant="danger"
              onClick={() => dispatch({ kind: 'EVENING_USE_SHARK_BAIT', playerId: ownerId, supplyId: baitSid })}
            >
              🦈 Использовать (+1 рана всем за бортом)
            </Button>
          )}
          <Button onClick={() => dispatch({ kind: 'EVENING_SKIP_SHARK_BAIT', playerId: ownerId })}>
            Пропустить
          </Button>
        </div>
      </div>
    )
  }
  if (step.kind === 'thirst') {
    const head = step.queue[0]
    if (!head) return null
    const target = Object.values(state.players).find((p) => p.character === head.char)
    if (!target) return null
    const consciousPlayers = Object.values(state.players).filter((p) => p.consciousness === 'conscious')
    return (
      <div className="space-y-2">
        <div className="text-blue-300">
          💧 Жажда у {target.displayName} ({head.char}) — осталось {head.remainingWounds} ран.
          Кто-нибудь использует воду?
        </div>
        <div className="space-y-1">
          {consciousPlayers.map((giver) => {
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
                {giver.displayName} даёт воду
              </Button>
            )
          })}
          <Button
            variant="danger"
            onClick={() =>
              dispatch({
                kind: 'EVENING_DECLINE_WATER',
                playerId: consciousPlayers[0]!.id,
                targetCharacter: head.char,
              })
            }
          >
            Никто не даёт (зонтик/рана)
          </Button>
        </div>
      </div>
    )
  }
  return null
}

function ScoringPanel({ state }: { state: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch)
  if (state.phase.kind !== 'scoring') return null
  return (
    <div className="space-y-2">
      <div>🏁 4 чайки — игра окончена. Подсчёт очков?</div>
      <Button onClick={() => dispatch({ kind: 'PHASE_ADVANCE' })}>Подсчитать очки</Button>
    </div>
  )
}

function FinishedPanel({ state }: { state: GameState }) {
  if (state.phase.kind !== 'finished') return null
  const scores = state.finalScores
  return (
    <div className="space-y-2">
      <div className="text-2xl font-semibold">
        🏆 Победитель:{' '}
        {state.winner === 'sea'
          ? 'море (никто не выжил)'
          : state.winner === 'tie'
            ? 'ничья'
            : state.players[state.winner ?? '']?.displayName ?? state.winner}
      </div>
      {scores && (
        <table className="w-full text-sm border border-sea-700">
          <thead>
            <tr className="bg-sea-700">
              <th className="px-2 py-1 text-left">Игрок</th>
              <th className="px-2 py-1 text-right">Выживание</th>
              <th className="px-2 py-1 text-right">Ценности</th>
              <th className="px-2 py-1 text-right">Друг</th>
              <th className="px-2 py-1 text-right">Враг</th>
              <th className="px-2 py-1 text-right">Психопат</th>
              <th className="px-2 py-1 text-right">Итого</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(scores).map(([pid, b]) => {
              const p = state.players[pid]
              if (!p) return null
              const val = b.valuables.reduce((a, v) => a + v.value, 0)
              return (
                <tr key={pid} className="border-t border-sea-700">
                  <td className="px-2 py-1">{p.displayName} ({p.character})</td>
                  <td className="px-2 py-1 text-right">{b.survival}</td>
                  <td className="px-2 py-1 text-right">{val}</td>
                  <td className="px-2 py-1 text-right">{b.bestFriendBonus?.points ?? 0}</td>
                  <td className="px-2 py-1 text-right">{b.worstEnemyBonus?.points ?? 0}</td>
                  <td className="px-2 py-1 text-right">{b.psychopathDeathBonus.points}</td>
                  <td className="px-2 py-1 text-right font-bold">{b.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------

export function ActionPanel({ state }: { state: GameState }) {
  return (
    <section className="bg-sea-800/50 rounded p-4 space-y-3">
      <MorningPanel state={state} />
      <DayActionsPanel state={state} />
      <RowingPanel state={state} />
      <ProposalPanel state={state} />
      <RobPickPanel state={state} />
      <FightPanel state={state} />
      <EveningPanel state={state} />
      <ScoringPanel state={state} />
      <FinishedPanel state={state} />
    </section>
  )
}
