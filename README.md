# За бортом — веб-версия

P2P веб-реализация настольной игры «За бортом» (Magellan / Jeff Siadek, 2001) для игры с друзьями.

## Стек

React 18 + TypeScript (strict) · Vite · Zustand · XState · PeerJS · Vitest · Tailwind

## Запуск (после генерации стартового шаблона)

```bash
npm install
npm run dev
```

## Документация

Источник истины для разработки лежит в `docs/`:

| Файл | Содержание |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Контекст проекта для Claude Code: стек, конвенции, архитектура |
| [`docs/game-rules.md`](./docs/game-rules.md) | Формализованные правила игры — источник истины для game logic |
| [`docs/game-spec.md`](./docs/game-spec.md) | Типы данных, Actions, reducer signature |
| [`docs/network-protocol.md`](./docs/network-protocol.md) | P2P-протокол host/client, фильтрация state |
| [`docs/state-machine.md`](./docs/state-machine.md) | Карта фаз и подфаз игры (XState) |
| [`docs/visibility-model.md`](./docs/visibility-model.md) | Что видит каждый игрок (visibility-фильтр) |
| [`docs/bots.md`](./docs/bots.md) | Спецификация эвристических ботов |
| [`docs/roadmap.md`](./docs/roadmap.md) | Фазы разработки с acceptance-критериями |

## Юридический статус

Игра — Jeff Siadek (©2001), локализация — Magellan. Эта реализация — для личной игры с друзьями. Для публичного хостинга потребуется свой арт и/или договорённость с правообладателями.
