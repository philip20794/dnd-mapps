import { describe, expect, it } from 'vitest'
import {
  clearExplorationForMap,
  defaultFogState,
  isExploredCell,
  migrateFogState,
  recordExploration,
  visibleAndExploredPolygons,
} from './fogState'

function square(x: number, y = 0) {
  return [
    { x, y },
    { x: x + 1, y },
    { x: x + 1, y: y + 1 },
    { x, y: y + 1 },
  ]
}

describe('Fog of War Zustand', () => {
  it('speichert erkundete Sicht als Rastermaske', () => {
    const state = recordExploration(defaultFogState, 'map:ground', [square(0)])
    const mask = state.exploredMasksByMap['map:ground']
    expect(mask?.cellCount).toBe(4)
    expect(isExploredCell(mask ?? null, 0, 0)).toBe(true)
  })

  it('speichert keine Erkundung, wenn Persistenz deaktiviert ist', () => {
    const state = recordExploration(
      { ...defaultFogState, persistExploration: false },
      'map:ground',
      [square(0)],
    )
    expect(state.exploredMasksByMap['map:ground']).toBeUndefined()
  })

  it('fügt identische Zellen nicht erneut hinzu', () => {
    const state = recordExploration(defaultFogState, 'map:ground', [square(0)])
    expect(recordExploration(state, 'map:ground', [square(0)])).toBe(state)
  })

  it('behält Erkundung nach mehr als 160 Schritten vollständig', () => {
    let state = defaultFogState
    for (let index = 0; index < 200; index += 1) {
      state = recordExploration(state, 'map:ground', [square(index)])
    }
    const mask = state.exploredMasksByMap['map:ground'] ?? null
    expect(isExploredCell(mask, 0, 0)).toBe(true)
    expect(isExploredCell(mask, 399, 0)).toBe(true)
    expect(mask?.cellCount).toBe(800)
  })

  it('trennt Karten und Ebenen voneinander', () => {
    let state = recordExploration(defaultFogState, 'map-a:ground', [square(0)])
    state = recordExploration(state, 'map-a:cellar', [square(4)])
    state = recordExploration(state, 'map-b:ground', [square(8)])
    expect(Object.keys(state.exploredMasksByMap)).toEqual([
      'map-a:ground',
      'map-a:cellar',
      'map-b:ground',
    ])
    expect(isExploredCell(state.exploredMasksByMap['map-a:cellar'] ?? null, 8, 0)).toBe(true)
  })

  it('setzt erkundete Bereiche pro Karte zurück', () => {
    const state = recordExploration(defaultFogState, 'map:ground', [square(0)])
    expect(clearExplorationForMap(state, 'map:ground').exploredMasksByMap['map:ground']).toBeUndefined()
  })

  it('migriert die alte Polygonhistorie verlustfrei in eine Maske', () => {
    const migrated = migrateFogState({
      enabled: true,
      persistExploration: true,
      exploredByMap: { 'map:ground': [square(0), square(3)] },
    })
    const mask = migrated.exploredMasksByMap['map:ground'] ?? null
    expect(migrated.enabled).toBe(true)
    expect(isExploredCell(mask, 0, 0)).toBe(true)
    expect(isExploredCell(mask, 6, 0)).toBe(true)
  })

  it('liefert aktuelle Sicht und persistierte Maske getrennt', () => {
    const state = recordExploration(defaultFogState, 'map:ground', [square(0)])
    const result = visibleAndExploredPolygons(state, 'map:ground', [square(2)])
    expect(result.visible).toHaveLength(1)
    expect(result.explored?.cellCount).toBe(4)
  })
})
