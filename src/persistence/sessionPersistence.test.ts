import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { migrateSessionSnapshot, SessionPersistence } from './sessionPersistence'
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from '@/types/session'
import { defaultFogState, recordExploration } from '@/map-engine/fog/fogState'
import { defaultRuntimeSettings } from '@/types/settings'

const createSnapshot = (): SessionSnapshot => ({
  version: SESSION_SCHEMA_VERSION,
  selectedMapId: 'alte-krypta',
  tokens: [
    {
      id: 'token-a',
      mapId: 'alte-krypta',
      name: 'Held',
      position: { x: 1, y: 2 },
      size: 1,
      rotation: 0,
      visionRange: 8,
      visionAngle: null,
      visionEnabled: true,
      category: 'player',
      color: '#3f8cff',
      symbol: 'H',
    },
  ],
  doorStatesByMap: { 'alte-krypta': { 'door-south-crypt': 'open' } },
  customMaps: [],
  fog: { ...defaultFogState, enabled: true },
  settings: structuredClone(defaultRuntimeSettings),
  savedAt: new Date('2026-07-14T10:00:00Z').toISOString(),
})

describe('SessionPersistence', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: new IDBFactory(),
    })
  })

  it('speichert und lädt die Sitzung versioniert', async () => {
    const persistence = new SessionPersistence()
    const snapshot = {
      ...createSnapshot(),
      fog: recordExploration(
        { ...defaultFogState, enabled: true },
        'alte-krypta:ground',
        [[
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ]],
      ),
    }
    await persistence.save(snapshot)
    await expect(persistence.load()).resolves.toEqual(snapshot)
  })

  it('liefert null, wenn keine Sitzung vorhanden ist', async () => {
    await expect(new SessionPersistence().load()).resolves.toBeNull()
  })

  it('migriert Fog-Polygone aus Sitzungen der Schema-Version 1', () => {
    const legacy = {
      ...createSnapshot(),
      version: 1,
      fog: {
        enabled: true,
        persistExploration: true,
        exploredByMap: {
          'alte-krypta:ground': [[
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]],
        },
      },
    }
    const migrated = migrateSessionSnapshot(legacy)
    expect(migrated.version).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated.fog.exploredMasksByMap['alte-krypta:ground']?.cellCount).toBe(4)
    expect(migrated.fog.visibilityMode).toEqual({ kind: 'shared' })
    expect(migrated.customMaps).toEqual([])
  })

  it('migriert Sitzungen der Version 2 ohne eigene Karten', () => {
    const migrated = migrateSessionSnapshot({ ...createSnapshot(), version: 2 })
    expect(migrated.version).toBe(SESSION_SCHEMA_VERSION)
    expect(migrated.customMaps).toEqual([])
  })
})
