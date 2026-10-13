const unique = (values) => [...new Set(values)];
const selected = (values, single) => unique([...(values ?? []), ...(single === undefined ? [] : [single])]);
/**
 * Keeps requests compact while encoding only unambiguous dependencies. The
 * planner remains responsible for completing all unspecified decisions.
 */
export const normalizeMapGenerationRequest = (request) => {
    const biomes = selected(request.biomes, request.biome);
    const themes = selected(request.themes, request.theme).filter((theme) => theme !== 'none');
    const features = unique(request.features ?? []);
    const waterFeatures = selected(request.waterFeatures, request.water).filter((feature) => feature !== 'none');
    return {
        ...request,
        ...(biomes.length === 0 ? { biomes: undefined } : { biomes }),
        ...(themes.length === 0 ? { themes: undefined } : { themes }),
        ...(features.length === 0 ? { features: undefined } : { features }),
        ...(waterFeatures.length === 0 ? { waterFeatures: undefined } : { waterFeatures }),
        biome: undefined,
        theme: undefined,
        water: undefined,
    };
};
//# sourceMappingURL=normalization.js.map