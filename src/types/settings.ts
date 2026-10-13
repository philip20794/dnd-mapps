export interface CameraState {
  x: number
  y: number
  zoom: number
}

export type MapRotation = 0 | 90 | 180 | 270

export interface GridSettings {
  visible: boolean
  snap: boolean
}

export interface AnimationSettings {
  enabled: boolean
  reduced: boolean
}

export interface LightingSettings {
  enabled: boolean
}

export interface RuntimeSettings {
  camera: CameraState
  mapRotation: MapRotation
  grid: GridSettings
  animations: AnimationSettings
  lighting: LightingSettings
}

export const defaultCameraState: CameraState = {
  x: 48,
  y: 48,
  zoom: 1,
}

export const defaultRuntimeSettings: RuntimeSettings = {
  camera: defaultCameraState,
  mapRotation: 0,
  grid: {
    visible: true,
    snap: true,
  },
  animations: {
    enabled: true,
    reduced: false,
  },
  lighting: {
    enabled: true,
  },
}

export const normalizeMapRotation = (rotation: number): MapRotation => {
  const normalized = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0
}
