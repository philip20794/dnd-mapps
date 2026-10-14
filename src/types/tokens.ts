import type { GridPoint } from './geometry'

export type TokenCategory = 'player' | 'npc' | 'monster' | 'undead'
export type QuickTokenCategory = 'player' | 'monster'

export const tokenSizeOptions = [
  { id: 'small', label: 'Small', size: 0.6 },
  { id: 'medium', label: 'Medium', size: 1 },
  { id: 'large', label: 'Large', size: 2 },
  { id: 'huge', label: 'Huge', size: 3 },
] as const

export type TokenSizeId = (typeof tokenSizeOptions)[number]['id']

export interface QuickTokenCreation {
  readonly category: QuickTokenCategory
  readonly size: number
  readonly color: string
}

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
  readonly color?: string
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
    defaultVisionRange: 8,
  },
  {
    kind: 'goblin',
    name: 'Goblin',
    category: 'monster',
    color: '#5fa857',
    symbol: 'G',
    defaultVisionRange: 0,
  },
  {
    kind: 'skeleton',
    name: 'Skelett',
    category: 'undead',
    color: '#d2d7df',
    symbol: 'S',
    defaultVisionRange: 0,
  },
]

export const findTokenTemplate = (kind: string): TokenTemplate | undefined =>
  tokenTemplates.find((template) => template.kind === kind)
