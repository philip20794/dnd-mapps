import type { MapObjectDefinition } from '@/map-objects'
import type { MapGenerationMetadata, MapDefinition, WallDefinition } from '@/maps/api'
import { randomMapId } from '@/maps/randomGenerator'
import type { MapPlan } from '@/map-generation/types'
import { cellKey, createRoomCells, roomCellSets, type DungeonCell } from './roomShapes'
import { routeDungeonCorridors, type DungeonDoorway } from './corridorRouting'
import { createDungeonSpatialLayout } from './spatialLayout'
import { createDungeonTopologyGraph } from './topology'
import { createDungeonSetDressing } from '@/maps/set-dressing'
import { extractMaterialLayer, type MaterialLayerDefinition } from '@/map-materials'

const cellsToRuns = (
  cells: readonly DungeonCell[],
): readonly { x: number; y: number; width: number }[] => {
  const rows = new Map<number, number[]>()
  cells.forEach((cell) => rows.set(cell.y, [...(rows.get(cell.y) ?? []), cell.x]))
  const runs: { x: number; y: number; width: number }[] = []
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

const mergeBoundarySegments = (
  cells: ReadonlySet<string>,
  levelId: string,
  appearance: 'stone' | 'cave',
): readonly WallDefinition[] => {
  const horizontal = new Map<number, number[]>()
  const vertical = new Map<number, number[]>()
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    if (!cells.has(`${x},${y - 1}`)) horizontal.set(y, [...(horizontal.get(y) ?? []), x])
    if (!cells.has(`${x},${y + 1}`)) horizontal.set(y + 1, [...(horizontal.get(y + 1) ?? []), x])
    if (!cells.has(`${x - 1},${y}`)) vertical.set(x, [...(vertical.get(x) ?? []), y])
    if (!cells.has(`${x + 1},${y}`)) vertical.set(x + 1, [...(vertical.get(x + 1) ?? []), y])
  }
  const walls: WallDefinition[] = []
  const addRuns = (groups: Map<number, number[]>, orientation: 'h' | 'v'): void => {
    for (const [fixed, raw] of groups) {
      const values = [...new Set(raw)].sort((a, b) => a - b)
      let start = values[0]
      let previous = values[0]
      for (let index = 1; index <= values.length; index += 1) {
        const value = values[index]
        if (value === previous! + 1) {
          previous = value
          continue
        }
        if (start !== undefined && previous !== undefined) {
          const sequence = walls.length + 1
          walls.push({
            id: `dungeon-wall-${levelId}-${sequence}`,
            levelId,
            appearance,
            a: orientation === 'h' ? { x: start, y: fixed } : { x: fixed, y: start },
            b: orientation === 'h' ? { x: previous + 1, y: fixed } : { x: fixed, y: previous + 1 },
            blocksSight: true,
            blocksMovement: true,
          })
        }
        start = value
        previous = value
      }
    }
  }
  addRuns(horizontal, 'h')
  addRuns(vertical, 'v')
  return walls
}

const floorPreset = (
  role: string,
  cave: boolean,
): 'cave-ground' | 'wet-stone' | 'grave-dust' | 'mossy-stone' | 'cracked-tiles' => {
  if (role === 'flooded-area') return 'wet-stone'
  if (role === 'cave-area' || cave) return 'cave-ground'
  if (role === 'secret-room') return 'grave-dust'
  return role === 'entrance' || role === 'hall' ? 'mossy-stone' : 'cracked-tiles'
}

