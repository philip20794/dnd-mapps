import type { MapObjectDefinition } from '@/map-objects'
import { createSeededRandom, integer } from '@/map-generation/random'
import type { Segment } from '@/types/geometry'
import type { DressingPlacementRules, DressingPoint } from './types'

interface DressingProp {
  readonly type: string
  readonly preset?: string
  readonly width: number
  readonly height: number
  readonly blocksMovement?: boolean
  readonly blocksSight?: boolean
  readonly light?: MapObjectDefinition['light']
  readonly animation?: MapObjectDefinition['animation']
  readonly color?: number
  readonly secondaryColor?: number
  readonly alpha?: number
  readonly layer?: MapObjectDefinition['layer']
}

interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const cellKey = (x: number, y: number): string => `${x},${y}`

const intersects = (left: Rect, right: Rect): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y

const segmentIntersectsRect = (segment: Segment, rect: Rect): boolean => {
  const minX = Math.min(segment.a.x, segment.b.x)
  const maxX = Math.max(segment.a.x, segment.b.x)
  const minY = Math.min(segment.a.y, segment.b.y)
  const maxY = Math.max(segment.a.y, segment.b.y)
  if (minX === maxX)
    return (
      minX >= rect.x &&
      minX <= rect.x + rect.width &&
      maxY >= rect.y &&
      minY <= rect.y + rect.height
    )
  if (minY === maxY)
    return (
      minY >= rect.y &&
      minY <= rect.y + rect.height &&
      maxX >= rect.x &&
      minX <= rect.x + rect.width
    )
  return !(
    maxX < rect.x ||
    minX > rect.x + rect.width ||
    maxY < rect.y ||
    minY > rect.y + rect.height
  )
}

const rectForObject = (object: MapObjectDefinition): Rect => ({
  x: object.position.x,
  y: object.position.y,
  width: object.width ?? 1,
  height: object.height ?? 1,
})

const isStructuralObject = (object: MapObjectDefinition): boolean =>
  !['ground-area', 'water', 'river', 'daylight-area', 'fog', 'smoke'].includes(object.type)

/** Shared placement guard for semantic scene clusters. */
export class SetDressingPlacementGuard {
  private readonly random: () => number
  private readonly occupied: Rect[]
  private readonly segments: readonly Segment[]

  public constructor(
    private readonly rules: DressingPlacementRules,
    seed: number,
  ) {
    this.random = createSeededRandom(seed >>> 0)
    this.occupied = (rules.occupied ?? []).filter(isStructuralObject).map(rectForObject)
    this.segments = [
      ...(rules.walls ?? []).filter((wall) => (wall.levelId ?? rules.levelId) === rules.levelId),
      ...(rules.doors ?? [])
        .filter((door) => (door.levelId ?? rules.levelId) === rules.levelId)
        .map((door) => door.segment),
    ]
  }

  public place(
    id: string,
    prop: DressingProp,
    target: DressingPoint,
    tags: readonly string[],
  ): MapObjectDefinition | undefined {
    const jitter = [
      { x: 0, y: 0 },
      ...Array.from({ length: 12 }, () => ({
        x: integer(this.random, -2, 2) * 0.35,
        y: integer(this.random, -2, 2) * 0.35,
      })),
    ]
    for (const offset of jitter) {
      const rect = {
        x: target.x + offset.x,
        y: target.y + offset.y,
        width: prop.width,
        height: prop.height,
      }
      if (!this.isAllowed(rect)) continue
      this.occupied.push(rect)
      return {
        id,
        type: prop.type,
        ...(prop.preset ? { preset: prop.preset } : {}),
        levelId: this.rules.levelId,
        position: { x: rect.x, y: rect.y },
        width: prop.width,
        height: prop.height,
        ...(prop.blocksMovement === undefined ? {} : { blocksMovement: prop.blocksMovement }),
        ...(prop.blocksSight === undefined ? {} : { blocksSight: prop.blocksSight }),
        ...(prop.light === undefined ? {} : { light: prop.light }),
        ...(prop.animation === undefined ? {} : { animation: prop.animation }),
        ...(prop.color === undefined ? {} : { color: prop.color }),
        ...(prop.secondaryColor === undefined ? {} : { secondaryColor: prop.secondaryColor }),
        ...(prop.alpha === undefined ? {} : { alpha: prop.alpha }),
        ...(prop.layer === undefined ? {} : { layer: prop.layer }),
        tags,
      }
    }
    return undefined
  }

  private isAllowed(rect: Rect): boolean {
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > this.rules.width ||
      rect.y + rect.height > this.rules.height
    )
      return false
    for (let y = Math.floor(rect.y); y < Math.ceil(rect.y + rect.height); y += 1) {
      for (let x = Math.floor(rect.x); x < Math.ceil(rect.x + rect.width); x += 1) {
        const key = cellKey(x, y)
        if (this.rules.allowedCells && !this.rules.allowedCells.has(key)) return false
        if (this.rules.forbiddenCells?.has(key)) return false
      }
    }
    return (
      !this.occupied.some((other) => intersects(rect, other)) &&
      !this.segments.some((segment) => segmentIntersectsRect(segment, rect))
    )
  }
}

export type { DressingProp }
