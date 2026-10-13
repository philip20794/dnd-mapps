import type { MapObjectDefinition } from '@/map-objects'
import type { DoorDefinition, WallDefinition } from '@/maps/api'

export type SetDressingSceneKind =
  | 'camp'
  | 'abandoned-camp'
  | 'ruin'
  | 'forest-edge'
  | 'river-bank'
  | 'dungeon-storage'
  | 'ritual-site'

export interface DressingPoint {
  readonly x: number
  readonly y: number
}

export interface DressingBounds {
  readonly width: number
  readonly height: number
  readonly levelId: string
}

export interface DressingPlacementRules extends DressingBounds {
  /** Optional walkable cells, used to keep dungeon props inside room interiors. */
  readonly allowedCells?: ReadonlySet<string>
  readonly forbiddenCells?: ReadonlySet<string>
  readonly walls?: readonly WallDefinition[]
  readonly doors?: readonly DoorDefinition[]
  readonly occupied?: readonly MapObjectDefinition[]
}

export interface SetDressingScene {
  readonly id: string
  readonly kind: SetDressingSceneKind
  readonly levelId: string
  readonly center: DressingPoint
  readonly objectIds: readonly string[]
  /** Intentional empty radius, for example around a campfire or ritual center. */
  readonly clearRadius: number
  readonly tags: readonly string[]
}

export interface SetDressingResult {
  readonly objects: readonly MapObjectDefinition[]
  readonly scenes: readonly SetDressingScene[]
}

export interface SetDressingSceneRequest {
  readonly id: string
  readonly kind: SetDressingSceneKind
  readonly levelId: string
  readonly center: DressingPoint
  readonly tags: readonly string[]
  readonly atmosphere: string
  readonly biome?: string
}
