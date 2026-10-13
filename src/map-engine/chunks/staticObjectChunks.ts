import type { MapLayerName, ResolvedMapObject } from '@/map-objects'
import { boundsIntersect, chunkKey, type ChunkBounds, type MapViewBounds } from './bounds'

export const STATIC_CHUNK_SIZE = 16

const staticLayers = new Set<MapLayerName>(['floor', 'terrainStatic', 'objectsStatic'])

export interface StaticObjectChunk extends ChunkBounds {
  readonly objects: readonly ResolvedMapObject[]
  readonly layers: readonly MapLayerName[]
}

export const isStaticChunkCandidate = (object: ResolvedMapObject): boolean =>
  object.visible &&
  staticLayers.has(object.layer) &&
  object.light === null &&
  object.animation === null &&
  object.water === null &&
  object.transition === undefined &&
  !object.sparks &&
  object.interactionState === 'idle'

export const createStaticObjectChunks = (
  objects: readonly ResolvedMapObject[],
  mapWidth: number,
  mapHeight: number,
  chunkSize = STATIC_CHUNK_SIZE,
): readonly StaticObjectChunk[] => {
  const normalizedSize = Math.max(8, Math.min(32, Math.round(chunkSize)))
  const groups = new Map<string, ResolvedMapObject[]>()
  objects.forEach((object) => {
    const centerX = object.position.x + object.width / 2
    const centerY = object.position.y + object.height / 2
    const x = Math.max(0, Math.floor(centerX / normalizedSize) * normalizedSize)
    const y = Math.max(0, Math.floor(centerY / normalizedSize) * normalizedSize)
    const key = chunkKey(x, y)
    groups.set(key, [...(groups.get(key) ?? []), object])
  })
  return [...groups.entries()]
    .map(([key, chunkObjects]) => {
      const [x, y] = key.split(',').map(Number) as [number, number]
      const width = Math.min(normalizedSize, mapWidth - x)
      const height = Math.min(normalizedSize, mapHeight - y)
      return {
        key,
        x,
        y,
        width,
        height,
        minX: x,
        minY: y,
        maxX: x + width,
        maxY: y + height,
        objects: chunkObjects,
        layers: [...new Set(chunkObjects.map((object) => object.layer))],
      }
    })
    .sort((left, right) => left.y - right.y || left.x - right.x)
}

export const chunksInView = <TChunk extends ChunkBounds>(
  chunks: readonly TChunk[],
  bounds: MapViewBounds,
): readonly TChunk[] => chunks.filter((chunk) => boundsIntersect(chunk, bounds))

export type StaticDetailLevel = 'overview' | 'normal' | 'detail'

export const detailLevelForZoom = (zoom: number): StaticDetailLevel =>
  zoom < 0.32 ? 'overview' : zoom < 0.58 ? 'normal' : 'detail'

const importantTags = new Set([
  'set-dressing',
  'outdoor-landmark',
  'level-transition',
  'dungeon-room',
])

export const objectVisibleAtDetail = (
  object: ResolvedMapObject,
  detail: StaticDetailLevel,
  gridSize: number,
  zoom: number,
): boolean => {
  if (detail === 'detail' || object.tags.some((tag) => importantTags.has(tag))) return true
  const apparentSize = Math.max(object.width, object.height) * gridSize * zoom
  return apparentSize >= (detail === 'overview' ? 18 : 9)
}
