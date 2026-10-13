import { describe, expect, it } from 'vitest'
import { createLocalMapPlan } from '../../src/map-generation/index.js'
import type { WorkerAiConfig } from './config.js'
import type { AiMapPlannerProvider, AiUsageProvider } from './contracts.js'
import { AiProviderError } from './errors.js'
import { handleAiUsage, handleMapPlan } from './routes.js'

const configured: WorkerAiConfig = {
  apiKey: 'worker-only-api-key',
  adminKey: 'worker-only-admin-key',
  projectId: 'project-test',
  dailyBudgetUsd: undefined,
  allowedOrigins: new Set(['https://example.web.app']),
}

const planner = (result: unknown): AiMapPlannerProvider => ({
  generatePlan: async () => ({ candidate: result, model: 'gpt-6-luna' }),
})

describe('Worker AI API routes', () => {
  it('fällt bei fehlendem API-Key sicher auf den Local Planner zurück', async () => {
    const config = { ...configured, apiKey: undefined }
    const mapResponse = await handleMapPlan({ method: 'POST', body: {} }, config)
    const usageResponse = await handleAiUsage({ method: 'GET' }, { ...config, adminKey: undefined })
    expect(mapResponse).toMatchObject({
      status: 200,
      body: { source: 'local-fallback', debug: { fallbackReason: 'not-configured' } },
    })
    expect(usageResponse).toMatchObject({
      status: 503,
      body: { error: { code: 'USAGE_NOT_CONFIGURED' } },
    })
    expect(JSON.stringify([mapResponse, usageResponse])).not.toContain('OPENAI_')
  })

  it('fehlender Admin-Key blockiert die AI-Planung ohne konfiguriertes Tagesbudget nicht', async () => {
    const plan = createLocalMapPlan({ seed: 42, mapType: 'cave' })
    const response = await handleMapPlan(
      { method: 'POST', body: { seed: 42, mapType: 'cave' } },
      { ...configured, adminKey: undefined },
      planner(plan),
    )
    expect(response).toMatchObject({ status: 200, body: { source: 'ai', plan } })
  })

  it('validiert Request, Größenlimits und MapPlan an der HTTP-Grenze', async () => {
    const invalidRequest = await handleMapPlan(
      { method: 'POST', body: { width: 0 } },
      configured,
      planner(createLocalMapPlan({ seed: 1 })),
    )
    const oversized = await handleMapPlan(
      { method: 'POST', body: { width: 201 } },
      configured,
      planner(createLocalMapPlan({ seed: 1 })),
    )
    const invalidPlan = await handleMapPlan(
      { method: 'POST', body: { seed: 1 } },
      configured,
      planner({ schemaVersion: 1, id: 'incomplete' }),
    )
    expect(invalidRequest).toMatchObject({ status: 400, body: { error: { code: 'INVALID_REQUEST' } } })
    expect(oversized).toMatchObject({ status: 400, body: { error: { code: 'REQUEST_LIMIT_EXCEEDED' } } })
    expect(invalidPlan).toMatchObject({
      status: 200,
      body: { source: 'local-fallback', debug: { attempts: 2, fallbackReason: 'invalid-output' } },
    })
  })

  it('typisiert OpenAI-429 als lokalen Rate-Limit-Fallback', async () => {
    const provider: AiMapPlannerProvider = {
      generatePlan: async () => {
        throw new AiProviderError('rate_limit', 12)
      },
    }
    const response = await handleMapPlan({ method: 'POST', body: {} }, configured, provider)
    expect(response).toMatchObject({
      status: 200,
      body: { source: 'local-fallback', debug: { attempts: 1, fallbackReason: 'rate-limited' } },
    })
  })

  it('erzwingt ein konfiguriertes Tagesbudget und fällt bei fehlender Messung geschlossen zurück', async () => {
    const request = { method: 'POST', body: { seed: 9 } }
    const budgetConfig = { ...configured, dailyBudgetUsd: 2 }
    const exhaustedUsage: AiUsageProvider = {
      getCost: async () => ({ amountUsd: 2.1, measuredAtUtc: new Date().toISOString() }),
    }
    const exhausted = await handleMapPlan(
      request,
      budgetConfig,
      planner(createLocalMapPlan({ seed: 9 })),
      exhaustedUsage,
    )
    const unavailable = await handleMapPlan(
      request,
      { ...budgetConfig, adminKey: undefined },
      planner(createLocalMapPlan({ seed: 9 })),
    )
    expect(exhausted).toMatchObject({
      body: { source: 'local-fallback', debug: { fallbackReason: 'budget-exhausted' } },
    })
    expect(unavailable).toMatchObject({
      body: { source: 'local-fallback', debug: { fallbackReason: 'budget-unavailable' } },
    })
  })

  it('gibt bei API-Fehlern niemals Upstream- oder Secret-Details aus', async () => {
    const provider: AiMapPlannerProvider = {
      generatePlan: async () => {
        throw new Error('upstream leaked sk-super-secret and stack')
      },
    }
    const response = await handleMapPlan({ method: 'POST', body: {} }, configured, provider)
    expect(response).toMatchObject({ status: 200, body: { source: 'local-fallback' } })
    expect(JSON.stringify(response)).not.toContain('sk-super-secret')
    expect(JSON.stringify(response)).not.toContain('stack')
  })

  it('berechnet Tagesgrenzen in UTC und trennt Messung von Konfiguration', async () => {
    const provider: AiUsageProvider = {
      getCost: async ({ startUtc, endUtc, projectId }) => {
        expect(startUtc.toISOString()).toBe('2026-09-29T00:00:00.000Z')
        expect(endUtc.toISOString()).toBe('2026-09-30T00:00:00.000Z')
        expect(projectId).toBe('project-test')
        return { amountUsd: 0.75, measuredAtUtc: '2026-09-29T12:00:00.000Z' }
      },
    }
    const response = await handleAiUsage(
      { method: 'GET' },
      { ...configured, dailyBudgetUsd: 2 },
      provider,
      new Date('2026-09-28T23:59:59.000-07:00'),
    )
    expect(response).toMatchObject({
      status: 200,
      body: {
        usage: { amountUsd: 0.75, source: 'openai-organization-costs-api' },
        dailyBudget: { amountUsd: 2, source: 'server-configuration' },
        remaining: { amountUsd: 1.25, source: 'calculated-from-api-usage-and-server-budget' },
        freeQuotaStatus: 'unknown',
      },
    })
  })

  it('behandelt Usage-API-Fehler sicher', async () => {
    const provider: AiUsageProvider = {
      getCost: async () => {
        throw new AiProviderError('invalid_response')
      },
    }
    const response = await handleAiUsage({ method: 'GET' }, configured, provider)
    expect(response).toMatchObject({ status: 502, body: { error: { code: 'AI_INVALID_RESPONSE' } } })
  })
})
