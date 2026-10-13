import type { MapGenerationRequest, MapPlan } from '../../src/map-generation/types.js'

export interface AiMapPlannerProvider {
  generatePlan(input: AiPlanGenerationInput): Promise<AiPlanGenerationOutput>
}

export interface AiPlanInspiration {
  readonly mapType: string
  readonly environment: readonly string[]
  readonly mainTheme: string
  readonly structure: string
  readonly condition: string
  readonly landmark: string
  readonly specialTerrain: string
  readonly unusualFeature: string
  readonly layoutArchetype: string
  readonly water: string
}

export interface AiPlanGenerationInput {
  readonly request: MapGenerationRequest
  readonly seed: number
  readonly inspiration?: AiPlanInspiration
  readonly repair?: {
    readonly validationErrors: readonly string[]
  }
}

export interface AiTokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
}

export interface AiPlanGenerationOutput {
  readonly candidate: unknown
  readonly model: 'gpt-6-luna'
  readonly tokenUsage?: AiTokenUsage
}

export interface AiUsageProvider {
  getCost(input: UsageQuery): Promise<MeasuredUsage>
}

export interface UsageQuery {
  readonly startUtc: Date
  readonly endUtc: Date
  readonly projectId: string
}

export interface MeasuredUsage {
  readonly amountUsd: number
  readonly measuredAtUtc: string
}

export interface AiUsageResponse {
  readonly period: {
    readonly startUtc: string
    readonly endUtc: string
    readonly timezone: 'UTC'
  }
  readonly usage: {
    readonly amountUsd: number
    readonly source: 'openai-organization-costs-api'
    readonly measuredAtUtc: string
    readonly mayBeDelayed: true
  }
  readonly dailyBudget: {
    readonly amountUsd: number | null
    readonly source: 'server-configuration' | 'not-configured'
  }
  readonly remaining: {
    readonly amountUsd: number
    readonly source: 'calculated-from-api-usage-and-server-budget'
    readonly isEstimate: true
  } | null
  /** OpenAI exposes no authoritative API value for a remaining free daily quota. */
  readonly freeQuotaStatus: 'unknown'
}

export interface MapPlanResponse {
  readonly plan: MapPlan
  readonly source: 'ai' | 'local-fallback'
  readonly debug: {
    readonly model: 'gpt-6-luna'
    readonly schemaVersion: number
    readonly seed: number
    readonly attempts: number
    readonly tokenUsage?: AiTokenUsage
    readonly fallbackReason?:
      | 'not-configured'
      | 'provider-error'
      | 'rate-limited'
      | 'invalid-output'
      | 'budget-exhausted'
      | 'budget-unavailable'
  }
}

export interface PublicErrorBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly retryAfterSeconds?: number
  }
}

export interface HttpRequest {
  readonly method: string
  readonly body?: unknown
}

export interface HttpResponse<T = unknown> {
  readonly status: number
  readonly body: T
  readonly headers?: Readonly<Record<string, string>>
}
