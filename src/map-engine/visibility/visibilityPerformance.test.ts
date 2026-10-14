import { describe, expect, it } from 'vitest'
import burgNaerytar from '@/maps/burg-naerytar-dungeon.map'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import {
  FOG_INVISIBLE_CELL,
  FOG_RENDER_CELL_SIZE,
  rasterizeVisibilityFieldsScanline,
  visibilityRangeFadeAtPoint,
  writeFogPixels,
} from '@/map-engine/fog/FogRenderer'
import {
  combineVisibilityFieldsWithPreparedGeometry,
  polygonContainsPoint,
  prepareVisibilityGeometry,
  raySegmentIntersection,
  visibilityBlockersNear,
  type PreparedVisibilityGeometry,
  type VisibilityBlocker,
  type VisibilityField,
} from './visibility'

const RAY_EPSILON = 0.0001
const FULL_CIRCLE_RAY_COUNT = 96

interface BenchmarkResult {
  readonly scenario: string
  readonly tokens: number
  readonly blockers: number
  readonly nearbyBlockers: number
  readonly rayBeforeMs: number
  readonly rayAfterMs: number
  readonly fogBeforeMs: number
  readonly fogAfterMs: number
  readonly pixelWriteBeforeMs: number
  readonly pixelWriteAfterMs: number
  readonly legacyFogWithLegacyPolygonMs: number
  readonly totalBeforeMs: number
  readonly totalAfterMs: number
  readonly oldVisibleCells: number
  readonly scanlineBufferBytes: number
  readonly rgbaTextureBytes: number
  readonly linearNearbyQueryMs: number
  readonly indexedNearbyQueryMs: number
  readonly spatialIndexBuildMs: number
}

let _benchmarkSink: unknown

const round = (value: number): number => Math.round(value * 100) / 100

const medianDuration = (callback: () => unknown, repetitions = 5): number => {
  const durations: number[] = []
  for (let index = 0; index < repetitions + 2; index += 1) {
    const started = performance.now()
    _benchmarkSink = callback()
    const duration = performance.now() - started
    if (index >= 2) durations.push(duration)
  }
  durations.sort((left, right) => left - right)
  return durations[Math.floor(durations.length / 2)]!
}

const benchmarkToken = (map: MapDefinition, id: string, position: GridPoint): PlacedToken => ({
  id,
  mapId: map.id,
  levelId: map.defaultLevelId,
  name: id,
  position,
  size: 1,
  rotation: 0,
  visionRange: 12,
  visionAngle: null,
  visionEnabled: true,
  category: 'player',
  color: '#3f8cff',
  symbol: 'P',
})

/** Reproduces the previous prepared-geometry path: all endpoints generated angles,
 * while only nearby blockers participated in the intersections. */
