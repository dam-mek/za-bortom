# CLAUDE.md

Контекст проекта для Claude Code. Читай этот файл в начале каждой сессии и при сомнениях.

> **Первым делом** открой [`docs/STATUS.md`](./docs/STATUS.md) — там актуальная картина: что готово, что осталось, какие TODO. Файлы дизайна (`docs/*.md`) — справочные, могут расходиться с кодом; авторитет — [`docs/decisions.md`](./docs/decisions.md).
>
> Merged from `CLAUDE.md` + `CLAUDE-2.md` on 2026-05-15.

## Что строим

P2P веб-версия настольной игры «За бортом» (Lifeboats, Jeff Siadek ©2001, локализация Magellan). Социальная игра 4-6 человек с переговорами, блефом, скрытой информацией и сложной фазовой структурой. Для приватной игры с друзьями через WebRTC; **публичный хостинг не цель**.

Полные правила и формализованные механики: [`docs/game-rules.md`](./docs/game-rules.md). **Перед изменением игровой логики — перечитай соответствующую секцию rules.**

## Стек

- **React 18 + TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`, никаких `any` без комментария)
- **Vite** — dev/build
- **Zustand** — UI store
- ~~XState~~ — **не используется** (decision #23). Фаза = поле `GameState.phase`, переходы — в reducer'е. См. [`docs/state-machine.md`](./docs/state-machine.md) для логической карты подфаз.
- **PeerJS** — WebRTC P2P, бесплатный публичный signaling broker `peerjs.com` (см. [`docs/network-protocol.md`](./docs/network-protocol.md))
- **Tailwind CSS** — минималистичный визуал на MVP
- **Immer** — иммутабельность в reducer
- **mulberry32** — детерминированный PRNG (короткая реализация в `src/game/prng.ts`, без внешней dep)
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

### 7. Phase — поле GameState, переходы в reducer'е

`GameState.phase` — discriminated union (`{ kind: 'morning'; subPhase: ... } | ...`). Все переходы делает `reduce()` через делегацию в `src/game/rules/*.ts`. Невалидный action в текущей фазе → `WRONG_PHASE`/`NOT_YOUR_TURN` через guard'ы (`requireMyDayTurn` и т.п.). Тесты `tests/game/*.test.ts` покрывают каждую переходную ветку. См. [`decisions.md`](./docs/decisions.md) #23 — почему не XState.

### 8. Покрытие игровой логики ≥ 90%

UI и net могут быть ниже. Scoring, fight resolution, evening navigation — исчерпывающие тесты, включая edge-cases из FAQ в `docs/game-rules.md`.

## Структура проекта

Подробное описание каждого файла — в [`README.md`](./README.md) §«Структура проекта». Кратко:

```
src/
  game/                 # pure logic (ни React, ни PeerJS)
    types.ts            # GameState, Phase, Action contract, FilteredGameState
    actions.ts          # discriminated union Action (kind:)
    constants.ts        # CHARACTERS, SUPPLY_PROPS, размеры колод
    prng.ts             # mulberry32 (детерминированный, функциональный)
    state.ts            # createInitialState — раздача
    reducer.ts          # главный диспатчер по action.kind
    visibility.ts       # filterStateForPlayer(state, viewerId)
    invariants.ts       # checkInvariants(state) — 10 проверок
    rules/              # по правилу на файл
      _helpers.ts       # advanceTurn, drawNavCards, addSeagull, applyWoundDelta
      morning.ts row.ts swap.ts rob.ts fight.ts
      shket-steal.ts use-supply.ts trade.ts evening.ts scoring.ts
  net/                  # P2P через PeerJS
    protocol.ts         # ClientMessage / HostMessage (kebab-case)
    transport.ts        # абстракция (mockable)
    peerjs-transport.ts # production адаптер
    in-memory-transport.ts # in-process mock для тестов
    host.ts             # HostController (join flow, broadcast, drives ботов)
    client.ts           # ClientController (dispatch+ack, подписки)
  bots/
    bot.ts              # interface Bot
    simple-bot.ts       # эвристический
  store/
    game-store.ts       # Zustand, режимы local/host/client
  ui/                   # React-компоненты (плоско, без подпапок)
    App.tsx (на самом деле в src/)
    Lobby.tsx WaitingRoom.tsx Game.tsx
    BoatView.tsx ActionPanel.tsx LogPane.tsx
    Help.tsx DisconnectModal.tsx
tests/                  # зеркало src/, vitest
  game/  net/  bots/
docs/
  STATUS.md             # текущее состояние (читать первым)
  game-rules.md         # правила игры (источник истины)
  game-spec.md          # типы, actions, reducer contract
  network-protocol.md   # P2P wire-протокол
  state-machine.md      # логическая карта фаз (XState НЕ реализован)
  visibility-model.md   # что видит игрок
  bots.md               # эвристики ботов
  roadmap.md            # история плана (все фазы выполнены, см. STATUS)
  decisions.md          # резолюции 23 open questions (авторитет!)
```

## Конвенции кода

- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`. Никаких `any` без комментария. Если очень нужно — `unknown` + type guards.
- **ESLint + Prettier**: single quotes, no semicolons.
- **Файлы**: kebab-case (`first-aid.ts`).
- **Типы/enums**: PascalCase (`PlayerState`).
- **Функции/переменные**: camelCase.
- **Константы игры**: SCREAMING_SNAKE_CASE в `constants.ts` (`SUPPLY_DECK_SIZE = 42`).
- **Action types / Discriminated unions**: поле `kind: 'SCREAMING_SNAKE'` (`ROW`, `OFFER_SWAP`, `ACCEPT_SWAP`, `DECLARE_FIGHT`, ...). Без префикса фазы — фазу валидирует FSM. Внутри game-логики и сетевого протокола дискриминатор — **всегда `kind`**, не `type`.
- **Сетевой протокол (wire)**: сообщения kebab-case через `kind` — `{ kind: 'state-update', ... }`, `{ kind: 'action', payload: { kind: 'ROW' } }`.
- **Reducer**: чистая функция `(state, action) => { ok: true; state; events } | { ok: false; error }`. Без побочных эффектов, без рандома (rng — поле в `state.rng`, обновляется иммутабельно).
- **Рандом**: mulberry32, seed — `number`. В тестах — детерминированный seed; в проде — случайный.
- **Идентификаторы**: всегда английский/Latin. Комментарии в коде — допустимо по-русски (особенно для разъяснения правил).
- **Игровые термины в коде**: персонажи — camelCase транслит (`bocman`, `shket`, `snob`, `kapitan`, `miledi`, `cherpak`); типы карт — snake_case (`water`, `first_aid`, `umbrella`, `flare`, `compass`, `life_ring`, `oar`, `shark_bait`, `club`, `hook`, `knife`, `money`, `jewelry`, `painting`). См. [`docs/decisions.md`](./docs/decisions.md).
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

Гоняются в тестах (`src/game/invariants.ts:checkInvariants`):

1. Сумма карт supply (deck + discard + у игроков + `morning.pile`) = 42.
2. Сумма карт nav (deck + discard + pool + `evening.sternPicking.pool` или `resolving.cardId`) = 24.
3. Любой персонаж присутствует ровно один раз; не пересекается с `removedCharacters`.
4. `consciousness` соответствует `wounds`: `< strength` → conscious; `==` → unconscious; `>` → dead.
5. `seagullTokens` в `[0, 4]`. При `== 4` → фаза `scoring` или `finished`.
6. `seats.length === 6`. `removed seats` = `6 − len(players)`.
7. `removedCharacters.length` = `6 − len(players)` (для 4-/5-игрового сетапа).
8. `turnOrder` ⊆ обитаемые банки (проверяется только в `phase=day`).
9. `phase=finished` ⇒ `finalScores != null`.
10. Все ссылки `supplyId` в state валидны (есть в `supplyById`).

После драки все участники получают `fought=true`; проигравшая сторона — `wounds += 1` (применяется через `applyWoundDelta`, который автоматически пересчитывает consciousness).

## Где что искать

- **Что готово / что осталось?** → [`docs/STATUS.md`](./docs/STATUS.md) — актуальный срез проекта.
- **Структура файлов?** → [`README.md`](./README.md) §«Структура проекта».
- **Вопрос по правилам?** → [`docs/game-rules.md`](./docs/game-rules.md). Если неясно — СПРОСИ, не гадай.
- **Добавляешь action?** → обнови [`docs/game-spec.md`](./docs/game-spec.md), потом `types.ts`, reducer (`src/game/rules/*.ts`), тесты, UI (`src/ui/ActionPanel.tsx`).
- **Добавляешь переход фазы?** → [`docs/state-machine.md`](./docs/state-machine.md) (логическая карта) первым, потом в коде.
- **Sync / multiplayer issue?** → [`docs/network-protocol.md`](./docs/network-protocol.md) + `src/net/*.ts`.
- **Что видит игрок?** → [`docs/visibility-model.md`](./docs/visibility-model.md) + `src/game/visibility.ts`.
- **Принятые решения (резолюции open questions)?** → [`docs/decisions.md`](./docs/decisions.md) — этот файл перевешивает остальные доки при расхождении.

## Чего НЕ делать

- Не использовать `React.Context` для game state — недостаточно реактивен для частых обновлений. Только Zustand.
- Не использовать `Date.now()` или `Math.random()` в reducer'е. Только инжектированные зависимости.
- Не реализовывать host migration в первой версии. Если host отвалился — игра завершается.
- Не делать локальную копию reducer на клиенте «для оптимизации».
- Не модифицировать карты навигации, чтобы «упростить» — все 24 карты как в правилах.

## Out of scope (не делать без согласования)

- Voice chat (используем внешний Discord)
- In-app text chat (решение отложено)
- Mobile-first UI (desktop-first; mobile — будущая фаза)
- Custom art / non-minimalist visuals (минимализм сейчас, арт потом)
- Spectator mode для не-игроков (только мёртвые наблюдают)
- Host migration (если хост отвалился — игра завершается; DisconnectModal у клиентов)

> **NB:** Hot-seat изначально был помечен out-of-scope, но был реализован для удобства разработки/тестирования. Сейчас это полноценный режим в `Lobby.tsx`.

## Definition of done для задачи

- [ ] Типы в `types.ts` обновлены (если применимо)
- [ ] Reducer / `rules/*.ts` обрабатывает новые action(s), возвращает типизированный `GameError` на невалидный ввод
- [ ] Тесты (happy path + ≥ 2 edge cases из `docs/game-rules.md`)
- [ ] Phase-guards добавлены в reducer если action phase-restricted (`requireMyDayTurn` и т.п.)
- [ ] Visibility-фильтр обрабатывает новые приватные поля (если есть)
- [ ] Инварианты в `invariants.ts` учитывают новые поля (если влияют на сохранение карт/банок)
- [ ] `npm run typecheck && npm run test:run && npm run lint` зелёные
- [ ] Если user-facing — UI smoke-test вручную

## Текущее состояние

См. [`docs/STATUS.md`](./docs/STATUS.md) — что готово, что осталось. Roadmap ([`docs/roadmap.md`](./docs/roadmap.md)) выполнен (Фаза 6 пропущена осознанно, Фаза 10 частично).

## Стек разработки и деплоя

- **Dev:** `npm run dev` → Vite на `localhost:5173`.
- **Тесты:** `npm test` / `npm run test:run` / `npm run test:ui`.
- **Деплой:** Cloudflare Workers через `wrangler` (`wrangler.jsonc`, скрипт `npm run deploy`).
- **Альтернативно для друзей без деплоя:** `ngrok http 5173`.
