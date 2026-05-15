> Merged from 03-network-protocol.md + network-protocol.md on 2026-05-15.

# Сетевой протокол

P2P-архитектура через **WebRTC** (библиотека **PeerJS**), модель — **authoritative host**. Один игрок — host, остальные — клиенты. Host владеет полным state, валидирует Actions, рассылает обновления.

## 1. Архитектура / топология

```
┌─────────┐                  ┌─────────┐
│ Client  │◄─────P2P────────►│  Host   │◄────P2P────►┌─────────┐
│ (peerB) │                  │ (peerA) │             │ Client  │
└─────────┘                  └─────────┘             │ (peerC) │
                                  ▲                  └─────────┘
                                  │
                              GameState
                              + reducer
                              + RNG
                              + бот-логика
```

- Один из игроков — **host** (создатель комнаты). Его браузер исполняет reducer.
- Остальные — **клиенты**. Шлют actions, получают filtered views.
- Бот-игроки исполняются на host'е (как «виртуальные клиенты»).
- Клиенты держат WebRTC-соединение **только с host'ом**. Между собой клиенты не общаются — host релэит при необходимости.
- Signaling — PeerJS public server (по умолчанию). При необходимости: свой PeerServer (см. ниже).

## 2. Жизненный цикл сессии

```
1. Host жмёт "Создать комнату". Получает peer-id (генерируется автоматически или указывается).
2. Host видит свой code/URL, например https://app/?host=<peer-id>  или короткий код 'boat-7K3X'.
3. Клиенты открывают URL/вводят код, peer.connect(hostId).
4. Host принимает соединения, добавляет каждого клиента в лобби.
5. Лобби: указание имён, выбор бот-слотов, ожидание готовности.
6. Host жмёт START_GAME. Все клиенты получают initial PlayerView.
7. Игра: actions → host → reduce → broadcast PlayerView.
8. Завершение: host шлёт finalScores. Все смотрят результаты.
9. Закрытие соединений.
```

### 2.1 Создание комнаты (host)

```ts
const peer = new Peer('boat-' + nanoid(4), {
  // публичный PeerServer по умолчанию
  // host: '0.peerjs.com', port: 443, path: '/', secure: true
});
peer.on('open', (id) => {
  // комната готова, делимся id с друзьями (через Discord)
});
peer.on('connection', (conn) => {
  // новый клиент подключается, см. join flow
});
```

### 2.2 Подключение клиента

```ts
const peer = new Peer();
peer.on('open', () => {
  const conn = peer.connect('boat-1234', { reliable: true });
  conn.on('open', () => {
    conn.send({ type: 'JOIN_REQUEST', name: 'Алёша', clientToken: tokenFromLocalStorage });
  });
});
```

`clientToken` — UUID, который клиент генерирует при первом подключении и сохраняет в `localStorage`. Используется для reconnect (см. §6).

### 2.3 Join flow

1. Host получает `JOIN_REQUEST`.
2. Если игра в `phase.kind === 'lobby'`:
   - Создать `Player` (без `characterId` пока), привязать `clientToken` → `playerId`.
   - Принять, добавить в players.
   - Отправить клиенту `{ type: 'JOIN_ACCEPTED', playerId, state: filteredState }`.
3. Если игра уже идёт и `clientToken` есть в `playerTokenMap`:
   - Это **reconnect** — восстановить связь с существующим `playerId`.
   - Отправить текущий `filteredState`.
4. Если игра идёт и `clientToken` неизвестен:
   - Отклонить: `{ type: 'JOIN_REJECTED', reason: 'GAME_IN_PROGRESS' }`.

## 3. Сообщения

Все сообщения — JSON, отправляются через `conn.send(msg)`.

### 3.1 Client → Host

```ts
type ClientMessage =
  | { type: 'JOIN_REQUEST'; name: string; clientToken: string }   // alias: 'join' { displayName }
  | { type: 'READY'; ready: boolean }                              // alias: 'ready'
  | { type: 'ACTION'; actionId: string; action: Action }           // alias: 'action' { nonce, action }
  | { type: 'PING'; nonce?: string }                               // alias: 'ping'
  | { type: 'REQUEST_STATE' }                                      // на случай рассинхронизации
  | { type: 'LEAVE' };
```

- `actionId` / `nonce` — UUID, генерируется клиентом для отслеживания ответа (ack).

### 3.2 Host → Client

