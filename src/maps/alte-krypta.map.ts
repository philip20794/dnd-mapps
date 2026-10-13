import { defineMap, mergePrefabResults } from './api'
import type { MapObjectDefinition } from '@/map-objects'
import type { PlacedToken } from '@/types/tokens'
import type { WallDefinition } from './api'
import {
  campSite,
  floorArea,
  storageCluster,
  torch,
  wallObject,
  wallSectionWithTorches,
  wallSegment,
  woodenDoor,
} from './prefabs/common'

const cryptLevel = 'crypt'
const tunnelLevel = 'tunnel'
const chapelLevel = 'chapel'

const onLevel = <TObject extends MapObjectDefinition>(
  object: TObject,
  levelId: string,
): TObject & { readonly levelId: string } => ({ ...object, levelId })

const wallOnLevel = (wall: WallDefinition, levelId: string): WallDefinition => ({
  ...wall,
  levelId,
})

const mainTorches = wallSectionWithTorches(
  'main-north',
  wallSegment('main-north-wall', 2, 2, 12, 2),
  { x: 3.2, y: 2.05 },
  { x: 10.2, y: 2.05 },
)

const cryptDoor = woodenDoor('door-south-crypt', 'Tür zur Südkrypta', { x: 8, y: 9.86 }, 2, {
  a: { x: 8, y: 10 },
  b: { x: 10, y: 10 },
})

const eastDoor = woodenDoor(
  'door-east-room',
  'Tür zur Grabkammer',
  { x: 14.86, y: 5 },
  2,
  { a: { x: 15, y: 5 }, b: { x: 15, y: 7 } },
  Math.PI / 2,
)

const storage = storageCluster('east-storage', 21, 4.2)
const firePlace = campSite('southern-fire', 9.8, 13.6)

