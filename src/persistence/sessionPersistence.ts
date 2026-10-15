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
  customMaps: [],
  doorStatesByMap: {},
  currentLevelByMap: {},
  fog: structuredClone(defaultFogState),
  settings: structuredClone(defaultRuntimeSettings),
  savedAt: new Date().toISOString(),
})

interface StoredSessionSnapshot {
  readonly version: 1 | 2 | 3
  readonly selectedMapId: string | null
  readonly tokens: SessionSnapshot['tokens']
  readonly spellEffects?: SessionSnapshot['spellEffects']
  readonly generatedMaps?: SessionSnapshot['generatedMaps']
  readonly customMaps?: SessionSnapshot['customMaps']
  readonly doorStatesByMap: SessionSnapshot['doorStatesByMap']
  readonly currentLevelByMap?: SessionSnapshot['currentLevelByMap']
  readonly fog: unknown
  readonly settings: SessionSnapshot['settings']
  readonly savedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isStoredSessionSnapshot = (value: unknown): value is StoredSessionSnapshot => {
  if (!isRecord(value)) return false
  return (
    (value.version === 1 || value.version === 2 || value.version === 3) &&
    Array.isArray(value.tokens) &&
    typeof value.savedAt === 'string' &&
    isRecord(value.doorStatesByMap) &&
    isRecord(value.settings)
  )
}

export const migrateSessionSnapshot = (value: unknown): SessionSnapshot => {
  if (!isStoredSessionSnapshot(value)) {
    throw new Error('Der gespeicherte Sitzungszustand ist beschädigt.')
  }
  return {
    ...value,
    version: SESSION_SCHEMA_VERSION,
    customMaps: Array.isArray(value.customMaps) ? value.customMaps : [],
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
