import { LocalMapPlanner } from '../../src/map-generation/localPlanner.js';
import { parseMapPlan } from '../../src/map-generation/validation.js';
import { MAP_PLAN_SCHEMA_VERSION } from '../../src/map-generation/types.js';
import { createAiInspiration, prepareAiRequest } from './aiInspiration.js';
import { validateAiPlan } from './aiPlanConstraints.js';
export const LUNA_MODEL = 'gpt-6-luna';
const addUsage = (current, next) => {
    if (!next)
        return current;
    return {
        inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
        outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
        totalTokens: (current?.totalTokens ?? 0) + next.totalTokens,
    };
};
export const createLocalFallback = (request, fallbackReason, attempts = 0, tokenUsage) => {
    const prepared = prepareAiRequest(request);
    const plan = new LocalMapPlanner().plan(prepared);
    return {
        plan,
        source: 'local-fallback',
        debug: {
            model: LUNA_MODEL,
            schemaVersion: MAP_PLAN_SCHEMA_VERSION,
            seed: plan.seed,
            attempts,
            ...(tokenUsage ? { tokenUsage } : {}),
            ...(fallbackReason ? { fallbackReason } : {}),
        },
    };
};
export class AiMapPlanner {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async plan(input) {
        const request = prepareAiRequest(input);
        const inspiration = request.description?.trim() ? undefined : createAiInspiration(request);
        let tokenUsage;
        let validationErrors;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const output = await this.provider.generatePlan({
                    request,
                    seed: request.seed,
                    ...(inspiration ? { inspiration } : {}),
                    ...(validationErrors ? { repair: { validationErrors } } : {}),
                });
                tokenUsage = addUsage(tokenUsage, output.tokenUsage);
                validationErrors = validateAiPlan(output.candidate, request, inspiration);
                if (validationErrors.length === 0) {
                    const plan = parseMapPlan(output.candidate);
                    return {
                        plan,
                        source: 'ai',
                        debug: {
                            model: LUNA_MODEL,
                            schemaVersion: plan.schemaVersion,
                            seed: plan.seed,
                            attempts: attempt,
                            ...(tokenUsage ? { tokenUsage } : {}),
                        },
                    };
                }
            }
            catch {
                return createLocalFallback(request, 'provider-error', attempt, tokenUsage);
            }
        }
        return createLocalFallback(request, 'invalid-output', 2, tokenUsage);
    }
}
//# sourceMappingURL=aiMapPlanner.js.map