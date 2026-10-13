import type { GridPoint, Segment } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import type { MapObjectDefinition } from '@/map-objects/types'
import type { MapGenerationRequest, MapPlan } from '@/map-generation/types'
import type { MaterialLayerDefinition } from '@/map-materials/types'

export type DoorState = 'open' | 'closed'

export interface MapLevelDefinition {
  readonly id: string
  readonly name: string
  readonly order?: number
}

export interface WallDefinition extends Segment {
  readonly id?: string
  readonly levelId?: string
  readonly blocksSight: boolean
  readonly blocksMovement: boolean
}

export interface DoorDefinition {
  readonly id: string
  readonly label: string
  readonly levelId?: string
  readonly segment: Segment
  readonly defaultState: DoorState
  readonly blocksSightWhenClosed: boolean
  readonly blocksMovementWhenClosed: boolean
}

export interface SpawnPointDefinition {
  readonly id: string
  readonly name: string
  readonly levelId?: string
  readonly position: GridPoint
  readonly radius: number
  readonly tags?: readonly string[]
}

export interface MapDefinition {
  readonly id: string
  readonly name: string
  readonly width: number
  readonly height: number
  readonly gridSize: number
  readonly levels?: readonly MapLevelDefinition[]
  readonly defaultLevelId?: string
  readonly objects: readonly MapObjectDefinition[]
  /** Static visual terrain, kept separate from editable and interactive objects. */
  readonly materialLayers?: readonly MaterialLayerDefinition[]
  readonly walls: readonly WallDefinition[]
  readonly doors: readonly DoorDefinition[]
  readonly spawnPoints: readonly SpawnPointDefinition[]
  readonly startTokens?: readonly PlacedToken[]
  /** Serializable provenance for generated maps; fixed maps deliberately omit it. */
  readonly generation?: MapGenerationMetadata
}

export interface MapGenerationMetadata {
  readonly pipelineVersion: 1
  readonly request: MapGenerationRequest
  readonly plan: MapPlan
  readonly planner: 'local' | 'ai' | 'local-fallback'
  readonly debug?: {
    readonly model?: string
    readonly attempts?: number
    readonly fallbackReason?: string
  }
}

export interface MapPrefabResult {
  readonly objects?: readonly MapObjectDefinition[]
  readonly walls?: readonly WallDefinition[]
  readonly doors?: readonly DoorDefinition[]
  readonly spawnPoints?: readonly SpawnPointDefinition[]
}

export const fallbackLevelId = 'ground'

export const getDefaultLevelId = (map: Pick<MapDefinition, 'levels' | 'defaultLevelId'>): string =>
  map.defaultLevelId ?? map.levels?.[0]?.id ?? fallbackLevelId

export const getLevelName = (
  map: Pick<MapDefinition, 'levels' | 'defaultLevelId'>,
  levelId: string,
): string => map.levels?.find((level) => level.id === levelId)?.name ?? levelId

export const entryLevelId = (
  entry: { readonly levelId?: string },
  map: Pick<MapDefinition, 'levels' | 'defaultLevelId'>,
): string => entry.levelId ?? getDefaultLevelId(map)

export const defineMap = <TMap extends MapDefinition>(definition: TMap): TMap => definition

export const mergePrefabResults = (...prefabs: readonly MapPrefabResult[]): MapPrefabResult => ({
  objects: prefabs.flatMap((prefab) => prefab.objects ?? []),
  walls: prefabs.flatMap((prefab) => prefab.walls ?? []),
  doors: prefabs.flatMap((prefab) => prefab.doors ?? []),
  spawnPoints: prefabs.flatMap((prefab) => prefab.spawnPoints ?? []),
})
