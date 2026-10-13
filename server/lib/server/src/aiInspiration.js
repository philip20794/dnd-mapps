import { createLocalMapPlan } from '../../src/map-generation/localPlanner.js';
import { createMapGenerationSeed } from '../../src/map-generation/random.js';
const includesAny = (text, words) => words.some((word) => text.includes(word));
const hintedValues = (text, entries) => entries.filter(([, words]) => includesAny(text, words)).map(([value]) => value);
export const deriveDescriptionHints = (description) => {
    const text = description?.toLocaleLowerCase('de-DE') ?? '';
    const mapType = hintedValues(text, [
        ['dungeon', ['dungeon', 'verlies']], ['cave', ['höhle', 'hoehle', 'cave']],
        ['building', ['gebäude', 'gebaeude', 'building']], ['settlement', ['siedlung', 'settlement']],
        ['island', ['insel', 'island']], ['coast', ['küste', 'kueste', 'coast']], ['ruins', ['ruinenstadt', 'ruin complex']],
    ])[0];
    const biomes = hintedValues(text, [
        ['mushroom', ['pilzwald', 'pilzhöhle', 'mushroom']], ['forest', ['wald', 'forest']],
        ['jungle', ['dschungel', 'jungle']], ['swamp', ['sumpf', 'swamp']], ['plains', ['ebene', 'plains']],
        ['desert', ['wüste', 'wueste', 'desert']], ['snow', ['schnee', 'eisig', 'snow']],
        ['volcanic', ['vulkan', 'lava', 'volcanic']], ['underground', ['unterreich', 'unterirdisch', 'underground']],
        ['wasteland', ['ödland', 'oedland', 'wasteland']],
    ]);
    const waters = hintedValues(text, [
        ['multiple-rivers', ['mehrere flüsse', 'mehrere fluesse', 'multiple rivers']],
        ['river', ['fluss', 'river']], ['pond', ['teich', 'pond']], ['lake', ['see', 'lake']],
        ['coast', ['küste', 'kueste', 'coast']], ['flooded', ['überflutet', 'ueberflutet', 'flooded']],
    ]);
    const themes = hintedValues(text, [
        ['ruins', ['ruine', 'ruins']], ['village', ['dorf', 'village']], ['town', ['stadt', 'town']],
        ['temple', ['tempel', 'temple', 'heiligtum', 'shrine']], ['castle', ['burg', 'castle']],
        ['mine', ['mine', 'bergwerk']], ['crypt', ['krypta', 'crypt']], ['fortress', ['festung', 'fortress']],
        ['camp', ['lager', 'camp']],
    ]);
    const atmosphere = hintedValues(text, [
        ['abandoned', ['verlassen', 'abandoned']], ['overgrown', ['überwuchert', 'ueberwuchert', 'overgrown']],
        ['destroyed', ['zerstört', 'zerstoert', 'destroyed']], ['magical', ['magisch', 'magical']],
        ['cursed', ['verflucht', 'cursed']], ['dark', ['dunkel', 'finster', 'dark']],
    ])[0];
    const terrain = hintedValues(text, [
        ['hilly', ['hügelig', 'huegelig', 'hills']], ['cliffs', ['klippen', 'felsen', 'cliffs']],
        ['canyon', ['schlucht', 'canyon']], ['flat', ['flach', 'flat']], ['mixed', ['gemischt', 'mixed']],
    ])[0];
    return { mapType, biomes, waters, themes, atmosphere, terrain };
};
const unique = (values) => [...new Set(values)];
/** Adds only description-derived facts that do not contradict explicit scalar choices. */
export const prepareAiRequest = (request) => {
    const seed = request.seed ?? createMapGenerationSeed();
    const hints = deriveDescriptionHints(request.description);
    return {
        ...request,
        seed,
        mapType: request.mapType ?? hints.mapType,
        biomes: unique([...(request.biomes ?? []), ...(request.biome ? [request.biome] : []), ...hints.biomes]),
        waterFeatures: unique([...(request.waterFeatures ?? []), ...(request.water ? [request.water] : []), ...hints.waters]),
        themes: unique([...(request.themes ?? []), ...(request.theme ? [request.theme] : []), ...hints.themes]),
        atmosphere: request.atmosphere ?? hints.atmosphere,
        terrain: request.terrain ?? hints.terrain,
        biome: undefined,
        water: undefined,
        theme: undefined,
    };
};
export const createAiInspiration = (request) => {
    const plan = createLocalMapPlan(request);
    const regionTags = plan.regions.flatMap((region) => region.tags ?? []);
    const centralTags = [...plan.rooms, ...plan.areas].flatMap((node) => node.tags ?? []);
    return {
        mapType: plan.theme.mapType,
        environment: plan.theme.biomes,
        mainTheme: plan.theme.settlement === 'none' ? (centralTags[0] ?? 'mysterious-site') : plan.theme.settlement,
        structure: plan.layout.connectionStructure,
        condition: plan.theme.atmosphere,
        landmark: plan.landmarks[0]?.kind ?? 'monolith',
        specialTerrain: plan.theme.terrain,
        unusualFeature: regionTags[2] ?? centralTags[1] ?? 'ancient-anomaly',
        layoutArchetype: plan.layout.archetype,
        water: plan.theme.water,
    };
};
//# sourceMappingURL=aiInspiration.js.map