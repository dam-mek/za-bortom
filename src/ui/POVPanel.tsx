import { characterMeta } from '@/ui/character-meta'
import { CHARACTER_TOOLTIPS } from '@/ui/card-tooltips'
import { InfoBadge } from '@/ui/InfoBadge'
import { QuillIcon } from '@/ui/icons'
import type { GameState } from '@/game/types'

/**
 * Личный «паспорт» владельца экрана: за кого играет + друг + враг.
 * См. docs/design-roadmap.md §5.
 *
 * Не отображается в hot-seat (там нет одного «вы»).
 */
export function POVPanel({
  state,
  myPlayerId,
  hotSeat = false,
}: {
  state: GameState
  myPlayerId: string
  hotSeat?: boolean
}) {
  const me = state.players[myPlayerId]
  if (!me) return null
  const my = characterMeta(me.character)
  // bestFriend/worstEnemy в filtered state могут быть null — обрабатываем.
  const friend = me.bestFriend ? characterMeta(me.bestFriend) : null
  const enemy = me.worstEnemy ? characterMeta(me.worstEnemy) : null

  return (
    <aside className="flex w-[240px] shrink-0 flex-col gap-2.5 text-ink">
      {/* Карточка персонажа. */}
      <section
        className="relative rounded-sm border border-ink/25 p-3.5 shadow-emboss"
        style={{
          background:
            'linear-gradient(180deg, #e9dabb 0%, var(--bg-paper, #f1e6cf) 60%, var(--bg-paper-deep, #d9c8a0) 100%)',
        }}
      >
        <div className="absolute right-2 top-2">
          <InfoBadge content={CHARACTER_TOOLTIPS[me.character]} size={16} />
        </div>
        <div className="flex items-center gap-1.5">
          <QuillIcon size={14} className="text-ink-faint" />
          <div className="font-stamp text-[11px] tracking-stamp text-ink-faint">
            {hotSeat ? 'ход игрока' : 'вы играете'}
          </div>
        </div>
        <div className="mt-1.5 font-stamp text-[26px] leading-none tracking-stamp text-ink">
          {my.name.toUpperCase()}
        </div>
        <div className="mt-1 font-hand text-[20px] text-ink-faint">
          {me.displayName}
        </div>
        <div className="mt-3 flex flex-col gap-1.5 rounded-sm border border-ink/15 bg-paper/80 px-2.5 py-2 font-mono text-[13px]">
          <Stat
            label="Жизнь"
            value={`${Math.max(0, my.strength - me.wounds)}/${my.strength}`}
            warn={me.wounds > 0}
          />
          <Stat label="Очки" value={my.survivalBonus} />
        </div>
      </section>

      {/* Лучший друг. */}
      <section
        className="relative rounded-sm border border-card-friend-deep p-3.5 text-paper shadow-journal"
        style={{
          background:
            'linear-gradient(180deg, #835592 0%, #6E4878 60%, #42284c 100%)',
        }}
      >
        <div className="absolute right-2 top-2 ring-2 ring-paper/30 rounded-full">
          <InfoBadge
            content={{
              title: 'Лучший друг',
              body: 'TODO: впишите описание здесь.',
            }}
            size={20}
          />
        </div>
        <div className="font-stamp text-[11px] tracking-stamp text-paper/85">
          лучший друг
        </div>
        <div className="mt-1 font-hand text-[28px] leading-none text-paper">
          {friend ? friend.name : '— скрыто —'}
        </div>
        {friend && (
          <div className="mt-1.5 font-serif text-[12px] italic text-paper/80">
            если выживет — +{friend.survivalBonus} очков
          </div>
        )}
      </section>

      {/* Заклятый враг. */}
      <section
        className="relative rounded-sm border border-card-enemy-deep p-3.5 text-paper shadow-journal"
        style={{
          background:
            'linear-gradient(180deg, #a93b50 0%, #8C2C3D 60%, #5a1925 100%)',
        }}
      >
        <div className="absolute right-2 top-2 ring-2 ring-paper/30 rounded-full">
          <InfoBadge
            content={{
              title: 'Заклятый враг',
              body: 'TODO: впишите описание здесь.',
            }}
            size={20}
          />
        </div>
        <div className="font-stamp text-[11px] tracking-stamp text-paper/85">
          заклятый враг
        </div>
        <div className="mt-1 font-hand text-[28px] leading-none text-paper">
          {enemy ? enemy.name : '— скрыто —'}
        </div>
        {enemy && (
          <div className="mt-1.5 font-serif text-[12px] italic text-paper/80">
            если выживет — −{enemy.survivalBonus} очков
          </div>
        )}
      </section>
    </aside>
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
    <div className="flex items-baseline justify-between">
      <span className="font-stamp text-[11px] uppercase tracking-stamp text-ink-faint">
        {label}
      </span>
      <span
        className={`font-mono text-[16px] font-bold leading-none ${
          warn ? 'text-card-enemy' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
