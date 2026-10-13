import { defineMap } from './api'
import type { MapObjectDefinition } from '@/map-objects'
import type { WallDefinition } from './api'
import { floorArea } from './prefabs/common'

const mapId = 'kapitel-4-spinnenwald-ueberfall'

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

const tree = (id: string, preset: string, x: number, y: number): MapObjectDefinition => ({
  id,
  type: 'tree',
  preset,
  position: { x, y },
})

const bush = (id: string, preset: string, x: number, y: number): MapObjectDefinition => ({
  id,
  type: 'bush',
  preset,
  position: { x, y },
})

const thicket = (id: string, preset: string, x: number, y: number): MapObjectDefinition => ({
  id,
  type: 'thicket',
  preset,
  position: { x, y },
  blocksMovement: false,
})

const web = (
  id: string,
  preset: string,
  x: number,
  y: number,
  width: number,
  height: number,
  blocksMovement = false,
): MapObjectDefinition => ({
  id,
  type: 'spider-web',
  preset,
  position: { x, y },
  width,
  height,
  blocksMovement,
})

const groundObjects: readonly MapObjectDefinition[] = [
  floorArea('forest-floor-base', 0, 0, 40, 45, 'forest-floor', {
    color: 0x43583a,
    secondaryColor: 0x1b2113,
  }),
  floorArea('walkable-west-shoulder', 10.8, 0, 5.7, 45, 'meadow', {
    color: 0x526f43,
    secondaryColor: 0x213419,
    alpha: 0.3,
  }),
  floorArea('walkable-east-shoulder', 23.2, 0, 5.5, 45, 'meadow', {
    color: 0x526f43,
    secondaryColor: 0x213419,
    alpha: 0.3,
  }),
  floorArea('east-sunken-hollow-base', 25.2, 17.2, 11.9, 8.9, 'dark-earth', {
    color: 0x3d3428,
    secondaryColor: 0x17110d,
    alpha: 0.72,
    rotation: 0.03,
  }),
  floorArea('east-sunken-hollow-wet-center', 28.1, 19.4, 6.5, 4.4, 'marsh', {
    color: 0x394932,
    secondaryColor: 0x151c12,
    alpha: 0.58,
    rotation: -0.04,
  }),
  floorArea('west-root-shelf-ground', 3.1, 14.8, 10.7, 9.2, 'loose-gravel', {
    color: 0x636649,
    secondaryColor: 0x242518,
    alpha: 0.42,
    rotation: -0.04,
  }),
  floorArea('west-root-shelf-moss', 4.2, 16.0, 8.4, 6.4, 'mossy-stone', {
    color: 0x566440,
    secondaryColor: 0x182111,
    alpha: 0.38,
    rotation: 0.05,
  }),
]

const roadObjects: readonly MapObjectDefinition[] = [
  floorArea('trade-road-south-entry', 16.2, 33.1, 7.4, 11.9, 'dirt-path', {
    color: 0x7a5e3e,
    secondaryColor: 0x2d2116,
    alpha: 0.74,
  }),
  floorArea('trade-road-rear-bend', 16.0, 25.2, 7.2, 9.4, 'dirt-path', {
    color: 0x765a3a,
    secondaryColor: 0x2b2015,
    alpha: 0.72,
    rotation: -0.04,
  }),
  floorArea('trade-road-center-curve', 14.8, 16.7, 7.4, 9.8, 'dirt-path', {
    color: 0x725637,
    secondaryColor: 0x2a1f14,
    alpha: 0.74,
    rotation: -0.08,
  }),
  floorArea('trade-road-front-bend', 17.0, 8.2, 7.2, 10.0, 'dirt-path', {
    color: 0x735839,
    secondaryColor: 0x2a1f14,
    alpha: 0.72,
    rotation: 0.08,
  }),
  floorArea('trade-road-north-entry', 20.1, 0, 7.1, 9.5, 'dirt-path', {
    color: 0x795d3d,
    secondaryColor: 0x2d2116,
    alpha: 0.74,
  }),
  floorArea('mud-rut-south-west', 17.7, 34.0, 0.28, 9.2, 'packed-earth', {
    color: 0x55422f,
    secondaryColor: 0x20170f,
    alpha: 0.16,
  }),
  floorArea('mud-rut-south-east', 21.8, 34.1, 0.28, 9.0, 'packed-earth', {
    color: 0x55422f,
    secondaryColor: 0x20170f,
    alpha: 0.16,
  }),
  floorArea('mud-rut-center-west', 16.3, 17.8, 0.28, 8.0, 'packed-earth', {
    color: 0x523e2c,
    secondaryColor: 0x20170f,
    alpha: 0.16,
    rotation: -0.03,
  }),
  floorArea('mud-rut-center-east', 20.3, 17.3, 0.28, 8.3, 'packed-earth', {
    color: 0x523e2c,
    secondaryColor: 0x20170f,
    alpha: 0.16,
    rotation: -0.03,
  }),
  floorArea('mud-rut-north-west', 21.4, 1.0, 0.28, 8.2, 'packed-earth', {
    color: 0x55422f,
    secondaryColor: 0x20170f,
    alpha: 0.15,
  }),
  floorArea('mud-rut-north-east', 25.3, 1.1, 0.28, 8.1, 'packed-earth', {
    color: 0x55422f,
    secondaryColor: 0x20170f,
    alpha: 0.15,
  }),
]

