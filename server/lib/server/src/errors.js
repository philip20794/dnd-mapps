export class AiProviderError extends Error {
    kind;
    retryAfterSeconds;
    constructor(kind, retryAfterSeconds) {
        super(kind);
        this.kind = kind;
        this.retryAfterSeconds = retryAfterSeconds;
        this.name = 'AiProviderError';
    }
}
export const retryAfterSecondsFrom = (value) => {
    if (!value)
        return undefined;
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
};
//# sourceMappingURL=errors.js.map