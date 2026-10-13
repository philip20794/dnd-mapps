import { describe, expect, it } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { PlacedToken } from '@/types/tokens'
import {
  combineVisibilityPolygons,
  combineVisibilityPolygonsWithLights,
  combineVisibilityPolygonsWithPreparedGeometry,
  computeVisibilityPolygon,
  doorVisibilitySegments,
  polygonContainsPoint,
  prepareVisibilityGeometry,
  raySegmentIntersection,
  visibilitySegmentsForMap,
  visibilitySegmentsNear,
  visibilityTokenStateKey,
} from './visibility'
import alteKrypta from '@/maps/alte-krypta.map'

const baseMap: MapDefinition = {
  id: 'test-map',
  name: 'Testkarte',
  width: 10,
  height: 10,
  gridSize: 48,
  objects: [],
  walls: [
    { id: 'wall', a: { x: 5, y: 0 }, b: { x: 5, y: 10 }, blocksSight: true, blocksMovement: true },
  ],
  doors: [
    {
      id: 'door',
      label: 'Tür',
      segment: { a: { x: 5, y: 4 }, b: { x: 5, y: 6 } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    },
  ],
  spawnPoints: [],
}

const token = (id: string, x: number, y: number): PlacedToken => ({
  id,
  mapId: 'test-map',
  name: id,
  position: { x, y },
  size: 1,
  rotation: 0,
  visionRange: 4,
  visionAngle: null,
  visionEnabled: true,
  category: 'player',
  color: '#ffffff',
  symbol: 'T',
})

describe('Sichtberechnung', () => {
  it('berechnet Schnittpunkte zwischen Strahl und Wandsegment', () => {
    const hit = raySegmentIntersection(
      { x: 1, y: 1 },
      0,
      { a: { x: 3, y: 0 }, b: { x: 3, y: 4 } },
      10,
    )
    expect(hit?.point.x).toBeCloseTo(3)
    expect(hit?.point.y).toBeCloseTo(1)
    expect(hit?.distance).toBeCloseTo(2)
  })

  it('begrenzt ein Sichtpolygon an einer einfachen Wand', () => {
    const polygons = combineVisibilityPolygons([token('a', 2, 5)], baseMap, { door: 'open' })
    expect(polygons).toHaveLength(1)
    const maxX = Math.max(...polygons[0]!.map((point) => point.x))
    expect(maxX).toBeLessThanOrEqual(5.001)
  })

  it('behandelt geschlossene und geöffnete Türen unterschiedlich', () => {
    expect(doorVisibilitySegments(baseMap.doors, { door: 'closed' })).toHaveLength(1)
    expect(doorVisibilitySegments(baseMap.doors, { door: 'open' })).toHaveLength(0)
  })

  it('kombiniert Sichtflächen mehrerer Tokens', () => {
    const polygons = combineVisibilityPolygons([token('a', 2, 2), token('b', 8, 8)], baseMap, {
      door: 'open',
    })
    expect(polygons).toHaveLength(2)
    expect(polygons.every((polygon) => polygon.length > 8)).toBe(true)
  })

  it('nimmt geschlossene Türen in die Kartensegmente auf', () => {
    const closed = visibilitySegmentsForMap(baseMap, { door: 'closed' })
    const open = visibilitySegmentsForMap(baseMap, { door: 'open' })
    expect(closed.length).toBe(open.length + 1)
  })

  it('verwendet vorbereitete Geometrie und invalidiert sie über Türzustände', () => {
    const closed = prepareVisibilityGeometry(baseMap, { door: 'closed' })
    const open = prepareVisibilityGeometry(baseMap, { door: 'open' })
    expect(closed.segments).toHaveLength(open.segments.length + 1)

    const direct = combineVisibilityPolygonsWithLights([token('a', 2, 5)], baseMap, {}, [])
    const prepared = combineVisibilityPolygonsWithPreparedGeometry(
      [token('a', 2, 5)],
      baseMap,
      prepareVisibilityGeometry(baseMap, {}),
      [],
    )
    expect(prepared).toEqual(direct)
  })

  it('ändert den Sichtschlüssel nur bei sichtrelevanten Token-Daten', () => {
    const original = token('a', 2, 5)
    expect(visibilityTokenStateKey([{ ...original, name: 'Anderer Name', color: '#ff0000' }])).toBe(
      visibilityTokenStateKey([original]),
    )
    expect(visibilityTokenStateKey([{ ...original, position: { x: 3, y: 5 } }])).not.toBe(
      visibilityTokenStateKey([original]),
    )
  })

  it('reduziert die Hindernisprüfung auf Segmente im Sichtbereich', () => {
    const nearby = { a: { x: 4, y: 0 }, b: { x: 4, y: 4 } }
    const distant = Array.from({ length: 100 }, (_value, index) => ({
      a: { x: 20 + index, y: 0 },
      b: { x: 20 + index, y: 4 },
    }))
    const candidates = visibilitySegmentsNear([nearby, ...distant], { x: 2, y: 2 }, 4)
    expect(candidates).toEqual([nearby])
    const input = {
      origin: { x: 2, y: 2 },
      range: 4,
      rotationDegrees: 0,
      visionAngleDegrees: null,
      segments: [nearby, ...distant],
    }
    expect(computeVisibilityPolygon({ ...input, intersectionSegments: candidates })).toEqual(
      computeVisibilityPolygon(input),
    )
  })

  it('berechnet Sicht für den Starttoken der Alten Krypta', () => {
    const polygons = combineVisibilityPolygons(alteKrypta.startTokens ?? [], alteKrypta, {
      'door-south-crypt': 'closed',
      'door-east-room': 'closed',
    })
    expect(polygons).toHaveLength(1)
    expect(polygons[0]!.length).toBeGreaterThan(20)
  })

  it('deckt den Radius einer erreichbaren Lichtquelle zusätzlich auf', () => {
    const openMap: MapDefinition = { ...baseMap, walls: [], doors: [] }
    const polygons = combineVisibilityPolygonsWithLights([token('a', 2, 5)], openMap, {}, [
      { id: 'torch', position: { x: 6.5, y: 5 }, range: 3 },
    ])
    expect(polygons).toHaveLength(2)
    expect(polygons.some((polygon) => polygonContainsPoint(polygon, { x: 8.5, y: 5 }))).toBe(true)
  })

  it('aktiviert Lichtquellen nicht durch Wände hindurch', () => {
    const polygons = combineVisibilityPolygonsWithLights([token('a', 2, 5)], baseMap, {}, [
      { id: 'torch', position: { x: 6.5, y: 5 }, range: 3 },
    ])
    expect(polygons).toHaveLength(1)
    expect(polygons.some((polygon) => polygonContainsPoint(polygon, { x: 8.5, y: 5 }))).toBe(false)
  })

  it('deckt Tageslichtbereiche auf, wenn ein Token darin steht', () => {
    const openMap: MapDefinition = { ...baseMap, walls: [], doors: [] }
    const daylightToken = { ...token('outside', 7, 7), visionRange: 2 }
    const polygons = combineVisibilityPolygonsWithLights([daylightToken], openMap, {}, [
      { kind: 'daylight-area', id: 'sun', bounds: { x: 6, y: 6, width: 3, height: 3 } },
    ])
    expect(polygons.some((polygon) => polygonContainsPoint(polygon, { x: 8.8, y: 8.8 }))).toBe(true)
  })

  it('deckt Tageslichtbereiche nicht aus der Entfernung automatisch auf', () => {
    const openMap: MapDefinition = { ...baseMap, walls: [], doors: [] }
    const polygons = combineVisibilityPolygonsWithLights([token('inside', 2, 2)], openMap, {}, [
      { kind: 'daylight-area', id: 'sun', bounds: { x: 6, y: 6, width: 3, height: 3 } },
    ])
    expect(polygons.some((polygon) => polygonContainsPoint(polygon, { x: 8.8, y: 8.8 }))).toBe(
      false,
    )
  })
})
