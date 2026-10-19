import type { GridPoint } from '@/types/geometry'
import type { WallDefinition } from '@/maps/api'

export const naerytarMapWidth = 68
export const naerytarMapHeight = 50

export interface NaerytarArea {
  readonly number: number
  readonly id: string
  readonly name: string
  readonly center: GridPoint
}

export const naerytarAreas: readonly NaerytarArea[] = [
  { number: 1, id: 'entrance-cave', name: 'Eingangshöhle', center: { x: 49.81, y: 22.44 } },
  { number: 2, id: 'gray-ooze-cave', name: 'Grauschleimhöhle', center: { x: 59.69, y: 17.38 } },
  { number: 3, id: 'mud-chamber', name: 'Schlammkammer', center: { x: 59.62, y: 36.56 } },
  { number: 4, id: 'centipede-cave', name: 'Tausendfüßerhöhle', center: { x: 47.94, y: 37.88 } },
  { number: 5, id: 'empty-chamber', name: 'Leere Kammer', center: { x: 44.50, y: 31.31 } },
  { number: 6, id: 'frog-lake', name: 'Unterirdischer Froschsee', center: { x: 30.75, y: 26.19 } },
  { number: 7, id: 'frog-roost', name: 'Froschliegeplatz', center: { x: 14.44, y: 35.81 } },
  { number: 8, id: 'tadpole-nursery', name: 'Kaulquappenbrutstätte', center: { x: 36.38, y: 41.25 } },
  { number: 9, id: 'crane-platform', name: 'Kranplattform', center: { x: 37.75, y: 9.00 } },
  { number: 10, id: 'mist-chamber', name: 'Nebelkammer', center: { x: 24.00, y: 8.69 } },
  { number: 11, id: 'frog-shrine', name: 'Froschheiligtum', center: { x: 9.81, y: 16.12 } },
  { number: 12, id: 'pharblex-retreat', name: "Pharblex' Rückzugsort", center: { x: 4.00, y: 24.56 } },
  { number: 13, id: 'teleportation-chamber', name: 'Teleportationskammer', center: { x: 8.31, y: 6.31 } },
]

export const naerytarAreaByNumber = new Map(naerytarAreas.map((area) => [area.number, area]))

export interface NaerytarRoute {
  readonly id: string
  readonly areas: readonly number[]
  readonly kind: 'land' | 'water'
}

export const naerytarRoutes: readonly NaerytarRoute[] = [
  { id: 'treasure-route', areas: [1, 9, 10, 13], kind: 'land' },
  { id: 'eastern-route', areas: [1, 3, 4, 5, 6], kind: 'land' },
  { id: 'ooze-dead-end', areas: [1, 2], kind: 'water' },
  { id: 'shrine-route', areas: [10, 11, 12], kind: 'land' },
  // Area 7 is reached at the water's edge. Area 8 is an isolated breeding pool,
  // NOT an open water channel from area 6.
  { id: 'frog-landing', areas: [6, 7], kind: 'water' },
  { id: 'north-bank-link', areas: [6, 10], kind: 'land' },
  { id: 'nursery-link', areas: [6, 8], kind: 'land' },
]

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function parseCellKey(key: string): GridPoint {
  const [x, y] = key.split(',').map(Number)
  return { x: x!, y: y! }
}

function addCell(cells: Set<string>, x: number, y: number): void {
  if (x < 1 || y < 1 || x >= naerytarMapWidth - 1 || y >= naerytarMapHeight - 1) return
  cells.add(cellKey(x, y))
}

/*
 * Fixed 5-ft-cell tracing of the numbered Castle Naerytar dungeon map.
 * Contours are authored directly in map coordinates. They deliberately keep
 * the existing square-cell renderer and deterministic wall generator; no
 * image, procedural cave generation or new engine feature is required.
 */
interface NaerytarRoomOutline {
  readonly number: number
  readonly points: readonly GridPoint[]
}

