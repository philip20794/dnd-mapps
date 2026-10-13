import type { MapDefinition, MapGenerationMetadata } from '@/maps/api'
import { LocalMapPlanner } from './localPlanner.js'
import { createMapDefinitionFromPlan } from './mapDefinitionAdapter.js'
import { normalizeMapGenerationRequest } from './normalization.js'
import { createMapGenerationSeed } from './random.js'
import { parseMapGenerationRequest, parseMapPlan } from './validation.js'
import {
  AiMapPlannerClientError,
  HttpAiMapPlannerClient,
  type AiMapPlannerClient,
  type RemoteAiPlanResult,
} from './aiPlannerClient.js'
import type { MapGenerationRequest, MapPlan } from './types.js'

export interface MapGenerationResult {
  readonly map: MapDefinition
  readonly request: MapGenerationRequest
  readonly plan: MapPlan
  readonly planner: MapGenerationMetadata['planner']
}

export type MapGenerationSeedGenerator = () => number

/** Removes reproducibility metadata while retaining the user's semantic wishes. */
export const withoutMapGenerationSeed = (request: MapGenerationRequest): MapGenerationRequest => {
  const { seed: _seed, ...preferences } = request
  return preferences
}

const normalizeWithSeed = (
  input: MapGenerationRequest,
  createSeed: MapGenerationSeedGenerator,
): MapGenerationRequest => {
  const request = normalizeMapGenerationRequest(parseMapGenerationRequest(input))
  return { ...request, seed: request.seed ?? createSeed() }
}

const metadataFor = (
  request: MapGenerationRequest,
  plan: MapPlan,
  planner: MapGenerationMetadata['planner'],
  debug?: RemoteAiPlanResult['debug'],
): MapGenerationMetadata => ({
  pipelineVersion: 1,
  request,
  plan,
  planner,
  ...(debug
    ? {
        debug,
      }
    : {}),
})

/** Central planner selection and MapPlan -> geometry pipeline. */
export class MapGenerationService {
  public constructor(
    private readonly localPlanner = new LocalMapPlanner(),
    private readonly aiPlanner: AiMapPlannerClient = new HttpAiMapPlannerClient(),
    private readonly createSeed: MapGenerationSeedGenerator = createMapGenerationSeed,
  ) {}

  /**
   * Uses a supplied seed when one exists. This is the reproducible API for a
   * persisted request and MapPlan, not the normal UI action.
   */
  public async generate(input: MapGenerationRequest = {}): Promise<MapGenerationResult> {
    const request = normalizeWithSeed(input, this.createSeed)
    if (!request.aiEnabled) return this.fromLocalPlan(request)

    try {
      const remote = await this.aiPlanner.plan(request)
      const plan = parseMapPlan(remote.plan)
      if (plan.seed !== request.seed) throw new Error('KI-Plan hat einen abweichenden Seed.')
      const planner = remote.source
      return this.fromPlan(request, plan, planner, remote.debug)
    } catch (error) {
      const fallbackReason =
        error instanceof AiMapPlannerClientError
          ? error.code === 'rate_limited'
            ? 'worker-rate-limited'
            : error.code === 'invalid_response'
              ? 'worker-invalid-response'
              : 'worker-unreachable'
          : 'worker-unreachable'
      return this.fromLocalPlan(request, 'local-fallback', { fallbackReason })
    }
  }

  /**
   * Starts a genuinely new generation while retaining all semantic wishes.
   * The prior seed is intentionally discarded; an explicit replay must use
   * generate() or regenerate().
   */
  public async generateNew(input: MapGenerationRequest = {}): Promise<MapGenerationResult> {
    return this.generate(withoutMapGenerationSeed(input))
  }

  /** Rebuilds the MapDefinition from persisted semantic data. */
  public regenerate(request: MapGenerationRequest, plan: MapPlan): MapGenerationResult {
    const normalizedRequest = normalizeWithSeed(request, this.createSeed)
    const validatedPlan = parseMapPlan(plan)
    if (validatedPlan.seed !== normalizedRequest.seed)
      throw new Error('MapPlan und Generierungsanfrage verwenden unterschiedliche Seeds.')
    return this.fromPlan(normalizedRequest, validatedPlan, 'local')
  }

  private fromLocalPlan(
    request: MapGenerationRequest,
    planner: MapGenerationMetadata['planner'] = 'local',
    debug?: RemoteAiPlanResult['debug'],
  ): MapGenerationResult {
    return this.fromPlan(request, parseMapPlan(this.localPlanner.plan(request)), planner, debug)
  }

  private fromPlan(
    request: MapGenerationRequest,
    plan: MapPlan,
    planner: MapGenerationMetadata['planner'],
    debug?: RemoteAiPlanResult['debug'],
  ): MapGenerationResult {
    const metadata = metadataFor(request, plan, planner, debug)
    return {
      map: createMapDefinitionFromPlan(plan, metadata),
      request,
      plan,
      planner,
    }
  }
}

export const mapGenerationService = new MapGenerationService()
