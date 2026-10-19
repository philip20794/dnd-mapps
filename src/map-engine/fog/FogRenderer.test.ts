import { describe, expect, it } from 'vitest'
import {
  FOG_FADE_SCALE,
  FOG_INVISIBLE_CELL,
  FOG_RENDER_CELL_SIZE,
  FOG_TEXTURE_SCALE_MODE,
  VISIBILITY_FADE_WIDTH,
  fogAlphaForVisibility,
  fogPolygonsFingerprint,
  fogVisibilityFieldsFingerprint,
  rasterizeVisibilityFieldsScanline,
  visibilityFadeForFilteredCell,
  visibilityFieldsFadeAtPoint,
  visibilityRangeFadeAtPoint,
  writeFogPixels,
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

  it('verwendet lineares Filtering mit einem konservativen Schutzrand', () => {
    expect(FOG_TEXTURE_SCALE_MODE).toBe('linear')

    const cells = new Uint16Array([
      FOG_INVISIBLE_CELL,
      FOG_INVISIBLE_CELL,
      FOG_INVISIBLE_CELL,
      FOG_INVISIBLE_CELL,
      0,
      0,
      FOG_INVISIBLE_CELL,
      0,
      0,
    ])

    expect(visibilityFadeForFilteredCell(cells, 1, 1, 3, 3)).toBe(FOG_FADE_SCALE)
    expect(visibilityFadeForFilteredCell(cells, 2, 2, 3, 3)).toBe(0)
    expect(visibilityFadeForFilteredCell(cells, 0, 0, 3, 3)).toBe(FOG_INVISIBLE_CELL)
  })

  it('legt den Filterübergang vollständig auf die sichtbare Seite einer Wand', () => {
    const wallClipped = field(square(0, 0, 4, 8), { x: 1, y: 4 }, 8)
    const cells = rasterizeVisibilityFieldsScanline([wallClipped], 8, 8)
    const xCells = Math.ceil(8 / FOG_RENDER_CELL_SIZE)
    const yCells = Math.ceil(8 / FOG_RENDER_CELL_SIZE)
    const yIndex = Math.floor(4 / FOG_RENDER_CELL_SIZE)
    const lastVisibleX = Math.floor(4 / FOG_RENDER_CELL_SIZE) - 1
    const firstHiddenX = lastVisibleX + 1

    expect(cells[yIndex * xCells + firstHiddenX]).toBe(FOG_INVISIBLE_CELL)
    expect(visibilityFadeForFilteredCell(cells, lastVisibleX, yIndex, xCells, yCells)).toBe(
      FOG_FADE_SCALE,
    )
    expect(visibilityFadeForFilteredCell(cells, lastVisibleX - 1, yIndex, xCells, yCells)).toBe(0)
  })

  it('schützt auch die Innenecke zweier Wände vor diagonaler Interpolation', () => {
    const cornerField: VisibilityField = {
      polygon: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 6 },
        { x: 0, y: 6 },
      ],
    }
    const cells = rasterizeVisibilityFieldsScanline([cornerField], 6, 6)
    const xCells = Math.ceil(6 / FOG_RENDER_CELL_SIZE)
    const yCells = Math.ceil(6 / FOG_RENDER_CELL_SIZE)
    const edgeIndex = Math.floor(4 / FOG_RENDER_CELL_SIZE) - 1
    const hiddenIndex = edgeIndex + 1

    expect(cells[hiddenIndex * xCells + hiddenIndex]).toBe(FOG_INVISIBLE_CELL)
    expect(visibilityFadeForFilteredCell(cells, edgeIndex, edgeIndex, xCells, yCells)).toBe(
      FOG_FADE_SCALE,
    )
    expect(visibilityFadeForFilteredCell(cells, edgeIndex - 1, edgeIndex - 1, xCells, yCells)).toBe(
      0,
    )
  })

  it('erzeugt an überlappenden Sichtfeldern keinen künstlichen Schutzrand', () => {
    const left = field(square(0, 0, 5, 8), { x: 2, y: 4 }, 8)
    const right = field(square(4, 0, 9, 8), { x: 7, y: 4 }, 8)
    const cells = rasterizeVisibilityFieldsScanline([left, right], 10, 8)
    const xCells = Math.ceil(10 / FOG_RENDER_CELL_SIZE)
    const yCells = Math.ceil(8 / FOG_RENDER_CELL_SIZE)
    const xIndex = Math.floor(4.5 / FOG_RENDER_CELL_SIZE)
    const yIndex = Math.floor(4 / FOG_RENDER_CELL_SIZE)

    expect(visibilityFadeForFilteredCell(cells, xIndex, yIndex, xCells, yCells)).toBe(0)
  })

  it('bewahrt den Alpha-Wert erkundeter und unbekannter, nicht sichtbarer Zellen', () => {
    const visibleCells = new Uint16Array([
      FOG_INVISIBLE_CELL,
      FOG_INVISIBLE_CELL,
      FOG_INVISIBLE_CELL,
    ])
    const pixels = new Uint8ClampedArray(12)
    const explored = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      square(0, 0, 0.5, 0.5),
    ])

    writeFogPixels(visibleCells, 3, 1, explored, pixels)

    expect(pixels[3]).toBe(148)
    expect(pixels[7]).toBe(255)
    expect(pixels[11]).toBe(255)
  })

  it('verdeckt zuvor gesehene Felder vollständig ohne aktive Erkundungsspeicherung', () => {
    const visibleCells = new Uint16Array([0, FOG_INVISIBLE_CELL, FOG_INVISIBLE_CELL])
    const pixels = new Uint8ClampedArray(12)

    writeFogPixels(visibleCells, 3, 1, null, pixels, false)

    expect(pixels[3]).toBe(0)
    expect(pixels[7]).toBe(255)
    expect(pixels[11]).toBe(255)
  })

  it('hellt unbekanntes Gebiet auch zwischen erkundeten und unbekannten Texeln nicht auf', () => {
    const visibleCells = new Uint16Array([0, 0, FOG_INVISIBLE_CELL, FOG_INVISIBLE_CELL])
    const pixels = new Uint8ClampedArray(16)
    const explored = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      square(0, 0, 0.5, 0.5),
    ])

    writeFogPixels(visibleCells, 4, 1, explored, pixels)

    expect(pixels[3]).toBe(0)
    expect(pixels[7]).toBe(255)
    expect(pixels[11]).toBe(255)
  })

  it('rasterisiert per Scanline identisch zu den bisherigen Zellmittelpunkt-Pruefungen', () => {
    const fields = [
      field(square(0, 0, 8, 8), { x: 0, y: 0 }),
      field(square(4, 2, 12, 10), { x: 8, y: 6 }),
      { polygon: square(1, 7, 3, 9) },
    ]
    const cells = rasterizeVisibilityFieldsScanline(fields, 12, 10)
    const xCells = Math.ceil(12 / FOG_RENDER_CELL_SIZE)
    const yCells = Math.ceil(10 / FOG_RENDER_CELL_SIZE)

    const mismatches: string[] = []
    for (let yIndex = 0; yIndex < yCells; yIndex += 1) {
      for (let xIndex = 0; xIndex < xCells; xIndex += 1) {
        const point = {
          x: xIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
          y: yIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
        }
        const expected = visibilityFieldsFadeAtPoint(fields, point)
        const actual = cells[yIndex * xCells + xIndex]!
        const matches =
          expected === null
            ? actual === FOG_INVISIBLE_CELL
            : Math.abs(actual / FOG_FADE_SCALE - expected) < 0.0001
        if (!matches) mismatches.push(`${xIndex},${yIndex}: ${actual} statt ${expected}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})
