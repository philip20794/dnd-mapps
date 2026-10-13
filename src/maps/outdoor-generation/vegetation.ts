import type { MapObjectDefinition } from '@/map-objects'
import { createSeededRandom, pick } from '@/map-generation/random'
import type { MapPlan } from '@/map-generation/types'
import type { OutdoorLinearFeatures } from './linearFeatures'
import type { OutdoorPoint, OutdoorRegionKind, OutdoorRegionLayout } from './regionLayout'
import type { OutdoorTerrainCell, OutdoorTerrainFields } from './terrainFields'

export interface OutdoorVegetationPlacement {
  readonly cell: OutdoorPoint
  readonly regionKind: OutdoorRegionKind
  readonly density: number
  readonly object: MapObjectDefinition
}

export interface OutdoorVegetationLayout {
  readonly placements: readonly OutdoorVegetationPlacement[]
  /** Cells kept clear for starts, routes, crossings, water and major scene sites. */
  readonly protectedCells: ReadonlySet<string>
}

const keyOf = (point: OutdoorPoint): string => `${point.x},${point.y}`

const protectDisk = (
  protectedCells: Set<string>,
  layout: OutdoorRegionLayout,
  center: OutdoorPoint,
  radius: number,
): void => {
  for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y += 1) {
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x += 1) {
      if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) continue
      if (Math.hypot(x - center.x, y - center.y) <= radius) protectedCells.add(`${x},${y}`)
    }
  }
}

const createProtectedCells = (
  layout: OutdoorRegionLayout,
  linear: OutdoorLinearFeatures,
): Set<string> => {
  const result = new Set<string>(linear.water.waterCells)
  for (const value of linear.pathCells) {
    const [x, y] = value.split(',').map(Number) as [number, number]
    protectDisk(result, layout, { x, y }, 1.45)
  }
  protectDisk(result, layout, layout.start, 4)
  layout.landmarks.forEach((landmark) =>
    protectDisk(result, layout, landmark.position, landmark.importance === 'minor' ? 2.5 : 3.5),
  )
  linear.bridges.forEach((bridge) => protectDisk(result, layout, bridge.position, 2.5))
  return result
}

interface VegetationChoice {
  readonly type: string
  readonly preset: string
  readonly width: number
  readonly height: number
  readonly blocksMovement: boolean
}

const choicesFor = (
  plan: MapPlan,
  cell: OutdoorTerrainCell,
  wetBank: boolean,
): readonly VegetationChoice[] => {
  const trees: readonly VegetationChoice[] =
    plan.theme.biome === 'snow'
      ? [{ type: 'tree', preset: 'pine-tree', width: 1.4, height: 1.6, blocksMovement: true }]
      : plan.theme.biome === 'volcanic' || plan.theme.biome === 'wasteland'
        ? [{ type: 'tree', preset: 'dead-tree', width: 1.4, height: 1.6, blocksMovement: true }]
        : plan.theme.biome === 'mushroom'
          ? [
              {
                type: 'bush',
                preset: 'mushroom-cluster',
                width: 0.8,
                height: 0.65,
                blocksMovement: false,
              },
            ]
          : [
              { type: 'tree', preset: 'old-oak', width: 1.4, height: 1.6, blocksMovement: true },
              {
                type: 'tree',
                preset: 'birch-tree',
                width: 1.25,
                height: 1.7,
                blocksMovement: true,
              },
            ]
  const bushes: readonly VegetationChoice[] = [
    { type: 'bush', preset: 'leafy-bush', width: 0.9, height: 0.75, blocksMovement: false },
    { type: 'bush', preset: 'berry-bush', width: 0.9, height: 0.75, blocksMovement: false },
    { type: 'thicket', preset: 'dense-bramble', width: 1.45, height: 1.05, blocksMovement: true },
  ]
  const wet: readonly VegetationChoice[] = [
    { type: 'bush', preset: 'reed-clump', width: 1, height: 1.15, blocksMovement: false },
    { type: 'thicket', preset: 'reed-bed', width: 1.7, height: 1.35, blocksMovement: false },
  ]
  const rocks: readonly VegetationChoice[] = [
    { type: 'rock', preset: 'small-rock', width: 0.75, height: 0.65, blocksMovement: true },
    {
      type: 'rock',
      preset: cell.regionKind === 'volcanic-field' ? 'sharp-scree' : 'mossy-boulder',
      width: cell.regionKind === 'volcanic-field' ? 2.4 : 1.25,
      height: cell.regionKind === 'volcanic-field' ? 1.2 : 1.1,
      blocksMovement: cell.regionKind !== 'volcanic-field',
    },
  ]
  if (wetBank) return [...wet, ...wet, ...bushes.slice(0, 1)]
  if ((plan.theme.terrain === 'cliffs' || plan.theme.terrain === 'canyon') && cell.height > 0.76)
    return rocks
  switch (cell.regionKind) {
    case 'dense-forest':
      return [...trees, ...trees, ...bushes]
    case 'light-forest':
      return [...trees, ...bushes, ...bushes]
    case 'swamp':
    case 'riverbank':
      return [...wet, ...wet, ...bushes.slice(0, 1)]
    case 'rock-field':
    case 'canyon':
    case 'volcanic-field':
    case 'ash-field':
    case 'desert':
    case 'wasteland':
      return rocks
    case 'snowfield':
      return [
        { type: 'tree', preset: 'pine-tree', width: 1.4, height: 1.6, blocksMovement: true },
        ...rocks,
      ]
    case 'ruins':
      return [
        rocks[0]!,
        { type: 'tree', preset: 'dead-tree', width: 1.4, height: 1.6, blocksMovement: true },
      ]
    case 'grassland':
    case 'fields':
    case 'clearing':
      return bushes.slice(0, 2)
    case 'coast':
    case 'village':
      return rocks.slice(0, 1)
  }
}

