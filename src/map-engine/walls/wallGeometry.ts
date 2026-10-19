import type { WallAppearance, WallDefinition } from '@/maps/api'
import type { GridPoint } from '@/types/geometry'
import { hashString, randomRange } from '@/map-objects/visualStyle'

/** Pure, deterministic geometry for the reusable masonry renderer. Grid units remain unchanged. */
export interface WallStone {
  readonly start: number
  readonly end: number
  readonly shade: number
  readonly notch: number
  readonly cracked: boolean
}

export interface WallVisual {
  readonly appearance: WallAppearance
  readonly origin: GridPoint
  readonly direction: GridPoint
  readonly normal: GridPoint
  readonly length: number
  readonly thickness: number
  readonly stones: readonly WallStone[]
}

export function compileWallVisual(wall: WallDefinition, gridSize: number): WallVisual | null {
  if (!wall.appearance || gridSize <= 0) return null
  const dx = (wall.b.x - wall.a.x) * gridSize
  const dy = (wall.b.y - wall.a.y) * gridSize
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length < 0.001) return null

  const cave = wall.appearance === 'cave'
  const seed = hashString(
    `${wall.appearance}:${wall.a.x},${wall.a.y}:${wall.b.x},${wall.b.y}`,
  )
  const stones: WallStone[] = []
  let start = 0
  while (start < length - 0.001) {
    const index = stones.length
    const pitch = gridSize * (cave ? 0.85 : 0.7)
    const size = pitch * randomRange(seed + index * 19 + 1, 0.78, 1.18)
    const end = Math.min(length, start + size)
    stones.push({
      start,
      end,
      shade: randomRange(seed + index * 19 + 2, -21, 18),
      notch: randomRange(seed + index * 19 + 3, -0.11, 0.11),
      cracked: randomRange(seed + index * 19 + 4, 0, 1) > (cave ? 0.57 : 0.78),
    })
    start = end
  }

  return {
    appearance: wall.appearance,
    origin: { x: wall.a.x * gridSize, y: wall.a.y * gridSize },
    direction: { x: dx / length, y: dy / length },
    normal: { x: -dy / length, y: dx / length },
    length,
    thickness: gridSize * (cave ? 0.55 : 0.43),
    stones,
  }
}
