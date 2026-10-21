import { describe, expect, it } from 'vitest'
import { LocalMapPlanner } from './localPlanner.js'
import {
  MAP_PLAN_SCHEMA_VERSION,
  MapGenerationValidationError,
  createMapPlan,
  defaultMapGenerationRequest,
  normalizeMapGenerationRequest,
  parseMapGenerationRequest,
  resolveMapGenerationRequest,
  validateMapGenerationRequest,
  validateMapPlan,
  type MapPlan,
} from './index.js'

const validPlan: MapPlan = {
  schemaVersion: MAP_PLAN_SCHEMA_VERSION,
  id: 'forest-ruin-plan',
  name: 'Überwachsene Waldruine',
  seed: 42,
  dimensions: { width: 48, height: 36, size: 'large' },
  theme: {
    mapType: 'ruins',
    biomes: ['forest'],
    biome: 'forest',
    waterFeatures: ['river'],
    water: 'river',
    settlements: ['temple'],
    settlement: 'temple',
    atmosphere: 'overgrown',
    terrain: 'hilly',
  },
  layout: { archetype: 'winding-route', connectionStructure: 'branching' },
  levels: [{ id: 'ground', name: 'Oberfläche', order: 0, elevation: 0, kind: 'surface' }],
  regions: [{ id: 'ruin-zone', levelId: 'ground', kind: 'ruin-zone', size: 'large' }],
  rooms: [
    { id: 'sanctum', levelId: 'ground', regionId: 'ruin-zone', role: 'sanctum', size: 'medium' },
  ],
  areas: [
    { id: 'approach', levelId: 'ground', regionId: 'ruin-zone', kind: 'clearing', size: 'large' },
  ],
  connections: [{ id: 'approach-to-sanctum', fromId: 'approach', toId: 'sanctum', kind: 'path' }],
  entrances: [{ id: 'west-trail', targetId: 'approach', kind: 'road', levelId: 'ground' }],
  landmarks: [{ id: 'stone-circle', targetId: 'approach', kind: 'monolith', importance: 'focal' }],
  paths: [
    { id: 'main-trail', fromId: 'approach', toId: 'sanctum', kind: 'trail', importance: 'major' },
  ],
  waterFeatures: [{ id: 'forest-river', targetId: 'approach', kind: 'river', levelId: 'ground' }],
  specialFeatures: [{ id: 'hidden-chamber', targetId: 'sanctum', kind: 'secret-room' }],
  startArea: { targetId: 'approach', levelId: 'ground', entranceId: 'west-trail' },
  storyHooks: [{ id: 'ritual-hook', targetId: 'sanctum', kind: 'ritual' }],
  sceneFeatures: [{ id: 'watch-camp', targetId: 'approach', kind: 'watch-camp' }],
}

describe('Map-Generation-Domain', () => {
  it('akzeptiert eine vollständig optionale Anfrage und ergänzt stabile Defaults', () => {
    expect(validateMapGenerationRequest({})).toHaveLength(0)
    expect(resolveMapGenerationRequest({})).toEqual(defaultMapGenerationRequest)

    const resolved = resolveMapGenerationRequest({
      seed: 99,
      description: '  Eine geflutete Krypta  ',
      size: 'custom',
      width: 80,
      height: 56,
      dungeon: { roomCount: 16, secretRooms: true, naturalCaveRatio: 0.35 },
    })
    expect(resolved.seed).toBe(99)
    expect(resolved.description).toBe('Eine geflutete Krypta')
    expect(resolved.width).toBe(80)
    expect(resolved.height).toBe(56)
    expect(resolved.dungeon.roomCount).toBe(16)
    expect(resolved.dungeon.secretRooms).toBe(true)
    expect(resolved.dungeon.loops).toBe('few')
  })

  it('validiert Nutzereingaben zur Laufzeit', () => {
    expect(
      validateMapGenerationRequest({
        mapType: 'space-station',
        width: 0,
        dungeon: { naturalCaveRatio: 1.5, loops: 'sometimes' },
      }),
    ).toEqual(
      expect.arrayContaining([
        'mapType ist ungültig.',
        'width muss eine positive ganze Zahl sein.',
        'dungeon.naturalCaveRatio muss zwischen 0 und 1 liegen.',
        'dungeon.loops ist ungültig.',
      ]),
    )
    expect(() => parseMapGenerationRequest({ width: 0 })).toThrow(MapGenerationValidationError)
  })

  it('normalisiert Mehrfachauswahl ohne fehlende Entscheidungen zu erzwingen', () => {
    expect(
      normalizeMapGenerationRequest({
        biomes: ['forest', 'snow', 'forest'],
        themes: ['ruins', 'temple'],
        waterFeatures: ['river'],
      }),
    ).toMatchObject({
      biomes: ['forest', 'snow'],
      themes: ['ruins', 'temple'],
      waterFeatures: ['river'],
    })
    expect(normalizeMapGenerationRequest({ mapType: 'island' })).toMatchObject({
      mapType: 'island',
    })
  })

  it('akzeptiert einen kompakten, semantischen und referenziell gültigen Kartenplan', () => {
    expect(validateMapPlan(validPlan)).toHaveLength(0)
    expect(createMapPlan(validPlan)).toBe(validPlan)
  })

  it('lehnt falsche Schema-Versionen und kaputte Referenzen ab', () => {
    const errors = validateMapPlan({
      ...validPlan,
      schemaVersion: 2,
      connections: [{ id: 'broken', fromId: 'missing', toId: 'sanctum', kind: 'door' }],
      startArea: { targetId: 'missing', levelId: 'ground' },
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        `schemaVersion muss ${MAP_PLAN_SCHEMA_VERSION} sein.`,
        'connection.fromId referenziert kein bekanntes Element.',
        'startArea.targetId referenziert kein bekanntes Element.',
      ]),
    )
  })
})

describe('explicit none preferences', () => {
  it('preserves no-water and no-settlement wishes through normalization', () => {
    const normalized = normalizeMapGenerationRequest({ mapType: 'outdoor', water: 'none', theme: 'none' })
    expect(normalized.water).toBe('none')
    expect(normalized.theme).toBe('none')
    const plan = new LocalMapPlanner().plan(normalized)
    expect(plan.theme.waterFeatures).toEqual([])
    expect(plan.theme.settlements).toEqual([])
  })
})
