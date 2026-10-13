import { createRandomMap } from '@/maps/randomGenerator'
import { legacyRandomFeaturesFromRequest } from '@/maps/mapGenerationRequestAdapter'
import type { MapDefinition, MapGenerationMetadata } from '@/maps/api'
import { createGraphFirstDungeon } from '@/maps/dungeon-generation'
import { createRegionBasedOutdoorMap } from '@/maps/outdoor-generation'
import type { MapPlan } from './types.js'

/** Selects the pure geometry pipeline appropriate for the semantic plan. */
export const createMapDefinitionFromPlan = (
  plan: MapPlan,
  metadata: MapGenerationMetadata,
): MapDefinition => {
  if (
    plan.theme.mapType === 'dungeon' ||
    plan.theme.mapType === 'cave' ||
    plan.theme.mapType === 'building'
  ) {
    return createGraphFirstDungeon(plan, metadata).map
  }
  if (
    plan.theme.mapType === 'outdoor' ||
    plan.theme.mapType === 'settlement' ||
    plan.theme.mapType === 'island' ||
    plan.theme.mapType === 'coast' ||
    plan.theme.mapType === 'ruins'
  ) {
    return createRegionBasedOutdoorMap(plan, metadata).map
  }
  const features = legacyRandomFeaturesFromRequest({
    mapType: plan.theme.mapType,
    biomes: plan.theme.biomes,
    waterFeatures: plan.theme.waterFeatures,
    themes: plan.theme.settlements,
    atmosphere: plan.theme.atmosphere,
  })
  return {
    ...createRandomMap({
      seed: plan.seed,
      dark: plan.theme.atmosphere === 'dark',
      features,
    }),
    generation: metadata,
  }
}

/** @deprecated Use createMapDefinitionFromPlan; retained for compatibility. */
export const createLegacyMapDefinitionFromPlan = createMapDefinitionFromPlan
