import type { GridPoint } from './geometry'

export type TokenCategory = 'player' | 'npc' | 'monster' | 'undead'

export interface TokenTemplate {
  readonly kind: string
  readonly name: string
  readonly category: TokenCategory
  readonly color: string
  readonly symbol: string
  readonly defaultVisionRange: number
}

export interface PlacedToken {
  readonly id: string
  readonly mapId: string
  readonly levelId?: string
  readonly name: string
  readonly position: GridPoint
  readonly size: number
  readonly rotation: number
  readonly visionRange: number
  readonly visionAngle: number | null
  readonly visionEnabled: boolean
  readonly category: TokenCategory
  readonly color: string
  readonly symbol: string
  readonly image?: string
}

export interface TokenPatch {
  readonly name?: string
  readonly position?: GridPoint
  readonly levelId?: string
  readonly size?: number
  readonly rotation?: number
  readonly visionRange?: number
  readonly visionAngle?: number | null
  readonly visionEnabled?: boolean
}

export const tokenTemplates: readonly TokenTemplate[] = [
  {
    kind: 'hero',
    name: 'Held',
    category: 'player',
    color: '#3f8cff',
    symbol: 'H',
    defaultVisionRange: 8,
  },
  {
    kind: 'mage',
    name: 'Magier',
    category: 'player',
    color: '#a66cff',
    symbol: 'M',
    defaultVisionRange: 7,
  },
  {
    kind: 'goblin',
    name: 'Goblin',
    category: 'monster',
    color: '#5fa857',
    symbol: 'G',
    defaultVisionRange: 6,
  },
  {
    kind: 'skeleton',
    name: 'Skelett',
    category: 'undead',
    color: '#d2d7df',
    symbol: 'S',
    defaultVisionRange: 6,
  },
]

export const findTokenTemplate = (kind: string): TokenTemplate | undefined =>
  tokenTemplates.find((template) => template.kind === kind)