const doorwayObject = (doorway: DungeonDoorway, index: number): MapObjectDefinition => {
  const vertical = doorway.segment.a.x === doorway.segment.b.x
  const length = vertical
    ? Math.abs(doorway.segment.b.y - doorway.segment.a.y)
    : Math.abs(doorway.segment.b.x - doorway.segment.a.x)
  return {
    id: `graph-door-${index + 1}`,
    type: doorway.locked || doorway.secret ? 'stone-door' : 'wooden-door',
    preset: doorway.locked || doorway.secret ? 'closed-stone-door' : 'closed-wooden-door',
    levelId: doorway.levelId,
    position: {
      x: Math.min(doorway.segment.a.x, doorway.segment.b.x),
      y: Math.min(doorway.segment.a.y, doorway.segment.b.y),
    },
    width: length,
    height: 0.25,
    rotation: vertical ? 90 : 0,
    label: doorway.secret ? 'Geheimtür' : doorway.locked ? 'Verschlossenes Tor' : 'Tür',
    tags: doorway.secret ? ['secret-connection'] : doorway.locked ? ['locked-gate'] : ['door'],
    interactionState: 'closed',
  }
}

export interface GraphFirstDungeonResult {
  readonly map: MapDefinition
  readonly topology: ReturnType<typeof createDungeonTopologyGraph>
  readonly layout: ReturnType<typeof createDungeonSpatialLayout>
  readonly routing: ReturnType<typeof routeDungeonCorridors>
  readonly dressing: ReturnType<typeof createDungeonSetDressing>
}

