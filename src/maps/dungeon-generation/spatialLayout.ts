import { createSeededRandom, integer, pick } from '@/map-generation/random'
import type { PlanScale } from '@/map-generation/types'
import type { DungeonNodeRole, DungeonTopologyGraph } from './topology'

export type DungeonRoomShape =
  | 'rectangle'
  | 'long-hall'
  | 'l-shape'
  | 't-shape'
  | 'cross-shape'
  | 'irregular'
  | 'natural-cave'
  | 'great-hall'

export interface SpatialDungeonRoom {
  readonly nodeId: string
  readonly levelId: string
  readonly role: DungeonNodeRole
  readonly shape: DungeonRoomShape
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly center: { readonly x: number; readonly y: number }
}

export interface DungeonSpatialLayout {
  readonly width: number
  readonly height: number
  readonly rooms: readonly SpatialDungeonRoom[]
}

const dimensionsFor = (role: DungeonNodeRole, scale: PlanScale, random: () => number) => {
  const scaleBase: Record<PlanScale, number> = { tiny: 3, small: 4, medium: 6, large: 8, vast: 12 }
  let width = scaleBase[scale] + integer(random, 0, 3)
  let height = scaleBase[scale] + integer(random, 0, 3)
  if (role === 'corridor-node' || role === 'stairs') width = height = Math.max(3, Math.round(scaleBase[scale] * 0.7))
  if (role === 'hall') width += integer(random, 4, 8)
  if (role === 'hub') width = height = Math.max(width, height) + 2
  if (role === 'boss-room') {
    width += 6
    height += 4
  }
  return { width, height }
}

const shapeFor = (role: DungeonNodeRole, random: () => number): DungeonRoomShape => {
  if (role === 'cave-area' || role === 'flooded-area') return 'natural-cave'
  if (role === 'hall') return random() < 0.72 ? 'long-hall' : 'great-hall'
  if (role === 'boss-room') return pick(random, ['great-hall', 'cross-shape', 'irregular'] as const)
  if (role === 'hub') return pick(random, ['cross-shape', 't-shape', 'great-hall'] as const)
  if (role === 'corridor-node') return pick(random, ['t-shape', 'cross-shape', 'rectangle'] as const)
  if (role === 'secret-room' || role === 'treasure-room') return pick(random, ['l-shape', 'rectangle', 'irregular'] as const)
  return pick(random, ['rectangle', 'rectangle', 'l-shape', 't-shape', 'irregular'] as const)
}

const overlaps = (
  candidate: Pick<SpatialDungeonRoom, 'x' | 'y' | 'width' | 'height'>,
  rooms: readonly SpatialDungeonRoom[],
  margin = 3,
): boolean =>
  rooms.some(
    (room) =>
      candidate.x < room.x + room.width + margin &&
      candidate.x + candidate.width + margin > room.x &&
      candidate.y < room.y + room.height + margin &&
      candidate.y + candidate.height + margin > room.y,
  )

export const createDungeonSpatialLayout = (graph: DungeonTopologyGraph): DungeonSpatialLayout => {
  const random = createSeededRandom((graph.seed ^ 0xa11ce5) >>> 0)
  const byLevel = new Map<string, SpatialDungeonRoom[]>()
  const placedById = new Map<string, SpatialDungeonRoom>()
  const adjacency = new Map<string, string[]>()
  graph.nodes.forEach((node) => adjacency.set(node.id, []))
  graph.edges.forEach((edge) => {
    adjacency.get(edge.fromId)?.push(edge.toId)
    adjacency.get(edge.toId)?.push(edge.fromId)
  })

  const ordered = [...graph.nodes].sort((left, right) => {
    const leftEntrance = graph.entrances.some((entry) => entry.nodeId === left.id) ? 0 : 1
    const rightEntrance = graph.entrances.some((entry) => entry.nodeId === right.id) ? 0 : 1
    return leftEntrance - rightEntrance
  })
  for (const [index, node] of ordered.entries()) {
    const dimensions = dimensionsFor(node.role, node.scale, random)
    const shape = shapeFor(node.role, random)
    const levelRooms = byLevel.get(node.levelId) ?? []
    const placedNeighbors = (adjacency.get(node.id) ?? [])
      .map((id) => placedById.get(id))
      .filter(
        (room): room is SpatialDungeonRoom =>
          room !== undefined && room.levelId === node.levelId,
      )
    const anchor = placedNeighbors[0] ?? levelRooms[0]
    let x = 4
    let y = 4
    if (anchor) {
      let found = false
      const baseAngle = random() * Math.PI * 2
      for (let attempt = 0; attempt < 120 && !found; attempt += 1) {
        const ring = 1 + Math.floor(attempt / 12)
        const angle = baseAngle + attempt * 2.399963229728653
        const distance = Math.max(anchor.width, anchor.height) + 6 + ring * 5
        x = Math.round(anchor.center.x + Math.cos(angle) * distance - dimensions.width / 2)
        y = Math.round(anchor.center.y + Math.sin(angle) * distance - dimensions.height / 2)
        const candidate = { x, y, ...dimensions }
        found = !overlaps(candidate, levelRooms)
      }
    } else if (index > 0) {
      const angle = index * 2.399963229728653
      const radius = 10 * Math.sqrt(index)
      x = Math.round(Math.cos(angle) * radius)
      y = Math.round(Math.sin(angle) * radius)
    }
    const room: SpatialDungeonRoom = {
      nodeId: node.id,
      levelId: node.levelId,
      role: node.role,
      shape,
      x,
      y,
      ...dimensions,
      center: { x: x + Math.floor(dimensions.width / 2), y: y + Math.floor(dimensions.height / 2) },
    }
    levelRooms.push(room)
    byLevel.set(node.levelId, levelRooms)
    placedById.set(node.id, room)
  }

  const padding = 4
  const normalized: SpatialDungeonRoom[] = []
  let width = 1
  let height = 1
  for (const rooms of byLevel.values()) {
    const minX = Math.min(...rooms.map((room) => room.x))
    const minY = Math.min(...rooms.map((room) => room.y))
    for (const room of rooms) {
      const x = room.x - minX + padding
      const y = room.y - minY + padding
      const normalizedRoom = {
        ...room,
        x,
        y,
        center: { x: x + Math.floor(room.width / 2), y: y + Math.floor(room.height / 2) },
      }
      normalized.push(normalizedRoom)
      width = Math.max(width, x + room.width + padding)
      height = Math.max(height, y + room.height + padding)
    }
  }
  return { width, height, rooms: normalized }
}