const candidateProbability = (cell: OutdoorTerrainCell): number => {
  if (
    cell.regionKind === 'rock-field' ||
    cell.regionKind === 'canyon' ||
    cell.regionKind === 'volcanic-field'
  )
    return 0.04 + cell.height * 0.22
  if (cell.regionKind === 'swamp' || cell.regionKind === 'riverbank')
    return 0.05 + cell.moisture * 0.22
  return Math.min(0.48, cell.vegetationDensity * 0.34)
}

/**
 * Field-driven distribution with local spacing. Dense cores produce clusters,
 * while region boundaries and explicitly protected gameplay space remain open.
 */
export const createOutdoorVegetation = (
  plan: MapPlan,
  layout: OutdoorRegionLayout,
  terrain: OutdoorTerrainFields,
  linear: OutdoorLinearFeatures,
): OutdoorVegetationLayout => {
  const random = createSeededRandom((plan.seed ^ 0x7e6e7a71) >>> 0)
  const protectedCells = createProtectedCells(layout, linear)
  const occupied: OutdoorPoint[] = []
  const placements: OutdoorVegetationPlacement[] = []

  for (const cell of terrain.cells) {
    if (cell.x < 1 || cell.y < 1 || cell.x >= layout.width - 2 || cell.y >= layout.height - 2)
      continue
    if (protectedCells.has(keyOf(cell)) || random() >= candidateProbability(cell)) continue
    const spacing =
      cell.regionKind === 'dense-forest' ? 1.55 : cell.vegetationDensity > 0.45 ? 1.9 : 2.45
    if (occupied.some((point) => Math.hypot(point.x - cell.x, point.y - cell.y) < spacing)) continue
    const wetBank = linear.water.bankCells.has(keyOf(cell))
    const options = choicesFor(plan, cell, wetBank)
    if (options.length === 0) continue
    const choice = pick(random, options)
    if (cell.x + choice.width > layout.width || cell.y + choice.height > layout.height) continue
    occupied.push({ x: cell.x, y: cell.y })
    placements.push({
      cell: { x: cell.x, y: cell.y },
      regionKind: cell.regionKind,
      density: cell.vegetationDensity,
      object: {
        id: `outdoor-growth-${placements.length + 1}`,
        type: choice.type,
        preset: choice.preset,
        levelId: layout.levelId,
        position: { x: cell.x, y: cell.y },
        width: choice.width,
        height: choice.height,
        blocksMovement: choice.blocksMovement,
        tags: ['outdoor-growth', cell.regionKind, `region-${cell.regionId}`],
      },
    })
  }
  return { placements, protectedCells }
}
