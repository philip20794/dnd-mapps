import {
  MAP_PLAN_SCHEMA_VERSION,
  type MapGenerationRequest,
  type MapPlan,
  type MapPlanSchemaVersion,
} from './types.js'

export class MapGenerationValidationError extends Error {
  public constructor(
    public readonly subject: 'request' | 'plan',
    public readonly messages: readonly string[],
  ) {
    super(
      `${subject === 'request' ? 'Generierungsanfrage' : 'Kartenplan'} ist ungültig:\n${messages.join('\n')}`,
    )
    this.name = 'MapGenerationValidationError'
  }
}

const mapTypes = new Set([
  'outdoor',
  'dungeon',
  'cave',
  'building',
  'settlement',
  'island',
  'coast',
  'ruins',
])
const biomes = new Set([
  'forest',
  'jungle',
  'swamp',
  'plains',
  'desert',
  'snow',
  'volcanic',
  'underground',
  'mushroom',
  'wasteland',
])
const waterPreferences = new Set([
  'none',
  'pond',
  'lake',
  'river',
  'multiple-rivers',
  'coast',
  'flooded',
])
const settlementThemes = new Set([
  'none',
  'ruins',
  'village',
  'town',
  'temple',
  'castle',
  'mine',
  'crypt',
  'fortress',
  'camp',
])
const atmospheres = new Set([
  'normal',
  'dark',
  'abandoned',
  'overgrown',
  'destroyed',
  'magical',
  'cursed',
])
const terrains = new Set(['flat', 'hilly', 'cliffs', 'canyon', 'mixed'])
const requestedFeatures = new Set(['ship'])
const layoutArchetypes = new Set([
  'open-encounter',
  'winding-route',
  'river-crossing',
  'terraced-approach',
  'hub-and-spoke',
  'looping-halls',
  'branching-delves',
  'layered-descent',
  'breached-fortress',
  'flooded-complex',
  'settlement-crossroads',
  'coastal-ring',
])
const connectionStructures = new Set([
  'linear',
  'branching',
  'looped',
  'radial',
  'paired-routes',
  'layered',
  'ring',
])
const mapSizes = new Set(['small', 'medium', 'large', 'huge', 'custom'])
const densities = new Set(['few', 'many'])
const levelKinds = new Set(['surface', 'upper', 'underground', 'submerged'])
const regionKinds = new Set([
  'wilderness',
  'district',
  'dungeon-wing',
  'cavern-system',
  'compound',
  'shore',
  'ruin-zone',
])
const roomRoles = new Set([
  'entry',
  'hall',
  'chamber',
  'corridor',
  'junction',
  'sanctum',
  'boss',
  'treasure',
  'crypt',
  'mine',
  'service',
  'secret',
])
const areaKinds = new Set([
  'clearing',
  'courtyard',
  'camp',
  'plaza',
  'roadside',
  'bridgehead',
  'beach',
  'islet',
  'shoreline',
  'cavern',
  'flooded-area',
])
const scales = new Set(['tiny', 'small', 'medium', 'large', 'vast'])
const connectionKinds = new Set([
  'door',
  'corridor',
  'tunnel',
  'path',
  'bridge',
  'stairs',
  'ladder',
  'portal',
])
const entranceKinds = new Set([
  'road',
  'gate',
  'door',
  'cave-mouth',
  'shore',
  'stairs',
  'ladder',
  'portal',
])
const landmarkKinds = new Set([
  'altar',
  'statue',
  'tower',
  'tree',
  'well',
  'bridge',
  'wreck',
  'monolith',
  'bonfire',
])
const importance = new Set(['minor', 'major', 'focal'])
const pathKinds = new Set(['road', 'trail', 'riverbank', 'tunnel-route', 'stairs'])
const waterFeatureKinds = new Set([
  'pond',
  'lake',
  'river',
  'multiple-rivers',
  'coast',
  'flooded',
  'waterfall',
])
const specialFeatureKinds = new Set([
  'secret-room',
  'trap',
  'vertical-transition',
  'large-hall',
  'boss-objective',
  'natural-cave',
  'collapsed-passage',
])
const storyHookKinds = new Set([
  'ambush',
  'ritual',
  'rescue',
  'treasure',
  'investigation',
  'boss-objective',
])
const sceneFeatureKinds = new Set([
  'abandoned-caravan',
  'grave-site',
  'logging-site',
  'ritual-site',
  'spider-nest',
  'watch-camp',
  'battlefield',
  'market',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const validateOptionalEnum = (
  errors: string[],
  value: unknown,
  values: ReadonlySet<string>,
  label: string,
): void => {
  if (value !== undefined && (typeof value !== 'string' || !values.has(value))) {
    errors.push(`${label} ist ungültig.`)
  }
}

const validateOptionalPositiveInteger = (errors: string[], value: unknown, label: string): void => {
  if (value !== undefined && (!Number.isInteger(value) || (value as number) < 1)) {
    errors.push(`${label} muss eine positive ganze Zahl sein.`)
  }
}

export const validateMapGenerationRequest = (value: unknown): readonly string[] => {
  const errors: string[] = []
  if (!isRecord(value)) {
    return ['Generierungsanfrage muss ein Objekt sein.']
  }

  if (value.seed !== undefined && !Number.isInteger(value.seed))
    errors.push('seed muss eine ganze Zahl sein.')
  if (value.description !== undefined && typeof value.description !== 'string')
    errors.push('description muss ein Text sein.')
  if (value.aiEnabled !== undefined && typeof value.aiEnabled !== 'boolean')
    errors.push('aiEnabled muss true oder false sein.')
  validateOptionalEnum(errors, value.mapType, mapTypes, 'mapType')
  if (value.biomes !== undefined) {
    if (!Array.isArray(value.biomes)) errors.push('biomes muss ein Array sein.')
    else value.biomes.forEach((biome) => validateOptionalEnum(errors, biome, biomes, 'biomes'))
  }
  validateOptionalEnum(errors, value.biome, biomes, 'biome')
  if (value.waterFeatures !== undefined) {
    if (!Array.isArray(value.waterFeatures)) errors.push('waterFeatures muss ein Array sein.')
    else
      value.waterFeatures.forEach((water) =>
        validateOptionalEnum(errors, water, waterPreferences, 'waterFeatures'),
      )
  }
  validateOptionalEnum(errors, value.water, waterPreferences, 'water')
  if (value.themes !== undefined) {
    if (!Array.isArray(value.themes)) errors.push('themes muss ein Array sein.')
    else
      value.themes.forEach((theme) =>
        validateOptionalEnum(errors, theme, settlementThemes, 'themes'),
      )
  }
  validateOptionalEnum(errors, value.theme, settlementThemes, 'theme')
  if (value.features !== undefined) {
    if (!Array.isArray(value.features)) errors.push('features muss ein Array sein.')
    else
      value.features.forEach((feature) =>
        validateOptionalEnum(errors, feature, requestedFeatures, 'features'),
      )
  }
  validateOptionalEnum(errors, value.atmosphere, atmospheres, 'atmosphere')
  validateOptionalEnum(errors, value.terrain, terrains, 'terrain')
  validateOptionalEnum(errors, value.size, mapSizes, 'size')
  validateOptionalPositiveInteger(errors, value.width, 'width')
  validateOptionalPositiveInteger(errors, value.height, 'height')

  if (value.dungeon !== undefined) {
    if (!isRecord(value.dungeon)) {
      errors.push('dungeon muss ein Objekt sein.')
    } else {
      validateOptionalPositiveInteger(errors, value.dungeon.roomCount, 'dungeon.roomCount')
      validateOptionalPositiveInteger(errors, value.dungeon.levelCount, 'dungeon.levelCount')
      validateOptionalEnum(errors, value.dungeon.loops, densities, 'dungeon.loops')
      validateOptionalEnum(errors, value.dungeon.deadEnds, densities, 'dungeon.deadEnds')
      if (value.dungeon.secretRooms !== undefined && typeof value.dungeon.secretRooms !== 'boolean')
        errors.push('dungeon.secretRooms muss true oder false sein.')
      validateOptionalPositiveInteger(errors, value.dungeon.entranceCount, 'dungeon.entranceCount')
      if (value.dungeon.largeHalls !== undefined && typeof value.dungeon.largeHalls !== 'boolean')
        errors.push('dungeon.largeHalls muss true oder false sein.')
      if (value.dungeon.bossRoom !== undefined && typeof value.dungeon.bossRoom !== 'boolean')
        errors.push('dungeon.bossRoom muss true oder false sein.')
      if (
        value.dungeon.naturalCaveRatio !== undefined &&
        (!isFiniteNumber(value.dungeon.naturalCaveRatio) ||
          value.dungeon.naturalCaveRatio < 0 ||
          value.dungeon.naturalCaveRatio > 1)
      )
        errors.push('dungeon.naturalCaveRatio muss zwischen 0 und 1 liegen.')
    }
  }
  return errors
}

export const parseMapGenerationRequest = (value: unknown): MapGenerationRequest => {
  const errors = validateMapGenerationRequest(value)
  if (errors.length > 0) throw new MapGenerationValidationError('request', errors)
  return value as MapGenerationRequest
}

const arrayOfRecords = (
  value: unknown,
  label: string,
  errors: string[],
): readonly Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    errors.push(`${label} muss ein Array von Objekten sein.`)
    return []
  }
  return value
}

