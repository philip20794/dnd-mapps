import type { PixelPoint } from '@/types/geometry'
import type { CameraState } from '@/types/settings'
import { panCamera, transformCameraByGesture } from './camera'

interface TouchPointState {
  readonly pointerId: number
  start: PixelPoint
  previous: PixelPoint
  current: PixelPoint
}

const distance = (first: PixelPoint, second: PixelPoint): number =>
  Math.hypot(second.x - first.x, second.y - first.y)

const center = (first: PixelPoint, second: PixelPoint): PixelPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

export class TouchCameraGesture {
  private readonly points = new Map<number, TouchPointState>()
  private singlePanActive = false

  public constructor(private readonly movementThreshold = 7) {}

  public get size(): number {
    return this.points.size
  }

  public get pointerIds(): readonly number[] {
    return [...this.points.keys()]
  }

  public has(pointerId: number): boolean {
    return this.points.has(pointerId)
  }

  public add(pointerId: number, point: PixelPoint): void {
    if (this.points.has(pointerId)) return
    this.points.set(pointerId, {
      pointerId,
      start: point,
      previous: point,
      current: point,
    })
    this.rebase()
  }

  public move(pointerId: number, point: PixelPoint): boolean {
    const state = this.points.get(pointerId)
    if (!state) return false
    state.current = point
    return true
  }

  public remove(pointerId: number): boolean {
    const removed = this.points.delete(pointerId)
    if (removed) this.rebase()
    return removed
  }

  public clear(): void {
    this.points.clear()
    this.singlePanActive = false
  }

  public apply(camera: CameraState): CameraState | null {
    const active = [...this.points.values()]
    const first = active[0]
    if (!first) return null

    const second = active[1]
    if (second) {
      const previousCenter = center(first.previous, second.previous)
      const nextCenter = center(first.current, second.current)
      const previousDistance = distance(first.previous, second.previous)
      const nextDistance = distance(first.current, second.current)
      const zoomDelta = previousDistance > 0 ? nextDistance / previousDistance : 1
      this.commitCurrentPositions()
      this.singlePanActive = false
      if (
        previousCenter.x === nextCenter.x &&
        previousCenter.y === nextCenter.y &&
        zoomDelta === 1
      ) {
        return null
      }
      return transformCameraByGesture(camera, previousCenter, nextCenter, zoomDelta)
    }

    if (!this.singlePanActive) {
      const totalDistance = distance(first.start, first.current)
      if (totalDistance <= this.movementThreshold) return null
      const usableDistance = totalDistance - this.movementThreshold
      const delta = {
        x: ((first.current.x - first.start.x) / totalDistance) * usableDistance,
        y: ((first.current.y - first.start.y) / totalDistance) * usableDistance,
      }
      first.previous = first.current
      this.singlePanActive = true
      return panCamera(camera, delta)
    }

    const delta = {
      x: first.current.x - first.previous.x,
      y: first.current.y - first.previous.y,
    }
    first.previous = first.current
    if (delta.x === 0 && delta.y === 0) return null
    return panCamera(camera, delta)
  }

  private rebase(): void {
    for (const point of this.points.values()) {
      point.start = point.current
      point.previous = point.current
    }
    this.singlePanActive = false
  }

  private commitCurrentPositions(): void {
    for (const point of this.points.values()) {
      point.previous = point.current
    }
  }
}
