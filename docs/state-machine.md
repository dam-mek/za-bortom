> Merged from 04-state-machine.md + state-machine.md on 2026-05-15.

# State machine — карта фаз и подфаз

> **⚠️ Важно:** XState **не используется** в реализации (см. [`decisions.md`](./decisions.md) #23). Phase живёт в `GameState` как discriminated union, переходы — в чистом reducer'е (`src/game/reducer.ts` + `src/game/rules/*.ts`). Этот документ — **логическая карта** фаз и подфаз, источник истины для дизайна переходов; конкретная реализация может отличаться по именам полей и структуре subPhase. Если что-то расходится с кодом — побеждает код.

Этот документ описывает иерархическую state machine игры. ~~Реализуется через **XState** в `src/game/machine.ts`.~~ Документ описывает, в какой фазе игра, какие подфазы возможны, и какие переходы валидны.

## 1. Reducer vs Machine — почему две вещи

**Reducer и machine — не одно и то же.** Reducer применяет `Action` к state. Machine описывает, **какие Actions валидны в каждой фазе** и **как фазы переключаются автоматически** (когда последний игрок завершил действие, переходим в следующую фазу).

Аргументы за XState:

- Reducer должен оставаться чистой функцией над `GameState`. Если фаза «зашита» внутри state как enum-поле — управление переходами размазывается по 30 файлам.
- XState даёт визуализатор, статическую проверку переходов и явные гварды.
- На практике: FSM работает с `event` (= `Action`), reducer тоже с `action`. Можем синхронизировать их через context = ссылку на `GameState`, либо держать оба независимо и считать FSM ground truth для фазы.

**Решение:** FSM держит `context: GameState`. На каждый event:

1. Reducer вызывается с `(state, action)`. Если ошибка — event отвергается.
2. Если ОК — context обновляется.
3. FSM переходит в новое состояние согласно reducer'у (он мог поменять `state.phase`).

То есть FSM-переходы напрямую читают `state.phase.kind` после reducer'а.

**Альтернатива (без XState):** моделировать всё внутри reducer. Это работает, но при 5+ подфазах внутри одного дня — сложнее читать. XState окупится.

## 2. Верхнеуровневая машина

```
lobby
  └── on LOBBY_START_GAME → setup

setup
  └── (instant: deal cards, set seats) → morning

morning
  ├── if supplyDeck.empty → day
  └── supply distribution loop → day

day
  └── all conscious players acted → evening

evening
  ├── nav card resolution
  ├── if seagulls === 4 → scoring
  └── else → morning (new day, turnNumber++)

scoring
  └── compute → finished

finished
  └── terminal
```

Графически:

```
┌─────────┐
│  setup  │── START_GAME ──┐
└─────────┘                │
                           ▼
                    ┌──────────┐
                    │  morning │
                    │ (distrib)│◄────┐
                    └──────────┘     │ END_DAY (last evening step done)
                         │           │
                  все взяли припас   │
                         │           │
                         ▼           │
                    ┌──────────┐     │
                    │   day    │     │
                    └──────────┘     │
                         │           │
                  все игроки         │
                  сделали ход        │
                         │           │
                         ▼           │
                    ┌──────────┐     │
                    │ evening  │─────┘
                    └──────────┘
                         │
                  4 чайки на корме ИЛИ
                  все мертвы
                         │
                         ▼
                    ┌──────────┐
                    │ finished │
                    └──────────┘
```

## 3. Morning sub-machine

```
morning
└── distributingSupplies
    │  context: { pile: CardId[], passingTo: PlayerId }
    │  initial: deal N cards to first conscious player (closest to bow)
    │  on:
    │    MORNING_CHOOSE_SUPPLY / CHOOSE_SUPPLY by passingTo:
    │      guard: pile.includes(cardId), passingTo === playerId
    │      action: assign chosen card to player's closedSupplies, pass remaining to next conscious player
    │      transitions:
    │        - if remaining === 1 → last player gets it automatically → exit → day.waitingForAction
    │        - else → stay (next player)
```

**Edge cases:**

- Если колода припасов пуста на старте утра → сразу переход в `day.waitingForAction`.
- Если только один игрок в сознании — он получает все карты? **Нет** — он берёт N (= число в сознании = 1) карту, и всё. Распределение пропускается, переход к дню.
- 0 игроков в сознании → пропустить morning, перейти к дню (где тоже никто не действует), перейти к вечеру.

## 4. Day sub-machine

```
day
└── waitingForAction (по currentTurnPlayer = next conscious in turnOrderSnapshot)
    ├── BEGIN_ROW         → day.rowing
    ├── OFFER_SWAP        → day.awaitingSwapResponse
    ├── OFFER_ROB         → day.awaitingRobResponse
    ├── SHKET_STEAL       → day.shketStealing       (только Шкет, моментальная)
    ├── USE_FIRST_AID     → day.applyingItem        (моментальная)
    ├── USE_UMBRELLA      → day.applyingItem
    ├── USE_FLARE         → day.applyingFlare
    └── SKIP_TURN         → advance_turn

Each subphase ends → advance_turn:
  ├── if last conscious player acted → exit day → evening
  └── else → waitingForAction (next)
```

### 4.1 Row subphase

```
day.rowing
├── initial:
│   - check if player has oar → optional DAY_ROW_DECLARE_OAR
│   - draw N cards (2 + count(open oars))
├── wait_for_keep_choice
│   on KEEP_ROW_CARDS [cardIds]:
│     - put kept cards face-down in rowerCards (navPool)
│     - put rejected cards at bottom of navDeck
│     - place fatigue token rower-side up (если жетона ещё не было)
└── exit → day.advance_turn
```

### 4.2 Swap / Rob subphase

```
day.awaitingSwapResponse / day.awaitingRobResponse
├── check target status:
│   ├── unconscious or dead → auto-accept, instant swap/rob → exit → advance_turn
│   └── conscious → wait_for_response
├── wait_for_response (target player decides)
│   ├── RESPOND_SWAP/ROB(accept) → PROPOSAL_ACCEPT → execute → exit
│   └── RESPOND_SWAP/ROB(refuse) → PROPOSAL_REJECT → day.fight
└── exit → day.advance_turn

Rob execution sub-detail (после accept):
  ├── target.openSupplies > 0 → ROB_REVEAL_OPEN_PICK (attacker picks one)
  ├── target.openSupplies === 0 && closedSupplies > 0 →
  │   ├── ROB_VICTIM_SHUFFLE_DONE →
  │   └── ROB_CLOSED_RANDOM_DRAW (atomic on host using rng)
  └── no supplies → exit без эффекта (или запретить выбор цели на этапе choose_action)
```

### 4.3 Shket steal subphase

```
day.shketStealing
├── guard: target has closedSupplies; иначе reject action
├── target shuffles closedSupplies (host shuffles atomically)
├── wait_for_target_shuffle_done (UI animation, или auto на host)
├── Шкет draws one random closed supply → moves to his closedSupplies
├── shketStealUsedThisTurn = true
└── exit → day.advance_turn
```

**Замечание:** воровство **не открывает** закрытую — карта переходит к Шкету в закрытую.

### 4.4 Fight subphase

```
day.fight
├── initial:
│   - both sides reveal currently open weapons (auto-detected from openSupplies)
│   - allow each side to add (REVEAL_SUPPLY → adds to side)
├── recruitingAllies
│   context: { attackerSide: PlayerId[], victimSide: PlayerId[], pending: PlayerId[] }
│   on:
│     REQUEST_ALLY / FIGHT_RECRUIT_ALLY → add to pending (если ещё не отвечал); stay
│     RESPOND_ALLY / FIGHT_ALLY_(ACCEPT|DECLINE) → add to side or skip; remove from pending; stay
│     CLOSE_ALLY_RECRUITMENT (by attacker) → fight.revealingWeapons
├── revealingWeapons
│   context: { attackerWeapons: CardId[], victimWeapons: CardId[], declared: Set<PlayerId> }
│   on:
│     DECLARE_WEAPONS / FIGHT_ADD_WEAPON → store; mark declared
│     когда все участники declared → fight.resolving
├── resolving (auto)
│   - compute totalAttackerStrength = Σ(character.strength + weapons.strengthBonus) for attacker + allies
│   - same for defender
│   - if attacker > defender: attacker wins; else: defender wins (ties → defender)
│   auto → applyingConsequences
└── applyingConsequences (auto)
    - all participants: fatigueFighting = true (если жетона ещё не было)
    - losing side: wounds += 1, check consciousness/death
    - winner-attacker: получает goal (swap seats / take supply)
    - winner-defender: остаётся на месте / сохраняет припасы
    - if flare gun использовался как оружие → discard
    exit → day.advance_turn
```

**Замечания по drake:**

- `REQUEST_ALLY` от атакующего/жертвы перемещает PlayerId в `pending`. Ответ через `RESPOND_ALLY`.
- PDF: «Атакующий зовёт союзников, потом жертва.» — но в реальности проще дать обоим параллельный режим (это игра, переговоры идут устно). **Реализуем:** оба могут звать в любом порядке, окончание объявляет атакующий через `CLOSE_ALLY_RECRUITMENT`.
- Союзничество **не** считается действием — НЕ продвигаем `dayActionsTaken` для союзника.
- После окончания драки атакующий помечается как `dayActionsTaken[attacker] = true` (он использовал своё действие на инициирование).
- **Во время драки нельзя обмениваться припасами** (кроме объявления оружия). Reducer должен **блокировать** `GIVE_SUPPLY`/`DISCARD_SUPPLY` и т.д., пока `phase.subPhase.kind === 'fight'`.
- **Открытие припаса в драке:** разрешено только для оружия (добавление к стороне), и **только до закрытия вербовки**.

### 4.5 Use supply subphases (моментальные)

```
day.applyingItem  // first_aid / umbrella
├── first_aid:
│   on DAY_FIRST_AID_TARGET / USE_FIRST_AID:
│     - remove 1 wound from target
│     - if target was unconscious and now wounds < strength → restore consciousness
│     - discard supply card (singleUse)
│   → exit → advance_turn
└── umbrella:
    on DAY_UMBRELLA_TARGET / USE_UMBRELLA:
      - move umbrella to target's openSupplies
      → exit → advance_turn

day.applyingFlare  // flare gun
├── draw top 3 nav cards
├── apply seagull effects only (other content ignored)
├── if seagullTokens === 4 → game ends → scoring
├── put 3 cards at bottom of navDeck
├── discard flare gun
└── exit → advance_turn (or → scoring если игра кончилась)
```

## 5. Evening sub-machine

```
evening
├── sternPicking
│   context: { pickerId: PlayerId (closest-to-stern conscious), pool: CardId[] }
│   - if rowerCards (navPool) непуст: pool = navPool (shuffled view for picker only)
│   - else: pool = [top of navDeck]                              (принудительно)
│   - if picker has open compass AND in consciousness:
│       on EVENING_USE_COMPASS → pool += 1 верх колоды (если pool НЕ был пуст);
│                                 pool = [2 верха колоды] (если был пуст)
│   on EVENING_SELECT_NAV_CARD / STERN_PICK:
│     - установить currentNavCard, остальные карты pool — под низ колоды
│     → evening.resolvingCard (step: 'seagulls')
│
└── resolvingCard
    ├── step: 'seagulls' (auto)
    │   - if card.seagulls === 1 (or 'normal'): seagullTokens++
    │   - if === -1 (or 'crossed'):              seagullTokens = max(0, seagullTokens - 1)
    │   - if seagullTokens >= 4 → → finished (skip rest of card)
    │   - else → step 'overboard'
    │
    ├── step: 'overboard'
    │   определяет, кто падает (учитывая lifeRing — реактивно)
    │   ОТКРЫВАЕТ окно для USE_LIFE_RING_REACTIVE до автоматического применения:
    │     timeout/explicit CLOSE → применить падения
    │     - если у игрока ОТКРЫТ life_ring → НЕ падает (остаётся в лодке)
    │     - если ЗАКРЫТ life_ring → ASK USE_LIFE_RING_REACTIVE → yes: reveal, no effect; no: falls
    │     - Cherpak: не получает рану, но теряет открытые
    │     - Остальные при падении (conscious): +1 рана, потеря всех open (кроме lifeRing)
    │     - unconscious / dead без lifeRing → DEAD (remove from game, slide seats)
    │     - sharkBait в открытых упавших → авто-срабатывает (см. ниже)
    │   → step 'sharkBaitOptional'
    │
    ├── step: 'sharkBaitOptional'
    │   если есть кто-то за бортом AND any player has open sharkBait:
    │     for each such holder: окно USE_SHARK_BAIT / SKIP
    │     - "use": +1 рана всем за бортом (cook тоже); sharkBait → discard
    │     - только ОДНА приманка срабатывает (не суммируются)
    │     - если у того, кто упал, была sharkBait в открытых → она автоматически срабатывает
    │   on ADVANCE_NAV_STEP → step 'thirst'
    │
    ├── step: 'thirst'
    │   compute thirstyChars from card:
    │     - thirst.named: explicit list
    │     - thirst.rowers: все, кто грёб (носит fatigue 'rower')
    │     - thirst.fighters: все, кто дрался (носит fatigue 'fighter')
    │     - комбинации суммируются
    │   for each affected (по убыванию приоритета умных решений):
    │     - if has open umbrella → защищает (см. open question ниже)
    │     - окно: USE_WATER_FOR_THIRST или принять рану
    │     - each water card cancels 1 wound (singleUse, → discard)
    │     - unconscious can't use own water, но другой в сознании может «напоить» (action)
    │     - apply wounds → check death (unconscious + 1 рана = death)
    │   когда все пострадавшие либо использовали воду либо нет (timeout / no-water) → step 'cleanup'
    │
    └── step: 'cleanup'
        - remove all fatigue tokens from all players
        - currentNavCard → под низ колоды
        - if seagullTokens === 4 → scoring
        - else → morning (turnNumber++)
```

> **Open question: насколько защищает зонтик от жажды.**
> В правилах сказано «Зонтик защищает от ранения за жажду», но не уточняется, защищает ли он от **всех** ранений за жажду в раунде или только от одного.
> Предложение для MVP: зонтик защищает от **всех** ранений за жажду в данном раунде (= при текущей карте навигации). Даёт зонтику более понятную ценность. Подтвердить.

**Важно про порядок «жажда»:** За один вечер игрок может получить несколько ранений за жажду (имя в карте + грёб = 2 ранения). Одна `water` = −1 ранение.

## 6. Reactive actions (вне фаз)

Эти actions могут происходить «между» фазами/подфазами или внутри них:

- `REVEAL_SUPPLY` / `OPEN_SUPPLY` — почти всегда разрешено (кроме момента «закрытия recruitment» в драке).
- `DISCARD_SUPPLY` — разрешено вне драки.
- `GIVE_SUPPLY` / `TRADE_GIVE` — разрешено вне драки.
- `USE_LIFE_RING_REACTIVE` — только в подфазе `evening.resolvingCard step 'overboard'`, синхронно с обработкой конкретного персонажа.

Reducer проверяет в каждом case, разрешено ли это сейчас, исходя из `state.phase`.

## 7. Auto-transitions (PHASE_ADVANCE)

Host диспатчит `PHASE_ADVANCE` (или специализированные `ADVANCE_NAV_STEP` / `END_DAY` / `RESOLVE_FIGHT`) после завершения подфазы. Это **внутренний action** — клиенты его не отправляют. Делает явные шаги:

- После последнего `MORNING_CHOOSE_SUPPLY` → переход в day.
- После последнего conscious player action в day → переход в evening.
- После `end_of_day` → проверка чаек → либо scoring, либо morning.

## 8. Сохранение порядка ходов внутри дня

`turnOrderSnapshot: SeatIndex[]` (или `turnOrder: PlayerId[]`) фиксируется в начале дня. Содержит порядок банок с conscious персонажами от носа к корме. Свопы мест **не меняют** этот массив до конца дня. Со следующей фазы morning — пересчитывается.

## 9. Что делать если все мёртвые / без сознания

- В **morning**: пропустить (нет в сознании = нечего раздавать).
- В **day**: пропустить (никто не действует).
- В **evening**:
  - Если никто в сознании не может выбрать карту → раскрыть верхнюю автоматически.
  - Эффекты применяются (мёртвых и без сознания добавляет ранения тоже — спорно, но согласно правилам да).
  - Если в результате никто не жив → **game over, sea wins, no scoring**.

## 10. Inactivity / disconnect timeouts

Каждая фаза, ожидающая ввод конкретного игрока, может иметь soft timeout (например, 60 секунд):

- soft timeout: spectator-уведомление «игрок не отвечает».
- hard timeout (5 мин): автоматическое action по умолчанию.
  - `waitingForAction` → `SKIP_TURN`.
  - `awaitingSwapResponse` → REFUSE (auto fight — не лучший дефолт, но безопасный).

> **Open question: дефолт при таймауте на swap/rob response.**
> Вариант 1: auto REFUSE → автоматическая драка, которую игрок не контролирует.
> Вариант 2: auto ACCEPT → проигрыш по дефолту, но без неконтролируемой драки.
> Вариант 2 для MVP выглядит дружелюбнее.

**На MVP — без timeout'ов**; полагаемся на наличие host'а и реальное присутствие игроков.

## 11. Чек-лист реализации `machine.ts`

- [ ] Lobby с join/leave/start.
- [ ] Setup: deal roles/friends/enemies/supplies, set seats.
- [ ] Morning loop с правильным порядком и пропусками без сознания.
- [ ] Day choose_action для каждой роли (для Шкета добавляется choice «украсть»).
- [ ] Row subphase с поддержкой весла.
- [ ] Swap proposal → accept/reject → fight.
- [ ] Rob proposal → accept/reject → fight → разные пути для open/closed.
- [ ] Shket steal subphase.
- [ ] Fight subphase с вербовкой союзников.
- [ ] Use supply subphases (`first_aid`, `umbrella`, `flare_gun`).
- [ ] Reactive actions в нужных фазах.
- [ ] Evening: select_card → reveal → seagulls → overboard (с life_ring и cook) → shark_bait → thirst (с water и umbrella).
- [ ] End of day: cleanup + переход.
- [ ] Scoring: compute breakdown for each player.
- [ ] Finished: terminal state.

## 12. Тестирование machine

В `src/fsm/__tests__/` / `tests/game/`:

- **Happy path:** setup → morning → day → evening → morning ... → finished (4 чайки).
- **Fight ветка:** OFFER_SWAP → REFUSE → fight → resolve.
- **Shket ветка:** SHKET_STEAL не открывает закрытые карты цели.
- **Evening: lifeRing** предотвращает падение.
- **Evening: sharkBait** добавляет раны.
- **Evening: 4 чайки** → finished.
- **End: все мертвы** → finished без подсчёта.
- **Compass:** даёт +1 карту, работает только у player ближайшего к корме И с открытым compass И в сознании.
- **Multi-fight в день:** жетон усталости не дублируется.
- **Edge cases** из правил (без сознания, никто в сознании, отсутствующие персонажи).
- **Невалидные actions** в этой фазе (`PROPOSAL_ACCEPT` в morning → reject).
- **Реактивные actions** (можно ли открыть карту? отдать карту?).
- **Happy path подфаз** + edge cases из правил.