const legacyVisibilityPolygon = (
  token: PlacedToken,
  geometry: PreparedVisibilityGeometry,
): Polygon => {
  const nearby = visibilityBlockersNear(geometry.blockers, token.position, token.visionRange)
  const angles = geometry.segments
    .flatMap((segment) =>
      [segment.a, segment.b].flatMap((point) => {
        const angle = Math.atan2(point.y - token.position.y, point.x - token.position.x)
        return [angle - RAY_EPSILON, angle, angle + RAY_EPSILON]
      }),
    )
    .concat(
      Array.from(
        { length: FULL_CIRCLE_RAY_COUNT },
        (_value, index) => (Math.PI * 2 * index) / FULL_CIRCLE_RAY_COUNT,
      ),
    )
    .sort((left, right) => {
      const normalizedLeft = ((left % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const normalizedRight = ((right % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      return normalizedLeft - normalizedRight
    })

  return angles.map((angle) => {
    let closestDistance = token.visionRange
    let closestPoint: GridPoint | null = null
    for (const blocker of nearby) {
      const hit = raySegmentIntersection(token.position, angle, blocker.segment, token.visionRange)
      if (hit && hit.distance < closestDistance) {
        closestDistance = hit.distance
        closestPoint = hit.point
      }
    }
    return (
      closestPoint ?? {
        x: token.position.x + Math.cos(angle) * token.visionRange,
        y: token.position.y + Math.sin(angle) * token.visionRange,
      }
    )
  })
}

const legacyVisibilityFields = (
  tokens: readonly PlacedToken[],
  geometry: PreparedVisibilityGeometry,
): readonly VisibilityField[] =>
  tokens.map((token) => ({
    polygon: legacyVisibilityPolygon(token, geometry),
    rangeBoundary: { origin: token.position, range: token.visionRange },
  }))

/** Previous FogRenderer rasterizer, kept here only as a measurable baseline. */
const legacyRasterize = (
  fields: readonly VisibilityField[],
  map: Pick<MapDefinition, 'width' | 'height'>,
): Map<number, number> => {
  const xCells = Math.ceil(map.width / FOG_RENDER_CELL_SIZE)
  const yCells = Math.ceil(map.height / FOG_RENDER_CELL_SIZE)
  const cells = new Map<number, number>()
  const halfCell = FOG_RENDER_CELL_SIZE / 2

  for (const field of fields) {
    if (field.polygon.length < 3) continue
    const xs = field.polygon.map((point) => point.x)
    const ys = field.polygon.map((point) => point.y)
    const minX = Math.max(0, Math.floor(Math.min(...xs) / FOG_RENDER_CELL_SIZE))
    const maxX = Math.min(xCells - 1, Math.ceil(Math.max(...xs) / FOG_RENDER_CELL_SIZE))
    const minY = Math.max(0, Math.floor(Math.min(...ys) / FOG_RENDER_CELL_SIZE))
    const maxY = Math.min(yCells - 1, Math.ceil(Math.max(...ys) / FOG_RENDER_CELL_SIZE))

    for (let yIndex = minY; yIndex <= maxY; yIndex += 1) {
      for (let xIndex = minX; xIndex <= maxX; xIndex += 1) {
        const point = {
          x: xIndex * FOG_RENDER_CELL_SIZE + halfCell,
          y: yIndex * FOG_RENDER_CELL_SIZE + halfCell,
        }
        if (!polygonContainsPoint(field.polygon, point)) continue
        const fade = field.rangeBoundary
          ? visibilityRangeFadeAtPoint(field.rangeBoundary, point)
          : 0
        const key = yIndex * xCells + xIndex
        const previous = cells.get(key)
        if (previous === undefined || fade < previous) cells.set(key, fade)
      }
    }
  }
  return cells
}

const createSyntheticMap = (): MapDefinition => {
  const walls = Array.from({ length: 360 }, (_value, index) => {
    const column = index % 30
    const row = Math.floor(index / 30)
    const x = 3 + column * 4.9
    const y = 3 + row * 11.8
    return {
      id: `synthetic-wall-${index}`,
      a: { x, y },
      b: { x: x + (row % 2 === 0 ? 0 : 2.4), y: y + 4.5 },
      blocksSight: true,
      blocksMovement: true,
    }
  })
  return {
    id: 'synthetic-150',
    name: 'Synthetische 150x150-Sichtkarte',
    width: 150,
    height: 150,
    gridSize: 48,
    objects: [],
    walls,
    doors: [],
    spawnPoints: [],
  }
}

interface BlockerGrid {
  readonly cellSize: number
  readonly cells: ReadonlyMap<string, readonly VisibilityBlocker[]>
}

const blockerBoundsOverlap = (
  blocker: VisibilityBlocker,
  origin: GridPoint,
  range: number,
): boolean =>
  Math.max(blocker.segment.a.x, blocker.segment.b.x) >= origin.x - range &&
  Math.min(blocker.segment.a.x, blocker.segment.b.x) <= origin.x + range &&
  Math.max(blocker.segment.a.y, blocker.segment.b.y) >= origin.y - range &&
  Math.min(blocker.segment.a.y, blocker.segment.b.y) <= origin.y + range

const gridKey = (x: number, y: number): string => `${x}:${y}`

const createBlockerGrid = (blockers: readonly VisibilityBlocker[], cellSize = 16): BlockerGrid => {
  const mutable = new Map<string, VisibilityBlocker[]>()
  for (const blocker of blockers) {
    const segment = blocker.segment
    const minX = Math.floor(Math.min(segment.a.x, segment.b.x) / cellSize)
    const maxX = Math.floor(Math.max(segment.a.x, segment.b.x) / cellSize)
    const minY = Math.floor(Math.min(segment.a.y, segment.b.y) / cellSize)
    const maxY = Math.floor(Math.max(segment.a.y, segment.b.y) / cellSize)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = gridKey(x, y)
        const entries = mutable.get(key)
        if (entries) entries.push(blocker)
        else mutable.set(key, [blocker])
      }
    }
  }
  return { cellSize, cells: mutable }
}

const blockersNearGrid = (
  grid: BlockerGrid,
  origin: GridPoint,
  range: number,
): readonly VisibilityBlocker[] => {
  const minX = Math.floor((origin.x - range) / grid.cellSize)
  const maxX = Math.floor((origin.x + range) / grid.cellSize)
  const minY = Math.floor((origin.y - range) / grid.cellSize)
  const maxY = Math.floor((origin.y + range) / grid.cellSize)
  const candidates = new Set<VisibilityBlocker>()
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      for (const blocker of grid.cells.get(gridKey(x, y)) ?? []) candidates.add(blocker)
    }
  }
  return [...candidates].filter((blocker) => blockerBoundsOverlap(blocker, origin, range))
}

