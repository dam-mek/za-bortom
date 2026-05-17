import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ScrollIcon, CloseIcon, CompassIcon } from './icons'
import { characterMeta } from './character-meta'
import type { CharacterId } from '@/game/constants'

/**
 * Help — модальный свиток с правилами.
 * См. docs/design-roadmap.md §13 (Help).
 */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm p-1 font-serif text-[14px] text-ink-faint transition hover:bg-ink/5 hover:text-ink lg:text-[16px]"
        title="Правила"
        aria-label="Правила"
      >
        <ScrollIcon size={18} />
        <span className="hidden lg:inline">Правила</span>
      </button>
      <AnimatePresence>{open && <HelpModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 10, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-sm border border-ink/40 shadow-journal"
        style={{
          background:
            'radial-gradient(ellipse at top, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 80%, #b89e6b 110%)',
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.5), 0 14px 38px rgba(0,0,0,0.45)',
        }}
      >
        {/* Зернистость. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <header className="relative flex items-center justify-between border-b border-ink/20 bg-paper-deep/50 px-5 py-3">
          <div className="flex items-center gap-3 text-card-enemy-deep">
            <ScrollIcon size={22} />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-faint">
                судовой устав
              </div>
              <h2 className="font-hand text-[28px] leading-none text-ink">
                Правила «За бортом»
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/30 bg-paper/50 p-1.5 text-ink hover:bg-paper"
            aria-label="закрыть"
          >
            <CloseIcon size={16} />
          </button>
          <div className="pointer-events-none absolute right-20 top-1.5 text-ink/10">
            <CompassIcon size={42} />
          </div>
        </header>

        <div className="relative max-h-[72vh] space-y-4 overflow-y-auto p-5 text-ink">
          <Section title="Цель">
            <p className="font-serif text-[13px] leading-relaxed">
              Шлюпка с потерпевшими крушение плывёт к берегу. Когда наберётся{' '}
              <Stamp>4 жетона чаек</Stamp> — значит, земля рядом. Игра кончается,
              побеждает тот, у кого больше очков.
            </p>
          </Section>

          <Section title="Структура дня">
            <p className="font-serif text-[13px]">Каждый день делится на три фазы:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 font-serif text-[13px]">
              <li>
                <b>Утро.</b> Игроки в сознании по одному выбирают карты припасов
                из общей кучи.
              </li>
              <li>
                <b>День.</b> Каждый conscious-игрок делает одно действие.
              </li>
              <li>
                <b>Вечер.</b> Раскрывается карта навигации: чайки, падение за
                борт, жажда.
              </li>
            </ol>
          </Section>

          <Section title="Дневные действия">
            <ul className="list-disc space-y-1 pl-5 font-serif text-[13px]">
              <li>
                <b>Грести.</b> Тяните 2 (+1 за каждое весло) карт навигации,
                оставьте 0-2 на вечер, остальные — в низ колоды. Получаете
                усталость гребца.
              </li>
              <li>
                <b>Поменяться местами.</b> Цель соглашается (своп) или
                отказывается (драка).
              </li>
              <li>
                <b>Ограбить.</b> Взять одну открытую карту или случайную
                закрытую. Отказ → драка.
              </li>
              <li>
                <b>Использовать припас.</b> Аптечка (-1 рана), зонт (защита),
                сигнальный пистолет (3 карты навигации, только чайки).
              </li>
              <li>
                <b>Шкет.</b> Может украсть закрытую карту без драки (1 раз/день).
              </li>
              <li>
                <b>Бездельничать.</b>
              </li>
            </ul>
          </Section>

          <Section title="Драка">
            <ul className="list-disc space-y-1 pl-5 font-serif text-[13px]">
              <li>Стороны набирают союзников (закрывает набор только атакующий).</li>
              <li>
                Сила стороны = сумма сил персонажей + сумма{' '}
                <span className="font-mono">weaponStrength</span> открытого
                оружия.
              </li>
              <li>
                <b>При равенстве — побеждает жертва.</b>
              </li>
              <li>
                Проигравшие получают <Stamp>+1 рана</Stamp>. Все участники
                «дрались».
              </li>
            </ul>
          </Section>

          <Section title="Вечер · навигация">
            <ol className="list-decimal space-y-1 pl-5 font-serif text-[13px]">
              <li>
                Игрок ближе к корме выбирает карту из стопки «от гребцов» (или
                верх колоды).
              </li>
              <li>
                <b>Чайки:</b> +1 / −1 / 0 жетонов. 4 жетона = конец игры.
              </li>
              <li>
                <b>За борт:</b> названные теряют все открытые припасы и
                получают +1 рану (кроме Черпака). Спасательный круг — спасает.
              </li>
              <li>
                <b>Приманка для акул:</b> владелец открытой приманки может
                добавить +1 рану всем за бортом.
              </li>
              <li>
                <b>Жажда:</b> названные + гребцы + бойцы получают раны. Вода
                закрывает рану. Открытый зонт — -1 рана за вечер.
              </li>
            </ol>
          </Section>

          <Section title="Состояния">
            <ul className="list-disc space-y-1 pl-5 font-serif text-[13px]">
              <li>
                <b>В сознании:</b> ран меньше силы. Действует.
              </li>
              <li>
                <b>Без сознания:</b> ран равно силе. Не действует, но может
                страдать от жажды и падать за борт.
              </li>
              <li>
                <b>Мёртв:</b> ран больше силы. Не действует, остаётся на банке.
              </li>
              <li>Без сознания + за борт без круга → тело уносит течением.</li>
            </ul>
          </Section>

          <Section title="Подсчёт очков">
            <ul className="list-disc space-y-1 pl-5 font-serif text-[13px]">
              <li>За выживание: бонус своего персонажа.</li>
              <li>
                <b>Нарцисс</b> (друг = вы сами): ×2 за выживание.
              </li>
              <li>
                <b>Психопат</b> (враг = вы сами): 0 за выживание, +3 за каждого
                мёртвого (кроме друга).
              </li>
              <li>
                Ценные карты: деньги/украшения/картины. ×2 у профильного
                персонажа (Капитан/Миледи/Сноб).
              </li>
              <li>Живой друг → +его бонус. Мёртвый враг → +его сила.</li>
            </ul>
          </Section>

          <Section title="Персонажи">
            <table className="mt-1 w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-paper-deep/40">
                  <th className="border border-ink/20 px-2 py-1 text-left font-stamp text-[10px] tracking-stamp">
                    Имя
                  </th>
                  <th className="border border-ink/20 px-2 py-1 text-right font-stamp text-[10px] tracking-stamp">
                    Сила
                  </th>
                  <th className="border border-ink/20 px-2 py-1 text-right font-stamp text-[10px] tracking-stamp">
                    Выж.
                  </th>
                  <th className="border border-ink/20 px-2 py-1 text-left font-stamp text-[10px] tracking-stamp">
                    Способность
                  </th>
                </tr>
              </thead>
              <tbody className="font-serif">
                {(
                  [
                    ['bocman', 'высокая сила'],
                    ['shket', 'воровать закрытые без драки'],
                    ['snob', '×2 за картины'],
                    ['kapitan', '×2 за деньги'],
                    ['miledi', '×2 за украшения'],
                    ['cherpak', 'не получает ран от падения за борт'],
                  ] as [CharacterId, string][]
                ).map(([id, ability]) => {
                  const m = characterMeta(id)
                  return (
                    <tr key={id} className="border-t border-ink/15">
                      <td className="border border-ink/20 px-2 py-1 font-hand text-[15px]">
                        {m.name}
                      </td>
                      <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                        {m.strength}
                      </td>
                      <td className="border border-ink/20 px-2 py-1 text-right font-mono">
                        {m.survivalBonus}
                      </td>
                      <td className="border border-ink/20 px-2 py-1 text-[12px]">
                        {ability}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Section>

          <p className="font-serif text-[11px] italic text-ink-faint">
            Полные правила — в файле <code>docs/game-rules.md</code>.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-sm border border-ink/15 bg-paper/60 p-3 shadow-emboss">
      <h3 className="mb-1.5 font-stamp text-[11px] tracking-stamp text-card-enemy-deep">
        {title.toUpperCase()}
      </h3>
      <div className="text-ink">{children}</div>
    </section>
  )
}

function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-sm border border-card-enemy/60 bg-card-enemy/10 px-1.5 font-stamp text-[10px] tracking-stamp text-card-enemy-deep">
      {children}
    </span>
  )
}
