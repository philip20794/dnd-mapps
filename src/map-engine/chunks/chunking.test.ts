import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry, resolveMapObject } from '@/map-objects'
import { createLocalMapPlan } from '@/map-generation'
import { createRegionBasedOutdoorMap } from '@/maps/outdoor-generation'
import {
  chunksInView,
  createStaticObjectChunks,
  detailLevelForZoom,
  isStaticChunkCandidate,
  objectVisibleAtDetail,
  profileMapRendering,
  visibleMapBounds,
} from '.'

describe('statisches Map-Chunking', () => {
  it('klassifiziert nur nicht animierte, nicht interaktive Renderer als statisch', () => {
    const registry = createDefaultObjectRegistry()
    const tree = resolveMapObject(
      { id: 'tree', type: 'tree', preset: 'old-oak', position: { x: 1, y: 1 } },
      registry,
      0,
    )
    const fire = resolveMapObject(
      { id: 'fire', type: 'campfire', preset: 'small-campfire', position: { x: 2, y: 2 } },
      registry,
      1,
    )
    const door = resolveMapObject(
      {
        id: 'door',
        type: 'wooden-door',
        preset: 'closed-wooden-door',
        position: { x: 3, y: 3 },
      },
      registry,
      2,
    )

    expect(isStaticChunkCandidate(tree)).toBe(true)
    expect(isStaticChunkCandidate(fire)).toBe(false)
    expect(isStaticChunkCandidate(door)).toBe(false)
  })

  it('gruppiert statische Objekte deterministisch in 16x16-Chunks', () => {
    const registry = createDefaultObjectRegistry()
    const objects = [
      { id: 'a', type: 'tree', preset: 'old-oak', position: { x: 1, y: 1 } },
      { id: 'b', type: 'tree', preset: 'old-oak', position: { x: 16, y: 4 } },
      { id: 'c', type: 'tree', preset: 'old-oak', position: { x: 34, y: 34 } },
    ].map((object, index) => resolveMapObject(object, registry, index))
    const chunks = createStaticObjectChunks(objects, 50, 50)

    expect(chunks.map((chunk) => chunk.key)).toEqual(['0,0', '16,0', '32,32'])
    expect(chunks.flatMap((chunk) => chunk.objects.map((object) => object.id))).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(chunksInView(chunks, { minX: 0, minY: 0, maxX: 17, maxY: 17 })).toHaveLength(2)
  })

  it('berechnet den sichtbaren Kartenbereich auch mit Rotation', () => {
    const map = { width: 100, height: 80, gridSize: 10 }
    const camera = { x: 0, y: 0, zoom: 1 }
    const normal = visibleMapBounds(map, camera, 0, { width: 200, height: 100 }, 0)
    const rotated = visibleMapBounds(map, camera, 90, { width: 200, height: 100 }, 0)

    expect(normal).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 10 })
    expect(rotated.minX).toBe(0)
    expect(rotated.maxY).toBe(80)
    expect(rotated).not.toEqual(normal)
  })

  it('reduziert im Überblick kleine Dekoration und im Ausschnitt entfernte Chunks', () => {
    const map = createRegionBasedOutdoorMap(
      createLocalMapPlan({
        seed: 771_501,
        mapType: 'outdoor',
        size: 'custom',
        width: 150,
        height: 150,
        biomes: ['forest'],
        waterFeatures: ['river'],
      }),
    ).map
    const full = profileMapRendering(map, { minX: 0, minY: 0, maxX: 150, maxY: 150 }, 0.2)
    const detail = profileMapRendering(map, { minX: 32, minY: 32, maxX: 72, maxY: 62 }, 0.7)

    expect(full.staticObjects).toBeGreaterThan(500)
    expect(full.visibleStaticObjects).toBeLessThan(full.staticObjects)
    expect(detail.visibleStaticChunks).toBeLessThan(detail.staticChunks / 2)
    expect(detail.visibleMaterialChunks).toBeLessThan(detail.materialChunks / 2)
    expect(detail.estimatedRenderableNodesAfter).toBeLessThan(detail.estimatedRenderableNodesBefore)
  })

  it('behält wichtige Szenen bei jeder Zoomstufe sichtbar', () => {
    const registry = createDefaultObjectRegistry()
    const prop = resolveMapObject(
      {
        id: 'scene-prop',
        type: 'crate',
        preset: 'small-crate',
        position: { x: 1, y: 1 },
        width: 0.4,
        height: 0.4,
        tags: ['set-dressing'],
      },
      registry,
      0,
    )
    expect(detailLevelForZoom(0.2)).toBe('overview')
    expect(objectVisibleAtDetail(prop, 'overview', 48, 0.2)).toBe(true)
  })
})
