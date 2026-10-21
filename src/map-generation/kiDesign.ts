import type {
  Atmosphere, Biome, MapGenerationRequest, MapPlan, MapType, PlanConnectionStructure,
  PlanLandmarkKind, PlanLayoutArchetype, PlanRoomRole, PlanSceneFeatureKind,
  PlanStoryHookKind, SettlementTheme, Terrain, WaterPreference,
} from './types.js'
import { chooseBestLocalPlan } from './quality.js'
import { parseMapPlan } from './validation.js'

export interface KiMapDesign {
  readonly name: string
  readonly brief: string
  readonly mapType: MapType
  readonly biome: Biome
  readonly settlement: SettlementTheme
  readonly water: WaterPreference
  readonly atmosphere: Atmosphere
  readonly terrain: Terrain
  readonly archetype: PlanLayoutArchetype
  readonly structure: PlanConnectionStructure
  readonly landmarkKind: PlanLandmarkKind
  readonly storyHookKind: PlanStoryHookKind
  readonly sceneFeatureKind: PlanSceneFeatureKind
  readonly roomRoles: readonly { readonly id: string; readonly role: PlanRoomRole }[]
}

const allowed = {
  mapType: ['outdoor', 'dungeon', 'cave', 'building', 'settlement', 'island', 'coast', 'ruins'],
  biome: ['forest', 'jungle', 'swamp', 'plains', 'desert', 'snow', 'volcanic', 'underground', 'mushroom', 'wasteland'],
  settlement: ['none', 'ruins', 'village', 'town', 'temple', 'castle', 'mine', 'crypt', 'fortress', 'camp'],
  water: ['none', 'pond', 'lake', 'river', 'multiple-rivers', 'coast', 'flooded'],
  atmosphere: ['normal', 'dark', 'abandoned', 'overgrown', 'destroyed', 'magical', 'cursed'],
  terrain: ['flat', 'hilly', 'cliffs', 'canyon', 'mixed'],
  archetype: ['open-encounter', 'winding-route', 'river-crossing', 'terraced-approach', 'hub-and-spoke', 'looping-halls', 'branching-delves', 'layered-descent', 'breached-fortress', 'flooded-complex', 'settlement-crossroads', 'coastal-ring'],
  structure: ['linear', 'branching', 'looped', 'radial', 'paired-routes', 'layered', 'ring'],
  landmarkKind: ['altar', 'statue', 'tower', 'tree', 'well', 'bridge', 'wreck', 'monolith', 'bonfire'],
  storyHookKind: ['ambush', 'ritual', 'rescue', 'treasure', 'investigation', 'boss-objective'],
  sceneFeatureKind: ['abandoned-caravan', 'grave-site', 'logging-site', 'ritual-site', 'spider-nest', 'watch-camp', 'battlefield', 'market'],
  role: ['entry', 'hall', 'chamber', 'corridor', 'junction', 'sanctum', 'boss', 'treasure', 'crypt', 'mine', 'service', 'secret'],
} as const

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

export const parseKiMapDesign = (input: unknown): KiMapDesign => {
  if (!record(input) || typeof input.name !== 'string' || !input.name.trim() ||
      input.name.length > 120 || typeof input.brief !== 'string' || input.brief.length > 900)
    throw new Error('Invalid KI design text.')
  for (const key of Object.keys(allowed).filter((key) => key !== 'role') as (keyof Omit<typeof allowed, 'role'>)[]) {
    if (typeof input[key] !== 'string' || !(allowed[key] as readonly string[]).includes(input[key] as string))
      throw new Error(`Invalid KI design field: ${key}`)
  }
  if (!Array.isArray(input.roomRoles) || input.roomRoles.length > 12 ||
      !input.roomRoles.every((item: unknown) =>
        record(item) && typeof item.id === 'string' && item.id.length < 80 &&
        typeof item.role === 'string' && (allowed.role as readonly string[]).includes(item.role)))
    throw new Error('Invalid KI room roles.')
  return input as unknown as KiMapDesign
}

/**
 * The model never returns coordinates or MapDefinition. We reconstruct geometry
 * from the local planner and apply only whitelisted semantic choices.
 */
export const applyKiMapDesign = (request: MapGenerationRequest, rawDesign: unknown): MapPlan => {
  const design = parseKiMapDesign(rawDesign)
  const requestedWater = request.water === 'none' || request.waterFeatures?.includes('none')
  const requestedNoSettlement = request.theme === 'none' || request.themes?.includes('none')
  const semanticRequest: MapGenerationRequest = {
    ...request,
    mapType: request.mapType ?? design.mapType,
    ...(!(request.biomes?.length || request.biome) ? { biomes: [design.biome] } : {}),
    ...(!(request.themes?.length || request.theme) ? { themes: design.settlement === 'none' ? [] : [design.settlement] } : {}),
    ...(!(request.waterFeatures?.length || request.water) ? { water: design.water } : {}),
    ...(requestedWater ? { water: 'none', waterFeatures: ['none'] } : {}),
    ...(requestedNoSettlement ? { theme: 'none', themes: ['none'] } : {}),
    atmosphere: request.atmosphere ?? design.atmosphere,
    terrain: request.terrain ?? design.terrain,
  }
  const base = chooseBestLocalPlan(semanticRequest)
  const roles = new Map(design.roomRoles.map((entry) => [entry.id, entry.role]))
  const rooms = base.rooms.map((room, index) => {
    // Never turn the entrance into an isolated room or override explicit boss wishes.
    if (room.role === 'entry' || (request.dungeon?.bossRoom && index === base.rooms.length - 1))
      return room
    return { ...room, role: roles.get(room.id) ?? room.role }
  })
  const requestedStructure = request.dungeon?.loops === 'many' || request.dungeon?.deadEnds === 'many'
  const brief = [request.description?.trim(), design.brief.trim()].filter(Boolean).join(' — ').slice(0, 1200)
  return parseMapPlan({
    ...base,
    name: design.name.trim(),
    brief: brief || base.brief,
    rooms,
    layout: {
      archetype: design.archetype,
      connectionStructure: requestedStructure ? base.layout.connectionStructure : design.structure,
    },
    landmarks: base.landmarks.map((landmark, i) =>
      i === 0 ? { ...landmark, kind: design.landmarkKind } : landmark),
    storyHooks: base.storyHooks.map((hook, i) =>
      i === 0 && !request.dungeon?.bossRoom ? { ...hook, kind: design.storyHookKind } : hook),
    sceneFeatures: base.sceneFeatures.map((scene, i) =>
      i === 0 ? { ...scene, kind: design.sceneFeatureKind } : scene),
  })
}

/** Compact enough for the browser-backed API's 10k character prompt limit. */
export const createKiDesignContext = (plan: MapPlan) => ({
  mapType: plan.theme.mapType,
  biome: plan.theme.biome,
  size: plan.dimensions.size,
  width: plan.dimensions.width,
  height: plan.dimensions.height,
  atmosphere: plan.theme.atmosphere,
  layout: plan.layout,
  rooms: plan.rooms.slice(0, 12).map(({ id, role, size }) => ({ id, role, size })),
  areaCount: plan.areas.length,
  levels: plan.levels.length,
})
