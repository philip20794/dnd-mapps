import { Graphics } from 'pixi.js'
import type { WallDefinition } from '@/maps/api'
import { shiftColor } from '@/map-objects/visualStyle'
import { compileWallVisual, type WallVisual } from './wallGeometry'

interface Point {
  readonly x: number
  readonly y: number
}

function at(wall: WallVisual, distance: number, side: number): Point {
  return {
    x: wall.origin.x + wall.direction.x * distance + wall.normal.x * side,
    y: wall.origin.y + wall.direction.y * distance + wall.normal.y * side,
  }
}

function segment(graphics: Graphics, a: Point, b: Point, color: number, width: number, alpha = 1): void {
  graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha })
}

function drawStone(graphics: Graphics, wall: WallVisual, index: number, gridSize: number): void {
  const stone = wall.stones[index]!
  const cave = wall.appearance === 'cave'
  const gap = Math.min(gridSize * 0.025, (stone.end - stone.start) * 0.1)
  const start = stone.start + gap
  const end = stone.end - gap
  if (end <= start) return

  const half = wall.thickness * (cave ? 0.5 + stone.notch * 0.22 : 0.47)
  const bevel = Math.max(1, gridSize * 0.065)
  const base = cave ? 0x68645f : 0x797775
  const face = shiftColor(base, stone.shade)
  const outerA = at(wall, start, -half)
  const outerB = at(wall, end, -half * (cave ? 1 + stone.notch : 1))
  const innerB = at(wall, end, half)
  const innerA = at(wall, start, half * (cave ? 1 - stone.notch : 1))

  graphics
    .moveTo(outerA.x, outerA.y)
    .lineTo(outerB.x, outerB.y)
    .lineTo(innerB.x, innerB.y)
    .lineTo(innerA.x, innerA.y)
    .closePath()
    .fill({ color: face })
    .stroke({ color: 0x211e1c, alpha: 0.64, width: Math.max(1, gridSize * 0.018) })

  // Cut bevels create a raised stone cap rather than a flat collider line.
  segment(graphics, at(wall, start, -half + bevel), at(wall, end, -half + bevel),
    shiftColor(face, 36), Math.max(1, gridSize * 0.03), 0.76)
  segment(graphics, at(wall, start, half - bevel), at(wall, end, half - bevel),
    shiftColor(face, -28), Math.max(1, gridSize * 0.048), 0.8)

  if (stone.cracked) {
    const middle = start + (end - start) * 0.47
    const a = at(wall, middle, -half * 0.58)
    const b = at(wall, middle + Math.min(gridSize * 0.13, (end - start) * 0.18), half * 0.4)
    segment(graphics, a, b, 0x1c1a19, Math.max(1, gridSize * 0.019), 0.4)
  }
}

/** Renders only opt-in visual walls, leaving collision, doors and line-of-sight unchanged. */
export function renderWallSurfaces(walls: readonly WallDefinition[], gridSize: number): Graphics {
  const graphics = new Graphics({ label: 'decorative-wall-surfaces' })
  graphics.eventMode = 'none'
  for (const wall of walls) {
    const visual = compileWallVisual(wall, gridSize)
    if (!visual) continue
    const first = at(visual, 0, 0)
    const last = at(visual, visual.length, 0)
    // Soft offset shadow, dark foundation and edge-lighting are shared by all stone variants.
    segment(graphics, { x: first.x + gridSize * 0.055, y: first.y + gridSize * 0.075 },
      { x: last.x + gridSize * 0.055, y: last.y + gridSize * 0.075 },
      0x020303, visual.thickness + gridSize * 0.14, 0.3)
    segment(graphics, first, last, 0x171719, visual.thickness + gridSize * 0.07, 0.96)
    segment(graphics, first, last,
      visual.appearance === 'cave' ? 0x393837 : 0x474747, visual.thickness, 0.98)

    for (let index = 0; index < visual.stones.length; index += 1) {
      drawStone(graphics, visual, index, gridSize)
    }
    segment(graphics, at(visual, 0, -visual.thickness * 0.52),
      at(visual, visual.length, -visual.thickness * 0.52),
      0xc7b8a5, Math.max(1, gridSize * 0.022), 0.38)
  }
  return graphics
}
