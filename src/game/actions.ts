// Discriminated union всех игровых действий. См. docs/game-spec.md §8 + decisions.md (#3, #12).
// Дискриминатор — `kind:`, имена без префикса фазы (фазу валидирует FSM).

import type { CharacterId } from './constants'
import type {
  NavCardInstanceId,
  PlayerId,
  SeatIndex,
  SupplyInstanceId,
} from './types'

// ---------- Lobby / setup ----------

export interface AJoinLobby {
  readonly kind: 'LOBBY_JOIN'
  readonly playerId: PlayerId
  readonly name: string
}
export interface ALeaveLobby {
  readonly kind: 'LOBBY_LEAVE'
  readonly playerId: PlayerId
}
export interface AStartGame {
  readonly kind: 'START_GAME'
  readonly playerId: PlayerId
}

// ---------- Morning ----------

export interface AChooseSupply {
  readonly kind: 'CHOOSE_SUPPLY'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}

// ---------- Day: выбор основного действия ----------

export interface ARow {
  readonly kind: 'ROW'
  readonly playerId: PlayerId
}
export interface AOfferSwap {
  readonly kind: 'OFFER_SWAP'
  readonly playerId: PlayerId
  readonly targetSeat: SeatIndex
}
export interface AOfferRob {
  readonly kind: 'OFFER_ROB'
  readonly playerId: PlayerId
  readonly targetSeat: SeatIndex
}
export interface AShketSteal {
  readonly kind: 'SHKET_STEAL'
  readonly playerId: PlayerId
  readonly targetSeat: SeatIndex
}
export interface AUseFirstAid {
  readonly kind: 'USE_FIRST_AID'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
  readonly targetCharacter: CharacterId
}
export interface AUseUmbrella {
  readonly kind: 'USE_UMBRELLA'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
  readonly targetCharacter: CharacterId
}
export interface AUseFlare {
  readonly kind: 'USE_FLARE'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}
export interface ASkipTurn {
  readonly kind: 'SKIP_TURN'
  readonly playerId: PlayerId
}

// ---------- Day: подфазы ----------

export interface ARowKeepCards {
  readonly kind: 'ROW_KEEP_CARDS'
  readonly playerId: PlayerId
  readonly cardIds: NavCardInstanceId[]
}

// ---------- Реакция на swap/rob ----------

export interface AProposalAccept {
  readonly kind: 'PROPOSAL_ACCEPT'
  readonly playerId: PlayerId
}
export interface AProposalReject {
  readonly kind: 'PROPOSAL_REJECT'
  readonly playerId: PlayerId
}
export type RobPick =
  | { readonly kind: 'open'; readonly supplyId: SupplyInstanceId }
  | { readonly kind: 'closed' }
export interface ARobPick {
  readonly kind: 'ROB_PICK'
  readonly playerId: PlayerId
  readonly pick: RobPick
}

// ---------- Драка ----------

export type FightSide = 'attacker' | 'defender'

export interface ADeclareFight {
  readonly kind: 'DECLARE_FIGHT'
  readonly playerId: PlayerId
}
export interface AFightRecruitAlly {
  readonly kind: 'FIGHT_RECRUIT_ALLY'
  readonly playerId: PlayerId
  readonly targetCharacter: CharacterId
  readonly side: FightSide
}
export interface AFightAllyResponse {
  readonly kind: 'FIGHT_ALLY_RESPONSE'
  readonly playerId: PlayerId
  readonly accept: boolean
  readonly weapons: SupplyInstanceId[]
}
export interface AFightAddWeapon {
  readonly kind: 'FIGHT_ADD_WEAPON'
  readonly playerId: PlayerId
  readonly weaponSupplyId: SupplyInstanceId
}
export interface AFightCloseRecruitment {
  readonly kind: 'FIGHT_CLOSE_RECRUITMENT'
  readonly playerId: PlayerId
}

// ---------- Реактивные (в-любой-момент, кроме драки) ----------

export interface ARevealSupply {
  readonly kind: 'REVEAL_SUPPLY'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}
export interface ADiscardSupply {
  readonly kind: 'DISCARD_SUPPLY'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}
export interface AGiveSupply {
  readonly kind: 'GIVE_SUPPLY'
  readonly playerId: PlayerId
  readonly targetCharacter: CharacterId
  readonly supplyId: SupplyInstanceId
  readonly faceUp: boolean
}
export interface AUseLifeRing {
  readonly kind: 'USE_LIFE_RING'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
  readonly targetCharacter: CharacterId
}

// ---------- Вечер ----------

export interface AEveningUseCompass {
  readonly kind: 'EVENING_USE_COMPASS'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}
export interface AEveningSelectNavCard {
  readonly kind: 'EVENING_SELECT_NAV_CARD'
  readonly playerId: PlayerId
  readonly navCardId: NavCardInstanceId
}
export interface AEveningUseSharkBait {
  readonly kind: 'EVENING_USE_SHARK_BAIT'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
}
export interface AEveningUseWater {
  readonly kind: 'EVENING_USE_WATER'
  readonly playerId: PlayerId
  readonly supplyId: SupplyInstanceId
  readonly targetCharacter: CharacterId
}
export interface AEveningDeclineWater {
  readonly kind: 'EVENING_DECLINE_WATER'
  readonly playerId: PlayerId
  readonly targetCharacter: CharacterId
}

// ---------- Системные ----------

export interface APhaseAdvance {
  readonly kind: 'PHASE_ADVANCE'
}

// ---------- Union ----------

export type Action =
  | AJoinLobby
  | ALeaveLobby
  | AStartGame
  | AChooseSupply
  | ARow
  | AOfferSwap
  | AOfferRob
  | AShketSteal
  | AUseFirstAid
  | AUseUmbrella
  | AUseFlare
  | ASkipTurn
  | ARowKeepCards
  | AProposalAccept
  | AProposalReject
  | ARobPick
  | ADeclareFight
  | AFightRecruitAlly
  | AFightAllyResponse
  | AFightAddWeapon
  | AFightCloseRecruitment
  | ARevealSupply
  | ADiscardSupply
  | AGiveSupply
  | AUseLifeRing
  | AEveningUseCompass
  | AEveningSelectNavCard
  | AEveningUseSharkBait
  | AEveningUseWater
  | AEveningDeclineWater
  | APhaseAdvance

export type ActionKind = Action['kind']
