import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { MapDefinition } from '@/maps/api'
import { useMapStore } from './map'

const source: MapDefinition = {
  id: 'source',
  name: 'Original',
  width: 10,
  height: 10,
  gridSize: 48,
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
}

describe('Map Store custom maps', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('protects source ids and keeps custom map level and door state isolated', () => {
    const store = useMapStore()
    store.setMaps([source])
    const custom: MapDefinition = {
      ...source,
      id: 'custom-one',
      name: 'Eigene Karte',
      levels: [
        { id: 'ground', name: 'Unten' },
        { id: 'upper', name: 'Oben' },
      ],
      doors: [],
      editor: { schemaVersion: 1, sourceMapId: source.id, updatedAt: '2026-10-14T10:00:00Z' },
    }
    store.upsertCustomMap(custom)
    store.setCurrentLevel(custom.id, 'upper')

    expect(store.selectedMapId).toBe(custom.id)
    expect(store.currentLevelId).toBe('upper')
    expect(store.customMaps.map((map) => map.id)).toEqual(['custom-one'])
    expect(store.maps.find((map) => map.id === source.id)?.name).toBe('Original')
    expect(() =>
      store.upsertCustomMap({
        ...custom,
        id: source.id,
      }),
    ).toThrow('Originalkarte')
  })

  it('ignores restored custom maps with duplicate or source ids', () => {
    const store = useMapStore()
    store.setMaps([source])
    const valid: MapDefinition = {
      ...source,
      id: 'custom-one',
      editor: { schemaVersion: 1, sourceMapId: source.id, updatedAt: '2026-10-14T10:00:00Z' },
    }
    store.restoreCustomMaps([valid, valid, { ...valid, id: source.id }])

    expect(store.customMaps.map((map) => map.id)).toEqual(['custom-one'])
    expect(store.maps.filter((map) => map.id === source.id)).toHaveLength(1)
  })
})
