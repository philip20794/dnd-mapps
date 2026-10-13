import { describe, expect, it } from 'vitest'
import { fogPolygonsFingerprint } from './FogRenderer'

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
})