const caveOutlines: readonly NaerytarRoomOutline[] = [
  {
    number: 1,
    points: [
      { x: 40.88, y: 10.88 }, { x: 42.75, y: 10.88 }, { x: 44.38, y: 11.62 },
      { x: 46.31, y: 12.44 }, { x: 48.62, y: 13.56 }, { x: 50.06, y: 14.75 },
      { x: 51.50, y: 16.75 }, { x: 51.10, y: 17.60 }, { x: 50.90, y: 18.60 },
      { x: 51.80, y: 19.30 }, { x: 53.10, y: 20.10 }, { x: 54.60, y: 21.60 },
      { x: 55.50, y: 23.30 }, { x: 55.60, y: 24.80 }, { x: 54.90, y: 25.80 },
      { x: 55.81, y: 26.19 }, { x: 54.38, y: 25.75 }, { x: 52.44, y: 25.38 },
      { x: 51.12, y: 26.00 }, { x: 48.69, y: 25.44 }, { x: 47.06, y: 25.62 },
      { x: 45.69, y: 25.81 }, { x: 43.62, y: 25.44 }, { x: 42.38, y: 24.25 },
      { x: 42.19, y: 22.62 }, { x: 42.44, y: 20.88 }, { x: 42.12, y: 19.25 },
      { x: 42.44, y: 17.75 }, { x: 41.75, y: 15.62 }, { x: 41.19, y: 14.12 },
      { x: 39.94, y: 12.31 },
    ],
  },
  {
    number: 2,
    points: [
      { x: 52.75, y: 14.81 }, { x: 53.94, y: 13.38 }, { x: 55.56, y: 12.44 },
      { x: 57.31, y: 12.38 }, { x: 58.00, y: 13.31 }, { x: 60.25, y: 13.38 },
      { x: 61.50, y: 14.06 }, { x: 62.75, y: 14.31 }, { x: 63.25, y: 13.31 },
      { x: 64.38, y: 13.00 }, { x: 65.75, y: 14.44 }, { x: 65.38, y: 16.81 },
      { x: 64.75, y: 19.81 }, { x: 64.31, y: 21.62 }, { x: 63.06, y: 23.56 },
      { x: 61.50, y: 24.00 }, { x: 60.19, y: 23.44 }, { x: 59.00, y: 22.70 },
      { x: 57.90, y: 21.90 }, { x: 56.90, y: 20.80 }, { x: 55.60, y: 19.40 },
      { x: 54.40, y: 18.30 }, { x: 53.20, y: 17.20 }, { x: 52.30, y: 16.10 },
    ],
  },
  {
    number: 3,
    points: [
      { x: 57.38, y: 29.19 }, { x: 58.56, y: 28.50 }, { x: 59.69, y: 28.69 },
      { x: 60.50, y: 30.56 }, { x: 61.19, y: 31.69 }, { x: 62.75, y: 31.62 },
      { x: 64.81, y: 32.62 }, { x: 65.56, y: 33.94 }, { x: 64.75, y: 35.19 },
      { x: 63.75, y: 36.94 }, { x: 64.19, y: 39.19 }, { x: 63.06, y: 41.38 },
      { x: 61.25, y: 43.44 }, { x: 59.00, y: 43.44 }, { x: 58.00, y: 42.06 },
      { x: 56.69, y: 41.81 }, { x: 54.94, y: 40.81 }, { x: 54.31, y: 39.25 },
      { x: 54.75, y: 37.00 }, { x: 55.31, y: 34.56 }, { x: 55.31, y: 32.75 },
    ],
  },
  {
    number: 4,
    points: [
      { x: 43.44, y: 35.10 }, { x: 44.50, y: 34.95 }, { x: 45.60, y: 35.40 },
      { x: 46.60, y: 35.90 }, { x: 47.60, y: 35.55 }, { x: 48.40, y: 35.50 },
      { x: 51.44, y: 35.56 }, { x: 53.00, y: 36.94 }, { x: 54.06, y: 37.88 },
      { x: 54.31, y: 39.38 }, { x: 53.44, y: 41.19 }, { x: 52.00, y: 42.75 },
      { x: 49.62, y: 43.50 }, { x: 47.69, y: 42.88 }, { x: 45.88, y: 41.88 },
      { x: 44.62, y: 40.62 }, { x: 43.31, y: 39.19 }, { x: 42.56, y: 37.69 },
    ],
  },
  {
    number: 5,
    points: [
      { x: 40.69, y: 29.94 }, { x: 41.88, y: 29.31 }, { x: 43.50, y: 29.50 },
      { x: 45.25, y: 29.94 }, { x: 47.06, y: 30.56 }, { x: 48.50, y: 31.10 },
      { x: 49.60, y: 31.90 }, { x: 48.80, y: 32.80 }, { x: 47.90, y: 33.40 },
      { x: 47.30, y: 33.90 }, { x: 46.40, y: 34.20 }, { x: 45.30, y: 33.95 },
      { x: 43.90, y: 33.75 }, { x: 42.19, y: 33.10 }, { x: 40.19, y: 32.75 },
      { x: 39.31, y: 31.06 },
    ],
  },
  {
    number: 6,
    points: [
      { x: 10.75, y: 21.88 }, { x: 11.94, y: 21.81 }, { x: 13.06, y: 22.94 },
      { x: 14.81, y: 23.69 }, { x: 16.56, y: 24.75 }, { x: 17.81, y: 24.75 },
      { x: 18.75, y: 23.75 }, { x: 19.31, y: 21.44 }, { x: 19.06, y: 19.62 },
      { x: 20.00, y: 17.62 }, { x: 22.00, y: 16.50 }, { x: 24.56, y: 16.12 },
      { x: 26.94, y: 16.12 }, { x: 28.56, y: 15.19 }, { x: 30.06, y: 15.88 },
      { x: 32.56, y: 16.25 }, { x: 34.56, y: 16.25 }, { x: 36.94, y: 17.00 },
      { x: 38.75, y: 17.19 }, { x: 39.38, y: 18.81 }, { x: 39.75, y: 20.69 },
      { x: 40.31, y: 22.50 }, { x: 39.69, y: 24.44 }, { x: 39.25, y: 26.25 },
      { x: 38.94, y: 28.56 }, { x: 38.19, y: 30.38 }, { x: 38.00, y: 32.88 },
      { x: 37.38, y: 34.62 }, { x: 36.25, y: 36.88 }, { x: 35.00, y: 38.12 },
      { x: 33.44, y: 38.75 }, { x: 31.62, y: 38.50 }, { x: 29.88, y: 37.25 },
      { x: 28.94, y: 35.81 }, { x: 27.56, y: 34.62 }, { x: 26.06, y: 32.75 },
      { x: 24.62, y: 31.38 }, { x: 23.19, y: 29.62 }, { x: 21.75, y: 28.31 },
      { x: 21.06, y: 28.62 }, { x: 20.88, y: 30.25 }, { x: 21.81, y: 32.50 },
      { x: 23.31, y: 34.25 }, { x: 25.00, y: 36.19 }, { x: 25.19, y: 37.75 },
      { x: 24.06, y: 39.00 }, { x: 22.69, y: 40.12 }, { x: 21.00, y: 39.56 },
      { x: 20.06, y: 37.88 }, { x: 19.44, y: 36.50 }, { x: 18.12, y: 35.00 },
      { x: 16.94, y: 34.12 }, { x: 16.12, y: 32.19 }, { x: 15.31, y: 30.12 },
      { x: 14.12, y: 28.94 }, { x: 12.62, y: 28.44 }, { x: 11.19, y: 27.38 },
      { x: 10.81, y: 25.88 }, { x: 11.62, y: 24.94 }, { x: 10.62, y: 23.38 },
    ],
  },
  {
    number: 7,
    points: [
      { x: 8.69, y: 35.00 }, { x: 9.12, y: 32.81 }, { x: 10.19, y: 31.38 },
      { x: 11.56, y: 29.81 }, { x: 13.19, y: 28.88 }, { x: 14.75, y: 29.38 },
      { x: 15.62, y: 30.75 }, { x: 16.44, y: 32.69 }, { x: 17.56, y: 34.00 },
      { x: 18.69, y: 35.88 }, { x: 19.88, y: 37.88 }, { x: 20.75, y: 39.31 },
      { x: 19.06, y: 41.06 }, { x: 17.19, y: 42.06 }, { x: 15.12, y: 41.75 },
      { x: 12.62, y: 41.44 }, { x: 10.56, y: 40.56 }, { x: 9.12, y: 38.88 },
      { x: 8.50, y: 36.94 },
    ],
  },
  {
    number: 8,
    points: [
      { x: 33.50, y: 40.50 }, { x: 34.50, y: 39.62 }, { x: 36.12, y: 39.44 },
      { x: 37.62, y: 40.00 }, { x: 39.19, y: 41.00 }, { x: 40.75, y: 42.12 },
      { x: 40.69, y: 43.81 }, { x: 39.75, y: 45.12 }, { x: 38.56, y: 45.81 },
      { x: 37.12, y: 44.44 }, { x: 36.38, y: 43.00 }, { x: 34.50, y: 42.25 },
    ],
  },
  {
    number: 9,
    points: [
      { x: 34.12, y: 5.31 }, { x: 36.56, y: 5.94 }, { x: 38.94, y: 7.19 },
      { x: 40.50, y: 8.81 }, { x: 40.44, y: 10.62 }, { x: 39.00, y: 11.38 },
      { x: 37.62, y: 12.19 }, { x: 36.31, y: 11.19 }, { x: 35.19, y: 10.31 },
      { x: 33.88, y: 10.06 }, { x: 32.50, y: 9.38 }, { x: 31.31, y: 7.69 },
    ],
  },
  {
    number: 10,
    points: [
      { x: 20.12, y: 4.88 }, { x: 21.69, y: 5.50 }, { x: 23.44, y: 6.38 },
      { x: 26.31, y: 6.88 }, { x: 28.44, y: 6.44 }, { x: 30.88, y: 5.88 },
      { x: 33.88, y: 5.25 }, { x: 36.12, y: 6.06 }, { x: 38.81, y: 7.12 },
      { x: 40.12, y: 8.69 }, { x: 40.44, y: 9.94 }, { x: 39.00, y: 11.50 },
      { x: 37.38, y: 12.12 }, { x: 36.69, y: 10.88 }, { x: 34.81, y: 10.31 },
      { x: 33.19, y: 9.81 }, { x: 31.00, y: 9.31 }, { x: 28.38, y: 9.31 },
      { x: 26.44, y: 9.81 }, { x: 25.69, y: 11.25 }, { x: 26.06, y: 13.19 },
      { x: 27.44, y: 14.50 }, { x: 27.69, y: 15.38 }, { x: 25.88, y: 15.00 },
      { x: 24.94, y: 13.00 }, { x: 24.38, y: 11.06 }, { x: 23.12, y: 10.00 },
      { x: 21.88, y: 10.19 }, { x: 20.94, y: 11.25 }, { x: 19.25, y: 11.31 },
      { x: 19.88, y: 9.62 }, { x: 21.19, y: 8.69 }, { x: 21.06, y: 7.38 },
    ],
  },
  {
    number: 11,
    points: [
      { x: 3.88, y: 15.00 }, { x: 6.75, y: 14.56 }, { x: 10.31, y: 14.12 },
      { x: 13.69, y: 13.50 }, { x: 15.88, y: 13.56 }, { x: 17.19, y: 14.31 },
      { x: 17.94, y: 15.25 }, { x: 17.06, y: 16.94 }, { x: 15.62, y: 18.19 },
      { x: 13.81, y: 19.56 }, { x: 11.38, y: 21.31 }, { x: 9.00, y: 21.75 },
      { x: 7.00, y: 21.06 }, { x: 5.50, y: 20.00 }, { x: 4.81, y: 18.81 },
      { x: 5.12, y: 17.56 }, { x: 4.56, y: 16.81 },
    ],
  },
  {
    number: 12,
    points: [
      { x: 2.12, y: 20.50 }, { x: 3.94, y: 19.81 }, { x: 5.31, y: 20.12 },
      { x: 6.06, y: 20.81 }, { x: 6.31, y: 22.94 }, { x: 6.81, y: 24.44 },
      { x: 7.38, y: 25.88 }, { x: 6.31, y: 27.00 }, { x: 4.19, y: 28.06 },
      { x: 2.12, y: 28.56 }, { x: 1.88, y: 26.19 }, { x: 2.00, y: 23.69 },
    ],
  },
  {
    number: 13,
    points: [
      { x: 3.69, y: 8.06 }, { x: 4.56, y: 4.81 }, { x: 5.25, y: 3.56 },
      { x: 8.62, y: 3.44 }, { x: 12.38, y: 3.44 }, { x: 14.38, y: 3.56 },
      { x: 14.38, y: 4.56 }, { x: 16.00, y: 4.88 }, { x: 17.19, y: 5.25 },
      { x: 18.38, y: 5.12 }, { x: 19.94, y: 4.88 }, { x: 20.69, y: 6.25 },
      { x: 19.75, y: 7.19 }, { x: 18.12, y: 7.06 }, { x: 17.06, y: 8.38 },
      { x: 15.25, y: 9.62 }, { x: 14.06, y: 10.31 }, { x: 13.38, y: 8.44 },
      { x: 12.50, y: 7.38 }, { x: 10.81, y: 8.19 }, { x: 8.81, y: 9.31 },
      { x: 6.44, y: 9.69 }, { x: 4.44, y: 9.56 }, { x: 3.69, y: 8.81 },
    ],
  },
]

