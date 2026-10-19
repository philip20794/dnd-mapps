import { describe, expect, it } from 'vitest'
import type { WallDefinition } from '@/maps/api'
import { compileWallVisual, selectVisibleWallSections, visibleWallRange } from './wallGeometry'
import type { VisibleVisibilityBlocker } from '@/map-engine/visibility/visibility'

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


describe('Fog wall surface visibility', () => {
  const shown: VisibleVisibilityBlocker = {
    kind: 'wall',
    blockerId: 'wall:wall-a',
    blockerSegment: { a: wall.a, b: wall.b },
    visibleSegment: { a: { x: 3, y: 4 }, b: { x: 5, y: 4 } },
  }

  it('shows only the observed span of a decorated wall, not its hidden continuation', () => {
    const sections = selectVisibleWallSections([wall], [shown])
    expect(sections).toHaveLength(1)
    const visual = compileWallVisual(sections[0]!.wall, 48)!
    expect(visual).toEqual(compileWallVisual(wall, 48))
    const clipped = visibleWallRange(visual, sections[0]!.visibleSegment, 48)
    expect(clipped.start).toBeCloseTo(48 - 1.92)
    expect(clipped.end).toBeCloseTo(144 + 1.92)
    expect(clipped.end).toBeLessThan(visual.length)
  })

  it('never reveals unseen walls, closed doors, or unstyled collision blockers', () => {
    const hiddenWall = { ...wall, id: 'hidden-wall' }
    const unstyledWall = { ...wall, id: 'plain-wall', appearance: undefined }
    const doorBlocker: VisibleVisibilityBlocker = { ...shown, kind: 'door', blockerId: 'door:one' }
    expect(selectVisibleWallSections([wall, hiddenWall, unstyledWall], [shown])).toHaveLength(1)
    expect(selectVisibleWallSections([hiddenWall], [shown])).toEqual([])
    expect(selectVisibleWallSections([unstyledWall], [
      { ...shown, blockerId: 'wall:plain-wall' },
    ])).toEqual([])
    expect(selectVisibleWallSections([wall], [doorBlocker])).toEqual([])
    expect(selectVisibleWallSections([wall], [])).toEqual([])
  })

  it('preserves the original wall artwork across changing visibility spans', () => {
    const visual = compileWallVisual(wall, 48)!
    const narrow = visibleWallRange(visual, shown.visibleSegment, 48)
    const wide = visibleWallRange(visual, {
      a: { x: 2, y: 4 },
      b: { x: 6, y: 4 },
    }, 48)
    expect(visual.stones).toEqual(compileWallVisual(wall, 48)?.stones)
    expect(narrow.start).toBeGreaterThanOrEqual(wide.start)
    expect(narrow.end).toBeLessThan(wide.end)
    expect(visibleWallRange(visual, {
      a: { x: 4, y: 4 },
      b: { x: 4, y: 4 },
    }, 48).end - visibleWallRange(visual, {
      a: { x: 4, y: 4 },
      b: { x: 4, y: 4 },
    }, 48).start).toBeCloseTo(3.84)
  })
})