const floorObjects: readonly MapObjectDefinition[] = [
  floorArea('floor-main-base', 2, 2, 10, 8, 'cave-ground'),
  floorArea('floor-east-base', 15, 3, 10, 7, 'wet-stone'),
  floorArea('floor-corridor-east-base', 12, 5, 3, 2, 'loose-gravel'),
  floorArea('floor-corridor-south-base', 8, 10, 3, 2, 'packed-earth'),
  floorArea('floor-south-base', 5, 12, 12, 5, 'dark-earth'),
  floorArea('floor-river-bank-base', 16, 10, 10, 5, 'wet-stone'),

  floorArea('floor-main-center-slabs', 3, 3, 8, 6, 'cracked-tiles'),
  floorArea('floor-main-north-moss', 2, 2, 2, 2, 'mossy-stone', { alpha: 0.82 }),
  floorArea('floor-main-east-moss', 10, 2, 2, 3, 'mossy-stone', { alpha: 0.72 }),
  floorArea('floor-main-door-dust', 7, 8, 4, 2, 'grave-dust', { alpha: 0.86 }),
  floorArea('floor-main-column-gravel-a', 3, 6, 2, 2, 'loose-gravel', { alpha: 0.72 }),
  floorArea('floor-main-column-gravel-b', 8, 5, 2, 3, 'loose-gravel', { alpha: 0.62 }),

  floorArea('floor-east-center-slabs', 16, 4, 7, 4, 'stone-tiles'),
  floorArea('floor-east-storage-dust', 20, 4, 4, 3, 'grave-dust', { alpha: 0.82 }),
  floorArea('floor-east-north-moss', 15, 3, 2, 2.5, 'mossy-stone', { alpha: 0.72 }),
  floorArea('floor-east-south-earth', 22, 7, 3, 3, 'packed-earth', { alpha: 0.78 }),
  floorArea('floor-east-left-gravel', 15, 7, 2, 3, 'loose-gravel', { alpha: 0.72 }),

  floorArea('floor-corridor-east-track', 12, 5.5, 3, 1, 'dirt-path', { alpha: 0.76 }),
  floorArea('floor-corridor-south-broken-slabs', 8, 10, 2, 1, 'cracked-tiles', { alpha: 0.62 }),
  floorArea('floor-corridor-south-dust', 9, 11, 2, 1, 'grave-dust', { alpha: 0.78 }),

  floorArea('floor-south-entry-slabs', 7, 12, 4, 2, 'cracked-tiles', { alpha: 0.74 }),
  floorArea('floor-south-fire-worn-ground', 8, 13, 5, 3, 'packed-earth', { alpha: 0.84 }),
  floorArea('floor-south-west-dust', 5, 15, 4, 2, 'grave-dust', { alpha: 0.78 }),
  floorArea('floor-south-east-moss', 14, 12, 3, 3, 'mossy-stone', { alpha: 0.66 }),
  floorArea('floor-south-gravel-tail', 11, 15, 4, 2, 'loose-gravel', { alpha: 0.72 }),

  floorArea('floor-river-wet-edge', 17, 10.4, 8, 1.1, 'marsh', { alpha: 0.58 }),
  floorArea('floor-river-south-bank', 16, 13, 6, 2, 'cave-ground', { alpha: 0.82 }),
  floorArea('floor-river-dark-silt', 22, 13, 4, 2, 'dark-earth', { alpha: 0.72 }),
  floorArea('floor-river-west-moss', 16, 10, 2, 2, 'mossy-stone', { alpha: 0.64 }),
  floorArea('floor-river-east-gravel', 23, 10, 3, 2, 'loose-gravel', { alpha: 0.72 }),

  floorArea('floor-guard-corridor', 26, 12.4, 3, 2.8, 'loose-gravel', { alpha: 0.82 }),
  floorArea('floor-guard-room-base', 29, 12, 7, 6, 'cave-ground'),
  floorArea('floor-guard-room-slabs', 30, 13, 5, 4, 'cracked-tiles', { alpha: 0.74 }),
  floorArea('floor-guard-room-dust', 31, 15, 4, 3, 'grave-dust', { alpha: 0.72 }),

  floorArea('floor-cave-entry', 25, 5.5, 6, 3, 'loose-gravel'),
  floorArea('floor-cave-chamber-base', 31, 3, 8, 9, 'cave-ground'),
  floorArea('floor-cave-chamber-wet', 33, 8, 4, 3, 'wet-stone', { alpha: 0.78 }),
  floorArea('floor-cave-chamber-moss', 35, 4, 3, 4, 'mossy-stone', { alpha: 0.64 }),
  floorArea('floor-cave-exit', 38, 6, 5, 4, 'dirt-path', { alpha: 0.88 }),

  floorArea('floor-forest-base', 42, 2, 13, 22, 'forest-floor'),
  floorArea('floor-forest-clearing', 45, 6, 8, 7, 'meadow', { alpha: 0.76 }),
  floorArea('floor-forest-path-west', 39, 7.2, 9, 2.6, 'dirt-path', { alpha: 0.9 }),
  floorArea('floor-forest-path-bridge', 48, 9, 3, 11, 'dirt-path', { alpha: 0.86 }),
  floorArea('floor-forest-river-bank-north', 42, 13.5, 13, 1.8, 'marsh', { alpha: 0.72 }),
  floorArea('floor-forest-river-bank-south', 42, 17.7, 13, 3.4, 'marsh', { alpha: 0.76 }),
  floorArea('floor-forest-south-path', 47, 20, 5, 4, 'packed-earth', { alpha: 0.74 }),
]

