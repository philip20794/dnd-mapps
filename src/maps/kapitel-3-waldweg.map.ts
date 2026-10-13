import { defineMap } from './api'
import type { MapObjectDefinition } from '@/map-objects'
import type { PlacedToken } from '@/types/tokens'
import type { WallDefinition } from './api'
import { floorArea } from './prefabs/common'

const mapId = 'kapitel-3-waldweg'

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
  floorArea('trail-meadow-base', 0, 0, 40, 24, 'meadow', {
    color: 0x6e9250,
    secondaryColor: 0x253a18,
  }),
  floorArea('north-forest-floor', 0.3, 0.3, 39.2, 6.2, 'forest-floor', {
    color: 0x4a5d38,
    secondaryColor: 0x1c2312,
    alpha: 0.28,
    rotation: -0.02,
  }),
  floorArea('south-forest-floor', 0.4, 18.1, 38.9, 5.6, 'forest-floor', {
    color: 0x475a35,
    secondaryColor: 0x1b2212,
    alpha: 0.3,
    rotation: 0.03,
  }),
  floorArea('north-west-hill-grass', 1.0, 1.0, 13.8, 6.8, 'meadow', {
    color: 0x607d41,
    secondaryColor: 0x253719,
    alpha: 0.36,
    rotation: -0.06,
  }),
  floorArea('north-east-hill-grass', 26.6, 2.0, 12.5, 6.4, 'meadow', {
    color: 0x618243,
    secondaryColor: 0x243719,
    alpha: 0.34,
    rotation: 0.05,
  }),
  floorArea('south-east-hill-grass', 26.0, 16.7, 12.7, 6.3, 'meadow', {
    color: 0x5f7f42,
    secondaryColor: 0x243719,
    alpha: 0.34,
    rotation: -0.04,
  }),
  floorArea('south-west-low-rise', 1.0, 17.3, 12.6, 5.8, 'meadow', {
    color: 0x5f7a40,
    secondaryColor: 0x243719,
    alpha: 0.26,
    rotation: 0.04,
  }),
  floorArea('river-north-marsh-bank', 0, 13.35, 40, 1.4, 'marsh', {
    color: 0x59633e,
    secondaryColor: 0x172112,
    alpha: 0.5,
    rotation: -0.02,
  }),
  floorArea('river-south-marsh-bank', 0, 17.1, 40, 1.6, 'marsh', {
    color: 0x56613e,
    secondaryColor: 0x172112,
    alpha: 0.5,
    rotation: 0.02,
  }),
  floorArea('bridge-muddy-north-approach', 18.8, 11.8, 5.1, 2.1, 'packed-earth', {
    color: 0x675037,
    secondaryColor: 0x271a10,
    alpha: 0.42,
    rotation: 0.08,
  }),
  floorArea('bridge-muddy-south-approach', 22.0, 17.0, 5.3, 2.0, 'packed-earth', {
    color: 0x675037,
    secondaryColor: 0x271a10,
    alpha: 0.42,
    rotation: -0.08,
  }),
]

const riverObjects: readonly MapObjectDefinition[] = [
  {
    id: 'woodland-river',
    type: 'river',
    preset: 'slow-river',
    position: { x: 0, y: 14.65 },
    width: 40,
    height: 2.55,
    rotation: -0.015,
  },
  {
    id: 'river-ground-fog',
    type: 'fog',
    preset: 'ground-fog',
    position: { x: 0.2, y: 13.6 },
    width: 39.4,
    height: 4.8,
    alpha: 0.12,
  },
  {
    id: 'river-bridge',
    type: 'bridge',
    preset: 'old-forest-bridge',
    position: { x: 20.7, y: 12.8 },
    width: 3.8,
    height: 5.2,
  },
  {
    id: 'shallow-water-under-bridge',
    type: 'water',
    preset: 'standing-water',
    position: { x: 21.2, y: 15.05 },
    width: 2.8,
    height: 1.6,
    alpha: 0.42,
  },
]

const hillSlopeObjects: readonly MapObjectDefinition[] = [
  hillSlope('north-west-slope-contours', 0.4, 0.6, 14.8, 7.4, 'grassy-north-rise', -0.07),
  hillSlope('north-east-slope-contours', 25.7, 1.6, 13.6, 7.2, 'grassy-north-rise', 0.05),
  hillSlope('south-west-slope-contours', 0.4, 16.7, 13.8, 6.8, 'grassy-south-rise', 0.04),
  hillSlope('south-east-slope-contours', 25.5, 16.2, 13.8, 7.1, 'grassy-south-rise', -0.05),
]

