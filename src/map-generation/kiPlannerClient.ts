import type { MapGenerationRequest } from './types.js'
import { chooseBestLocalPlan } from './quality.js'
import { applyKiMapDesign, createKiDesignContext } from './kiDesign.js'
import { AiMapPlannerClientError, type AiMapPlannerClient, type RemoteAiPlanResult } from './aiPlannerClient.js'

/** Uses a same-origin LAN bridge. Never passes a KI API key to the browser. */
export class KiApiMapPlannerClient implements AiMapPlannerClient {
  public constructor(private readonly fetcher: typeof fetch = fetch) {}

  public async plan(request: MapGenerationRequest): Promise<RemoteAiPlanResult> {
    let response: Response
    try {
      const baseline = chooseBestLocalPlan(request)
      response = await this.fetcher('/api/ki-map-design', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, context: createKiDesignContext(baseline) }),
      })
    } catch {
      throw new AiMapPlannerClientError('request_failed')
    }
    if (response.status === 429) throw new AiMapPlannerClientError('rate_limited')
    if (!response.ok) throw new AiMapPlannerClientError('request_failed')
    try {
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('design' in data))
        throw new Error('KI design missing.')
      return {
        plan: applyKiMapDesign(request, data.design),
        source: 'ai',
        debug: { model: 'ki-api-chat', attempts: 1 },
      }
    } catch {
      throw new AiMapPlannerClientError('invalid_response')
    }
  }
}
