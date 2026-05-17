import { motion } from 'motion/react'
import clsx from 'clsx'
import { characterMeta } from '@/ui/character-meta'
import { CHARACTER_TOOLTIPS, SUPPLY_TOOLTIPS } from '@/ui/card-tooltips'
import { InfoBadge } from '@/ui/InfoBadge'
import { getCharacterImage } from '@/ui/media'
import {
  SUPPLY_ICON,
  SUPPLY_NAME,
  CHARACTER_ICON,
  OarIcon,
  CrossedBladesIcon,
  PicklockIcon,
  SkullIcon,
} from '@/ui/icons'
import type { GameState, Player, SupplyCard } from '@/game/types'

export type FightRole =
  | 'attacker'
  | 'defender'
  | 'ally-of-attacker'
  | 'ally-of-defender'
  | 'neutral'

interface PlayerCardProps {
  state: GameState
  player: Player
  seatIndex: number
  isCurrent: boolean
  isYou: boolean
  fightRole: FightRole | null
}

/**
 * Карта банки. См. docs/design-roadmap.md §6.
 * Заблокированные цвета: #C8C8C8 (корпус), #8B6F4E (рама).
 */
export function PlayerCard({
  state,
  player,
  // seatIndex,
  isCurrent,
  isYou,
  fightRole,
}: PlayerCardProps) {
  const meta = characterMeta(player.character)
  const dead = player.consciousness === 'dead'
  const unconscious = player.consciousness === 'unconscious'
  const portrait = getCharacterImage(player.character)

  // Хореография боя — y-offset + цвет свечения.
  const fightOffset =
    fightRole === 'attacker' || fightRole === 'ally-of-attacker'
      ? -28
      : fightRole === 'defender' || fightRole === 'ally-of-defender'
        ? 28
        : 0
  const fightShadow =
    fightRole === 'attacker'
      ? 'shadow-fight-attacker'
      : fightRole === 'ally-of-attacker'
        ? 'shadow-[0_-3px_18px_rgba(140,44,61,0.45)]'
        : fightRole === 'defender'
          ? 'shadow-fight-defender'
          : fightRole === 'ally-of-defender'
            ? 'shadow-[0_3px_18px_rgba(180,195,210,0.4)]'
            : ''
  const neutralDim = fightRole === 'neutral'

  return (
    <motion.div
      layout
      animate={{
        y: fightOffset,
        scale: fightRole === 'attacker' || fightRole === 'defender' ? 1.03 : 1,
      }}
      transition={{ type: 'spring', damping: 18, stiffness: 200 }}
      className={clsx(
        'relative w-[160px] shrink-0 select-none',
        neutralDim && 'opacity-55',
      )}
    >
      {/* Деревянная рама. */}
      <div
        className={clsx(
          'relative rounded-sm p-[6px]',
          fightShadow,
          isCurrent && !dead && 'animate-gold-pulse',
        )}
        style={{
          background:
            'linear-gradient(135deg, #a98762 0%, #8B6F4E 40%, #5e4831 100%)',
          boxShadow:
            'inset 0 0 0 1px rgba(255,225,180,0.25), 0 4px 10px rgba(20,16,8,0.35)',
        }}
      >
        {/* Info-badge — снаружи overflow-hidden корпуса, чтобы тултип не обрезался. */}
        <div className="absolute right-2 top-2 z-30">
          <InfoBadge content={CHARACTER_TOOLTIPS[player.character]} size={16} />
        </div>

        {/* Корпус карты. */}
        <div
          className="relative overflow-hidden rounded-sm"
          style={{
            background:
              'linear-gradient(180deg, #d8d8d8 0%, #C8C8C8 60%, #a8a8a8 100%)',
          }}
        >
          {/* Бумажная зернистость. */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />

          {/* Иконки-статусы — слева сверху. */}
          <div className="absolute left-1.5 top-1.5 z-10 flex flex-col gap-1.5 text-ink/85">
            {player.rowed && (
              <span title="Грёб сегодня" className="rounded-full bg-paper/80 p-1 text-ink shadow-sm">
                <OarIcon size={14} />
              </span>
            )}
            {player.fought && (
              <span title="Дрался сегодня" className="rounded-full bg-paper/80 p-1 text-card-enemy shadow-sm">
                <CrossedBladesIcon size={14} />
              </span>
            )}
            {player.hasUsedShketSteal && (
              <span title="Воровал" className="rounded-full bg-paper/80 p-1 text-card-friend-deep shadow-sm">
                <PicklockIcon size={14} />
              </span>
            )}
          </div>

          {/* Метка номера банки в углу. 
          <div className="absolute left-1.5 bottom-1.5 z-10 rounded-sm bg-paper/70 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">
            #{seatIndex + 1}
          </div>*/}

          {/* Портрет (или fallback). */}
          <div className="relative h-[120px] w-full overflow-hidden bg-card-character-deep">
            {portrait ? (
              <img
                src={portrait}
                alt={meta.name}
                className="h-full w-full object-cover"
                style={{
                  filter: dead ? 'grayscale(1) brightness(0.6)' : 'none',
                }}
              />
            ) : (
              <CharacterFallback character={player.character} />
            )}
            {/* Виньетка низа портрета. */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-black/35" />
          </div>

          {/* Имя персонажа. */}
          <div className="px-2 pb-1 pt-2 text-center">
            <div className="font-stamp text-[16px] tracking-stamp text-ink leading-none">
              {meta.name.toUpperCase()}
            </div>
            <div className="font-hand text-[16px] text-ink-faint leading-tight">
              {player.displayName}
              {player.isBot && (
                <span className="ml-1 font-mono text-[10px] uppercase text-ink-faint/70">
                  бот
                </span>
              )}
            </div>
          </div>

          {/* Статы — столбик. ЖИЗНЬ (текущая/максимум) и ОЧКИ (бонус выживания). */}
          <div className="mx-2 mb-2 flex flex-col gap-1 rounded-sm border border-ink/15 bg-paper/70 px-2 py-1.5 font-mono text-[12px]">
            <Stat
              label="ЖИЗНЬ"
              value={`${Math.max(0, meta.strength - player.wounds)}/${meta.strength}`}
              warn={player.wounds > 0}
            />
            <Stat label="ОЧКИ" value={meta.survivalBonus} />
          </div>

          {/* Открытые припасы. */}
          {player.openSupplies.length > 0 && (
            <div className="mx-2 mb-1.5 flex flex-wrap gap-1">
              {player.openSupplies.map((id) => (
                <OpenSupplyChip key={id} card={state.supplyById[id]} />
              ))}
            </div>
          )}

          {/* Закрытые припасы — точечки. */}
          {player.closedSupplies.length > 0 && (
            <div className="mx-2 mb-2 flex items-center gap-1.5">
              <span className="font-stamp text-[10px] uppercase tracking-stamp text-ink-faint">
                в кармане:
              </span>
              <span className="flex gap-1">
                {player.closedSupplies.map((id) => (
                  <span
                    key={id}
                    className="inline-block h-2.5 w-2.5 rounded-full border border-ink/50 bg-ink/30"
                  />
                ))}
              </span>
            </div>
          )}

          {/* Слой смерти / без сознания. */}
          {dead && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-paper-deep/55 backdrop-grayscale">
              <div className="text-ink-faint">
                <SkullIcon size={48} />
              </div>
              <span className="absolute font-stamp text-[11px] tracking-stamp text-card-enemy-deep">
                МЁРТВ
              </span>
            </div>
          )}
          {unconscious && !dead && (
            <div className="pointer-events-none absolute inset-0 z-20 bg-paper/30">
              <div className="absolute inset-x-0 bottom-1 text-center font-hand text-[14px] text-ink-faint">
                без сознания
              </div>
            </div>
          )}

          {/* Отметка «вы». */}
          {isYou && (
            <div className="absolute -right-1 -top-1 z-30 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink shadow-md">
              вы
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string | number
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-stamp text-[10px] uppercase tracking-stamp text-ink-faint">
        {label}
      </span>
      <span
        className={clsx(
          'font-mono text-[14px] font-bold leading-none',
          warn ? 'text-card-enemy' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function OpenSupplyChip({ card }: { card: SupplyCard | undefined }) {
  if (!card) return null
  const Icon = SUPPLY_ICON[card.kind]
  const name = SUPPLY_NAME[card.kind]
  return (
    <div
      className="group relative inline-flex items-center gap-1 rounded-sm border border-ink/30 bg-paper/85 px-1.5 py-0.5 text-ink"
      title={name}
    >
      <Icon size={13} />
      <span className="font-serif text-[11px] leading-none">{name}</span>
      <InfoBadge
        content={SUPPLY_TOOLTIPS[card.kind]}
        size={11}
        className="ml-0.5"
      />
    </div>
  )
}

/**
 * Fallback-портрет: SVG-иконка персонажа + монограмма-инициал.
 * См. docs/design-roadmap.md §12.
 */
function CharacterFallback({
  character,
}: {
  character: keyof typeof CHARACTER_TOOLTIPS
}) {
  const meta = characterMeta(character)
  const Icon = CHARACTER_ICON[character]
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center top, #cdbb95 0%, #a08c5d 60%, #7c6a3f 100%)',
      }}
    >
      {/* Большая SVG-иконка персонажа. */}
      <div className="text-ink/85">
        <Icon size={96} strokeWidth={1.2} />
      </div>
      {/* Подпись инициалом снизу. */}
      <div className="absolute bottom-1 right-1 font-stamp text-[14px] tracking-stamp text-ink/60">
        {meta.name.charAt(0)}
      </div>
    </div>
  )
}
