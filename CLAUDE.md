# CLAUDE.md

Контекст проекта для Claude Code. Читай этот файл в начале каждой сессии и при сомнениях.

> Merged from `CLAUDE.md` + `CLAUDE-2.md` on 2026-05-15.

## Что строим

P2P веб-версия настольной игры «За бортом» (Lifeboats, Jeff Siadek ©2001, локализация Magellan). Социальная игра 4-6 человек с переговорами, блефом, скрытой информацией и сложной фазовой структурой. Для приватной игры с друзьями через WebRTC; **публичный хостинг не цель**.

Полные правила и формализованные механики: [`docs/game-rules.md`](./docs/game-rules.md). **Перед изменением игровой логики — перечитай соответствующую секцию rules.**

## Стек

- **React 18 + TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`, никаких `any` без комментария)
- **Vite** — dev/build
- **Zustand** — UI store
- **XState** — машина фаз (см. [`docs/state-machine.md`](./docs/state-machine.md))
- **PeerJS** — WebRTC P2P, бесплатный публичный signaling broker `peerjs.com` (см. [`docs/network-protocol.md`](./docs/network-protocol.md))
- **Tailwind CSS** — минималистичный визуал на MVP
- **Immer** — иммутабельность в reducer
- **seedrandom** — детерминированный PRNG
- **Vitest** (+ `@vitest/ui`) — unit/integration; Playwright — позже для E2E
- **ESLint + Prettier** — single quotes, no semicolons
- **Node >= 20**

## Команды

| Действие | Команда |
|---|---|
| Установка | `npm install` |
| Dev server | `npm run dev` |
| Tests (watch) | `npm test` |
| Tests (CI) | `npm run test:run` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Preview | `npm run preview` |

Перед declaring task complete: `npm run typecheck && npm run test:run && npm run lint` должно проходить.

## Архитектурные принципы

### 1. Строгое разделение слоёв

```
src/game/   → чистая логика, pure TypeScript. НЕ ИМПОРТИРУЕТ React, PeerJS, XState, Zustand, DOM, window.
src/fsm/    → XState машина фаз.
src/net/    → сетевой слой. Использует src/game, не знает про UI.
src/ui/     → React-компоненты. Подписывается на store, шлёт Actions через net.
src/bots/   → боты. Используют src/game для понимания state, выдают Actions.
src/store/  → Zustand-store. Промежуточный слой между net и ui.
```

Импорт React/PeerJS внутри `src/game/` — это баг архитектуры, не фича.

### 2. Host-authoritative модель

Один игрок (создатель комнаты) — host. У него запускается reducer, валидируются все Actions. Клиенты получают отфильтрованный snapshot state и не имеют локальной копии reducer'а.

Из этого следует: **клиент не может изменить state сам**. Он шлёт Action → ждёт ответа от host'а → видит новый state.

Optimistic UI разрешён только для очевидно невалидируемых действий (например, локальная подсветка карты при наведении). Для game actions — нет. Локальная копия reducer на клиенте «для оптимизации» — путь к багам рассинхронизации.

### 3. Фильтрация state по игроку

На host'е лежит полный state. Перед отправкой игроку X состояние редактируется:
- Чужие закрытые припасы → только количество, без содержимого
- Чужие карты друга/врага → скрыты
- Карты навигации в стопке от гребцов → скрыты до раскрытия
- Содержимое колод припасов/навигации → только размер

См. [`docs/visibility-model.md`](./docs/visibility-model.md) и секцию «Фильтрация» в [`docs/network-protocol.md`](./docs/network-protocol.md).

**Безопасность:** игрок не должен иметь возможности подсмотреть чужие данные в DevTools. Это игровое правило, реализованное через сеть, а не через UI-сокрытие.

### 4. Иммутабельность

Используем Immer для удобства, но reducer возвращает новый объект. Никаких мутаций входного state.

### 5. Reducer не бросает на game errors

```ts
type ReducerResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: GameError }

