import type {
  MaterialAreaDefinition,
  MaterialDecalDefinition,
  MaterialLayerDefinition,
} from '@/map-materials'
import { entryLevelId } from '@/maps/api'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint } from '@/types/geometry'
import type { MapEditorSelection, MapEditorState, MaterialBrushSize } from './types'

export interface MaterialEditResult {
  readonly map: MapDefinition
  readonly dirtyChunks: ReadonlySet<string>
  readonly selection?: MapEditorSelection | null
}

type CellStyle = Omit<MaterialAreaDefinition, 'id' | 'position' | 'width' | 'height'>

const cellKey = (x: number, y: number): string => `${x},${y}`
const chunkKey = (layerId: string, x: number, y: number): string => `${layerId}:${x},${y}`
const brushRadius: Record<MaterialBrushSize, number> = { small: 0.65, medium: 1.45, large: 2.85 }

const activeLayers = (map: MapDefinition, levelId: string): readonly MaterialLayerDefinition[] =>
  (map.materialLayers ?? []).filter((layer) => entryLevelId(layer, map) === levelId)

const rasterize = (layer: MaterialLayerDefinition, map: MapDefinition): Map<string, CellStyle> => {
  const cells = new Map<string, CellStyle>()
  for (const area of layer.areas) {
    const minX = Math.max(0, Math.floor(area.position.x))
    const minY = Math.max(0, Math.floor(area.position.y))
    const maxX = Math.min(map.width, Math.ceil(area.position.x + area.width))
    const maxY = Math.min(map.height, Math.ceil(area.position.y + area.height))
    const { id: _id, position: _position, width: _width, height: _height, ...style } = area
    for (let y = minY; y < maxY; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        if (
          x + 1 > area.position.x &&
          y + 1 > area.position.y &&
          x < area.position.x + area.width &&
          y < area.position.y + area.height
        ) {
          cells.set(cellKey(x, y), style)
        }
      }
    }
  }
  return cells
}

const styleKey = (style: CellStyle): string => JSON.stringify(style)

/** Compacts equal adjacent cells into horizontal runs and merges matching runs vertically. */
export const compactMaterialCells = (
  cells: ReadonlyMap<string, CellStyle>,
  idPrefix: string,
): readonly MaterialAreaDefinition[] => {
  const rows = new Map<number, { x: number; width: number; style: CellStyle; key: string }[]>()
  const entries = [...cells.entries()]
    .map(([key, style]) => {
      const [x, y] = key.split(',').map(Number) as [number, number]
      return { x, y, style, key: styleKey(style) }
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
  for (const entry of entries) {
    const row = rows.get(entry.y) ?? []
    const last = row.at(-1)
    if (last && last.x + last.width === entry.x && last.key === entry.key) last.width += 1
    else row.push({ x: entry.x, width: 1, style: entry.style, key: entry.key })
    rows.set(entry.y, row)
  }

  const open = new Map<string, MaterialAreaDefinition>()
  const result: MaterialAreaDefinition[] = []
  const maxY = entries.at(-1)?.y ?? -1
  for (let y = 0; y <= maxY + 1; y += 1) {
    const currentKeys = new Set<string>()
    for (const run of rows.get(y) ?? []) {
      const key = `${run.x}:${run.width}:${run.key}`
      currentKeys.add(key)
      const previous = open.get(key)
      if (previous && previous.position.y + previous.height === y) {
        open.set(key, { ...previous, height: previous.height + 1 })
      } else {
        open.set(key, {
          id: '',
          ...run.style,
          position: { x: run.x, y },
          width: run.width,
          height: 1,
        })
      }
    }
    for (const [key, area] of open) {
      if (!currentKeys.has(key)) {
        result.push(area)
        open.delete(key)
      }
    }
  }
  return result.map((area, index) => ({ ...area, id: `${idPrefix}-area-${index + 1}` }))
}

export const sampleBrushCells = (
  points: readonly GridPoint[],
  size: MaterialBrushSize,
  map: Pick<MapDefinition, 'width' | 'height'>,
): ReadonlySet<string> => {
  const radius = brushRadius[size]
  const sampled = new Set<string>()
  const addDisc = (point: GridPoint): void => {
    const minX = Math.max(0, Math.floor(point.x - radius))
    const minY = Math.max(0, Math.floor(point.y - radius))
    const maxX = Math.min(map.width - 1, Math.floor(point.x + radius))
    const maxY = Math.min(map.height - 1, Math.floor(point.y + radius))
    for (let y = minY; y <= maxY; y += 1)
      for (let x = minX; x <= maxX; x += 1)
        if (Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) <= radius + 0.35)
          sampled.add(cellKey(x, y))
  }
  points.forEach((point, index) => {
    const previous = points[index - 1]
    if (!previous) return addDisc(point)
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    const steps = Math.max(1, Math.ceil(distance / Math.max(0.25, radius * 0.45)))
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps
      addDisc({
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
      })
    }
  })
  return sampled
}

