import { defineStore } from 'pinia'
import type { Polygon } from '@/types/geometry'
import {
  clearExplorationForMap,
  defaultFogState,
  migrateFogState,
  recordExploration,
  type FogStateData,
} from '@/map-engine/fog/fogState'

export const useFogStore = defineStore('fog', {
  state: (): FogStateData => ({
    enabled: defaultFogState.enabled,
    persistExploration: defaultFogState.persistExploration,
    exploredMasksByMap: {},
  }),
  actions: {
    setEnabled(enabled: boolean): void {
      this.enabled = enabled
    },
    setPersistExploration(enabled: boolean): void {
      this.persistExploration = enabled
    },
    record(mapId: string, polygons: readonly Polygon[]): boolean {
      const next = recordExploration(this.$state, mapId, polygons)
      if (next === this.$state) return false
      this.$patch(next)
      return true
    },
    resetMap(mapId: string): void {
      let next = clearExplorationForMap(this.$state, mapId)
      for (const key of Object.keys(next.exploredMasksByMap)) {
        if (key.startsWith(`${mapId}:`)) {
          next = clearExplorationForMap(next, key)
        }
      }
      this.$patch(next)
    },
    resetAll(): void {
      this.$patch({
        enabled: defaultFogState.enabled,
        persistExploration: defaultFogState.persistExploration,
        exploredMasksByMap: {},
      })
    },
    replaceState(state: FogStateData): void {
      this.$patch(migrateFogState(state))
    },
  },
})
