/**
 * Pure, serializable input for map planners. Every field is optional so a
 * local or AI planner can supply the missing detail deterministically.
 */
export interface MapGenerationRequest {
  readonly seed?: number
  readonly description?: string
  readonly aiEnabled?: boolean
  readonly mapType?: MapType
  /** Multiple environments can be requested; the planner resolves conflicts. */
  readonly biomes?: readonly Biome[]
  readonly biome?: Biome
  /** Multiple water features can be requested; omit `none` instead of combining it. */
  readonly waterFeatures?: readonly WaterPreference[]
  readonly water?: WaterPreference
  /** Multiple built themes can be requested, for example ruins plus a temple. */
  readonly themes?: readonly SettlementTheme[]
  readonly theme?: SettlementTheme
  /** Optional scene elements that do not determine map topology. */
  readonly features?: readonly RequestedFeature[]
  readonly atmosphere?: Atmosphere
  readonly terrain?: Terrain
  readonly size?: MapSize
  readonly width?: number
  readonly height?: number
  readonly dungeon?: DungeonPreferences
}

export type MapType =
  | 'outdoor'
  | 'dungeon'
  | 'cave'
  | 'building'
  | 'settlement'
  | 'island'
  | 'coast'
  | 'ruins'

export type Biome =
  | 'forest'
  | 'jungle'
  | 'swamp'
  | 'plains'
  | 'desert'
  | 'snow'
  | 'volcanic'
  | 'underground'
  | 'mushroom'
  | 'wasteland'

export type WaterPreference =
  | 'none'
  | 'pond'
  | 'lake'
  | 'river'
  | 'multiple-rivers'
  | 'coast'
  | 'flooded'

export type SettlementTheme =
  | 'none'
  | 'ruins'
  | 'village'
  | 'town'
  | 'temple'
  | 'castle'
  | 'mine'
  | 'crypt'
  | 'fortress'
  | 'camp'

export type Atmosphere =
  | 'normal'
  | 'dark'
  | 'abandoned'
  | 'overgrown'
  | 'destroyed'
  | 'magical'
  | 'cursed'

export type Terrain = 'flat' | 'hilly' | 'cliffs' | 'canyon' | 'mixed'

export type RequestedFeature = 'ship'

export type MapSize = 'small' | 'medium' | 'large' | 'huge' | 'custom'

export type Density = 'few' | 'many'

export interface DungeonPreferences {
  readonly roomCount?: number
  readonly levelCount?: number
  readonly loops?: Density
  readonly deadEnds?: Density
  readonly secretRooms?: boolean
  readonly entranceCount?: number
  readonly largeHalls?: boolean
  readonly bossRoom?: boolean
  /** Share of dungeon space intended to be naturally formed, from 0 to 1. */
  readonly naturalCaveRatio?: number
}

/** A request after planner defaults have been applied. */
export interface ResolvedMapGenerationRequest {
  readonly seed: number
  readonly description?: string
  readonly aiEnabled: boolean
  readonly mapType: MapType
  readonly biomes: readonly Biome[]
  readonly biome: Biome
  readonly waterFeatures: readonly WaterPreference[]
  readonly water: WaterPreference
  readonly themes: readonly SettlementTheme[]
  readonly theme: SettlementTheme
  readonly features: readonly RequestedFeature[]
  readonly atmosphere: Atmosphere
  readonly terrain: Terrain
  readonly size: MapSize
  readonly width: number
  readonly height: number
  readonly dungeon: Required<DungeonPreferences>
}

export const MAP_PLAN_SCHEMA_VERSION = 1 as const

export type MapPlanSchemaVersion = typeof MAP_PLAN_SCHEMA_VERSION

/**
 * Planner output. It declares topology and intent, not PixiJS objects or
 * final wall/object coordinates. Later stages convert it into MapDefinition.
 */
export interface MapPlan {
  readonly schemaVersion: MapPlanSchemaVersion
  readonly id: string
  readonly name: string
  readonly seed: number
  readonly dimensions: PlanDimensions
  readonly theme: PlanTheme
  readonly layout: PlanLayout
  readonly brief?: string
  readonly levels: readonly PlanLevel[]
  readonly regions: readonly PlanRegion[]
  readonly rooms: readonly PlanRoom[]
  readonly areas: readonly PlanArea[]
  readonly connections: readonly PlanConnection[]
  readonly entrances: readonly PlanEntrance[]
  readonly landmarks: readonly PlanLandmark[]
  readonly paths: readonly PlanPath[]
  readonly waterFeatures: readonly PlanWaterFeature[]
  readonly specialFeatures: readonly PlanSpecialFeature[]
  readonly startArea: PlanStartArea
  readonly storyHooks: readonly PlanStoryHook[]
  readonly sceneFeatures: readonly PlanSceneFeature[]
}

export interface PlanDimensions {
  readonly width: number
  readonly height: number
  readonly size: MapSize
}

export interface PlanTheme {
  readonly mapType: MapType
  readonly biomes: readonly Biome[]
  readonly biome: Biome
  readonly waterFeatures: readonly WaterPreference[]
  readonly water: WaterPreference
  readonly settlements: readonly SettlementTheme[]
  readonly settlement: SettlementTheme
  readonly atmosphere: Atmosphere
  readonly terrain: Terrain
}

export interface PlanLayout {
  readonly archetype: PlanLayoutArchetype
  readonly connectionStructure: PlanConnectionStructure
}

