const unique = (values) => [...new Set(values)];
const selected = (values, single) => unique([...(values ?? []), ...(single === undefined ? [] : [single])]);
export const defaultMapGenerationRequest = {
    seed: 1,
    aiEnabled: false,
    mapType: 'outdoor',
    biomes: [],
    biome: 'plains',
    waterFeatures: [],
    water: 'none',
    themes: [],
    theme: 'none',
    features: [],
    atmosphere: 'normal',
    terrain: 'flat',
    size: 'medium',
    width: 36,
    height: 30,
    dungeon: {
        roomCount: 8,
        levelCount: 1,
        loops: 'few',
        deadEnds: 'few',
        secretRooms: false,
        entranceCount: 1,
        largeHalls: false,
        bossRoom: false,
        naturalCaveRatio: 0,
    },
};
const dimensionsBySize = {
    small: { width: 24, height: 18 },
    medium: { width: 36, height: 30 },
    large: { width: 52, height: 42 },
    huge: { width: 80, height: 64 },
    custom: { width: defaultMapGenerationRequest.width, height: defaultMapGenerationRequest.height },
};
const resolveDimensions = (request, size) => {
    const fallback = dimensionsBySize[size];
    return {
        width: request.width ?? fallback.width,
        height: request.height ?? fallback.height,
    };
};
/** Applies stable planner defaults without generating randomness. */
export const resolveMapGenerationRequest = (request = {}) => {
    const size = request.size ?? defaultMapGenerationRequest.size;
    const biomes = selected(request.biomes, request.biome);
    const waterFeatures = selected(request.waterFeatures, request.water).filter((feature) => feature !== 'none');
    const themes = selected(request.themes, request.theme).filter((theme) => theme !== 'none');
    const features = [...new Set(request.features ?? [])];
    return {
        seed: request.seed ?? defaultMapGenerationRequest.seed,
        description: request.description?.trim() || undefined,
        aiEnabled: request.aiEnabled ?? defaultMapGenerationRequest.aiEnabled,
        mapType: request.mapType ?? defaultMapGenerationRequest.mapType,
        biomes,
        biome: biomes[0] ?? defaultMapGenerationRequest.biome,
        waterFeatures,
        water: waterFeatures[0] ?? defaultMapGenerationRequest.water,
        themes,
        theme: themes[0] ?? defaultMapGenerationRequest.theme,
        features,
        atmosphere: request.atmosphere ?? defaultMapGenerationRequest.atmosphere,
        terrain: request.terrain ?? defaultMapGenerationRequest.terrain,
        size,
        ...resolveDimensions(request, size),
        dungeon: {
            ...defaultMapGenerationRequest.dungeon,
            ...request.dungeon,
        },
    };
};
//# sourceMappingURL=defaults.js.map