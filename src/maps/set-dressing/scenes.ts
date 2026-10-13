import type { MapObjectDefinition } from '@/map-objects'
import { createSeededRandom } from '@/map-generation/random'
import { SetDressingPlacementGuard, type DressingProp } from './placement'
import type { SetDressingScene, SetDressingSceneRequest } from './types'

interface ScenePropPlacement {
  readonly prop: DressingProp
  readonly offset: { readonly x: number; readonly y: number }
}

const weighted = <T>(
  random: () => number,
  values: readonly { readonly value: T; readonly weight: number }[],
): T => {
  const total = values.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = random() * total
  for (const entry of values) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.value
  }
  return values[values.length - 1]!.value
}

const prop = (
  type: string,
  preset: string | undefined,
  width: number,
  height: number,
  extra: Partial<DressingProp> = {},
): DressingProp => ({ type, ...(preset ? { preset } : {}), width, height, ...extra })

const campProps = (random: () => number, abandoned: boolean): readonly ScenePropPlacement[] => {
  const chair = abandoned
    ? prop('chair', 'broken-chair', 0.75, 0.62)
    : prop('chair', 'wooden-stool', 0.58, 0.58)
  const fire = abandoned
    ? prop('campfire', 'small-campfire', 1.1, 0.9, {
        light: null,
        animation: null,
        color: 0x5a4a3a,
        alpha: 0.7,
      })
    : prop('campfire', 'small-campfire', 1.2, 1.2)
  const supply = weighted(random, [
    { value: prop('crate', 'small-crate', 0.8, 0.8), weight: 3 },
    { value: prop('decoration', 'sack-pile', 1.25, 0.9), weight: 2 },
    { value: prop('barrel', 'small-barrel', 0.75, 0.75), weight: 1 },
  ])
  return [
    { prop: fire, offset: { x: -0.55, y: -0.55 } },
    { prop: chair, offset: { x: -2.25, y: -0.3 } },
    { prop: chair, offset: { x: 1.7, y: -0.25 } },
    { prop: chair, offset: { x: -0.3, y: 1.8 } },
    { prop: supply, offset: { x: 2.5, y: 1.4 } },
    {
      prop: prop('decoration', 'bedroll', 1.5, 0.7, { blocksMovement: abandoned }),
      offset: { x: -2.5, y: 1.75 },
    },
    ...(abandoned
      ? [
          {
            prop: prop('decoration', 'plank-debris', 1.8, 0.8, { blocksMovement: false }),
            offset: { x: 2.3, y: -1.8 },
          },
          {
            prop: prop('forest-remains', 'scattered-bones', 1.4, 1, { blocksMovement: false }),
            offset: { x: -1.9, y: -2.2 },
          },
        ]
      : [{ prop: prop('fallen-log', 'fallen-tree', 2.2, 0.7), offset: { x: 0.8, y: -2.2 } }]),
  ]
}