const pathObjects: readonly MapObjectDefinition[] = [
  floorArea('trail-west-entry', 0, 9.95, 8.7, 2.1, 'dirt-path', {
    color: 0x75593a,
    secondaryColor: 0x2b2015,
    alpha: 0.6,
  }),
  floorArea('trail-west-bend', 7.0, 10.25, 7.5, 2.1, 'dirt-path', {
    color: 0x725637,
    secondaryColor: 0x2a1f14,
    alpha: 0.58,
    rotation: 0.05,
  }),
  floorArea('trail-north-approach', 13.2, 11.0, 7.1, 2.1, 'dirt-path', {
    color: 0x705435,
    secondaryColor: 0x2a1f14,
    alpha: 0.6,
    rotation: 0.09,
  }),
  floorArea('trail-bridge-track', 21.35, 12.6, 2.6, 5.5, 'dirt-path', {
    color: 0x6f5435,
    secondaryColor: 0x281d12,
    alpha: 0.48,
  }),
  floorArea('trail-south-bridge-exit', 22.4, 17.15, 6.2, 2.1, 'dirt-path', {
    color: 0x725637,
    secondaryColor: 0x2a1f14,
    alpha: 0.6,
    rotation: -0.06,
  }),
  floorArea('trail-east-bend', 27.5, 16.35, 7.5, 2.1, 'dirt-path', {
    color: 0x735839,
    secondaryColor: 0x2a1f14,
    alpha: 0.58,
    rotation: -0.06,
  }),
  floorArea('trail-east-exit', 33.4, 15.85, 6.6, 2.1, 'dirt-path', {
    color: 0x765b3c,
    secondaryColor: 0x2b2015,
    alpha: 0.6,
  }),
  floorArea('trail-rut-west-north', 2.4, 10.5, 12.3, 0.26, 'packed-earth', {
    color: 0x5a432e,
    secondaryColor: 0x22170f,
    alpha: 0.13,
    rotation: 0.03,
  }),
  floorArea('trail-rut-west-south', 2.3, 11.35, 12.5, 0.26, 'packed-earth', {
    color: 0x5a432e,
    secondaryColor: 0x22170f,
    alpha: 0.12,
    rotation: 0.03,
  }),
  floorArea('trail-rut-east-north', 27.8, 16.8, 9.2, 0.26, 'packed-earth', {
    color: 0x5a432e,
    secondaryColor: 0x22170f,
    alpha: 0.13,
    rotation: -0.04,
  }),
  floorArea('trail-rut-east-south', 27.7, 17.65, 9.4, 0.26, 'packed-earth', {
    color: 0x5a432e,
    secondaryColor: 0x22170f,
    alpha: 0.12,
    rotation: -0.04,
  }),
]

const wagonObjects: readonly MapObjectDefinition[] = [
  {
    id: 'west-road-wagon',
    type: 'wagon',
    preset: 'loaded-farm-wagon-east',
    position: { x: 8.9, y: 10.35 },
    width: 3.1,
    height: 1.9,
    rotation: 0.03,
  },
  {
    id: 'west-road-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-east',
    position: { x: 11.75, y: 10.8 },
    width: 1.45,
    height: 1,
    rotation: 0.03,
  },
  {
    id: 'east-road-wagon',
    type: 'wagon',
    preset: 'loaded-farm-wagon-west',
    position: { x: 31.2, y: 16.0 },
    width: 3,
    height: 1.9,
    rotation: -0.04,
  },
  {
    id: 'east-road-horse',
    type: 'draft-animal',
    preset: 'brown-draft-horse-west',
    position: { x: 29.9, y: 16.45 },
    width: 1.45,
    height: 1,
    rotation: -0.04,
  },
  {
    id: 'pack-horse-by-bank',
    type: 'draft-animal',
    preset: 'brown-draft-horse-west',
    position: { x: 18.35, y: 12.15 },
    width: 1.3,
    height: 0.95,
  },
  {
    id: 'bank-supply-crate',
    type: 'crate',
    preset: 'small-crate',
    position: { x: 18.2, y: 13.2 },
  },
  {
    id: 'bank-small-barrel',
    type: 'barrel',
    preset: 'small-barrel',
    position: { x: 19.1, y: 13.45 },
  },
]

