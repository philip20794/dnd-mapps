const stringValue = { type: 'string', minLength: 1 };
const idReference = stringValue;
const scale = { type: 'string', enum: ['tiny', 'small', 'medium', 'large', 'vast'] };
const enumValue = (values) => ({ type: 'string', enum: values });
const tags = { type: 'array', items: stringValue, maxItems: 8 };
const strictObject = (properties) => ({
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
});
const entityArray = (properties, maxItems) => ({
    type: 'array',
    items: strictObject({ id: stringValue, ...properties }),
    maxItems,
});
/** Structural schema for the Responses API; domain validation remains authoritative. */
export const mapPlanJsonSchema = strictObject({
    schemaVersion: { type: 'integer', enum: [1] },
    id: stringValue,
    name: stringValue,
    seed: { type: 'integer' },
    dimensions: strictObject({
        width: { type: 'integer', minimum: 1 },
        height: { type: 'integer', minimum: 1 },
        size: { type: 'string', enum: ['small', 'medium', 'large', 'huge', 'custom'] },
    }),
    theme: strictObject({
        mapType: enumValue(['outdoor', 'dungeon', 'cave', 'building', 'settlement', 'island', 'coast', 'ruins']),
        biomes: { type: 'array', items: enumValue(['forest', 'jungle', 'swamp', 'plains', 'desert', 'snow', 'volcanic', 'underground', 'mushroom', 'wasteland']), maxItems: 4 },
        biome: enumValue(['forest', 'jungle', 'swamp', 'plains', 'desert', 'snow', 'volcanic', 'underground', 'mushroom', 'wasteland']),
        waterFeatures: { type: 'array', items: enumValue(['pond', 'lake', 'river', 'multiple-rivers', 'coast', 'flooded']), maxItems: 4 },
        water: enumValue(['none', 'pond', 'lake', 'river', 'multiple-rivers', 'coast', 'flooded']),
        settlements: { type: 'array', items: enumValue(['ruins', 'village', 'town', 'temple', 'castle', 'mine', 'crypt', 'fortress', 'camp']), maxItems: 4 },
        settlement: enumValue(['none', 'ruins', 'village', 'town', 'temple', 'castle', 'mine', 'crypt', 'fortress', 'camp']),
        atmosphere: enumValue(['normal', 'dark', 'abandoned', 'overgrown', 'destroyed', 'magical', 'cursed']),
        terrain: enumValue(['flat', 'hilly', 'cliffs', 'canyon', 'mixed']),
    }),
    layout: strictObject({
        archetype: enumValue(['open-encounter', 'winding-route', 'river-crossing', 'terraced-approach', 'hub-and-spoke', 'looping-halls', 'branching-delves', 'layered-descent', 'breached-fortress', 'flooded-complex', 'settlement-crossroads', 'coastal-ring']),
        connectionStructure: enumValue(['linear', 'branching', 'looped', 'radial', 'paired-routes', 'layered', 'ring']),
    }),
    brief: { type: 'string' },
    levels: entityArray({
        name: stringValue,
        order: { type: 'integer', minimum: 0 },
        elevation: { type: 'number' },
        kind: enumValue(['surface', 'upper', 'underground', 'submerged']),
    }, 8),
    regions: entityArray({ levelId: idReference, kind: enumValue(['wilderness', 'district', 'dungeon-wing', 'cavern-system', 'compound', 'shore', 'ruin-zone']), size: scale, tags }, 24),
    rooms: entityArray({ levelId: idReference, regionId: idReference, role: enumValue(['entry', 'hall', 'chamber', 'corridor', 'junction', 'sanctum', 'boss', 'treasure', 'crypt', 'mine', 'service', 'secret']), size: scale, tags }, 120),
    areas: entityArray({ levelId: idReference, regionId: idReference, kind: enumValue(['clearing', 'courtyard', 'camp', 'plaza', 'roadside', 'bridgehead', 'beach', 'islet', 'shoreline', 'cavern', 'flooded-area']), size: scale, tags }, 80),
    connections: entityArray({ fromId: idReference, toId: idReference, kind: enumValue(['door', 'corridor', 'tunnel', 'path', 'bridge', 'stairs', 'ladder', 'portal']), secret: { type: 'boolean' }, loop: { type: 'boolean' } }, 240),
    entrances: entityArray({ targetId: idReference, kind: enumValue(['road', 'gate', 'door', 'cave-mouth', 'shore', 'stairs', 'ladder', 'portal']), levelId: idReference }, 16),
    landmarks: entityArray({ targetId: idReference, kind: enumValue(['altar', 'statue', 'tower', 'tree', 'well', 'bridge', 'wreck', 'monolith', 'bonfire']), importance: enumValue(['minor', 'major', 'focal']) }, 24),
    paths: entityArray({ fromId: idReference, toId: idReference, kind: enumValue(['road', 'trail', 'riverbank', 'tunnel-route', 'stairs']), importance: enumValue(['minor', 'major', 'focal']) }, 80),
    waterFeatures: entityArray({ targetId: idReference, kind: enumValue(['pond', 'lake', 'river', 'multiple-rivers', 'coast', 'flooded', 'waterfall']), levelId: idReference }, 16),
    specialFeatures: entityArray({ targetId: idReference, kind: enumValue(['secret-room', 'trap', 'vertical-transition', 'large-hall', 'boss-objective', 'natural-cave', 'collapsed-passage']) }, 32),
    startArea: strictObject({ targetId: idReference, levelId: idReference, entranceId: idReference }),
    storyHooks: entityArray({ targetId: idReference, kind: enumValue(['ambush', 'ritual', 'rescue', 'treasure', 'investigation', 'boss-objective']) }, 16),
    sceneFeatures: entityArray({ targetId: idReference, kind: enumValue(['abandoned-caravan', 'grave-site', 'logging-site', 'ritual-site', 'spider-nest', 'watch-camp', 'battlefield', 'market']) }, 24),
});
//# sourceMappingURL=mapPlanJsonSchema.js.map