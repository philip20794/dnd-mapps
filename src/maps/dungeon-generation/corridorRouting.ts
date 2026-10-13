import { createSeededRandom, integer, pick } from '@/map-generation/random'
import type { Segment } from '@/types/geometry'
import { cellKey, type DungeonCell } from './roomShapes'
import type { DungeonSpatialLayout, SpatialDungeonRoom } from './spatialLayout'
import type { DungeonTopologyEdge, DungeonTopologyGraph } from './topology'

export type DungeonCorridorStyle =
  | 'straight'
  | 'stepped'
  | 'curved'
  | 'short'
  | 'long'
  | 'cave-passage'
  | 'collapsed'

export interface RoutedDungeonCorridor {
  readonly edgeId: string
  readonly levelId: string
  readonly style: DungeonCorridorStyle
  readonly width: 1 | 3
  readonly path: readonly DungeonCell[]
  readonly cells: readonly DungeonCell[]
}

export interface DungeonDoorway {
  readonly edgeId: string
  readonly levelId: string
  readonly segment: Segment
  readonly secret: boolean
  readonly locked: boolean
}

export interface DungeonCorridorRouting {
  readonly corridors: readonly RoutedDungeonCorridor[]
  readonly doorways: readonly DungeonDoorway[]
}

const walk = (
  from: DungeonCell,
  to: DungeonCell,
  style: DungeonCorridorStyle,
  random: () => number,
): DungeonCell[] => {
  const result: DungeonCell[] = [{ ...from }]
  let x = from.x
  let y = from.y
  let axis: 'x' | 'y' = random() < 0.5 ? 'x' : 'y'
  let remainingChunk = integer(random, 2, 5)
  while (x !== to.x || y !== to.y) {
    const canX = x !== to.x
    const canY = y !== to.y
    if (style === 'straight' || style === 'short') axis = canX ? 'x' : 'y'
    else if (style === 'stepped') {
      if (remainingChunk <= 0 || (axis === 'x' && !canX) || (axis === 'y' && !canY)) {
        axis = axis === 'x' ? 'y' : 'x'
        remainingChunk = integer(random, 2, 5)
      }
      remainingChunk -= 1
    } else if (!canX) axis = 'y'
    else if (!canY) axis = 'x'
    else axis = random() < Math.abs(to.x - x) / (Math.abs(to.x - x) + Math.abs(to.y - y)) ? 'x' : 'y'
    if (axis === 'x' && canX) x += Math.sign(to.x - x)
    else if (canY) y += Math.sign(to.y - y)
    result.push({ x, y })
  }
  return result
}

const routedPath = (
  from: DungeonCell,
  to: DungeonCell,
  style: DungeonCorridorStyle,
  layout: DungeonSpatialLayout,
  random: () => number,
): readonly DungeonCell[] => {
  if (style !== 'long') return walk(from, to, style, random)
  const midpoint = {
    x: Math.max(1, Math.min(layout.width - 2, Math.round((from.x + to.x) / 2) + integer(random, -8, 8))),
    y: Math.max(1, Math.min(layout.height - 2, Math.round((from.y + to.y) / 2) + integer(random, -8, 8))),
  }
  return [...walk(from, midpoint, 'stepped', random), ...walk(midpoint, to, 'curved', random).slice(1)]
}

const avoidUnrelatedRooms = (
  preferred: readonly DungeonCell[],
  from: DungeonCell,
  to: DungeonCell,
  blocked: ReadonlySet<string>,
  layout: DungeonSpatialLayout,
  random: () => number,
): readonly DungeonCell[] => {
  if (preferred.every((cell) => !blocked.has(cellKey(cell)))) return preferred
  const startKey = cellKey(from)
  const targetKey = cellKey(to)
  const previous = new Map<string, string>()
  const cells = new Map<string, DungeonCell>([[startKey, from]])
  const queue: DungeonCell[] = [from]
  let queueIndex = 0
  const seen = new Set([startKey])
  const baseDirections = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const rotation = integer(random, 0, baseDirections.length - 1)
  const directions = baseDirections.map((_entry, index) => baseDirections[(index + rotation) % 4]!)
  while (queueIndex < queue.length && !seen.has(targetKey)) {
    const current = queue[queueIndex++]!
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y }
      const key = cellKey(next)
      if (
        next.x < 1 ||
        next.y < 1 ||
        next.x >= layout.width - 1 ||
        next.y >= layout.height - 1 ||
        seen.has(key) ||
        blocked.has(key)
      )
        continue
      seen.add(key)
      previous.set(key, cellKey(current))
      cells.set(key, next)
      queue.push(next)
    }
  }
  if (!seen.has(targetKey)) return preferred
  const result: DungeonCell[] = []
  let cursor = targetKey
  while (true) {
    result.push(cells.get(cursor)!)
    if (cursor === startKey) break
    cursor = previous.get(cursor)!
  }
  return result.reverse()
}