const natureObjects: readonly MapObjectDefinition[] = [
  { id: 'tree-north-01', type: 'tree', preset: 'old-oak', position: { x: 0.8, y: 1.1 } },
  { id: 'tree-north-02', type: 'tree', preset: 'pine-tree', position: { x: 3.2, y: 4.0 } },
  { id: 'tree-north-03', type: 'tree', preset: 'birch-tree', position: { x: 5.6, y: 1.7 } },
  { id: 'tree-north-04', type: 'tree', preset: 'autumn-maple', position: { x: 8.5, y: 4.6 } },
  { id: 'tree-north-05', type: 'tree', preset: 'pine-tree', position: { x: 11.2, y: 1.2 } },
  { id: 'tree-north-06', type: 'tree', preset: 'old-oak', position: { x: 14.2, y: 4.3 } },
  { id: 'tree-north-07', type: 'tree', preset: 'birch-tree', position: { x: 17.2, y: 2.0 } },
  { id: 'tree-north-08', type: 'tree', preset: 'pine-tree', position: { x: 20.1, y: 5.1 } },
  { id: 'tree-north-09', type: 'tree', preset: 'old-oak', position: { x: 23.1, y: 2.3 } },
  { id: 'tree-north-10', type: 'tree', preset: 'autumn-maple', position: { x: 26.0, y: 5.4 } },
  { id: 'tree-north-11', type: 'tree', preset: 'pine-tree', position: { x: 29.0, y: 1.4 } },
  { id: 'tree-north-12', type: 'tree', preset: 'birch-tree', position: { x: 32.0, y: 4.4 } },
  { id: 'tree-north-13', type: 'tree', preset: 'old-oak', position: { x: 35.0, y: 1.3 } },
  { id: 'tree-north-14', type: 'tree', preset: 'pine-tree', position: { x: 37.5, y: 5.1 } },
  { id: 'tree-south-01', type: 'tree', preset: 'dead-tree', position: { x: 1.3, y: 19.4 } },
  { id: 'tree-south-02', type: 'tree', preset: 'old-oak', position: { x: 4.3, y: 21.5 } },
  { id: 'tree-south-03', type: 'tree', preset: 'birch-tree', position: { x: 7.5, y: 18.5 } },
  { id: 'tree-south-04', type: 'tree', preset: 'pine-tree', position: { x: 10.5, y: 21.4 } },
  { id: 'tree-south-05', type: 'tree', preset: 'autumn-maple', position: { x: 13.6, y: 18.7 } },
  { id: 'tree-south-06', type: 'tree', preset: 'old-oak', position: { x: 16.9, y: 21.0 } },
  { id: 'tree-south-07', type: 'tree', preset: 'birch-tree', position: { x: 20.0, y: 19.0 } },
  { id: 'tree-south-08', type: 'tree', preset: 'pine-tree', position: { x: 24.6, y: 21.5 } },
  { id: 'tree-south-09', type: 'tree', preset: 'autumn-maple', position: { x: 28.2, y: 19.1 } },
  { id: 'tree-south-10', type: 'tree', preset: 'old-oak', position: { x: 31.4, y: 21.4 } },
  { id: 'tree-south-11', type: 'tree', preset: 'birch-tree', position: { x: 34.4, y: 18.8 } },
  { id: 'tree-south-12', type: 'tree', preset: 'pine-tree', position: { x: 37.4, y: 21.2 } },
  { id: 'tree-river-north-west', type: 'tree', preset: 'old-oak', position: { x: 2.7, y: 12.0 } },
  {
    id: 'tree-river-north-east',
    type: 'tree',
    preset: 'birch-tree',
    position: { x: 35.4, y: 12.2 },
  },
  { id: 'tree-river-south-west', type: 'tree', preset: 'pine-tree', position: { x: 5.0, y: 16.8 } },
  { id: 'tree-river-south-east', type: 'tree', preset: 'old-oak', position: { x: 37.7, y: 17.0 } },
  { id: 'rock-hill-north-a', type: 'rock', preset: 'small-rock', position: { x: 12.5, y: 5.7 } },
  { id: 'rock-hill-north-b', type: 'rock', preset: 'mossy-boulder', position: { x: 27.5, y: 6.4 } },
  { id: 'rock-bank-west', type: 'rock', preset: 'small-rock', position: { x: 15.8, y: 13.1 } },
  { id: 'rock-bank-east', type: 'rock', preset: 'mossy-boulder', position: { x: 25.3, y: 17.3 } },
  { id: 'rock-south-ridge', type: 'rock', preset: 'large-boulder', position: { x: 27.9, y: 20.5 } },
]

