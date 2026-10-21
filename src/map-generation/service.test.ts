import { describe, expect, it } from 'vitest'
import { LocalMapPlanner } from './localPlanner.js'
import { MapGenerationService, withoutMapGenerationSeed } from './service.js'
import { AiMapPlannerClientError, HttpAiMapPlannerClient, type AiMapPlannerClient } from './aiPlannerClient.js'
import { validateMapDefinition } from '@/maps/validation'
import { createDefaultObjectRegistry } from '@/map-objects'

const seedSequence = (...seeds: number[]): (() => number) => {
  let index = 0
  return () => {
    const seed = seeds[index]
    index += 1
    if (seed === undefined) throw new Error('Test-Seedfolge ist erschöpft.')
    return seed
  }
}

describe('MapGenerationService', () => {
  it('normalisiert die Anfrage, plant lokal und speichert Plan plus Seed in der Karte', async () => {
    const service = new MapGenerationService()
    const result = await service.generate({
      seed: 91,
      mapType: 'dungeon',
      biomes: ['volcanic'],
      atmosphere: 'dark',
    })

    expect(result.planner).toBe('local')
    expect(result.request.seed).toBe(91)
    expect(result.plan.seed).toBe(91)
    expect(result.map.generation).toMatchObject({
      pipelineVersion: 1,
      planner: 'local',
      request: { seed: 91 },
      plan: { seed: 91, schemaVersion: 1 },
    })
    expect(result.map.generation?.plan).toEqual(result.plan)
  })

  it('liefert einen validierten lokalen MapDefinition-Output', async () => {
    const service = new MapGenerationService()
    const result = await service.generate({ seed: 27, mapType: 'dungeon' })
    expect(validateMapDefinition(result.map, createDefaultObjectRegistry())).toEqual([])
  })

  it('wählt bei aktivierter KI den entfernten Planner und validiert dessen Plan', async () => {
    const request = { seed: 44, aiEnabled: true, mapType: 'cave' as const }
    const plan = new LocalMapPlanner().plan(request)
    const aiPlanner: AiMapPlannerClient = {
      plan: async () => ({
        plan,
        source: 'ai',
        debug: { model: 'gpt-6-luna', attempts: 1 },
      }),
    }
    const result = await new MapGenerationService(new LocalMapPlanner(), aiPlanner).generate(request)

    expect(result.planner).toBe('ai')
    expect(result.plan).toEqual(plan)
    expect(result.map.generation?.debug).toEqual({ model: 'gpt-6-luna', attempts: 1 })
  })

  it('fällt bei KI- oder Antwortfehlern ohne Fehler nach lokal zurück', async () => {
    const aiPlanner: AiMapPlannerClient = {
      plan: async () => {
        throw new Error('unavailable')
      },
    }
    const result = await new MapGenerationService(new LocalMapPlanner(), aiPlanner).generate({
      seed: 73,
      aiEnabled: true,
    })

    expect(result.planner).toBe('local-fallback')
    expect(result.plan.seed).toBe(73)
    expect(result.map.generation?.planner).toBe('local-fallback')
    expect(result.map.generation?.debug?.fallbackReason).toBe('worker-unreachable')
  })

  it('typisiert einen Worker-429 als Rate-Limit-Fallback', async () => {
    const client = new HttpAiMapPlannerClient(
      async () => new Response('{"error":{"code":"WORKER_RATE_LIMITED"}}', { status: 429 }),
      'https://worker.example',
    )
    const result = await new MapGenerationService(new LocalMapPlanner(), client).generate({
      seed: 74,
      aiEnabled: true,
    })

    expect(result.planner).toBe('local-fallback')
    expect(result.map.generation?.debug?.fallbackReason).toBe('worker-rate-limited')
  })

  it('typisiert einen nicht erreichbaren Worker als Fallback', async () => {
    const aiPlanner: AiMapPlannerClient = {
      plan: async () => {
        throw new AiMapPlannerClientError('request_failed')
      },
    }
    const result = await new MapGenerationService(new LocalMapPlanner(), aiPlanner).generate({
      seed: 75,
      aiEnabled: true,
    })

    expect(result.planner).toBe('local-fallback')
    expect(result.map.generation?.debug?.fallbackReason).toBe('worker-unreachable')
  })

  it('erstellt bei zwei normalen Generierungen neue Seeds, Pläne und Karten', async () => {
    const service = new MapGenerationService(
      new LocalMapPlanner(),
      undefined,
      seedSequence(10_101, 20_202),
    )
    const wishes = {
      mapType: 'outdoor' as const,
      biomes: ['forest'] as const,
      waterFeatures: ['river'] as const,
    }

    const first = await service.generateNew(wishes)
    const second = await service.generateNew(wishes)

    expect(first.request.seed).toBe(10_101)
    expect(second.request.seed).toBe(20_202)
    expect(second.plan).not.toEqual(first.plan)
    expect(second.map).not.toEqual(first.map)
    expect(second.map.objects).not.toEqual(first.map.objects)
  })

  it('erhält dieselben Wünsche, aber verwirft den alten Seed und MapPlan bei einer neuen Generierung', async () => {
    const service = new MapGenerationService(
      new LocalMapPlanner(),
      undefined,
      seedSequence(30_303),
    )
    const previous = await service.generate({
      seed: 77,
      mapType: 'dungeon',
      biomes: ['volcanic'],
      dungeon: { roomCount: 12, loops: 'many' },
    })

    const fresh = await service.generateNew(previous.map.generation!.request)

    expect(fresh.request).toMatchObject({
      seed: 30_303,
      mapType: 'dungeon',
      biomes: ['volcanic'],
      dungeon: { roomCount: 12, loops: 'many' },
    })
    expect(fresh.plan.seed).toBe(30_303)
    expect(fresh.plan).not.toEqual(previous.plan)
    expect(fresh.map).not.toEqual(previous.map)
    expect(withoutMapGenerationSeed(previous.map.generation!.request)).not.toHaveProperty('seed')
  })

  it('behält einen expliziten Seed für reproduzierbare Aufrufe von generate', async () => {
    const service = new MapGenerationService(
      new LocalMapPlanner(),
      undefined,
      seedSequence(99_999),
    )
    const request = {
      seed: 4_242,
      mapType: 'outdoor' as const,
      biomes: ['forest'] as const,
      waterFeatures: ['river'] as const,
    }

    const first = await service.generate(request)
    const second = await service.generate(request)

    expect(first.request.seed).toBe(4_242)
    expect(second.request.seed).toBe(4_242)
    expect(second.plan).toEqual(first.plan)
    expect(second.map).toEqual(first.map)
  })

  it('kann dieselbe Übergangskarte aus gespeichertem Request und MapPlan erneut aufbauen', async () => {
    const service = new MapGenerationService()
    const first = await service.generate({ seed: 123, mapType: 'outdoor', biomes: ['forest'] })
    const rebuilt = service.regenerate(first.request, first.plan)

    expect(rebuilt.map).toMatchObject({
      id: first.map.id,
      name: first.map.name,
      objects: first.map.objects,
      walls: first.map.walls,
      doors: first.map.doors,
    })
    expect(rebuilt.map.generation?.plan).toEqual(first.plan)
  })
})
