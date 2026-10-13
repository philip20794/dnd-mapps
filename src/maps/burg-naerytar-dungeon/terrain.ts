import type {
  MaterialAreaDefinition,
  MaterialDecalDefinition,
  MaterialId,
  MaterialLayerDefinition,
} from '@/map-materials'
import {
  naerytarDeepWaterCells,
  naerytarIslandCells,
  naerytarLakeCells,
  naerytarMapHeight,
  naerytarMapWidth,
  naerytarMudCells,
  naerytarWalkableCells,
  naerytarWetStoneCells,
  parseCellKey,
} from './geometry'

interface CellRun {
  readonly x: number
  readonly y: number
  readonly width: number
}

function cellsToRuns(cells: ReadonlySet<string>): readonly CellRun[] {
  const rows = new Map<number, number[]>()
  for (const key of cells) {
    const { x, y } = parseCellKey(key)
    rows.set(y, [...(rows.get(y) ?? []), x])
  }

  const runs: CellRun[] = []
  for (const [y, rawValues] of [...rows].sort((left, right) => left[0] - right[0])) {
    const values = [...new Set(rawValues)].sort((left, right) => left - right)
    let start = values[0]
    let previous = values[0]
    for (let index = 1; index <= values.length; index += 1) {
      const value = values[index]
      if (value === previous! + 1) {
        previous = value
        continue
      }
      if (start !== undefined && previous !== undefined)
        runs.push({ x: start, y, width: previous - start + 1 })
      start = value
      previous = value
    }
  }
  return runs
}

function materialRuns(
  prefix: string,
  material: MaterialId,
  cells: ReadonlySet<string>,
  options: Pick<MaterialAreaDefinition, 'tint' | 'alpha' | 'transition'> = {},
): readonly MaterialAreaDefinition[] {
  return cellsToRuns(cells).map((run, index) => ({
    id: `${prefix}-${index + 1}`,
    material,
    position: { x: run.x, y: run.y },
    width: run.width,
    height: 1,
    ...options,
  }))
}

function withoutCells(
  source: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set([...source].filter((key) => !excluded.has(key)))
}

function createDecals(): readonly MaterialDecalDefinition[] {
  return [
    {
      id: 'entry-puddle-detail',
      kind: 'shore-detail',
      position: { x: 49, y: 22 },
      width: 2.4,
      height: 1.2,
      density: 0.42,
      color: 0x9eb9ad,
      alpha: 0.26,
      seed: 1101,
    },
    {
      id: 'ooze-slick',
      kind: 'moss',
      position: { x: 60, y: 18 },
      width: 2.2,
      height: 1.4,
      density: 0.5,
      color: 0x546049,
      alpha: 0.32,
      seed: 1102,
    },
    {
      id: 'mud-irregularities',
      kind: 'irregularity',
      position: { x: 59, y: 37 },
      width: 3,
      height: 2.2,
      density: 0.76,
      color: 0x20241b,
      alpha: 0.36,
      seed: 1103,
    },
    {
      id: 'centipede-cracks',
      kind: 'crack',
      position: { x: 48, y: 37 },
      width: 2.4,
      height: 1.8,
      density: 0.56,
      color: 0x171613,
      alpha: 0.56,
      seed: 1104,
    },
    {
      id: 'lake-shore-west',
      kind: 'shore-detail',
      position: { x: 20, y: 25 },
      width: 3,
      height: 1.2,
      density: 0.55,
      color: 0xa5b6a4,
      alpha: 0.26,
      seed: 1105,
    },
    {
      id: 'lake-shore-east',
      kind: 'shore-detail',
      position: { x: 37, y: 29 },
      width: 2.8,
      height: 1.2,
      density: 0.48,
      color: 0xa5b6a4,
      alpha: 0.24,
      seed: 1106,
    },
    {
      id: 'lake-shore-south',
      kind: 'shore-detail',
      position: { x: 29, y: 38 },
      width: 2.4,
      height: 1.1,
      density: 0.46,
      color: 0xa5b6a4,
      alpha: 0.22,
      seed: 1107,
    },
    {
      id: 'lake-stones-west',
      kind: 'small-stones',
      position: { x: 16, y: 35 },
      width: 3,
      height: 2,
      density: 0.52,
      color: 0x89877c,
      alpha: 0.48,
      seed: 1108,
    },
    {
      id: 'mist-floor-cracks',
      kind: 'crack',
      position: { x: 24, y: 9 },
      width: 3,
      height: 1.5,
      density: 0.34,
      color: 0x22211e,
      alpha: 0.42,
      seed: 1109,
    },
    {
      id: 'shrine-chalk-dust',
      kind: 'irregularity',
      position: { x: 10.8, y: 16 },
      width: 2.5,
      height: 1.5,
      density: 0.26,
      color: 0xb8b09b,
      alpha: 0.28,
      seed: 1110,
    },
    {
      id: 'teleport-worn-stone',
      kind: 'crack',
      position: { x: 8, y: 6 },
      width: 2.5,
      height: 1.8,
      density: 0.2,
      color: 0x35332f,
      alpha: 0.34,
      seed: 1111,
    },
  ]
}

