import type { WallAppearance, WallDefinition } from '@/maps/api'
import type { GridPoint, Segment } from '@/types/geometry'
import type { VisibleVisibilityBlocker } from '@/map-engine/visibility/visibility'
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


/** An actually observed piece of a painted wall. Sight-blocking geometry itself is never expanded. */
export interface VisibleWallSection {
  readonly blockerId: string
  readonly wall: WallDefinition
  readonly visibleSegment: Segment
}

export function selectVisibleWallSections(
  walls: readonly WallDefinition[],
  visibleBlockers: readonly VisibleVisibilityBlocker[],
): readonly VisibleWallSection[] {
  const byId = new Map(
    walls.map((wall, index) => [`wall:${wall.id ?? index}`, wall] as const),
  )
  return visibleBlockers.flatMap((blocker) => {
    if (blocker.kind !== 'wall') return []
    const wall = byId.get(blocker.blockerId)
    return wall?.appearance
      ? [{ blockerId: blocker.blockerId, wall, visibleSegment: blocker.visibleSegment }]
      : []
  })
}

/**
 * Clip the decoration to the observed portion of the ORIGINAL wall.
 * The original stone positions and colors stay stable when the hero moves.
 * A tiny overlap closes cracks at the edge without revealing room geometry.
 */
export function visibleWallRange(
  wall: WallVisual,
  visibleSegment: Segment,
  gridSize: number,
): { readonly start: number; readonly end: number } {
  function projection(point: GridPoint): number {
    const x = point.x * gridSize - wall.origin.x
    const y = point.y * gridSize - wall.origin.y
    return x * wall.direction.x + y * wall.direction.y
  }
  const a = projection(visibleSegment.a)
  const b = projection(visibleSegment.b)
  const padding = gridSize * 0.04
  return {
    start: Math.max(0, Math.min(wall.length, Math.min(a, b) - padding)),
    end: Math.max(0, Math.min(wall.length, Math.max(a, b) + padding)),
  }
}
