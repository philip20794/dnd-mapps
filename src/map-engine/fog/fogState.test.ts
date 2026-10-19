import { describe, expect, it } from 'vitest'
import {
  clearExplorationForMap,
  defaultFogState,
  isExploredCell,
  migrateFogState,
  normalizeFogVisibilityMode,
  recordExploration,
  resolveFogVisibilityTokens,
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

const persistentFogState = { ...defaultFogState, persistExploration: true }

describe('Fog of War Zustand', () => {
  it('zeigt standardmäßig ausschließlich die aktuelle Sicht', () => {
    expect(defaultFogState.persistExploration).toBe(false)
    expect(recordExploration(defaultFogState, 'map:ground', [square(0)])).toBe(defaultFogState)
  })

  it('speichert erkundete Sicht als Rastermaske', () => {
    const state = recordExploration(persistentFogState, 'map:ground', [square(0)])
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
    const state = recordExploration(persistentFogState, 'map:ground', [square(0)])
    expect(recordExploration(state, 'map:ground', [square(0)])).toBe(state)
  })

  it('behält Erkundung nach mehr als 160 Schritten vollständig', () => {
    let state = persistentFogState
    for (let index = 0; index < 200; index += 1) {
      state = recordExploration(state, 'map:ground', [square(index)])
    }
    const mask = state.exploredMasksByMap['map:ground'] ?? null
    expect(isExploredCell(mask, 0, 0)).toBe(true)
    expect(isExploredCell(mask, 399, 0)).toBe(true)
    expect(mask?.cellCount).toBe(800)
  })

  it('trennt Karten und Ebenen voneinander', () => {
    let state = recordExploration(persistentFogState, 'map-a:ground', [square(0)])
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
    const state = recordExploration(persistentFogState, 'map:ground', [square(0)])
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
    const state = recordExploration(persistentFogState, 'map:ground', [square(0)])
    const result = visibleAndExploredPolygons(state, 'map:ground', [square(2)])
    expect(result.visible).toHaveLength(1)
    expect(result.explored?.cellCount).toBe(4)
  })

  it('filtert die Anzeige auf genau den gewählten Spieler', () => {
    const tokens = [
      { id: 'player-a', category: 'player' },
      { id: 'player-b', category: 'player' },
      { id: 'monster', category: 'monster' },
    ]

    expect(
      resolveFogVisibilityTokens(tokens, { kind: 'player', tokenId: 'player-b' }),
    ).toEqual([{ id: 'player-b', category: 'player' }])
    expect(resolveFogVisibilityTokens(tokens, { kind: 'shared' })).toBe(tokens)
  })

  it('fällt bei fehlendem Spieler auf gemeinsame Sicht zurück', () => {
    const mode = { kind: 'player', tokenId: 'player-a' } as const
    expect(normalizeFogVisibilityMode(mode, [{ id: 'player-a', category: 'player' }])).toBe(mode)
    expect(normalizeFogVisibilityMode(mode, [])).toEqual({ kind: 'shared' })
    expect(normalizeFogVisibilityMode(mode, [{ id: 'player-a', category: 'monster' }])).toEqual({
      kind: 'shared',
    })
  })

  it('migriert alte Sitzungen auf gemeinsame Sicht und erhält gültige Einzelsicht', () => {
    expect(migrateFogState({ enabled: true }).visibilityMode).toEqual({ kind: 'shared' })
    expect(
      migrateFogState({
        enabled: true,
        visibilityMode: { kind: 'player', tokenId: 'player-a' },
      }).visibilityMode,
    ).toEqual({ kind: 'player', tokenId: 'player-a' })
  })
})
