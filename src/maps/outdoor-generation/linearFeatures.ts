import { createSeededRandom, integer } from '@/map-generation/random'
import type { MapPlan, WaterPreference } from '@/map-generation/types'
import { cellKey, type DungeonCell as OutdoorCell } from '@/maps/dungeon-generation/roomShapes'
import type { OutdoorPoint, OutdoorRegionLayout } from './regionLayout'

export interface OutdoorPathFeature {
  readonly id: string
  readonly kind: 'main-road' | 'side-path'
  readonly points: readonly OutdoorPoint[]
  readonly cells: readonly OutdoorCell[]
  readonly targetId: string
}

export interface OutdoorRiverFeature {
  readonly id: string
  readonly points: readonly OutdoorPoint[]
  readonly widths: readonly number[]
  readonly cells: readonly OutdoorCell[]
}

export interface OutdoorWaterFeatureLayout {
  readonly rivers: readonly OutdoorRiverFeature[]
  readonly waterCells: ReadonlySet<string>
  readonly bankCells: ReadonlySet<string>
  readonly lakeCells: ReadonlySet<string>
}

export interface OutdoorBridgeSite {
  readonly id: string
  readonly position: OutdoorPoint
  readonly horizontal: boolean
}

export interface OutdoorLinearFeatures {
  readonly paths: readonly OutdoorPathFeature[]
  readonly pathCells: ReadonlySet<string>
  readonly water: OutdoorWaterFeatureLayout
  readonly bridges: readonly OutdoorBridgeSite[]
}

const inBounds = (layout: OutdoorRegionLayout, point: OutdoorCell): boolean =>
  point.x >= 0 && point.y >= 0 && point.x < layout.width && point.y < layout.height

const lineCells = (from: OutdoorPoint, to: OutdoorPoint): OutdoorCell[] => {
  let x = Math.round(from.x)
  let y = Math.round(from.y)
  const targetX = Math.round(to.x)
  const targetY = Math.round(to.y)
  const dx = Math.abs(targetX - x)
  const dy = Math.abs(targetY - y)
  const sx = x < targetX ? 1 : -1
  const sy = y < targetY ? 1 : -1
  let error = dx - dy
  const result: OutdoorCell[] = []
  while (true) {
    result.push({ x, y })
    if (x === targetX && y === targetY) break
    const previousX = x
    const previousY = y
    const doubled = error * 2
    if (doubled > -dy) {
      error -= dy
      x += sx
    }
    if (doubled < dx) {
      error += dx
      y += sy
    }
    // Keep radius-zero trails four-neighbour connected instead of letting a
    // diagonal raster step create a point-contact gap.
    if (x !== previousX && y !== previousY) result.push({ x, y: previousY })
  }
  return result
}

const quadraticCurve = (
  start: OutdoorPoint,
  control: OutdoorPoint,
  end: OutdoorPoint,
  samples: number,
): OutdoorPoint[] =>
  Array.from({ length: samples + 1 }, (_entry, index) => {
    const t = index / samples
    const inverse = 1 - t
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    }
  })

const rasterizeCurve = (
  layout: OutdoorRegionLayout,
  points: readonly OutdoorPoint[],
  radiusAt: (index: number) => number,
): OutdoorCell[] => {
  const cells = new Map<string, OutdoorCell>()
  for (let index = 1; index < points.length; index += 1) {
    const radius = radiusAt(index)
    for (const point of lineCells(points[index - 1]!, points[index]!)) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const cell = { x: point.x + offsetX, y: point.y + offsetY }
          if (inBounds(layout, cell)) cells.set(cellKey(cell), cell)
        }
      }
    }
  }
  return [...cells.values()]
}

