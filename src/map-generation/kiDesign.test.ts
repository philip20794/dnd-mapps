import { describe, expect, it, vi } from 'vitest'
import { applyKiMapDesign, createKiDesignContext, parseKiMapDesign } from './kiDesign.js'
import { KiApiMapPlannerClient } from './kiPlannerClient.js'

const design = {
  name: 'Vergessene Zwergenmine',
  brief: 'Eine Mine mit großem Ritualtempel und geheimen Passagen.',
  mapType: 'dungeon',
  biome: 'underground',
  settlement: 'mine',
  water: 'none',
  atmosphere: 'dark',
  terrain: 'flat',
  archetype: 'branching-delves',
  structure: 'branching',
  landmarkKind: 'altar',
  storyHookKind: 'ritual',
  sceneFeatureKind: 'ritual-site',
  roomRoles: [{ id: 'room-2', role: 'crypt' }],
} as const

describe('KI design validation and application', () => {
  it('enriches an initial random map semantically without inventing geometry', () => {
    const request = { seed: 71, description: 'Eine verlassene Mine', aiEnabled: true }
    const result = applyKiMapDesign(request, design)
    expect(result.seed).toBe(71)
    expect(result.theme.mapType).toBe('dungeon')
    expect(result.theme.biome).toBe('underground')
    expect(result.name).toBe('Vergessene Zwergenmine')
    expect(result.brief).toContain('Eine verlassene Mine')
    expect(result.landmarks[0]?.kind).toBe('altar')
    expect(result.rooms.find((room) => room.id === 'room-2')?.role).toBe('crypt')
    expect(result.dimensions.width).toBeGreaterThan(0)
    expect(applyKiMapDesign(request, design)).toEqual(result)
  })

  it('never overwrites explicit user preferences', () => {
    const plan = applyKiMapDesign({
      seed: 72, mapType: 'outdoor', biomes: ['forest'],
      water: 'none', theme: 'none', atmosphere: 'magical', terrain: 'hilly',
    }, design)
    expect(plan.theme.mapType).toBe('outdoor')
    expect(plan.theme.biome).toBe('forest')
    expect(plan.theme.waterFeatures).toEqual([])
    expect(plan.theme.settlements).toEqual([])
    expect(plan.theme.atmosphere).toBe('magical')
    expect(plan.theme.terrain).toBe('hilly')
  })

  it('rejects invalid enum values and oversized plans', () => {
    expect(() => parseKiMapDesign({ ...design, mapType: 'spaceship' })).toThrow()
    expect(() => parseKiMapDesign({ ...design, roomRoles: Array(13).fill(design.roomRoles[0]) })).toThrow()
    expect(() => parseKiMapDesign({ ...design, name: '' })).toThrow()
  })

  it('sends no credentials to browser and validates responses', async () => {
    const request = { seed: 73, mapType: 'dungeon' as const }
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
      const outgoing = JSON.parse(init?.body as string) as { context: ReturnType<typeof createKiDesignContext> }
      expect(outgoing.context.rooms.length).toBeGreaterThan(0)
      return new Response(JSON.stringify({ design }))
    })
    const planner = new KiApiMapPlannerClient(fetcher as unknown as typeof fetch)
    const response = await planner.plan(request)
    expect(fetcher).toHaveBeenCalledWith('/api/ki-map-design', expect.anything())
    expect(response.source).toBe('ai')
    expect(response.debug?.model).toBe('ki-api-chat')
    expect(response.plan.seed).toBe(73)
  })
})
