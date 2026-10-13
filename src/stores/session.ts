import { defineStore } from 'pinia'
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

const cloneSerializable = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const isStoredGeneratedMap = (value: unknown): value is MapDefinition =>
  typeof value === 'object' &&
  value !== null &&
  (value as { readonly id?: unknown }).id === randomMapId &&
  typeof (value as { readonly name?: unknown }).name === 'string' &&
  typeof (value as { readonly width?: unknown }).width === 'number' &&
  typeof (value as { readonly height?: unknown }).height === 'number' &&
  typeof (value as { readonly gridSize?: unknown }).gridSize === 'number' &&
  Array.isArray((value as { readonly objects?: unknown }).objects) &&
  Array.isArray((value as { readonly walls?: unknown }).walls) &&
  Array.isArray((value as { readonly doors?: unknown }).doors)

const storedGeneratedMapsFromSnapshot = (snapshot: SessionSnapshot): readonly MapDefinition[] =>
  Array.isArray(snapshot.generatedMaps) ? snapshot.generatedMaps.filter(isStoredGeneratedMap) : []

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
