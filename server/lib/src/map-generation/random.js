/** Creates the one non-deterministic value needed when no seed was supplied. */
export const createMapGenerationSeed = () => {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
};
/** A compact, deterministic PRNG for all decisions after seed creation. */
export const createSeededRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};
export const pick = (random, values) => {
    if (values.length === 0)
        throw new Error('Aus einem leeren Pool kann nicht gewählt werden.');
    return values[Math.floor(random() * values.length)];
};
export const chance = (random, probability) => random() < probability;
export const integer = (random, minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
//# sourceMappingURL=random.js.map