const ellipseCells = (
  layout: OutdoorRegionLayout,
  center: OutdoorPoint,
  radiusX: number,
  radiusY: number,
): readonly OutdoorCell[] => {
  const cells: OutdoorCell[] = []
  for (let y = Math.floor(center.y - radiusY); y <= Math.ceil(center.y + radiusY); y += 1) {
    for (let x = Math.floor(center.x - radiusX); x <= Math.ceil(center.x + radiusX); x += 1) {
      if (
        ((x - center.x) / radiusX) ** 2 + ((y - center.y) / radiusY) ** 2 <= 1 &&
        inBounds(layout, { x, y })
      )
        cells.push({ x, y })
    }
  }
  return cells
}

const requestedWater = (plan: MapPlan, water: WaterPreference): boolean =>
  plan.theme.waterFeatures.includes(water) || plan.theme.water === water

const createWater = (
  plan: MapPlan,
  layout: OutdoorRegionLayout,
  random: () => number,
): OutdoorWaterFeatureLayout => {
  const rivers: OutdoorRiverFeature[] = []
  const waterCells = new Set<string>()
  const lakeCells = new Set<string>()
  const focal = layout.landmarks.find((landmark) => landmark.importance === 'focal')?.position ?? {
    x: layout.width - 5,
    y: layout.height / 2,
  }
  const riverCount = requestedWater(plan, 'multiple-rivers')
    ? 2
    : requestedWater(plan, 'river')
      ? 1
      : 0
  if (riverCount > 0) {
    const crossingX = Math.max(
      9,
      Math.min(layout.width - 8, Math.round((layout.start.x + focal.x) / 2)),
    )
    const control = {
      x:
        crossingX +
        integer(random, -Math.round(layout.width * 0.12), Math.round(layout.width * 0.12)),
      y: Math.round(layout.height / 2),
    }
    const mainPoints = quadraticCurve(
      { x: crossingX + integer(random, -3, 3), y: 0 },
      control,
      { x: crossingX + integer(random, -4, 4), y: layout.height - 1 },
      Math.max(32, layout.height * 2),
    )
    const mainWidths = mainPoints.map(
      (_point, index) => 1 + Math.floor((index / mainPoints.length) * 2),
    )
    const mainCells = rasterizeCurve(layout, mainPoints, (index) => mainWidths[index] ?? 2)
    mainCells.forEach((cell) => waterCells.add(cellKey(cell)))
    rivers.push({
      id: 'outdoor-river-main',
      points: mainPoints,
      widths: mainWidths,
      cells: mainCells,
    })

    if (riverCount > 1) {
      const confluence = mainPoints[Math.floor(mainPoints.length * 0.55)]!
      const tributaryPoints = quadraticCurve(
        {
          x: layout.width - 1,
          y: integer(random, 2, Math.max(3, Math.floor(layout.height * 0.35))),
        },
        { x: layout.width * 0.72, y: confluence.y + integer(random, -8, 8) },
        confluence,
        Math.max(24, Math.round(layout.width * 1.4)),
      )
      const widths = tributaryPoints.map(
        (_point, index) => 1 + Math.floor(index / Math.max(1, tributaryPoints.length * 0.7)),
      )
      const cells = rasterizeCurve(layout, tributaryPoints, (index) => widths[index] ?? 1)
      cells.forEach((cell) => waterCells.add(cellKey(cell)))
      rivers.push({ id: 'outdoor-river-tributary', points: tributaryPoints, widths, cells })
    }
  }

  if (requestedWater(plan, 'pond') || requestedWater(plan, 'lake')) {
    const large = requestedWater(plan, 'lake')
    const mainRiver = rivers[0]
    const center = mainRiver?.points[Math.floor(mainRiver.points.length * 0.18)] ??
      layout.regions.find((region) => region.kind === 'riverbank')?.site ?? {
        x: layout.width * 0.72,
        y: layout.height * 0.68,
      }
    ellipseCells(layout, center, large ? 6 : 3.5, large ? 4.5 : 2.5).forEach((cell) => {
      const key = cellKey(cell)
      waterCells.add(key)
      lakeCells.add(key)
    })
  }
  if (
    plan.theme.mapType === 'coast' ||
    plan.theme.mapType === 'island' ||
    requestedWater(plan, 'coast')
  ) {
    const coastWidth = Math.max(4, Math.round(layout.width * 0.16))
    for (let y = 0; y < layout.height; y += 1)
      for (
        let x = layout.width - coastWidth + Math.round(Math.sin(y * 0.24) * 2);
        x < layout.width;
        x += 1
      )
        if (x >= 0) waterCells.add(`${x},${y}`)
  }
  if (requestedWater(plan, 'flooded')) {
    const center = layout.regions.find((region) => region.kind === 'swamp')?.site ?? {
      x: layout.width * 0.68,
      y: layout.height * 0.36,
    }
    ellipseCells(layout, center, 5, 3.5).forEach((cell) => waterCells.add(cellKey(cell)))
  }

  const bankCells = new Set<string>()
  for (const key of waterCells) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
        const cell = { x: x + offsetX, y: y + offsetY }
        const candidate = cellKey(cell)
        if (inBounds(layout, cell) && !waterCells.has(candidate)) bankCells.add(candidate)
      }
    }
  }
  return { rivers, waterCells, bankCells, lakeCells }
}

