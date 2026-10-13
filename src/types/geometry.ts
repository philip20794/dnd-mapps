export interface GridPoint {
  readonly x: number
  readonly y: number
}

export interface PixelPoint {
  readonly x: number
  readonly y: number
}

export interface Segment {
  readonly a: GridPoint
  readonly b: GridPoint
}

export interface PixelSegment {
  readonly a: PixelPoint
  readonly b: PixelPoint
}

export type Polygon = readonly GridPoint[]

export interface RectBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const clonePoint = (point: GridPoint): GridPoint => ({ x: point.x, y: point.y })
