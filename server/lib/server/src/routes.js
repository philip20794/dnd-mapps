import { MapGenerationValidationError, parseMapGenerationRequest, } from '../../src/map-generation/index.js';
import { AiMapPlanner, createLocalFallback } from './aiMapPlanner.js';
import { AiProviderError } from './errors.js';
const errorResponse = (status, code, message, retryAfterSeconds) => ({
    status,
    body: { error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } },
    ...(retryAfterSeconds === undefined
        ? {}
        : { headers: { 'Retry-After': String(retryAfterSeconds) } }),
});
const providerFailure = (error) => {
    if (error instanceof AiProviderError && error.kind === 'rate_limit')
        return errorResponse(429, 'AI_RATE_LIMITED', 'Der KI-Dienst ist momentan ausgelastet. Bitte später erneut versuchen.', error.retryAfterSeconds);
    if (error instanceof AiProviderError && error.kind === 'invalid_response')
        return errorResponse(502, 'AI_INVALID_RESPONSE', 'Der KI-Dienst lieferte keine gültige Antwort.');
    return errorResponse(502, 'AI_UPSTREAM_ERROR', 'Der KI-Dienst ist momentan nicht verfügbar.');
};
export const handleMapPlan = async (request, config, provider) => {
    if (request.method.toUpperCase() !== 'POST')
        return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Für diesen Endpunkt ist POST erforderlich.');
    let generationRequest;
    try {
        generationRequest = parseMapGenerationRequest(request.body);
    }
    catch (error) {
        if (error instanceof MapGenerationValidationError)
            return errorResponse(400, 'INVALID_REQUEST', 'Die Anfrage zur Kartengenerierung ist ungültig.');
        return errorResponse(400, 'INVALID_REQUEST', 'Die Anfrage zur Kartengenerierung ist ungültig.');
    }
    if (!config.apiKey || !provider)
        return { status: 200, body: createLocalFallback(generationRequest, 'not-configured') };
    return { status: 200, body: await new AiMapPlanner(provider).plan(generationRequest) };
};
const utcDay = (now) => {
    const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { startUtc, endUtc: new Date(startUtc.getTime() + 86_400_000) };
};
export const handleAiUsage = async (request, config, provider, now = new Date()) => {
    if (request.method.toUpperCase() !== 'GET')
        return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Für diesen Endpunkt ist GET erforderlich.');
    if (!config.adminKey || !config.projectId)
        return errorResponse(503, 'USAGE_NOT_CONFIGURED', 'Die Verbrauchsmessung ist nicht konfiguriert.');
    if (!provider)
        return errorResponse(503, 'USAGE_NOT_CONFIGURED', 'Die Verbrauchsmessung ist nicht konfiguriert.');
    const period = utcDay(now);
    try {
        const usage = await provider.getCost({ ...period, projectId: config.projectId });
        const budget = config.dailyBudgetUsd;
        return {
            status: 200,
            body: {
                period: {
                    startUtc: period.startUtc.toISOString(),
                    endUtc: period.endUtc.toISOString(),
                    timezone: 'UTC',
                },
                usage: {
                    amountUsd: usage.amountUsd,
                    source: 'openai-organization-costs-api',
                    measuredAtUtc: usage.measuredAtUtc,
                    mayBeDelayed: true,
                },
                dailyBudget: {
                    amountUsd: budget ?? null,
                    source: budget === undefined ? 'not-configured' : 'server-configuration',
                },
                remaining: budget === undefined
                    ? null
                    : {
                        amountUsd: Math.max(0, budget - usage.amountUsd),
                        source: 'calculated-from-api-usage-and-server-budget',
                        isEstimate: true,
                    },
                freeQuotaStatus: 'unknown',
            },
        };
    }
    catch (error) {
        return providerFailure(error);
    }
};
//# sourceMappingURL=routes.js.map