// Stairways, small crawlspaces and the continuous treasure-hauling route.
// The radius is in map cells, not a polygon's bounding box.
interface NaerytarConnector {
  readonly id: string
  readonly points: readonly GridPoint[]
  readonly radius: number
}

const dryConnections: readonly NaerytarConnector[] = [
  { id: '13-10', radius: 1.04, points: [
    { x: 18.44, y: 6.56 }, { x: 20.25, y: 7.06 }, { x: 21.69, y: 7.25 }, { x: 22.81, y: 7.56 },
  ] },
  { id: '10-9', radius: 1.04, points: [
    { x: 32.75, y: 8.12 }, { x: 34.75, y: 8.50 },
  ] },
  { id: '09-01', radius: 1.05, points: [
    { x: 39.31, y: 10.81 }, { x: 40.69, y: 12.44 }, { x: 42.62, y: 14.00 },
  ] },
  { id: '10-11', radius: 1.04, points: [
    { x: 20.88, y: 11.00 }, { x: 19.06, y: 12.81 }, { x: 17.19, y: 15.00 },
  ] },
  { id: '11-12', radius: 1.04, points: [
    { x: 5.56, y: 19.12 }, { x: 5.44, y: 20.31 }, { x: 5.44, y: 21.44 },
  ] },
  // Narrow stream-bed floor. The water overlay covers this fully, so 1->2 remains water-only.
  { id: '01-02-stream-bed', radius: 0.72, points: [
    { x: 45.40, y: 21.90 }, { x: 45.55, y: 19.60 }, { x: 46.60, y: 17.80 }, { x: 48.30, y: 16.90 },
    { x: 50.40, y: 16.80 }, { x: 52.30, y: 15.90 }, { x: 53.80, y: 14.90 }, { x: 55.60, y: 14.60 },
    { x: 57.80, y: 14.70 }, { x: 60.40, y: 14.80 }, { x: 63.10, y: 14.20 },
  ] },
  { id: '01-03', radius: 1.04, points: [
    { x: 56.75, y: 24.44 }, { x: 58.31, y: 26.00 }, { x: 59.50, y: 27.62 }, { x: 59.69, y: 30.00 },
    { x: 59.31, y: 31.50 },
  ] },
  { id: '03-04', radius: 0.86, points: [
    { x: 55.69, y: 39.12 }, { x: 54.56, y: 38.69 }, { x: 53.25, y: 38.38 },
  ] },
  { id: '04-05', radius: 0.58, points: [
    { x: 46.50, y: 35.25 }, { x: 46.00, y: 34.25 }, { x: 46.20, y: 33.45 },
  ] },
  { id: '05-06', radius: 1.04, points: [
    { x: 41.25, y: 31.31 }, { x: 40.25, y: 30.06 }, { x: 38.81, y: 28.62 }, { x: 37.38, y: 27.81 },
  ] },
  { id: '06-10', radius: 0.82, points: [
    { x: 24.90, y: 16.00 }, { x: 24.70, y: 14.90 }, { x: 24.50, y: 13.60 }, { x: 24.10, y: 12.10 },
    { x: 23.90, y: 10.90 },
  ] },
  { id: '06-08', radius: 0.62, points: [
    { x: 35.10, y: 38.10 }, { x: 35.50, y: 39.20 }, { x: 36.20, y: 40.10 },
  ] },
]

