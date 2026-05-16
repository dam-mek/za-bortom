# Roadmap — фазы разработки

> **Статус: все 10 фаз выполнены (Фаза 6 пропущена осознанно — см. [`decisions.md`](./decisions.md) #23).** Актуальная картинка — [`STATUS.md`](./STATUS.md). Этот файл оставлен как историческая карта плана.

Сборка проекта разбита на фазы. Каждая фаза имеет чёткие acceptance-критерии. **Не переходи к следующей фазе, пока критерии текущей не выполнены.**

Это путь для Claude Code: одна фаза = одна логическая итерация.

## Фаза 0: Bootstrap

Стартовый шаблон проекта.

**Задачи:**
- [x] `npm create vite@latest` с React + TypeScript
- [x] Установить зависимости: zustand, xstate, @xstate/react, peerjs, immer, seedrandom, nanoid, clsx, tailwindcss
- [x] Установить dev: vitest, @vitest/ui, @types/seedrandom, eslint, prettier, eslint-config-prettier
- [x] Настроить `tsconfig.json` с `strict: true`, `noUncheckedIndexedAccess: true`
- [x] Настроить ESLint + Prettier
- [x] Настроить Tailwind
- [x] Скрипты в `package.json`: dev, build, preview, test, typecheck, lint
- [x] Создать структуру папок согласно `CLAUDE.md`
- [x] Положить документы из `docs/` в репо
- [x] Создать `src/game/constants.ts` с CHARACTERS, SUPPLY_PROPS из `docs/02-game-spec.md`
- [x] Smoke test: `npm run dev` запускает пустую страницу с "За бортом", `npm test` проходит (с одним dummy тестом)

**Acceptance:** проект запускается, тесты проходят, линтер не ругается.

---

## Фаза 1: Game types & state

Базовые типы и initial state. Без логики, только структуры.

**Задачи:**
- [x] `src/game/types.ts` — все типы из `docs/02-game-spec.md` (Player, Seat, Phase, Supply, NavigationCard, GameState, FilteredGameState)
- [x] `src/game/actions.ts` — discriminated union Action
- [x] `src/game/constants.ts` — CHARACTERS, SUPPLY_PROPS, состав колоды (с TODO-комментами по точным значениям)
- [x] `src/game/state.ts` — `createInitialState(players, rng)`, фабрики
- [x] `src/game/prng.ts` — обёртка над seedrandom: `createPRNG(seed)`, `shuffle`, `pick`
- [x] `src/game/invariants.ts` — `checkInvariants(state): InvariantError[]`

**Тесты:**
- [x] `createInitialState` для 4, 5, 6 игроков возвращает валидный state.
- [x] `checkInvariants` на initial state ничего не возвращает (нет ошибок).
- [x] Сумма карт в state равна 42 supply + 24 nav.
- [x] Для 5/6 игроков `removedCharacters` правильной длины.

**Acceptance:** типы есть, initial state создаётся, инварианты проходят.

---

## Фаза 2: Game logic — morning + scoring

Самые простые фазы (нет драк, нет навигации).

**Задачи:**
- [x] `src/game/reducer.ts` — главный диспатчер (case по action.type)
- [x] `src/game/rules/morning.ts`:
  - `MORNING_CHOOSE_SUPPLY` — игрок выбирает, остаток передаётся
  - Корректное определение «следующего conscious игрока»
  - Авто-переход в day когда morning завершён
- [x] `src/game/rules/scoring.ts`:
  - `scoreGame(state)` возвращает breakdown
  - Все правила: выживание, нарцисс, психопат, друг, враг, ценности, множители

**Тесты:**
- [x] Morning: 4 conscious игрока → 4 раунда передачи → все получили по 1 карте.
- [x] Morning: 1 conscious + 3 без сознания → conscious берёт 1 карту (= числу в сознании), остальные не участвуют.
- [x] Morning: 0 conscious → фаза пропускается.
- [x] Morning: пустая колода → пропуск.
- [x] Scoring: каждый кейс из правил (нарцисс, психопат, друг=враг, множители у Миледи/Сноба/Капитана).

**Acceptance:** морнинг проходится, очки считаются для произвольного финального state.

---

## Фаза 3: Game logic — day actions (без драки)

Все дневные действия, не приводящие к драке.

**Задачи:**
- [x] `src/game/rules/row.ts` — гребля, выбор оставляемых карт, весло, жетоны усталости
- [x] `src/game/rules/use-supply.ts` — first_aid, umbrella, flare_gun, life_ring (reactive)
- [x] `src/game/rules/trade.ts` — REVEAL_SUPPLY, GIVE_SUPPLY, DISCARD_SUPPLY (с проверкой «не в драке»)
- [x] `src/game/rules/shket-steal.ts` — воровство Шкета
- [x] Реализация порядка ходов и auto-advance после действия

**Тесты:**
- [x] Row: 2 карты взято, 1 оставлена, 1 в низ колоды, fatigue (rowing) выставлен.
- [x] Row с веслом: 3 карты вместо 2.
- [x] Row с 2 вёслами: 4 карты.
- [x] First aid: ранение снимается, без сознания → в сознание.
- [x] Umbrella: перемещается в open targetа.
- [x] Flare gun: 3 карты просмотрены, чайки применены, остальное игнор.
- [x] Shket: ворует закрытое, у жертвы -1, у Шкета +1.
- [x] Shket: не может воровать дважды за ход.

**Acceptance:** игра проходит N дней с 4 conscious игроками, никто не нападает.

---

## Фаза 4: Game logic — swap, rob, fight

Социальные действия и боевая система. Самая сложная игровая фаза.

**Задачи:**
- [x] `src/game/rules/swap.ts` — proposal, accept, reject → fight
- [x] `src/game/rules/rob.ts` — proposal (open/closed варианты), accept, reject → fight
- [x] `src/game/rules/fight.ts` — полная драка с союзниками и оружием:
  - Recruitment phase
  - Объявление оружия (открытие закрытого оружия)
  - Подсчёт сил
  - Resolve с правилом «при равенстве побеждает жертва»
  - Wounds + fatigue
- [x] Запрет обмена/выбрасывания припасов в драке
- [x] Корректное обновление сознания/смерти после ранений

**Тесты:**
- [x] Swap conscious target: accept → swap mat works.
- [x] Swap unconscious target: auto-accept, swap silently.
- [x] Swap rejected → fight starts.
- [x] Fight без союзников: атакующий 8 vs защитник 3 → атакующий выигрывает.
- [x] Fight tie: защитник побеждает.
- [x] Fight с союзником: 3 + 5 = 8 vs 8 → tie → жертва выигрывает (как в примере).
- [x] Fight с оружием: 3 + 4 (багор) = 7 vs 8 → атакующий побеждает.
- [x] Все участники получают fatigue (fighting), проигравшие — wounds.
- [x] Rob с равным числом → жертва побеждает, сохраняет припасы.
- [x] Невозможно отменить драку после объявления.

**Acceptance:** все примеры из правил воспроизводятся в тестах.

---

## Фаза 5: Game logic — evening

Навигация и её последствия.

**Задачи:**
- [x] `src/game/rules/evening.ts`:
  - Выбор карты (включая compass)
  - Резолв чаек → seagullTokens
  - Падения за борт: cook immunity, life_ring (open и закрытый), wounds, потеря open supplies
  - Смерть без сознания при падении (если нет круга)
  - Shark bait логика
  - Жажда: имя в карте + вёсла + силач, water для спасения, umbrella защита
  - Жажда у без сознания → death без воды от другого
- [x] Cleanup конца дня (fatigue tokens off, wounds stay)
- [x] Проверка «4 чайки → scoring»

**Тесты:**
- [x] Чайка добавляет жетон. Перечёркнутая убирает.
- [x] 4 чайки → переход в scoring.
- [x] Cook падает за борт → нет ранения, теряет открытые припасы.
- [x] Life_ring открытый: не падает.
- [x] Life_ring закрытый: можно открыть реактивно.
- [x] Без сознания + за борт без круга → death.
- [x] Без сознания + круг → остаётся в лодке.
- [x] Shark bait: всем за бортом +1 wound.
- [x] Жажда: имя + вёсла = 2 ранения.
- [x] 1 вода = -1 ранение.
- [x] Без сознания + жажда без воды → death.
- [x] Другой игрок отдал воду без сознания → спасён.

**Acceptance:** полная партия от начала до 4 чаек проходится автоматически (со скриптованными action'ами), все ходы валидны, scoring корректный.

---

## Фаза 6: XState machine — **ПРОПУЩЕНА**

> **Статус:** осознанно пропущена. См. [`decisions.md`](./decisions.md) #23. Phase живёт в `GameState` как discriminated union, переходы — в чистом reducer'е. Эквивалентно XState без runtime-зависимости.

~~Координатор фаз.~~

**Изначальные задачи (не реализованы):**
- [ ] `src/game/machine.ts` — XState машина
- [ ] Интеграция с reducer
- [ ] Auto-transitions (PHASE_ADVANCE)

---

## Фаза 7: Networking

P2P через PeerJS.

**Задачи:**
- [x] `src/net/peer.ts` — обёртка над PeerJS (createHost, createClient)
- [x] `src/net/protocol.ts` — типы ClientMessage, HostMessage
- [x] `src/net/host.ts` — host runtime: 
  - Принимает connections, делает join flow
  - Обрабатывает ACTION → reducer → broadcast STATE_UPDATE
  - Heartbeat, disconnect detection
- [x] `src/net/client.ts` — client runtime: connect, send actions, receive state
- [x] `src/game/filtered-view.ts` — `filterStateForPlayer(state, viewerId)`
- [x] `src/store/game-store.ts` — Zustand store: текущий filtered state, мои данные
- [x] Localstorage для clientToken (reconnect)

**Тесты:**
- [x] Unit: `filterStateForPlayer` скрывает чужие приватные данные.
- [x] Integration (с моком PeerJS): 2 peer'а соединяются, action отправляется, state обновляется на обоих.
- [x] Reconnect: клиент отключается и подключается с тем же token → продолжает игру.

**Acceptance:** на двух вкладках браузера один создаёт комнату, другой подключается, оба видят синхронизированный state.

---

## Фаза 8: UI MVP

Минималистичный интерфейс.

**Задачи:**
- [x] `src/ui/Lobby/` — создание комнаты, вход по ID, ввод ника, список игроков, кнопка "Старт" у host'а
- [x] `src/ui/Boat/` — главный игровой экран:
  - Визуализация лодки (нос → банки → корма)
  - Карты персонажей на банках с индикатором (сознание, ранения, жетоны)
  - Стопки припасов и навигации
  - Жетоны чаек на корме
  - Индикатор текущего хода
- [x] `src/ui/Hand/` — свои припасы (open + closed counts of others)
- [x] `src/ui/Actions/` — кнопки доступных действий в текущей фазе
- [x] `src/ui/NavCard/` — раскрытие карты вечером
- [x] `src/ui/Fight/` — модалка драки с союзниками и оружием
- [x] `src/ui/Log/` — журнал событий
- [x] Tailwind стилизация (минималистичная: тёмная тема, типографика, цветовые акценты)

**Acceptance:** партию вчетвером можно отыграть от начала до конца через UI. UI не самый красивый, но функциональный.

---

## Фаза 9: Bots

Боты для добора.

**Задачи:**
- [x] `src/bots/bot.ts` — interface Bot
- [x] `src/bots/simple-bot.ts` — реализация согласно `docs/05-bots.md`
- [x] Интеграция в host: если в lobby host добавляет бота, в game боту делегируются action'ы
- [x] UI в лобби: кнопка «добавить бота»

**Тесты:**
- [x] Полная партия 4 бота прогоняется без зависаний и невалидных actions.
- [x] Партия завершается за < 50 дней в 100% запусков.

**Acceptance:** Host один в комнате + 3 бота → может играть.

---

## Фаза 10: Polish — **ЧАСТИЧНО**

Доработка, шероховатости.

**Задачи:**
- [ ] Анимации переходов (Framer Motion) — пропущено, nice-to-have
- [ ] Звуковые уведомления (свой ход) — пропущено
- [ ] Reconnect UX (показывать «X отключился» с таймером) — частично: DisconnectModal без таймера
- [x] Обработка edge cases: host disconnect → game over
- [x] FAQ / help экран с правилами
- [x] Логи можно экспортировать (для дебага и постфактум-анализа) — кнопка «💾 Лог» + автоснапшот в localStorage

**Acceptance:** комфортно играть с друзьями вечером.

---

## Следующие шаги (не в MVP)

- Mobile-адаптивный UI (touch-events, vertical layout).
- Хостинг (Vercel для статики).
- Свой PeerServer.
- Свой арт.
- Голосовой чат через WebRTC audio (вместо Discord).
- Текстовый чат и/или структурированные «предложения».
- Бóлее умные боты.
- Замена ботов реконнект-таймером.
- Host migration.
- Лидерборд, статистика партий.
