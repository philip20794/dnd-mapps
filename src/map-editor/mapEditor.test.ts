import { describe, expect, it } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import {
  createEditableMapCopy,
  exportMapToJson,
  importMapFromJson,
  MapImportError,
  parseMapDefinition,
} from './mapEditor'

const sourceMap: MapDefinition = {
  id: 'source-map',
  name: 'Quellkarte',
  width: 12,
  height: 8,
  gridSize: 48,
  levels: [
    { id: 'ground', name: 'Erdgeschoss' },
    { id: 'upper', name: 'Obergeschoss' },
  ],
  defaultLevelId: 'ground',
  objects: [],
  materialLayers: [],
  walls: [{ a: { x: 1, y: 1 }, b: { x: 4, y: 1 }, blocksSight: true, blocksMovement: true }],
  doors: [],
  spawnPoints: [{ id: 'spawn', name: 'Start', position: { x: 2, y: 2 }, radius: 1 }],
  startTokens: [
    {
      id: 'hero',
      mapId: 'source-map',
      levelId: 'ground',
      name: 'Held',
      position: { x: 2, y: 2 },
      size: 1,
      rotation: 0,
      visionRange: 8,
      visionAngle: null,
      visionEnabled: true,
      category: 'player',
      color: '#3f8cff',
      symbol: 'H',
    },
  ],
}

describe('map editor serialization', () => {
  it('copies a source map without mutating it and rebases start tokens', () => {
    const copy = createEditableMapCopy(
      sourceMap,
      new Set([sourceMap.id]),
      '2026-10-14T10:00:00.000Z',
      () => 'custom-map-one',
    )

    expect(copy.id).toBe('custom-map-one')
    expect(copy.editor).toEqual({
      schemaVersion: 1,
      sourceMapId: sourceMap.id,
      updatedAt: '2026-10-14T10:00:00.000Z',
    })
    expect(copy.levels).toEqual(sourceMap.levels)
    expect(copy.walls).toEqual(sourceMap.walls)
    expect(copy.spawnPoints).toEqual(sourceMap.spawnPoints)
    expect(copy.startTokens?.[0]?.mapId).toBe('custom-map-one')
    expect(sourceMap.startTokens?.[0]?.mapId).toBe('source-map')
  })

  it('exports and imports all map data and avoids id collisions', () => {
    const copy = createEditableMapCopy(
      sourceMap,
      new Set([sourceMap.id]),
      '2026-10-14T10:00:00.000Z',
      () => 'custom-map-one',
    )
    const json = exportMapToJson(copy)
    const parsed = parseMapDefinition(JSON.parse(json))
    const imported = importMapFromJson(
      json,
      new Set([copy.id]),
      '2026-10-14T11:00:00.000Z',
      () => 'custom-map-two',
    )

    expect(parsed).toEqual(copy)
    expect(imported.id).toBe('custom-map-two')
    expect(imported.startTokens?.[0]?.mapId).toBe('custom-map-two')
    expect(imported.objects).toEqual(copy.objects)
    expect(imported.materialLayers).toEqual(copy.materialLayers)
    expect(imported.walls).toEqual(copy.walls)
    expect(imported.levels).toEqual(copy.levels)
  })

  it('rejects malformed and invalid map files with a readable error', () => {
    expect(() => importMapFromJson('{broken', new Set())).toThrow(MapImportError)
    expect(() => importMapFromJson(JSON.stringify({ id: 'partial' }), new Set())).toThrow(
      'keine vollständige',
    )
    expect(() =>
      importMapFromJson(JSON.stringify({ ...sourceMap, width: 0 }), new Set()),
    ).toThrow('ungültig')
  })
})
