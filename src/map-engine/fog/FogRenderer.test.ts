import { describe, expect, it } from 'vitest'
import { fogPolygonsFingerprint } from './FogRenderer'
import {
  addPolygonsToExplorationMask,
  createEmptyExplorationMask,
  explorationMaskFingerprint,
} from './fogState'

describe('FogRenderer Cache-Schlüssel', () => {
  it('erkennt geänderte Erkundungsdaten auch bei identischer Array-Länge', () => {
    const first = [[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }]]
    const shifted = [[{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 6 }]]

    expect(first).toHaveLength(shifted.length)
    expect(fogPolygonsFingerprint(first)).not.toBe(fogPolygonsFingerprint(shifted))
  })

  it('liefert für unveränderte Polygoninhalte denselben Schlüssel', () => {
    const polygons = [[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }]]
    expect(fogPolygonsFingerprint(polygons)).toBe(
      fogPolygonsFingerprint(polygons.map((polygon) => polygon.map((point) => ({ ...point })))),
    )
  })

  it('unterscheidet Masken mit gleicher Zellzahl aber anderem Inhalt', () => {
    const first = addPolygonsToExplorationMask(createEmptyExplorationMask(), [[
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ]])
    const shifted = addPolygonsToExplorationMask(createEmptyExplorationMask(), [[
      { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 5 },
    ]])
    expect(first.cellCount).toBe(shifted.cellCount)
    expect(explorationMaskFingerprint(first)).not.toBe(explorationMaskFingerprint(shifted))
  })
})
