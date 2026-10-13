import { defineMap } from './api'
import type { MapObjectDefinition } from '@/map-objects'
import type { PlacedToken } from '@/types/tokens'
import type { WallDefinition } from './api'
import { floorArea } from './prefabs/common'

const mapId = 'kapitel-3-barikarde'

const movementBlocker = (
  id: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): WallDefinition => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  blocksSight: false,
  blocksMovement: true,
})

const hillSlope = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  preset: string,
  rotation = 0,
): MapObjectDefinition => ({
  id,
  type: 'hill-slope',
  preset,
  position: { x, y },
  width,
  height,
  rotation,
})

const groundObjects: readonly MapObjectDefinition[] = [
  floorArea('hill-base-meadow', 0, 0, 36, 22, 'meadow', {
    color: 0x6d914b,
    secondaryColor: 0x243918,
  }),
  floorArea('north-west-hill-grass', 0.1, 0.5, 18.2, 9.0, 'meadow', {
    color: 0x607c3f,
    secondaryColor: 0x243719,
    alpha: 0.32,
    rotation: -0.04,
  }),
  floorArea('north-west-forest-edge', 0.4, 1.0, 8.7, 5.8, 'forest-floor', {
    color: 0x4f6538,
    secondaryColor: 0x1d2512,
    alpha: 0.24,
    rotation: -0.08,
  }),
  floorArea('north-center-grass-rise', 8.8, 0.8, 12.0, 6.7, 'meadow', {
    color: 0x668743,
    secondaryColor: 0x243a17,
    alpha: 0.3,
    rotation: 0.05,
  }),
  floorArea('north-east-hill-grass', 18.7, 0.5, 17.0, 8.8, 'meadow', {
    color: 0x638342,
    secondaryColor: 0x233718,
    alpha: 0.3,
    rotation: 0.03,
  }),
  floorArea('north-east-forest-edge', 24.2, 1.0, 9.4, 6.0, 'forest-floor', {
    color: 0x4a6137,
    secondaryColor: 0x1b2412,
    alpha: 0.2,
    rotation: 0.07,
  }),
  floorArea('south-west-hill-grass', 0.2, 12.8, 16.1, 8.5, 'meadow', {
    color: 0x5f7c3e,
    secondaryColor: 0x243719,
    alpha: 0.3,
    rotation: 0.04,
  }),
  floorArea('south-center-stony-grass', 9.6, 14.2, 12.2, 6.2, 'loose-gravel', {
    color: 0x6a6f4f,
    secondaryColor: 0x252719,
    alpha: 0.2,
    rotation: -0.05,
  }),
  floorArea('south-east-hill-grass', 19.1, 12.7, 16.5, 8.6, 'meadow', {
    color: 0x5e7d40,
    secondaryColor: 0x223718,
    alpha: 0.3,
    rotation: -0.04,
  }),
  floorArea('south-east-forest-edge', 25.0, 14.7, 8.7, 5.5, 'forest-floor', {
    color: 0x485f36,
    secondaryColor: 0x1b2412,
    alpha: 0.2,
    rotation: -0.08,
  }),
  floorArea('barrier-trampled-mud', 14.5, 8.0, 6.6, 6.1, 'packed-earth', {
    color: 0x665238,
    secondaryColor: 0x251a10,
    alpha: 0.34,
    rotation: 0.02,
  }),
]

const hillSlopeObjects: readonly MapObjectDefinition[] = [
  hillSlope('north-west-slope-contours', 0.0, 0.6, 18.8, 9.7, 'grassy-north-rise', -0.05),
  hillSlope('north-east-slope-contours', 17.5, 0.5, 18.2, 9.6, 'grassy-north-rise', 0.05),
  hillSlope('south-west-slope-contours', 0.0, 11.2, 18.6, 10.0, 'grassy-south-rise', 0.04),
  hillSlope('south-east-slope-contours', 17.7, 11.0, 18.0, 10.2, 'grassy-south-rise', -0.04),
]