function reduce(state: GameState, action: Action): ReducerResult
```

Невалидное действие — это `ok: false`, не исключение. `GameError` имеет `code: ErrorCode` (enum) и человеко-читаемое `message`. Host принимает решение что делать (отправить ошибку клиенту).

### 6. Никакой случайности в reducer'е

Не использовать `Math.random()`, `Date.now()` в reducer'е. Только инжектированные зависимости. Случайность — из `state.rng` (сидированный PRNG). Одинаковый seed + одинаковые actions = одинаковый исход. Это нужно для:
- воспроизводимых баг-репортов
- debug-replay
- self-play ботов

### 7. Одна машина фаз, один источник истины

XState владеет phase. Reducer принимает action только если FSM в state, который его разрешает. Тесты покрывают обе стороны.

### 8. Покрытие игровой логики ≥ 90%

UI и net могут быть ниже. Scoring, fight resolution, evening navigation — исчерпывающие тесты, включая edge-cases из FAQ в `docs/game-rules.md`.

## Структура проекта

```
src/
  game/
    types.ts          # GameState, Action, Card, Player, Phase, ...
    state.ts          # initialState, фабрики
    actions.ts        # discriminated union Action
    reducer.ts        # (state, action) => ReducerResult — главный диспатчер
    rules/
      setup.ts        # раздача ролей, друзей, врагов
      morning.ts      # раздача припасов
      day.ts          # дневные действия (диспатчер)
      row.ts          # «Погрести»
      swap.ts         # «Поменяться местами»
      rob.ts          # «Ограбить»
      fight.ts        # драка (общая для swap/rob)
      use-supply.ts   # special supplies
      shket-steal.ts  # способность Шкета
      trade.ts        # обмен/дарение/выброс
      evening.ts      # навигация
      scoring.ts      # подсчёт очков
    visibility.ts     # filterStateForPlayer(state, viewerId)
    prng.ts           # обёртка seedrandom: createPRNG, shuffle, pick
    constants.ts      # CHARACTERS, SUPPLY_PROPS, состав колод
    invariants.ts     # checkInvariants(state): InvariantError[]
    fixtures.ts       # готовые состояния для тестов
  fsm/
    machine.ts        # XState машина фаз
  net/
    peer.ts           # PeerJS обёртка (createHost, createClient)
    protocol.ts       # ClientMessage, HostMessage
    host.ts           # host runtime
    client.ts         # client runtime
    serialization.ts  # JSON (вкл. Map/Set если нужно)
  bots/
    bot.ts            # interface Bot { decide(state): Action }
    simple-bot.ts     # эвристический бот
  store/
    game-store.ts     # Zustand: текущий filtered state
    ui-store.ts       # Zustand: UI-only state (модалки, hover)
  ui/
    Lobby/  Boat/  Hand/  Actions/  NavCard/  Fight/  Log/  common/
  App.tsx
  main.tsx
tests/
  game/
  fixtures/
docs/
  game-rules.md          # формализованные правила (источник истины)
  game-spec.md           # типы, actions, reducer contract
  network-protocol.md    # P2P-протокол, фильтрация state
  state-machine.md       # XState фазы
  visibility-model.md    # что видит каждый игрок
  bots.md                # спецификация ботов
  roadmap.md             # фазы разработки с acceptance-критериями
public/
  assets/
```

## Конвенции кода

- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`. Никаких `any` без комментария. Если очень нужно — `unknown` + type guards.
- **ESLint + Prettier**: single quotes, no semicolons.
- **Файлы**: kebab-case (`first-aid.ts`).
- **Типы/enums**: PascalCase (`PlayerState`).
- **Функции/переменные**: camelCase.
- **Константы игры**: SCREAMING_SNAKE_CASE в `constants.ts` (`SUPPLY_DECK_SIZE = 42`).
- **Action types**: discriminated union, поле `type: 'SCREAMING_SNAKE'` (`ROW`, `OFFER_SWAP`, `ACCEPT_SWAP`, `DECLARE_FIGHT`, ...).
- **Reducer**: чистая функция, без побочных эффектов, без рандома (рандом — отдельная зависимость, инжектится через `state.rng`).
- **Рандом**: `seedrandom` (или передаваемый PRNG) для воспроизводимости тестов. В тестах — детерминированный seed; в проде — случайный.
- **Идентификаторы**: всегда английский/Latin. Комментарии в коде — допустимо по-русски (особенно для разъяснения правил).
- **Игровые термины в коде**: транслит русских имён (`Bocman`, `Shket`, `Snob`, `Kapitan`, `Miledi`, `Cherpak`). Типы карт — английский (`water`, `firstAid`, `umbrella`, `flare`, `compass`, `lifeRing`, `oar`, `sharkBait`, `club`, `hook`, `knife`, `money`, `jewelry`, `painting`). **Если в `docs/game-rules.md` остался open-question по casing — синхронизировать после решения.**
- **GameError**: класс/тип с `code: ErrorCode` (enum) и `message`.
- **Commits**: imperative, с префиксом подсистемы — `game: implement fight resolution`, `fsm: add evening sub-states`, `net: handle peer disconnect`.

