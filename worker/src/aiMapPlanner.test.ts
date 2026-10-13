import { describe, expect, it } from 'vitest'
import { createLocalMapPlan, validateMapPlan } from '../../src/map-generation/index.js'
import { AiMapPlanner } from './aiMapPlanner.js'
import { createAiInspiration, prepareAiRequest } from './aiInspiration.js'
import type { AiMapPlannerProvider, AiPlanGenerationInput } from './contracts.js'

const validCandidate = (request: Parameters<typeof prepareAiRequest>[0]) =>
  createLocalMapPlan(prepareAiRequest(request))

describe('AiMapPlanner', () => {
  it('macht Beschreibung und explizite Optionen zu harten Vorgaben', async () => {
    const request = {
      seed: 91,
      description: 'Verlassener Tempel im Dschungel',
      waterFeatures: ['river'] as const,
    }
    let received: AiPlanGenerationInput | undefined
    const provider: AiMapPlannerProvider = {
      generatePlan: async (input) => {
        received = input
        return { candidate: validCandidate(request), model: 'gpt-6-luna' }
      },
    }
    const result = await new AiMapPlanner(provider).plan(request)
    expect(received?.inspiration).toBeUndefined()
    expect(received?.request).toMatchObject({
      biomes: ['jungle'],
      themes: ['temple'],
      atmosphere: 'abandoned',
      waterFeatures: ['river'],
    })
    expect(result.source).toBe('ai')
    expect(result.plan.brief).toContain(request.description)
    expect(result.plan.theme.biomes).toContain('jungle')
    expect(result.plan.theme.settlements).toContain('temple')
    expect(result.plan.theme.waterFeatures).toContain('river')
  })

  it('erzeugt ohne Beschreibung eine breite seed-basierte Inspiration', async () => {
    const captured: AiPlanGenerationInput[] = []
    const provider: AiMapPlannerProvider = {
      generatePlan: async (input) => {
        captured.push(input)
        return { candidate: createLocalMapPlan(input.request), model: 'gpt-6-luna' }
      },
    }
    await new AiMapPlanner(provider).plan({ seed: 12345 })
    await new AiMapPlanner(provider).plan({ seed: 12345 })
    expect(captured[0]?.inspiration).toEqual(captured[1]?.inspiration)
    expect(captured[0]?.inspiration).toEqual(createAiInspiration(prepareAiRequest({ seed: 12345 })))
    expect(captured[0]?.inspiration).toMatchObject({
      mapType: expect.any(String),
      environment: expect.any(Array),
      mainTheme: expect.any(String),
      landmark: expect.any(String),
      unusualFeature: expect.any(String),
      layoutArchetype: expect.any(String),
    })
  })

  it('streut Inspirationsfelder über viele Seeds breit', () => {
    const inspirations = Array.from({ length: 160 }, (_, seed) =>
      createAiInspiration(prepareAiRequest({ seed })),
    )
    expect(new Set(inspirations.map((entry) => entry.mapType)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(inspirations.flatMap((entry) => entry.environment)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(inspirations.map((entry) => entry.layoutArchetype)).size).toBeGreaterThanOrEqual(9)
    expect(new Set(inspirations.map((entry) => entry.unusualFeature)).size).toBeGreaterThanOrEqual(7)
  })

  it('führt bei ungültiger Ausgabe genau einen kontrollierten Reparaturversuch aus', async () => {
    const request = { seed: 7, mapType: 'cave' as const }
    const calls: AiPlanGenerationInput[] = []
    const provider: AiMapPlannerProvider = {
      generatePlan: async (input) => {
        calls.push(input)
        return {
          candidate: calls.length === 1 ? { schemaVersion: 1 } : validCandidate(request),
          model: 'gpt-6-luna',
          tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        }
      },
    }
    const result = await new AiMapPlanner(provider).plan(request)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.repair?.validationErrors.length).toBeGreaterThan(0)
    expect(result).toMatchObject({
      source: 'ai',
      debug: {
        model: 'gpt-6-luna',
        schemaVersion: 1,
        seed: 7,
        attempts: 2,
        tokenUsage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
      },
    })
  })

  it('fällt nach zwei ungültigen Antworten auf einen validen LocalMapPlanner-Plan zurück', async () => {
    let calls = 0
    const provider: AiMapPlannerProvider = {
      generatePlan: async () => {
        calls += 1
        return { candidate: '{kaputt', model: 'gpt-6-luna' }
      },
    }
    const result = await new AiMapPlanner(provider).plan({ seed: 88, mapType: 'settlement' })
    expect(calls).toBe(2)
    expect(result).toMatchObject({ source: 'local-fallback', debug: { attempts: 2, fallbackReason: 'invalid-output', seed: 88 } })
    expect(validateMapPlan(result.plan)).toEqual([])
  })

  it('fällt bei Provider-Fehlern sofort lokal zurück', async () => {
    const provider: AiMapPlannerProvider = {
      generatePlan: async () => {
        throw new Error('API nicht erreichbar')
      },
    }
    const result = await new AiMapPlanner(provider).plan({ seed: 99, mapType: 'dungeon' })
    expect(result).toMatchObject({ source: 'local-fallback', debug: { attempts: 1, fallbackReason: 'provider-error' } })
    expect(validateMapPlan(result.plan)).toEqual([])
  })

  it('behält Beschreibung und Optionen auch im Local-Fallback bei', async () => {
    const provider: AiMapPlannerProvider = {
      generatePlan: async () => {
        throw new Error('offline')
      },
    }
    const description = 'Verlassener Tempel im Dschungel'
    const result = await new AiMapPlanner(provider).plan({
      seed: 101,
      description,
      waterFeatures: ['river'],
    })
    expect(result.plan.brief).toBe(description)
    expect(result.plan.theme.biomes).toContain('jungle')
    expect(result.plan.theme.settlements).toContain('temple')
    expect(result.plan.theme.waterFeatures).toContain('river')
  })

  it('repariert Pläne, die explizite Nutzeroptionen trotz gültigem Schema ignorieren', async () => {
    const request = { seed: 31, mapType: 'outdoor' as const, biomes: ['snow'] as const, waterFeatures: ['river'] as const }
    const ignored = createLocalMapPlan({ seed: 31, mapType: 'outdoor', biomes: ['desert'], water: 'none' })
    const calls: AiPlanGenerationInput[] = []
    const provider: AiMapPlannerProvider = {
      generatePlan: async (input) => {
        calls.push(input)
        return { candidate: calls.length === 1 ? ignored : validCandidate(request), model: 'gpt-6-luna' }
      },
    }
    const result = await new AiMapPlanner(provider).plan(request)
    expect(calls[1]?.repair?.validationErrors).toEqual(expect.arrayContaining(['Biome snow fehlt.', 'Wassermerkmal river fehlt.']))
    expect(result.source).toBe('ai')
  })
})
