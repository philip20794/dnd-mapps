export interface AiUsageSnapshot {
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
  readonly freeQuotaStatus: 'unknown'
}

export class AiUsageClientError extends Error {
  constructor(readonly code: 'request_failed' | 'invalid_response') {
    super(code)
    this.name = 'AiUsageClientError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const parseAiUsageSnapshot = (value: unknown): AiUsageSnapshot => {
  if (!isRecord(value) || !isRecord(value.period) || !isRecord(value.usage) || !isRecord(value.dailyBudget))
    throw new AiUsageClientError('invalid_response')
  const { period, usage, dailyBudget, remaining } = value
  if (
    typeof period.startUtc !== 'string' ||
    typeof period.endUtc !== 'string' ||
    period.timezone !== 'UTC' ||
    !isFiniteNumber(usage.amountUsd) ||
    usage.source !== 'openai-organization-costs-api' ||
    typeof usage.measuredAtUtc !== 'string' ||
    usage.mayBeDelayed !== true ||
    !(dailyBudget.amountUsd === null || isFiniteNumber(dailyBudget.amountUsd)) ||
    (dailyBudget.source !== 'server-configuration' && dailyBudget.source !== 'not-configured') ||
    value.freeQuotaStatus !== 'unknown'
  )
    throw new AiUsageClientError('invalid_response')
  if (remaining !== null) {
    if (
      !isRecord(remaining) ||
      !isFiniteNumber(remaining.amountUsd) ||
      remaining.source !== 'calculated-from-api-usage-and-server-budget' ||
      remaining.isEstimate !== true
    )
      throw new AiUsageClientError('invalid_response')
  }
  return value as unknown as AiUsageSnapshot
}

export const loadAiUsage = async (
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  baseUrl: string | undefined = import.meta.env.VITE_AI_API_BASE_URL,
): Promise<AiUsageSnapshot> => {
  let response: Response
  try {
    response = await fetcher(aiApiUrl('/api/ai-usage', baseUrl), {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch {
    throw new AiUsageClientError('request_failed')
  }
  if (!response.ok) throw new AiUsageClientError('request_failed')
  try {
    return parseAiUsageSnapshot(await response.json())
  } catch (error) {
    if (error instanceof AiUsageClientError) throw error
    throw new AiUsageClientError('invalid_response')
  }
}

export const formatUsd = (amount: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(amount)

/** Converts the server's exclusive UTC end time to the viewer's local clock. */
export const formatLocalResetTime = (endUtc: string): string => {
  const end = new Date(endUtc)
  return Number.isNaN(end.getTime())
    ? 'unbekannt'
    : new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(end)
}
import { aiApiUrl } from './apiUrl'
