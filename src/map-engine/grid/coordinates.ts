import type { CameraState } from '@/types/settings'
import { normalizeMapRotation, type MapRotation } from '@/types/settings'
import type { GridPoint, PixelPoint } from '@/types/geometry'

interface AxialPoint {
  readonly q: number
  readonly r: number
}

export const hexRadiusInGridUnits = 1 / Math.sqrt(3)
export const hexWidthInGridUnits = 1
export const hexHeightInGridUnits = hexRadiusInGridUnits * 2
export const hexVerticalSpacingInGridUnits = hexRadiusInGridUnits * 1.5
export const hexOrigin: GridPoint = { x: 0.5, y: hexRadiusInGridUnits }

export const gridToPixels = (point: GridPoint, gridSize: number): PixelPoint => ({
  x: point.x * gridSize,
  y: point.y * gridSize,
})

export const pixelsToGrid = (point: PixelPoint, gridSize: number): GridPoint => ({
  x: point.x / gridSize,
  y: point.y / gridSize,
})

const gridToAxial = (point: GridPoint): AxialPoint => {
  const x = point.x - hexOrigin.x
  const y = point.y - hexOrigin.y
  return {
    q: ((Math.sqrt(3) / 3) * x - y / 3) / hexRadiusInGridUnits,
    r: ((2 / 3) * y) / hexRadiusInGridUnits,
  }
}

export const axialToGrid = (point: AxialPoint): GridPoint => ({
  x: hexOrigin.x + hexWidthInGridUnits * (point.q + point.r / 2),
  y: hexOrigin.y + hexVerticalSpacingInGridUnits * point.r,
})

const roundAxial = (point: AxialPoint): AxialPoint => {
  const x = point.q
  const z = point.r
  const y = -x - z

  let roundedX = Math.round(x)
  let roundedY = Math.round(y)
  let roundedZ = Math.round(z)

  const xDiff = Math.abs(roundedX - x)
  const yDiff = Math.abs(roundedY - y)
  const zDiff = Math.abs(roundedZ - z)

  if (xDiff > yDiff && xDiff > zDiff) {
    roundedX = -roundedY - roundedZ
  } else if (yDiff > zDiff) {
    roundedY = -roundedX - roundedZ
  } else {
    roundedZ = -roundedX - roundedY
  }

  return { q: roundedX, r: roundedZ }
}

export const snapGridPoint = (point: GridPoint, enabled: boolean): GridPoint => {
  if (!enabled) {
    return point
  }
  return axialToGrid(roundAxial(gridToAxial(point)))
}

export function hexDistanceBetweenGridPoints(start: GridPoint, end: GridPoint): number {
  const startAxial = roundAxial(gridToAxial(start))
  const endAxial = roundAxial(gridToAxial(end))
  const deltaQ = endAxial.q - startAxial.q
  const deltaR = endAxial.r - startAxial.r
  const deltaS = -deltaQ - deltaR
  return Math.max(Math.abs(deltaQ), Math.abs(deltaR), Math.abs(deltaS))
}

export const hexCorners = (center: GridPoint): readonly GridPoint[] =>
  Array.from({ length: 6 }, (_value, index) => {
    const angle = -Math.PI / 2 + (Math.PI / 3) * index
    return {
      x: center.x + Math.cos(angle) * hexRadiusInGridUnits,
      y: center.y + Math.sin(angle) * hexRadiusInGridUnits,
    }
  })

export const hexCentersForBounds = (
  width: number,
  height: number,
  margin = hexRadiusInGridUnits,
): readonly GridPoint[] =>
  hexCentersForRegion(width, height, { minX: 0, minY: 0, maxX: width, maxY: height }, margin)

export interface GridBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export const hexCentersForRegion = (
  width: number,
  height: number,
  bounds: GridBounds,
  margin = hexRadiusInGridUnits,
): readonly GridPoint[] => {
  const centers: GridPoint[] = []
  const minX = Math.max(0, bounds.minX)
  const minY = Math.max(0, bounds.minY)
  const maxX = Math.min(width, bounds.maxX)
  const maxY = Math.min(height, bounds.maxY)
  if (minX > maxX || minY > maxY) return centers
  const minRow = Math.floor((minY - hexOrigin.y - margin) / hexVerticalSpacingInGridUnits)
  const maxRow = Math.ceil((maxY - hexOrigin.y + margin) / hexVerticalSpacingInGridUnits)

  for (let row = minRow; row <= maxRow; row += 1) {
    const minColumn = Math.floor(minX - hexOrigin.x - row / 2 - margin)
    const maxColumn = Math.ceil(maxX - hexOrigin.x - row / 2 + margin)

    for (let column = minColumn; column <= maxColumn; column += 1) {
      const center = axialToGrid({ q: column, r: row })
      if (
        center.x >= minX - margin &&
        center.y >= minY - margin &&
        center.x <= maxX + margin &&
        center.y <= maxY + margin
      ) {
        centers.push(center)
      }
    }
  }

  return centers
}

export const worldToScreen = (point: PixelPoint, camera: CameraState): PixelPoint => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
})

export const rotateWorldPoint = (
  point: PixelPoint,
  mapPixelSize: PixelPoint,
  rotation: MapRotation,
): PixelPoint => {
  switch (normalizeMapRotation(rotation)) {
    case 90:
      return { x: mapPixelSize.y - point.y, y: point.x }
    case 180:
      return { x: mapPixelSize.x - point.x, y: mapPixelSize.y - point.y }
    case 270:
      return { x: point.y, y: mapPixelSize.x - point.x }
    default:
      return point
  }
}

export const unrotateWorldPoint = (
  point: PixelPoint,
  mapPixelSize: PixelPoint,
  rotation: MapRotation,
): PixelPoint => {
  switch (normalizeMapRotation(rotation)) {
    case 90:
      return { x: point.y, y: mapPixelSize.y - point.x }
    case 180:
      return { x: mapPixelSize.x - point.x, y: mapPixelSize.y - point.y }
    case 270:
      return { x: mapPixelSize.x - point.y, y: point.x }
    default:
      return point
  }
}

export const screenToWorld = (
  point: PixelPoint,
  camera: CameraState,
  rotation: MapRotation = 0,
  mapPixelSize?: PixelPoint,
): PixelPoint => {
  const displayedPoint = {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  }

  return mapPixelSize ? unrotateWorldPoint(displayedPoint, mapPixelSize, rotation) : displayedPoint
}

export const clientToLocal = (client: PixelPoint, bounds: DOMRect): PixelPoint => ({
  x: client.x - bounds.left,
  y: client.y - bounds.top,
})
