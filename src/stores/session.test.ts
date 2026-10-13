import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { loadMapDefinitions } from '@/maps/loader'
import { createRandomMap, randomMapId } from '@/maps/randomGenerator'
import { mapGenerationService } from '@/map-generation/service'
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

    const snapshot = sessionStore.snapshot()

    expect(snapshot.selectedMapId).toBe('alte-krypta')
    expect(snapshot.tokens).toHaveLength(1)
    expect(snapshot.generatedMaps).toHaveLength(1)
    expect(snapshot.generatedMaps?.[0]?.id).toBe(randomMapId)
    expect(snapshot.fog.persistExploration).toBe(false)
    expect(() => JSON.stringify(snapshot)).not.toThrow()
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

  it('bewahrt Plan und Seed einer über die Pipeline erzeugten Karte im Snapshot', async () => {
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
