import { describe, expect, it } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import {
  createMovementSegmentIndex,
  isTokenMoveAllowed,
  movementSegmentsForMap,
  movementSegmentsNear,
  segmentsIntersect,
} from './movement'

const testMap: MapDefinition = {
  id: 'collision-map',
  name: 'Kollisionstest',
  width: 10,
  height: 10,
  gridSize: 48,
  objects: [],
  walls: [
    {
      id: 'center-wall',
      a: { x: 5, y: 0 },
      b: { x: 5, y: 4 },
      blocksSight: true,
      blocksMovement: true,
    },
    {
      id: 'center-wall-lower',
      a: { x: 5, y: 6 },
      b: { x: 5, y: 10 },
      blocksSight: true,
      blocksMovement: true,
    },
  ],
  doors: [
    {
      id: 'center-door',
      label: 'Tür',
      segment: { a: { x: 5, y: 4 }, b: { x: 5, y: 6 } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    },
  ],
  spawnPoints: [],
}

describe('Token-Bewegungskollision', () => {
  it('erkennt Segment-Schnittpunkte', () => {
    expect(
      segmentsIntersect(
        { a: { x: 1, y: 1 }, b: { x: 9, y: 1 } },
        { a: { x: 5, y: 0 }, b: { x: 5, y: 2 } },
      ),
    ).toBe(true)
  })

  it('blockiert Bewegung durch Wände', () => {
    const blockers = movementSegmentsForMap(testMap, { 'center-door': 'open' })
    expect(isTokenMoveAllowed({ x: 4, y: 2 }, { x: 6, y: 2 }, 0.5, blockers, testMap)).toBe(false)
  })

  it('erlaubt Bewegung auf derselben Wandseite', () => {
    const blockers = movementSegmentsForMap(testMap, { 'center-door': 'closed' })
    expect(isTokenMoveAllowed({ x: 3, y: 2 }, { x: 4, y: 2.5 }, 0.5, blockers, testMap)).toBe(true)
  })

  it('blockiert geschlossene Türen und erlaubt geöffnete Türen', () => {
    const closed = movementSegmentsForMap(testMap, { 'center-door': 'closed' })
    const open = movementSegmentsForMap(testMap, { 'center-door': 'open' })
    expect(isTokenMoveAllowed({ x: 4, y: 5 }, { x: 6, y: 5 }, 0.5, closed, testMap)).toBe(false)
    expect(isTokenMoveAllowed({ x: 4, y: 5 }, { x: 6, y: 5 }, 0.5, open, testMap)).toBe(true)
  })

  it('blockiert Bewegung außerhalb der Karte', () => {
    expect(isTokenMoveAllowed({ x: 1, y: 1 }, { x: -1, y: 1 }, 0.5, [], testMap)).toBe(false)
  })

  it('fragt aus dem Kollisionsindex nur Hindernisse entlang der Bewegung ab', () => {
    const nearbyWall = { a: { x: 5, y: 0 }, b: { x: 5, y: 4 } }
    const distantWall = { a: { x: 30, y: 0 }, b: { x: 30, y: 10 } }
    const index = createMovementSegmentIndex([nearbyWall, distantWall], 4)

    expect(movementSegmentsNear(index, { x: 3, y: 2 }, { x: 6, y: 2 }, 0.5)).toEqual([
      nearbyWall,
    ])
  })

  it('berücksichtigt den Token-Radius bei der Indexabfrage', () => {
    const closeWall = { a: { x: 8, y: 0 }, b: { x: 8, y: 4 } }
    const index = createMovementSegmentIndex([closeWall], 4)

    expect(movementSegmentsNear(index, { x: 6, y: 2 }, { x: 7, y: 2 }, 2)).toEqual([closeWall])
  })
})