const createPaths = (
  layout: OutdoorRegionLayout,
  random: () => number,
): readonly OutdoorPathFeature[] => {
  const targets = [
    ...layout.landmarks,
    ...layout.regions
      .filter((region) => region.id !== 'outdoor-region-start')
      .slice(0, 2)
      .map((region, index) => ({
        id: `region-route-${index + 1}`,
        position: region.site,
        importance: 'minor' as const,
      })),
  ]
  const paths: OutdoorPathFeature[] = []
  const mainTarget = targets[0]!
  const mainControl = {
    x: (layout.start.x + mainTarget.position.x) / 2 + integer(random, -6, 6),
    y: (layout.start.y + mainTarget.position.y) / 2 + integer(random, -8, 8),
  }
  const mainPoints = quadraticCurve(layout.start, mainControl, mainTarget.position, 48)
  paths.push({
    id: 'outdoor-path-main',
    kind: 'main-road',
    points: mainPoints,
    cells: rasterizeCurve(layout, mainPoints, () => 1),
    targetId: mainTarget.id,
  })
  const junction = mainPoints[Math.floor(mainPoints.length * 0.55)]!
  targets.slice(1, 4).forEach((target, index) => {
    const control = {
      x: (junction.x + target.position.x) / 2 + integer(random, -5, 5),
      y: (junction.y + target.position.y) / 2 + integer(random, -5, 5),
    }
    const points = quadraticCurve(junction, control, target.position, 32)
    paths.push({
      id: `outdoor-path-side-${index + 1}`,
      kind: 'side-path',
      points,
      cells: rasterizeCurve(layout, points, () => 0),
      targetId: target.id,
    })
  })
  return paths
}

export const createOutdoorLinearFeatures = (
  plan: MapPlan,
  layout: OutdoorRegionLayout,
): OutdoorLinearFeatures => {
  const random = createSeededRandom((plan.seed ^ 0x11ea7e) >>> 0)
  const water = createWater(plan, layout, random)
  const paths = createPaths(layout, random)
  const pathCells = new Set(paths.flatMap((path) => path.cells.map(cellKey)))
  const intersections = [...pathCells].filter((key) => water.waterCells.has(key))
  const bridges: OutdoorBridgeSite[] = []
  const used = new Set<string>()
  for (const key of intersections) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    if (
      [...used].some((other) => {
        const [otherX, otherY] = other.split(',').map(Number) as [number, number]
        return Math.hypot(x - otherX, y - otherY) < 6
      })
    )
      continue
    used.add(key)
    const horizontal =
      water.waterCells.has(`${x},${y - 1}`) || water.waterCells.has(`${x},${y + 1}`)
    bridges.push({ id: `outdoor-bridge-${bridges.length + 1}`, position: { x, y }, horizontal })
  }
  return { paths, pathCells, water, bridges }
}
