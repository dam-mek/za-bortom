# За бортом — веб-версия

P2P веб-реализация настольной игры «За бортом» (Magellan / Jeff Siadek, 2001).

**Состояние:** играбельный MVP. Hot-seat (за одним экраном) + P2P через WebRTC + боты-наполнители. Полные правила реализованы, 161 unit/integration тест зелёный. Подробнее см. [`docs/STATUS.md`](./docs/STATUS.md).

## Стек

React 18 + TypeScript (strict) · Vite 6 · Zustand · PeerJS · Vitest · Tailwind · Cloudflare Workers (для деплоя).

`XState` указан в стек-доках, но **не используется** — фаза игры живёт внутри `GameState` как discriminated union, переходы делает чистый reducer. См. [`docs/decisions.md`](./docs/decisions.md) #23.

## Запуск локально

```bash
npm install
npm run dev          # vite dev на http://localhost:5173 (с HMR)
```

Другие скрипты:

| Команда | Что делает |
|---|---|
| `npm test` | vitest в watch-режиме |
| `npm run test:run` | прогон всех тестов один раз (для CI) |
| `npm run test:ui` | vitest-ui в браузере |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run format` | prettier --write . |
| `npm run build` | typecheck + vite build → `dist/` |
| `npm run preview` | build + локальный wrangler-сервер (имитация прода) |
| `npm run deploy` | build + публикация в Cloudflare Workers |

Перед declaring task complete: `typecheck && test:run && lint` зелёные.

## Деплой друзьям

Два пути.

**Cloudflare Workers** (постоянный URL, бесплатно). Конфиг — [`wrangler.jsonc`](./wrangler.jsonc):

```bash
npx wrangler login         # один раз — авторизация в Cloudflare
npm run deploy             # каждый раз когда хочешь обновить
```

**ngrok** (временный туннель на localhost). Подходит для быстрых тестов:

```bash
npm run dev
ngrok http 5173            # в другом терминале → даст https://abc.ngrok-free.app
```

В обоих случаях друзья открывают URL → «Подключиться» → вставляют код комнаты `boat-xxxx`, который ты получаешь после «Создать комнату».

## Структура проекта

### Корень

| Файл / папка | Зачем |
|---|---|
| `index.html` | Точка входа для Vite. Загружает `src/main.tsx`. |
| `package.json` | Зависимости, скрипты, метаданные npm-пакета. |
| `tsconfig.json` / `tsconfig.node.json` | TypeScript-конфиг (strict, noUncheckedIndexedAccess). |
| `vite.config.ts` | Vite-конфиг: React-плагин, Cloudflare-плагин, alias `@→src/`, разрешение любых host'ов (для ngrok). |
| `vitest.config.ts` | Конфиг тестов: jsdom-environment, alias, coverage-настройки. |
| `tailwind.config.js` / `postcss.config.js` | Tailwind + PostCSS. |
| `eslint.config.js` | Flat-config: запрет импортов React/PeerJS/XState/Zustand внутри `src/game/`, отключение react-hooks-правил там же. |
| `.prettierrc.json` / `.prettierignore` | Prettier: single quotes, no semi, 100 cols. |
| `wrangler.jsonc` | Cloudflare Workers конфиг (SPA fallback, nodejs_compat). |
| `CLAUDE.md` | Инструкции/контекст для Claude Code. Стек, конвенции, архитектура. |
| `docs/` | Дизайн-документы. См. ниже. |
| `src/` | Исходники. |
| `tests/` | Vitest-тесты, зеркалят `src/`. |
| `dist/` | Сборка (gitignored). |
| `.wrangler/` | Локальный кэш wrangler (gitignored). |

### `src/`

```
src/
├── main.tsx               # точка входа React
├── App.tsx                # роутинг Lobby ↔ WaitingRoom ↔ Game + DisconnectModal
├── index.css              # Tailwind-импорт
├── game/                  # ЧИСТАЯ игровая логика (без React/сети/DOM)
├── store/                 # Zustand-store (мост между game/net и UI)
├── net/                   # P2P-сеть через PeerJS
├── bots/                  # эвристические боты-игроки
└── ui/                    # React-компоненты
```

#### `src/game/` — игровая логика

Чистый TypeScript, **никаких импортов React/PeerJS/XState/Zustand/DOM**. Можно прогонять на голом Node для тестов.

| Файл | Зачем |
|---|---|
| `types.ts` | `GameState`, `Player`, `Seat`, `Phase` + подфазы, `SupplyCard`, `NavigationCard`, `FilteredGameState`, `FilteredPlayer`, `GameError`, `ReducerResult`. |
| `constants.ts` | `CHARACTERS` (6 персонажей), `SUPPLY_TYPES`, `SUPPLY_PROPS` с weaponStrength/valuePoints (плейсхолдеры, см. `decisions.md` #21), множители очков, размеры колод. |
| `actions.ts` | Discriminated union `Action` — все действия игроков и системы (lobby/morning/day/fight/evening/reactive). Дискриминатор `kind:`. |
| `prng.ts` | Mulberry32 — детерминированный PRNG. `RngState` иммутабельный, `createRng`/`nextFloat`/`nextInt`/`shuffle`/`pick`. |
| `state.ts` | `createInitialState({ players, seed, hostId, gameId })` — раздача ролей/друзей/врагов, начальная колода, банки. |
| `reducer.ts` | Главный диспатчер `reduce(state, action): ReducerResult`. Switch по `action.kind`, делегирует в `rules/*.ts`. Чистая функция. |
| `visibility.ts` | `filterStateForPlayer(state, viewerId) → FilteredGameState`. Скрывает чужие закрытые карты, friend/enemy, содержимое колод. |
| `invariants.ts` | `checkInvariants(state)` / `assertInvariants(state)` — 10 проверок (сумма карт, consciousness↔wounds, banki, seagulls 0..4 и т.д.). Гоняется в тестах. |
| `rules/` | По одному файлу на действие/группу действий. |

##### `src/game/rules/`

| Файл | Какие actions обрабатывает |
|---|---|
| `_helpers.ts` | Общие хелперы: `err`, `requireMyDayTurn`, `advanceTurn`, `drawNavCards` (с рециклингом), `addSeagull`/`removeSeagull` (4→scoring), `applyWoundDelta` (auto-смерть/несознание), перемещение карт между руками. |
| `morning.ts` | `START_GAME` (→ enterMorning), `CHOOSE_SUPPLY`. Раздача припасов по цепочке, переход в day. |
| `row.ts` | `ROW` (тянет 2+oars карт, авто-раскрывает вёсла), `ROW_KEEP_CARDS`. |
| `swap.ts` | `OFFER_SWAP`, `executeSwap` (используется при accept и при победе атакующего). |
| `rob.ts` | `OFFER_ROB`, `enterCompletingRobPick`, `ROB_PICK` (open или random closed). |
| `fight.ts` | `PROPOSAL_ACCEPT/REJECT` (диспатч в swap/rob/fight), `FIGHT_RECRUIT_ALLY`, `FIGHT_ALLY_RESPONSE`, `FIGHT_ADD_WEAPON`, `FIGHT_CLOSE_RECRUITMENT` + `resolveFight` (сила сторон, ties→жертва, +1 wound проигравшим, fatigue, single-use weapon в discard). |
| `shket-steal.ts` | `SHKET_STEAL` — способность Шкета: случайная закрытая у жертвы → к Шкету. |
| `use-supply.ts` | `USE_FIRST_AID`, `USE_UMBRELLA`, `USE_FLARE` (3 карты nav, чайки, game-over при 4). |
| `trade.ts` | `REVEAL_SUPPLY`, `DISCARD_SUPPLY`, `GIVE_SUPPLY`. DISCARD/GIVE блокированы в драке. |
| `evening.ts` | Самый большой: `EVENING_USE_COMPASS`, `EVENING_SELECT_NAV_CARD` + полный FSM resolution: seagulls (auto) → overboard (life_ring choice) → shark_bait → thirst (water/umbrella) → cleanup → enterMorning. |
| `scoring.ts` | `scoreGame(state)` / `scorePlayer(state, pid)` — выживание с modifiers (нарцисс ×2, психопат 0/+3 за мёртвых), valuables с множителями, friend/enemy edge case (friend=enemy → одно правило), `determineWinners` с tiebreaker alive>dead. |

#### `src/store/`

| Файл | Зачем |
|---|---|
| `game-store.ts` | Zustand-store с тремя режимами: `local` (hot-seat), `host` (P2P-сервер), `client` (P2P-клиент). Унифицированный `dispatch`, `createRoom`/`joinRoom`/`hostAddBot`, debug-toggle, авто-snapshot в `localStorage['za-bortom:last-snapshot']`. |

#### `src/net/` — P2P через PeerJS

| Файл | Зачем |
|---|---|
| `protocol.ts` | Wire-протокол: `ClientMessage` (join-request, action, ready, ping, leave), `HostMessage` (state-update, action-accepted/rejected, lobby-update, и т.д.), `LobbyState`. Дискриминатор `kind:`, kebab-case. |
| `transport.ts` | Абстракция `HostTransport`/`ClientTransport`/`NetConnection`. Mockable. |
| `peerjs-transport.ts` | Production-обёртка над PeerJS (реальный WebRTC + signaling через `0.peerjs.com`). |
| `in-memory-transport.ts` | Тестовый mock: пары host↔client живут в одном процессе, передача через `queueMicrotask`. |
| `host.ts` | `HostController`. Принимает join, проверяет clientToken (reconnect), валидирует ACTION через reducer, рассылает per-viewer `state-update`, держит lobby, drives ботов в цикле после каждого state-update. |
| `client.ts` | `ClientController`. Connect+join, dispatch с ack/error через Promise, подписки на `onState`/`onLobby`/`onGameStart`/`onClose`. |

#### `src/bots/`

| Файл | Зачем |
|---|---|
| `bot.ts` | Interface `Bot { playerId, decide(view): Action \| null }`. |
| `simple-bot.ts` | `SimpleBot` — эвристики по `docs/bots.md`: морнинг-приоритеты, day self-heal/ROW/SKIP, ROW scoring карт навигации, fight-ally accept только от друга, evening water/shark_bait/life_ring. |

#### `src/ui/`

| Файл | Зачем |
|---|---|
| `App.tsx` (в `src/`) | Корневой роутинг: меню → лобби → игра, плюс DisconnectModal сверху. |
| `Lobby.tsx` | Главное меню с 3 кнопками (Hot-seat / Создать комнату / Подключиться) + три setup-экрана. |
| `WaitingRoom.tsx` | Сетевое лобби: код комнаты, список игроков с ready-метками, кнопка «Добавить бота» (host), кнопка «Старт» (host) или «Я готов» (client). |
| `Game.tsx` | Основной экран: header (день/фаза/debug/log/help/reset) + BoatView + ActionPanel + LogPane (sidebar). |
| `BoatView.tsx` | Сетка банок с персонажами: сила/бонус, friend/enemy (или «— скрыто —»), wounds, состояние сознания, маркеры 🚣⚔️, открытые/закрытые припасы (или «🂠 закрыто»). |
| `ActionPanel.tsx` | Контекстная панель действий. Внутри 9 sub-панелей по каждой подфазе (Morning/DayActions/Rowing/Proposal/RobPick/Fight/Evening/Scoring/Finished). |
| `LogPane.tsx` | Последние 100 событий из `store.events`, в обратном порядке. |
| `Help.tsx` | Модал с краткими правилами + таблица персонажей. |
| `DisconnectModal.tsx` | Полноэкранный модал при потере соединения (только client). |

### `tests/`

Зеркалит `src/`. Pure-логика — в `tests/game/`, сеть — в `tests/net/`, боты — в `tests/bots/`.

| Файл | Что покрывает |
|---|---|
| `tests/game/constants.test.ts` | Базовые константы. |
| `tests/game/prng.test.ts` | mulberry32: детерминизм, диапазоны, shuffle сохраняет элементы. |
| `tests/game/state.test.ts` | `createInitialState` для 4/5/6 игроков. |
| `tests/game/morning.test.ts` | Раздача припасов, edge-cases (1 conscious, пустая колода). |
| `tests/game/day.test.ts` | ROW (вёсла), USE_*, SHKET_STEAL, REVEAL/DISCARD/GIVE, SKIP, переход в evening. |
| `tests/game/fight.test.ts` | SWAP/ROB (accept/reject), FIGHT (allies, weapons, ties→жертва, single-use). |
| `tests/game/evening.test.ts` | Seagulls, overboard (cook/life_ring/unconscious), shark_bait, thirst (water/umbrella/unconscious save), cleanup. |
| `tests/game/scoring.test.ts` | Выживание, множители Миледи/Сноба/Капитана, friend/enemy edge cases, психопат, tiebreaker. |
| `tests/game/visibility.test.ts` | Фильтрация: rng никогда, friend/enemy скрыты, чужие closed карты подменены. |
| `tests/net/sync.test.ts` | 2 peer'а через in-memory transport: lobby → start → синхронизация state, валидные/невалидные actions. |
| `tests/bots/self-play.test.ts` | 4 бота играют до конца, детерминизм по seed, 5 разных seed'ов без deadlock. |

### `docs/` — дизайн

| Файл | Зачем |
|---|---|
| `STATUS.md` | **Текущее состояние проекта** — что сделано, что осталось. Читать первым. |
| `game-rules.md` | Формализованные правила игры. Единственный источник истины. |
| `game-spec.md` | Типы данных, контракт reducer'а, спецификация actions. |
| `network-protocol.md` | P2P-протокол host↔client. |
| `state-machine.md` | Карта фаз/подфаз. *XState* в реализации не используется — это логическая референсная карта. |
| `visibility-model.md` | Что какой игрок видит. |
| `bots.md` | Эвристики ботов. |
| `roadmap.md` | План разработки по фазам. Все фазы выполнены (с пометками); см. `STATUS.md` для актуальной картинки. |
| `decisions.md` | Резолюции 23 open questions из мерж-процесса. **Перевешивает остальные доки при расхождении.** |

## Юридический статус

Игра — Jeff Siadek (©2001), локализация — Magellan. Эта реализация — для личной игры с друзьями. Для публичного хостинга потребуется свой арт и/или договорённость с правообладателями.