export const createGraphFirstDungeon = (
  plan: MapPlan,
  metadata?: MapGenerationMetadata,
): GraphFirstDungeonResult => {
  const topology = createDungeonTopologyGraph(plan)
  const layout = createDungeonSpatialLayout(topology)
  const sets = roomCellSets(layout.rooms, plan.seed)
  const routing = routeDungeonCorridors(topology, layout, sets)
  const cave = plan.theme.mapType === 'cave'
  const objects: MapObjectDefinition[] = []
  const walkableByLevel = new Map<string, Set<string>>()
  const addWalkable = (levelId: string, cells: readonly DungeonCell[]): void => {
    const set = walkableByLevel.get(levelId) ?? new Set<string>()
    cells.forEach((cell) => set.add(cellKey(cell)))
    walkableByLevel.set(levelId, set)
  }

  layout.rooms.forEach((room, roomIndex) => {
    const cells = createRoomCells(room, plan.seed + roomIndex * 7919)
    addWalkable(room.levelId, cells)
    cellsToRuns(cells).forEach((run, runIndex) =>
      objects.push({
        id: `graph-room-${roomIndex + 1}-floor-${runIndex + 1}`,
        type: 'ground-area',
        preset: floorPreset(room.role, cave),
        levelId: room.levelId,
        position: { x: run.x, y: run.y },
        width: run.width,
        height: 1,
        alpha: room.shape === 'natural-cave' ? 0.9 : 1,
        tags: ['dungeon-room', room.role, room.shape, room.nodeId],
      }),
    )
  })
  routing.corridors.forEach((corridor, corridorIndex) => {
    addWalkable(corridor.levelId, corridor.cells)
    cellsToRuns(corridor.cells).forEach((run, runIndex) =>
      objects.push({
        id: `graph-corridor-${corridorIndex + 1}-floor-${runIndex + 1}`,
        type: 'ground-area',
        preset:
          corridor.style === 'cave-passage'
            ? 'loose-gravel'
            : corridor.style === 'collapsed'
              ? 'grave-dust'
              : 'cracked-tiles',
        levelId: corridor.levelId,
        position: { x: run.x, y: run.y },
        width: run.width,
        height: 1,
        alpha: corridor.style === 'cave-passage' ? 0.88 : 1,
        tags: ['dungeon-corridor', corridor.style, `width-${corridor.width}`],
      }),
    )
  })

  const roomById = new Map(layout.rooms.map((room) => [room.nodeId, room]))
  for (const edge of topology.edges.filter((entry) => entry.kind === 'stairs')) {
    const from = roomById.get(edge.fromId)
    const to = roomById.get(edge.toId)
    if (!from || !to || from.levelId === to.levelId) continue
    objects.push(
      {
        id: `transition-${edge.id}-a`,
        type: 'stairs',
        preset: 'stone-stairs-down',
        levelId: from.levelId,
        position: { x: from.center.x - 0.7, y: from.center.y - 0.7 },
        transition: {
          targetLevelId: to.levelId,
          targetPosition: to.center,
          direction: 'down',
          label: `Nach ${to.levelId}`,
        },
      },
      {
        id: `transition-${edge.id}-b`,
        type: 'stairs',
        preset: 'stone-stairs-up',
        levelId: to.levelId,
        position: { x: to.center.x - 0.7, y: to.center.y - 0.7 },
        transition: {
          targetLevelId: from.levelId,
          targetPosition: from.center,
          direction: 'up',
          label: `Nach ${from.levelId}`,
        },
      },
    )
  }

  if (plan.theme.atmosphere === 'dark' || cave) {
    layout.rooms
      .filter((_room, index) => index % 5 === 0)
      .forEach((room, index) =>
        objects.push({
          id: `graph-light-${index + 1}`,
          type: 'torch',
          preset: cave ? 'blue-crystal-torch' : 'rusty-iron-torch',
          levelId: room.levelId,
          position: room.center,
        }),
      )
  }

  const doorwayObjects = routing.doorways.map(doorwayObject)
  objects.push(...doorwayObjects)
  const doors = routing.doorways.map((doorway, index) => ({
    id: doorwayObjects[index]!.id!,
    label: doorway.secret ? 'Geheimtür' : doorway.locked ? 'Verschlossenes Tor' : 'Tür',
    levelId: doorway.levelId,
    segment: doorway.segment,
    defaultState: 'closed' as const,
    blocksSightWhenClosed: true,
    blocksMovementWhenClosed: true,
  }))
  const walls = [...walkableByLevel.entries()].flatMap(([levelId, cells]) =>
    mergeBoundarySegments(cells, levelId, cave ? 'cave' : 'stone'),
  )
  const dressing = createDungeonSetDressing({
    plan,
    topology,
    layout,
    routing,
    roomCells: sets,
    walls,
    doors,
    baseObjects: objects,
  })
  objects.push(...dressing.objects)
  const materialLayers: MaterialLayerDefinition[] = []
  let interactiveObjects: readonly MapObjectDefinition[] = objects
  plan.levels.forEach((level, levelIndex) => {
    const extracted = extractMaterialLayer(interactiveObjects, {
      id: `dungeon-materials-${level.id}`,
      levelId: level.id,
      seed: plan.seed + levelIndex * 104729,
    })
    interactiveObjects = extracted.objects
    if (extracted.materialLayer) materialLayers.push(extracted.materialLayer)
  })
  const spawnPoints = topology.entrances.map((entrance, index) => {
    const room = roomById.get(entrance.nodeId)!
    return {
      id: entrance.id,
      name: `Eingang ${index + 1}`,
      levelId: entrance.levelId,
      position: room.center,
      radius: 1.5,
      tags: ['entrance'],
    }
  })
  const start = spawnPoints[0]!
  const map: MapDefinition = {
    id: randomMapId,
    name: `${plan.theme.mapType === 'cave' ? 'Höhlenkomplex' : 'Graph-Dungeon'}: ${plan.name}${plan.theme.atmosphere === 'dark' ? ' (dunkel)' : ''}`,
    width: layout.width,
    height: layout.height,
    gridSize: 48,
    levels: plan.levels.map((level) => ({ id: level.id, name: level.name, order: level.order })),
    defaultLevelId: start.levelId,
    objects: interactiveObjects,
    materialLayers,
    walls,
    doors,
    spawnPoints,
    startTokens: [
      {
        id: `random-hero-${plan.seed >>> 0}`,
        mapId: randomMapId,
        levelId: start.levelId,
        name: 'Held',
        position: start.position,
        size: 1,
        rotation: 0,
        visionRange: plan.theme.atmosphere === 'dark' ? 7 : 10,
        visionAngle: null,
        visionEnabled: true,
        category: 'player',
        color: '#3f8cff',
        symbol: 'H',
      },
    ],
    ...(metadata ? { generation: metadata } : {}),
  }
  return { map, topology, layout, routing, dressing }
}
