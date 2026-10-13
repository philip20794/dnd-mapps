import type { GridPoint } from '@/types/geometry'

export const materialIds = [
  'grass',
  'forest-floor',
  'dirt',
  'mud',
  'stone',
  'dungeon-stone',
  'sand',
  'snow',
  'volcanic',
  'ash',
  'shallow-water',
  'deep-water',
  'wood',
] as const

export type MaterialId = (typeof materialIds)[number]

export const materialDecalKinds = [
  'dirt',
  'crack',
  'moss',
  'leaves',
  'small-stones',
  'irregularity',
  'shore-detail',
] as const

export type MaterialDecalKind = (typeof materialDecalKinds)[number]
export type MaterialTransitionStyle = 'none' | 'soft' | 'rough' | 'masonry' | 'shore'

/** Optional atlas information. Procedural variants are used until real assets are supplied. */
export interface MaterialTextureSet {
  readonly atlasKey: string
  readonly frames: readonly string[]
}

export interface MaterialAreaDefinition {
  readonly id?: string
  readonly material: MaterialId
  readonly position: GridPoint
  readonly width: number
  readonly height: number
  /** Selects a stable procedural or atlas variant. Omitted values are seed-derived per cell. */
  readonly variant?: number
  readonly rotation?: 0 | 90 | 180 | 270
  readonly scale?: number
  readonly tint?: number
  readonly alpha?: number
  readonly transition?: MaterialTransitionStyle
  readonly textureSet?: MaterialTextureSet
  readonly tags?: readonly string[]
}

export interface MaterialDecalDefinition {
  readonly id?: string
  readonly kind: MaterialDecalKind
  readonly position: GridPoint
  readonly width?: number
  readonly height?: number
  readonly density?: number
  readonly rotation?: number
  readonly scale?: number
  readonly color?: number
  readonly alpha?: number
  readonly seed?: number
}

/**
 * Serializable static terrain. It deliberately contains no PixiJS objects and is separate from
 * interactive MapObjectDefinitions.
 */
export interface MaterialLayerDefinition {
  readonly id: string
  readonly levelId?: string
  readonly seed: number
  readonly chunkSize?: number
  readonly areas: readonly MaterialAreaDefinition[]
  readonly decals?: readonly MaterialDecalDefinition[]
}
