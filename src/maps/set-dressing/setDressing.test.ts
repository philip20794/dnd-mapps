import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry, type MapObjectDefinition } from '@/map-objects'
import { createLocalMapPlan } from '@/map-generation/localPlanner'
import { createGraphFirstDungeon } from '@/maps/dungeon-generation'
import { createRegionBasedOutdoorMap } from '@/maps/outdoor-generation'
import { validateMapDefinition } from '@/maps/validation'
import { SetDressingPlacementGuard } from './placement'
import { createSetDressingScene } from './scenes'
import type { SetDressingSceneKind } from './types'

const cellKey = (x: number, y: number): string => `${x},${y}`

const rectsOverlap = (left: MapObjectDefinition, right: MapObjectDefinition): boolean =>
  left.position.x < right.position.x + (right.width ?? 1) &&
  left.position.x + (left.width ?? 1) > right.position.x &&
  left.position.y < right.position.y + (right.height ?? 1) &&
  left.position.y + (left.height ?? 1) > right.position.y

const touchesCells = (object: MapObjectDefinition, cells: ReadonlySet<string>): boolean => {
  for (
    let y = Math.floor(object.position.y);
    y < Math.ceil(object.position.y + (object.height ?? 1));
    y += 1
  )
    for (
      let x = Math.floor(object.position.x);
      x < Math.ceil(object.position.x + (object.width ?? 1));
      x += 1
    )
      if (cells.has(cellKey(x, y))) return true
  return false
}

const allInteriorCells = (): ReadonlySet<string> =>
  new Set(
    Array.from({ length: 28 }, (_row, y) =>
      Array.from({ length: 28 }, (_cell, x) => cellKey(x + 1, y + 1)),
    ).flat(),
  )

