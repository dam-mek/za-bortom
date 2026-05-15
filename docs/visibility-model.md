# Visibility model

Самый важный документ для целостности игры. **Каждое поле `GameState` должно явно определять, кто его видит.** Если упустить — игроки увидят чужие карты в DevTools.

## Принцип

Host хранит **полный** `GameState`. Каждому клиенту шлёт `PlayerView = redact(state, viewerId)` — отфильтрованную копию.

Клиент **никогда** не должен получать поле, которое не должен видеть. Скрывание на стороне UI — недостаточно (DevTools, network tab).

## Категории информации

### Полностью публичные (видят все)

- `seed` — да, его знают все (нужен для тестов и repro)
- `day`, `phase` (без приватного content внутри pendingAction), `turnOrder`, `currentTurnIndex`, `dayActionsTaken`
- `seats[]` — позиции игроков в лодке
- Для каждого `Player`: `id`, `displayName`, `isBot`, `seatIndex`, `role` (вся карта роли), `wounds`, `fatigue`, `consciousness`, `hasUsedShketSteal`, `disconnected`
- `openSupplies` каждого игрока (всё содержимое — это публичная информация)
- Количество `closedSupplies` каждого игрока (но не содержимое — см. ниже)
- `seagullsOnStern`, `availableWoundTokens`, `availableFatigueTokens`
- `supplyDeck.length`, `navDeck.length` — счётчики, не содержимое
- `currentNavCard` — публичная, когда раскрыта (`null` до раскрытия)
- `winner`, `finalScores` (только когда `phase === finished`)

### Приватные для владельца

- `Player.closedSupplies[]` — содержимое видно ТОЛЬКО владельцу.
  - Все остальные видят только `{ count: number }`.
- `Player.bestFriend` — видно ТОЛЬКО владельцу до `phase === finished`.
- `Player.worstEnemy` — видно ТОЛЬКО владельцу до `phase === finished`.

### Приватные временно (по фазам)

- `Morning.distributingSupplies.pile` — содержимое видно ТОЛЬКО текущему игроку, к которому пришла стопка. Остальные видят `{ count: number, passingTo: PlayerId }`.
- `Day.rowing.drawn` — карты, которые гребец смотрит — видны ТОЛЬКО гребцу.
- `navPool` — карты, оставленные гребцами — НИКТО не видит содержимое (даже хост в логах — храним под immutable id, но не раскрываем) ДО:
  - Кормовой игрок (sternPicker) перемешивает (`shuffle` детерминистский через RNG) и смотрит. Все смотрят `{ count }`.
- `Evening.sternPicking.pool` — видно ТОЛЬКО sternPicker'у.
- `Day.fight.recruitingAllies` — приватные обещания/сделки идут вне игры. В state мы храним только публичные действия (REQUEST_ALLY, RESPOND_ALLY).

### Скрытые ВСЕГДА от не-host'ов

- `rngState` — клиенты не должны иметь возможности предсказывать колоды
- Любые предзагруженные перетасованные колоды на host'е
- Внутренние счётчики

## Redact функция

```ts
// game/visibility.ts
function redact(state: GameState, viewer: PlayerId): PlayerView {
  return {
    ...state,
    rngState: REDACTED,                     // не отправлять никогда
    supplyDeck: { count: state.supplyDeck.length },  // структурный замен
    navDeck: { count: state.navDeck.length },
    navBottom: { count: state.navBottom.length },
    navPool: redactNavPool(state, viewer),
    currentNavCard: state.currentNavCard,    // публично если установлено

    players: mapValues(state.players, (p, pid) => redactPlayer(p, viewer === pid)),

    phase: redactPhase(state.phase, viewer),

    // остальные поля копируем как есть
  };
}

function redactPlayer(p: Player, isSelf: boolean): PlayerView['players'][string] {
  return {
    ...p,
    closedSupplies: isSelf
      ? p.closedSupplies
      : { count: p.closedSupplies.length },
    bestFriend: isSelf ? p.bestFriend : REDACTED,
    worstEnemy: isSelf ? p.worstEnemy : REDACTED,
  };
}

function redactPhase(phase: Phase, viewer: PlayerId): Phase {
  if (phase.kind === 'morning' && phase.subPhase.kind === 'distributingSupplies') {
    return {
      ...phase,
      subPhase: {
        ...phase.subPhase,
        pile: phase.subPhase.passingTo === viewer
          ? phase.subPhase.pile
          : { count: phase.subPhase.pile.length },
      },
    };
  }
  if (phase.kind === 'day' && phase.subPhase.kind === 'rowing') {
    return {
      ...phase,
      subPhase: {
        ...phase.subPhase,
        drawn: phase.subPhase.player === viewer
          ? phase.subPhase.drawn
          : { count: phase.subPhase.drawn.length },
      },
    };
  }
  if (phase.kind === 'evening' && phase.subPhase.kind === 'sternPicking') {
    return {
      ...phase,
      subPhase: {
        ...phase.subPhase,
        pool: phase.subPhase.pickerId === viewer
          ? phase.subPhase.pool
          : { count: phase.subPhase.pool.length },
      },
    };
  }
  return phase;
}
```

## Тип PlayerView

В TS — параметризуем:

```ts
type Hidden<T> = { kind: 'hidden'; count: number };
type Maybe<T> = T | Hidden<T>;

interface PlayerView extends Omit<GameState, 'rngState' | 'supplyDeck' | 'navDeck' | 'players'> {
  readonly rngState: 'REDACTED';
  readonly supplyDeck: { count: number };
  readonly navDeck: { count: number };
  readonly players: Record<PlayerId, PlayerViewSelf | PlayerViewOther>;
}

interface PlayerViewSelf extends Player {
  // полная видимость
}

interface PlayerViewOther extends Omit<Player, 'closedSupplies' | 'bestFriend' | 'worstEnemy'> {
  readonly closedSupplies: { count: number };
  readonly bestFriend: 'REDACTED';
  readonly worstEnemy: 'REDACTED';
}
```

UI работает только с `PlayerView`. Никакие компоненты не должны принимать полный `GameState`.

## Тесты

В `src/game/__tests__/visibility.test.ts`:

- Для каждого приватного поля: `redact(state, 'p1').xxx` не содержит данных, доступных только `p2`.
- Property-test: для случайного state и случайного viewer — сериализованный PlayerView не содержит ни одной строки из закрытых данных других игроков (можно проверять через JSON.stringify + поиск sub-string id).
- Snapshot-тест: PlayerView для типового состояния — фиксированный вид.

## Что НЕ покрывает redact

- **Шкет крадёт карту**: в момент SHKET_STEAL, выбранная случайно карта становится открытой у Шкета (или закрытой? PDF: «вы тянете наугад одну карту» — Шкет получает её, в каком виде? PDF не уточняет; предлагаемая трактовка — в **закрытом** виде, как любая полученная карта).
- **Грабёж с RESPOND_ROB=accept**: jika грабитель тянет «закрытую» — пусть Шкет работает аналогично, попадает закрытой к грабителю.
- Это всё штатные пути reducer'а — visibility ловит их автоматически (любая карта в closedSupplies → скрыта).

## Side-channel риски (не блокирующие на MVP)

- **Тайминг**: задержки на анимациях могут раскрыть info («он долго думал, значит у него интересные карты»). Не блокирующее.
- **Network sniffing**: WebRTC данные зашифрованы DTLS, но мета-инфа (размер пакета) частично доступна. Не блокирующее для friends-game.