const pathObjects: readonly MapObjectDefinition[] = [
  floorArea('trail-west-entry', 0, 9.55, 8.4, 2.1, 'dirt-path', {
    color: 0x725839,
    secondaryColor: 0x2b2015,
    alpha: 0.58,
  }),
  floorArea('trail-west-bend', 6.7, 9.5, 7.4, 2.1, 'dirt-path', {
    color: 0x705535,
    secondaryColor: 0x2a1f14,
    alpha: 0.56,
    rotation: -0.05,
  }),
  floorArea('trail-center-before-barricade', 12.0, 9.52, 6.5, 2.1, 'dirt-path', {
    color: 0x6e5233,
    secondaryColor: 0x2a1e13,
    alpha: 0.6,
  }),
  floorArea('trail-center-after-barricade', 17.6, 9.65, 7.4, 2.1, 'dirt-path', {
    color: 0x6f5435,
    secondaryColor: 0x2a1f14,
    alpha: 0.6,
  }),
  floorArea('trail-east-bend', 23.4, 9.8, 7.0, 2.1, 'dirt-path', {
    color: 0x725839,
    secondaryColor: 0x2b2015,
    alpha: 0.56,
    rotation: 0.05,
  }),
  floorArea('trail-east-exit', 28.8, 10.0, 7.2, 2.1, 'dirt-path', {
    color: 0x745a3a,
    secondaryColor: 0x2b2015,
    alpha: 0.58,
  }),
  floorArea('trail-rutted-west', 3.3, 10.05, 9.4, 0.28, 'packed-earth', {
    color: 0x5b442e,
    secondaryColor: 0x22170f,
    alpha: 0.13,
  }),
  floorArea('trail-rutted-west-south', 3.4, 10.95, 9.2, 0.28, 'packed-earth', {
    color: 0x5b442e,
    secondaryColor: 0x22170f,
    alpha: 0.12,
  }),
  floorArea('trail-rutted-east', 21.7, 10.25, 10.4, 0.28, 'packed-earth', {
    color: 0x5b442e,
    secondaryColor: 0x22170f,
    alpha: 0.12,
  }),
  floorArea('trail-rutted-east-south', 21.6, 11.15, 10.5, 0.28, 'packed-earth', {
    color: 0x5b442e,
    secondaryColor: 0x22170f,
    alpha: 0.12,
  }),
]

const vehicleObjects: readonly MapObjectDefinition[] = [
  {
    id: 'front-of-barricade-wagon',
    type: 'wagon',
    preset: 'loaded-farm-wagon-east',
    position: { x: 5.85, y: 9.82 },
    width: 3,
    height: 2,
  },
  {
    id: 'front-of-barricade-draft-ox',
    type: 'draft-animal',
    preset: 'brown-draft-ox-east',
    position: { x: 8.3, y: 10.3 },
    width: 1.35,
    height: 1,
  },
  {
    id: 'behind-barricade-draft-ox',
    type: 'draft-animal',
    preset: 'brown-draft-ox-east',
    position: { x: 31.5, y: 10.7 },
    width: 1.35,
    height: 1,
  },
  {
    id: 'behind-barricade-wagon',
    type: 'wagon',
    preset: 'loaded-farm-wagon-east',
    position: { x: 29, y: 10.2 },
    width: 3,
    height: 2,
  },
]

const barricadeObjects: readonly MapObjectDefinition[] = [
  {
    id: 'road-barricade-main',
    type: 'wooden-barricade',
    preset: 'spiked-road-barricade',
    position: { x: 16.55, y: 7.35 },
    width: 1.95,
    height: 6.25,
    rotation: -0.04,
  },
  {
    id: 'road-barricade-left-rock',
    type: 'rock',
    preset: 'mossy-boulder',
    position: { x: 15.3, y: 7.15 },
  },
  {
    id: 'road-barricade-right-rock',
    type: 'rock',
    preset: 'large-boulder',
    position: { x: 18.25, y: 12.35 },
  },
  {
    id: 'road-barricade-top-rock',
    type: 'rock',
    preset: 'small-rock',
    position: { x: 18.2, y: 7.65 },
  },
  {
    id: 'road-barricade-bottom-rock',
    type: 'rock',
    preset: 'small-rock',
    position: { x: 15.45, y: 13.05 },
  },
  {
    id: 'road-barricade-warning-post',
    type: 'decoration',
    position: { x: 15.45, y: 12.15 },
    width: 0.65,
    height: 0.95,
    color: 0x8a5a39,
    secondaryColor: 0x2a170d,
  },
  {
    id: 'road-barricade-supply-crate',
    type: 'crate',
    preset: 'small-crate',
    position: { x: 15.25, y: 8.45 },
  },
]