const undergrowthObjects: readonly MapObjectDefinition[] = [
  { id: 'bush-west-trail-01', type: 'bush', preset: 'leafy-bush', position: { x: 1.0, y: 8.3 } },
  { id: 'bush-west-trail-02', type: 'bush', preset: 'berry-bush', position: { x: 5.3, y: 12.5 } },
  { id: 'bush-west-trail-03', type: 'bush', preset: 'thorn-bush', position: { x: 9.0, y: 8.3 } },
  { id: 'bush-mid-trail-01', type: 'bush', preset: 'leafy-bush', position: { x: 14.5, y: 9.5 } },
  { id: 'bush-mid-trail-02', type: 'bush', preset: 'berry-bush', position: { x: 17.3, y: 13.5 } },
  { id: 'bush-bridge-north', type: 'bush', preset: 'thorn-bush', position: { x: 20.2, y: 11.3 } },
  { id: 'bush-bridge-south', type: 'bush', preset: 'leafy-bush', position: { x: 24.9, y: 18.1 } },
  { id: 'bush-east-trail-01', type: 'bush', preset: 'berry-bush', position: { x: 28.7, y: 14.9 } },
  { id: 'bush-east-trail-02', type: 'bush', preset: 'thorn-bush', position: { x: 34.2, y: 18.3 } },
  { id: 'bush-east-trail-03', type: 'bush', preset: 'leafy-bush', position: { x: 37.0, y: 14.3 } },
  {
    id: 'thicket-north-west-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 1.8, y: 6.1 },
  },
  {
    id: 'thicket-north-west-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 7.1, y: 6.4 },
  },
  {
    id: 'thicket-north-center-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 15.2, y: 6.5 },
  },
  {
    id: 'thicket-north-center-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 22.1, y: 7.1 },
  },
  {
    id: 'thicket-north-east-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 30.7, y: 7.1 },
  },
  {
    id: 'thicket-north-east-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 36.7, y: 7.0 },
  },
  {
    id: 'thicket-river-west-north',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 10.4, y: 13.0 },
  },
  {
    id: 'thicket-river-east-south',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 30.2, y: 18.3 },
  },
  {
    id: 'thicket-south-west-01',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 2.4, y: 17.8 },
  },
  {
    id: 'thicket-south-center-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 12.1, y: 17.2 },
  },
  {
    id: 'thicket-south-center-02',
    type: 'thicket',
    preset: 'dry-scrub',
    position: { x: 19.4, y: 18.1 },
  },
  {
    id: 'thicket-south-east-01',
    type: 'thicket',
    preset: 'dense-bramble',
    position: { x: 36.2, y: 18.4 },
  },
]

const lightObjects: readonly MapObjectDefinition[] = [
  {
    id: 'filtered-forest-daylight',
    type: 'daylight-area',
    preset: 'forest-daylight',
    position: { x: 0, y: 0 },
    width: 40,
    height: 24,
    alpha: 0.08,
  },
  {
    id: 'bridge-sun-break',
    type: 'daylight-area',
    preset: 'open-sunlight',
    position: { x: 18.2, y: 10.8 },
    width: 8.2,
    height: 8.4,
    alpha: 0.12,
  },
]

const startTokens: readonly PlacedToken[] = [
  {
    id: 'token-chapter-3-waldweg-hero',
    mapId,
    name: 'Held',
    position: { x: 3.8, y: 10.8 },
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
  name: '3. Kapitel Waldweg am Fluss',
  width: 40,
  height: 24,
  gridSize: 48,
  objects: [
    ...groundObjects,
    ...pathObjects,
    ...riverObjects,
    ...hillSlopeObjects,
    ...lightObjects,
    ...natureObjects,
    ...undergrowthObjects,
    ...wagonObjects,
  ],
  walls: [
    movementBlocker('river-crossing-blocker-west', 0, 15.95, 20.8, 15.95),
    movementBlocker('river-crossing-blocker-east', 24.6, 15.95, 40, 15.95),
  ],
  doors: [],
  spawnPoints: [],
  startTokens,
})
