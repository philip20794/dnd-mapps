import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { loadMapDefinitions } from '@/maps/loader'
import { createRandomMap, randomMapId } from '@/maps/randomGenerator'
import { mapGenerationService } from '@/map-generation/service'
import { createEditableMapCopy } from '@/map-editor/mapEditor'
import { sessionPersistence } from '@/persistence/sessionPersistence'
import { useFogStore } from './fog'
import { useMapStore } from './map'
import { useSessionStore } from './session'
import { useTokenStore } from './tokens'

describe('Session Store', () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    })
    await sessionPersistence.reset()
    setActivePinia(createPinia())
  })

  it('erstellt einen serialisierbaren Snapshot aus Pinia-Stores', () => {
    const mapStore = useMapStore()
    const tokenStore = useTokenStore()
    const fogStore = useFogStore()
    const sessionStore = useSessionStore()
    const randomMap = createRandomMap({ dark: true, seed: 1234 })

    mapStore.upsertGeneratedMap(randomMap)
    mapStore.selectedMapId = 'alte-krypta'
    tokenStore.replaceTokens([
      {
        id: 'token-a',
        mapId: 'alte-krypta',
        name: 'Held',
        position: { x: 2, y: 3 },
        size: 1,
        rotation: 0,
        visionRange: 8,
        visionAngle: null,
        visionEnabled: true,
        category: 'player',
        color: '#3f8cff',
        symbol: 'H',
      },
    ])
    fogStore.setEnabled(true)
    fogStore.setPersistExploration(false)
    fogStore.setVisibilityMode({ kind: 'player', tokenId: 'token-a' })

    const snapshot = sessionStore.snapshot()

    expect(snapshot.selectedMapId).toBe('alte-krypta')
    expect(snapshot.tokens).toHaveLength(1)
    expect(snapshot.generatedMaps).toHaveLength(1)
    expect(snapshot.generatedMaps?.[0]?.id).toBe(randomMapId)
    expect(snapshot.fog.persistExploration).toBe(false)
    expect(snapshot.fog.visibilityMode).toEqual({ kind: 'player', tokenId: 'token-a' })
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })

  it('stellt den gewählten Sichtmodus aus IndexedDB wieder her', async () => {
    const fogStore = useFogStore()
    fogStore.setEnabled(true)
    fogStore.setVisibilityMode({ kind: 'player', tokenId: 'player-view' })
    await useSessionStore().save()

    setActivePinia(createPinia())
    await expect(useSessionStore().restore()).resolves.toBe(true)

    expect(useFogStore().visibilityMode).toEqual({ kind: 'player', tokenId: 'player-view' })
  })

  it('stellt die letzte Zufallskarte aus der gespeicherten Sitzung wieder her', async () => {
    const generatedMap = createRandomMap({ dark: true, seed: 1234 })
    const mapStore = useMapStore()
    const sessionStore = useSessionStore()

    mapStore.setMaps(loadMapDefinitions())
    mapStore.upsertGeneratedMap(generatedMap)
    await sessionStore.save()

    setActivePinia(createPinia())
    const restoredMapStore = useMapStore()
    const restoredSessionStore = useSessionStore()
    restoredMapStore.setMaps(loadMapDefinitions())

    await expect(restoredSessionStore.restore()).resolves.toBe(true)

    const restoredMap = restoredMapStore.maps.find((map) => map.id === randomMapId)
    expect(restoredMap?.name).toBe(generatedMap.name)
    expect(restoredMap?.objects).toHaveLength(generatedMap.objects.length)
    expect(restoredMapStore.selectedMapId).toBe(randomMapId)
  })

  it('stores and restores multiple custom maps independently from source maps', async () => {
    const sourceMaps = loadMapDefinitions()
    const firstSource = sourceMaps[0]
    const secondSource = sourceMaps[1]
    expect(firstSource).toBeDefined()
    expect(secondSource).toBeDefined()
    if (!firstSource || !secondSource) return

    const mapStore = useMapStore()
    mapStore.setMaps(sourceMaps)
    const existingIds = new Set(sourceMaps.map((map) => map.id))
    const first = createEditableMapCopy(firstSource, existingIds, undefined, () => 'custom-one')
    existingIds.add(first.id)
    const second = createEditableMapCopy(secondSource, existingIds, undefined, () => 'custom-two')
    mapStore.upsertCustomMap(first)
    mapStore.upsertCustomMap(second)
    mapStore.setCurrentLevel(second.id, second.levels?.[0]?.id ?? 'ground')
    await useSessionStore().save()

    setActivePinia(createPinia())
    const restoredMapStore = useMapStore()
    restoredMapStore.setMaps(sourceMaps)
    await expect(useSessionStore().restore()).resolves.toBe(true)

    expect(restoredMapStore.customMaps.map((map) => map.id).sort()).toEqual([
      'custom-one',
      'custom-two',
    ])
    expect(restoredMapStore.selectedMapId).toBe('custom-two')
    expect(restoredMapStore.maps.find((map) => map.id === firstSource.id)).toEqual(firstSource)
  })

  it('stellt frei platzierte Spieler und Gegner einschließlich ihrer Sichtwerte wieder her', async () => {
    const tokenStore = useTokenStore()
    const sessionStore = useSessionStore()
    tokenStore.addQuickToken(
      { category: 'player', size: 1, color: '#3456ff' },
      'alte-krypta',
      { x: 2, y: 3 },
      'krypta-ebene',
    )
    tokenStore.addQuickToken(
      { category: 'monster', size: 3, color: '#ff6600' },
      'alte-krypta',
      { x: 7, y: 8 },
      'krypta-ebene',
    )
    await sessionStore.save()

    setActivePinia(createPinia())
    await expect(useSessionStore().restore()).resolves.toBe(true)

    expect(useTokenStore().tokens).toEqual([
      expect.objectContaining({
        category: 'player',
        size: 1,
        color: '#3456ff',
        visionRange: 8,
        visionEnabled: true,
      }),
      expect.objectContaining({
        category: 'monster',
        size: 3,
        color: '#ff6600',
        visionRange: 0,
        visionEnabled: false,
      }),
    ])
  })

  it('persists duplicate token names after restore', async () => {
    const tokenStore = useTokenStore()
    const sessionStore = useSessionStore()
    const source = tokenStore.addTokenFromTemplate('goblin', 'alte-krypta', { x: 2, y: 3 }, 'ground')
    const duplicate = tokenStore.duplicateToken(source.id, 'alte-krypta', { x: 5, y: 6 }, 'ground')
    expect(duplicate).not.toBeNull()
    await sessionStore.save()

    setActivePinia(createPinia())
    await expect(useSessionStore().restore()).resolves.toBe(true)

    expect(useTokenStore().tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: source.id, name: 'Goblin 1', position: { x: 2, y: 3 } }),
        expect.objectContaining({ id: duplicate?.id, name: 'Goblin 2', position: { x: 5, y: 6 } }),
      ]),
    )
  })

  it('preserves generated map plan and seed in the snapshot', async () => {
    const generated = await mapGenerationService.generate({ seed: 987, mapType: 'cave' })
    const mapStore = useMapStore()
    const sessionStore = useSessionStore()
    mapStore.upsertGeneratedMap(generated.map)

    const snapshot = sessionStore.snapshot()
    expect(snapshot.generatedMaps?.[0]?.generation).toMatchObject({
      request: { seed: 987 },
      plan: { seed: 987 },
    })
    await sessionStore.save()

    setActivePinia(createPinia())
    const restoredMapStore = useMapStore()
    restoredMapStore.setMaps(loadMapDefinitions())
    await useSessionStore().restore()
    expect(restoredMapStore.currentMap?.generation?.plan.seed).toBe(987)
  })
})
