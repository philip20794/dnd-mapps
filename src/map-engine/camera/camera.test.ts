import { describe, expect, it } from 'vitest'
import { screenToWorld, rotateWorldPoint, worldToScreen } from '../grid/coordinates'
import { MAX_ZOOM, MIN_ZOOM, rotateCameraAt, transformCameraByGesture } from './camera'
import { TouchCameraGesture } from './TouchCameraGesture'
import { normalizeMapRotation, type CameraState, type MapRotation } from '@/types/settings'

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

  it.each([0, 90, 180, 270] as const)(
    'keeps the rotation anchor stable at %s degrees',
    (rotation: MapRotation) => {
      const mapPixelSize = { x: 960, y: 720 }
      const camera: CameraState = { x: 42, y: -18, zoom: 0.85 }
      const worldPoint = { x: 310, y: 245 }
      const screenPoint = worldToScreen(
        rotateWorldPoint(worldPoint, mapPixelSize, rotation),
        camera,
      )
      const nextRotation = normalizeMapRotation(rotation + 90)
      const nextCamera = rotateCameraAt(camera, screenPoint, mapPixelSize, rotation, nextRotation)

      expect(screenToWorld(screenPoint, nextCamera, nextRotation, mapPixelSize)).toEqual(worldPoint)
    },
  )
})

describe('TouchCameraGesture', () => {
  it('wendet beim Ein-Finger-Pan zunächst eine Bewegungsschwelle an', () => {
    const gesture = new TouchCameraGesture()
    const camera = { x: 10, y: 20, zoom: 1 }
    gesture.add(1, { x: 100, y: 100 })

    gesture.move(1, { x: 160, y: 104 })
    expect(gesture.apply(camera)).toBeNull()
  })

  it('wechselt ohne Kamerasprung von einem auf zwei und zurück auf einen Finger', () => {
    const gesture = new TouchCameraGesture()
    const initial = { x: 0, y: 0, zoom: 1 }
    gesture.add(1, { x: 100, y: 100 })
    gesture.add(2, { x: 200, y: 100 })
    expect(gesture.apply(initial)).toBeNull()

    gesture.move(1, { x: 120, y: 110 })
    gesture.move(2, { x: 230, y: 110 })
    const afterPinch = gesture.apply(initial)!
    expect(afterPinch.camera.zoom).toBeGreaterThan(initial.zoom)

    gesture.remove(2)
    expect(gesture.apply(afterPinch.camera)).toBeNull()
    gesture.move(1, { x: 125, y: 110 })
    expect(gesture.apply(afterPinch.camera)).toBeNull()
  })

  it('reports rotation along with a two-finger gesture', () => {
    const gesture = new TouchCameraGesture()
    gesture.add(1, { x: 100, y: 100 })
    gesture.add(2, { x: 200, y: 100 })
    gesture.move(2, { x: 100, y: 200 })

    expect(gesture.apply({ x: 0, y: 0, zoom: 1 })?.rotationDelta).toBeCloseTo(Math.PI / 2)
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
    expect(gesture.apply(afterPinch.camera)).toBeNull()
    expect(gesture.has(1)).toBe(true)
    expect(gesture.has(2)).toBe(false)
  })
})
