import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { characterMeta } from '@/ui/character-meta'
import { CHARACTER_TOOLTIPS } from '@/ui/card-tooltips'
import { InfoBadge } from '@/ui/InfoBadge'
import { QuillIcon, ChevronUpIcon, ChevronDownIcon } from '@/ui/icons'
import type { GameState } from '@/game/types'

/**
 * Мобильная версия POVPanel — шторка снизу с дёрнутым ярлычком.
 * Десктоп: см. POVPanel.tsx, шторку не показывает (lg:hidden).
 *
 * Ярлычок всегда виден — имя персонажа + статы. Тап раскрывает полный POV
 * (друг + враг + статы). Тап вне шторки или на ярлычок закрывает.
 */
export function POVDrawer({
  state,
  myPlayerId,
  hotSeat = false,
}: {
  state: GameState
  myPlayerId: string
  hotSeat?: boolean
}) {
  const [open, setOpen] = useState(false)

  const me = state.players[myPlayerId]
  if (!me) return null
  const my = characterMeta(me.character)
  const friend = me.bestFriend ? characterMeta(me.bestFriend) : null
  const enemy = me.worstEnemy ? characterMeta(me.worstEnemy) : null

  const life = `${Math.max(0, my.strength - me.wounds)}/${my.strength}`

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Шторка — fixed к нижнему краю, lg:hidden */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
        {/* Ярлычок-handle — всегда виден */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 border-t-2 border-ink/30 px-3 py-2 text-left shadow-[0_-4px_12px_rgba(0,0,0,0.18)]"
          style={{
            background:
              'linear-gradient(180deg, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 100%)',
          }}
        >
          <QuillIcon size={13} className="shrink-0 text-ink-faint" />
          <span className="shrink-0 font-stamp text-[10px] tracking-stamp text-ink-faint">
            {hotSeat ? 'ХОД' : 'ВЫ'}
          </span>
          <span className="font-hand text-[20px] leading-none text-ink">
            {my.name}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">·</span>
          <span
            className={`font-mono text-[12px] ${
              me.wounds > 0 ? 'text-card-enemy' : 'text-ink'
            }`}
          >
            {life}
          </span>
          <span className="ml-auto shrink-0 text-ink-faint">
            {open ? <ChevronDownIcon size={18} /> : <ChevronUpIcon size={18} />}
          </span>
        </button>

        {/* Содержимое — слайдится снизу */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="max-h-[70vh] overflow-y-auto border-t border-ink/20 bg-paper px-3 py-4"
            >
              <div className="space-y-2.5">
                {/* Карточка персонажа */}
                <section
                  className="relative rounded-sm border border-ink/25 p-3 shadow-emboss"
                  style={{
                    background:
                      'linear-gradient(180deg, #e9dabb 0%, var(--bg-paper, #f1e6cf) 60%, var(--bg-paper-deep, #d9c8a0) 100%)',
                  }}
                >
                  <div className="absolute right-2 top-2">
                    <InfoBadge
                      content={CHARACTER_TOOLTIPS[me.character]}
                      size={16}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <QuillIcon size={13} className="text-ink-faint" />
                    <div className="font-stamp text-[10px] tracking-stamp text-ink-faint">
                      {hotSeat ? 'ход игрока' : 'вы играете'}
                    </div>
                  </div>
                  <div className="mt-1 font-stamp text-[22px] leading-none tracking-stamp text-ink">
                    {my.name.toUpperCase()}
                  </div>
                  <div className="mt-1 font-hand text-[18px] text-ink-faint">
                    {me.displayName}
                  </div>
                  <div className="mt-2.5 flex gap-2 font-mono text-[12px]">
                    <div className="flex-1 rounded-sm border border-ink/15 bg-paper/80 px-2 py-1.5">
                      <div className="font-stamp text-[9px] uppercase tracking-stamp text-ink-faint">
                        Жизнь
                      </div>
                      <div
                        className={`font-mono text-[15px] font-bold ${
                          me.wounds > 0 ? 'text-card-enemy' : 'text-ink'
                        }`}
                      >
                        {life}
                      </div>
                    </div>
                    <div className="flex-1 rounded-sm border border-ink/15 bg-paper/80 px-2 py-1.5">
                      <div className="font-stamp text-[9px] uppercase tracking-stamp text-ink-faint">
                        Очки
                      </div>
                      <div className="font-mono text-[15px] font-bold text-ink">
                        {my.survivalBonus}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Друг */}
                <section
                  className="relative rounded-sm border border-card-friend-deep p-3 text-paper shadow-journal"
                  style={{
                    background:
                      'linear-gradient(180deg, #835592 0%, #6E4878 60%, #42284c 100%)',
                  }}
                >
                  <div className="absolute right-2 top-2">
                    <InfoBadge
                      content={{
                        title: 'Лучший друг',
                        body: 'TODO: впишите описание здесь.',
                      }}
                      size={16}
                    />
                  </div>
                  <div className="font-stamp text-[10px] tracking-stamp text-paper/85">
                    лучший друг
                  </div>
                  <div className="mt-0.5 font-hand text-[24px] leading-none text-paper">
                    {friend ? friend.name : '— скрыто —'}
                  </div>
                  {friend && (
                    <div className="mt-1 font-serif text-[11px] italic text-paper/80">
                      если выживет — +{friend.survivalBonus} очков
                    </div>
                  )}
                </section>

                {/* Враг */}
                <section
                  className="relative rounded-sm border border-card-enemy-deep p-3 text-paper shadow-journal"
                  style={{
                    background:
                      'linear-gradient(180deg, #a93b50 0%, #8C2C3D 60%, #5a1925 100%)',
                  }}
                >
                  <div className="absolute right-2 top-2">
                    <InfoBadge
                      content={{
                        title: 'Заклятый враг',
                        body: 'TODO: впишите описание здесь.',
                      }}
                      size={16}
                    />
                  </div>
                  <div className="font-stamp text-[10px] tracking-stamp text-paper/85">
                    заклятый враг
                  </div>
                  <div className="mt-0.5 font-hand text-[24px] leading-none text-paper">
                    {enemy ? enemy.name : '— скрыто —'}
                  </div>
                  {enemy && (
                    <div className="mt-1 font-serif text-[11px] italic text-paper/80">
                      если выживет — −{enemy.survivalBonus} очков
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