// The large winding lake does not extend into the western frog landing.
// Its eastern rock tongue and two smaller protrusions are carved out below.
const lakeOutline: readonly GridPoint[] = [
  { x: 10.88, y: 21.88 }, { x: 11.88, y: 21.81 }, { x: 13.06, y: 22.88 },
  { x: 14.31, y: 23.56 }, { x: 16.19, y: 24.50 }, { x: 17.69, y: 24.88 },
  { x: 19.00, y: 23.88 }, { x: 19.50, y: 21.56 }, { x: 19.12, y: 19.56 },
  { x: 20.25, y: 17.75 }, { x: 21.94, y: 17.12 }, { x: 24.56, y: 16.62 },
  { x: 27.12, y: 16.44 }, { x: 28.62, y: 15.62 }, { x: 30.81, y: 16.38 },
  { x: 33.44, y: 16.62 }, { x: 36.31, y: 17.31 }, { x: 38.38, y: 17.88 },
  { x: 39.12, y: 19.25 }, { x: 39.56, y: 21.06 }, { x: 40.00, y: 22.75 },
  { x: 39.12, y: 25.00 }, { x: 38.75, y: 27.44 }, { x: 38.06, y: 28.94 },
  { x: 37.44, y: 31.00 }, { x: 37.25, y: 33.44 }, { x: 36.00, y: 36.00 },
  { x: 34.69, y: 37.38 }, { x: 33.25, y: 37.69 }, { x: 31.75, y: 36.94 },
  { x: 30.31, y: 36.12 }, { x: 29.38, y: 34.81 }, { x: 27.56, y: 32.62 },
  { x: 26.12, y: 31.31 }, { x: 24.31, y: 29.19 }, { x: 22.50, y: 27.88 },
  { x: 21.25, y: 27.81 }, { x: 21.00, y: 29.62 }, { x: 21.81, y: 32.00 },
  { x: 23.81, y: 34.75 }, { x: 24.94, y: 36.38 }, { x: 25.12, y: 37.94 },
  { x: 23.69, y: 39.25 }, { x: 22.44, y: 39.88 }, { x: 21.00, y: 38.94 },
  { x: 20.31, y: 37.19 }, { x: 18.81, y: 35.00 }, { x: 17.50, y: 34.25 },
  { x: 16.62, y: 32.31 }, { x: 15.75, y: 30.12 }, { x: 14.69, y: 28.56 },
  { x: 12.56, y: 28.00 }, { x: 11.19, y: 26.75 }, { x: 10.94, y: 25.56 },
  { x: 11.69, y: 24.75 }, { x: 10.81, y: 23.19 },
]