const sceneProps = (
  request: SetDressingSceneRequest,
  random: () => number,
): readonly ScenePropPlacement[] => {
  switch (request.kind) {
    case 'camp':
      return campProps(random, false)
    case 'abandoned-camp':
      return campProps(random, true)
    case 'dungeon-storage':
      return [
        { prop: prop('crate', 'large-crate', 1.25, 1.25), offset: { x: -1.9, y: -1.5 } },
        { prop: prop('crate', 'small-crate', 0.8, 0.8), offset: { x: -0.6, y: -1.6 } },
        {
          prop: prop(
            'barrel',
            weighted(random, [
              { value: 'small-barrel', weight: 3 },
              { value: 'large-barrel', weight: 1 },
            ]),
            0.75,
            0.75,
          ),
          offset: { x: -1.8, y: 0 },
        },
        { prop: prop('table', 'workbench', 2.4, 1), offset: { x: 0.3, y: -1.2 } },
        { prop: prop('decoration', 'sack-pile', 1.25, 0.9), offset: { x: 1.7, y: 0.5 } },
      ]
    case 'ritual-site': {
      const candle = request.atmosphere === 'cursed' ? 'cold-moon-candle' : 'blue-ritual-candle'
      return [
        {
          prop: prop('decoration', 'ritual-runes', 1.5, 1.5, {
            blocksMovement: false,
            layer: 'effects',
          }),
          offset: { x: -0.75, y: -0.75 },
        },
        { prop: prop('altar', undefined, 2.2, 1.4), offset: { x: -1.1, y: -3 } },
        ...[
          { x: -2.3, y: -2.1 },
          { x: 2.05, y: -2.1 },
          { x: -2.3, y: 2 },
          { x: 2.05, y: 2 },
        ].map((offset) => ({
          prop: prop('candle', candle, 0.26, 0.38, { blocksMovement: false }),
          offset,
        })),
      ]
    }
    case 'ruin':
      return [
        {
          prop: prop('rock', 'rubble-pile', 2.1, 1.35, { blocksMovement: false }),
          offset: { x: -2.4, y: -1.1 },
        },
        { prop: prop('rock', 'mossy-boulder', 1.25, 1.1), offset: { x: 1.8, y: -1.4 } },
        {
          prop: prop('decoration', 'plank-debris', 1.8, 0.8, { blocksMovement: false }),
          offset: { x: 1.3, y: 1.4 },
        },
        { prop: prop('tree', 'dead-tree', 1.4, 1.6), offset: { x: -2.2, y: 1.5 } },
        {
          prop: prop('ground-area', 'cracked-tiles', 2.5, 1.5, {
            blocksMovement: false,
            alpha: 0.58,
          }),
          offset: { x: -0.4, y: 0.8 },
        },
      ]
    case 'forest-edge':
      return [
        {
          prop: prop('tree', request.biome === 'snow' ? 'pine-tree' : 'old-oak', 1.4, 1.6),
          offset: { x: -2.6, y: -1.8 },
        },
        {
          prop: prop('tree', request.biome === 'snow' ? 'pine-tree' : 'birch-tree', 1.25, 1.7),
          offset: { x: 2, y: -1.1 },
        },
        {
          prop: prop('bush', 'leafy-bush', 0.9, 0.75, { blocksMovement: false }),
          offset: { x: -1.8, y: 1.9 },
        },
        { prop: prop('fallen-log', 'fallen-tree', 2.8, 0.85), offset: { x: 0.7, y: 1.6 } },
        { prop: prop('rock', 'small-rock', 0.75, 0.65), offset: { x: 2.8, y: 2 } },
      ]
    case 'river-bank':
      return [
        {
          prop: prop('ground-area', 'shallow-mud', 2.4, 1.5, {
            blocksMovement: false,
            alpha: 0.76,
          }),
          offset: { x: -1.2, y: -0.7 },
        },
        {
          prop: prop('bush', 'reed-clump', 1, 1.15, { blocksMovement: false }),
          offset: { x: -2, y: 1 },
        },
        {
          prop: prop('thicket', 'reed-bed', 1.7, 1.35, { blocksMovement: false }),
          offset: { x: 1.3, y: 1.1 },
        },
        { prop: prop('rock', 'small-rock', 0.75, 0.65), offset: { x: 2.5, y: -1.4 } },
        { prop: prop('fallen-log', 'fallen-tree', 2.4, 0.7), offset: { x: -2.6, y: -1.7 } },
      ]
  }
}

export const createSetDressingScene = (
  request: SetDressingSceneRequest,
  guard: SetDressingPlacementGuard,
  seed: number,
): { readonly scene?: SetDressingScene; readonly objects: readonly MapObjectDefinition[] } => {
  const random = createSeededRandom(
    (seed ^ request.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0)) >>>
      0,
  )
  const objects: MapObjectDefinition[] = []
  const baseTags = [
    'set-dressing',
    `scene-${request.kind}`,
    `cluster-${request.id}`,
    ...request.tags,
  ]
  sceneProps(request, random).forEach((entry, index) => {
    const object = guard.place(
      `dressing-${request.id}-${index + 1}`,
      entry.prop,
      { x: request.center.x + entry.offset.x, y: request.center.y + entry.offset.y },
      baseTags,
    )
    if (object) objects.push(object)
  })
  if (objects.length === 0) return { objects }
  const clearRadius =
    request.kind === 'camp' || request.kind === 'abandoned-camp'
      ? 1.35
      : request.kind === 'ritual-site'
        ? 1.2
        : 0
  return {
    objects,
    scene: {
      id: request.id,
      kind: request.kind,
      levelId: request.levelId,
      center: request.center,
      objectIds: objects.map((object) => object.id!),
      clearRadius,
      tags: request.tags,
    },
  }
}
