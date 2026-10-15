import { defineStore } from 'pinia'
import { isCustomMap, parseMapDefinition } from '@/map-editor/mapEditor'
import type { MapDefinition } from '@/maps/api'
import { randomMapId } from '@/maps/randomGenerator'
import { sessionPersistence } from '@/persistence/sessionPersistence'
import { SESSION_SCHEMA_VERSION, type SessionSnapshot } from '@/types/session'
import { useFogStore } from './fog'
import { useMapStore } from './map'
import { useSettingsStore } from './settings'
import { useSpellEffectStore } from './spellEffects'
import { useTokenStore } from './tokens'

interface SessionState {
  loading: boolean
  saving: boolean
  lastSavedAt: string | null
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function validatedStoredMap(value: unknown): MapDefinition | null {
  try {
    return parseMapDefinition(value)
  } catch {
    return null
  }
}

function storedGeneratedMapsFromSnapshot(snapshot: SessionSnapshot): readonly MapDefinition[] {
  if (!Array.isArray(snapshot.generatedMaps)) return []
  return snapshot.generatedMaps
    .map(validatedStoredMap)
    .filter((map): map is MapDefinition => map?.id === randomMapId)
}

function storedCustomMapsFromSnapshot(snapshot: SessionSnapshot): readonly MapDefinition[] {
  if (!Array.isArray(snapshot.customMaps)) return []
  return snapshot.customMaps
    .map(validatedStoredMap)
    .filter((map): map is MapDefinition => map !== null && isCustomMap(map))
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    loading: false,
    saving: false,
    lastSavedAt: null,
  }),
  actions: {
    snapshot(): SessionSnapshot {
      const mapStore = useMapStore()
      const tokenStore = useTokenStore()
      const fogStore = useFogStore()
      const settingsStore = useSettingsStore()
      const spellEffectStore = useSpellEffectStore()
      return {
        version: SESSION_SCHEMA_VERSION,
        selectedMapId: mapStore.selectedMapId,
        tokens: cloneSerializable(tokenStore.tokens),
        spellEffects: cloneSerializable(spellEffectStore.effects),
        generatedMaps: cloneSerializable(mapStore.maps.filter((map) => map.id === randomMapId)),
        customMaps: cloneSerializable(mapStore.customMaps),
        doorStatesByMap: cloneSerializable(mapStore.doorStatesByMap),
        currentLevelByMap: cloneSerializable(mapStore.currentLevelByMap),
        fog: cloneSerializable(fogStore.$state),
        settings: cloneSerializable(settingsStore.$state),
        savedAt: new Date().toISOString(),
      }
    },
    async save(): Promise<void> {
      this.saving = true
      try {
        const snapshot = this.snapshot()
        await sessionPersistence.save(snapshot)
        this.lastSavedAt = snapshot.savedAt
      } finally {
        this.saving = false
      }
    },
    async restore(): Promise<boolean> {
      this.loading = true
      try {
        const snapshot = await sessionPersistence.load()
        if (!snapshot) {
          return false
        }

        const mapStore = useMapStore()
        const tokenStore = useTokenStore()
        const fogStore = useFogStore()
        const settingsStore = useSettingsStore()
        const spellEffectStore = useSpellEffectStore()

        mapStore.restoreGeneratedMaps(storedGeneratedMapsFromSnapshot(snapshot))
        mapStore.restoreCustomMaps(storedCustomMapsFromSnapshot(snapshot))
        if (
          snapshot.selectedMapId &&
          mapStore.maps.some((map) => map.id === snapshot.selectedMapId)
        ) {
          mapStore.selectMap(snapshot.selectedMapId)
        }
        tokenStore.replaceTokens(snapshot.tokens)
        spellEffectStore.replaceEffects(snapshot.spellEffects ?? [])
        mapStore.replaceDoorStates(snapshot.doorStatesByMap)
        mapStore.replaceCurrentLevels(snapshot.currentLevelByMap ?? {})
        fogStore.replaceState(snapshot.fog)
        settingsStore.replaceState(snapshot.settings)
        this.lastSavedAt = snapshot.savedAt
        return true
      } finally {
        this.loading = false
      }
    },
    async resetLocalData(): Promise<void> {
      await sessionPersistence.reset()
      this.lastSavedAt = null
    },
  },
})