const natureObjects: readonly MapObjectDefinition[] = [
  { id: 'tree-north-west-a', type: 'tree', preset: 'old-oak', position: { x: 1.8, y: 1.8 } },
  { id: 'tree-north-west-b', type: 'tree', preset: 'pine-tree', position: { x: 6.4, y: 2.6 } },
  { id: 'tree-north-east-a', type: 'tree', preset: 'pine-tree', position: { x: 26.7, y: 1.5 } },
  { id: 'tree-north-east-b', type: 'tree', preset: 'old-oak', position: { x: 31.2, y: 4.2 } },
  { id: 'tree-south-west-a', type: 'tree', preset: 'dead-tree', position: { x: 4.2, y: 17.3 } },
  { id: 'tree-south-east-a', type: 'tree', preset: 'old-oak', position: { x: 28.5, y: 16.4 } },
  { id: 'tree-south-east-b', type: 'tree', preset: 'pine-tree', position: { x: 33.2, y: 18 } },
  { id: 'tree-forest-north-01', type: 'tree', preset: 'birch-tree', position: { x: 0.6, y: 3.1 } },
  { id: 'tree-forest-north-02', type: 'tree', preset: 'old-oak', position: { x: 2.8, y: 0.7 } },
  {
    id: 'tree-forest-north-03',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 4.6, y: 4.8 },
  },
  { id: 'tree-forest-north-04', type: 'tree', preset: 'pine-tree', position: { x: 7.4, y: 1.0 } },
  { id: 'tree-forest-north-05', type: 'tree', preset: 'birch-tree', position: { x: 8.9, y: 4.0 } },
  { id: 'tree-forest-north-06', type: 'tree', preset: 'old-oak', position: { x: 11.0, y: 0.9 } },
  { id: 'tree-forest-north-07', type: 'tree', preset: 'pine-tree', position: { x: 13.5, y: 2.2 } },
  {
    id: 'tree-forest-north-08',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 15.6, y: 5.6 },
  },
  { id: 'tree-forest-north-09', type: 'tree', preset: 'birch-tree', position: { x: 17.1, y: 1.3 } },
  { id: 'tree-forest-north-10', type: 'tree', preset: 'old-oak', position: { x: 19.3, y: 3.4 } },
  { id: 'tree-forest-north-11', type: 'tree', preset: 'pine-tree', position: { x: 22.0, y: 0.8 } },
  { id: 'tree-forest-north-12', type: 'tree', preset: 'birch-tree', position: { x: 24.0, y: 4.8 } },
  {
    id: 'tree-forest-north-13',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 27.6, y: 2.8 },
  },
  { id: 'tree-forest-north-14', type: 'tree', preset: 'pine-tree', position: { x: 29.5, y: 0.7 } },
  { id: 'tree-forest-north-15', type: 'tree', preset: 'old-oak', position: { x: 33.1, y: 2.3 } },
  { id: 'tree-forest-north-16', type: 'tree', preset: 'birch-tree', position: { x: 34.0, y: 5.8 } },
  { id: 'tree-forest-south-01', type: 'tree', preset: 'dead-tree', position: { x: 1.0, y: 15.3 } },
  { id: 'tree-forest-south-02', type: 'tree', preset: 'old-oak', position: { x: 2.8, y: 19.2 } },
  { id: 'tree-forest-south-03', type: 'tree', preset: 'birch-tree', position: { x: 5.6, y: 14.2 } },
  { id: 'tree-forest-south-04', type: 'tree', preset: 'pine-tree', position: { x: 7.9, y: 18.5 } },
  {
    id: 'tree-forest-south-05',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 10.8, y: 15.4 },
  },
  {
    id: 'tree-forest-south-06',
    type: 'tree',
    preset: 'birch-tree',
    position: { x: 12.8, y: 19.1 },
  },
  { id: 'tree-forest-south-07', type: 'tree', preset: 'old-oak', position: { x: 15.0, y: 16.3 } },
  { id: 'tree-forest-south-08', type: 'tree', preset: 'pine-tree', position: { x: 17.4, y: 19.4 } },
  {
    id: 'tree-forest-south-09',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 20.0, y: 17.8 },
  },
  {
    id: 'tree-forest-south-10',
    type: 'tree',
    preset: 'birch-tree',
    position: { x: 22.3, y: 14.1 },
  },
  { id: 'tree-forest-south-11', type: 'tree', preset: 'old-oak', position: { x: 24.5, y: 19.2 } },
  { id: 'tree-forest-south-12', type: 'tree', preset: 'pine-tree', position: { x: 27.6, y: 18.8 } },
  {
    id: 'tree-forest-south-13',
    type: 'tree',
    preset: 'autumn-maple',
    position: { x: 30.0, y: 15.3 },
  },
  {
    id: 'tree-forest-south-14',
    type: 'tree',
    preset: 'birch-tree',
    position: { x: 32.4, y: 19.0 },
  },
  { id: 'hill-rock-north-a', type: 'rock', preset: 'small-rock', position: { x: 12.4, y: 4.5 } },
  { id: 'hill-rock-north-b', type: 'rock', preset: 'mossy-boulder', position: { x: 20.4, y: 5.4 } },
  { id: 'hill-rock-south-a', type: 'rock', preset: 'small-rock', position: { x: 10.2, y: 17.5 } },
  {
    id: 'hill-rock-south-b',
    type: 'rock',
    preset: 'mossy-boulder',
    position: { x: 21.4, y: 16.2 },
  },
  { id: 'hill-rock-east-a', type: 'rock', preset: 'large-boulder', position: { x: 32.1, y: 8 } },
  { id: 'hill-rock-west-a', type: 'rock', preset: 'small-rock', position: { x: 2.8, y: 13.4 } },
]

