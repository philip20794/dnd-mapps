import { describe, expect, it } from 'vitest'
import {
  fitCameraToMap,
  panCamera,
  resetCamera,
  rotatedMapPixelSize,
  zoomCameraAt,
} from '@/map-engine/camera/camera'
import {
  gridToPixels,
  hexCorners,
  hexCentersForRegion,
  hexRadiusInGridUnits,
  pixelsToGrid,
  rotateWorldPoint,
  screenToWorld,
  snapGridPoint,
  unrotateWorldPoint,
  worldToScreen,
} from './coordinates'

describe('Raster- und Kamera-Koordinaten', () => {
  it('rechnet Raster- in Pixelkoordinaten und zurück', () => {
    expect(gridToPixels({ x: 2.5, y: 3 }, 48)).toEqual({ x: 120, y: 144 })
    expect(pixelsToGrid({ x: 120, y: 144 }, 48)).toEqual({ x: 2.5, y: 3 })
  })

  it('richtet Positionen optional am Hexraster aus', () => {
    const snapped = snapGridPoint({ x: 1.51, y: hexRadiusInGridUnits + 0.02 }, true)
    expect(snapped.x).toBeCloseTo(1.5)
    expect(snapped.y).toBeCloseTo(hexRadiusInGridUnits)
    expect(snapGridPoint({ x: 2.24, y: 3.76 }, false)).toEqual({ x: 2.24, y: 3.76 })
  })

  it('berechnet sechs Hex-Ecken um einen Mittelpunkt', () => {
    const corners = hexCorners({ x: 2, y: 3 })
    expect(corners).toHaveLength(6)
    expect(corners[0]?.x).toBeCloseTo(2)
    expect(corners[0]?.y).toBeCloseTo(3 - hexRadiusInGridUnits)
  })

  it('begrenzt Hex-Abfragen auf einen lokalen Bereich großer Karten', () => {
    const centers = hexCentersForRegion(1000, 1000, {
      minX: 495,
      minY: 495,
      maxX: 505,
      maxY: 505,
    })

    expect(centers.length).toBeGreaterThan(0)
    expect(centers.length).toBeLessThan(250)
    expect(centers.every((point) => point.x > 494 && point.x < 506)).toBe(true)
  })

  it('wandelt Welt- und Bildschirmkoordinaten mit Kamera korrekt um', () => {
    const camera = { x: 20, y: 30, zoom: 2 }
    const screen = worldToScreen({ x: 50, y: 60 }, camera)
    expect(screen).toEqual({ x: 120, y: 150 })
    expect(screenToWorld(screen, camera)).toEqual({ x: 50, y: 60 })
  })

  it('dreht Weltkoordinaten in 90-Grad-Schritten und zurueck', () => {
    const mapPixelSize = { x: 400, y: 300 }
    const point = { x: 80, y: 120 }

    for (const rotation of [0, 90, 180, 270] as const) {
      const rotated = rotateWorldPoint(point, mapPixelSize, rotation)
      const unrotated = unrotateWorldPoint(rotated, mapPixelSize, rotation)
      expect(unrotated.x).toBeCloseTo(point.x)
      expect(unrotated.y).toBeCloseTo(point.y)
    }
  })

  it('zoomt auf die aktuelle Mausposition', () => {
    const camera = zoomCameraAt(resetCamera(), { x: 120, y: 120 }, 1.5)
    const before = screenToWorld({ x: 120, y: 120 }, resetCamera())
    const after = screenToWorld({ x: 120, y: 120 }, camera)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('passt eine grosse Karte in die sichtbare Flaeche ein', () => {
    const camera = fitCameraToMap(
      { width: 40, height: 45, gridSize: 48 },
      { width: 1440, height: 844 },
    )
    const rightEdge = camera.x + 40 * 48 * camera.zoom
    const bottomEdge = camera.y + 45 * 48 * camera.zoom

    expect(camera.zoom).toBeLessThan(1)
    expect(camera.x).toBeGreaterThanOrEqual(32)
    expect(camera.y).toBeGreaterThanOrEqual(32)
    expect(rightEdge).toBeLessThanOrEqual(1440 - 32)
    expect(bottomEdge).toBeLessThanOrEqual(844 - 32)
  })

  it('passt eine gedrehte Karte mit vertauschten Massen ein', () => {
    const map = { width: 20, height: 40, gridSize: 48 }
    const rotatedSize = rotatedMapPixelSize(map, 90)
    const camera = fitCameraToMap(map, { width: 1200, height: 800 }, 32, 90)
    const rightEdge = camera.x + rotatedSize.x * camera.zoom
    const bottomEdge = camera.y + rotatedSize.y * camera.zoom

    expect(rotatedSize).toEqual({ x: 1920, y: 960 })
    expect(rightEdge).toBeLessThanOrEqual(1200 - 32)
    expect(bottomEdge).toBeLessThanOrEqual(800 - 32)
  })

  it('verschiebt die Kamera additiv', () => {
    expect(panCamera({ x: 10, y: 20, zoom: 1.2 }, { x: 5, y: -3 })).toEqual({
      x: 15,
      y: 17,
      zoom: 1.2,
    })
  })
})
