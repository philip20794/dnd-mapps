import { defineStore } from 'pinia'
import { isCustomMap } from '@/map-editor/mapEditor'
import { getDefaultLevelId, getLevelName } from '@/maps/api'
import type { DoorState, MapDefinition, MapLevelDefinition } from '@/maps/api'

interface MapState {
  maps: MapDefinition[]
  sourceMapIds: string[]
  selectedMapId: string | null
  doorStatesByMap: Record<string, Record<string, DoorState>>
  currentLevelByMap: Record<string, string>
}

export const useMapStore = defineStore('map', {
  state: (): MapState => ({
    maps: [],
    sourceMapIds: [],
    selectedMapId: null,
    doorStatesByMap: {},
    currentLevelByMap: {},
  }),
  getters: {
    currentMap: (state): MapDefinition | null =>
      state.maps.find((map) => map.id === state.selectedMapId) ?? null,
    currentDoorStates: (state): Record<string, DoorState> =>
      state.selectedMapId ? (state.doorStatesByMap[state.selectedMapId] ?? {}) : {},
    currentLevelId(state): string | null {
      if (!state.selectedMapId) {
        return null
      }
      const map = state.maps.find((entry) => entry.id === state.selectedMapId)
      if (!map) {
        return null
      }
      return state.currentLevelByMap[state.selectedMapId] ?? getDefaultLevelId(map)
    },
    currentLevel(state): MapLevelDefinition | null {
      if (!state.selectedMapId) {
        return null
      }
      const map = state.maps.find((entry) => entry.id === state.selectedMapId)
      if (!map) {
        return null
      }
      const levelId = state.currentLevelByMap[state.selectedMapId] ?? getDefaultLevelId(map)
      return map.levels?.find((level) => level.id === levelId) ?? { id: levelId, name: levelId }
    },
    currentLevelName(state): string {
      if (!state.selectedMapId) {
        return ''
      }
      const map = state.maps.find((entry) => entry.id === state.selectedMapId)
      const levelId = map
        ? (state.currentLevelByMap[state.selectedMapId] ?? getDefaultLevelId(map))
        : null
      return map && levelId ? getLevelName(map, levelId) : ''
    },
    customMaps: (state): readonly MapDefinition[] => state.maps.filter(isCustomMap),
  },
  actions: {
    setMaps(maps: readonly MapDefinition[]): void {
      this.maps = [...maps]
      this.sourceMapIds = maps.map((map) => map.id)
      for (const map of maps) {
        this.ensureDoorStates(map.id)
        this.ensureLevel(map.id)
      }
      if (!this.selectedMapId && maps[0]) {
        this.selectedMapId = maps[0].id
      }
    },
    upsertGeneratedMap(map: MapDefinition): void {
      const existingIndex = this.maps.findIndex((entry) => entry.id === map.id)
      if (existingIndex >= 0) {
        this.maps = this.maps.map((entry, index) => (index === existingIndex ? map : entry))
      } else {
        this.maps = [map, ...this.maps]
      }
      this.doorStatesByMap[map.id] = Object.fromEntries(
        map.doors.map((door) => [door.id, door.defaultState]),
      )
      this.currentLevelByMap[map.id] = getDefaultLevelId(map)
      this.selectedMapId = map.id
    },
    upsertCustomMap(map: MapDefinition): void {
      if (!isCustomMap(map)) {
        throw new Error('Nur als eigene Karte markierte Definitionen können gespeichert werden.')
      }
      if (this.sourceMapIds.includes(map.id)) {
        throw new Error(`Die Originalkarte "${map.id}" darf nicht überschrieben werden.`)
      }
      const existingIndex = this.maps.findIndex((entry) => entry.id === map.id)
      this.maps =
        existingIndex >= 0
          ? this.maps.map((entry, index) => (index === existingIndex ? map : entry))
          : [map, ...this.maps]
      this.ensureDoorStates(map.id)
      this.ensureLevel(map.id)
      this.selectedMapId = map.id
    },
    restoreGeneratedMaps(maps: readonly MapDefinition[]): void {
      const selectedMapId = this.selectedMapId
      for (const map of maps) {
        const existingIndex = this.maps.findIndex((entry) => entry.id === map.id)
        if (existingIndex >= 0) {
          this.maps = this.maps.map((entry, index) => (index === existingIndex ? map : entry))
        } else {
          this.maps = [map, ...this.maps]
        }
        this.ensureDoorStates(map.id)
        this.ensureLevel(map.id)
      }
      if (selectedMapId && this.maps.some((map) => map.id === selectedMapId)) {
        this.selectedMapId = selectedMapId
      }
    },
    restoreCustomMaps(maps: readonly MapDefinition[]): void {
      const acceptedIds = new Set(this.maps.map((map) => map.id))
      for (const map of maps) {
        if (!isCustomMap(map) || this.sourceMapIds.includes(map.id) || acceptedIds.has(map.id)) {
          continue
        }
        this.maps = [map, ...this.maps]
        acceptedIds.add(map.id)
        this.ensureDoorStates(map.id)
        this.ensureLevel(map.id)
      }
    },
    selectMap(mapId: string): void {
      if (!this.maps.some((map) => map.id === mapId)) {
        throw new Error(`Unbekannte Karte "${mapId}".`)
      }
      this.selectedMapId = mapId
      this.ensureDoorStates(mapId)
      this.ensureLevel(mapId)
    },
    ensureLevel(mapId: string): void {
      const map = this.maps.find((entry) => entry.id === mapId)
      if (!map) {
        return
      }
      const current = this.currentLevelByMap[mapId]
      const levelIds = map.levels?.map((level) => level.id) ?? []
      if (!current || (levelIds.length > 0 && !levelIds.includes(current))) {
        this.currentLevelByMap[mapId] = getDefaultLevelId(map)
      }
    },
    setCurrentLevel(mapId: string, levelId: string): void {
      const map = this.maps.find((entry) => entry.id === mapId)
      if (!map) {
        return
      }
      if (map.levels && !map.levels.some((level) => level.id === levelId)) {
        throw new Error(`Unbekannte Ebene "${levelId}" auf Karte "${mapId}".`)
      }
      this.currentLevelByMap[mapId] = levelId
    },
    ensureDoorStates(mapId: string): void {
      const map = this.maps.find((entry) => entry.id === mapId)
      if (!map) {
        return
      }
      const existing = this.doorStatesByMap[mapId] ?? {}
      this.doorStatesByMap[mapId] = Object.fromEntries(
        map.doors.map((door) => [door.id, existing[door.id] ?? door.defaultState]),
      )
    },
    toggleDoor(doorId: string): void {
      if (!this.selectedMapId) {
        return
      }
      const states = this.doorStatesByMap[this.selectedMapId] ?? {}
      const current = states[doorId]
      if (!current) {
        throw new Error(`Unbekannter Türverweis "${doorId}".`)
      }
      this.doorStatesByMap[this.selectedMapId] = {
        ...states,
        [doorId]: current === 'closed' ? 'open' : 'closed',
      }
    },
    resetDoorStates(mapId: string): void {
      const map = this.maps.find((entry) => entry.id === mapId)
      if (!map) {
        return
      }
      this.doorStatesByMap[mapId] = Object.fromEntries(
        map.doors.map((door) => [door.id, door.defaultState]),
      )
    },
    replaceDoorStates(states: Record<string, Record<string, DoorState>>): void {
      this.doorStatesByMap = states
      for (const map of this.maps) {
        this.ensureDoorStates(map.id)
      }
    },
    replaceCurrentLevels(levels: Record<string, string>): void {
      this.currentLevelByMap = levels
      for (const map of this.maps) {
        this.ensureLevel(map.id)
      }
    },
  },
})
