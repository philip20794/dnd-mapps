import { entryLevelId, getDefaultLevelId } from '@/maps/api'
import type { DoorState, MapDefinition } from '@/maps/api'
import type { GridPoint, Segment } from '@/types/geometry'

const EPSILON = 0.000001
const DEFAULT_MOVEMENT_INDEX_CELL_SIZE = 4

export interface MovementSegmentIndex {
  readonly cellSize: number
  readonly segments: readonly Segment[]
  readonly cells: ReadonlyMap<string, readonly Segment[]>
}

const orientation = (a: GridPoint, b: GridPoint, c: GridPoint): number =>
  (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)

const isOnSegment = (a: GridPoint, b: GridPoint, c: GridPoint): boolean =>
  b.x <= Math.max(a.x, c.x) + EPSILON &&
  b.x + EPSILON >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + EPSILON &&
  b.y + EPSILON >= Math.min(a.y, c.y)

export const segmentsIntersect = (left: Segment, right: Segment): boolean => {
  const o1 = orientation(left.a, left.b, right.a)
  const o2 = orientation(left.a, left.b, right.b)
  const o3 = orientation(right.a, right.b, left.a)
  const o4 = orientation(right.a, right.b, left.b)

  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true
  }

  if (Math.abs(o1) <= EPSILON && isOnSegment(left.a, right.a, left.b)) {
    return true
  }
  if (Math.abs(o2) <= EPSILON && isOnSegment(left.a, right.b, left.b)) {
    return true
  }
  if (Math.abs(o3) <= EPSILON && isOnSegment(right.a, left.a, right.b)) {
    return true
  }
  return Math.abs(o4) <= EPSILON && isOnSegment(right.a, left.b, right.b)
}

const distanceSquared = (a: GridPoint, b: GridPoint): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

const distancePointToSegment = (point: GridPoint, segment: Segment): number => {
  const lengthSquared = distanceSquared(segment.a, segment.b)
  if (lengthSquared <= EPSILON) {
    return Math.sqrt(distanceSquared(point, segment.a))
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.a.x) * (segment.b.x - segment.a.x) +
        (point.y - segment.a.y) * (segment.b.y - segment.a.y)) /
        lengthSquared,
    ),
  )
  const projection = {
    x: segment.a.x + t * (segment.b.x - segment.a.x),
    y: segment.a.y + t * (segment.b.y - segment.a.y),
  }
  return Math.sqrt(distanceSquared(point, projection))
}

const distanceSegmentToSegment = (left: Segment, right: Segment): number => {
  if (segmentsIntersect(left, right)) {
    return 0
  }

  return Math.min(
    distancePointToSegment(left.a, right),
    distancePointToSegment(left.b, right),
    distancePointToSegment(right.a, left),
    distancePointToSegment(right.b, left),
  )
}

export const movementSegmentsForMap = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  levelId = getDefaultLevelId(map),
): readonly Segment[] => [
  ...map.walls
    .filter((wall) => wall.blocksMovement && entryLevelId(wall, map) === levelId)
    .map((wall) => ({ a: wall.a, b: wall.b })),
  ...map.doors
    .filter(
      (door) =>
        entryLevelId(door, map) === levelId &&
        (doorStates[door.id] ?? door.defaultState) === 'closed' &&
        door.blocksMovementWhenClosed,
    )
    .map((door) => door.segment),
]

function indexCellKey(x: number, y: number): string {
  return `${x},${y}`
}

export const createMovementSegmentIndex = (
  segments: readonly Segment[],
  cellSize = DEFAULT_MOVEMENT_INDEX_CELL_SIZE,
): MovementSegmentIndex => {
  const cells = new Map<string, Segment[]>()
  for (const segment of segments) {
    const minX = Math.floor(Math.min(segment.a.x, segment.b.x) / cellSize)
    const maxX = Math.floor(Math.max(segment.a.x, segment.b.x) / cellSize)
    const minY = Math.floor(Math.min(segment.a.y, segment.b.y) / cellSize)
    const maxY = Math.floor(Math.max(segment.a.y, segment.b.y) / cellSize)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = indexCellKey(x, y)
        const cell = cells.get(key)
        if (cell) {
          cell.push(segment)
        } else {
          cells.set(key, [segment])
        }
      }
    }
  }
  return { cellSize, segments, cells }
}

export const movementSegmentsNear = (
  index: MovementSegmentIndex,
  from: GridPoint,
  to: GridPoint,
  tokenRadius: number,
): readonly Segment[] => {
  const clearance = Math.max(0.08, tokenRadius * 0.75)
  const minX = Math.floor((Math.min(from.x, to.x) - clearance) / index.cellSize)
  const maxX = Math.floor((Math.max(from.x, to.x) + clearance) / index.cellSize)
  const minY = Math.floor((Math.min(from.y, to.y) - clearance) / index.cellSize)
  const maxY = Math.floor((Math.max(from.y, to.y) + clearance) / index.cellSize)
  const candidates: Segment[] = []
  const seen = new Set<Segment>()
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      for (const segment of index.cells.get(indexCellKey(x, y)) ?? []) {
        if (!seen.has(segment)) {
          seen.add(segment)
          candidates.push(segment)
        }
      }
    }
  }
  return candidates
}

export const isInsideMapBounds = (
  point: GridPoint,
  map: Pick<MapDefinition, 'width' | 'height'>,
  tokenRadius: number,
): boolean =>
  point.x >= tokenRadius &&
  point.y >= tokenRadius &&
  point.x <= map.width - tokenRadius &&
  point.y <= map.height - tokenRadius

export const isTokenMoveAllowed = (
  from: GridPoint,
  to: GridPoint,
  tokenRadius: number,
  blockers: readonly Segment[],
  map: Pick<MapDefinition, 'width' | 'height'>,
): boolean => {
  if (!isInsideMapBounds(to, map, tokenRadius)) {
    return false
  }

  const movement: Segment = { a: from, b: to }
  const clearance = Math.max(0.08, tokenRadius * 0.75)
  return blockers.every((blocker) => distanceSegmentToSegment(movement, blocker) > clearance)
}