describe('semantisches Set Dressing', () => {
  it('erzeugt alle Szenentypen als mehrteilige, deterministische Cluster', () => {
    const kinds: readonly SetDressingSceneKind[] = [
      'camp',
      'abandoned-camp',
      'ruin',
      'forest-edge',
      'river-bank',
      'dungeon-storage',
      'ritual-site',
    ]
    for (const [index, kind] of kinds.entries()) {
      const create = () => {
        const guard = new SetDressingPlacementGuard(
          { width: 30, height: 30, levelId: 'ground', allowedCells: allInteriorCells() },
          700 + index,
        )
        return createSetDressingScene(
          {
            id: `scene-${kind}`,
            kind,
            levelId: 'ground',
            center: { x: 15, y: 15 },
            tags: ['test'],
            atmosphere: kind === 'ritual-site' ? 'magical' : 'normal',
            biome: 'forest',
          },
          guard,
          123 + index,
        )
      }
      const first = create()
      const second = create()

      expect(second).toEqual(first)
      expect(first.scene?.kind).toBe(kind)
      expect(first.objects.length, kind).toBeGreaterThanOrEqual(3)
      expect(first.objects.every((object) => object.tags?.includes('set-dressing'))).toBe(true)
      for (let left = 0; left < first.objects.length; left += 1)
        for (let right = left + 1; right < first.objects.length; right += 1)
          expect(
            rectsOverlap(first.objects[left]!, first.objects[right]!),
            `${kind}: ${left}/${right}`,
          ).toBe(false)
    }
  })

  it('respektiert erlaubte Flaechen, Wasser-/Weg-Sperren, Walls und Tueren', () => {
    const allowed = new Set(
      Array.from({ length: 12 }, (_row, y) =>
        Array.from({ length: 12 }, (_cell, x) => cellKey(x + 8, y + 8)),
      ).flat(),
    )
    const forbidden = new Set([cellKey(13, 13), cellKey(14, 13), cellKey(15, 13), cellKey(16, 13)])
    const guard = new SetDressingPlacementGuard(
      {
        width: 30,
        height: 30,
        levelId: 'ground',
        allowedCells: allowed,
        forbiddenCells: forbidden,
        walls: [
          {
            id: 'wall',
            levelId: 'ground',
            a: { x: 8, y: 8 },
            b: { x: 8, y: 20 },
            blocksSight: true,
            blocksMovement: true,
          },
        ],
        doors: [
          {
            id: 'door',
            levelId: 'ground',
            segment: { a: { x: 19, y: 13 }, b: { x: 19, y: 15 } },
            label: 'Tuer',
            defaultState: 'closed',
            blocksSightWhenClosed: true,
            blocksMovementWhenClosed: true,
          },
        ],
      },
      912,
    )
    const result = createSetDressingScene(
      {
        id: 'safe-storage',
        kind: 'dungeon-storage',
        levelId: 'ground',
        center: { x: 14, y: 16 },
        tags: ['test'],
        atmosphere: 'normal',
      },
      guard,
      912,
    )

    expect(result.objects.length).toBeGreaterThan(1)
    expect(result.objects.every((object) => !touchesCells(object, forbidden))).toBe(true)
    expect(
      result.objects.every(
        (object) =>
          !touchesCells(
            object,
            new Set([cellKey(8, 13), cellKey(19, 13), cellKey(19, 14), cellKey(19, 15)]),
          ),
      ),
    ).toBe(true)
  })

  it('haelt die zentrale Freiflaeche eines Lagers frei', () => {
    const guard = new SetDressingPlacementGuard(
      {
        width: 32,
        height: 32,
        levelId: 'ground',
        allowedCells: new Set(
          Array.from({ length: 32 }, (_row, y) =>
            Array.from({ length: 32 }, (_cell, x) => cellKey(x, y)),
          ).flat(),
        ),
      },
      48,
    )
    const result = createSetDressingScene(
      {
        id: 'camp-clearance',
        kind: 'camp',
        levelId: 'ground',
        center: { x: 16, y: 16 },
        tags: ['test'],
        atmosphere: 'normal',
        biome: 'forest',
      },
      guard,
      48,
    )
    const nonFire = result.objects.filter((object) => object.type !== 'campfire')

    expect(result.scene?.clearRadius).toBeGreaterThan(1)
    expect(
      nonFire.every((object) => Math.hypot(object.position.x - 16, object.position.y - 16) >= 1.3),
    ).toBe(true)
  })

  it('platziert Dungeon-Dressing innerhalb der Raeume und fern von Doors und Hauptwegen', () => {
    const plan = createLocalMapPlan({
      seed: 2244,
      mapType: 'dungeon',
      biomes: ['underground'],
      themes: ['mine'],
      atmosphere: 'magical',
      size: 'large',
      dungeon: { roomCount: 30, loops: 'many', largeHalls: true },
    })
    const generated = createGraphFirstDungeon(plan)
    const registry = createDefaultObjectRegistry()
    const dressingIds = new Set(generated.dressing.objects.map((object) => object.id))

    expect(generated.dressing.scenes.some((scene) => scene.kind === 'ritual-site')).toBe(true)
    expect(generated.dressing.scenes.some((scene) => scene.kind === 'dungeon-storage')).toBe(true)
    expect(validateMapDefinition(generated.map, registry)).toHaveLength(0)
    generated.map.doors.forEach((door) => {
      const blockers = generated.dressing.objects.filter(
        (object) => object.blocksMovement !== false && object.id !== door.id,
      )
      expect(
        blockers.some(
          (object) =>
            object.position.x <= door.segment.a.x &&
            object.position.x + (object.width ?? 1) >= door.segment.a.x &&
            object.position.y <= door.segment.a.y &&
            object.position.y + (object.height ?? 1) >= door.segment.a.y,
        ),
      ).toBe(false)
    })
    expect([...dressingIds].every((id) => id?.startsWith('dressing-'))).toBe(true)
  })

  it('platziert Outdoor-Szenen nicht in Wasser oder auf geschuetzten Wegen', () => {
    const base = createLocalMapPlan({
      seed: 5531,
      mapType: 'outdoor',
      biomes: ['forest'],
      themes: ['ruins'],
      waterFeatures: ['multiple-rivers', 'lake'],
      atmosphere: 'magical',
      size: 'large',
    })
    const plan = {
      ...base,
      sceneFeatures: [
        { id: 'scene-watch', targetId: base.startArea.targetId, kind: 'watch-camp' as const },
      ],
      storyHooks: [
        { id: 'story-ritual', targetId: base.startArea.targetId, kind: 'ritual' as const },
      ],
    }
    const generated = createRegionBasedOutdoorMap(plan)
    const protectedCells = new Set([
      ...generated.linear.water.waterCells,
      ...generated.linear.pathCells,
    ])

    expect(generated.dressing.scenes.some((scene) => scene.kind === 'ruin')).toBe(true)
    expect(generated.dressing.scenes.some((scene) => scene.kind === 'river-bank')).toBe(true)
    expect(
      generated.dressing.objects.every((object) => !touchesCells(object, protectedCells)),
    ).toBe(true)
    expect(validateMapDefinition(generated.map, createDefaultObjectRegistry())).toHaveLength(0)
  })
})