const validateEntityIds = (
  entities: readonly Record<string, unknown>[],
  label: string,
  ids: Set<string>,
  errors: string[],
): void => {
  for (const entity of entities) {
    if (!isNonEmptyString(entity.id)) {
      errors.push(`${label} enthält eine ungültige ID.`)
    } else if (ids.has(entity.id)) {
      errors.push(`ID "${entity.id}" ist mehrfach vergeben.`)
    } else {
      ids.add(entity.id)
    }
  }
}

const validateReference = (
  errors: string[],
  value: unknown,
  knownIds: ReadonlySet<string>,
  label: string,
): void => {
  if (!isNonEmptyString(value) || !knownIds.has(value))
    errors.push(`${label} referenziert kein bekanntes Element.`)
}

const validateKind = (
  errors: string[],
  value: unknown,
  values: ReadonlySet<string>,
  label: string,
): void => {
  if (typeof value !== 'string' || !values.has(value)) errors.push(`${label} ist ungültig.`)
}

export const validateMapPlan = (value: unknown): readonly string[] => {
  const errors: string[] = []
  if (!isRecord(value)) return ['Kartenplan muss ein Objekt sein.']
  if (value.schemaVersion !== MAP_PLAN_SCHEMA_VERSION)
    errors.push(`schemaVersion muss ${MAP_PLAN_SCHEMA_VERSION} sein.`)
  if (!isNonEmptyString(value.id)) errors.push('id fehlt.')
  if (!isNonEmptyString(value.name)) errors.push('name fehlt.')
  if (!Number.isInteger(value.seed)) errors.push('seed muss eine ganze Zahl sein.')
  if (value.brief !== undefined && typeof value.brief !== 'string') errors.push('brief muss ein Text sein.')

  if (!isRecord(value.dimensions)) {
    errors.push('dimensions muss ein Objekt sein.')
  } else {
    validateOptionalPositiveInteger(errors, value.dimensions.width, 'dimensions.width')
    validateOptionalPositiveInteger(errors, value.dimensions.height, 'dimensions.height')
    validateKind(errors, value.dimensions.size, mapSizes, 'dimensions.size')
  }
  if (!isRecord(value.theme)) {
    errors.push('theme muss ein Objekt sein.')
  } else {
    validateKind(errors, value.theme.mapType, mapTypes, 'theme.mapType')
    validateKind(errors, value.theme.biome, biomes, 'theme.biome')
    validateKind(errors, value.theme.water, waterPreferences, 'theme.water')
    validateKind(errors, value.theme.settlement, settlementThemes, 'theme.settlement')
    validateKind(errors, value.theme.atmosphere, atmospheres, 'theme.atmosphere')
    validateKind(errors, value.theme.terrain, terrains, 'theme.terrain')
    const validateThemeList = (
      list: unknown,
      values: ReadonlySet<string>,
      label: string,
    ): void => {
      if (!Array.isArray(list) || !list.every((entry) => typeof entry === 'string' && values.has(entry))) {
        errors.push(`${label} muss ein gültiges Array sein.`)
      }
    }
    validateThemeList(value.theme.biomes, biomes, 'theme.biomes')
    validateThemeList(value.theme.waterFeatures, waterPreferences, 'theme.waterFeatures')
    validateThemeList(value.theme.settlements, settlementThemes, 'theme.settlements')
  }
  if (!isRecord(value.layout)) {
    errors.push('layout muss ein Objekt sein.')
  } else {
    validateKind(errors, value.layout.archetype, layoutArchetypes, 'layout.archetype')
    validateKind(
      errors,
      value.layout.connectionStructure,
      connectionStructures,
      'layout.connectionStructure',
    )
  }

  const levels = arrayOfRecords(value.levels, 'levels', errors)
  const regions = arrayOfRecords(value.regions, 'regions', errors)
  const rooms = arrayOfRecords(value.rooms, 'rooms', errors)
  const areas = arrayOfRecords(value.areas, 'areas', errors)
  const connections = arrayOfRecords(value.connections, 'connections', errors)
  const entrances = arrayOfRecords(value.entrances, 'entrances', errors)
  const landmarks = arrayOfRecords(value.landmarks, 'landmarks', errors)
  const paths = arrayOfRecords(value.paths, 'paths', errors)
  const waterFeatures = arrayOfRecords(value.waterFeatures, 'waterFeatures', errors)
  const specialFeatures = arrayOfRecords(value.specialFeatures, 'specialFeatures', errors)
  const storyHooks = arrayOfRecords(value.storyHooks, 'storyHooks', errors)
  const sceneFeatures = arrayOfRecords(value.sceneFeatures, 'sceneFeatures', errors)

  if (levels.length === 0) errors.push('levels muss mindestens eine Ebene enthalten.')
  const allIds = new Set<string>()
  for (const [label, entities] of [
    ['levels', levels],
    ['regions', regions],
    ['rooms', rooms],
    ['areas', areas],
    ['connections', connections],
    ['entrances', entrances],
    ['landmarks', landmarks],
    ['paths', paths],
    ['waterFeatures', waterFeatures],
    ['specialFeatures', specialFeatures],
    ['storyHooks', storyHooks],
    ['sceneFeatures', sceneFeatures],
  ] as const)
    validateEntityIds(entities, label, allIds, errors)

  const levelIds = new Set(levels.map((level) => level.id).filter(isNonEmptyString))
  const nodeIds = new Set(
    [...regions, ...rooms, ...areas].map((node) => node.id).filter(isNonEmptyString),
  )
  for (const level of levels) {
    if (!isNonEmptyString(level.name)) errors.push('Eine Ebene hat keinen Namen.')
    if (!Number.isInteger(level.order) || (level.order as number) < 0)
      errors.push('level.order muss eine nichtnegative ganze Zahl sein.')
    if (!isFiniteNumber(level.elevation))
      errors.push('level.elevation muss eine endliche Zahl sein.')
    validateKind(errors, level.kind, levelKinds, 'level.kind')
  }
  for (const region of regions) {
    validateReference(errors, region.levelId, levelIds, 'region.levelId')
    validateKind(errors, region.kind, regionKinds, 'region.kind')
    validateKind(errors, region.size, scales, 'region.size')
  }
  for (const room of rooms) {
    validateReference(errors, room.levelId, levelIds, 'room.levelId')
    if (room.regionId !== undefined)
      validateReference(
        errors,
        room.regionId,
        new Set(regions.map((region) => region.id).filter(isNonEmptyString)),
        'room.regionId',
      )
    validateKind(errors, room.role, roomRoles, 'room.role')
    validateKind(errors, room.size, scales, 'room.size')
  }
  for (const area of areas) {
    validateReference(errors, area.levelId, levelIds, 'area.levelId')
    if (area.regionId !== undefined)
      validateReference(
        errors,
        area.regionId,
        new Set(regions.map((region) => region.id).filter(isNonEmptyString)),
        'area.regionId',
      )
    validateKind(errors, area.kind, areaKinds, 'area.kind')
    validateKind(errors, area.size, scales, 'area.size')
  }
  for (const connection of connections) {
    validateReference(errors, connection.fromId, nodeIds, 'connection.fromId')
    validateReference(errors, connection.toId, nodeIds, 'connection.toId')
    validateKind(errors, connection.kind, connectionKinds, 'connection.kind')
  }
  for (const entrance of entrances) {
    validateReference(errors, entrance.targetId, nodeIds, 'entrance.targetId')
    validateReference(errors, entrance.levelId, levelIds, 'entrance.levelId')
    validateKind(errors, entrance.kind, entranceKinds, 'entrance.kind')
  }
  for (const landmark of landmarks) {
    validateReference(errors, landmark.targetId, nodeIds, 'landmark.targetId')
    validateKind(errors, landmark.kind, landmarkKinds, 'landmark.kind')
    validateKind(errors, landmark.importance, importance, 'landmark.importance')
  }
  for (const path of paths) {
    validateReference(errors, path.fromId, nodeIds, 'path.fromId')
    validateReference(errors, path.toId, nodeIds, 'path.toId')
    validateKind(errors, path.kind, pathKinds, 'path.kind')
    validateKind(errors, path.importance, importance, 'path.importance')
  }
  for (const feature of waterFeatures) {
    if (feature.targetId !== undefined)
      validateReference(errors, feature.targetId, nodeIds, 'waterFeature.targetId')
    validateReference(errors, feature.levelId, levelIds, 'waterFeature.levelId')
    validateKind(errors, feature.kind, waterFeatureKinds, 'waterFeature.kind')
  }
  for (const feature of specialFeatures) {
    if (feature.targetId !== undefined)
      validateReference(errors, feature.targetId, nodeIds, 'specialFeature.targetId')
    validateKind(errors, feature.kind, specialFeatureKinds, 'specialFeature.kind')
  }
  for (const hook of storyHooks) {
    validateReference(errors, hook.targetId, nodeIds, 'storyHook.targetId')
    validateKind(errors, hook.kind, storyHookKinds, 'storyHook.kind')
  }
  for (const feature of sceneFeatures) {
    validateReference(errors, feature.targetId, nodeIds, 'sceneFeature.targetId')
    validateKind(errors, feature.kind, sceneFeatureKinds, 'sceneFeature.kind')
  }

  if (!isRecord(value.startArea)) {
    errors.push('startArea muss ein Objekt sein.')
  } else {
    validateReference(errors, value.startArea.targetId, nodeIds, 'startArea.targetId')
    validateReference(errors, value.startArea.levelId, levelIds, 'startArea.levelId')
    if (value.startArea.entranceId !== undefined)
      validateReference(
        errors,
        value.startArea.entranceId,
        new Set(entrances.map((entrance) => entrance.id).filter(isNonEmptyString)),
        'startArea.entranceId',
      )
  }
  return errors
}

export const parseMapPlan = (value: unknown): MapPlan => {
  const errors = validateMapPlan(value)
  if (errors.length > 0) throw new MapGenerationValidationError('plan', errors)
  return value as MapPlan
}

export const isMapPlan = (value: unknown): value is MapPlan => validateMapPlan(value).length === 0

export const createMapPlan = <TPlan extends MapPlan>(plan: TPlan): TPlan => {
  const errors = validateMapPlan(plan)
  if (errors.length > 0) throw new MapGenerationValidationError('plan', errors)
  return plan
}

export const mapPlanSchemaVersion = (): MapPlanSchemaVersion => MAP_PLAN_SCHEMA_VERSION
