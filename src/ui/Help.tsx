import { useState } from 'react'

export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sea-300 hover:underline text-sm"
        title="Правила"
      >
        ❓ Правила
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 font-mono p-4">
      <div className="bg-sea-800 rounded p-6 max-w-3xl max-h-[90vh] overflow-y-auto space-y-4 text-white">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl">Правила «За бортом» — краткие</h2>
          <button onClick={onClose} className="text-2xl text-sea-300 hover:text-white">✕</button>
        </div>

        <Section title="Цель">
          <p>
            Лодка с потерпевшими крушение плывёт к берегу. Когда наберётся 4 жетона чаек (= земля
            рядом) — игра кончается. Победитель = у кого больше очков.
          </p>
        </Section>

        <Section title="Структура хода">
          <p>Каждый день = три фазы:</p>
          <ol className="list-decimal list-inside text-sm space-y-1">
            <li><b>Утро:</b> игроки в сознании по одному выбирают карты припасов из общей стопки.</li>
            <li><b>День:</b> каждый conscious-игрок делает одно действие.</li>
            <li><b>Вечер:</b> раскрывается карта навигации (чайки/за борт/жажда).</li>
          </ol>
        </Section>

        <Section title="Дневные действия">
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><b>Погрести:</b> взять 2 (+1 за каждое весло) карты навигации, оставить 0-2 для розыгрыша вечером, остальные в низ колоды. Усталость «гребец».</li>
            <li><b>Поменяться местами:</b> цель соглашается (своп) или отказывается (драка).</li>
            <li><b>Ограбить:</b> взять одну открытую карту или случайную закрытую. Отказ → драка.</li>
            <li><b>Использовать припас:</b> аптечка (-1 рана), зонтик (защита), сигнальный пистолет (3 карты навигации, только чайки).</li>
            <li><b>Шкет:</b> может украсть закрытую карту без драки (1 раз/день).</li>
            <li><b>Бездельничать.</b></li>
          </ul>
        </Section>

        <Section title="Драка">
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Стороны набирают союзников (только Атакующий может закрыть набор).</li>
            <li>Сила стороны = сумма сил персонажей + сумма weaponStrength раскрытого оружия.</li>
            <li><b>При равенстве — побеждает жертва.</b></li>
            <li>Проигравшие получают +1 рану. Все участники — жетон «силач».</li>
          </ul>
        </Section>

        <Section title="Вечер: навигация">
          <ol className="list-decimal list-inside text-sm space-y-1">
            <li>Игрок ближе к корме выбирает карту из стопки «от гребцов» (или верх колоды).</li>
            <li><b>Чайки:</b> +1 / -1 / 0 жетонов. 4 жетона = конец игры.</li>
            <li><b>За борт:</b> названные персонажи теряют все открытые припасы, +1 рана (кроме Черпака). Спасательный круг (открытый или открытый реактивно) — спасает.</li>
            <li><b>Приманка для акул:</b> любой владелец открытой приманки может +1 рана всем за бортом.</li>
            <li><b>Жажда:</b> названные + гребцы + бойцы получают раны. Вода = -1 рана. Открытый зонтик = -1 рана за вечер.</li>
          </ol>
        </Section>

        <Section title="Состояния">
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><b>В сознании:</b> wounds &lt; strength. Действует.</li>
            <li><b>Без сознания:</b> wounds = strength. Не действует, но может страдать от жажды и падать за борт.</li>
            <li><b>Мёртв:</b> wounds &gt; strength. Не действует, остаётся на банке.</li>
            <li>Без сознания + за борт без круга → тело уносит течением.</li>
          </ul>
        </Section>

        <Section title="Подсчёт очков">
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>За выживание: +survivalBonus своего персонажа.</li>
            <li><b>Нарцисс</b> (friend = ты сам): ×2 за выживание.</li>
            <li><b>Психопат</b> (enemy = ты сам): 0 за выживание + 3 очка за каждого мёртвого (кроме друга).</li>
            <li>За ценные карты: деньги/украшения/картины. Множитель ×2 у профильного персонажа (Капитан/Миледи/Сноб).</li>
            <li>Живой друг → +его survivalBonus. Мёртвый враг → +его strength.</li>
          </ul>
        </Section>

        <Section title="Персонажи">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-sea-300 border-b border-sea-700">
                <th className="text-left py-1">Имя</th>
                <th className="text-right">Сила</th>
                <th className="text-right">Бонус</th>
                <th className="text-left pl-3">Способность</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Боцман</td><td className="text-right">8</td><td className="text-right">4</td><td className="pl-3">высокая сила</td></tr>
              <tr><td>Шкет</td><td className="text-right">3</td><td className="text-right">9</td><td className="pl-3">воровать закрытые без драки</td></tr>
              <tr><td>Сноб</td><td className="text-right">5</td><td className="text-right">7</td><td className="pl-3">×2 за картины</td></tr>
              <tr><td>Капитан</td><td className="text-right">7</td><td className="text-right">5</td><td className="pl-3">×2 за деньги</td></tr>
              <tr><td>Миледи</td><td className="text-right">4</td><td className="text-right">8</td><td className="pl-3">×2 за украшения</td></tr>
              <tr><td>Черпак</td><td className="text-right">6</td><td className="text-right">6</td><td className="pl-3">не получает ран от падения за борт</td></tr>
            </tbody>
          </table>
        </Section>

        <p className="text-sea-300 text-xs">
          Полные правила: <code>docs/game-rules.md</code> в репозитории.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="bg-sea-700/30 rounded p-3" open>
      <summary className="font-semibold cursor-pointer">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}
