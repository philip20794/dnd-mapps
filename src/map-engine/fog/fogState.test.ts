import { describe, expect, it } from 'vitest'
import {
  clearExplorationForMap,
  defaultFogState,
  recordExploration,
  visibleAndExploredPolygons,
} from './fogState'

const polygon = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
]

describe('Fog of War Zustand', () => {
  it('speichert erkundete Sichtflächen bei aktivierter Erkundung', () => {
    const state = recordExploration(defaultFogState, 'map', [polygon])
    expect(state.exploredByMap.map).toHaveLength(1)
  })

  it('speichert keine früheren Sichtflächen, wenn Erkundung deaktiviert ist', () => {
    const state = recordExploration({ ...defaultFogState, persistExploration: false }, 'map', [
      polygon,
    ])
    expect(state.exploredByMap.map).toBeUndefined()
  })

  it('trennt aktuelle und erkundete Sicht', () => {
    const exploredState = recordExploration(defaultFogState, 'map', [polygon])
    const result = visibleAndExploredPolygons(exploredState, 'map', [polygon])
    expect(result.visible).toHaveLength(1)
    expect(result.explored).toHaveLength(1)
  })

  it('setzt erkundete Bereiche pro Karte zurück', () => {
    const exploredState = recordExploration(defaultFogState, 'map', [polygon])
    expect(clearExplorationForMap(exploredState, 'map').exploredByMap.map).toBeUndefined()
  })

  it('speichert identische Sichtdaten nicht erneut', () => {
    const exploredState = recordExploration(defaultFogState, 'map', [polygon])
    expect(recordExploration(exploredState, 'map', [polygon])).toBe(exploredState)
  })

  it('begrenzt die Erkundung weiterhin auf die neuesten 160 Polygone', () => {
    const polygons = Array.from({ length: 161 }, (_value, index) => [
      { x: index, y: 0 },
      { x: index + 1, y: 0 },
      { x: index + 1, y: 1 },
    ])
    const state = recordExploration(defaultFogState, 'map', polygons)
    expect(state.exploredByMap.map).toHaveLength(160)
    expect(state.exploredByMap.map?.[0]).toEqual(polygons[1])
  })
})
