import { describe, expect, it } from 'vitest'
import { compileMaterialLayer } from '@/map-materials'
import type { MapDefinition } from '@/maps/api'
import burgNaerytarDungeonMap from '@/maps/burg-naerytar-dungeon.map'
import type { MapEditorState } from './types'
import { exportMapToJson, importMapFromJson } from './mapEditor'
import {
  eraseMaterialStroke,
  findMaterialSelection,
  paintMaterialStroke,
  placeMaterialDecal,
  sampleBrushCells,
  updateMaterialArea,
} from './materialOperations'

const map = (): MapDefinition => ({
  id: 'materials-editor-test',
  name: 'Materialeditor',
  width: 40,
  height: 30,
  gridSize: 48,
  levels: [
    { id: 'ground', name: 'Unten' },
    { id: 'upper', name: 'Oben' },
  ],
  defaultLevelId: 'ground',
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
  materialLayers: [
    {
      id: 'base-ground',
      levelId: 'ground',
      seed: 1,
      chunkSize: 16,
      areas: [{ id: 'base', material: 'dirt', position: { x: 0, y: 0 }, width: 40, height: 30 }],
    },
    {
      id: 'base-upper',
      levelId: 'upper',
      seed: 2,
      areas: [
        { id: 'upper-base', material: 'snow', position: { x: 0, y: 0 }, width: 40, height: 30 },
      ],
    },
  ],
})

const state = (overrides: Partial<MapEditorState> = {}): MapEditorState => ({
  tool: 'material-brush',
  selection: null,
  snap: false,
  objectTemplate: null,
  material: 'stone',
  brushSize: 'medium',
  materialRotation: 90,
  materialScale: 1,
  materialAlpha: 0.8,
  materialTransition: 'rough',
  decalKind: 'crack',
  ...overrides,
})

const cellMaterials = (definition: MapDefinition, levelId: string) =>
  (definition.materialLayers ?? [])
    .filter((layer) => (layer.levelId ?? 'ground') === levelId)
    .flatMap((layer) =>
      compileMaterialLayer(layer, definition.width, definition.height).flatMap(
        (chunk) => chunk.cells,
      ),
    )

