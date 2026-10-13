import type { SpatialDungeonRoom } from './spatialLayout'

export interface DungeonCell {
  readonly x: number
  readonly y: number
}

export const cellKey = (cell: DungeonCell): string => `${cell.x},${cell.y}`

const hash = (seed: number, x: number, y: number): number => {
  let value = (seed ^ Math.imul(x + 31, 0x45d9f3b) ^ Math.imul(y + 17, 0x119de1f3)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return (value ^ (value >>> 16)) >>> 0
}

export const createRoomCells = (room: SpatialDungeonRoom, seed: number): readonly DungeonCell[] => {
  const cells: DungeonCell[] = []
  const armWidth = Math.max(2, Math.floor(room.width * 0.4))
  const armHeight = Math.max(2, Math.floor(room.height * 0.4))
  const centerX = Math.floor(room.width / 2)
  const centerY = Math.floor(room.height / 2)
  for (let localY = 0; localY < room.height; localY += 1) {
    for (let localX = 0; localX < room.width; localX += 1) {
      let included = true
      switch (room.shape) {
        case 'l-shape':
          included = localX < armWidth || localY >= room.height - armHeight
          break
        case 't-shape':
          included = localY < armHeight || Math.abs(localX - centerX) <= Math.floor(armWidth / 2)
          break
        case 'cross-shape':
          included =
            Math.abs(localX - centerX) <= Math.floor(armWidth / 2) ||
            Math.abs(localY - centerY) <= Math.floor(armHeight / 2)
          break
        case 'irregular':
        case 'natural-cave': {
          const nx = (localX + 0.5 - room.width / 2) / (room.width / 2)
          const ny = (localY + 0.5 - room.height / 2) / (room.height / 2)
          const noise = (hash(seed, room.x + localX, room.y + localY) % 100) / 500
          included = nx * nx + ny * ny <= (room.shape === 'natural-cave' ? 1.08 : 1) - noise
          break
        }
        case 'great-hall':
          included = !(
            (localX === 0 || localX === room.width - 1) &&
            (localY === 0 || localY === room.height - 1)
          )
          break
        default:
          break
      }
      if (included) cells.push({ x: room.x + localX, y: room.y + localY })
    }
  }
  if (!cells.some((cell) => cell.x === room.center.x && cell.y === room.center.y))
    cells.push(room.center)
  return cells
}

export const roomCellSets = (
  rooms: readonly SpatialDungeonRoom[],
  seed: number,
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    rooms.map((room, index) => [
      room.nodeId,
      new Set(createRoomCells(room, seed + index * 7919).map(cellKey)),
    ]),
  )
