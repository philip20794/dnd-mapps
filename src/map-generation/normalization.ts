import type { MapGenerationRequest, WaterPreference } from './types.js'

const unique = <TValue>(values: readonly TValue[]): readonly TValue[] => [...new Set(values)]

const selected = <TValue>(
  values: readonly TValue[] | undefined,
  single: TValue | undefined,
): readonly TValue[] => unique([...(values ?? []), ...(single === undefined ? [] : [single])])

/**
 * Keeps requests compact while encoding only unambiguous dependencies. The
 * planner remains responsible for completing all unspecified decisions.
 */
export const normalizeMapGenerationRequest = (
  request: MapGenerationRequest,
): MapGenerationRequest => {
  const biomes = selected(request.biomes, request.biome)
  const themes = selected(request.themes, request.theme).filter((theme) => theme !== 'none')
  const features = unique(request.features ?? [])
  const waterFeatures = selected(request.waterFeatures, request.water).filter(
    (feature) => feature !== 'none',
  ) as readonly WaterPreference[]

  return {
    ...request,
    ...(biomes.length === 0 ? { biomes: undefined } : { biomes }),
    ...(themes.length === 0 ? { themes: undefined } : { themes }),
    ...(features.length === 0 ? { features: undefined } : { features }),
    ...(waterFeatures.length === 0 ? { waterFeatures: undefined } : { waterFeatures }),
    biome: undefined,
    theme: undefined,
    water: undefined,
  }
}