const wallObjects: readonly MapObjectDefinition[] = [
  wallObject('wall-main-top', 2, 1.75, 10, 0.35, 'outer-wall'),
  wallObject('wall-main-left', 1.75, 2, 0.35, 8, 'outer-wall'),
  wallObject('wall-main-bottom-a', 2, 9.85, 6, 0.35),
  wallObject('wall-main-bottom-b', 10, 9.85, 2, 0.35),
  wallObject('wall-main-right-a', 11.85, 2, 0.35, 3),
  wallObject('wall-main-right-b', 11.85, 7, 0.35, 3),
  wallObject('wall-east-top', 15, 2.75, 10, 0.35, 'outer-wall'),
  wallObject('wall-east-right-upper', 24.85, 3, 0.35, 3, 'outer-wall'),
  wallObject('wall-east-right-lower', 24.85, 8, 0.35, 2, 'outer-wall'),
  wallObject('wall-east-bottom', 15, 9.85, 10, 0.35),
  wallObject('wall-east-left-a', 14.85, 3, 0.35, 2),
  wallObject('wall-east-left-b', 14.85, 7, 0.35, 3),
  wallObject('wall-south-left', 4.85, 12, 0.35, 5, 'outer-wall'),
  wallObject('wall-south-right', 16.85, 12, 0.35, 5, 'outer-wall'),
  wallObject('wall-south-bottom', 5, 16.85, 12, 0.35, 'outer-wall'),
  wallObject('wall-south-top-a', 5, 11.85, 3, 0.35),
  wallObject('wall-south-top-b', 10, 11.85, 7, 0.35),
  wallObject('wall-guard-top', 29, 11.85, 7, 0.35),
  wallObject('wall-guard-right', 35.85, 12, 0.35, 6),
  wallObject('wall-guard-bottom', 29, 17.85, 7, 0.35),
  wallObject('wall-guard-left-upper', 28.85, 12, 0.35, 1.2),
  wallObject('wall-guard-left-lower', 28.85, 15.2, 0.35, 2.8),
  wallObject('wall-cave-entry-top', 25, 5.35, 6, 0.35, 'outer-wall'),
  wallObject('wall-cave-entry-bottom', 25, 8.35, 6, 0.35, 'outer-wall'),
  wallObject('wall-cave-top', 31, 2.85, 8, 0.35, 'outer-wall'),
  wallObject('wall-cave-left-upper', 30.85, 3, 0.35, 2.4, 'outer-wall'),
  wallObject('wall-cave-left-lower', 30.85, 8.5, 0.35, 3.5, 'outer-wall'),
  wallObject('wall-cave-bottom', 31, 11.85, 8, 0.35, 'outer-wall'),
  wallObject('wall-cave-right-upper', 38.85, 3, 0.35, 3, 'outer-wall'),
  wallObject('wall-cave-right-lower', 38.85, 10, 0.35, 2, 'outer-wall'),
  wallObject('wall-cave-exit-top', 39, 5.85, 4, 0.35, 'outer-wall'),
  wallObject('wall-cave-exit-bottom', 39, 10.15, 4, 0.35, 'outer-wall'),
]

const forestObjects: readonly MapObjectDefinition[] = [
  {
    id: 'forest-daylight',
    type: 'daylight-area',
    preset: 'forest-daylight',
    position: { x: 42, y: 2 },
    width: 13,
    height: 22,
  },
  { id: 'tree-forest-north-a', type: 'tree', preset: 'old-oak', position: { x: 42.4, y: 2.8 } },
  { id: 'tree-forest-north-b', type: 'tree', preset: 'pine-tree', position: { x: 45.3, y: 2.4 } },
  { id: 'tree-forest-north-c', type: 'tree', preset: 'old-oak', position: { x: 52.4, y: 3.1 } },
  { id: 'tree-forest-west-a', type: 'tree', preset: 'pine-tree', position: { x: 42.1, y: 9.5 } },
  { id: 'tree-forest-west-b', type: 'tree', preset: 'dead-tree', position: { x: 43.4, y: 19.4 } },
  { id: 'tree-forest-east-a', type: 'tree', preset: 'old-oak', position: { x: 53.1, y: 8.6 } },
  { id: 'tree-forest-east-b', type: 'tree', preset: 'pine-tree', position: { x: 53.3, y: 17.9 } },
  { id: 'tree-forest-south-a', type: 'tree', preset: 'old-oak', position: { x: 45.2, y: 21.5 } },
  { id: 'tree-forest-south-b', type: 'tree', preset: 'pine-tree', position: { x: 51.8, y: 21.8 } },
  {
    id: 'tree-forest-clearing-dead',
    type: 'tree',
    preset: 'dead-tree',
    position: { x: 46.1, y: 6.2 },
  },
  {
    id: 'forest-river',
    type: 'river',
    preset: 'slow-river',
    position: { x: 42, y: 15.2 },
    width: 13,
    height: 2.5,
  },
  {
    id: 'forest-river-mist',
    type: 'fog',
    preset: 'ground-fog',
    position: { x: 41.8, y: 14.4 },
    width: 13.4,
    height: 4.1,
  },
  {
    id: 'forest-bridge',
    type: 'bridge',
    preset: 'old-forest-bridge',
    position: { x: 47.8, y: 14.1 },
    width: 3.4,
    height: 4.4,
  },
  { id: 'river-rock-north', type: 'rock', preset: 'mossy-boulder', position: { x: 42.8, y: 13.8 } },
  { id: 'river-rock-south', type: 'rock', preset: 'small-rock', position: { x: 52.1, y: 18.6 } },
]

