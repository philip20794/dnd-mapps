import { describe, expect, it } from 'vitest'
import {
  AiUsageClientError,
  formatLocalResetTime,
  loadAiUsage,
  parseAiUsageSnapshot,
} from './usage'

const snapshot = {
  period: { startUtc: '2026-09-28T00:00:00.000Z', endUtc: '2026-09-29T00:00:00.000Z', timezone: 'UTC' },
  usage: {
    amountUsd: 1.8,
    source: 'openai-organization-costs-api',
    measuredAtUtc: '2026-09-28T12:00:00.000Z',
    mayBeDelayed: true,
  },
  dailyBudget: { amountUsd: 2.5, source: 'server-configuration' },
  remaining: {
    amountUsd: 0.7,
    source: 'calculated-from-api-usage-and-server-budget',
    isEstimate: true,
  },
  freeQuotaStatus: 'unknown',
} as const

describe('AI-Usage-Client', () => {
  it('akzeptiert ausschließlich das öffentliche, gemessene Usage-Datenmodell', () => {
    expect(parseAiUsageSnapshot(snapshot)).toEqual(snapshot)
    expect(() => parseAiUsageSnapshot({ ...snapshot, freeQuotaStatus: 'available' })).toThrow(
      AiUsageClientError,
    )
  })

  it('kapselt fehlgeschlagene und ungültige HTTP-Antworten', async () => {
    await expect(loadAiUsage(async () => new Response('{}', { status: 503 }))).rejects.toMatchObject({
      code: 'request_failed',
    })
    await expect(loadAiUsage(async () => new Response('{}'))).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('formatiert die UTC-Resetgrenze im lokalen Zeitformat', () => {
    expect(formatLocalResetTime(snapshot.period.endUtc)).toMatch(/^\d{2}:\d{2}$/)
    expect(formatLocalResetTime('not-a-date')).toBe('unbekannt')
  })
})
