import type { MapObjectDefinition } from '@/map-objects'
import { createSeededRandom } from '@/map-generation/random'
import type { MapPlan } from '@/map-generation/types'
import type { DoorDefinition, WallDefinition } from '@/maps/api'
import type { DungeonCorridorRouting } from '@/maps/dungeon-generation/corridorRouting'
import type {
  DungeonSpatialLayout,
  SpatialDungeonRoom,
} from '@/maps/dungeon-generation/spatialLayout'
import type { DungeonTopologyGraph } from '@/maps/dungeon-generation/topology'
import { SetDressingPlacementGuard } from './placement'
import { createSetDressingScene } from './scenes'
import type { SetDressingResult, SetDressingSceneRequest } from './types'

const cellKey = (x: number, y: number): string => `${x},${y}`

const expandDoorCells = (doors: readonly DoorDefinition[]): ReadonlySet<string> => {
  const cells = new Set<string>()
  for (const door of doors) {
    const minX = Math.floor(Math.min(door.segment.a.x, door.segment.b.x))
    const maxX = Math.ceil(Math.max(door.segment.a.x, door.segment.b.x))
    const minY = Math.floor(Math.min(door.segment.a.y, door.segment.b.y))
    const maxY = Math.ceil(Math.max(door.segment.a.y, door.segment.b.y))
    for (let y = minY - 1; y <= maxY + 1; y += 1)
      for (let x = minX - 1; x <= maxX + 1; x += 1) cells.add(cellKey(x, y))
  }
  return cells
}

const interiorCells = (cells: ReadonlySet<string>): ReadonlySet<string> => {
  const interior = new Set<string>()
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    if (
      [cellKey(x - 1, y), cellKey(x + 1, y), cellKey(x, y - 1), cellKey(x, y + 1)].every(
        (neighbor) => cells.has(neighbor),
      )
    )
      interior.add(key)
  }
  return interior
}

const requestForRoom = (
  plan: MapPlan,
  room: SpatialDungeonRoom,
  index: number,
  random: () => number,
  ritualPlaced: boolean,
): SetDressingSceneRequest | undefined => {
  const ritualWanted =
    !ritualPlaced &&
    (plan.theme.atmosphere === 'magical' ||
      plan.theme.atmosphere === 'cursed' ||
      plan.storyHooks.some((hook) => hook.kind === 'ritual'))
  if (ritualWanted && ['encounter-room', 'hall', 'boss-room', 'hub'].includes(room.role))
    return {
      id: `dungeon-ritual-${index + 1}`,
      kind: 'ritual-site',
      levelId: room.levelId,
      center: room.center,
      tags: [room.role, 'dungeon'],
      atmosphere: plan.theme.atmosphere,
      biome: plan.theme.biome,
    }
  const campWanted =
    plan.theme.settlement === 'camp' ||
    plan.sceneFeatures.some((feature) => feature.kind === 'watch-camp')
  if (
    campWanted &&
    ['entrance', 'hub', 'encounter-room', 'hall'].includes(room.role) &&
    random() < 0.58
  )
    return {
      id: `dungeon-camp-${index + 1}`,
      kind:
        plan.theme.atmosphere === 'abandoned' || plan.theme.atmosphere === 'destroyed'
          ? 'abandoned-camp'
          : 'camp',
      levelId: room.levelId,
      center: room.center,
      tags: [room.role, 'dungeon'],
      atmosphere: plan.theme.atmosphere,
      biome: plan.theme.biome,
    }
  const abandoned = plan.theme.atmosphere === 'abandoned' || plan.theme.atmosphere === 'destroyed'
  if (abandoned && ['normal-room', 'hall', 'encounter-room'].includes(room.role) && random() < 0.14)
    return {
      id: `dungeon-abandoned-camp-${index + 1}`,
      kind: 'abandoned-camp',
      levelId: room.levelId,
      center: room.center,
      tags: [room.role, 'dungeon'],
      atmosphere: plan.theme.atmosphere,
      biome: plan.theme.biome,
    }
  const storageTheme = ['mine', 'fortress', 'castle', 'crypt', 'temple'].includes(
    plan.theme.settlement,
  )
  if (
    (storageTheme || room.role === 'treasure-room') &&
    ['normal-room', 'hall', 'treasure-room', 'corridor-node'].includes(room.role) &&
    random() < 0.3
  )
    return {
      id: `dungeon-storage-${index + 1}`,
      kind: 'dungeon-storage',
      levelId: room.levelId,
      center: { x: room.x + 2.2, y: room.y + 2.2 },
      tags: [room.role, 'dungeon', plan.theme.settlement],
      atmosphere: plan.theme.atmosphere,
      biome: plan.theme.biome,
    }
  return undefined
}

export interface DungeonSetDressingInput {
  readonly plan: MapPlan
  readonly topology: DungeonTopologyGraph
  readonly layout: DungeonSpatialLayout
  readonly routing: DungeonCorridorRouting
  readonly roomCells: ReadonlyMap<string, ReadonlySet<string>>
  readonly walls: readonly WallDefinition[]
  readonly doors: readonly DoorDefinition[]
  readonly baseObjects: readonly MapObjectDefinition[]
}

export const createDungeonSetDressing = (input: DungeonSetDressingInput): SetDressingResult => {
  const random = createSeededRandom((input.plan.seed ^ 0xd2e55e7) >>> 0)
  const edgeById = new Map(input.topology.edges.map((edge) => [edge.id, edge]))
  const mainPathCells = new Set(
    input.routing.corridors
      .filter((corridor) => edgeById.get(corridor.edgeId)?.route === 'main')
      .flatMap((corridor) => corridor.cells.map((cell) => cellKey(cell.x, cell.y))),
  )
  const doorCells = expandDoorCells(input.doors)
  const objects: MapObjectDefinition[] = []
  const scenes: NonNullable<ReturnType<typeof createSetDressingScene>['scene']>[] = []
  let ritualPlaced = false

  input.layout.rooms.forEach((room, index) => {
    const request = requestForRoom(input.plan, room, index, random, ritualPlaced)
    if (!request) return
    const cells = input.roomCells.get(room.nodeId)
    if (!cells) return
    const guard = new SetDressingPlacementGuard(
      {
        width: input.layout.width,
        height: input.layout.height,
        levelId: room.levelId,
        allowedCells: interiorCells(cells),
        forbiddenCells: new Set([...mainPathCells, ...doorCells]),
        walls: input.walls,
        doors: input.doors,
        occupied: [...input.baseObjects, ...objects],
      },
      input.plan.seed + index * 1291,
    )
    const generated = createSetDressingScene(request, guard, input.plan.seed + index * 8191)
    objects.push(...generated.objects)
    if (generated.scene) {
      scenes.push(generated.scene)
      if (generated.scene.kind === 'ritual-site') ritualPlaced = true
    }
  })
  return { objects, scenes }
}
