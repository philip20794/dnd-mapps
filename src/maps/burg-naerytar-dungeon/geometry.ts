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
  { number: 1, id: 'entrance-cave', name: 'Eingangshöhle', center: { x: 47, y: 25 } },
  { number: 2, id: 'gray-ooze-cave', name: 'Grauschleimhöhle', center: { x: 58, y: 19 } },
  { number: 3, id: 'mud-chamber', name: 'Schlammkammer', center: { x: 59, y: 39 } },
  { number: 4, id: 'centipede-cave', name: 'Tausendfüßerhöhle', center: { x: 49, y: 40 } },
  { number: 5, id: 'empty-chamber', name: 'Leere Kammer', center: { x: 45, y: 33 } },
  { number: 6, id: 'frog-lake', name: 'Unterirdischer Froschsee', center: { x: 32, y: 34 } },
  { number: 7, id: 'frog-roost', name: 'Froschliegeplatz', center: { x: 18, y: 39 } },
  { number: 8, id: 'tadpole-nursery', name: 'Kaulquappenbrutstätte', center: { x: 32, y: 47 } },
  { number: 9, id: 'crane-platform', name: 'Kranplattform', center: { x: 40, y: 14 } },
  { number: 10, id: 'mist-chamber', name: 'Nebelkammer', center: { x: 26, y: 11 } },
  { number: 11, id: 'frog-shrine', name: 'Froschheiligtum', center: { x: 21, y: 19 } },
  { number: 12, id: 'pharblex-retreat', name: "Pharblex' Rückzugsort", center: { x: 12, y: 27 } },
  {
    number: 13,
    id: 'teleportation-chamber',
    name: 'Teleportationskammer',
    center: { x: 10, y: 7 },
  },
] as const

export const naerytarAreaByNumber = new Map(naerytarAreas.map((area) => [area.number, area]))

export interface NaerytarRoute {
  readonly id: string
  readonly areas: readonly number[]
  readonly kind: 'land' | 'water'
}

export const naerytarRoutes: readonly NaerytarRoute[] = [
  { id: 'treasure-route', areas: [1, 9, 10, 13], kind: 'land' },
  { id: 'eastern-route', areas: [1, 3, 4, 5, 6], kind: 'land' },
  { id: 'ooze-dead-end', areas: [1, 2], kind: 'land' },
  { id: 'shrine-route', areas: [10, 11, 12], kind: 'land' },
  { id: 'nursery-water-route', areas: [6, 8], kind: 'water' },
] as const

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

function boundaryWobble(x: number, y: number, seed: number): number {
  return Math.sin(x * 1.73 + y * 0.91 + seed) * 0.055 + Math.cos(y * 1.37 - x * 0.63) * 0.035
}

function addEllipse(
  cells: Set<string>,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  seed: number,
): void {
  const minX = Math.floor(centerX - radiusX - 1)
  const maxX = Math.ceil(centerX + radiusX + 1)
  const minY = Math.floor(centerY - radiusY - 1)
  const maxY = Math.ceil(centerY + radiusY + 1)
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const normalized = ((x + 0.5 - centerX) / radiusX) ** 2 + ((y + 0.5 - centerY) / radiusY) ** 2
      if (normalized <= 1 + boundaryWobble(x, y, seed)) addCell(cells, x, y)
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
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared))
  const nearestX = startX + dx * t
  const nearestY = startY + dy * t
  return Math.hypot(pointX - nearestX, pointY - nearestY)
}

function addPassage(
  cells: Set<string>,
  points: readonly GridPoint[],
  radius: number,
  seed: number,
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const minX = Math.floor(Math.min(start.x, end.x) - radius - 1)
    const maxX = Math.ceil(Math.max(start.x, end.x) + radius + 1)
    const minY = Math.floor(Math.min(start.y, end.y) - radius - 1)
    const maxY = Math.ceil(Math.max(start.y, end.y) + radius + 1)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = distanceToSegment(x + 0.5, y + 0.5, start.x, start.y, end.x, end.y)
        const wobble = boundaryWobble(x, y, seed + index * 17) * radius
        if (distance <= radius + wobble) addCell(cells, x, y)
      }
    }
  }
}