```ts
type HostMessage =
  | { type: 'JOIN_ACCEPTED'; playerId: PlayerId; state: FilteredGameState }
  | { type: 'JOIN_REJECTED'; reason: string }
  | { type: 'LOBBY'; state: LobbyState }                                   // alias: 'lobby'
  | { type: 'GAME_START'; view: FilteredGameState; you: PlayerId }         // alias: 'game-start'
  | { type: 'STATE_UPDATE'; state: FilteredGameState; lastActionId?: string }  // alias: 'state' { view, ackNonce }
  | { type: 'ACTION_ACCEPTED'; actionId: string }
  | { type: 'ACTION_REJECTED'; actionId: string; error: ReducerError }     // alias: 'action-rejected' { nonce, error }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }                    // alias: 'player-disconnected'
  | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId }
  | { type: 'PONG'; nonce?: string }
  | { type: 'GAME_OVER'; reason: string }
  | { type: 'HOST_GOING_DOWN' };
```

> **Open question: соглашение об именах сообщений.**
> Версия A — `SCREAMING_SNAKE_CASE` (`JOIN_REQUEST`, `STATE_UPDATE`).
> Версия B — `kebab-case`/`lower` (`join`, `state`, `action-rejected`).
> Выбрать один. Алиасы выше — для трассировки.

### 3.3 Lobby state

```ts
interface LobbyState {
  hostId: PlayerId;
  players: Array<{ id: PlayerId; displayName: string; ready: boolean }>;
  botSlots: number;
  canStart: boolean;
}
```

### 3.4 Принцип распространения state

Host **не диффает** state — отправляет целиком отфильтрованный snapshot после каждого изменения. State у настолки небольшой (десятки KB), это проще, чем diff/patch.

При большом количестве `STATE_UPDATE` (например, во время быстрых подфаз драки) можно дебаунсить на ~50ms, чтобы не флудить, — это оптимизация.

## 4. Фильтрация state

Перед отправкой клиенту X состояние проходит через `filterStateForPlayer(state, viewerId)`. См. [`docs/game-spec.md`](./game-spec.md) §10 и [`docs/visibility-model.md`](./visibility-model.md).

**Критично:** клиент не получает данных, которые игрок не должен видеть. Это не косметика — это игровое правило. Если игрок откроет DevTools, он увидит только свой `bestFriendId`, своё содержимое `closedSupplies` и т.д.

## 5. Цикл обработки Action на host'е

```ts
function handleClientMessage(clientPeerId: PeerId, msg: ClientMessage) {
  if (msg.type !== 'ACTION') { /* handle others */ return; }

  const playerId = peerIdToPlayerId.get(clientPeerId);
  if (!playerId) { reject('UNKNOWN_PLAYER'); return; }

  // Принудительно подставляем правильный playerId, игнорируя то, что прислал клиент.
  // Иначе клиент мог бы прислать { type: 'DAY_CHOOSE_ROW', playerId: 'другойИгрок' }.
  const safeAction = { ...msg.action, playerId };

  const result = reduce(currentState, safeAction, rng);
  if (result.ok) {
    currentState = result.state;
    assertInvariants(currentState);                  // в dev/test
    sendToClient(clientPeerId, { type: 'ACTION_ACCEPTED', actionId: msg.actionId });

    // Опционально: ход бота, если currentTurnPlayer — бот
    await maybeRunBotTurn(currentState);

    broadcastStateUpdate(result.events);
  } else {
    sendToClient(clientPeerId, { type: 'ACTION_REJECTED', actionId: msg.actionId, error: result.error });
  }
}
```

**Безопасность:** host **всегда переписывает** `action.playerId` на ID, привязанный к peer-соединению. Никаких «trust the client».

## 6. Отключения и переподключения

### 6.1 Клиент отключился

`peer.on('disconnected', ...)` или `conn.on('close', ...)`.

Host:

1. Помечает `player.disconnected = true` (или `connected = false`) в state.
2. Рассылает остальным `{ type: 'PLAYER_DISCONNECTED', playerId }`.
3. **Игра продолжается.** Фазы, требующие его ввода, ждут (или применяется default). Если ход за отключившимся — show timer на UI («ждём 60 секунд...»). По истечении — auto-skip или auto-bot (см. [`docs/bots.md`](./bots.md)).

### 6.2 Клиент возвращается

С тем же `clientToken`:

1. Host принимает реконнект, обновляет peer mapping.
2. `player.disconnected = false`.
3. Клиент шлёт `REQUEST_STATE`, host отвечает полным `STATE_UPDATE`.
4. Рассылает остальным `{ type: 'PLAYER_RECONNECTED', playerId }`.

### 6.3 Host отключился (MVP)

- Для MVP: игра завершается. У клиентов в UI — «host отключился, игра закончена».
- Предупреждение в UI лобби: «Host should keep window open. If host disconnects, game ends.»
- Будущее: host migration через выбор нового host'а среди клиентов. На MVP не реализуется (слишком сложно для P2P без сервера).

