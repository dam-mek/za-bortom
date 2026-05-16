// Сетевой протокол (wire). См. docs/network-protocol.md + decisions.md #13.
// Дискриминатор — `kind:`. Сообщения — kebab-case.

import type { Action } from '@/game/actions'
import type { FilteredGameState, GameError, PlayerId } from '@/game/types'

// ---------- Lobby snapshot ----------

export interface LobbyPlayer {
  readonly id: PlayerId
  readonly displayName: string
  readonly isBot: boolean
  readonly ready: boolean
  readonly disconnected: boolean
}

export interface LobbyState {
  readonly hostId: PlayerId
  readonly players: LobbyPlayer[]
  readonly canStart: boolean
}

// ---------- Client → Host ----------

export type ClientMessage =
  | { readonly kind: 'join-request'; readonly name: string; readonly clientToken: string }
  | { readonly kind: 'ready'; readonly ready: boolean }
  | { readonly kind: 'action'; readonly actionId: string; readonly action: Action }
  | { readonly kind: 'request-state' }
  | { readonly kind: 'ping'; readonly nonce: string }
  | { readonly kind: 'leave' }

// ---------- Host → Client ----------

export type HostMessage =
  | {
      readonly kind: 'join-accepted'
      readonly playerId: PlayerId
      readonly lobby: LobbyState
    }
  | { readonly kind: 'join-rejected'; readonly reason: string }
  | { readonly kind: 'lobby-update'; readonly lobby: LobbyState }
  | {
      readonly kind: 'game-start'
      readonly view: FilteredGameState
      readonly you: PlayerId
    }
  | {
      readonly kind: 'state-update'
      readonly view: FilteredGameState
      readonly lastActionId?: string
    }
  | { readonly kind: 'action-accepted'; readonly actionId: string }
  | {
      readonly kind: 'action-rejected'
      readonly actionId: string
      readonly error: GameError
    }
  | { readonly kind: 'player-disconnected'; readonly playerId: PlayerId }
  | { readonly kind: 'player-reconnected'; readonly playerId: PlayerId }
  | { readonly kind: 'pong'; readonly nonce: string }
  | { readonly kind: 'game-over'; readonly reason: string }
  | { readonly kind: 'host-going-down' }
