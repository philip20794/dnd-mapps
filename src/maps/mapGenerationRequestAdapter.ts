import { normalizeMapGenerationRequest, type MapGenerationRequest } from '@/map-generation'
import { normalizeRandomMapFeatures, type RandomMapFeature } from './randomGenerator'

const add = (features: Set<RandomMapFeature>, ...values: readonly RandomMapFeature[]): void => {
  values.forEach((value) => features.add(value))
}

/**
 * Temporary bridge while the existing generator still accepts legacy features.
 * New UI code stores MapGenerationRequest; future planners replace this adapter.
 */
export const legacyRandomFeaturesFromRequest = (
  input: MapGenerationRequest,
): readonly RandomMapFeature[] => {
  const request = normalizeMapGenerationRequest(input)
  const features = new Set<RandomMapFeature>()
  const outdoorType =
    request.mapType === 'outdoor' ||
    request.mapType === 'settlement' ||
    request.mapType === 'island' ||
    request.mapType === 'coast'

  switch (request.mapType) {
    case 'dungeon':
    case 'cave':
    case 'building':
      add(features, 'dungeon')
      break
    case 'outdoor':
    case 'settlement':
      add(features, 'outdoor')
      break
    case 'island':
    case 'coast':
      add(features, 'outdoor', 'water')
      break
    case 'ruins':
      add(features, 'ruins')
      break
    default:
      break
  }

  for (const biome of request.biomes ?? []) {
    if (biome === 'forest' || biome === 'jungle') add(features, 'forest')
    if (biome === 'swamp') add(features, 'swamp')
    if (biome === 'desert') add(features, 'desert')
    if (biome === 'snow') add(features, 'snow')
    if ((biome === 'underground' || biome === 'mushroom') && !outdoorType) add(features, 'dungeon')
    if (biome === 'wasteland') add(features, 'ruins')
  }

  for (const water of request.waterFeatures ?? []) {
    if (water === 'river' || water === 'multiple-rivers') add(features, 'river', 'water')
    if (water === 'pond' || water === 'lake' || water === 'flooded') add(features, 'water')
    if (water === 'coast') add(features, 'outdoor', 'water')
  }

  for (const theme of request.themes ?? []) {
    if (theme === 'ruins') add(features, 'ruins')
    if (theme === 'village' || theme === 'town') add(features, 'settlement')
    if (theme === 'temple' || theme === 'mine' || theme === 'crypt') {
      add(features, outdoorType ? 'ruins' : 'dungeon')
    }
    if (theme === 'castle' || theme === 'fortress') add(features, 'settlement', 'ruins')
  }

  if (request.features?.includes('ship')) add(features, 'ship')

  if (request.atmosphere === 'dark') add(features, 'dark')
  return normalizeRandomMapFeatures([...features])
}
