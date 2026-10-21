import { describe, expect, it } from 'vitest'
import { createLocalMapPlan, validateMapPlan } from './index.js'
import { chooseBestLocalPlan, assessMapPlanQuality } from './quality.js'

describe('LocalMapPlanner', () => {
  it('plant dieselbe Anfrage mit demselben Seed identisch', () => {
    const request = {
      seed: 481516,
      mapType: 'dungeon' as const,
      biomes: ['volcanic'] as const,
      waterFeatures: ['flooded'] as const,
      themes: ['temple', 'mine'] as const,
      atmosphere: 'dark' as const,
      dungeon: { roomCount: 12, levelCount: 3, entranceCount: 2, loops: 'many' as const, secretRooms: true, largeHalls: true, bossRoom: true, naturalCaveRatio: 0.5 },
    }
    expect(createLocalMapPlan(request)).toEqual(createLocalMapPlan(request))
  })

  it('liefert über viele Seeds ausschließlich valide Pläne und streut breit', () => {
    const plans = Array.from({ length: 240 }, (_, seed) => createLocalMapPlan({ seed }))
    for (const plan of plans) expect(validateMapPlan(plan)).toEqual([])
    expect(new Set(plans.map((plan) => plan.theme.mapType)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(plans.map((plan) => plan.theme.biome)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(plans.map((plan) => plan.layout.archetype)).size).toBeGreaterThanOrEqual(9)
  })

  it('behandelt gesetzte Werte als Vorgaben und erzeugt die verlangte Struktur', () => {
    const plan = createLocalMapPlan({
      seed: 17,
      mapType: 'dungeon',
      biomes: ['snow'],
      waterFeatures: ['flooded'],
      themes: ['mine'],
      atmosphere: 'dark',
      terrain: 'cliffs',
      size: 'huge',
      dungeon: { roomCount: 12, levelCount: 3, entranceCount: 2, loops: 'many', secretRooms: true, largeHalls: true, bossRoom: true, naturalCaveRatio: 0.5 },
    })
    expect(plan.theme).toMatchObject({ mapType: 'dungeon', biomes: ['snow'], waterFeatures: ['flooded'], settlements: ['mine'], atmosphere: 'dark', terrain: 'cliffs' })
    expect(plan.levels).toHaveLength(3)
    expect(plan.rooms).toHaveLength(12)
    expect(plan.entrances).toHaveLength(2)
    expect(plan.layout.connectionStructure).toBe('looped')
    expect(plan.specialFeatures.map((feature) => feature.kind)).toEqual(expect.arrayContaining(['secret-room', 'large-hall', 'boss-objective', 'natural-cave']))
  })

  it('ergänzt nur notwendige Kompatibilität und zwingt Vulkan nicht in einen Dungeon', () => {
    const volcanicOutdoors = createLocalMapPlan({ seed: 8, mapType: 'outdoor', biomes: ['volcanic'] })
    const coast = createLocalMapPlan({ seed: 9, mapType: 'coast' })
    expect(volcanicOutdoors.theme.mapType).toBe('outdoor')
    expect(volcanicOutdoors.theme.biomes).toContain('volcanic')
    expect(coast.theme.waterFeatures).toContain('coast')
  })

  it('respektiert explizit abgewählte optionale Merkmale', () => {
    const plan = createLocalMapPlan({ seed: 11, mapType: 'outdoor', water: 'none', theme: 'none' })
    expect(plan.theme.waterFeatures).toEqual([])
    expect(plan.theme.settlements).toEqual([])
  })
})

describe('quality-selected local map planning', () => {
  it('is deterministic, seed-preserving and connected', () => {
    for (const seed of [1, 2, 42, 1000]) {
      const request = { seed, mapType: 'dungeon' as const, dungeon: { roomCount: 12 } }
      const plan = chooseBestLocalPlan(request)
      expect(plan).toEqual(chooseBestLocalPlan(request))
      expect(plan.seed).toBe(seed)
      expect(validateMapPlan(plan)).toEqual([])
      expect(assessMapPlanQuality(plan).unreachableNodeIds).toEqual([])
    }
  })

  it('reports a disconnected room without changing any map', () => {
    const plan = createLocalMapPlan({ seed: 12, mapType: 'dungeon' })
    const disconnected = { ...plan, connections: [] }
    expect(assessMapPlanQuality(disconnected).unreachableNodeIds.length).toBeGreaterThan(0)
  })
})