const caveObjects: readonly MapObjectDefinition[] = [
  { id: 'cave-rock-entry-a', type: 'rock', preset: 'large-boulder', position: { x: 27.2, y: 5.8 } },
  { id: 'cave-rock-entry-b', type: 'rock', preset: 'small-rock', position: { x: 29.4, y: 7.5 } },
  {
    id: 'cave-rock-chamber-a',
    type: 'rock',
    preset: 'mossy-boulder',
    position: { x: 32.2, y: 4.2 },
  },
  {
    id: 'cave-rock-chamber-b',
    type: 'rock',
    preset: 'large-boulder',
    position: { x: 36.4, y: 9.2 },
  },
  {
    id: 'cave-drip-pool',
    type: 'water',
    preset: 'standing-water',
    position: { x: 33.2, y: 8.6 },
    width: 2.2,
    height: 1.1,
  },
  torch('torch-cave-chamber', { x: 32.1, y: 3.4 }, 'rusty-iron-torch'),
  torch('torch-cave-exit', { x: 39.2, y: 7.8 }, 'brass-wall-sconce', Math.PI / 2),
  { id: 'guard-table', type: 'table', position: { x: 30.4, y: 13.4 }, width: 2, height: 1 },
  { id: 'guard-chair', type: 'chair', position: { x: 31.2, y: 14.7 } },
  { id: 'guard-crate', type: 'crate', preset: 'small-crate', position: { x: 34, y: 16.2 } },
  { id: 'guard-barrel', type: 'barrel', preset: 'small-barrel', position: { x: 29.8, y: 16.4 } },
]

const cryptTransitionObjects: readonly MapObjectDefinition[] = [
  {
    id: 'stairs-south-to-tunnel',
    type: 'stairs',
    preset: 'stone-stairs-down',
    position: { x: 13.6, y: 13.2 },
    width: 1.4,
    height: 1.4,
    transition: {
      targetLevelId: tunnelLevel,
      targetPosition: { x: 8.5, y: 14.7 },
      direction: 'down',
      label: 'In den Tunnel hinabgestiegen',
    },
  },
]

const tunnelFloorObjects: readonly MapObjectDefinition[] = [
  onLevel(floorArea('tunnel-floor-under-camp', 6.5, 13.4, 10.5, 3.1, 'dark-earth'), tunnelLevel),
  onLevel(floorArea('tunnel-floor-low-path', 16, 14.1, 11, 1.8, 'packed-earth'), tunnelLevel),
  onLevel(
    floorArea('tunnel-floor-wet-patches', 18.5, 15.3, 6, 1.1, 'wet-stone', { alpha: 0.72 }),
    tunnelLevel,
  ),
  onLevel(floorArea('tunnel-floor-ladder-pocket', 25.3, 12.4, 4.3, 5, 'cave-ground'), tunnelLevel),
]

