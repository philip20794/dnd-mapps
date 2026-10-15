import type { PixelPoint } from '@/types/geometry'
import type { CameraState } from '@/types/settings'
import { transformCameraByGesture } from './camera'

interface TouchPointState {
  readonly pointerId: number
  previous: PixelPoint
  current: PixelPoint
}

export interface TouchCameraGestureUpdate {
  readonly camera: CameraState
  readonly center: PixelPoint
  readonly rotationDelta: number
}

const distance = (first: PixelPoint, second: PixelPoint): number =>
  Math.hypot(second.x - first.x, second.y - first.y)

const center = (first: PixelPoint, second: PixelPoint): PixelPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const angle = (first: PixelPoint, second: PixelPoint): number =>
  Math.atan2(second.y - first.y, second.x - first.x)

const normalizedAngleDelta = (previous: number, next: number): number => {
  const delta = next - previous
  return Math.atan2(Math.sin(delta), Math.cos(delta))
}

export class TouchCameraGesture {
  private readonly points = new Map<number, TouchPointState>()

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
  }

  public apply(camera: CameraState): TouchCameraGestureUpdate | null {
    const active = [...this.points.values()]
    const first = active[0]
    if (!first) return null

    const second = active[1]
    if (!second) return null

    const previousCenter = center(first.previous, second.previous)
    const nextCenter = center(first.current, second.current)
    const previousDistance = distance(first.previous, second.previous)
    const nextDistance = distance(first.current, second.current)
    const zoomDelta = previousDistance > 0 ? nextDistance / previousDistance : 1
    const rotationDelta = normalizedAngleDelta(
      angle(first.previous, second.previous),
      angle(first.current, second.current),
    )
    this.commitCurrentPositions()
    if (
      previousCenter.x === nextCenter.x &&
      previousCenter.y === nextCenter.y &&
      zoomDelta === 1 &&
      rotationDelta === 0
    ) {
      return null
    }
    return {
      camera: transformCameraByGesture(camera, previousCenter, nextCenter, zoomDelta),
      center: nextCenter,
      rotationDelta,
    }
  }

  private rebase(): void {
    for (const point of this.points.values()) {
      point.previous = point.current
    }
  }

  private commitCurrentPositions(): void {
    for (const point of this.points.values()) {
      point.previous = point.current
    }
  }
}