const undergrowthObjects: readonly MapObjectDefinition[] = [
  { id: 'bush-north-west-01', type: 'bush', preset: 'leafy-bush', position: { x: 1.1, y: 5.4 } },
  { id: 'bush-north-west-02', type: 'bush', preset: 'thorn-bush', position: { x: 3.7, y: 3.6 } },
  { id: 'bush-north-west-03', type: 'bush', preset: 'berry-bush', position: { x: 6.1, y: 5.9 } },
  { id: 'bush-north-01', type: 'bush', preset: 'leafy-bush', position: { x: 10.4, y: 5.5 } },
  { id: 'bush-north-02', type: 'bush', preset: 'thorn-bush', position: { x: 18.2, y: 5.6 } },
  { id: 'bush-north-east-01', type: 'bush', preset: 'berry-bush', position: { x: 25.8, y: 6.1 } },
  { id: 'bush-north-east-02', type: 'bush', preset: 'leafy-bush', position: { x: 31.2, y: 6.5 } },
  {
    id: 'bush-barricade-west-01',
    type: 'bush',
    preset: 'thorn-bush',
    position: { x: 14.0, y: 7.0 },
  },
  {
    id: 'bush-barricade-east-01',
    type: 'bush',
    preset: 'leafy-bush',
    position: { x: 20.3, y: 13.2 },
  },
  { id: 'bush-south-west-01', type: 'bush', preset: 'leafy-bush', position: { x: 3.4, y: 15.0 } },
  { id: 'bush-south-west-02', type: 'bush', preset: 'berry-bush', position: { x: 8.6, y: 16.1 } },
  { id: 'bush-south-01', type: 'bush', preset: 'thorn-bush', position: { x: 14.3, y: 18.0 } },
  { id: 'bush-south-02', type: 'bush', preset: 'leafy-bush', position: { x: 23.0, y: 16.2 } },
  { id: 'bush-south-east-01', type: 'bush', preset: 'berry-bush', position: { x: 29.6, y: 17.2 } },
  {
    id: 'thicket-north-west-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 0.7, y: 6.4 },
  },
  {
    id: 'thicket-north-west-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 8.0, y: 6.2 },
  },
  {
    id: 'thicket-north-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 14.2, y: 6.7 },
  },
  {
    id: 'thicket-north-east-01',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 24.6, y: 6.6 },
  },
  {
    id: 'thicket-north-east-02',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 33.2, y: 7.4 },
  },
  {
    id: 'thicket-south-west-01',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 0.9, y: 13.3 },
  },
  {
    id: 'thicket-south-west-02',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 6.7, y: 13.9 },
  },
  {
    id: 'thicket-south-01',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 16.1, y: 14.5 },
  },
  {
    id: 'thicket-south-east-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 26.8, y: 13.4 },
  },
  {
    id: 'thicket-south-east-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 33.1, y: 13.4 },
  },
]

const lightObjects: readonly MapObjectDefinition[] = [
  {
    id: 'open-hill-daylight',
    type: 'daylight-area',
    preset: 'open-sunlight',
    position: { x: 0, y: 0 },
    width: 36,
    height: 22,
    alpha: 0.06,
  },
]

const startTokens: readonly PlacedToken[] = [
  {
    id: 'token-chapter-3-hero',
    mapId,
    name: 'Held',
    position: { x: 5.5, y: 10.4 },
    size: 1,
    rotation: 0,
    visionRange: 9,
    visionAngle: null,
    visionEnabled: true,
    category: 'player',
    color: '#3f8cff',
    symbol: 'H',
  },
]

export default defineMap({
  id: mapId,
  name: '3. Kapitel Barikarde',
  width: 36,
  height: 22,
  gridSize: 48,
  objects: [
    ...groundObjects,
    ...pathObjects,
    ...hillSlopeObjects,
    ...lightObjects,
    ...natureObjects,
    ...undergrowthObjects,
    ...vehicleObjects,
    ...barricadeObjects,
  ],
  walls: [movementBlocker('road-barricade-blocker', 17.55, 7.4, 17.55, 13.75)],
  doors: [],
  spawnPoints: [],
  startTokens,
})
