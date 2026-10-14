import { describe, expect, it } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { PlacedToken } from '@/types/tokens'
import {
  combineVisibilityPolygons,
  combineVisibilityPolygonsWithLights,
  combineVisibilityPolygonsWithPreparedGeometry,
  combineVisibilityFieldsWithPreparedGeometry,
  combineVisibleBlockers,
  computeVisibilityPolygon,
  doorVisibilitySegments,
  polygonContainsPoint,
  prepareVisibilityGeometry,
  raySegmentIntersection,
  visibilitySegmentsForMap,
  visibilityBlockersNear,
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

  it('berücksichtigt neue Spieler, aber keine Gegner ohne aktivierte Sicht', () => {
    const player = { ...token('player', 2, 2), visionRange: 8, category: 'player' as const }
    const monster = {
      ...token('monster', 8, 8),
      visionRange: 0,
      visionEnabled: false,
      category: 'monster' as const,
    }

    expect(combineVisibilityPolygons([player, monster], baseMap, { door: 'open' })).toHaveLength(1)
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

  it('liefert Reichweitenmetadaten getrennt von den Sichtpolygonen', () => {
    const visibleToken = { ...token('a', 2, 5), visionRange: 8 }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      baseMap,
      prepareVisibilityGeometry(baseMap, { door: 'closed' }),
      [],
    )

    expect(fields).toHaveLength(1)
    expect(fields[0]?.rangeBoundary).toEqual({ origin: visibleToken.position, range: 8 })
    expect(Math.max(...fields[0]!.polygon.map((point) => point.x))).toBeLessThanOrEqual(5.001)
  })

  it('behält geschlossene Türen im Feld hart und öffnet die Sicht nach dem Öffnen', () => {
    const doorOnlyMap: MapDefinition = { ...baseMap, walls: [] }
    const visibleToken = { ...token('a', 2, 5), visionRange: 8 }
    const closedFields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      doorOnlyMap,
      prepareVisibilityGeometry(doorOnlyMap, { door: 'closed' }),
      [],
    )
    const openFields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      doorOnlyMap,
      prepareVisibilityGeometry(doorOnlyMap, { door: 'open' }),
      [],
    )

    expect(polygonContainsPoint(closedFields[0]!.polygon, { x: 7, y: 5 })).toBe(false)
    expect(polygonContainsPoint(openFields[0]!.polygon, { x: 7, y: 5 })).toBe(true)
    expect(closedFields[0]?.rangeBoundary).toEqual(openFields[0]?.rangeBoundary)
  })

  it('markiert nur den tatsächlich getroffenen Teil einer Wand vor dem Token', () => {
    const visibleToken = { ...token('left', 2, 5), visionRange: 8 }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      baseMap,
      prepareVisibilityGeometry(baseMap, { door: 'open' }),
      [],
    )
    const blockers = combineVisibleBlockers(fields)

    expect(blockers).toHaveLength(1)
    expect(blockers[0]?.blockerId).toBe('wall:wall')
    expect(blockers[0]?.kind).toBe('wall')
    expect(blockers[0]?.visibleSegment.a.x).toBeCloseTo(5)
    expect(blockers[0]?.visibleSegment.b.x).toBeCloseTo(5)
    expect(blockers[0]!.visibleSegment.a.y).toBeLessThan(0.01)
    expect(blockers[0]!.visibleSegment.b.y).toBeGreaterThan(9.99)
  })

  it('zeigt dieselbe Wand auch von ihrer anderen sichtbaren Seite', () => {
    const visibleToken = { ...token('right', 8, 5), visionRange: 8 }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      baseMap,
      prepareVisibilityGeometry(baseMap, { door: 'open' }),
      [],
    )

    expect(combineVisibleBlockers(fields).map((blocker) => blocker.blockerId)).toEqual([
      'wall:wall',
    ])
  })

  it('hebt nur geschlossene sichtblockierende Türen hervor', () => {
    const doorOnlyMap: MapDefinition = { ...baseMap, walls: [] }
    const visibleToken = { ...token('left', 2, 5), visionRange: 8 }
    const fieldsFor = (state: 'closed' | 'open') =>
      combineVisibilityFieldsWithPreparedGeometry(
        [visibleToken],
        doorOnlyMap,
        prepareVisibilityGeometry(doorOnlyMap, { door: state }),
        [],
      )

    expect(combineVisibleBlockers(fieldsFor('closed')).map((blocker) => blocker.blockerId)).toEqual(
      ['door:door'],
    )
    expect(combineVisibleBlockers(fieldsFor('open'))).toEqual([])
  })

  it('markiert weder Wände außerhalb der Reichweite noch nicht sichtblockierende Wände', () => {
    const mapWithWalls: MapDefinition = {
      ...baseMap,
      walls: [
        {
          id: 'outside',
          a: { x: 6.05, y: 0 },
          b: { x: 6.05, y: 10 },
          blocksSight: true,
          blocksMovement: true,
        },
        {
          id: 'transparent',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 10 },
          blocksSight: false,
          blocksMovement: true,
        },
      ],
      doors: [],
    }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [token('short', 2, 5)],
      mapWithWalls,
      prepareVisibilityGeometry(mapWithWalls, {}),
      [],
    )

    expect(combineVisibleBlockers(fields)).toEqual([])
  })

  it('vereinigt überlappende Sichtfelder ohne doppelte Wandkonturen', () => {
    const visibleTokens = [
      { ...token('first', 2, 4), visionRange: 8 },
      { ...token('second', 2, 6), visionRange: 8 },
    ]
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      visibleTokens,
      baseMap,
      prepareVisibilityGeometry(baseMap, { door: 'open' }),
      [],
    )

    expect(combineVisibleBlockers(fields).map((blocker) => blocker.blockerId)).toEqual([
      'wall:wall',
    ])
  })

  it('berücksichtigt für Blockerkonturen ausschließlich die aktuelle Ebene', () => {
    const layeredMap: MapDefinition = {
      ...baseMap,
      levels: [
        { id: 'ground', name: 'Unten' },
        { id: 'upper', name: 'Oben' },
      ],
      defaultLevelId: 'ground',
      walls: [
        {
          id: 'ground-wall',
          levelId: 'ground',
          a: { x: 5, y: 0 },
          b: { x: 5, y: 10 },
          blocksSight: true,
          blocksMovement: true,
        },
        {
          id: 'upper-wall',
          levelId: 'upper',
          a: { x: 6, y: 0 },
          b: { x: 6, y: 10 },
          blocksSight: true,
          blocksMovement: true,
        },
      ],
      doors: [],
    }
    const groundFields = combineVisibilityFieldsWithPreparedGeometry(
      [{ ...token('ground-token', 2, 5), visionRange: 8, levelId: 'ground' }],
      layeredMap,
      prepareVisibilityGeometry(layeredMap, {}, 'ground'),
      [],
      'ground',
    )
    const upperFields = combineVisibilityFieldsWithPreparedGeometry(
      [{ ...token('upper-token', 2, 5), visionRange: 8, levelId: 'upper' }],
      layeredMap,
      prepareVisibilityGeometry(layeredMap, {}, 'upper'),
      [],
      'upper',
    )

    expect(combineVisibleBlockers(groundFields)[0]?.blockerId).toBe('wall:ground-wall')
    expect(combineVisibleBlockers(upperFields)[0]?.blockerId).toBe('wall:upper-wall')
  })

  it('reduziert auch auf großen Karten die Konturprüfung auf nahe Blocker', () => {
    const farWalls = Array.from({ length: 2_000 }, (_value, index) => ({
      id: `far-${index}`,
      a: { x: 50 + index, y: 0 },
      b: { x: 50 + index, y: 20 },
      blocksSight: true,
      blocksMovement: true,
    }))
    const largeMap: MapDefinition = {
      ...baseMap,
      width: 2_100,
      walls: [
        {
          id: 'near',
          a: { x: 4, y: 0 },
          b: { x: 4, y: 10 },
          blocksSight: true,
          blocksMovement: true,
        },
        ...farWalls,
      ],
      doors: [],
    }
    const geometry = prepareVisibilityGeometry(largeMap, {})
    const nearby = visibilityBlockersNear(geometry.blockers, { x: 2, y: 5 }, 4)

    expect(geometry.blockers.length).toBe(2_005)
    expect(
      nearby.filter((blocker) => blocker.kind === 'wall').map((blocker) => blocker.id),
    ).toEqual(['wall:near'])
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

  it('kennzeichnet radiale Lichter weich und Tageslichtbereiche als harte Felder', () => {
    const openMap: MapDefinition = { ...baseMap, walls: [], doors: [] }
    const visibleToken = { ...token('outside', 7, 7), visionRange: 4 }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [visibleToken],
      openMap,
      prepareVisibilityGeometry(openMap, {}),
      [
        { id: 'torch', position: { x: 5, y: 7 }, range: 3 },
        { kind: 'daylight-area', id: 'sun', bounds: { x: 6, y: 6, width: 3, height: 3 } },
      ],
    )

    expect(fields.some((field) => field.rangeBoundary?.range === 3)).toBe(true)
    expect(fields.some((field) => field.rangeBoundary === undefined)).toBe(true)
  })

  it('liefert auch für aktivierte Lichtfelder nur deren getroffene Wandkontur', () => {
    const lightMap: MapDefinition = {
      ...baseMap,
      walls: [
        {
          id: 'wall-behind-token-range',
          a: { x: 7, y: 0 },
          b: { x: 7, y: 10 },
          blocksSight: true,
          blocksMovement: true,
        },
      ],
      doors: [],
    }
    const fields = combineVisibilityFieldsWithPreparedGeometry(
      [token('a', 2, 5)],
      lightMap,
      prepareVisibilityGeometry(lightMap, {}),
      [{ id: 'torch', position: { x: 5, y: 5 }, range: 4 }],
    )

    expect(fields).toHaveLength(2)
    expect(combineVisibleBlockers(fields).map((blocker) => blocker.blockerId)).toEqual([
      'wall:wall-behind-token-range',
    ])
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
