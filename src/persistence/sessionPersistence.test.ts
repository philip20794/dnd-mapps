import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { SessionPersistence } from './sessionPersistence'
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from '@/types/session'
import { defaultFogState } from '@/map-engine/fog/fogState'
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
    const snapshot = createSnapshot()
    await persistence.save(snapshot)
    await expect(persistence.load()).resolves.toEqual(snapshot)
  })

  it('liefert null, wenn keine Sitzung vorhanden ist', async () => {
    await expect(new SessionPersistence().load()).resolves.toBeNull()
  })
})
