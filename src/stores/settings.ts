import { defineStore } from 'pinia'
import type { CameraState, MapRotation, RuntimeSettings } from '@/types/settings'
import { defaultRuntimeSettings, normalizeMapRotation } from '@/types/settings'

export const useSettingsStore = defineStore('settings', {
  state: (): RuntimeSettings => structuredClone(defaultRuntimeSettings),
  getters: {
    zoomPercent: (state): number => Math.round(state.camera.zoom * 100),
  },
  actions: {
    setCamera(camera: CameraState): void {
      this.camera = camera
    },
    resetCamera(): void {
      this.camera = { ...defaultRuntimeSettings.camera }
    },
    rotateMapClockwise(): void {
      this.mapRotation = normalizeMapRotation(this.mapRotation + 90)
    },
    setMapRotation(rotation: MapRotation): void {
      this.mapRotation = normalizeMapRotation(rotation)
    },
    resetAll(): void {
      this.$patch(structuredClone(defaultRuntimeSettings))
    },
    setGridVisible(visible: boolean): void {
      this.grid.visible = visible
    },
    setSnapToGrid(snap: boolean): void {
      this.grid.snap = snap
    },
    setAnimationsEnabled(enabled: boolean): void {
      this.animations.enabled = enabled
    },
    setReducedAnimations(reduced: boolean): void {
      this.animations.reduced = reduced
    },
    setLightingEnabled(enabled: boolean): void {
      this.lighting.enabled = enabled
    },
    replaceState(settings: Partial<RuntimeSettings>): void {
      this.$patch({
        ...structuredClone(defaultRuntimeSettings),
        ...settings,
        mapRotation: normalizeMapRotation(settings.mapRotation ?? 0),
      })
    },
  },
})