// A separate basin, surrounded by rock; there is no visible water link to 6.
const nurseryPoolOutline: readonly GridPoint[] = [
  { x: 34.40, y: 40.70 }, { x: 35.50, y: 40.20 }, { x: 36.90, y: 40.25 },
  { x: 38.30, y: 40.90 }, { x: 39.55, y: 41.90 }, { x: 40.10, y: 43.10 },
  { x: 39.90, y: 44.30 }, { x: 38.90, y: 45.10 }, { x: 37.60, y: 45.10 },
  { x: 36.20, y: 44.30 }, { x: 35.10, y: 43.20 }, { x: 34.45, y: 41.90 },
]

// The long, shallow winding stream is in the entrance and gray-ooze chambers.
const easternStream: readonly GridPoint[] = [
  { x: 45.40, y: 21.90 }, { x: 45.55, y: 19.60 }, { x: 46.60, y: 17.80 },
  { x: 48.30, y: 16.90 }, { x: 50.40, y: 16.80 }, { x: 52.30, y: 15.90 },
  { x: 53.80, y: 14.90 }, { x: 55.60, y: 14.60 }, { x: 57.80, y: 14.70 },
  { x: 60.40, y: 14.80 }, { x: 63.10, y: 14.20 },
]


const lakeExtensions: readonly (readonly GridPoint[])[] = [
  // north approach toward room 10 / the narrow cave lip
  [
    { x: 21.80, y: 16.50 }, { x: 24.20, y: 15.80 }, { x: 27.00, y: 16.00 },
    { x: 28.40, y: 16.90 }, { x: 27.90, y: 18.20 }, { x: 25.90, y: 18.90 },
    { x: 23.40, y: 19.10 }, { x: 21.70, y: 18.30 }, { x: 21.20, y: 17.20 },
  ],
  // east / southeast bulge to make the main lake body fuller
  [
    { x: 33.70, y: 28.00 }, { x: 36.10, y: 27.80 }, { x: 38.10, y: 28.40 },
    { x: 39.10, y: 30.10 }, { x: 39.10, y: 32.40 }, { x: 38.50, y: 34.90 },
    { x: 37.20, y: 36.70 }, { x: 35.00, y: 36.50 }, { x: 33.90, y: 34.80 },
    { x: 33.60, y: 32.40 }, { x: 33.50, y: 30.10 },
  ],
]

