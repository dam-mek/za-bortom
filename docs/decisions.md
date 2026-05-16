# Решения по open questions

Резолюции 22 вопросов, оставленных при мерже спецификаций (2026-05-15). Этот документ **перевешивает** все `**Open question:**` блоки в остальных файлах `docs/` — если расхождение, побеждает этот файл.

## Нейминг и стиль

| # | Вопрос | Решение |
|---|---|---|
| 1 | ID персонажей в коде | **camelCase транслит**: `bocman`, `shket`, `snob`, `kapitan`, `miledi`, `cherpak` |
| 2 | Имена типов припасов | **snake_case**: `water`, `first_aid`, `umbrella`, `flare`, `compass`, `life_ring`, `oar`, `shark_bait`, `club`, `hook`, `knife`, `money`, `jewelry`, `painting` |
| 3 | Дискриминатор в union'ах | **`kind:`** везде (Action, NavCard.thirst, GameError, …) |
| 4 | Стороны жетона усталости (`FatigueSide`) | **`'rower' \| 'fighter'`** (существительные) |
| 12 | Имена Action'ов | **Без префикса фазы**: `ROW`, `OFFER_SWAP`, `ACCEPT_SWAP`, `DECLARE_FIGHT`. Фаза валидируется FSM. |
| 13 | Сообщения в сетевом протоколе | **kebab-case**: `{ kind: 'state-update', … }`, `{ kind: 'action', … }`. (Внутри `action.payload` сами actions всё ещё SCREAMING_SNAKE через `kind`.) |

## Структура типов данных

| # | Вопрос | Решение |
|---|---|---|
| 5 | Эффект чаек на карте навигации | **`'none' \| 'normal' \| 'crossed'`** (строковый enum) |
| 6 | Триггер жажды | **Композиция**: `{ rowers: boolean; fighters: boolean; named: CharacterId[] }`. Никаких `rowers+named`-вариантов. |
| 7 | Хранение «греб/дрался сегодня» у игрока | **Два булевых поля**: `rowed: boolean; fought: boolean`. (Они же используются для thirst-триггеров `rowers`/`fighters`.) `FatigueSide` остаётся типом для иконок на картах навигации и в логах. |
| 8 | Маппинг персонаж → игрок → банка | **Через `seats`**: `Seat.occupantId: PlayerId \| null`, `Player.character: CharacterId`. Lookups `characterToPlayer` строятся ad-hoc функциями, не хранятся. |
| 14 | Адресация цели в swap/rob | **`targetSeat: SeatIndex`** (индекс банки). Banki — то, что игрок видит и кликает. |

## Reducer / PRNG

| # | Вопрос | Решение |
|---|---|---|
| 9 | Reducer return type | **`{ ok: true; state; events } \| { ok: false; error }`** |
| 10 | API PRNG | **Состояние внутри `GameState`** — `state.rng: RngState`. Reducer чистый, выдаёт новый state с обновлённым rng. |
| 11 | Seed format | **`number` + mulberry32**. Своя короткая реализация в `src/game/prng.ts`, без `seedrandom` (не нужна dep). |

> **TODO для package.json:** убрать `seedrandom` и `@types/seedrandom` из dependencies — мы их не используем. (Сделать при следующем `npm install`.)

## Сетевые правила

| # | Вопрос | Решение |
|---|---|---|
| 15 | Дефолт при таймауте ответа на swap/rob | **Auto-ACCEPT**. Если жертва не ответила за `RESPONSE_TIMEOUT_MS` (TODO: настроить ~30s) — считается согласием. Безопаснее для отвалившегося игрока. |

## Игровые правила (неясности в PDF)

| # | Вопрос | Решение |
|---|---|---|
| 16 | Зонтик: от скольких ранений за жажду защищает | **От одного.** Каждый источник жажды в раунде рассматривается отдельно; открытый зонтик снимает 1 рану в раунде. |
| 17 | Колода припасов < N утром | **Раздают сколько есть** по цепочке от носа. Последние игроки не получают. |
| 18 | Колода навигации опустела | **Рециклинг**: разыгранные карты перемешиваются и возвращаются в колоду. Игра завершается только по 4 чайкам или вымиранию. |
| 19 | Отказ от ROW после просмотра карт | **Можно вернуть всё под низ колоды**. Жетон усталости (`rower`) всё равно выдаётся — действие потрачено. |
| 20 | Судьба припасов мёртвого игрока | **Остаются на банке**. Другие могут грабить тело через ROB. Они входят в подсчёт очков мёртвого (которые он сам не получит). |
| 21 | weaponStrength оружия | **Плейсхолдеры с TODO**, исправить при сверке физической колоды: `club: 2`, `knife: 3`, `hook: 4`, `oar: 1`, `flare: 10` (одноразовое). |
| 22 | Tiebreaker при равенстве очков | **Жив > мёртв.** При равенстве в этой подкатегории — совместная победа. |

## 23. Фаза 6 (XState) — пропущена

**Решение от 2026-05-15:** Фаза 6 roadmap'а (формальная XState-машина) пропущена. Phase живёт внутри `GameState` как discriminated union, переходы делает reducer. Эта архитектура работает, покрыта 142 тестами, и архитектурно эквивалентна XState без runtime-зависимости.

Что потеряли:
- Визуализатор Stately (могли бы смотреть граф фаз в браузере)
- Catch unreachable states на статике

Что сохранили:
- Type-safe events через discriminated unions
- Predictable state через pure reducer
- Меньше кода и зависимостей

Это перевешивает рекомендацию CLAUDE.md §«XState владеет phase» — обновить CLAUDE.md, чтобы убрать XState из стека и заменить «Одна машина фаз» на «Фаза — поле `GameState.phase`, переходы в reducer'е».

## Что обновить дальше

- [ ] `src/game/constants.ts` — привести `CharacterId` к camelCase, `SupplyType` к snake_case, заполнить weaponStrength плейсхолдерами.
- [ ] `package.json` — убрать `seedrandom`/`@types/seedrandom`.
- [ ] `docs/game-rules.md`, `docs/game-spec.md`, `docs/network-protocol.md`, `docs/state-machine.md`, `docs/visibility-model.md` — пройтись по `**Open question:**` блокам и заменить на ссылку «см. [`decisions.md`](./decisions.md)». **Не обязательно делать сразу** — `decisions.md` уже авторитетен.
- [ ] CLAUDE.md — синхронизировать секцию «Конвенции кода» с новым неймингом.
