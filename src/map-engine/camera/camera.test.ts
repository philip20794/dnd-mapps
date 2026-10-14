import { describe, expect, it } from 'vitest'
import { screenToWorld, rotateWorldPoint, worldToScreen } from '../grid/coordinates'
import { MAX_ZOOM, MIN_ZOOM, transformCameraByGesture } from './camera'
import { TouchCameraGesture } from './TouchCameraGesture'
import type { CameraState, MapRotation } from '@/types/settings'

describe('transformCameraByGesture', () => {
  it.each([0, 90, 180, 270] as const)(
    'hält den Kartenpunkt unter dem Pinch-Mittelpunkt bei %s° stabil',
    (rotation: MapRotation) => {
      const mapPixelSize = { x: 960, y: 720 }
      const worldPoint = { x: 310, y: 245 }
      const camera: CameraState = { x: 42, y: -18, zoom: 0.85 }
      const displayedPoint = rotateWorldPoint(worldPoint, mapPixelSize, rotation)
      const previousCenter = worldToScreen(displayedPoint, camera)
      const nextCenter = { x: previousCenter.x + 34, y: previousCenter.y - 21 }

      const nextCamera = transformCameraByGesture(camera, previousCenter, nextCenter, 1.35)
      const anchoredWorldPoint = screenToWorld(nextCenter, nextCamera, rotation, mapPixelSize)

      expect(anchoredWorldPoint.x).toBeCloseTo(worldPoint.x, 8)
      expect(anchoredWorldPoint.y).toBeCloseTo(worldPoint.y, 8)
    },
  )

  it('behält die vorhandenen Zoom-Grenzen bei', () => {
    const center = { x: 200, y: 150 }
    expect(transformCameraByGesture({ x: 0, y: 0, zoom: 2.7 }, center, center, 2).zoom).toBe(
      MAX_ZOOM,
    )
    expect(transformCameraByGesture({ x: 0, y: 0, zoom: 0.3 }, center, center, 0.1).zoom).toBe(
      MIN_ZOOM,
    )
  })
})

describe('TouchCameraGesture', () => {
  it('wendet beim Ein-Finger-Pan zunächst eine Bewegungsschwelle an', () => {
    const gesture = new TouchCameraGesture(7)
    const camera = { x: 10, y: 20, zoom: 1 }
    gesture.add(1, { x: 100, y: 100 })

    gesture.move(1, { x: 105, y: 100 })
    expect(gesture.apply(camera)).toBeNull()

    gesture.move(1, { x: 110, y: 100 })
    const activated = gesture.apply(camera)
    expect(activated).toEqual({ x: 13, y: 20, zoom: 1 })

    gesture.move(1, { x: 116, y: 104 })
    expect(gesture.apply(activated!)).toEqual({ x: 19, y: 24, zoom: 1 })
  })

  it('wechselt ohne Kamerasprung von einem auf zwei und zurück auf einen Finger', () => {
    const gesture = new TouchCameraGesture(7)
    const initial = { x: 0, y: 0, zoom: 1 }
    gesture.add(1, { x: 100, y: 100 })
    gesture.move(1, { x: 110, y: 100 })
    const afterPan = gesture.apply(initial)!

    gesture.add(2, { x: 200, y: 100 })
    expect(gesture.apply(afterPan)).toBeNull()

    gesture.move(1, { x: 120, y: 110 })
    gesture.move(2, { x: 230, y: 110 })
    const afterPinch = gesture.apply(afterPan)!
    expect(afterPinch.zoom).toBeGreaterThan(afterPan.zoom)

    gesture.remove(2)
    expect(gesture.apply(afterPinch)).toBeNull()
    gesture.move(1, { x: 125, y: 110 })
    expect(gesture.apply(afterPinch)).toBeNull()
    gesture.move(1, { x: 130, y: 110 })
    expect(gesture.apply(afterPinch)).toEqual({
      ...afterPinch,
      x: afterPinch.x + 3,
    })
  })

  it('rebasiert die verbleibenden Pointer nach cancel stabil', () => {
    const gesture = new TouchCameraGesture()
    const camera = { x: 5, y: 8, zoom: 1 }
    gesture.add(1, { x: 80, y: 80 })
    gesture.add(2, { x: 180, y: 80 })
    gesture.move(1, { x: 70, y: 80 })
    gesture.move(2, { x: 190, y: 80 })
    const afterPinch = gesture.apply(camera)!

    gesture.remove(2)
    expect(gesture.apply(afterPinch)).toBeNull()
    expect(gesture.has(1)).toBe(true)
    expect(gesture.has(2)).toBe(false)
  })
})
