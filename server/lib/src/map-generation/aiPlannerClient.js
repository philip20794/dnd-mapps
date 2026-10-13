import { parseMapPlan } from './validation.js';
export class AiMapPlannerClientError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'AiMapPlannerClientError';
    }
}
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const parseRemoteResult = (value) => {
    if (!isRecord(value) || (value.source !== 'ai' && value.source !== 'local-fallback'))
        throw new AiMapPlannerClientError('invalid_response');
    try {
        const debug = isRecord(value.debug)
            ? {
                ...(typeof value.debug.model === 'string' ? { model: value.debug.model } : {}),
                ...(typeof value.debug.attempts === 'number' ? { attempts: value.debug.attempts } : {}),
                ...(typeof value.debug.fallbackReason === 'string'
                    ? { fallbackReason: value.debug.fallbackReason }
                    : {}),
            }
            : undefined;
        return { plan: parseMapPlan(value.plan), source: value.source, ...(debug ? { debug } : {}) };
    }
    catch {
        throw new AiMapPlannerClientError('invalid_response');
    }
};
/** Browser-side transport only. It contains no SDK, key, or server secret. */
export class HttpAiMapPlannerClient {
    fetcher;
    constructor(fetcher = fetch) {
        this.fetcher = fetcher;
    }
    async plan(request) {
        let response;
        try {
            response = await this.fetcher('/api/map-plan', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
        }
        catch {
            throw new AiMapPlannerClientError('request_failed');
        }
        if (!response.ok)
            throw new AiMapPlannerClientError('request_failed');
        try {
            return parseRemoteResult(await response.json());
        }
        catch (error) {
            if (error instanceof AiMapPlannerClientError)
                throw error;
            throw new AiMapPlannerClientError('invalid_response');
        }
    }
}
//# sourceMappingURL=aiPlannerClient.js.map