const expandedCells = (
  path: readonly DungeonCell[],
  width: 1 | 3,
  layout: DungeonSpatialLayout,
): readonly DungeonCell[] => {
  const radius = width === 3 ? 1 : 0
  const cells = new Map<string, DungeonCell>()
  for (const point of path) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const cell = { x: point.x + offsetX, y: point.y + offsetY }
        if (cell.x >= 0 && cell.y >= 0 && cell.x < layout.width && cell.y < layout.height)
          cells.set(cellKey(cell), cell)
      }
    }
  }
  return [...cells.values()]
}

const doorwayAtBoundary = (
  edge: DungeonTopologyEdge,
  levelId: string,
  path: readonly DungeonCell[],
  roomCells: ReadonlySet<string>,
  width: 1 | 3,
): DungeonDoorway | undefined => {
  for (let index = 1; index < path.length; index += 1) {
    const inside = path[index - 1]!
    const outside = path[index]!
    if (!roomCells.has(cellKey(inside)) || roomCells.has(cellKey(outside))) continue
    const radius = width === 3 ? 1 : 0
    const segment: Segment =
      inside.x !== outside.x
        ? {
            a: { x: Math.max(inside.x, outside.x), y: inside.y - radius },
            b: { x: Math.max(inside.x, outside.x), y: inside.y + radius + 1 },
          }
        : {
            a: { x: inside.x - radius, y: Math.max(inside.y, outside.y) },
            b: { x: inside.x + radius + 1, y: Math.max(inside.y, outside.y) },
          }
    return {
      edgeId: edge.id,
      levelId,
      segment,
      secret: edge.secret,
      locked: edge.kind === 'locked-gate',
    }
  }
  return undefined
}

const corridorStyle = (
  edge: DungeonTopologyEdge,
  from: SpatialDungeonRoom,
  to: SpatialDungeonRoom,
  random: () => number,
): DungeonCorridorStyle => {
  if (edge.kind === 'cave-passage') return 'cave-passage'
  if (edge.kind === 'collapsed-passage') return 'collapsed'
  const distance = Math.abs(from.center.x - to.center.x) + Math.abs(from.center.y - to.center.y)
  if (distance <= 10) return 'short'
  if (from.center.x === to.center.x || from.center.y === to.center.y) return 'straight'
  return pick(random, ['stepped', 'curved', 'long', 'stepped'] as const)
}

export const routeDungeonCorridors = (
  graph: DungeonTopologyGraph,
  layout: DungeonSpatialLayout,
  roomCells: ReadonlyMap<string, ReadonlySet<string>>,
): DungeonCorridorRouting => {
  const random = createSeededRandom((graph.seed ^ 0xc0111d0) >>> 0)
  const rooms = new Map(layout.rooms.map((room) => [room.nodeId, room]))
  const corridors: RoutedDungeonCorridor[] = []
  const doorways: DungeonDoorway[] = []
  for (const edge of graph.edges) {
    if (edge.kind === 'stairs') continue
    const from = rooms.get(edge.fromId)
    const to = rooms.get(edge.toId)
    if (!from || !to || from.levelId !== to.levelId) continue
    const style = corridorStyle(edge, from, to, random)
    const width: 1 | 3 =
      edge.secret || edge.kind === 'collapsed-passage'
        ? 1
        : edge.route === 'main' || from.role === 'hub' || to.role === 'hub'
          ? 3
          : random() < 0.24
            ? 3
            : 1
    const preferredPath = routedPath(from.center, to.center, style, layout, random)
    const blocked = new Set<string>()
    const clearance = width === 3 ? 1 : 0
    for (const [nodeId, cells] of roomCells) {
      if (nodeId === from.nodeId || nodeId === to.nodeId) continue
      cells.forEach((key) => {
        const [x, y] = key.split(',').map(Number) as [number, number]
        for (let offsetY = -clearance; offsetY <= clearance; offsetY += 1)
          for (let offsetX = -clearance; offsetX <= clearance; offsetX += 1)
            blocked.add(`${x + offsetX},${y + offsetY}`)
      })
    }
    const path = avoidUnrelatedRooms(
      preferredPath,
      from.center,
      to.center,
      blocked,
      layout,
      random,
    )
    corridors.push({
      edgeId: edge.id,
      levelId: from.levelId,
      style,
      width,
      path,
      cells: expandedCells(path, width, layout),
    })
    if (edge.kind !== 'cave-passage' && edge.kind !== 'collapsed-passage') {
      const sourceDoor = doorwayAtBoundary(edge, from.levelId, path, roomCells.get(from.nodeId) ?? new Set(), width)
      const targetDoor = doorwayAtBoundary(edge, to.levelId, [...path].reverse(), roomCells.get(to.nodeId) ?? new Set(), width)
      if (sourceDoor) doorways.push(sourceDoor)
      if (targetDoor && (!sourceDoor || JSON.stringify(targetDoor.segment) !== JSON.stringify(sourceDoor.segment)))
        doorways.push({ ...targetDoor, edgeId: `${edge.id}-target` })
    }
  }
  return { corridors, doorways }
}
