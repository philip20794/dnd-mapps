import { normalizeMapGenerationRequest } from './normalization.js'
import {
  atmospheres, biomes, connectionStructures, dungeonArchetypes, hazardPool, landmarkPool,
  mapTypes, scenePool, settlements, settlementArchetypes, sidePlaceTags, storyPool,
  terrains, unusualFeatureTags, waters, wildernessArchetypes, centralPlaceTags,
} from './plannerPools.js'
import { chance, createMapGenerationSeed, createSeededRandom, integer, pick, type Random } from './random.js'
import { createMapPlan, parseMapGenerationRequest } from './validation.js'
import { MAP_PLAN_SCHEMA_VERSION, type Biome, type MapGenerationRequest, type MapPlan, type MapPlanner, type MapSize, type MapType, type PlanArea, type PlanConnection, type PlanEntranceKind, type PlanLevel, type PlanRegion, type PlanRegionKind, type PlanRoom, type SettlementTheme, type WaterPreference } from './types.js'

const indoorTypes = new Set<MapType>(['dungeon', 'cave', 'building'])
const undergroundBiomes = new Set<Biome>(['underground', 'mushroom'])

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]
type PlannableWater = Exclude<WaterPreference, 'none'>

const dimensionsFor = (size: MapSize, random: Random): { width: number; height: number } => {
  const ranges: Record<MapSize, readonly [number, number, number, number]> = {
    small: [22, 30, 18, 24], medium: [34, 46, 28, 38], large: [50, 68, 40, 54], huge: [76, 100, 60, 82], custom: [36, 52, 30, 42],
  }
  const [minWidth, maxWidth, minHeight, maxHeight] = ranges[size]
  return { width: integer(random, minWidth, maxWidth), height: integer(random, minHeight, maxHeight) }
}

const regionKinds: Readonly<Record<MapType, PlanRegionKind>> = {
  outdoor: 'wilderness', dungeon: 'dungeon-wing', cave: 'cavern-system', building: 'compound', settlement: 'district', island: 'shore', coast: 'shore', ruins: 'ruin-zone',
}

const regionKindFor = (mapType: MapType): PlanRegionKind => regionKinds[mapType]

const levelKindFor = (mapType: MapType, order: number): PlanLevel['kind'] => {
  if (mapType === 'dungeon' || mapType === 'cave') return order === 0 ? 'underground' : 'submerged'
  if (mapType === 'building' && order > 0) return 'upper'
  return 'surface'
}

const archetypeFor = (mapType: MapType, water: readonly WaterPreference[], random: Random) => {
  if (water.includes('flooded')) return 'flooded-complex' as const
  if (water.includes('river') || water.includes('multiple-rivers')) return 'river-crossing' as const
  if (mapType === 'coast' || mapType === 'island') return 'coastal-ring' as const
  if (indoorTypes.has(mapType)) return pick(random, dungeonArchetypes)
  if (mapType === 'settlement') return pick(random, settlementArchetypes)
  return pick(random, wildernessArchetypes)
}

const connectionStructureFor = (request: MapGenerationRequest, random: Random) => {
  if (request.dungeon?.loops === 'many') return 'looped' as const
  if (request.dungeon?.deadEnds === 'many') return 'branching' as const
  if ((request.dungeon?.levelCount ?? 1) > 1) return 'layered' as const
  return pick(random, connectionStructures)
}

const roomRoleFor = (index: number, total: number, theme: SettlementTheme, request: MapGenerationRequest): PlanRoom['role'] => {
  if (index === 0) return 'entry'
  if (request.dungeon?.bossRoom && index === total - 1) return 'boss'
  if (theme === 'mine') return index % 3 === 0 ? 'mine' : 'chamber'
  if (theme === 'crypt') return index % 3 === 0 ? 'crypt' : 'chamber'
  if (theme === 'temple') return index === total - 1 ? 'sanctum' : 'hall'
  return index % 4 === 0 ? 'junction' : index % 3 === 0 ? 'corridor' : 'chamber'
}

