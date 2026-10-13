import type {
  Atmosphere,
  Biome,
  MapType,
  PlanConnectionStructure,
  PlanLandmarkKind,
  PlanLayoutArchetype,
  PlanSceneFeatureKind,
  PlanSpecialFeatureKind,
  PlanStoryHookKind,
  SettlementTheme,
  Terrain,
  WaterPreference,
} from './types.js'

export const mapTypes: readonly MapType[] = [
  'outdoor', 'dungeon', 'cave', 'building', 'settlement', 'island', 'coast', 'ruins',
]
export const biomes: readonly Biome[] = [
  'forest', 'jungle', 'swamp', 'plains', 'desert', 'snow', 'volcanic', 'underground', 'mushroom', 'wasteland',
]
export const terrains: readonly Terrain[] = ['flat', 'hilly', 'cliffs', 'canyon', 'mixed']
export const atmospheres: readonly Atmosphere[] = ['normal', 'dark', 'abandoned', 'overgrown', 'destroyed', 'magical', 'cursed']
export const settlements: readonly SettlementTheme[] = ['ruins', 'village', 'town', 'temple', 'castle', 'mine', 'crypt', 'fortress', 'camp']
export const waters: readonly WaterPreference[] = ['pond', 'lake', 'river', 'multiple-rivers', 'flooded']

export const dungeonArchetypes: readonly PlanLayoutArchetype[] = [
  'winding-route', 'hub-and-spoke', 'looping-halls', 'branching-delves', 'layered-descent', 'breached-fortress', 'flooded-complex',
]
export const settlementArchetypes: readonly PlanLayoutArchetype[] = [
  'settlement-crossroads', 'open-encounter', 'terraced-approach', 'river-crossing', 'coastal-ring', 'breached-fortress',
]
export const wildernessArchetypes: readonly PlanLayoutArchetype[] = [
  'open-encounter', 'winding-route', 'river-crossing', 'terraced-approach', 'coastal-ring', 'branching-delves',
]
export const connectionStructures: readonly PlanConnectionStructure[] = [
  'linear', 'branching', 'looped', 'radial', 'paired-routes', 'layered', 'ring',
]
export const landmarkPool: readonly PlanLandmarkKind[] = ['altar', 'statue', 'tower', 'tree', 'well', 'bridge', 'wreck', 'monolith', 'bonfire']
export const scenePool: readonly PlanSceneFeatureKind[] = ['abandoned-caravan', 'grave-site', 'logging-site', 'ritual-site', 'spider-nest', 'watch-camp', 'battlefield', 'market']
export const storyPool: readonly PlanStoryHookKind[] = ['ambush', 'ritual', 'rescue', 'treasure', 'investigation', 'boss-objective']
export const hazardPool: readonly PlanSpecialFeatureKind[] = ['trap', 'collapsed-passage', 'natural-cave', 'vertical-transition']
export const centralPlaceTags = ['sunken-sanctum', 'cracked-observatory', 'forgotten-forge', 'floodgate', 'elder-grove', 'market-square', 'storm-battered-keep', 'mushroom-throne']
export const sidePlaceTags = ['smuggler-cache', 'collapsed-shrine', 'hunter-camp', 'sealed-vault', 'broken-bridge', 'lost-caravan', 'ritual-clearing', 'buried-watchpost']
export const unusualFeatureTags = ['echoing-chasm', 'living-root-network', 'lava-vent', 'crystal-tide', 'ancient-lift', 'ghost-lights', 'shifting-sand', 'fey-crossing']