const tunnelWallObjects: readonly MapObjectDefinition[] = [
  onLevel(wallObject('tunnel-wall-under-north', 6.4, 13.05, 10.8, 0.35, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-under-south', 6.4, 16.45, 10.8, 0.35, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-under-west', 6.2, 13.2, 0.35, 3.3, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-path-north', 16.8, 13.8, 10.2, 0.35, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-path-south', 16.8, 15.95, 10.2, 0.35, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-pocket-right', 29.35, 12.4, 0.35, 5, 'outer-wall'), tunnelLevel),
  onLevel(wallObject('tunnel-wall-pocket-top', 25.2, 12.15, 4.4, 0.35, 'outer-wall'), tunnelLevel),
  onLevel(
    wallObject('tunnel-wall-pocket-bottom', 25.2, 17.15, 4.4, 0.35, 'outer-wall'),
    tunnelLevel,
  ),
]

const tunnelObjects: readonly MapObjectDefinition[] = [
  onLevel(
    {
      id: 'stairs-tunnel-to-south',
      type: 'stairs',
      preset: 'stone-stairs-up',
      position: { x: 7.8, y: 14.1 },
      width: 1.4,
      height: 1.4,
      transition: {
        targetLevelId: cryptLevel,
        targetPosition: { x: 13.9, y: 13.7 },
        direction: 'up',
        label: 'Zur Krypta hinaufgestiegen',
      },
    },
    tunnelLevel,
  ),
  onLevel(
    {
      id: 'ladder-tunnel-to-chapel',
      type: 'ladder',
      preset: 'wooden-ladder-up',
      position: { x: 27.1, y: 14.1 },
      width: 1,
      height: 1.35,
      transition: {
        targetLevelId: chapelLevel,
        targetPosition: { x: 29.7, y: 14.6 },
        direction: 'up',
        label: 'In die Kapelle hinaufgeklettert',
      },
    },
    tunnelLevel,
  ),
  onLevel(torch('torch-tunnel-west', { x: 10.2, y: 13.5 }, 'rusty-iron-torch'), tunnelLevel),
  onLevel(torch('torch-tunnel-ladder', { x: 25.8, y: 13.1 }, 'brass-wall-sconce'), tunnelLevel),
  onLevel(
    { id: 'tunnel-rock-a', type: 'rock', preset: 'small-rock', position: { x: 18.2, y: 14.7 } },
    tunnelLevel,
  ),
  onLevel(
    {
      id: 'tunnel-crate-old',
      type: 'crate',
      preset: 'small-crate',
      position: { x: 24.5, y: 15.8 },
    },
    tunnelLevel,
  ),
]

const chapelFloorObjects: readonly MapObjectDefinition[] = [
  onLevel(floorArea('chapel-floor-base', 24.5, 7.8, 13.5, 11.2, 'stone-tiles'), chapelLevel),
  onLevel(
    floorArea('chapel-floor-center-carpet', 28.1, 10, 6.2, 6.7, 'grave-dust', { alpha: 0.72 }),
    chapelLevel,
  ),
  onLevel(
    floorArea('chapel-floor-sunbeam-west', 25.2, 9.4, 4.5, 2, 'sand', { alpha: 0.28 }),
    chapelLevel,
  ),
  onLevel(
    floorArea('chapel-floor-sunbeam-east', 33.4, 10.6, 3.6, 2.8, 'sand', { alpha: 0.24 }),
    chapelLevel,
  ),
]

const chapelWallObjects: readonly MapObjectDefinition[] = [
  onLevel(wallObject('chapel-wall-top-a', 24.5, 7.45, 4.4, 0.35, 'outer-wall'), chapelLevel),
  onLevel(wallObject('chapel-wall-top-b', 30.7, 7.45, 7.3, 0.35, 'outer-wall'), chapelLevel),
  onLevel(wallObject('chapel-wall-left', 24.15, 7.8, 0.35, 11.2, 'outer-wall'), chapelLevel),
  onLevel(wallObject('chapel-wall-right', 37.85, 7.8, 0.35, 11.2, 'outer-wall'), chapelLevel),
  onLevel(wallObject('chapel-wall-bottom-a', 24.5, 18.85, 4.6, 0.35, 'outer-wall'), chapelLevel),
  onLevel(wallObject('chapel-wall-bottom-b', 31.8, 18.85, 6.2, 0.35, 'outer-wall'), chapelLevel),
]

const chapelObjects: readonly MapObjectDefinition[] = [
  onLevel(
    {
      id: 'ladder-chapel-to-tunnel',
      type: 'ladder',
      preset: 'wooden-ladder-down',
      position: { x: 29.2, y: 14.1 },
      width: 1,
      height: 1.35,
      transition: {
        targetLevelId: tunnelLevel,
        targetPosition: { x: 27.4, y: 14.8 },
        direction: 'down',
        label: 'In den Tunnel hinabgeklettert',
      },
    },
    chapelLevel,
  ),
  onLevel(
    { id: 'chapel-altar', type: 'altar', position: { x: 29.8, y: 8.8 }, width: 2.4, height: 1.5 },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-altar-candle-left',
      type: 'candle',
      preset: 'altar-candle',
      position: { x: 30.2, y: 9.1 },
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-altar-candle-mid-left',
      type: 'candle',
      preset: 'short-candle',
      position: { x: 30.75, y: 9.24 },
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-altar-candle-mid-right',
      type: 'candle',
      preset: 'short-candle',
      position: { x: 31.18, y: 9.24 },
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-altar-candle-right',
      type: 'candle',
      preset: 'altar-candle',
      position: { x: 31.68, y: 9.1 },
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-window-north',
      type: 'window',
      position: { x: 29.1, y: 7.5 },
      width: 1.4,
      height: 0.3,
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-window-east',
      type: 'window',
      position: { x: 37.55, y: 10.7 },
      width: 0.3,
      height: 1.5,
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-sunbeam-north',
      type: 'daylight-area',
      preset: 'open-sunlight',
      position: { x: 28.1, y: 8 },
      width: 4.1,
      height: 4.9,
      alpha: 0.16,
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-sunbeam-east',
      type: 'daylight-area',
      preset: 'open-sunlight',
      position: { x: 33.4, y: 10.2 },
      width: 4.1,
      height: 5.2,
      alpha: 0.13,
    },
    chapelLevel,
  ),
  onLevel(torch('torch-chapel-altar-left', { x: 27.1, y: 8.8 }, 'brass-wall-sconce'), chapelLevel),
  onLevel(torch('torch-chapel-altar-right', { x: 34.8, y: 8.8 }, 'brass-wall-sconce'), chapelLevel),
  onLevel(
    {
      id: 'chapel-bench-left',
      type: 'table',
      position: { x: 26.2, y: 13.2 },
      width: 2.4,
      height: 0.65,
    },
    chapelLevel,
  ),
  onLevel(
    {
      id: 'chapel-bench-right',
      type: 'table',
      position: { x: 33.2, y: 13.2 },
      width: 2.4,
      height: 0.65,
    },
    chapelLevel,
  ),
]

const tunnelWalls: readonly WallDefinition[] = [
  wallOnLevel(wallSegment('tunnel-under-north', 6.5, 13.4, 17, 13.4), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-under-south', 6.5, 16.6, 17, 16.6), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-under-west', 6.5, 13.4, 6.5, 16.6), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-path-north', 17, 14.1, 27, 14.1), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-path-south', 17, 16, 27, 16), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-pocket-top', 25.3, 12.4, 29.6, 12.4), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-pocket-right', 29.6, 12.4, 29.6, 17.4), tunnelLevel),
  wallOnLevel(wallSegment('tunnel-pocket-bottom', 25.3, 17.4, 29.6, 17.4), tunnelLevel),
]

