import { describe, expect, it } from 'vitest'
import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses.js'
import { createLocalMapPlan } from '../../src/map-generation/index.js'
import { AiProviderError } from './errors.js'
import { OpenAiMapPlannerProvider } from './openAiProviders.js'

const sdkResponse = (
  outputText: string,
  usage = { input_tokens: 14, output_tokens: 26, total_tokens: 40 },
): Pick<Response, 'output_text' | 'usage'> =>
  ({ output_text: outputText, usage } as Pick<Response, 'output_text' | 'usage'>)

describe('OpenAiMapPlannerProvider', () => {
  it('nutzt Luna, Responses Structured Outputs und gibt Tokenusage zurück', async () => {
    const plan = createLocalMapPlan({ seed: 12, mapType: 'cave' })
    let captured: ResponseCreateParamsNonStreaming | undefined
    const provider = new OpenAiMapPlannerProvider('server-secret', undefined, {
      create: async (parameters) => {
        captured = parameters
        return sdkResponse(JSON.stringify(plan))
      },
    })
    const output = await provider.generatePlan({ request: { seed: 12, mapType: 'cave' }, seed: 12 })
    expect(captured).toMatchObject({
      model: 'gpt-6-luna',
      store: false,
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'map_plan', strict: true } },
    })
    const serializedPrompt = JSON.stringify(captured?.input)
    expect(serializedPrompt).toContain('keine x/y-Koordinaten')
    expect(serializedPrompt).toContain('keine MapDefinition')
    expect(serializedPrompt).not.toContain('server-secret')
    expect(output).toEqual({
      candidate: JSON.parse(JSON.stringify(plan)),
      model: 'gpt-6-luna',
      tokenUsage: { inputTokens: 14, outputTokens: 26, totalTokens: 40 },
    })
  })

  it('übergibt Inspiration und kontrollierte Reparaturhinweise als Daten', async () => {
    let captured: ResponseCreateParamsNonStreaming | undefined
    const provider = new OpenAiMapPlannerProvider('secret', undefined, {
      create: async (parameters) => {
        captured = parameters
        return sdkResponse('{}')
      },
    })
    await provider.generatePlan({
      request: { seed: 4 },
      seed: 4,
      inspiration: {
        mapType: 'cave', environment: ['mushroom'], mainTheme: 'sunken-temple',
        structure: 'looped', condition: 'abandoned', landmark: 'statue',
        specialTerrain: 'canyon', unusualFeature: 'underground-river',
        layoutArchetype: 'branching-delves', water: 'lake',
      },
      repair: { validationErrors: ['Biome mushroom fehlt.'] },
    })
    const prompt = JSON.stringify(captured?.input)
    expect(prompt).toContain('sunken-temple')
    expect(prompt).toContain('underground-river')
    expect(prompt).toContain('Biome mushroom fehlt.')
  })

  it('liefert kaputtes JSON kontrolliert zur Validierung an den Planner weiter', async () => {
    const provider = new OpenAiMapPlannerProvider('secret', undefined, {
      create: async () => sdkResponse('{not-json'),
    })
    await expect(provider.generatePlan({ request: { seed: 5 }, seed: 5 })).resolves.toMatchObject({
      candidate: '{not-json',
      model: 'gpt-6-luna',
    })
  })

  it('kapselt SDK-Rate-Limits ohne Upstream-Details', async () => {
    const provider = new OpenAiMapPlannerProvider('secret', undefined, {
      create: async () => {
        throw { status: 429, headers: new Headers({ 'retry-after': '9' }), secret: 'must-not-leak' }
      },
    })
    try {
      await provider.generatePlan({ request: { seed: 6 }, seed: 6 })
      throw new Error('Rate-Limit-Fehler erwartet')
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError)
      expect(error).toMatchObject({ kind: 'rate_limit', retryAfterSeconds: 9 })
      expect(JSON.stringify(error)).not.toContain('must-not-leak')
    }
  })
})
