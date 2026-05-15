# Roadmap — фазы разработки

Сборка проекта разбита на фазы. Каждая фаза имеет чёткие acceptance-критерии. **Не переходи к следующей фазе, пока критерии текущей не выполнены.**

Это путь для Claude Code: одна фаза = одна логическая итерация.

## Фаза 0: Bootstrap

Стартовый шаблон проекта.

**Задачи:**
- [ ] `npm create vite@latest` с React + TypeScript
- [ ] Установить зависимости: zustand, xstate, @xstate/react, peerjs, immer, seedrandom, nanoid, clsx, tailwindcss
- [ ] Установить dev: vitest, @vitest/ui, @types/seedrandom, eslint, prettier, eslint-config-prettier
- [ ] Настроить `tsconfig.json` с `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] Настроить ESLint + Prettier
- [ ] Настроить Tailwind
- [ ] Скрипты в `package.json`: dev, build, preview, test, typecheck, lint
- [ ] Создать структуру папок согласно `CLAUDE.md`
- [ ] Положить документы из `docs/` в репо
- [ ] Создать `src/game/constants.ts` с CHARACTERS, SUPPLY_PROPS из `docs/02-game-spec.md`
- [ ] Smoke test: `npm run dev` запускает пустую страницу с "За бортом", `npm test` проходит (с одним dummy тестом)

**Acceptance:** проект запускается, тесты проходят, линтер не ругается.

---

## Фаза 1: Game types & state

Базовые типы и initial state. Без логики, только структуры.

**Задачи:**
- [ ] `src/game/types.ts` — все типы из `docs/02-game-spec.md` (Player, Seat, Phase, Supply, NavigationCard, GameState, FilteredGameState)
- [ ] `src/game/actions.ts` — discriminated union Action
- [ ] `src/game/constants.ts` — CHARACTERS, SUPPLY_PROPS, состав колоды (с TODO-комментами по точным значениям)
- [ ] `src/game/state.ts` — `createInitialState(players, rng)`, фабрики
- [ ] `src/game/prng.ts` — обёртка над seedrandom: `createPRNG(seed)`, `shuffle`, `pick`
- [ ] `src/game/invariants.ts` — `checkInvariants(state): InvariantError[]`

**Тесты:**
- [ ] `createInitialState` для 4, 5, 6 игроков возвращает валидный state.
- [ ] `checkInvariants` на initial state ничего не возвращает (нет ошибок).
- [ ] Сумма карт в state равна 42 supply + 24 nav.
- [ ] Для 5/6 игроков `removedCharacters` правильной длины.

**Acceptance:** типы есть, initial state создаётся, инварианты проходят.

---

## Фаза 2: Game logic — morning + scoring

Самые простые фазы (нет драк, нет навигации).

**Задачи:**
- [ ] `src/game/reducer.ts` — главный диспатчер (case по action.type)
- [ ] `src/game/rules/morning.ts`:
  - `MORNING_CHOOSE_SUPPLY` — игрок выбирает, остаток передаётся
  - Корректное определение «следующего conscious игрока»
  - Авто-переход в day когда morning завершён
- [ ] `src/game/rules/scoring.ts`:
  - `scoreGame(state)` возвращает breakdown
  - Все правила: выживание, нарцисс, психопат, друг, враг, ценности, множители

**Тесты:**
- [ ] Morning: 4 conscious игрока → 4 раунда передачи → все получили по 1 карте.
- [ ] Morning: 1 conscious + 3 без сознания → conscious берёт 1 карту (= числу в сознании), остальные не участвуют.
- [ ] Morning: 0 conscious → фаза пропускается.
- [ ] Morning: пустая колода → пропуск.
- [ ] Scoring: каждый кейс из правил (нарцисс, психопат, друг=враг, множители у Миледи/Сноба/Капитана).

**Acceptance:** морнинг проходится, очки считаются для произвольного финального state.

---

## Фаза 3: Game logic — day actions (без драки)

Все дневные действия, не приводящие к драке.

**Задачи:**
- [ ] `src/game/rules/row.ts` — гребля, выбор оставляемых карт, весло, жетоны усталости
- [ ] `src/game/rules/use-supply.ts` — first_aid, umbrella, flare_gun, life_ring (reactive)
- [ ] `src/game/rules/trade.ts` — REVEAL_SUPPLY, GIVE_SUPPLY, DISCARD_SUPPLY (с проверкой «не в драке»)
- [ ] `src/game/rules/shket-steal.ts` — воровство Шкета
- [ ] Реализация порядка ходов и auto-advance после действия

**Тесты:**
- [ ] Row: 2 карты взято, 1 оставлена, 1 в низ колоды, fatigue (rowing) выставлен.
- [ ] Row с веслом: 3 карты вместо 2.
- [ ] Row с 2 вёслами: 4 карты.
- [ ] First aid: ранение снимается, без сознания → в сознание.
- [ ] Umbrella: перемещается в open targetа.
- [ ] Flare gun: 3 карты просмотрены, чайки применены, остальное игнор.
- [ ] Shket: ворует закрытое, у жертвы -1, у Шкета +1.
- [ ] Shket: не может воровать дважды за ход.

**Acceptance:** игра проходит N дней с 4 conscious игроками, никто не нападает.

---

## Фаза 4: Game logic — swap, rob, fight

Социальные действия и боевая система. Самая сложная игровая фаза.

**Задачи:**
- [ ] `src/game/rules/swap.ts` — proposal, accept, reject → fight
- [ ] `src/game/rules/rob.ts` — proposal (open/closed варианты), accept, reject → fight
- [ ] `src/game/rules/fight.ts` — полная драка с союзниками и оружием:
  - Recruitment phase
  - Объявление оружия (открытие закрытого оружия)
  - Подсчёт сил
  - Resolve с правилом «при равенстве побеждает жертва»
  - Wounds + fatigue
- [ ] Запрет обмена/выбрасывания припасов в драке
- [ ] Корректное обновление сознания/смерти после ранений

**Тесты:**
- [ ] Swap conscious target: accept → swap mat works.
- [ ] Swap unconscious target: auto-accept, swap silently.
- [ ] Swap rejected → fight starts.
- [ ] Fight без союзников: атакующий 8 vs защитник 3 → атакующий выигрывает.
- [ ] Fight tie: защитник побеждает.
- [ ] Fight с союзником: 3 + 5 = 8 vs 8 → tie → жертва выигрывает (как в примере).
- [ ] Fight с оружием: 3 + 4 (багор) = 7 vs 8 → атакующий побеждает.
- [ ] Все участники получают fatigue (fighting), проигравшие — wounds.
- [ ] Rob с равным числом → жертва побеждает, сохраняет припасы.
- [ ] Невозможно отменить драку после объявления.

**Acceptance:** все примеры из правил воспроизводятся в тестах.

---

## Фаза 5: Game logic — evening

Навигация и её последствия.

**Задачи:**
- [ ] `src/game/rules/evening.ts`:
  - Выбор карты (включая compass)
  - Резолв чаек → seagullTokens
  - Падения за борт: cook immunity, life_ring (open и закрытый), wounds, потеря open supplies
  - Смерть без сознания при падении (если нет круга)
  - Shark bait логика
  - Жажда: имя в карте + вёсла + силач, water для спасения, umbrella защита
  - Жажда у без сознания → death без воды от другого
- [ ] Cleanup конца дня (fatigue tokens off, wounds stay)
- [ ] Проверка «4 чайки → scoring»

**Тесты:**
- [ ] Чайка добавляет жетон. Перечёркнутая убирает.
- [ ] 4 чайки → переход в scoring.
- [ ] Cook падает за борт → нет ранения, теряет открытые припасы.
- [ ] Life_ring открытый: не падает.
- [ ] Life_ring закрытый: можно открыть реактивно.
- [ ] Без сознания + за борт без круга → death.
- [ ] Без сознания + круг → остаётся в лодке.
- [ ] Shark bait: всем за бортом +1 wound.
- [ ] Жажда: имя + вёсла = 2 ранения.
- [ ] 1 вода = -1 ранение.
- [ ] Без сознания + жажда без воды → death.
- [ ] Другой игрок отдал воду без сознания → спасён.

**Acceptance:** полная партия от начала до 4 чаек проходится автоматически (со скриптованными action'ами), все ходы валидны, scoring корректный.

---

## Фаза 6: XState machine

Координатор фаз.

**Задачи:**
- [ ] `src/game/machine.ts` — XState машина согласно `docs/04-state-machine.md`
- [ ] Интеграция с reducer: machine хранит phase, reducer применяет actions, machine реагирует на изменения phase
- [ ] Auto-transitions (PHASE_ADVANCE) реализованы

**Тесты:**
- [ ] Machine начинается в lobby.
- [ ] LOBBY_START_GAME → setup → morning.
- [ ] После последнего MORNING_CHOOSE_SUPPLY → day.
- [ ] После последнего day action → evening.
- [ ] Evening: 4 чайки → scoring.
- [ ] Невалидный action в данной фазе → reject (через reducer).

**Acceptance:** machine driven игра проходит цикл lobby→play→scoring без ручного диспатча PHASE_ADVANCE.

---

## Фаза 7: Networking

P2P через PeerJS.

**Задачи:**
- [ ] `src/net/peer.ts` — обёртка над PeerJS (createHost, createClient)
- [ ] `src/net/protocol.ts` — типы ClientMessage, HostMessage
- [ ] `src/net/host.ts` — host runtime: 
  - Принимает connections, делает join flow
  - Обрабатывает ACTION → reducer → broadcast STATE_UPDATE
  - Heartbeat, disconnect detection
- [ ] `src/net/client.ts` — client runtime: connect, send actions, receive state
- [ ] `src/game/filtered-view.ts` — `filterStateForPlayer(state, viewerId)`
- [ ] `src/store/game-store.ts` — Zustand store: текущий filtered state, мои данные
- [ ] Localstorage для clientToken (reconnect)

**Тесты:**
- [ ] Unit: `filterStateForPlayer` скрывает чужие приватные данные.
- [ ] Integration (с моком PeerJS): 2 peer'а соединяются, action отправляется, state обновляется на обоих.
- [ ] Reconnect: клиент отключается и подключается с тем же token → продолжает игру.

**Acceptance:** на двух вкладках браузера один создаёт комнату, другой подключается, оба видят синхронизированный state.

---

## Фаза 8: UI MVP

Минималистичный интерфейс.

**Задачи:**
- [ ] `src/ui/Lobby/` — создание комнаты, вход по ID, ввод ника, список игроков, кнопка "Старт" у host'а
- [ ] `src/ui/Boat/` — главный игровой экран:
  - Визуализация лодки (нос → банки → корма)
  - Карты персонажей на банках с индикатором (сознание, ранения, жетоны)
  - Стопки припасов и навигации
  - Жетоны чаек на корме
  - Индикатор текущего хода
- [ ] `src/ui/Hand/` — свои припасы (open + closed counts of others)
- [ ] `src/ui/Actions/` — кнопки доступных действий в текущей фазе
- [ ] `src/ui/NavCard/` — раскрытие карты вечером
- [ ] `src/ui/Fight/` — модалка драки с союзниками и оружием
- [ ] `src/ui/Log/` — журнал событий
- [ ] Tailwind стилизация (минималистичная: тёмная тема, типографика, цветовые акценты)

**Acceptance:** партию вчетвером можно отыграть от начала до конца через UI. UI не самый красивый, но функциональный.

---

## Фаза 9: Bots

Боты для добора.

**Задачи:**
- [ ] `src/bots/bot.ts` — interface Bot
- [ ] `src/bots/simple-bot.ts` — реализация согласно `docs/05-bots.md`
- [ ] Интеграция в host: если в lobby host добавляет бота, в game боту делегируются action'ы
- [ ] UI в лобби: кнопка «добавить бота»

**Тесты:**
- [ ] Полная партия 4 бота прогоняется без зависаний и невалидных actions.
- [ ] Партия завершается за < 50 дней в 100% запусков.

**Acceptance:** Host один в комнате + 3 бота → может играть.

---

## Фаза 10: Polish

Доработка, шероховатости.

**Задачи:**
- [ ] Анимации переходов (Framer Motion)
- [ ] Звуковые уведомления (свой ход)
- [ ] Reconnect UX (показывать «X отключился» с таймером)
- [ ] Обработка edge cases: host disconnect → game over
- [ ] FAQ / help экран с правилами
- [ ] Логи можно экспортировать (для дебага и постфактум-анализа)

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
