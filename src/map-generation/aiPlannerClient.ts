import { parseMapPlan } from './validation.js'
import type { MapGenerationRequest, MapPlan } from './types.js'
import { aiApiUrl } from '@/ai/apiUrl'

export type RemotePlannerSource = 'ai' | 'local-fallback'

export interface RemoteAiPlanResult {
  readonly plan: MapPlan
  readonly source: RemotePlannerSource
  readonly debug?: {
    readonly model?: string
    readonly attempts?: number
    readonly fallbackReason?: string
  }
}

export interface AiMapPlannerClient {
  plan(request: MapGenerationRequest): Promise<RemoteAiPlanResult>
}

export class AiMapPlannerClientError extends Error {
  public constructor(readonly code: 'request_failed' | 'invalid_response' | 'rate_limited') {
    super(code)
    this.name = 'AiMapPlannerClientError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const parseRemoteResult = (value: unknown): RemoteAiPlanResult => {
  if (!isRecord(value) || (value.source !== 'ai' && value.source !== 'local-fallback'))
    throw new AiMapPlannerClientError('invalid_response')
  try {
    const debug = isRecord(value.debug)
      ? {
          ...(typeof value.debug.model === 'string' ? { model: value.debug.model } : {}),
          ...(typeof value.debug.attempts === 'number' ? { attempts: value.debug.attempts } : {}),
          ...(typeof value.debug.fallbackReason === 'string'
            ? { fallbackReason: value.debug.fallbackReason }
            : {}),
        }
      : undefined
    return { plan: parseMapPlan(value.plan), source: value.source, ...(debug ? { debug } : {}) }
  } catch {
    throw new AiMapPlannerClientError('invalid_response')
  }
}

/** Browser-side transport only. It contains no SDK, key, or server secret. */
export class HttpAiMapPlannerClient implements AiMapPlannerClient {
  public constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly baseUrl: string | undefined = import.meta.env.VITE_AI_API_BASE_URL,
  ) {}

  public async plan(request: MapGenerationRequest): Promise<RemoteAiPlanResult> {
    let response: Response
    try {
      response = await this.fetcher(aiApiUrl('/api/map-plan', this.baseUrl), {
        method: 'POST',
        credentials: 'omit',
        mode: 'cors',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    } catch {
      throw new AiMapPlannerClientError('request_failed')
    }
    if (response.status === 429) throw new AiMapPlannerClientError('rate_limited')
    if (!response.ok) throw new AiMapPlannerClientError('request_failed')
    try {
      return parseRemoteResult(await response.json())
    } catch (error) {
      if (error instanceof AiMapPlannerClientError) throw error
      throw new AiMapPlannerClientError('invalid_response')
    }
  }
}