const chapelWalls: readonly WallDefinition[] = [
  wallOnLevel(wallSegment('chapel-top-left', 24.5, 7.8, 28.9, 7.8), chapelLevel),
  wallOnLevel(wallSegment('chapel-top-right', 30.7, 7.8, 38, 7.8), chapelLevel),
  wallOnLevel(wallSegment('chapel-left', 24.5, 7.8, 24.5, 19), chapelLevel),
  wallOnLevel(wallSegment('chapel-right-upper', 38, 7.8, 38, 10.7), chapelLevel),
  wallOnLevel(wallSegment('chapel-right-lower', 38, 12.2, 38, 19), chapelLevel),
  wallOnLevel(wallSegment('chapel-bottom-left', 24.5, 19, 29.1, 19), chapelLevel),
  wallOnLevel(wallSegment('chapel-bottom-right', 31.8, 19, 38, 19), chapelLevel),
]

const props: readonly MapObjectDefinition[] = [
  ...mainTorches.objects!,
  torch('torch-corridor-left', { x: 12.3, y: 4.8 }, 'rusty-iron-torch', Math.PI / 2),
  torch('torch-corridor-right', { x: 13.9, y: 6.7 }, 'brass-wall-sconce', -Math.PI / 2),
  torch('torch-east-blue', { x: 22.8, y: 8.9 }, 'blue-crystal-torch'),
  torch('torch-south-left', { x: 5.4, y: 15.8 }, 'large-wall-torch'),
  ...storage.objects!,
  ...firePlace.objects!,
  ...cryptTransitionObjects,
  ...caveObjects,
  ...forestObjects,
  ...tunnelFloorObjects,
  ...tunnelWallObjects,
  ...tunnelObjects,
  ...chapelFloorObjects,
  ...chapelWallObjects,
  ...chapelObjects,
  { id: 'column-main-a', type: 'column', preset: 'round-stone', position: { x: 4.5, y: 4.2 } },
  { id: 'column-main-b', type: 'column', preset: 'round-stone', position: { x: 8.5, y: 4.2 } },
  { id: 'column-main-c', type: 'column', preset: 'round-stone', position: { x: 4.5, y: 7.3 } },
  { id: 'column-main-d', type: 'column', preset: 'round-stone', position: { x: 8.5, y: 7.3 } },
  { id: 'table-east', type: 'table', position: { x: 17.2, y: 4.4 }, width: 2.2, height: 1.1 },
  { id: 'chair-east-a', type: 'chair', position: { x: 17.2, y: 5.7 } },
  { id: 'chair-east-b', type: 'chair', position: { x: 18.9, y: 5.7 } },
  { id: 'rock-river-a', type: 'rock', position: { x: 22.5, y: 12.9 }, width: 0.8, height: 0.7 },
  { id: 'trap-south', type: 'trap', position: { x: 13.4, y: 14.2 }, width: 0.8, height: 0.8 },
  { id: 'lever-east', type: 'lever', position: { x: 23.7, y: 8.4 } },
]

