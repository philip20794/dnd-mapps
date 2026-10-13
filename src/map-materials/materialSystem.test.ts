import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry } from '@/map-objects'
import { createLocalMapPlan } from '@/map-generation'
import { createGraphFirstDungeon } from '@/maps/dungeon-generation'
import { createRegionBasedOutdoorMap } from '@/maps/outdoor-generation'
import { validateMapDefinition } from '@/maps/validation'
import { compileMaterialLayer, extractMaterialLayer, validateMaterialLayer } from '.'
import type { MaterialLayerDefinition } from './types'

const layer: MaterialLayerDefinition = {
  id: 'test-materials',
  levelId: 'ground',
  seed: 4711,
  chunkSize: 8,
  areas: [
    { id: 'grass', material: 'grass', position: { x: 0, y: 0 }, width: 12, height: 8 },
    { id: 'river', material: 'shallow-water', position: { x: 5, y: 0 }, width: 2, height: 8 },
    { id: 'path', material: 'dirt', position: { x: 0, y: 3 }, width: 12, height: 1 },
  ],
}

describe('semantisches Materialsystem', () => {
  it('kompiliert deterministische Varianten, Rotation, Skalierung und Terrainkanten', () => {
    const first = compileMaterialLayer(layer, 12, 8)
    const second = compileMaterialLayer(layer, 12, 8)
    const cells = first.flatMap((chunk) => chunk.cells)

    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(1)
    expect(new Set(cells.map((cell) => cell.variant)).size).toBeGreaterThan(3)
    expect(new Set(cells.map((cell) => cell.rotation)).size).toBeGreaterThan(2)
    expect(new Set(cells.map((cell) => cell.scale)).size).toBeGreaterThan(10)
    expect(cells.some((cell) => cell.edges.length > 0)).toBe(true)
    expect(cells.every((cell) => cell.scale >= 0.94 && cell.scale <= 1.06)).toBe(true)
  })

  it('trennt statischen Boden von interaktiven und animierten Objekten', () => {
    const extracted = extractMaterialLayer(
      [
        {
          id: 'floor',
          type: 'ground-area',
          preset: 'forest-floor',
          position: { x: 0, y: 0 },
          width: 8,
          height: 6,
        },
        {
          id: 'river',
          type: 'river',
          preset: 'slow-river',
          position: { x: 2, y: 2 },
          width: 4,
          height: 1,
        },
        { id: 'door', type: 'wooden-door', preset: 'closed-wooden-door', position: { x: 1, y: 1 } },
      ],
      { id: 'materials', levelId: 'ground', seed: 123 },
    )

    expect(extracted.materialLayer?.areas.map((area) => area.material)).toEqual([
      'forest-floor',
      'shallow-water',
    ])
    expect(extracted.objects.map((object) => object.id)).toEqual(['river', 'door'])
  })

  it('validiert Grenzen, kontrollierte Skalierung und Decal-Dichte', () => {
    expect(validateMaterialLayer(layer, 12, 8)).toHaveLength(0)
    const errors = validateMaterialLayer(
      {
        ...layer,
        areas: [{ material: 'grass', position: { x: -1, y: 0 }, width: 4, height: 2, scale: 2 }],
        decals: [{ kind: 'moss', position: { x: 11.5, y: 1 }, width: 2, density: 1.5 }],
      },
      12,
      8,
    )
    expect(errors.join('\n')).toContain('ausserhalb')
    expect(errors.join('\n')).toContain('Skalierungsvariation')
    expect(errors.join('\n')).toContain('Dichte')
  })

  it('liefert in beiden neuen Generatorpfaden valide Materialkarten ohne Boden-Runtimeobjekte', () => {
    const dungeonPlan = createLocalMapPlan({ seed: 8091, mapType: 'dungeon', size: 'small' })
    const outdoorPlan = createLocalMapPlan({
      seed: 8092,
      mapType: 'outdoor',
      biomes: ['forest'],
      waterFeatures: ['river'],
      size: 'medium',
    })
    const maps = [
      createGraphFirstDungeon(dungeonPlan).map,
      createRegionBasedOutdoorMap(outdoorPlan).map,
    ]

    for (const map of maps) {
      expect(map.materialLayers?.length).toBeGreaterThan(0)
      expect(map.materialLayers?.flatMap((entry) => entry.areas).length).toBeGreaterThan(10)
      expect(map.objects.some((object) => object.type === 'ground-area')).toBe(false)
      expect(validateMapDefinition(map, createDefaultObjectRegistry())).toHaveLength(0)
    }
  })
})