const runScenario = (
  scenario: string,
  map: MapDefinition,
  positions: readonly GridPoint[],
  tokenCount: number,
): BenchmarkResult => {
  const tokens = positions
    .slice(0, tokenCount)
    .map((position, index) => benchmarkToken(map, `${scenario}-${index}`, position))
  const geometry = prepareVisibilityGeometry(map, {})
  const nearbyCount = tokens.reduce(
    (sum, token) =>
      sum + visibilityBlockersNear(geometry.blockers, token.position, token.visionRange).length,
    0,
  )
  const currentFields = combineVisibilityFieldsWithPreparedGeometry(tokens, map, geometry, [])
  const oldFields = legacyVisibilityFields(tokens, geometry)
  let scanlineTarget: Uint16Array | undefined

  const rayBeforeMs = medianDuration(() => legacyVisibilityFields(tokens, geometry))
  const rayAfterMs = medianDuration(() =>
    combineVisibilityFieldsWithPreparedGeometry(tokens, map, geometry, []),
  )
  // Use identical polygons to isolate the rasterizer. The end-to-end baseline below additionally
  // includes the much larger polygons produced by the previous all-endpoints ray path.
  const fogBeforeMs = medianDuration(() => legacyRasterize(currentFields, map))
  const legacyFogWithLegacyPolygonMs = medianDuration(() => legacyRasterize(oldFields, map))
  const fogAfterMs = medianDuration(() => {
    scanlineTarget = rasterizeVisibilityFieldsScanline(
      currentFields,
      map.width,
      map.height,
      scanlineTarget,
    )
    return scanlineTarget
  })
  let totalScanlineTarget: Uint16Array | undefined
  const totalBeforeMs = medianDuration(() => {
    const fields = legacyVisibilityFields(tokens, geometry)
    return legacyRasterize(fields, map)
  }, 3)
  const totalAfterMs = medianDuration(() => {
    const fields = combineVisibilityFieldsWithPreparedGeometry(tokens, map, geometry, [])
    totalScanlineTarget = rasterizeVisibilityFieldsScanline(
      fields,
      map.width,
      map.height,
      totalScanlineTarget,
    )
    return totalScanlineTarget
  })

  const indexStarted = performance.now()
  const blockerGrid = createBlockerGrid(geometry.blockers)
  const spatialIndexBuildMs = performance.now() - indexStarted
  const queryRepetitions = 200
  const linearNearbyQueryMs =
    medianDuration(() => {
      let count = 0
      for (let repetition = 0; repetition < queryRepetitions; repetition += 1) {
        for (const token of tokens) {
          count += visibilityBlockersNear(
            geometry.blockers,
            token.position,
            token.visionRange,
          ).length
        }
      }
      return count
    }) / queryRepetitions
  const indexedNearbyQueryMs =
    medianDuration(() => {
      let count = 0
      for (let repetition = 0; repetition < queryRepetitions; repetition += 1) {
        for (const token of tokens) {
          count += blockersNearGrid(blockerGrid, token.position, token.visionRange).length
        }
      }
      return count
    }) / queryRepetitions

  const oldCells = legacyRasterize(oldFields, map)
  const xCells = Math.ceil(map.width / FOG_RENDER_CELL_SIZE)
  const yCells = Math.ceil(map.height / FOG_RENDER_CELL_SIZE)
  const scanlineCells = rasterizeVisibilityFieldsScanline(currentFields, map.width, map.height)
  const pixelBuffer = new Uint8ClampedArray(xCells * yCells * 4)
  const pixelWriteBeforeMs = medianDuration(() =>
    writeFogPixels(scanlineCells, xCells, yCells, null, pixelBuffer, false),
  )
  const pixelWriteAfterMs = medianDuration(() =>
    writeFogPixels(scanlineCells, xCells, yCells, null, pixelBuffer, true),
  )
  expect(scanlineCells.some((value) => value !== FOG_INVISIBLE_CELL)).toBe(true)
  expect(oldCells.size).toBeGreaterThan(0)

  return {
    scenario,
    tokens: tokenCount,
    blockers: geometry.blockers.length,
    nearbyBlockers: nearbyCount,
    rayBeforeMs: round(rayBeforeMs),
    rayAfterMs: round(rayAfterMs),
    fogBeforeMs: round(fogBeforeMs),
    fogAfterMs: round(fogAfterMs),
    pixelWriteBeforeMs: round(pixelWriteBeforeMs),
    pixelWriteAfterMs: round(pixelWriteAfterMs),
    legacyFogWithLegacyPolygonMs: round(legacyFogWithLegacyPolygonMs),
    totalBeforeMs: round(totalBeforeMs),
    totalAfterMs: round(totalAfterMs),
    oldVisibleCells: oldCells.size,
    scanlineBufferBytes: scanlineCells.byteLength,
    rgbaTextureBytes: xCells * yCells * 4,
    linearNearbyQueryMs: round(linearNearbyQueryMs),
    indexedNearbyQueryMs: round(indexedNearbyQueryMs),
    spatialIndexBuildMs: round(spatialIndexBuildMs),
  }
}