const escapePathObjects: readonly MapObjectDefinition[] = [
  floorArea('escape-trail-west-north', 0, 9.9, 15.3, 1.8, 'dirt-path', {
    color: 0x664f35,
    secondaryColor: 0x271c12,
    alpha: 0.46,
    rotation: -0.12,
  }),
  floorArea('escape-trail-west-south', 0, 31.4, 16.4, 1.8, 'dirt-path', {
    color: 0x665035,
    secondaryColor: 0x271c12,
    alpha: 0.46,
    rotation: 0.09,
  }),
  floorArea('escape-trail-east-north', 24.2, 6.5, 15.8, 1.7, 'dirt-path', {
    color: 0x665035,
    secondaryColor: 0x271c12,
    alpha: 0.44,
    rotation: -0.1,
  }),
  floorArea('escape-trail-east-hollow', 24.3, 22.0, 15.7, 1.9, 'dirt-path', {
    color: 0x614a32,
    secondaryColor: 0x241a11,
    alpha: 0.46,
    rotation: 0.08,
  }),
  floorArea('escape-trail-west-root-shelf', 9.0, 18.9, 6.2, 1.5, 'dirt-path', {
    color: 0x604a32,
    secondaryColor: 0x241a11,
    alpha: 0.42,
    rotation: -0.08,
  }),
]

const elevationObjects: readonly MapObjectDefinition[] = [
  hillSlope('west-root-shelf-contours', 2.4, 14.0, 11.6, 10.3, 'rocky-north-rise', -0.04),
  hillSlope('west-root-shelf-south-contours', 3.1, 20.7, 10.0, 5.2, 'rocky-south-rise', 0.04),
  hillSlope('east-hollow-north-bank', 24.9, 16.2, 12.4, 4.0, 'grassy-south-rise', 0.03),
  hillSlope('east-hollow-south-bank', 24.9, 23.0, 12.3, 4.2, 'grassy-north-rise', -0.03),
]

const wagonObjects: readonly MapObjectDefinition[] = [
  {
    id: 'front-wagon-webbed',
    type: 'wagon',
    preset: 'loaded-farm-wagon-north',
    position: { x: 21.5, y: 9.0 },
    width: 2.5,
    height: 3.7,
    rotation: 0.08,
    blocksMovement: false,
  },
  {
    id: 'front-left-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-north',
    position: { x: 20.8, y: 6.5 },
  },
  {
    id: 'front-right-mule',
    type: 'draft-animal',
    preset: 'gray-draft-mule-north',
    position: { x: 22.4, y: 6.6 },
  },
  {
    id: 'front-cut-harness',
    type: 'harness',
    preset: 'cut-harness',
    position: { x: 21.0, y: 7.8 },
    width: 2.2,
    height: 1.7,
  },
  {
    id: 'middle-wagon-ambush-center',
    type: 'wagon',
    preset: 'loaded-farm-wagon-north',
    position: { x: 16.7, y: 21.0 },
    width: 2.6,
    height: 3.7,
    blocksMovement: false,
  },
  {
    id: 'middle-left-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-north',
    position: { x: 16.0, y: 18.5 },
  },
  {
    id: 'middle-right-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-north',
    position: { x: 17.6, y: 18.5 },
  },
  {
    id: 'middle-harness',
    type: 'harness',
    preset: 'intact-harness',
    position: { x: 16.2, y: 19.7 },
    width: 2.2,
    height: 1.8,
  },
  {
    id: 'rear-wagon-player-cover',
    type: 'wagon',
    preset: 'loaded-farm-wagon-north',
    position: { x: 17.2, y: 33.3 },
    width: 2.6,
    height: 3.7,
    blocksMovement: false,
  },
  {
    id: 'rear-left-mule',
    type: 'draft-animal',
    preset: 'gray-draft-mule-north',
    position: { x: 16.6, y: 30.9 },
  },
  {
    id: 'rear-right-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-north',
    position: { x: 18.2, y: 30.8 },
  },
  {
    id: 'rear-harness',
    type: 'harness',
    preset: 'intact-harness',
    position: { x: 16.8, y: 32.1 },
    width: 2.2,
    height: 1.8,
  },
]

