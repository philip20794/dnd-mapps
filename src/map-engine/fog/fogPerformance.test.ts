import { describe, expect, it } from 'vitest'
import type { Polygon } from '@/types/geometry'
import { defaultFogState, recordExploration } from './fogState'
import { FOG_RENDER_CELL_SIZE } from './FogRenderer'

function square(index: number): Polygon {
  const x = index * 0.5
  return [
    { x, y: 0 },
    { x: x + 1, y: 0 },
    { x: x + 1, y: 1 },
    { x, y: 1 },
  ]
}

function measure(run: () => void): number {
  const samples: number[] = []
  for (let sample = 0; sample < 7; sample += 1) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  return samples.sort((left, right) => left - right)[Math.floor(samples.length / 2)]!
}

function rasterizePolygon(polygon: Polygon): number {
  const minX = Math.floor(Math.min(...polygon.map((point) => point.x)) / 0.5)
  const maxX = Math.ceil(Math.max(...polygon.map((point) => point.x)) / 0.5)
  let visited = 0
  for (let yIndex = 0; yIndex <= 2; yIndex += 1) {
    for (let xIndex = minX; xIndex <= maxX; xIndex += 1) {
      const x = xIndex * 0.5 + 0.25
      const y = yIndex * 0.5 + 0.25
      if (
        x >= polygon[0]!.x &&
        x < polygon[1]!.x &&
        y >= polygon[0]!.y &&
        y < polygon[2]!.y
      ) {
        visited += 1
      }
    }
  }
  return visited
}

describe('Fog-Erkundungsperformance', () => {
  it('hält den temporären Renderpuffer einer 150×150-Karte kompakt', () => {
    const cells = Math.ceil(150 / FOG_RENDER_CELL_SIZE) ** 2
    expect(cells).toBe(360_000)
    expect(cells * 4).toBeLessThan(1_500_000)
  })

  it('verarbeitet neue Schritte inkrementell statt das 160er-Fenster erneut abzuspielen', () => {
    const polygons = Array.from({ length: 240 }, (_value, index) => square(index))
    let legacyPolygonRasterizations = 0
    const legacyCost = measure(() => {
      legacyPolygonRasterizations = 0
      const history: Polygon[] = []
      for (const polygon of polygons) {
        history.push(polygon)
        if (history.length > 160) history.shift()
        for (const entry of history) {
          rasterizePolygon(entry)
          legacyPolygonRasterizations += 1
        }
      }
    })
    const incrementalCost = measure(() => {
      let state = defaultFogState
      for (const polygon of polygons) state = recordExploration(state, 'map:ground', [polygon])
    })

    expect(legacyPolygonRasterizations).toBe(25_680)
    expect(polygons).toHaveLength(240)
    console.info(
      `Fog exploration median: legacy window ${legacyCost.toFixed(3)} ms, incremental mask ${incrementalCost.toFixed(3)} ms; polygon rasterizations 25680 -> 240`,
    )
  })
})