export function createNaerytarMaterialLayer(): MaterialLayerDefinition {
  const lakeWithoutIslands = withoutCells(naerytarLakeCells, naerytarIslandCells)
  const stoneWithoutWet = withoutCells(naerytarWalkableCells, naerytarWetStoneCells)
  const areas: MaterialAreaDefinition[] = [
    ...materialRuns('cave-stone', 'stone', stoneWithoutWet, {
      tint: 0x55534e,
      transition: 'rough',
    }),
    ...materialRuns('wet-limestone', 'dungeon-stone', naerytarWetStoneCells, {
      tint: 0x555750,
      transition: 'rough',
    }),
    ...materialRuns('mud-chamber', 'mud', naerytarMudCells, { tint: 0x3e3c2d, transition: 'soft' }),
    ...materialRuns('lake-shallows', 'shallow-water', lakeWithoutIslands, {
      tint: 0x2f6868,
      transition: 'shore',
    }),
    ...materialRuns('lake-depths', 'deep-water', naerytarDeepWaterCells, {
      tint: 0x123d4b,
      transition: 'shore',
    }),
    ...materialRuns('rock-islands', 'stone', naerytarIslandCells, {
      tint: 0x5f5d57,
      transition: 'rough',
    }),
    {
      id: 'crane-platform-stone',
      material: 'dungeon-stone',
      position: { x: 35, y: 8 },
      width: 6,
      height: 5,
      tint: 0x6a6257,
      transition: 'masonry',
      tags: ['area-09', 'platform'],
    },
    {
      id: 'crane-wear-a',
      material: 'wood',
      position: { x: 36.5, y: 11 },
      width: 2,
      height: 1,
      tint: 0x60432d,
      alpha: 0.72,
      transition: 'rough',
      tags: ['area-09', 'crate-wear'],
    },
    {
      id: 'crane-wear-b',
      material: 'wood',
      position: { x: 39, y: 11 },
      width: 2,
      height: 1,
      tint: 0x60432d,
      alpha: 0.72,
      transition: 'rough',
      tags: ['area-09', 'crate-wear'],
    },
    {
      id: 'teleport-center-stone',
      material: 'dungeon-stone',
      position: { x: 6, y: 4 },
      width: 8,
      height: 5,
      tint: 0x66625c,
      transition: 'rough',
      tags: ['area-13', 'worn-smooth-stone'],
    },
  ]

  return {
    id: 'burg-naerytar-cave-materials',
    seed: 640013,
    chunkSize: 16,
    areas,
    decals: createDecals(),
  }
}

export const naerytarTerrainMetrics = {
  mapCells: naerytarMapWidth * naerytarMapHeight,
  walkableCells: naerytarWalkableCells.size,
  lakeCells: naerytarLakeCells.size,
  deepWaterCells: naerytarDeepWaterCells.size,
  islandCells: naerytarIslandCells.size,
  mapHeight: naerytarMapHeight,
} as const
