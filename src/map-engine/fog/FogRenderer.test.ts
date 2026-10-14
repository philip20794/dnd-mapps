import { describe, expect, it } from 'vitest'
import {
  FOG_RENDER_CELL_SIZE,
  VISIBILITY_FADE_WIDTH,
  fogAlphaForVisibility,
  fogPolygonsFingerprint,
  fogVisibilityFieldsFingerprint,
  visibilityFieldsFadeAtPoint,
  visibilityRangeFadeAtPoint,
} from './FogRenderer'
import type { VisibilityField } from '@/map-engine/visibility/visibility'
import {
  addPolygonsToExplorationMask,
  createEmptyExplorationMask,
  explorationMaskFingerprint,
} from './fogState'

describe('FogRenderer Cache-Schlüssel', () => {
  it('erkennt geänderte Erkundungsdaten auch bei identischer Array-Länge', () => {
    const first = [
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
    ]
    const shifted = [
      [
        { x: 4, y: 4 },
        { x: 6, y: 4 },
        { x: 5, y: 6 },
      ],
    ]

    expect(first).toHaveLength(shifted.length)
    expect(fogPolygonsFingerprint(first)).not.toBe(fogPolygonsFingerprint(shifted))
  })

  it('liefert für unveränderte Polygoninhalte denselben Schlüssel', () => {
    const polygons = [
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
    ]
    expect(fogPolygonsFingerprint(polygons)).toBe(
      fogPolygonsFingerprint(polygons.map((polygon) => polygon.map((point) => ({ ...point })))),
    )
  })

  it('invalidiert den Render-Cache bei einer geänderten sichtbaren Blockerkontur', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    const withoutBlocker: VisibilityField = { polygon }
    const withBlocker: VisibilityField = {
      polygon,
      visibleBlockers: [
        {
          blockerId: 'wall:test',
          kind: 'wall',
          blockerSegment: { a: { x: 4, y: 0 }, b: { x: 4, y: 4 } },
          visibleSegment: { a: { x: 4, y: 1 }, b: { x: 4, y: 3 } },
        },
      ],
    }

    expect(fogVisibilityFieldsFingerprint([withoutBlocker])).not.toBe(
      fogVisibilityFieldsFingerprint([withBlocker]),
    )
  })

  it('unterscheidet Masken mit gleicher Zellzahl aber anderem Inhalt', () => {
    const first = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    ])
    const shifted = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      [
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
    ])
    expect(first.cellCount).toBe(shifted.cellCount)
    expect(explorationMaskFingerprint(first)).not.toBe(explorationMaskFingerprint(shifted))
  })
})

describe('FogRenderer Sichtweitenübergang', () => {
  const field = (
    polygon: VisibilityField['polygon'],
    origin = { x: 0, y: 0 },
    range = 8,
  ): VisibilityField => ({ polygon, rangeBoundary: { origin, range } })

  const square = (minX: number, minY: number, maxX: number, maxY: number) => [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]

  it('lässt eine Sichtweite von 8 nur im letzten Rasterfeld sanft auslaufen', () => {
    const boundary = { origin: { x: 0, y: 0 }, range: 8 }

    expect(VISIBILITY_FADE_WIDTH).toBe(1)
    expect(visibilityRangeFadeAtPoint(boundary, { x: 6.9, y: 0 })).toBe(0)
    expect(visibilityRangeFadeAtPoint(boundary, { x: 7.25, y: 0 })).toBeGreaterThan(0)
    expect(visibilityRangeFadeAtPoint(boundary, { x: 7.25, y: 0 })).toBeLessThan(0.5)
    expect(visibilityRangeFadeAtPoint(boundary, { x: 7.75, y: 0 })).toBeGreaterThan(0.5)
    expect(visibilityRangeFadeAtPoint(boundary, { x: 8, y: 0 })).toBe(1)
  })

  it('macht außerhalb des Sichtpolygons keinen zusätzlichen Bereich sichtbar', () => {
    const visibility = field(square(-8, -8, 8, 8))

    expect(visibilityFieldsFadeAtPoint([visibility], { x: 7.8, y: 0 })).not.toBeNull()
    expect(visibilityFieldsFadeAtPoint([visibility], { x: 8.1, y: 0 })).toBeNull()
  })

  it('hält Wandkanten hart und wendet die Weichzeichnung nur radial an', () => {
    const wallClippedField = field(square(-8, -8, 4, 8))

    expect(visibilityFieldsFadeAtPoint([wallClippedField], { x: 3.9, y: 0 })).toBe(0)
    expect(visibilityFieldsFadeAtPoint([wallClippedField], { x: 4.1, y: 0 })).toBeNull()
  })

  it('verwendet bei überlappenden Sichtfeldern den klarsten Beitrag', () => {
    const first = field(square(-8, -8, 8, 8))
    const second = field(square(2, -8, 18, 8), { x: 10, y: 0 })

    expect(visibilityFieldsFadeAtPoint([first], { x: 7.5, y: 0 })).toBeGreaterThan(0)
    expect(visibilityFieldsFadeAtPoint([first, second], { x: 7.5, y: 0 })).toBe(0)
  })

  it('lässt Tageslichtfelder ohne radialen Rand vollständig klar', () => {
    const daylight: VisibilityField = { polygon: square(2, 2, 6, 6) }
    expect(visibilityFieldsFadeAtPoint([daylight], { x: 4, y: 4 })).toBe(0)
  })

  it('erhöht nur die temporäre Renderauflösung, nicht die ExplorationMask', () => {
    expect(FOG_RENDER_CELL_SIZE).toBe(0.25)
    expect(createEmptyExplorationMask().cellSize).toBe(0.5)
  })

  it('behält für erkundete Bereiche den bisherigen Zielalpha-Wert bei', () => {
    expect(fogAlphaForVisibility(1, true)).toBe(148)
    expect(fogAlphaForVisibility(1, false)).toBe(255)
    expect(fogAlphaForVisibility(0.5, true)).toBe(74)
  })
})