const lakeIslands: readonly (readonly GridPoint[])[] = [
  // center-small
  [
    { x: 23.38, y: 24.12 }, { x: 24.12, y: 23.31 }, { x: 25.38, y: 23.19 },
    { x: 26.25, y: 22.75 }, { x: 27.31, y: 23.25 }, { x: 27.50, y: 24.38 },
    { x: 26.81, y: 25.31 }, { x: 25.88, y: 25.75 }, { x: 24.62, y: 26.50 },
    { x: 23.69, y: 26.38 }, { x: 23.31, y: 25.44 },
  ],
  // eastern-serpentine
  [
    { x: 28.88, y: 19.75 }, { x: 29.81, y: 19.31 }, { x: 31.12, y: 19.56 },
    { x: 32.38, y: 19.50 }, { x: 33.44, y: 19.62 }, { x: 34.50, y: 20.62 },
    { x: 35.44, y: 20.75 }, { x: 35.75, y: 21.44 }, { x: 35.12, y: 22.25 },
    { x: 33.69, y: 22.06 }, { x: 32.88, y: 21.44 }, { x: 31.75, y: 21.31 },
    { x: 32.69, y: 22.75 }, { x: 32.75, y: 24.12 }, { x: 32.25, y: 25.31 },
    { x: 33.31, y: 25.75 }, { x: 34.88, y: 26.00 }, { x: 36.12, y: 26.44 },
    { x: 37.38, y: 26.44 }, { x: 37.81, y: 27.31 }, { x: 37.00, y: 28.25 },
    { x: 35.44, y: 28.00 }, { x: 33.75, y: 27.88 }, { x: 32.31, y: 27.81 },
    { x: 30.75, y: 28.88 }, { x: 29.62, y: 28.81 }, { x: 28.94, y: 27.75 },
    { x: 28.12, y: 26.50 }, { x: 28.38, y: 25.31 }, { x: 29.69, y: 24.44 },
    { x: 30.88, y: 23.50 }, { x: 30.81, y: 22.31 }, { x: 29.69, y: 21.38 },
  ],
  // southwest-long
  [
    { x: 22.06, y: 27.81 }, { x: 23.50, y: 27.75 }, { x: 25.06, y: 27.88 },
    { x: 26.31, y: 28.62 }, { x: 26.88, y: 30.38 }, { x: 27.31, y: 31.81 },
    { x: 28.25, y: 33.69 }, { x: 28.94, y: 35.31 }, { x: 30.12, y: 36.38 },
    { x: 30.56, y: 37.25 }, { x: 29.56, y: 37.69 }, { x: 28.69, y: 36.50 },
    { x: 27.25, y: 35.44 }, { x: 26.31, y: 34.56 }, { x: 25.62, y: 33.19 },
    { x: 25.00, y: 32.06 }, { x: 24.19, y: 30.94 }, { x: 22.75, y: 30.56 },
    { x: 22.06, y: 29.44 },
  ],
]