export type PlanLayoutArchetype =
  | 'open-encounter'
  | 'winding-route'
  | 'river-crossing'
  | 'terraced-approach'
  | 'hub-and-spoke'
  | 'looping-halls'
  | 'branching-delves'
  | 'layered-descent'
  | 'breached-fortress'
  | 'flooded-complex'
  | 'settlement-crossroads'
  | 'coastal-ring'

export type PlanConnectionStructure =
  | 'linear'
  | 'branching'
  | 'looped'
  | 'radial'
  | 'paired-routes'
  | 'layered'
  | 'ring'

export interface PlanLevel {
  readonly id: string
  readonly name: string
  readonly order: number
  /** Relative elevation for later vertical geometry; not a pixel coordinate. */
  readonly elevation: number
  readonly kind: PlanLevelKind
}

export type PlanLevelKind = 'surface' | 'upper' | 'underground' | 'submerged'

export interface PlanRegion {
  readonly id: string
  readonly levelId: string
  readonly kind: PlanRegionKind
  readonly size: PlanScale
  readonly tags?: readonly string[]
}

export type PlanRegionKind =
  | 'wilderness'
  | 'district'
  | 'dungeon-wing'
  | 'cavern-system'
  | 'compound'
  | 'shore'
  | 'ruin-zone'

export interface PlanRoom {
  readonly id: string
  readonly levelId: string
  readonly regionId?: string
  readonly role: PlanRoomRole
  readonly size: PlanScale
  readonly tags?: readonly string[]
}

export type PlanRoomRole =
  | 'entry'
  | 'hall'
  | 'chamber'
  | 'corridor'
  | 'junction'
  | 'sanctum'
  | 'boss'
  | 'treasure'
  | 'crypt'
  | 'mine'
  | 'service'
  | 'secret'

export interface PlanArea {
  readonly id: string
  readonly levelId: string
  readonly regionId?: string
  readonly kind: PlanAreaKind
  readonly size: PlanScale
  readonly tags?: readonly string[]
}

export type PlanAreaKind =
  | 'clearing'
  | 'courtyard'
  | 'camp'
  | 'plaza'
  | 'roadside'
  | 'bridgehead'
  | 'beach'
  | 'islet'
  | 'shoreline'
  | 'cavern'
  | 'flooded-area'

export type PlanScale = 'tiny' | 'small' | 'medium' | 'large' | 'vast'

export interface PlanConnection {
  readonly id: string
  readonly fromId: string
  readonly toId: string
  readonly kind: PlanConnectionKind
  readonly secret?: boolean
  readonly loop?: boolean
}

export type PlanConnectionKind =
  | 'door'
  | 'corridor'
  | 'tunnel'
  | 'path'
  | 'bridge'
  | 'stairs'
  | 'ladder'
  | 'portal'

export interface PlanEntrance {
  readonly id: string
  readonly targetId: string
  readonly kind: PlanEntranceKind
  readonly levelId: string
}

export type PlanEntranceKind =
  | 'road'
  | 'gate'
  | 'door'
  | 'cave-mouth'
  | 'shore'
  | 'stairs'
  | 'ladder'
  | 'portal'

export interface PlanLandmark {
  readonly id: string
  readonly targetId: string
  readonly kind: PlanLandmarkKind
  readonly importance: PlanImportance
}

export type PlanLandmarkKind =
  | 'altar'
  | 'statue'
  | 'tower'
  | 'tree'
  | 'well'
  | 'bridge'
  | 'wreck'
  | 'monolith'
  | 'bonfire'

export type PlanImportance = 'minor' | 'major' | 'focal'

export interface PlanPath {
  readonly id: string
  readonly fromId: string
  readonly toId: string
  readonly kind: PlanPathKind
  readonly importance: PlanImportance
}

export type PlanPathKind = 'road' | 'trail' | 'riverbank' | 'tunnel-route' | 'stairs'

export interface PlanWaterFeature {
  readonly id: string
  readonly targetId?: string
  readonly kind: PlanWaterFeatureKind
  readonly levelId: string
}

export type PlanWaterFeatureKind =
  | 'pond'
  | 'lake'
  | 'river'
  | 'multiple-rivers'
  | 'coast'
  | 'flooded'
  | 'waterfall'

export interface PlanSpecialFeature {
  readonly id: string
  readonly targetId?: string
  readonly kind: PlanSpecialFeatureKind
}

export type PlanSpecialFeatureKind =
  | 'secret-room'
  | 'trap'
  | 'vertical-transition'
  | 'large-hall'
  | 'boss-objective'
  | 'natural-cave'
  | 'collapsed-passage'

export interface PlanStartArea {
  readonly targetId: string
  readonly levelId: string
  readonly entranceId?: string
}

export interface PlanStoryHook {
  readonly id: string
  readonly targetId: string
  readonly kind: PlanStoryHookKind
}

export type PlanStoryHookKind =
  | 'ambush'
  | 'ritual'
  | 'rescue'
  | 'treasure'
  | 'investigation'
  | 'boss-objective'

export interface PlanSceneFeature {
  readonly id: string
  readonly targetId: string
  readonly kind: PlanSceneFeatureKind
}

export type PlanSceneFeatureKind =
  | 'abandoned-caravan'
  | 'grave-site'
  | 'logging-site'
  | 'ritual-site'
  | 'spider-nest'
  | 'watch-camp'
  | 'battlefield'
  | 'market'

/** Contract shared by a future local and AI-backed planner. */
export interface MapPlanner {
  plan(request: MapGenerationRequest): MapPlan
}
