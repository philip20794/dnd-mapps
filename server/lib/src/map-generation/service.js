import { LocalMapPlanner } from './localPlanner.js';
import { createLegacyMapDefinitionFromPlan } from './mapDefinitionAdapter.js';
import { normalizeMapGenerationRequest } from './normalization.js';
import { createMapGenerationSeed } from './random.js';
import { parseMapGenerationRequest, parseMapPlan } from './validation.js';
import { HttpAiMapPlannerClient, } from './aiPlannerClient.js';
const normalizeWithSeed = (input) => {
    const request = normalizeMapGenerationRequest(parseMapGenerationRequest(input));
    return { ...request, seed: request.seed ?? createMapGenerationSeed() };
};
const metadataFor = (request, plan, planner, remote) => ({
    pipelineVersion: 1,
    request,
    plan,
    planner,
    ...(remote?.debug
        ? {
            debug: remote.debug,
        }
        : {}),
});
/** Central planner selection and temporary MapPlan -> legacy-map pipeline. */
export class MapGenerationService {
    localPlanner;
    aiPlanner;
    constructor(localPlanner = new LocalMapPlanner(), aiPlanner = new HttpAiMapPlannerClient()) {
        this.localPlanner = localPlanner;
        this.aiPlanner = aiPlanner;
    }
    async generate(input = {}) {
        const request = normalizeWithSeed(input);
        if (!request.aiEnabled)
            return this.fromLocalPlan(request);
        try {
            const remote = await this.aiPlanner.plan(request);
            const plan = parseMapPlan(remote.plan);
            if (plan.seed !== request.seed)
                throw new Error('KI-Plan hat einen abweichenden Seed.');
            const planner = remote.source;
            return this.fromPlan(request, plan, planner, remote);
        }
        catch {
            return this.fromLocalPlan(request, 'local-fallback');
        }
    }
    /** Rebuilds the current transitional MapDefinition from persisted semantic data. */
    regenerate(request, plan) {
        const normalizedRequest = normalizeWithSeed(request);
        const validatedPlan = parseMapPlan(plan);
        if (validatedPlan.seed !== normalizedRequest.seed)
            throw new Error('MapPlan und Generierungsanfrage verwenden unterschiedliche Seeds.');
        return this.fromPlan(normalizedRequest, validatedPlan, 'local');
    }
    fromLocalPlan(request, planner = 'local') {
        return this.fromPlan(request, parseMapPlan(this.localPlanner.plan(request)), planner);
    }
    fromPlan(request, plan, planner, remote) {
        const metadata = metadataFor(request, plan, planner, remote);
        return {
            map: createLegacyMapDefinitionFromPlan(plan, metadata),
            request,
            plan,
            planner,
        };
    }
}
export const mapGenerationService = new MapGenerationService();
//# sourceMappingURL=service.js.map