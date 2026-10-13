import { screenToWorld } from '@/map-engine/grid/coordinates'
import type { MapDefinition } from '@/maps/api'
import type { CameraState, MapRotation } from '@/types/settings'

export interface MapViewBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface ChunkBounds extends MapViewBounds {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const chunkKey = (x: number, y: number): string => `${x},${y}`

export const boundsIntersect = (left: MapViewBounds, right: MapViewBounds): boolean =>
  left.minX < right.maxX &&
  left.maxX > right.minX &&
  left.minY < right.maxY &&
  left.maxY > right.minY

export const expandBounds = (bounds: MapViewBounds, amount: number): MapViewBounds => ({
  minX: bounds.minX - amount,
  minY: bounds.minY - amount,
  maxX: bounds.maxX + amount,
  maxY: bounds.maxY + amount,
})

export const visibleMapBounds = (
  map: Pick<MapDefinition, 'width' | 'height' | 'gridSize'>,
  camera: CameraState,
  rotation: MapRotation,
  viewport: { readonly width: number; readonly height: number },
  padding = 2,
): MapViewBounds => {
  if (viewport.width <= 0 || viewport.height <= 0 || camera.zoom <= 0)
    return { minX: 0, minY: 0, maxX: map.width, maxY: map.height }
  const mapPixelSize = { x: map.width * map.gridSize, y: map.height * map.gridSize }
  const corners = [
    { x: 0, y: 0 },
    { x: viewport.width, y: 0 },
    { x: viewport.width, y: viewport.height },
    { x: 0, y: viewport.height },
  ].map((point) => screenToWorld(point, camera, rotation, mapPixelSize))
  return {
    minX: Math.max(0, Math.min(...corners.map((point) => point.x)) / map.gridSize - padding),
    minY: Math.max(0, Math.min(...corners.map((point) => point.y)) / map.gridSize - padding),
    maxX: Math.min(
      map.width,
      Math.max(...corners.map((point) => point.x)) / map.gridSize + padding,
    ),
    maxY: Math.min(
      map.height,
      Math.max(...corners.map((point) => point.y)) / map.gridSize + padding,
    ),
  }
}