## Workflow при разработке игровой логики

1. Найди в [`docs/game-rules.md`](./docs/game-rules.md) релевантную секцию.
2. Напиши failing-тест в `tests/game/` на конкретное поведение.
3. Реализуй в `src/game/rules/` соответствующий модуль.
4. Подключи в reducer через case в discriminated union.
5. Покрой edge cases из FAQ и сценариев правил.
6. Обнови [`docs/state-machine.md`](./docs/state-machine.md), если затронуты фазы.
7. Если появились приватные поля — обнови `visibility.ts` и [`docs/visibility-model.md`](./docs/visibility-model.md).

## Workflow при разработке UI

1. Определи, какие данные UI нужны из state — добавь селектор в `store/`.
2. Определи, какие Actions UI генерирует — они уже должны быть в `src/game/actions.ts`.
3. Компонент: подписка через `useStore`, отправка Actions через `useNet()` хук.
4. Никакой локальной модификации game state. Только UI-state (выбор, hover, модалки).

## Критические инварианты

Гоняются в dev-режиме каждое обновление state (`src/game/invariants.ts`):

1. Сумма карт по всем стопкам и игрокам = константа.
2. Любой персонаж в `seats` существует ровно один раз.
3. У персонажа без сознания `wounds === character.strength`; у мёртвого `wounds > character.strength`.
4. После драки все участники получили `fatigue >= 1`; проигравшая сторона — `wounds += 1`.
5. После раскрытия карты навигации все её эффекты применены (чайки, за борт, жажда).
6. Сумма seagullTokens на корме ≤ 4. При = 4 — переход в `scoring`.

## Где что искать

- **Вопрос по правилам?** → [`docs/game-rules.md`](./docs/game-rules.md). Если неясно — СПРОСИ, не гадай.
- **Добавляешь action?** → обнови [`docs/game-spec.md`](./docs/game-spec.md), потом `types.ts`, reducer, тесты, UI.
- **Добавляешь переход фазы?** → [`docs/state-machine.md`](./docs/state-machine.md) первым.
- **Sync / multiplayer issue?** → [`docs/network-protocol.md`](./docs/network-protocol.md).
- **Что видит игрок?** → [`docs/visibility-model.md`](./docs/visibility-model.md).
- **Где сейчас находимся в проекте?** → [`docs/roadmap.md`](./docs/roadmap.md).

## Чего НЕ делать

- Не использовать `React.Context` для game state — недостаточно реактивен для частых обновлений. Только Zustand.
- Не использовать `Date.now()` или `Math.random()` в reducer'е. Только инжектированные зависимости.
- Не реализовывать host migration в первой версии. Если host отвалился — игра завершается.
- Не делать локальную копию reducer на клиенте «для оптимизации».
- Не модифицировать карты навигации, чтобы «упростить» — все 24 карты как в правилах.

## Out of scope (не делать без согласования)

- Voice chat (используем внешний Discord)
- In-app text chat (решение отложено)
- Hot-seat (решение: нет — сразу P2P)
- Mobile-first UI (desktop-first; mobile — будущая фаза)
- Custom art / non-minimalist visuals (минимализм сейчас, арт потом)
- Public hosting / accounts / persistence (P2P, эфемерная сессия)
- Spectator mode (только мёртвые наблюдают)

## Definition of done для задачи

- [ ] Типы в `types.ts` обновлены (если применимо)
- [ ] Reducer обрабатывает новые action(s), возвращает типизированный `GameError` на невалидный ввод
- [ ] Тесты (happy path + ≥ 2 edge cases из `docs/game-rules.md`)
- [ ] FSM обновлена, guards добавлены если action phase-restricted
- [ ] Visibility-фильтр обрабатывает новые приватные поля
- [ ] `npm run typecheck && npm run test:run && npm run lint` зелёные
- [ ] Если user-facing — UI smoke-test вручную

## Следующие шаги

См. [`docs/roadmap.md`](./docs/roadmap.md) — разбивка на фазы 0–10 с acceptance-критериями.