describe('Visibility- und Fog-Performance', () => {
  it(
    'misst Burg Naerytar und eine synthetische Grosskarte mit 1, 3 und 5 Sichtquellen',
    { timeout: 120_000 },
    () => {
      const synthetic = createSyntheticMap()
      const scenarios = [
        {
          name: 'burg-naerytar',
          map: burgNaerytar,
          positions: [
            { x: 49.81, y: 22.44 },
            { x: 59.69, y: 17.38 },
            { x: 44.5, y: 31.31 },
            { x: 30.75, y: 26.19 },
            { x: 37.75, y: 9 },
          ],
        },
        {
          name: 'synthetic-150x150',
          map: synthetic,
          positions: [
            { x: 75, y: 75 },
            { x: 60, y: 75 },
            { x: 90, y: 75 },
            { x: 75, y: 60 },
            { x: 75, y: 90 },
          ],
        },
      ] as const

      const results = scenarios.flatMap((scenario) =>
        [1, 3, 5].map((tokenCount) =>
          runScenario(scenario.name, scenario.map, scenario.positions, tokenCount),
        ),
      )

      console.info(`VISIBILITY_FOG_BENCHMARK=${JSON.stringify(results)}`)
      expect(results).toHaveLength(6)
      expect(results.every((result) => result.rayAfterMs < result.rayBeforeMs)).toBe(true)
      expect(results.every((result) => result.fogAfterMs < result.fogBeforeMs)).toBe(true)
    },
  )
})
