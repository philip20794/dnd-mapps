import type { MapObjectDefinition } from '@/map-objects'
import type { MapGenerationMetadata, MapDefinition } from '@/maps/api'
import { randomMapId } from '@/maps/randomGenerator'
import type { MapPlan, PlanLandmarkKind } from '@/map-generation/types'
import { cellKey, type DungeonCell as OutdoorCell } from '@/maps/dungeon-generation/roomShapes'
import { createOutdoorLinearFeatures, type OutdoorLinearFeatures } from './linearFeatures'
import { createOutdoorRegionLayout, type OutdoorRegionLayout } from './regionLayout'
import {
  createOutdoorTerrainFields,
  type OutdoorGroundPreset,
  type OutdoorTerrainFields,
} from './terrainFields'
import { createOutdoorVegetation, type OutdoorVegetationLayout } from './vegetation'
import { createOutdoorSetDressing } from '@/maps/set-dressing'
import { extractMaterialLayer } from '@/map-materials'

interface CellRun {
  readonly x: number
  readonly y: number
  readonly width: number
}

const cellsToRuns = (cells: readonly OutdoorCell[]): readonly CellRun[] => {
  const rows = new Map<number, number[]>()
  cells.forEach((cell) => rows.set(cell.y, [...(rows.get(cell.y) ?? []), cell.x]))
  const runs: CellRun[] = []
  for (const [y, rawXs] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const xs = [...new Set(rawXs)].sort((a, b) => a - b)
    let start = xs[0]
    let previous = xs[0]
    for (let index = 1; index <= xs.length; index += 1) {
      const value = xs[index]
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

const objectsForGround = (
  layout: OutdoorRegionLayout,
  terrain: OutdoorTerrainFields,
): MapObjectDefinition[] => {
  const byPreset = new Map<OutdoorGroundPreset, OutdoorCell[]>()
  terrain.cells.forEach((cell) =>
    byPreset.set(cell.groundPreset, [...(byPreset.get(cell.groundPreset) ?? []), cell]),
  )
  return [...byPreset.entries()].flatMap(([preset, cells]) =>
    cellsToRuns(cells).map((run, index) => ({
      id: `outdoor-ground-${preset}-${index + 1}`,
      type: 'ground-area',
      preset,
      levelId: layout.levelId,
      position: { x: run.x, y: run.y },
      width: run.width,
      height: 1,
      tags: ['outdoor-ground', preset],
    })),
  )
}

const setToCells = (values: ReadonlySet<string>): OutdoorCell[] =>
  [...values].map((value) => {
    const [x, y] = value.split(',').map(Number) as [number, number]
    return { x, y }
  })

const overlayRuns = (
  prefix: string,
  cells: readonly OutdoorCell[],
  definition: Pick<MapObjectDefinition, 'type' | 'preset' | 'levelId' | 'tags' | 'alpha'>,
): MapObjectDefinition[] =>
  cellsToRuns(cells).map((run, index) => ({
    id: `${prefix}-${index + 1}`,
    ...definition,
    position: { x: run.x, y: run.y },
    width: run.width,
    height: 1,
  }))

const landmarkObject = (
  layout: OutdoorRegionLayout,
  kind: PlanLandmarkKind,
  id: string,
  position: { readonly x: number; readonly y: number },
): MapObjectDefinition => {
  const definitions: Record<
    PlanLandmarkKind,
    Pick<MapObjectDefinition, 'type' | 'preset' | 'width' | 'height'>
  > = {
    altar: { type: 'altar', width: 2.2, height: 1.4 },
    statue: { type: 'rock', preset: 'standing-stone', width: 1.05, height: 1.75 },
    tower: { type: 'rock', preset: 'standing-stone', width: 1.05, height: 1.75 },
    tree: { type: 'tree', preset: 'old-oak', width: 1.4, height: 1.6 },
    well: { type: 'rock', preset: 'standing-stone', width: 1.05, height: 1.75 },
    bridge: { type: 'bridge', preset: 'stone-causeway', width: 3, height: 2 },
    wreck: { type: 'fallen-log', preset: 'fallen-tree', width: 4.2, height: 1.2 },
    monolith: { type: 'rock', preset: 'standing-stone', width: 1.05, height: 1.75 },
    bonfire: { type: 'campfire', preset: 'small-campfire', width: 1.2, height: 1.2 },
  }
  const value = definitions[kind]
  const x = Math.max(
    0,
    Math.min(layout.width - (value.width ?? 1), position.x - (value.width ?? 1) / 2),
  )
  const y = Math.max(
    0,
    Math.min(layout.height - (value.height ?? 1), position.y - (value.height ?? 1) / 2),
  )
  return {
    id: `outdoor-landmark-${id}`,
    ...value,
    levelId: layout.levelId,
    position: { x, y },
    tags: ['outdoor-landmark', kind],
  }
}

const createLinearObjects = (
  plan: MapPlan,
  layout: OutdoorRegionLayout,
  linear: OutdoorLinearFeatures,
): MapObjectDefinition[] => {
  const bankPreset =
    plan.theme.biome === 'desert'
      ? 'sand'
      : plan.theme.biome === 'snow'
        ? 'packed-earth'
        : 'shallow-mud'
  const objects: MapObjectDefinition[] = [
    ...overlayRuns('outdoor-bank', setToCells(linear.water.bankCells), {
      type: 'ground-area',
      preset: bankPreset,
      levelId: layout.levelId,
      tags: ['outdoor-transition', 'water-bank'],
      alpha: 0.92,
    }),
    ...overlayRuns('outdoor-path', setToCells(linear.pathCells), {
      type: 'ground-area',
      preset:
        plan.theme.biome === 'swamp'
          ? 'muddy-ruts'
          : plan.theme.biome === 'snow'
            ? 'packed-earth'
            : 'dirt-path',
      levelId: layout.levelId,
      tags: ['outdoor-path'],
      alpha: 1,
    }),
  ]
  const riverCells = new Set(linear.water.rivers.flatMap((river) => river.cells.map(cellKey)))
  const standingCells = new Set([...linear.water.waterCells].filter((key) => !riverCells.has(key)))
  objects.push(
    ...overlayRuns('outdoor-river', setToCells(riverCells), {
      type: 'river',
      preset:
        plan.theme.terrain === 'cliffs' || plan.theme.terrain === 'canyon'
          ? 'fast-river'
          : 'slow-river',
      levelId: layout.levelId,
      tags: ['outdoor-water', 'connected-river'],
      alpha: 1,
    }),
    ...overlayRuns('outdoor-standing-water', setToCells(standingCells), {
      type: 'water',
      preset: 'standing-water',
      levelId: layout.levelId,
      tags: ['outdoor-water', 'standing-water'],
      alpha: 1,
    }),
  )
  linear.bridges.forEach((bridge) => {
    const width = bridge.horizontal ? 3 : 2
    const height = bridge.horizontal ? 2 : 3
    objects.push({
      id: bridge.id,
      type: 'bridge',
      preset:
        plan.theme.settlement === 'castle' || plan.theme.settlement === 'fortress'
          ? 'stone-causeway'
          : 'wooden-footbridge',
      levelId: layout.levelId,
      position: {
        x: Math.max(0, Math.min(layout.width - width, bridge.position.x - width / 2)),
        y: Math.max(0, Math.min(layout.height - height, bridge.position.y - height / 2)),
      },
      width,
      height,
      rotation: bridge.horizontal ? 0 : 90,
      tags: ['outdoor-bridge', 'path-water-crossing'],
    })
  })
  return objects
}

export interface RegionBasedOutdoorResult {
  readonly map: MapDefinition
  readonly layout: OutdoorRegionLayout
  readonly terrain: OutdoorTerrainFields
  readonly linear: OutdoorLinearFeatures
  readonly vegetation: OutdoorVegetationLayout
  readonly dressing: ReturnType<typeof createOutdoorSetDressing>
}

export const createRegionBasedOutdoorMap = (
  plan: MapPlan,
  metadata?: MapGenerationMetadata,
): RegionBasedOutdoorResult => {
  const layout = createOutdoorRegionLayout(plan)
  const terrain = createOutdoorTerrainFields(plan, layout)
  const linear = createOutdoorLinearFeatures(plan, layout)
  const vegetation = createOutdoorVegetation(plan, layout, terrain, linear)
  const daylightPreset =
    plan.theme.biome === 'forest' || plan.theme.biome === 'jungle'
      ? 'forest-daylight'
      : plan.theme.biome === 'snow' || plan.theme.biome === 'swamp'
        ? 'pale-overcast-light'
        : 'open-sunlight'
  const baseObjects: MapObjectDefinition[] = [
    ...objectsForGround(layout, terrain),
    ...createLinearObjects(plan, layout, linear),
    ...(plan.theme.atmosphere === 'dark'
      ? [
          {
            id: 'outdoor-start-light',
            type: 'campfire',
            preset: 'small-campfire',
            levelId: layout.levelId,
            position: {
              x: Math.min(layout.width - 1.2, layout.start.x + 2),
              y: Math.min(layout.height - 1.2, layout.start.y + 2),
            },
            width: 1.2,
            height: 1.2,
            tags: ['outdoor-light', 'start-light'],
          } satisfies MapObjectDefinition,
        ]
      : [
          {
            id: 'outdoor-daylight',
            type: 'daylight-area',
            preset: daylightPreset,
            levelId: layout.levelId,
            position: { x: 0, y: 0 },
            width: layout.width,
            height: layout.height,
            tags: ['outdoor-light'],
          } satisfies MapObjectDefinition,
        ]),
    ...vegetation.placements.map((placement) => placement.object),
    ...layout.landmarks.map((landmark) =>
      landmarkObject(layout, landmark.kind, landmark.id, landmark.position),
    ),
  ]
  const dressing = createOutdoorSetDressing({ plan, layout, linear, baseObjects })
  const objects = [...baseObjects, ...dressing.objects]
  const extracted = extractMaterialLayer(objects, {
    id: `outdoor-materials-${layout.levelId}`,
    levelId: layout.levelId,
    seed: plan.seed,
  })
  const map: MapDefinition = {
    id: randomMapId,
    name: `Regionenkarte: ${plan.name}${plan.theme.atmosphere === 'dark' ? ' (dunkel)' : ''}`,
    width: layout.width,
    height: layout.height,
    gridSize: 48,
    levels: [{ id: layout.levelId, name: plan.levels[0]?.name ?? 'Oberfläche', order: 0 }],
    defaultLevelId: layout.levelId,
    objects: extracted.objects,
    materialLayers: extracted.materialLayer ? [extracted.materialLayer] : [],
    walls: [],
    doors: [],
    spawnPoints: [
      {
        id: 'outdoor-start',
        name: 'Startbereich',
        levelId: layout.levelId,
        position: layout.start,
        radius: 2.5,
        tags: ['entrance', 'protected-start'],
      },
    ],
    startTokens: [
      {
        id: `random-hero-${plan.seed >>> 0}`,
        mapId: randomMapId,
        levelId: layout.levelId,
        name: 'Held',
        position: layout.start,
        size: 1,
        rotation: 0,
        visionRange: plan.theme.atmosphere === 'dark' ? 7 : 12,
        visionAngle: null,
        visionEnabled: true,
        category: 'player',
        color: '#3f8cff',
        symbol: 'H',
      },
    ],
    ...(metadata ? { generation: metadata } : {}),
  }
  return { map, layout, terrain, linear, vegetation, dressing }
}