function containsPoint(polygon: readonly GridPoint[], x: number, y: number): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]!
    const b = polygon[previous]!
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}

function addPolygon(cells: Set<string>, polygon: readonly GridPoint[]): void {
  if (polygon.length < 3) return
  const minX = Math.max(1, Math.floor(Math.min(...polygon.map((point) => point.x))))
  const maxX = Math.min(naerytarMapWidth - 2, Math.ceil(Math.max(...polygon.map((point) => point.x))))
  const minY = Math.max(1, Math.floor(Math.min(...polygon.map((point) => point.y))))
  const maxY = Math.min(naerytarMapHeight - 2, Math.ceil(Math.max(...polygon.map((point) => point.y))))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (containsPoint(polygon, x + 0.5, y + 0.5)) addCell(cells, x, y)
    }
  }
}

function distanceToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const dx = endX - startX
  const dy = endY - startY
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared))
  return Math.hypot(pointX - (startX + dx * t), pointY - (startY + dy * t))
}

function addPassage(cells: Set<string>, points: readonly GridPoint[], radius: number): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const minX = Math.floor(Math.min(start.x, end.x) - radius - 1)
    const maxX = Math.ceil(Math.max(start.x, end.x) + radius + 1)
    const minY = Math.floor(Math.min(start.y, end.y) - radius - 1)
    const maxY = Math.ceil(Math.max(start.y, end.y) + radius + 1)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (distanceToSegment(x + 0.5, y + 0.5, start.x, start.y, end.x, end.y) <= radius)
          addCell(cells, x, y)
      }
    }
  }
}

function createWalkableCells(): ReadonlySet<string> {
  const cells = new Set<string>()
  for (const room of caveOutlines) addPolygon(cells, room.points)
  for (const connection of dryConnections) addPassage(cells, connection.points, connection.radius)
  // Discard one-cell raster artifacts at sharp rock tips (not useful rooms).
  for (const key of [...cells]) {
    const { x, y } = parseCellKey(key)
    if (
      !cells.has(cellKey(x - 1, y)) && !cells.has(cellKey(x + 1, y)) &&
      !cells.has(cellKey(x, y - 1)) && !cells.has(cellKey(x, y + 1))
    ) cells.delete(key)
  }
  return cells
}

function createLakeCells(walkable: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  addPolygon(cells, lakeOutline)
  for (const extension of lakeExtensions) addPolygon(cells, extension)
  addPolygon(cells, nurseryPoolOutline)
  addPassage(cells, easternStream, 1.05)
  return new Set([...cells].filter((key) => walkable.has(key)))
}

function createIslandCells(lake: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  for (const island of lakeIslands) addPolygon(cells, island)
  return new Set([...cells].filter((key) => lake.has(key)))
}

function collectDeepCore(
  source: ReadonlySet<string>,
  allowed: ReadonlySet<string>,
  islands: ReadonlySet<string>,
): ReadonlySet<string> {
  const deep = new Set<string>()
  for (const key of source) {
    if (!allowed.has(key) || islands.has(key)) continue
    const { x, y } = parseCellKey(key)
    let surrounded = true
    for (let dy = -1; dy <= 1 && surrounded; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!source.has(cellKey(x + dx, y + dy)) || islands.has(cellKey(x + dx, y + dy))) {
          surrounded = false
          break
        }
      }
    }
    if (surrounded) deep.add(key)
  }
  return deep
}

