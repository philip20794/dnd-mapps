import type { MapObjectDefinition } from '@/map-objects'
import type { GroundPresetName } from '@/map-objects/objects/groundObjects'
import type { GridPoint } from '@/types/geometry'
import type { DoorDefinition, MapPrefabResult, WallDefinition } from '../api'

type GroundAreaOverrides = Partial<
  Omit<MapObjectDefinition, 'id' | 'type' | 'preset' | 'position' | 'width' | 'height'>
>

type TorchPresetName =
  | 'small-wall-torch'
  | 'large-wall-torch'
  | 'blue-magic-fire'
  | 'rusty-iron-torch'
  | 'brass-wall-sconce'
  | 'blue-crystal-torch'
  | 'green-witchlight'
  | 'hooded-lantern'

export const groundArea = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  preset: GroundPresetName = 'cracked-tiles',
  overrides: GroundAreaOverrides = {},
): MapObjectDefinition => ({
  id,
  type: 'ground-area',
  preset,
  position: { x, y },
  width,
  height,
  ...overrides,
})

export const floorArea = groundArea

export const wallObject = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  preset = 'crypt-wall',
): MapObjectDefinition => ({
  id,
  type: 'stone-wall',
  preset,
  position: { x, y },
  width,
  height,
})

export const wallSegment = (
  id: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): WallDefinition => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  blocksSight: true,
  blocksMovement: true,
  appearance: 'stone',
})

export const torch = (
  id: string,
  position: GridPoint,
  preset: TorchPresetName = 'small-wall-torch',
  rotation = 0,
): MapObjectDefinition => ({
  id,
  type: 'torch',
  preset,
  position,
  rotation,
})

export const wallSectionWithTorches = (
  id: string,
  wall: WallDefinition,
  firstTorch: GridPoint,
  secondTorch: GridPoint,
): MapPrefabResult => ({
  walls: [wall],
  objects: [
    torch(`${id}-torch-a`, firstTorch, 'small-wall-torch'),
    torch(`${id}-torch-b`, secondTorch, 'rusty-iron-torch'),
  ],
})

export const storageCluster = (id: string, x: number, y: number): MapPrefabResult => ({
  objects: [
    { id: `${id}-crate-a`, type: 'crate', preset: 'small-crate', position: { x, y } },
    { id: `${id}-crate-b`, type: 'crate', preset: 'large-crate', position: { x: x + 1.1, y } },
    {
      id: `${id}-barrel-a`,
      type: 'barrel',
      preset: 'small-barrel',
      position: { x: x + 0.2, y: y + 1.1 },
    },
    {
      id: `${id}-barrel-b`,
      type: 'barrel',
      preset: 'large-barrel',
      position: { x: x + 1.35, y: y + 1.25 },
    },
  ],
})

export const woodenDoor = (
  id: string,
  label: string,
  position: GridPoint,
  width: number,
  segment: DoorDefinition['segment'],
  rotation = 0,
): MapPrefabResult => ({
  objects: [
    {
      id,
      type: 'wooden-door',
      preset: 'closed-wooden-door',
      position,
      width,
      height: 0.25,
      rotation,
      label,
      interactionState: 'closed',
    },
  ],
  doors: [
    {
      id,
      label,
      segment,
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    },
  ],
})

export const campSite = (id: string, x: number, y: number): MapPrefabResult => ({
  objects: [
    { id: `${id}-hearth`, type: 'hearth', preset: 'large-hearth', position: { x, y } },
    {
      id: `${id}-smoke`,
      type: 'smoke',
      preset: 'light-smoke',
      position: { x: x - 0.3, y: y - 0.4 },
      width: 2.6,
      height: 2.4,
    },
    {
      id: `${id}-crate`,
      type: 'crate',
      preset: 'small-crate',
      position: { x: x + 2.2, y: y + 0.4 },
    },
    {
      id: `${id}-barrel`,
      type: 'barrel',
      preset: 'small-barrel',
      position: { x: x - 1.1, y: y + 0.8 },
    },
  ],
})
