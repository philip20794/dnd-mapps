import { describe, expect, it } from 'vitest'
import type { WallDefinition } from '@/maps/api'
import { compileWallVisual } from './wallGeometry'

const wall: WallDefinition = {
  id: 'wall-a',
  a: { x: 2, y: 4 },
  b: { x: 8, y: 4 },
  blocksSight: true,
  blocksMovement: true,
  appearance: 'stone',
}

describe('decorative wall geometry', () => {
  it('creates deterministic masonry from an existing collision wall', () => {
    const visual = compileWallVisual(wall, 48)
    expect(visual).not.toBeNull()
    expect(visual).toEqual(compileWallVisual(wall, 48))
    expect(visual?.length).toBe(288)
    expect(visual?.stones.length).toBeGreaterThan(4)
    expect(visual?.stones[0]?.start).toBe(0)
    expect(visual?.stones.at(-1)?.end).toBe(288)
  })

  it('uses separate reusable styles for natural rock and cut stone', () => {
    const masonry = compileWallVisual(wall, 48)
    const rock = compileWallVisual({ ...wall, appearance: 'cave' }, 48)
    expect(rock?.appearance).toBe('cave')
    expect(rock?.thickness).toBeGreaterThan(masonry?.thickness ?? 0)
    expect(rock?.stones).not.toEqual(masonry?.stones)
  })

  it('supports angled walls without changing their original endpoints', () => {
    const angled = compileWallVisual({
      ...wall,
      a: { x: 1, y: 1 },
      b: { x: 4, y: 5 },
    }, 40)
    expect(angled?.length).toBe(200)
    expect(angled?.direction).toEqual({ x: 0.6, y: 0.8 })
    expect(angled?.normal).toEqual({ x: -0.8, y: 0.6 })
    expect(wall.a).toEqual({ x: 2, y: 4 })
  })

  it('does not paint invisible colliders or degenerate segments', () => {
    expect(compileWallVisual({ ...wall, appearance: undefined }, 48)).toBeNull()
    expect(compileWallVisual({ ...wall, b: wall.a }, 48)).toBeNull()
    expect(compileWallVisual(wall, 0)).toBeNull()
  })
})
