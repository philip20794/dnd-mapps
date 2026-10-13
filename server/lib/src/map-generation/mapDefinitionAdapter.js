import { createRandomMap } from '@/maps/randomGenerator';
import { legacyRandomFeaturesFromRequest } from '@/maps/mapGenerationRequestAdapter';
/**
 * Transitional MapPlan -> MapDefinition bridge. It deliberately uses the
 * established generator until a real geometry/materials pipeline exists.
 */
export const createLegacyMapDefinitionFromPlan = (plan, metadata) => {
    const features = legacyRandomFeaturesFromRequest({
        mapType: plan.theme.mapType,
        biomes: plan.theme.biomes,
        waterFeatures: plan.theme.waterFeatures,
        themes: plan.theme.settlements,
        atmosphere: plan.theme.atmosphere,
    });
    return {
        ...createRandomMap({
            seed: plan.seed,
            dark: plan.theme.atmosphere === 'dark',
            features,
        }),
        generation: metadata,
    };
};
//# sourceMappingURL=mapDefinitionAdapter.js.map