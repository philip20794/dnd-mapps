import { LocalMapPlanner } from '../../src/map-generation/localPlanner.js'
import { parseMapPlan } from '../../src/map-generation/validation.js'
import { MAP_PLAN_SCHEMA_VERSION, type MapGenerationRequest, type MapPlan } from '../../src/map-generation/types.js'
import { createAiInspiration, prepareAiRequest } from './aiInspiration.js'
import { validateAiPlan } from './aiPlanConstraints.js'
import type { AiMapPlannerProvider, AiTokenUsage, MapPlanResponse } from './contracts.js'
import { AiProviderError } from './errors.js'

export const LUNA_MODEL = 'gpt-6-luna' as const

const addUsage = (current: AiTokenUsage | undefined, next: AiTokenUsage | undefined): AiTokenUsage | undefined => {
  if (!next) return current
  return {
    inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
    totalTokens: (current?.totalTokens ?? 0) + next.totalTokens,
  }
}

export const createLocalFallback = (
  request: MapGenerationRequest,
  fallbackReason: MapPlanResponse['debug']['fallbackReason'],
  attempts = 0,
  tokenUsage?: AiTokenUsage,
): MapPlanResponse => {
  const prepared = prepareAiRequest(request)
  const plan = new LocalMapPlanner().plan(prepared)
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
  }
}

export class AiMapPlanner {
  constructor(private readonly provider: AiMapPlannerProvider) {}

  async plan(input: MapGenerationRequest): Promise<MapPlanResponse> {
    const request = prepareAiRequest(input)
    const inspiration = request.description?.trim() ? undefined : createAiInspiration(request)
    let tokenUsage: AiTokenUsage | undefined
    let validationErrors: readonly string[] | undefined

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const output = await this.provider.generatePlan({
          request,
          seed: request.seed!,
          ...(inspiration ? { inspiration } : {}),
          ...(validationErrors ? { repair: { validationErrors } } : {}),
        })
        tokenUsage = addUsage(tokenUsage, output.tokenUsage)
        validationErrors = validateAiPlan(output.candidate, request, inspiration)
        if (validationErrors.length === 0) {
          const plan: MapPlan = parseMapPlan(output.candidate)
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
          }
        }
      } catch (error) {
        return createLocalFallback(
          request,
          error instanceof AiProviderError && error.kind === 'rate_limit'
            ? 'rate-limited'
            : 'provider-error',
          attempt,
          tokenUsage,
        )
      }
    }
    return createLocalFallback(request, 'invalid-output', 2, tokenUsage)
  }
}