const dirtyForCells = (
  layer: MaterialLayerDefinition,
  cells: ReadonlySet<string>,
): ReadonlySet<string> => {
  const size = Math.max(8, Math.min(32, Math.round(layer.chunkSize ?? 16)))
  const dirty = new Set<string>()
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number) as [number, number]
    for (const [candidateX, candidateY] of [
      [x, y],
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (candidateX < 0 || candidateY < 0) continue
      dirty.add(
        chunkKey(
          layer.id,
          Math.floor(candidateX / size) * size,
          Math.floor(candidateY / size) * size,
        ),
      )
    }
  }
  return dirty
}

const overlayId = (levelId: string): string =>
  `editor-material-${levelId.replace(/[^a-z0-9_-]/gi, '-')}`

export const paintMaterialStroke = (
  map: MapDefinition,
  levelId: string,
  points: readonly GridPoint[],
  state: MapEditorState,
): MaterialEditResult => {
  const painted = sampleBrushCells(points, state.brushSize ?? 'medium', map)
  const id = overlayId(levelId)
  const existing = (map.materialLayers ?? []).find((layer) => layer.id === id)
  const layer: MaterialLayerDefinition = existing ?? {
    id,
    levelId,
    seed: 0x6d617070,
    chunkSize: 16,
    areas: [],
    decals: [],
  }
  const cells = rasterize(layer, map)
  const style: CellStyle = {
    material: state.material ?? 'stone',
    ...(state.materialVariant === undefined ? {} : { variant: state.materialVariant }),
    rotation: state.materialRotation ?? 0,
    scale: state.materialScale ?? 1,
    alpha: state.materialAlpha ?? 1,
    ...(state.materialTint === undefined ? {} : { tint: state.materialTint }),
    ...(state.materialTransition === undefined ? {} : { transition: state.materialTransition }),
  }
  painted.forEach((key) => cells.set(key, style))
  const nextLayer = { ...layer, areas: compactMaterialCells(cells, id) }
  const layers = existing
    ? (map.materialLayers ?? []).map((candidate) => (candidate.id === id ? nextLayer : candidate))
    : [...(map.materialLayers ?? []), nextLayer]
  return { map: { ...map, materialLayers: layers }, dirtyChunks: dirtyForCells(nextLayer, painted) }
}

export const eraseMaterialStroke = (
  map: MapDefinition,
  levelId: string,
  points: readonly GridPoint[],
  size: MaterialBrushSize,
): MaterialEditResult => {
  const erased = sampleBrushCells(points, size, map)
  const layers = [...(map.materialLayers ?? [])]
  const rasterized = new Map<string, Map<string, CellStyle>>()
  const changed = new Set<string>()
  for (const key of erased) {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index]!
      if (entryLevelId(layer, map) !== levelId) continue
      const cells = rasterized.get(layer.id) ?? rasterize(layer, map)
      rasterized.set(layer.id, cells)
      if (cells.delete(key)) {
        changed.add(layer.id)
        break
      }
    }
  }
  const dirty = new Set<string>()
  const nextLayers = layers.map((layer) => {
    if (!changed.has(layer.id)) return layer
    dirtyForCells(layer, erased).forEach((key) => dirty.add(key))
    return { ...layer, areas: compactMaterialCells(rasterized.get(layer.id)!, layer.id) }
  })
  return { map: { ...map, materialLayers: nextLayers }, dirtyChunks: dirty }
}

const uniqueDecalId = (map: MapDefinition): string => {
  const ids = new Set(
    (map.materialLayers ?? []).flatMap((layer) => (layer.decals ?? []).map((decal) => decal.id)),
  )
  let index = 1
  while (ids.has(`material-decal-${index}`)) index += 1
  return `material-decal-${index}`
}

