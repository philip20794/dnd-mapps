import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { defaultFogState, migrateFogState } from '@/map-engine/fog/fogState'
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

const isStoredSessionSnapshot = (
  value: unknown,
): value is Omit<SessionSnapshot, 'version' | 'fog'> & { readonly version: 1 | 2; readonly fog: unknown } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { readonly version?: unknown; readonly tokens?: unknown }
  return (candidate.version === 1 || candidate.version === 2) && Array.isArray(candidate.tokens)
}

export const migrateSessionSnapshot = (value: unknown): SessionSnapshot => {
  if (!isStoredSessionSnapshot(value)) {
    throw new Error('Der gespeicherte Sitzungszustand ist beschädigt.')
  }
  return {
    ...value,
    version: SESSION_SCHEMA_VERSION,
    fog: migrateFogState(value.fog),
  }
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
    return migrateSessionSnapshot(snapshot)
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