const startTokens: readonly PlacedToken[] = [
  {
    id: 'token-start-hero',
    mapId: 'alte-krypta',
    levelId: cryptLevel,
    name: 'Held',
    position: { x: 5.2, y: 6.1 },
    size: 1,
    rotation: 0,
    visionRange: 8,
    visionAngle: null,
    visionEnabled: true,
    category: 'player',
    color: '#3f8cff',
    symbol: 'H',
  },
]

const extra = mergePrefabResults(mainTorches, cryptDoor, eastDoor, storage, firePlace)

export default defineMap({
  id: 'alte-krypta',
  name: 'Alte Krypta',
  width: 56,
  height: 30,
  gridSize: 48,
  defaultLevelId: cryptLevel,
  levels: [
    { id: cryptLevel, name: 'Krypta', order: 0 },
    { id: tunnelLevel, name: 'Untertunnel', order: -1 },
    { id: chapelLevel, name: 'Kapelle', order: 1 },
  ],
  objects: [...floorObjects, ...wallObjects, ...props, ...cryptDoor.objects!, ...eastDoor.objects!],
  walls: [
    ...(mainTorches.walls ?? []),
    wallSegment('main-left-wall', 2, 2, 2, 10),
    wallSegment('main-bottom-left', 2, 10, 8, 10),
    wallSegment('main-bottom-right', 10, 10, 12, 10),
    wallSegment('main-right-upper', 12, 2, 12, 5),
    wallSegment('main-right-lower', 12, 7, 12, 10),
    wallSegment('corridor-east-top', 12, 5, 15, 5),
    wallSegment('corridor-east-bottom', 12, 7, 15, 7),
    wallSegment('east-top', 15, 3, 25, 3),
    wallSegment('east-right-upper', 25, 3, 25, 6),
    wallSegment('east-right-lower', 25, 8, 25, 10),
    wallSegment('east-bottom', 15, 10, 25, 10),
    wallSegment('east-left-upper', 15, 3, 15, 5),
    wallSegment('east-left-lower', 15, 7, 15, 10),
    wallSegment('south-left', 5, 12, 5, 17),
    wallSegment('south-right', 17, 12, 17, 17),
    wallSegment('south-bottom', 5, 17, 17, 17),
    wallSegment('south-top-left', 5, 12, 8, 12),
    wallSegment('south-top-right', 10, 12, 17, 12),
    wallSegment('guard-top', 29, 12, 36, 12),
    wallSegment('guard-right', 36, 12, 36, 18),
    wallSegment('guard-bottom', 29, 18, 36, 18),
    wallSegment('guard-left-upper', 29, 12, 29, 13.2),
    wallSegment('guard-left-lower', 29, 15.2, 29, 18),
    wallSegment('cave-entry-top', 25, 5.5, 31, 5.5),
    wallSegment('cave-entry-bottom', 25, 8.5, 31, 8.5),
    wallSegment('cave-top', 31, 3, 39, 3),
    wallSegment('cave-left-upper', 31, 3, 31, 5.5),
    wallSegment('cave-left-lower', 31, 8.5, 31, 12),
    wallSegment('cave-bottom', 31, 12, 39, 12),
    wallSegment('cave-right-upper', 39, 3, 39, 6),
    wallSegment('cave-right-lower', 39, 10, 39, 12),
    wallSegment('cave-exit-top', 39, 6, 43, 6),
    wallSegment('cave-exit-bottom', 39, 10.3, 43, 10.3),
    ...tunnelWalls,
    ...chapelWalls,
  ],
  doors: [...(extra.doors ?? [])],
  spawnPoints: [],
  startTokens,
})