function createWalkableCells(): ReadonlySet<string> {
  const cells = new Set<string>()

  // 1–5 and 9: eastern caves and crane route.
  addEllipse(cells, 46.5, 25.5, 7.2, 5.7, 101)
  addEllipse(cells, 58.2, 19.1, 5.8, 4.2, 102)
  addEllipse(cells, 59, 39, 7.2, 5.8, 103)
  addEllipse(cells, 49, 40, 6.5, 5.2, 104)
  addEllipse(cells, 45, 33.2, 5.4, 4.6, 105)
  addEllipse(cells, 40, 14, 5.6, 4.4, 109)

  // 6–8: the dominant lake chamber, the western roost and the southern nursery.
  addEllipse(cells, 31, 34, 13.4, 10.7, 106)
  addEllipse(cells, 25.5, 31.5, 8.5, 7.2, 116)
  addEllipse(cells, 18, 39, 6.6, 5.6, 107)
  addEllipse(cells, 32, 47, 5.2, 2.7, 108)

  // 10–13: mist passage, shrine, retreat and the isolated teleport chamber.
  addEllipse(cells, 26, 11, 9.7, 4.1, 110)
  addEllipse(cells, 21, 19, 7.4, 4.7, 111)
  addEllipse(cells, 12, 27, 5.6, 5.1, 112)
  addEllipse(cells, 10, 7, 7.2, 4.2, 113)

  // Broad treasure route and all intended side passages. No other dry links are added.
  addPassage(
    cells,
    [
      { x: 46, y: 22 },
      { x: 44, y: 18 },
      { x: 41, y: 16 },
    ],
    2.15,
    201,
  )
  addPassage(
    cells,
    [
      { x: 37, y: 14 },
      { x: 33, y: 12 },
      { x: 29, y: 11 },
    ],
    2.4,
    202,
  )
  addPassage(
    cells,
    [
      { x: 18, y: 10 },
      { x: 16, y: 8 },
      { x: 15, y: 7 },
    ],
    2.05,
    203,
  )

  addPassage(
    cells,
    [
      { x: 51, y: 23 },
      { x: 54, y: 21 },
      { x: 56, y: 20 },
    ],
    1.35,
    204,
  )
  addPassage(
    cells,
    [
      { x: 49, y: 28 },
      { x: 53, y: 32 },
      { x: 57, y: 35 },
    ],
    1.8,
    205,
  )
  addPassage(
    cells,
    [
      { x: 55, y: 39 },
      { x: 52, y: 40 },
    ],
    1.9,
    206,
  )
  addPassage(
    cells,
    [
      { x: 48, y: 37 },
      { x: 46, y: 35 },
    ],
    1.75,
    207,
  )
  addPassage(
    cells,
    [
      { x: 42, y: 33 },
      { x: 39, y: 33 },
      { x: 37, y: 34 },
    ],
    2.0,
    208,
  )

  addPassage(
    cells,
    [
      { x: 24, y: 14 },
      { x: 23, y: 17 },
    ],
    1.8,
    209,
  )
  addPassage(
    cells,
    [
      { x: 17, y: 21 },
      { x: 15, y: 24 },
    ],
    1.65,
    210,
  )
  addPassage(
    cells,
    [
      { x: 23, y: 37 },
      { x: 21, y: 38 },
    ],
    1.75,
    211,
  )
  addPassage(
    cells,
    [
      { x: 31, y: 42 },
      { x: 32, y: 45 },
    ],
    1.15,
    212,
  )

  // A submerged south-eastern tunnel that leaves the lake toward the swamp.
  addPassage(
    cells,
    [
      { x: 39, y: 39 },
      { x: 42, y: 43 },
      { x: 45, y: 48 },
    ],
    1.3,
    213,
  )
  return cells
}

function createLakeCells(walkable: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  addEllipse(cells, 31, 34, 12.2, 9.5, 301)
  addEllipse(cells, 25, 32, 6.8, 6.3, 302)
  addPassage(
    cells,
    [
      { x: 31, y: 41 },
      { x: 32, y: 46 },
    ],
    1.2,
    303,
  )
  addEllipse(cells, 32, 47, 4.3, 2.15, 304)
  addPassage(
    cells,
    [
      { x: 39, y: 39 },
      { x: 42, y: 43 },
      { x: 45, y: 48 },
    ],
    1.05,
    305,
  )
  return new Set([...cells].filter((key) => walkable.has(key)))
}

function createIslandCells(): ReadonlySet<string> {
  const cells = new Set<string>()
  addEllipse(cells, 31, 32, 3.1, 1.35, 401)
  addPassage(
    cells,
    [
      { x: 29, y: 32 },
      { x: 32, y: 34 },
      { x: 34, y: 36 },
    ],
    0.72,
    402,
  )
  addEllipse(cells, 23, 36.5, 1.7, 1.25, 403)
  addEllipse(cells, 37.5, 30, 1.35, 1.15, 404)
  return cells
}

function createDeepWaterCells(
  lake: ReadonlySet<string>,
  islands: ReadonlySet<string>,
): ReadonlySet<string> {
  const cells = new Set<string>()
  addEllipse(cells, 31, 34.5, 8.8, 6.7, 501)
  addEllipse(cells, 27, 32, 4.8, 4.5, 502)
  return new Set([...cells].filter((key) => lake.has(key) && !islands.has(key)))
}

function createMudCells(walkable: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  addEllipse(cells, 59, 39, 5.9, 4.4, 601)
  addEllipse(cells, 56.5, 37, 2.7, 2.3, 602)
  return new Set([...cells].filter((key) => walkable.has(key)))
}

function createWetStoneCells(walkable: ReadonlySet<string>): ReadonlySet<string> {
  const cells = new Set<string>()
  addEllipse(cells, 46.5, 26, 5.2, 3.6, 701)
  addEllipse(cells, 45, 33, 4.2, 3.2, 702)
  addEllipse(cells, 26, 11, 7.8, 2.8, 703)
  addEllipse(cells, 18, 39, 5.2, 4.1, 704)
  return new Set([...cells].filter((key) => walkable.has(key)))
}

export const naerytarWalkableCells = createWalkableCells()
export const naerytarLakeCells = createLakeCells(naerytarWalkableCells)
export const naerytarIslandCells = createIslandCells()
export const naerytarDeepWaterCells = createDeepWaterCells(naerytarLakeCells, naerytarIslandCells)
export const naerytarMudCells = createMudCells(naerytarWalkableCells)
export const naerytarWetStoneCells = createWetStoneCells(naerytarWalkableCells)

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
  const craneBlockers: readonly WallDefinition[] = [
    {
      id: 'naerytar-crane-post-west',
      a: { x: 37.7, y: 12.2 },
      b: { x: 37.7, y: 15.3 },
      blocksSight: false,
      blocksMovement: true,
    },
    {
      id: 'naerytar-crane-post-east',
      a: { x: 42.2, y: 12.2 },
      b: { x: 42.2, y: 15.3 },
      blocksSight: false,
      blocksMovement: true,
    },
  ]
  return [...caveBoundary, ...islandWalls, ...craneBlockers]
}

export function hasNaerytarCell(point: GridPoint): boolean {
  return naerytarWalkableCells.has(cellKey(Math.floor(point.x), Math.floor(point.y)))
}
