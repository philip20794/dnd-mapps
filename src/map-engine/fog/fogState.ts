import type { GridPoint, Polygon } from '@/types/geometry'

export const FOG_CELL_SIZE = 0.5

export interface ExplorationMask {
  readonly version: 1
  readonly cellSize: typeof FOG_CELL_SIZE
  readonly revision: number
  readonly cellCount: number
  readonly rows: Readonly<Record<string, readonly number[]>>
}

export interface FogStateData {
  enabled: boolean
  persistExploration: boolean
  exploredMasksByMap: Record<string, ExplorationMask>
}

interface LegacyFogStateData {
  readonly enabled?: unknown
  readonly persistExploration?: unknown
  readonly exploredByMap?: unknown
  readonly exploredMasksByMap?: unknown
}

export const defaultFogState: FogStateData = {
  enabled: false,
  persistExploration: true,
  exploredMasksByMap: {},
}

export function createEmptyExplorationMask(): ExplorationMask {
  return { version: 1, cellSize: FOG_CELL_SIZE, revision: 0, cellCount: 0, rows: {} }
}

function containsPoint(polygon: Polygon, point: GridPoint): boolean {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) continue
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) +
          current.x
    if (intersects) inside = !inside
  }
  return inside
}

function mergeCellIntoRuns(runs: number[], xIndex: number): boolean {
  for (let index = 0; index < runs.length; index += 2) {
    const start = runs[index]!
    const end = runs[index + 1]!
    if (xIndex >= start && xIndex <= end) return false
    if (xIndex === start - 1) {
      runs[index] = xIndex
      if (index >= 2 && runs[index - 1] === xIndex - 1) {
        runs[index - 1] = end
        runs.splice(index, 2)
      }
      return true
    }
    if (xIndex === end + 1) {
      runs[index + 1] = xIndex
      if (index + 2 < runs.length && runs[index + 2] === xIndex + 1) {
        runs[index + 1] = runs[index + 3]!
        runs.splice(index + 2, 2)
      }
      return true
    }
    if (xIndex < start - 1) {
      runs.splice(index, 0, xIndex, xIndex)
      return true
    }
  }
  runs.push(xIndex, xIndex)
  return true
}

function addPolygonToRows(
  rows: Record<string, readonly number[]>,
  polygon: Polygon,
  mutableRows: Map<string, number[]>,
): number {
  if (polygon.length < 3) return 0
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  const startX = Math.max(0, Math.floor(minX / FOG_CELL_SIZE))
  const endX = Math.max(startX, Math.ceil(maxX / FOG_CELL_SIZE))
  const startY = Math.max(0, Math.floor(minY / FOG_CELL_SIZE))
  const endY = Math.max(startY, Math.ceil(maxY / FOG_CELL_SIZE))
  let added = 0
  for (let yIndex = startY; yIndex <= endY; yIndex += 1) {
    const rowKey = String(yIndex)
    let runs = mutableRows.get(rowKey)
    for (let xIndex = startX; xIndex <= endX; xIndex += 1) {
      const center = {
        x: xIndex * FOG_CELL_SIZE + FOG_CELL_SIZE / 2,
        y: yIndex * FOG_CELL_SIZE + FOG_CELL_SIZE / 2,
      }
      if (!containsPoint(polygon, center)) continue
      if (!runs) {
        runs = [...(rows[rowKey] ?? [])]
        rows[rowKey] = runs
        mutableRows.set(rowKey, runs)
      }
      if (mergeCellIntoRuns(runs!, xIndex)) added += 1
    }
  }
  return added
}

export function addPolygonsToExplorationMask(
  mask: ExplorationMask,
  polygons: readonly Polygon[],
): ExplorationMask {
  if (polygons.length === 0) return mask
  const rows: Record<string, readonly number[]> = { ...mask.rows }
  const mutableRows = new Map<string, number[]>()
  let added = 0
  for (const polygon of polygons) added += addPolygonToRows(rows, polygon, mutableRows)
  if (added === 0) return mask
  return {
    version: 1,
    cellSize: FOG_CELL_SIZE,
    revision: mask.revision + 1,
    cellCount: mask.cellCount + added,
    rows,
  }
}

export function isExploredCell(
  mask: ExplorationMask | null,
  xIndex: number,
  yIndex: number,
): boolean {
  if (!mask) return false
  const runs = mask.rows[String(yIndex)] ?? []
  for (let index = 0; index < runs.length; index += 2) {
    const start = runs[index]!
    const end = runs[index + 1]!
    if (xIndex < start) return false
    if (xIndex <= end) return true
  }
  return false
}

export function explorationMaskFingerprint(mask: ExplorationMask | null): string {
  if (!mask) return 'none'
  return Object.keys(mask.rows)
    .sort((left, right) => Number(left) - Number(right))
    .map((row) => `${row}:${(mask.rows[row] ?? []).join(',')}`)
    .join(';')
}

export const recordExploration = (
  state: FogStateData,
  mapId: string,
  visiblePolygons: readonly Polygon[],
): FogStateData => {
  if (!state.persistExploration || visiblePolygons.length === 0) return state
  const existing = state.exploredMasksByMap[mapId] ?? createEmptyExplorationMask()
  const mask = addPolygonsToExplorationMask(existing, visiblePolygons)
  if (mask === existing) return state
  return {
    ...state,
    exploredMasksByMap: { ...state.exploredMasksByMap, [mapId]: mask },
  }
}

export const clearExplorationForMap = (state: FogStateData, mapId: string): FogStateData => {
  const { [mapId]: _removed, ...remaining } = state.exploredMasksByMap
  return { ...state, exploredMasksByMap: remaining }
}

function isExplorationMask(value: unknown): value is ExplorationMask {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ExplorationMask>
  return (
    candidate.version === 1 &&
    candidate.cellSize === FOG_CELL_SIZE &&
    typeof candidate.revision === 'number' &&
    typeof candidate.cellCount === 'number' &&
    typeof candidate.rows === 'object' &&
    candidate.rows !== null
  )
}

export function migrateFogState(value: unknown): FogStateData {
  const candidate = (value && typeof value === 'object' ? value : {}) as LegacyFogStateData
  const masks: Record<string, ExplorationMask> = {}
  if (candidate.exploredMasksByMap && typeof candidate.exploredMasksByMap === 'object') {
    for (const [key, mask] of Object.entries(candidate.exploredMasksByMap)) {
      if (isExplorationMask(mask)) masks[key] = mask
    }
  }
  if (candidate.exploredByMap && typeof candidate.exploredByMap === 'object') {
    for (const [key, polygons] of Object.entries(candidate.exploredByMap)) {
      if (!Array.isArray(polygons) || masks[key]) continue
      masks[key] = addPolygonsToExplorationMask(
        createEmptyExplorationMask(),
        polygons.filter(Array.isArray) as Polygon[],
      )
    }
  }
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : defaultFogState.enabled,
    persistExploration:
      typeof candidate.persistExploration === 'boolean'
        ? candidate.persistExploration
        : defaultFogState.persistExploration,
    exploredMasksByMap: masks,
  }
}

export const visibleAndExploredPolygons = (
  state: FogStateData,
  mapId: string,
  currentVisible: readonly Polygon[],
): { readonly visible: readonly Polygon[]; readonly explored: ExplorationMask | null } => ({
  visible: currentVisible,
  explored: state.persistExploration ? (state.exploredMasksByMap[mapId] ?? null) : null,
})
