import { validateMapPlan } from '../../src/map-generation/validation.js'
import type { MapGenerationRequest, MapPlan } from '../../src/map-generation/types.js'
import type { AiPlanInspiration } from './contracts.js'

const missing = <T>(actual: readonly T[], expected: readonly T[]): T[] =>
  expected.filter((value) => !actual.includes(value))

export const validateAiPlan = (
  candidate: unknown,
  request: MapGenerationRequest,
  inspiration?: AiPlanInspiration,
): readonly string[] => {
  const schemaErrors = validateMapPlan(candidate)
  if (schemaErrors.length > 0) return schemaErrors.slice(0, 12)
  const plan = candidate as MapPlan
  const errors: string[] = []
  if (plan.seed !== request.seed) errors.push(`seed muss ${request.seed} sein.`)
  if (request.description?.trim() && !plan.brief?.toLocaleLowerCase('de-DE').includes(request.description.trim().toLocaleLowerCase('de-DE')))
    errors.push('Die Nutzerbeschreibung muss vollständig im brief erhalten bleiben.')
  if (request.mapType && plan.theme.mapType !== request.mapType)
    errors.push(`mapType muss ${request.mapType} sein.`)
  for (const biome of missing(plan.theme.biomes, request.biomes ?? []))
    errors.push(`Biome ${biome} fehlt.`)
  const expectedWater = (request.waterFeatures ?? []).filter((water) => water !== 'none')
  for (const water of missing(plan.theme.waterFeatures, expectedWater))
    errors.push(`Wassermerkmal ${water} fehlt.`)
  if (request.waterFeatures?.includes('none') && plan.theme.waterFeatures.length > 0)
    errors.push('Es darf kein Wassermerkmal geplant werden.')
  for (const theme of missing(plan.theme.settlements, request.themes ?? []))
    if (theme !== 'none') errors.push(`Thema ${theme} fehlt.`)
  if (request.atmosphere && plan.theme.atmosphere !== request.atmosphere)
    errors.push(`Atmosphäre muss ${request.atmosphere} sein.`)
  if (request.terrain && plan.theme.terrain !== request.terrain)
    errors.push(`Gelände muss ${request.terrain} sein.`)
  if (request.size && plan.dimensions.size !== request.size) errors.push(`Größe muss ${request.size} sein.`)
  if (request.width && plan.dimensions.width !== request.width) errors.push(`Breite muss ${request.width} sein.`)
  if (request.height && plan.dimensions.height !== request.height) errors.push(`Höhe muss ${request.height} sein.`)
  if (request.dungeon?.levelCount && plan.levels.length !== request.dungeon.levelCount)
    errors.push(`Ebenenanzahl muss ${request.dungeon.levelCount} sein.`)
  if (request.dungeon?.entranceCount && plan.entrances.length !== request.dungeon.entranceCount)
    errors.push(`Eingangsanzahl muss ${request.dungeon.entranceCount} sein.`)
  if (request.dungeon?.roomCount) {
    const minimum = Math.max(1, Math.floor(request.dungeon.roomCount * 0.75))
    const maximum = Math.ceil(request.dungeon.roomCount * 1.25)
    if (plan.rooms.length < minimum || plan.rooms.length > maximum)
      errors.push(`Raumanzahl muss ungefähr ${request.dungeon.roomCount} sein.`)
  }
  const specialKinds = plan.specialFeatures.map((feature) => feature.kind)
  if (request.dungeon?.secretRooms && !specialKinds.includes('secret-room')) errors.push('Geheimraum fehlt.')
  if (request.dungeon?.largeHalls && !specialKinds.includes('large-hall')) errors.push('Große Halle fehlt.')
  if (request.dungeon?.bossRoom && !specialKinds.includes('boss-objective')) errors.push('Boss-/Zielraum fehlt.')
  if ((request.dungeon?.naturalCaveRatio ?? 0) > 0 && !specialKinds.includes('natural-cave'))
    errors.push('Natürlicher Höhlenanteil fehlt.')
  if (request.dungeon?.loops === 'many' && !plan.connections.some((connection) => connection.loop))
    errors.push('Mehrere Schleifen wurden nicht berücksichtigt.')

  if (inspiration) {
    if (plan.theme.mapType !== inspiration.mapType) errors.push('Inspirations-Kartentyp fehlt.')
    for (const biome of missing(plan.theme.biomes, inspiration.environment))
      errors.push(`Inspirations-Umgebung ${biome} fehlt.`)
    if (plan.layout.archetype !== inspiration.layoutArchetype) errors.push('Inspirations-Layout fehlt.')
    if (plan.layout.connectionStructure !== inspiration.structure) errors.push('Inspirations-Struktur fehlt.')
    if (plan.theme.atmosphere !== inspiration.condition) errors.push('Inspirations-Zustand fehlt.')
    if (plan.theme.terrain !== inspiration.specialTerrain) errors.push('Inspirations-Gelände fehlt.')
    if (!plan.landmarks.some((landmark) => landmark.kind === inspiration.landmark))
      errors.push('Inspirations-Landmarke fehlt.')
    const tags = [...plan.regions, ...plan.rooms, ...plan.areas].flatMap((node) => node.tags ?? [])
    if (
      inspiration.mainTheme !== 'none' &&
      !plan.theme.settlements.includes(inspiration.mainTheme as MapPlan['theme']['settlement']) &&
      !tags.includes(inspiration.mainTheme)
    )
      errors.push('Inspirations-Hauptthema fehlt.')
    if (inspiration.water !== 'none' && !plan.theme.waterFeatures.includes(inspiration.water as MapPlan['theme']['water']))
      errors.push('Inspirations-Wassermerkmal fehlt.')
    if (!tags.includes(inspiration.unusualFeature)) errors.push('Ungewöhnliches Inspirationsmerkmal fehlt.')
  }
  return errors.slice(0, 16)
}