export const placeMaterialDecal = (
  map: MapDefinition,
  levelId: string,
  point: GridPoint,
  state: MapEditorState,
): MaterialEditResult => {
  const id = overlayId(levelId)
  const existing = (map.materialLayers ?? []).find((layer) => layer.id === id)
  const layer: MaterialLayerDefinition = existing ?? {
    id,
    levelId,
    seed: 0x6d617070,
    chunkSize: 16,
    areas: [],
    decals: [],
  }
  const decalId = uniqueDecalId(map)
  const extent = state.brushSize === 'large' ? 3 : state.brushSize === 'medium' ? 2 : 1
  const decalScale = state.materialScale ?? 1
  const decal: MaterialDecalDefinition = {
    id: decalId,
    kind: state.decalKind ?? 'crack',
    position: {
      x: Math.max(0, Math.min(map.width - extent * decalScale, point.x)),
      y: Math.max(0, Math.min(map.height - extent * decalScale, point.y)),
    },
    width: extent,
    height: extent,
    rotation: ((state.materialRotation ?? 0) * Math.PI) / 180,
    scale: decalScale,
    alpha: state.materialAlpha ?? 1,
  }
  const next = { ...layer, decals: [...(layer.decals ?? []), decal] }
  const layers = existing
    ? (map.materialLayers ?? []).map((candidate) => (candidate.id === id ? next : candidate))
    : [...(map.materialLayers ?? []), next]
  const cells = sampleBrushCells([point], state.brushSize ?? 'medium', map)
  return {
    map: { ...map, materialLayers: layers },
    dirtyChunks: dirtyForCells(next, cells),
    selection: { kind: 'material-decal', id: decalId, layerId: id },
  }
}

export const findMaterialSelection = (
  map: MapDefinition,
  levelId: string,
  point: GridPoint,
): MapEditorSelection | null => {
  for (const layer of [...activeLayers(map, levelId)].reverse()) {
    for (const decal of [...(layer.decals ?? [])].reverse()) {
      if (
        point.x >= decal.position.x &&
        point.y >= decal.position.y &&
        point.x <= decal.position.x + (decal.width ?? 1) * (decal.scale ?? 1) &&
        point.y <= decal.position.y + (decal.height ?? 1) * (decal.scale ?? 1) &&
        decal.id
      )
        return { kind: 'material-decal', id: decal.id, layerId: layer.id }
    }
    for (const area of [...layer.areas].reverse()) {
      if (
        point.x >= area.position.x &&
        point.y >= area.position.y &&
        point.x <= area.position.x + area.width &&
        point.y <= area.position.y + area.height &&
        area.id
      )
        return { kind: 'material-area', id: area.id, layerId: layer.id }
    }
  }
  return null
}

export const updateMaterialArea = (
  map: MapDefinition,
  layerId: string,
  id: string,
  patch: Partial<MaterialAreaDefinition>,
): MapDefinition => ({
  ...map,
  materialLayers: (map.materialLayers ?? []).map((layer) =>
    layer.id === layerId
      ? {
          ...layer,
          areas: layer.areas.map((area) => (area.id === id ? { ...area, ...patch, id } : area)),
        }
      : layer,
  ),
})

export const updateMaterialDecal = (
  map: MapDefinition,
  layerId: string,
  id: string,
  patch: Partial<MaterialDecalDefinition>,
): MapDefinition => ({
  ...map,
  materialLayers: (map.materialLayers ?? []).map((layer) =>
    layer.id === layerId
      ? {
          ...layer,
          decals: (layer.decals ?? []).map((decal) =>
            decal.id === id ? { ...decal, ...patch, id } : decal,
          ),
        }
      : layer,
  ),
})

export const deleteMaterialSelection = (
  map: MapDefinition,
  selection: MapEditorSelection,
): MapDefinition => {
  if (selection.kind !== 'material-area' && selection.kind !== 'material-decal') return map
  return {
    ...map,
    materialLayers: (map.materialLayers ?? []).map((layer) =>
      layer.id !== selection.layerId
        ? layer
        : selection.kind === 'material-area'
          ? { ...layer, areas: layer.areas.filter((area) => area.id !== selection.id) }
          : { ...layer, decals: (layer.decals ?? []).filter((decal) => decal.id !== selection.id) },
    ),
  }
}