### 6.4 Heartbeat

Каждые ~10 секунд клиент шлёт `PING`, host отвечает `PONG`. Если 3 PING'а подряд без ответа — считаем дисконнект и переподключаемся.

### 6.5 Backup snapshot на случай host failure (future)

Можно периодически (каждый `END_DAY`) сериализовать state и слать всем клиентам как `snapshot`. Если host пропадает — один из клиентов может стать новым host'ом, импортировав snapshot. На MVP не делаем.

## 7. Lobby flow подробно

```
1. Host: создаёт Peer, получает roomId (например 'boat-7K3X')
2. Host: открывает UI лобби — список игроков, кнопка "Старт"
3. Host: делится roomId с друзьями через Discord
4. Клиент: вводит roomId, ник, подключается
5. Клиент → Host: JOIN_REQUEST
6. Host: создаёт playerState{ name, id, connected:true }, добавляет в state, рассылает STATE_UPDATE/LOBBY
7. Все клиенты видят обновлённый список
8. Host: когда игроков 4-6 (или с ботами добавлено), нажимает "Старт"
9. Host: dispatch LOBBY_START_GAME
10. Reducer: переход phase.kind → 'setup' → 'morning', dealing, etc.
11. Все клиенты получают filteredState (свои роли/друзья/враги в открытую/закрытую соответственно)
```

## 8. Боты в сетевой модели

Боты живут **только на host'е**. Они не создают peer-соединений. На host'е:

```ts
type Player = HumanPlayer | BotPlayer;
type BotPlayer = Player & {
  isBot: true;
  bot: Bot;   // интерфейс с decide()
};
```

Host в цикле обработки фаз: если ожидается действие от бота — вызывает `bot.decide(filteredStateForBot, botId)` и применяет результат через тот же reducer. Снаружи (для клиентов) бот выглядит как обычный игрок с `connected: true`.

**Важно:** бот принимает `PlayerView` (отфильтрованный state), **не** полный state. Это правило архитектурно усиливает разделение — бот не может «подсматривать».

См. [`docs/bots.md`](./bots.md).

## 9. Замечания по безопасности

- **WebRTC даёт DTLS encryption из коробки.**
- **Никогда не доверять `playerId` от клиента.** Всегда подставлять из peer↔player mapping на host'е.
- **Не отправлять чужие приватные данные** — это нарушение правил, не баг. Идёт через `filterStateForPlayer`.
- **Валидировать структуру сообщений** перед обработкой (Zod / Yup / ts-json-schema). Клиент может прислать что угодно.
- **Rate limit** на сообщения от одного клиента (например, 30/sec), чтобы избежать DoS.
- Peer-id комнаты — публичный, но без знания id подключиться нельзя.

## 10. Сериализация

```ts
function serialize(state: GameState): string;     // JSON.stringify с заменой Map/Set
function deserialize(json: string): GameState;
```

Если в state есть `Map`/`Set` — нужны replacer/reviver. Проще держать всё на plain объектах и массивах. Immer работает с plain JS, всё совместимо.

## 11. Versioning

Включить в сообщения `protocolVersion: '1'`. При несовпадении — show error «обновите страницу».

## 12. Signaling: public vs self-hosted PeerServer

**На MVP — public** (`new Peer()` без опций). Бесплатно, работает, ограничен по одновременным подключениям ~50, но для friends-game этого с запасом.

**Когда мигрировать на свой PeerServer:**

- если public сервер начинает rate-limit'ить;
- если хочется кастомных peer-id (без UUID);
- если планируется хостинг.

Self-hosted PeerServer:

- Node.js пакет `peer`.
- Деплой на Railway/Fly.io (free tier хватает).
- В клиенте: `new Peer({ host: 'my-peer.fly.dev', secure: true })`.

## 13. ICE / STUN / TURN

PeerJS по умолчанию использует Google STUN. **NAT traversal иногда не работает** (симметричный NAT, ~10% случаев) — WebRTC может не установиться.

На MVP:

- Если соединение не устанавливается — показать сообщение: «попробуйте подключиться через VPN или Tailscale».
- Future: добавить TURN-сервер (Twilio TURN, Coturn self-hosted, Cloudflare Calls).

## 14. Production considerations (не сейчас)

При переезде на хостинг:

- **Свой PeerServer** на Railway/Fly.io — публичный peerjs.com может быть нестабилен.
- **TURN-серверы** для NAT traversal.
- **Подписи и аутентификация** между peer'ами — для публичной игры нужно избегать spoofing'а.

На MVP — игнорировать, использовать публичный PeerJS broker и STUN.
