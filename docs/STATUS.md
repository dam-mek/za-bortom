# Состояние проекта

> Дата: 2026-05-16. Сверять при каждом значимом изменении.

## Кратко

**Играбельный MVP**: 4-6 игроков, локальный hot-seat ИЛИ P2P через WebRTC, с возможностью наполнения ботами. Все 10 фаз roadmap выполнены (Фаза 6 — XState — осознанно пропущена в пользу discriminated-unions). 161 unit/integration тест.

## Что готово

### Игровая логика (`src/game/`)

- ✅ Типы `GameState`, `Phase` + все подфазы, `Player`, `Seat`, `SupplyCard`, `NavigationCard`, `FilteredGameState`.
- ✅ Action union (40+ action'ов) с дискриминатором `kind:`.
- ✅ Reducer — pure, exhaustive, возвращает `{ ok: true, state, events } | { ok: false, error }`.
- ✅ PRNG — mulberry32, функциональный API (`RngState` иммутабелен).
- ✅ `createInitialState` для 4/5/6 игроков (раздача ролей/друзей/врагов, по 1 закрытой карте, банки).
- ✅ Все правила: morning · day (ROW/SWAP/ROB/USE_*/SHKET_STEAL/SKIP/реактивные) · fight (recruiting/weapons/resolve с ties→жертва, single-use weapon discard) · evening (compass/select/seagulls/overboard с life_ring/shark_bait/thirst/water/umbrella) · cleanup → next morning.
- ✅ Scoring — выживание × нарцисс/психопат, множители Миледи/Сноба/Капитана, friend/enemy edge case, психопат-бонус, tiebreaker alive>dead.
- ✅ Visibility filter — `filterStateForPlayer(state, viewerId)`: rng никогда, friend/enemy nulled, чужие closed карты подменены placeholder-id, колоды length-only.
- ✅ Invariants — 10 проверок, гоняются в тестах.

### Сеть (`src/net/`)

- ✅ Transport-абстракция + in-memory mock для тестов + production-обёртка над PeerJS.
- ✅ Wire-протокол ClientMessage/HostMessage (kebab-case `kind:`).
- ✅ HostController — join flow с clientToken (reconnect), валидация actions, per-viewer state-update, lobby management.
- ✅ ClientController — async dispatch с ack/error, подписки на state/lobby/game-start/close.
- ✅ Host видит фильтрованный state (как любой клиент), полный — только в reducer'е. Debug-режим для разработчика.

### Боты (`src/bots/`)

- ✅ Bot interface + SimpleBot с эвристиками по `bots.md`.
- ✅ Host автоматически прокручивает ботов в цикле после каждого state-update; fallback на SKIP_TURN.
- ✅ Self-play 4 ботов работает детерминистично, партия завершается <50 дней на любом seed.

### UI (`src/ui/`)

- ✅ Lobby с 3 режимами (Hot-seat / Создать комнату / Подключиться по коду).
- ✅ WaitingRoom — список игроков, ready-метки, кнопка «Добавить бота».
- ✅ Game — BoatView (сетка банок) + ActionPanel (9 контекстных подпанелей) + LogPane.
- ✅ Help-модал с краткими правилами.
- ✅ DisconnectModal при потере соединения.
- ✅ Debug-toggle для host'а, экспорт лога (state+events) в JSON, autosnapshot в localStorage.

### Инфраструктура

- ✅ Vite 6 dev server + Cloudflare Workers production (`wrangler.jsonc`).
- ✅ ESLint flat config с архитектурными правилами (запрет React в `src/game/`).
- ✅ Prettier (no-semi, single quotes).
- ✅ TypeScript strict + `noUncheckedIndexedAccess`.

### Тесты (161 шт, 11 файлов)

- `prng` · 8 тестов
- `constants` · 3
- `state` · 27 (создание для 4/5/6 игроков, инварианты)
- `morning` · 12
- `day` · 24
- `fight` · 24 (swap/rob/fight со всеми примерами из правил)
- `evening` · 25 (seagulls/overboard/shark_bait/thirst со всеми edge cases)
- `scoring` · 19
- `visibility` · 13
- `net/sync` · 3 (2-4 peer'а через in-memory mock)
- `bots/self-play` · 3 (полная партия, детерминизм, 5 seed'ов)

`npm run typecheck && npm run test:run && npm run lint` — зелёные.

## Что осознанно пропущено

| Феча | Почему |
|---|---|
| **XState (Фаза 6)** | Phase живёт в `GameState` как discriminated union, переходы — в reducer'е. Архитектурно эквивалентно XState, меньше зависимостей. См. [`decisions.md`](./decisions.md) #23. |
| **Анимации (Фаза 10)** | Косметика, не блокирует игру. Framer Motion можно добавить отдельно. |
| **Звуки (Фаза 10)** | То же. |
| **Host migration** | Если хост падает — игра завершается с DisconnectModal. Реализовать host migration сложно и не критично для friends-game. |
| **Hot-seat visibility** | В hot-seat все за одним экраном — фильтрация бесполезна. Применяется только в P2P. |

## TODO / нерешённое

### Игровое содержимое

- 🟡 **Точные значения weaponStrength и valuePoints** — сейчас плейсхолдеры `club=2, knife=3, hook=4, flare=10, money=1, jewelry=3, painting=2`. Нужно сверить с физической колодой (decision #21). Меняется одной правкой в `src/game/constants.ts`.
- 🟡 **Точный состав 24 карт навигации** — сейчас генерятся плейсхолдерами в `src/game/state.ts:buildNavigationCards`. Логика разыгрывания работает с любым составом; реальная колода даст балансное распределение чаек/overboard/thirst.
- 🟡 **Точное количество карт каждого типа в supply-колоде** — сейчас условное распределение в `SUPPLY_DECK_COMPOSITION` (`src/game/state.ts`), сумма ровно 42. Уточнить с физической колодой.

### Технические доработки

- 🟡 **Reconnect UX** — серверная логика есть (`clientToken` слот в host'е), но клиент не пытается переподключиться автоматически. На MVP: при обрыве показывается DisconnectModal. Улучшение: client sees «X отключился, ждём 30s», потом game-over.
- 🟡 **Симметричный NAT** — у некоторых сетей (особенно мобильных) WebRTC не пробивается без TURN-сервера (платный). На MVP: пусть друзья на домашнем Wi-Fi.
- 🟡 **Боты тупые** — играют валидно, не выигрывают людей. Можно усложнить логику в `simple-bot.ts` или добавить более сильного бота-наследника.

### Косметика

- 🔵 **Анимации** — переходы фаз, swap банок, drag карт. Framer Motion.
- 🔵 **Звуки** — уведомление о своём ходе, чайки/шум воды на overboard.
- 🔵 **Mobile UI** — сейчас desktop-first.
- 🔵 **Спектатор-режим** — мёртвые видят всё.

## Где смотреть когда нужно

| Хочешь… | Открой |
|---|---|
| Прочитать правила игры | [`game-rules.md`](./game-rules.md) |
| Понять что такое какой action | [`game-spec.md`](./game-spec.md) §8 + `src/game/actions.ts` |
| Понять переходы фаз | [`state-machine.md`](./state-machine.md) (логическая карта) или код в `src/game/rules/` |
| Понять, что какой игрок видит | [`visibility-model.md`](./visibility-model.md) + `src/game/visibility.ts` |
| Узнать какое решение по неоднозначностям | [`decisions.md`](./decisions.md) |
| Понять сеть | [`network-protocol.md`](./network-protocol.md) + `src/net/*.ts` |
| Понять структуру файлов | [`README.md`](../README.md) |
| Понять что готово | этот файл |