const cargoObjects: readonly MapObjectDefinition[] = [
  { id: 'road-lost-wheel', type: 'wagon-wheel', position: { x: 19.8, y: 15.0 } },
  {
    id: 'road-small-barrel',
    type: 'barrel',
    preset: 'small-barrel',
    position: { x: 20.9, y: 15.7 },
  },
  { id: 'road-loose-crate', type: 'crate', preset: 'small-crate', position: { x: 17.8, y: 16.0 } },
  {
    id: 'road-fallen-sack-a',
    type: 'decoration',
    position: { x: 19.1, y: 17.2 },
    width: 0.9,
    height: 0.65,
    color: 0xb99a62,
    secondaryColor: 0x4d3822,
  },
  {
    id: 'road-fallen-sack-b',
    type: 'decoration',
    position: { x: 18.3, y: 25.6 },
    width: 0.85,
    height: 0.65,
    color: 0xb58a50,
    secondaryColor: 0x4d3822,
  },
  {
    id: 'rear-wagon-barrel',
    type: 'barrel',
    preset: 'small-barrel',
    position: { x: 20.4, y: 36.2 },
  },
  {
    id: 'middle-wagon-crate',
    type: 'crate',
    preset: 'small-crate',
    position: { x: 19.9, y: 23.0 },
  },
]

const webObjects: readonly MapObjectDefinition[] = [
  web('front-road-web-wall', 'road-snare', 19.0, 5.9, 7.5, 7.7, true),
  web('front-wagon-wheel-web', 'road-snare', 20.5, 10.3, 4.5, 4.1, true),
  web('center-road-web-strip', 'road-snare', 15.1, 17.0, 5.4, 3.2, true),
  web('west-tree-web-choke', 'road-snare', 10.9, 18.2, 3.3, 3.4, true),
  web('east-hollow-web-choke', 'road-snare', 25.6, 20.5, 3.2, 3.6, true),
  web('west-north-tree-web', 'tree-web', 8.1, 7.6, 3.1, 2.7),
  web('east-north-tree-web', 'tree-web', 29.4, 8.4, 3.2, 2.6),
  web('east-canopy-spider-perch', 'canopy-web', 30.8, 14.4, 4.5, 3.7),
  web('west-canopy-web', 'canopy-web', 5.5, 22.9, 3.7, 3.2),
  web('south-hanging-webs', 'hanging-strands', 12.4, 33.8, 2.9, 4.1),
  web('north-hanging-webs', 'hanging-strands', 27.5, 3.4, 2.6, 3.8),
]

