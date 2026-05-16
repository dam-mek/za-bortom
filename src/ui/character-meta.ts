import { CHARACTERS } from '@/game/constants'
import type { CharacterId } from '@/game/constants'

export interface CharacterMeta {
  readonly id: CharacterId
  readonly name: string
  readonly strength: number
  readonly survivalBonus: number
}

const NAMES: Record<CharacterId, string> = {
  bocman: 'Боцман',
  shket: 'Шкет',
  snob: 'Сноб',
  kapitan: 'Капитан',
  miledi: 'Миледи',
  cherpak: 'Черпак',
}

export function characterMeta(id: CharacterId): CharacterMeta {
  const c = CHARACTERS.find((x) => x.id === id)
  return {
    id,
    name: NAMES[id],
    strength: c?.strength ?? 0,
    survivalBonus: c?.survivalBonus ?? 0,
  }
}