describe('material editor operations', () => {
  it('interpolates slow and fast pointer input without gaps and supports three brush sizes', () => {
    const slow = sampleBrushCells(
      [
        { x: 2, y: 5 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
        { x: 12, y: 5 },
      ],
      'small',
      map(),
    )
    const fast = sampleBrushCells(
      [
        { x: 2, y: 5 },
        { x: 12, y: 5 },
      ],
      'small',
      map(),
    )
    for (let x = 2; x < 12; x += 1) expect(fast.has(`${x},4`) || fast.has(`${x},5`)).toBe(true)
    expect(fast.size).toBe(slow.size)
    const medium = sampleBrushCells([{ x: 10, y: 10 }], 'medium', map())
    const large = sampleBrushCells([{ x: 10, y: 10 }], 'large', map())
    expect(slow.size).toBeGreaterThan(0)
    expect(medium.size).toBeGreaterThan(sampleBrushCells([{ x: 10, y: 10 }], 'small', map()).size)
    expect(large.size).toBeGreaterThan(medium.size)
  })

  it('paints only the active level with serializable material properties and compact rectangles', () => {
    const result = paintMaterialStroke(
      map(),
      'ground',
      [
        { x: 2, y: 2 },
        { x: 25, y: 2 },
      ],
      state(),
    )
    const overlay = result.map.materialLayers?.find(
      (layer) => layer.id === 'editor-material-ground',
    )
    expect(overlay).toBeDefined()
    expect(overlay?.areas.length).toBeLessThan(8)
    expect(
      overlay?.areas.every(
        (area) => area.material === 'stone' && area.rotation === 90 && area.alpha === 0.8,
      ),
    ).toBe(true)
    expect(result.map.materialLayers?.find((layer) => layer.id === 'base-upper')?.areas).toEqual(
      map().materialLayers?.[1]?.areas,
    )
    expect(result.dirtyChunks.size).toBe(2)
    expect(JSON.parse(JSON.stringify(result.map))).toEqual(result.map)
  })

  it('erases the topmost material and reveals the layer beneath without touching other levels', () => {
    const painted = paintMaterialStroke(
      map(),
      'ground',
      [{ x: 5.5, y: 5.5 }],
      state({ brushSize: 'small' }),
    )
    expect(
      cellMaterials(painted.map, 'ground').some(
        (cell) => cell.x === 5 && cell.y === 5 && cell.material === 'stone',
      ),
    ).toBe(true)
    const erased = eraseMaterialStroke(painted.map, 'ground', [{ x: 5.5, y: 5.5 }], 'small')
    const overlay = erased.map.materialLayers?.find(
      (layer) => layer.id === 'editor-material-ground',
    )
    expect(overlay?.areas).toHaveLength(0)
    expect(
      cellMaterials(erased.map, 'ground').some(
        (cell) => cell.x === 5 && cell.y === 5 && cell.material === 'dirt',
      ),
    ).toBe(true)
    expect(cellMaterials(erased.map, 'upper').some((cell) => cell.material === 'snow')).toBe(true)
  })

  it('places, selects, edits and renders decals even on an otherwise empty editor layer', () => {
    const placed = placeMaterialDecal(
      map(),
      'ground',
      { x: 17, y: 8 },
      state({ decalKind: 'moss', brushSize: 'large' }),
    )
    const selection = placed.selection
    expect(selection?.kind).toBe('material-decal')
    expect(findMaterialSelection(placed.map, 'ground', { x: 18, y: 9 })).toEqual(selection)
    const layer = placed.map.materialLayers?.find((entry) => entry.id === 'editor-material-ground')
    expect(
      compileMaterialLayer(layer!, placed.map.width, placed.map.height).flatMap(
        (chunk) => chunk.decals,
      ),
    ).not.toHaveLength(0)
  })

  it('updates selected existing areas while preserving the material layer structure', () => {
    const updated = updateMaterialArea(map(), 'base-ground', 'base', {
      material: 'shallow-water',
      transition: 'shore',
      alpha: 0.7,
    })
    const area = updated.materialLayers?.[0]?.areas[0]
    expect(area).toMatchObject({ material: 'shallow-water', transition: 'shore', alpha: 0.7 })
    expect(updated.materialLayers?.[1]?.id).toBe('base-upper')
  })

  it('round-trips painted terrain and decals through the existing JSON import/export path', () => {
    const painted = paintMaterialStroke(
      map(),
      'ground',
      [
        { x: 3, y: 4 },
        { x: 11, y: 7 },
      ],
      state({ material: 'deep-water', materialTransition: 'shore' }),
    ).map
    const decorated = placeMaterialDecal(
      painted,
      'ground',
      { x: 6, y: 5 },
      state({ decalKind: 'leaves' }),
    ).map
    const imported = importMapFromJson(
      exportMapToJson(decorated),
      new Set(),
      '2026-10-15T10:00:00.000Z',
      () => 'material-roundtrip',
    )

    expect(imported.materialLayers).toEqual(decorated.materialLayers)
    expect(
      imported.materialLayers?.find((layer) => layer.id === 'editor-material-ground')?.decals,
    ).toHaveLength(1)
  })

  it('keeps large-map stroke compaction and runtime bounded', () => {
    let large: MapDefinition = { ...map(), width: 150, height: 150, materialLayers: [] }
    const started = performance.now()
    for (let y = 3; y < 145; y += 4) {
      large = paintMaterialStroke(
        large,
        'ground',
        [
          { x: 2, y },
          { x: 148, y },
        ],
        state({ brushSize: 'large' }),
      ).map
    }
    const elapsed = performance.now() - started
    const areas = large.materialLayers?.[0]?.areas.length ?? 0
    console.info(
      `MATERIAL_EDITOR_PROFILE=${JSON.stringify({ size: '150x150', strokes: 36, elapsedMs: Math.round(elapsed * 10) / 10, compactAreas: areas, jsonBytes: JSON.stringify(large).length, naiveSampledCells: 36 * 146 * 6 })}`,
    )
    expect(areas).toBeLessThan(80)
    expect(JSON.stringify(large).length).toBeLessThan(80_000)
    expect(elapsed).toBeLessThan(2_500)
  })

  it('edits Burg Naerytar without multiplying its existing material areas', () => {
    const originalAreaCount = (burgNaerytarDungeonMap.materialLayers ?? []).reduce(
      (sum, layer) => sum + layer.areas.length,
      0,
    )
    const started = performance.now()
    const edited = paintMaterialStroke(
      burgNaerytarDungeonMap,
      'ground',
      [
        { x: 8, y: 8 },
        { x: 18, y: 12 },
        { x: 30, y: 18 },
      ],
      state({ material: 'mud', brushSize: 'medium' }),
    ).map
    const elapsed = performance.now() - started
    const editedAreaCount = (edited.materialLayers ?? []).reduce(
      (sum, layer) => sum + layer.areas.length,
      0,
    )
    console.info(
      `BURG_NAERYTAR_MATERIAL_EDIT=${JSON.stringify({ elapsedMs: Math.round(elapsed * 10) / 10, originalAreas: originalAreaCount, editedAreas: editedAreaCount })}`,
    )

    expect(editedAreaCount - originalAreaCount).toBeLessThan(20)
    expect(elapsed).toBeLessThan(250)
  })
})
