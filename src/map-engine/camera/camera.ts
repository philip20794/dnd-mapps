import type { CameraState } from '@/types/settings'
import { normalizeMapRotation, type MapRotation } from '@/types/settings'
import type { PixelPoint } from '@/types/geometry'

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.8

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export const zoomCameraAt = (
  camera: CameraState,
  screenPoint: PixelPoint,
  zoomDelta: number,
): CameraState => {
  const nextZoom = clampZoom(camera.zoom * zoomDelta)
  const worldX = (screenPoint.x - camera.x) / camera.zoom
  const worldY = (screenPoint.y - camera.y) / camera.zoom

  return {
    x: screenPoint.x - worldX * nextZoom,
    y: screenPoint.y - worldY * nextZoom,
    zoom: nextZoom,
  }
}

export const panCamera = (camera: CameraState, delta: PixelPoint): CameraState => ({
  x: camera.x + delta.x,
  y: camera.y + delta.y,
  zoom: camera.zoom,
})

export const transformCameraByGesture = (
  camera: CameraState,
  previousCenter: PixelPoint,
  nextCenter: PixelPoint,
  zoomDelta: number,
): CameraState => {
  const nextZoom = clampZoom(camera.zoom * zoomDelta)
  const anchoredPoint = {
    x: (previousCenter.x - camera.x) / camera.zoom,
    y: (previousCenter.y - camera.y) / camera.zoom,
  }

  return {
    x: nextCenter.x - anchoredPoint.x * nextZoom,
    y: nextCenter.y - anchoredPoint.y * nextZoom,
    zoom: nextZoom,
  }
}

export const resetCamera = (): CameraState => ({
  x: 48,
  y: 48,
  zoom: 1,
})

export const rotatedMapPixelSize = (
  map: { readonly width: number; readonly height: number; readonly gridSize: number },
  rotation: MapRotation = 0,
): PixelPoint => {
  const normalizedRotation = normalizeMapRotation(rotation)
  const width = map.width * map.gridSize
  const height = map.height * map.gridSize
  return normalizedRotation === 90 || normalizedRotation === 270
    ? { x: height, y: width }
    : { x: width, y: height }
}

export const fitCameraToMap = (
  map: { readonly width: number; readonly height: number; readonly gridSize: number },
  viewport: { readonly width: number; readonly height: number },
  padding = 32,
  rotation: MapRotation = 0,
): CameraState => {
  const mapSize = rotatedMapPixelSize(map, rotation)
  const mapWidth = mapSize.x
  const mapHeight = mapSize.y
  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const zoom = clampZoom(Math.min(1, availableWidth / mapWidth, availableHeight / mapHeight))

  return {
    x: (viewport.width - mapWidth * zoom) / 2,
    y: (viewport.height - mapHeight * zoom) / 2,
    zoom,
  }
}
