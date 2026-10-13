import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { defaultFogState } from '@/map-engine/fog/fogState'
import { defaultRuntimeSettings } from '@/types/settings'
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from '@/types/session'

const DATABASE_NAME = 'dnd-mapps-session'
const STORE_NAME = 'sessions'
const CURRENT_SESSION_KEY = 'current'

interface SessionDatabase extends DBSchema {
  sessions: {
    key: string
    value: SessionSnapshot
  }
}

const createEmptySnapshot = (): SessionSnapshot => ({
  version: SESSION_SCHEMA_VERSION,
  selectedMapId: null,
  tokens: [],
  spellEffects: [],
  generatedMaps: [],
  doorStatesByMap: {},
  currentLevelByMap: {},
  fog: structuredClone(defaultFogState),
  settings: structuredClone(defaultRuntimeSettings),
  savedAt: new Date().toISOString(),
})

const isSessionSnapshot = (value: unknown): value is SessionSnapshot => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SessionSnapshot>
  return candidate.version === SESSION_SCHEMA_VERSION && Array.isArray(candidate.tokens)
}

export class SessionPersistence {
  private dbPromise: Promise<IDBPDatabase<SessionDatabase>> | null = null

  public async load(): Promise<SessionSnapshot | null> {
    if (!('indexedDB' in globalThis)) {
      throw new Error('IndexedDB ist in diesem Browser nicht verfügbar.')
    }

    const db = await this.database()
    const snapshot = await db.get(STORE_NAME, CURRENT_SESSION_KEY)
    if (snapshot === undefined) {
      return null
    }
    if (!isSessionSnapshot(snapshot)) {
      throw new Error('Der gespeicherte Sitzungszustand ist beschädigt.')
    }
    return snapshot
  }

  public async save(snapshot: SessionSnapshot): Promise<void> {
    if (!('indexedDB' in globalThis)) {
      throw new Error('IndexedDB ist in diesem Browser nicht verfügbar.')
    }
    const db = await this.database()
    await db.put(STORE_NAME, snapshot, CURRENT_SESSION_KEY)
  }

  public async reset(): Promise<void> {
    if (!('indexedDB' in globalThis)) {
      return
    }
    await deleteDB(DATABASE_NAME)
    this.dbPromise = null
  }

  public emptySnapshot(): SessionSnapshot {
    return createEmptySnapshot()
  }

  private database(): Promise<IDBPDatabase<SessionDatabase>> {
    this.dbPromise ??= openDB<SessionDatabase>(DATABASE_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME)
        }
      },
    })
    return this.dbPromise
  }
}

export const sessionPersistence = new SessionPersistence()