function createDeepWaterCells(
  lake: ReadonlySet<string>,
  islands: ReadonlySet<string>,
): ReadonlySet<string> {
  const mainLake = new Set<string>()
  addPolygon(mainLake, lakeOutline)
  for (const extension of lakeExtensions) addPolygon(mainLake, extension)

  const nurseryLake = new Set<string>()
  addPolygon(nurseryLake, nurseryPoolOutline)

  const deep = new Set<string>()
  for (const key of collectDeepCore(mainLake, lake, islands)) deep.add(key)
  for (const key of collectDeepCore(nurseryLake, lake, islands)) deep.add(key)
  return deep
}

function createMudCells(walkable: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  const mudChamber = caveOutlines.find((room) => room.number === 3)
  if (mudChamber) addPolygon(cells, mudChamber.points)
  return new Set([...cells].filter((key) => walkable.has(key)))
}

function createWetStoneCells(walkable: ReadonlySet<string>, lake: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  // Narrow wet limestone strip immediately around the water's edge.
  for (const key of walkable) {
    if (lake.has(key)) continue
    const { x, y } = parseCellKey(key)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (lake.has(cellKey(x + dx, y + dy))) cells.add(key)
      }
    }
  }
  return cells
}

export const naerytarWalkableCells = createWalkableCells()
export const naerytarLakeCells = createLakeCells(naerytarWalkableCells)
export const naerytarIslandCells = createIslandCells(naerytarLakeCells)
export const naerytarDeepWaterCells = createDeepWaterCells(naerytarLakeCells, naerytarIslandCells)
export const naerytarMudCells = createMudCells(naerytarWalkableCells)
export const naerytarWetStoneCells = createWetStoneCells(naerytarWalkableCells, naerytarLakeCells)

function mergeBoundarySegments(
  cells: ReadonlySet<string>,
  prefix: string,
  blocksSight: boolean,
  blocksMovement: boolean,
): readonly WallDefinition[] {
  const horizontal = new Map<number, number[]>()
  const vertical = new Map<number, number[]>()
  for (const key of cells) {
    const { x, y } = parseCellKey(key)
    if (!cells.has(cellKey(x, y - 1))) horizontal.set(y, [...(horizontal.get(y) ?? []), x])
    if (!cells.has(cellKey(x, y + 1))) horizontal.set(y + 1, [...(horizontal.get(y + 1) ?? []), x])
    if (!cells.has(cellKey(x - 1, y))) vertical.set(x, [...(vertical.get(x) ?? []), y])
    if (!cells.has(cellKey(x + 1, y))) vertical.set(x + 1, [...(vertical.get(x + 1) ?? []), y])
  }

  const walls: WallDefinition[] = []
  function addRuns(
    groups: ReadonlyMap<number, readonly number[]>,
    orientation: 'horizontal' | 'vertical',
  ): void {
    for (const [fixed, rawValues] of groups) {
      const values = [...new Set(rawValues)].sort((left, right) => left - right)
      let start = values[0]
      let previous = values[0]
      for (let index = 1; index <= values.length; index += 1) {
        const value = values[index]
        if (value === previous! + 1) {
          previous = value
          continue
        }
        if (start !== undefined && previous !== undefined) {
          walls.push({
            id: `${prefix}-${walls.length + 1}`,
            a: orientation === 'horizontal' ? { x: start, y: fixed } : { x: fixed, y: start },
            b:
              orientation === 'horizontal'
                ? { x: previous + 1, y: fixed }
                : { x: fixed, y: previous + 1 },
            blocksSight,
            blocksMovement,
            appearance: 'cave',
          })
        }
        start = value
        previous = value
      }
    }
  }

  addRuns(horizontal, 'horizontal')
  addRuns(vertical, 'vertical')
  return walls
}

export function createNaerytarWalls(): readonly WallDefinition[] {
  const caveBoundary = mergeBoundarySegments(
    naerytarWalkableCells,
    'naerytar-cave-wall',
    true,
    true,
  )
  const islandWalls = mergeBoundarySegments(naerytarIslandCells, 'naerytar-rock-island', true, true)
  // The wooden cargo crane is visual scenery, not an impassable wall.
  // Leaving collision segments here prevents tokens from crossing the loading platform.
  return [...caveBoundary, ...islandWalls]
}

export function hasNaerytarCell(point: GridPoint): boolean {
  return naerytarWalkableCells.has(cellKey(Math.floor(point.x), Math.floor(point.y)))
}