const terrainPropObjects: readonly MapObjectDefinition[] = [
  {
    id: 'east-road-fallen-tree',
    type: 'fallen-log',
    preset: 'fallen-tree',
    position: { x: 25.8, y: 23.7 },
    width: 5.5,
    height: 1.2,
  },
  {
    id: 'west-raised-roots-a',
    type: 'fallen-log',
    preset: 'raised-roots',
    position: { x: 5.2, y: 17.4 },
    width: 3.2,
    height: 2.2,
  },
  {
    id: 'west-raised-roots-b',
    type: 'fallen-log',
    preset: 'raised-roots',
    position: { x: 8.5, y: 20.9 },
    width: 2.8,
    height: 2,
  },
  { id: 'stump-west-road-a', type: 'tree-stump', position: { x: 13.2, y: 27.7 } },
  { id: 'stump-east-hollow-a', type: 'tree-stump', position: { x: 30.0, y: 24.9 } },
  { id: 'stump-north-road-a', type: 'tree-stump', position: { x: 27.7, y: 10.6 } },
  { id: 'west-waystone-a', type: 'rock', preset: 'small-rock', position: { x: 13.2, y: 12.0 } },
  { id: 'west-waystone-b', type: 'rock', preset: 'small-rock', position: { x: 12.8, y: 14.1 } },
  { id: 'west-waystone-c', type: 'rock', preset: 'mossy-boulder', position: { x: 11.6, y: 16.1 } },
  { id: 'west-ledge-rock-a', type: 'rock', preset: 'large-boulder', position: { x: 5.7, y: 15.1 } },
  { id: 'west-ledge-rock-b', type: 'rock', preset: 'mossy-boulder', position: { x: 9.8, y: 22.8 } },
  {
    id: 'east-hollow-rock-a',
    type: 'rock',
    preset: 'mossy-boulder',
    position: { x: 34.2, y: 18.1 },
  },
  { id: 'east-hollow-rock-b', type: 'rock', preset: 'small-rock', position: { x: 27.2, y: 24.0 } },
  {
    id: 'webbed-forest-deer',
    type: 'forest-remains',
    preset: 'webbed-deer',
    position: { x: 31.6, y: 27.2 },
  },
  {
    id: 'scattered-bones-west',
    type: 'forest-remains',
    preset: 'scattered-bones',
    position: { x: 7.0, y: 11.8 },
  },
  {
    id: 'scattered-bones-east',
    type: 'forest-remains',
    preset: 'scattered-bones',
    position: { x: 32.6, y: 11.8 },
  },
]

const treePlacements = [
  ['west-edge-01', 'old-oak', 0.7, 1.0],
  ['west-edge-02', 'pine-tree', 3.1, 3.6],
  ['west-edge-03', 'birch-tree', 1.2, 6.9],
  ['west-edge-04', 'pine-tree', 4.8, 8.2],
  ['west-edge-05', 'old-oak', 1.6, 13.5],
  ['west-edge-06', 'autumn-maple', 4.1, 15.6],
  ['west-edge-07', 'pine-tree', 0.9, 19.3],
  ['west-edge-08', 'old-oak', 3.8, 25.8],
  ['west-edge-09', 'birch-tree', 1.0, 29.2],
  ['west-edge-10', 'pine-tree', 5.2, 35.3],
  ['west-edge-11', 'old-oak', 1.6, 39.5],
  ['west-edge-12', 'pine-tree', 4.1, 42.6],
  ['east-edge-01', 'pine-tree', 36.8, 1.4],
  ['east-edge-02', 'old-oak', 33.9, 4.7],
  ['east-edge-03', 'birch-tree', 38.0, 8.8],
  ['east-edge-04', 'pine-tree', 34.6, 12.1],
  ['east-edge-05', 'old-oak', 37.4, 16.8],
  ['east-edge-06', 'autumn-maple', 34.8, 20.9],
  ['east-edge-07', 'pine-tree', 37.8, 24.7],
  ['east-edge-08', 'old-oak', 34.7, 29.5],
  ['east-edge-09', 'birch-tree', 37.6, 34.4],
  ['east-edge-10', 'pine-tree', 34.6, 38.4],
  ['east-edge-11', 'old-oak', 37.8, 42.3],
  ['north-road-left-01', 'old-oak', 14.4, 1.2],
  ['north-road-left-02', 'pine-tree', 16.4, 5.0],
  ['north-road-right-01', 'birch-tree', 28.8, 2.3],
  ['north-road-right-02', 'pine-tree', 30.6, 6.1],
  ['center-west-01', 'old-oak', 12.0, 7.8],
  ['center-west-02', 'pine-tree', 10.2, 12.3],
  ['center-west-03', 'birch-tree', 12.2, 21.1],
  ['center-west-04', 'autumn-maple', 11.1, 25.4],
  ['center-west-05', 'pine-tree', 13.0, 30.8],
  ['center-east-01', 'old-oak', 27.8, 8.9],
  ['center-east-02', 'pine-tree', 29.8, 13.1],
  ['center-east-03', 'birch-tree', 28.7, 17.1],
  ['center-east-04', 'pine-tree', 29.0, 26.6],
  ['center-east-05', 'old-oak', 27.8, 31.3],
  ['south-road-left-01', 'old-oak', 12.2, 34.0],
  ['south-road-left-02', 'birch-tree', 14.0, 39.0],
  ['south-road-right-01', 'pine-tree', 24.2, 34.8],
  ['south-road-right-02', 'old-oak', 26.2, 40.0],
] as const