/** Pure local planner; it deliberately emits no MapDefinition or rendering data. */
export class LocalMapPlanner implements MapPlanner {
  plan(input: MapGenerationRequest = {}): MapPlan {
    const request = normalizeMapGenerationRequest(parseMapGenerationRequest(input))
    const explicitlyNoWater = input.water === 'none' || input.waterFeatures?.includes('none') === true
    const explicitlyNoSettlement = input.theme === 'none' || input.themes?.includes('none') === true
    const seed = request.seed ?? createMapGenerationSeed()
    const random = createSeededRandom(seed)
    const inferredType = request.mapType ?? (request.biomes?.some((biome) => undergroundBiomes.has(biome)) ? pick(random, ['dungeon', 'cave'] as const) : pick(random, mapTypes))
    const mapType = inferredType
    const selectedBiomes = unique(request.biomes ?? [])
    const primaryBiome = selectedBiomes[0] ?? pick(random, mapType === 'dungeon' || mapType === 'cave' ? ['underground', 'mushroom', 'volcanic', 'snow'] : biomes)
    const planBiomes = selectedBiomes.length > 0 ? selectedBiomes : unique([primaryBiome, ...(chance(random, 0.38) ? [pick(random, biomes)] : [])])
    const requestedWater = unique(request.waterFeatures ?? [])
    const planWater: PlannableWater[] = unique([
      ...requestedWater,
      ...((mapType === 'coast' || mapType === 'island') ? ['coast' as const] : []),
      ...(requestedWater.length === 0 && !explicitlyNoWater && chance(random, 0.48) ? [pick(random, waters)] : []),
    ]).filter((water): water is PlannableWater => water !== 'none')
    const selectedThemes = unique(request.themes ?? [])
    const planThemes = selectedThemes.length > 0 ? selectedThemes : (!explicitlyNoSettlement && chance(random, 0.72) ? [pick(random, settlements)] : [])
    const settlement = planThemes[0] ?? 'none'
    const atmosphere = request.atmosphere ?? pick(random, atmospheres)
    const terrain = request.terrain ?? (mapType === 'cave' || mapType === 'dungeon' ? pick(random, ['flat', 'cliffs', 'mixed'] as const) : pick(random, terrains))
    const size = request.size ?? pick(random, ['small', 'medium', 'large', 'huge'] as const)
    const generatedDimensions = dimensionsFor(size, random)
    const dimensions = { width: request.width ?? generatedDimensions.width, height: request.height ?? generatedDimensions.height, size }
    const levelCount = request.dungeon?.levelCount ?? (indoorTypes.has(mapType) && chance(random, 0.28) ? integer(random, 2, 4) : 1)
    const levels: PlanLevel[] = Array.from({ length: levelCount }, (_, order) => ({ id: `level-${order + 1}`, name: order === 0 ? 'Hauptebene' : `Ebene ${order + 1}`, order, elevation: -order * 12, kind: levelKindFor(mapType, order) }))
    const regions: PlanRegion[] = levels.map((level, index) => ({ id: `region-${index + 1}`, levelId: level.id, kind: regionKindFor(mapType), size: size === 'huge' ? 'vast' : size === 'large' ? 'large' : 'medium', tags: [mapType, primaryBiome, pick(random, unusualFeatureTags)] }))
    const rooms: PlanRoom[] = []
    const areas: PlanArea[] = []
    const roomCount = request.dungeon?.roomCount ?? (indoorTypes.has(mapType) || mapType === 'ruins' ? integer(random, 7, 17) : integer(random, 1, 4))
    const isIndoor = indoorTypes.has(mapType) || mapType === 'ruins'
    if (isIndoor) {
      for (let index = 0; index < roomCount; index++) {
        const level = levels[index % levels.length]!
        rooms.push({ id: `room-${index + 1}`, levelId: level.id, regionId: `region-${(index % levels.length) + 1}`, role: roomRoleFor(index, roomCount, settlement, request), size: index === 1 && request.dungeon?.largeHalls ? 'large' : index === roomCount - 1 ? 'large' : 'medium', tags: index === roomCount - 1 ? [pick(random, centralPlaceTags)] : undefined })
      }
    }
    const firstLevel = levels[0]!
    areas.push({ id: 'area-start', levelId: firstLevel.id, regionId: 'region-1', kind: isIndoor ? 'courtyard' : mapType === 'island' ? 'beach' : mapType === 'coast' ? 'shoreline' : mapType === 'settlement' ? 'plaza' : 'clearing', size: 'medium', tags: ['arrival', pick(random, sidePlaceTags)] })
    if (!isIndoor || chance(random, 0.7)) areas.push({ id: 'area-central', levelId: firstLevel.id, regionId: 'region-1', kind: planWater.includes('flooded') ? 'flooded-area' : mapType === 'cave' ? 'cavern' : mapType === 'settlement' ? 'plaza' : 'camp', size: 'large', tags: [pick(random, centralPlaceTags)] })
    const nodes = [...areas, ...rooms]
    const connections: PlanConnection[] = []
    for (let index = 1; index < nodes.length; index++) connections.push({ id: `connection-${index}`, fromId: nodes[index - 1]!.id, toId: nodes[index]!.id, kind: isIndoor ? (mapType === 'cave' ? 'tunnel' : 'corridor') : 'path' })
    const structure = connectionStructureFor(request, random)
    if ((structure === 'looped' || structure === 'ring') && nodes.length > 2) connections.push({ id: 'connection-loop', fromId: nodes[nodes.length - 1]!.id, toId: nodes[0]!.id, kind: isIndoor ? 'tunnel' : 'path', loop: true })
    if (levelCount > 1) for (let index = 1; index < levels.length; index++) connections.push({ id: `connection-level-${index}`, fromId: nodes.find((node) => node.levelId === levels[index - 1]!.id)!.id, toId: nodes.find((node) => node.levelId === levels[index]!.id)!.id, kind: 'stairs' })
    const entranceCount = request.dungeon?.entranceCount ?? integer(random, 1, mapType === 'settlement' || mapType === 'outdoor' ? 3 : 2)
    const entranceKind: PlanEntranceKind = mapType === 'cave' ? 'cave-mouth' : mapType === 'coast' || mapType === 'island' ? 'shore' : isIndoor ? 'door' : 'road'
    const entrances = Array.from({ length: entranceCount }, (_, index) => ({ id: `entrance-${index + 1}`, targetId: index === 0 ? 'area-start' : nodes[index % nodes.length]!.id, kind: entranceKind, levelId: nodes[index % nodes.length]!.levelId }))
    const centralNode = rooms[rooms.length - 1] ?? areas[areas.length - 1]!
    const plan: MapPlan = {
      schemaVersion: MAP_PLAN_SCHEMA_VERSION, id: `local-plan-${seed >>> 0}`, name: `${primaryBiome}-${mapType}-plan`, seed,
      dimensions,
      theme: { mapType, biomes: planBiomes, biome: primaryBiome, waterFeatures: planWater, water: planWater[0] ?? 'none', settlements: planThemes, settlement, atmosphere, terrain },
      layout: { archetype: archetypeFor(mapType, planWater, random), connectionStructure: structure }, brief: request.description?.trim() || undefined,
      levels, regions, rooms, areas, connections, entrances,
      landmarks: [{ id: 'landmark-1', targetId: centralNode.id, kind: pick(random, landmarkPool), importance: 'focal' }],
      paths: nodes.length > 1 ? [{ id: 'path-main', fromId: 'area-start', toId: centralNode.id, kind: isIndoor ? 'tunnel-route' : 'trail', importance: 'major' }] : [],
      waterFeatures: planWater.map((kind, index) => ({ id: `water-${index + 1}`, targetId: index === 0 ? centralNode.id : undefined, kind, levelId: levels[index % levels.length]!.id })),
      specialFeatures: unique([...(request.dungeon?.secretRooms ? ['secret-room' as const] : []), ...(request.dungeon?.largeHalls ? ['large-hall' as const] : []), ...(request.dungeon?.bossRoom ? ['boss-objective' as const] : []), ...(request.dungeon?.naturalCaveRatio && request.dungeon.naturalCaveRatio > 0 ? ['natural-cave' as const] : []), ...(chance(random, 0.58) ? [pick(random, hazardPool)] : [])]).map((kind, index) => ({ id: `special-${index + 1}`, targetId: centralNode.id, kind })),
      startArea: { targetId: 'area-start', levelId: firstLevel.id, entranceId: 'entrance-1' },
      storyHooks: [{ id: 'story-1', targetId: centralNode.id, kind: request.dungeon?.bossRoom ? 'boss-objective' : pick(random, storyPool) }],
      sceneFeatures: [{ id: 'scene-1', targetId: centralNode.id, kind: pick(random, scenePool) }],
    }
    return createMapPlan(plan)
  }
}

export const createLocalMapPlan = (request: MapGenerationRequest = {}): MapPlan => new LocalMapPlanner().plan(request)