const natureObjects: readonly MapObjectDefinition[] = treePlacements.map(([id, preset, x, y]) =>
  tree(`tree-${id}`, preset, x, y),
)

const bushPlacements = [
  ['west-north-01', 'leafy-bush', 6.6, 5.6],
  ['west-north-02', 'thorn-bush', 9.2, 8.9],
  ['west-trail-01', 'berry-bush', 5.4, 10.9],
  ['west-center-01', 'leafy-bush', 12.8, 18.6],
  ['west-root-01', 'thorn-bush', 6.5, 20.7],
  ['west-south-01', 'berry-bush', 8.0, 29.5],
  ['west-south-02', 'leafy-bush', 12.6, 32.7],
  ['east-north-01', 'thorn-bush', 29.0, 5.4],
  ['east-north-02', 'leafy-bush', 33.4, 7.8],
  ['east-center-01', 'berry-bush', 25.3, 14.6],
  ['east-hollow-01', 'thorn-bush', 28.2, 18.0],
  ['east-hollow-02', 'leafy-bush', 33.0, 23.5],
  ['east-south-01', 'berry-bush', 28.5, 31.2],
  ['east-south-02', 'thorn-bush', 31.4, 35.5],
  ['rear-camp-01', 'leafy-bush', 14.0, 36.1],
  ['rear-camp-02', 'berry-bush', 23.2, 37.3],
] as const

const undergrowthObjects: readonly MapObjectDefinition[] = [
  ...bushPlacements.map(([id, preset, x, y]) => bush(`bush-${id}`, preset, x, y)),
  thicket('thicket-west-north-edge', 'dense-bramble', 6.7, 2.0),
  thicket('thicket-west-north-trail-mouth', 'dry-scrub', 10.7, 10.6),
  thicket('thicket-west-root-bank', 'dense-bramble', 4.4, 18.8),
  thicket('thicket-west-south-trail-mouth', 'dry-scrub', 10.4, 31.1),
  thicket('thicket-west-south-edge', 'dense-bramble', 7.1, 38.4),
  thicket('thicket-east-north-trail-mouth', 'dry-scrub', 29.9, 7.0),
  thicket('thicket-east-north-edge', 'dense-bramble', 32.4, 2.8),
  thicket('thicket-east-hollow-lip', 'dense-bramble', 25.6, 18.5),
  thicket('thicket-east-hollow-bottom', 'dry-scrub', 31.0, 25.2),
  thicket('thicket-east-south-trail-mouth', 'dry-scrub', 29.4, 31.3),
  thicket('thicket-east-south-edge', 'dense-bramble', 33.2, 40.5),
]

const lightObjects: readonly MapObjectDefinition[] = [
  {
    id: 'forest-filtered-daylight',
    type: 'daylight-area',
    preset: 'forest-daylight',
    position: { x: 0, y: 0 },
    width: 40,
    height: 45,
    alpha: 0.08,
  },
  {
    id: 'road-open-daylight',
    type: 'daylight-area',
    preset: 'open-sunlight',
    position: { x: 13.7, y: 4.5 },
    width: 14.8,
    height: 35.6,
    alpha: 0.07,
  },
]

export default defineMap({
  id: mapId,
  name: '4. Kapitel Spinnenwald-Ueberfall',
  width: 40,
  height: 45,
  gridSize: 48,
  objects: [
    ...groundObjects,
    ...roadObjects,
    ...escapePathObjects,
    ...elevationObjects,
    ...lightObjects,
    ...natureObjects,
    ...undergrowthObjects,
    ...terrainPropObjects,
    ...wagonObjects,
    ...cargoObjects,
    ...webObjects,
  ],
  walls: [
    movementBlocker('front-web-road-blocker', 18.8, 9.4, 26.8, 9.4),
    movementBlocker('center-web-road-blocker', 14.8, 18.8, 21.0, 18.8),
    movementBlocker('east-fallen-tree-blocker', 25.8, 24.2, 31.3, 24.2),
  ],
  doors: [],
  spawnPoints: [],
  startTokens: [],
})
