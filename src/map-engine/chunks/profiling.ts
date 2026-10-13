import { createDefaultObjectRegistry, resolveMapObject } from '@/map-objects'
import { compileMaterialLayer } from '@/map-materials'
import { entryLevelId, getDefaultLevelId, type MapDefinition } from '@/maps/api'
import type { MapViewBounds } from './bounds'
import {
  chunksInView,
  createStaticObjectChunks,
  detailLevelForZoom,
  isStaticChunkCandidate,
  objectVisibleAtDetail,
} from './staticObjectChunks'

export interface MapRenderProfile {
  readonly mapObjects: number
  readonly staticObjects: number
  readonly dynamicObjects: number
  readonly materialChunks: number
  readonly staticChunks: number
  readonly visibleMaterialChunks: number
  readonly visibleStaticChunks: number
  readonly visibleStaticObjects: number
  readonly estimatedRenderableNodesBefore: number
  readonly estimatedRenderableNodesAfter: number
}

/** Pure CPU-side diagnostic. It is a stable proxy, not a browser FPS measurement. */
export const profileMapRendering = (
  map: MapDefinition,
  bounds: MapViewBounds,
  zoom: number,
  levelId = getDefaultLevelId(map),
): MapRenderProfile => {
  const registry = createDefaultObjectRegistry()
  const resolved = map.objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => entryLevelId(object, map) === levelId)
    .map(({ object, index }) => resolveMapObject(object, registry, index))
  const staticObjects = resolved.filter(isStaticChunkCandidate)
  const dynamicObjects = resolved.filter((object) => !isStaticChunkCandidate(object))
  const staticChunks = createStaticObjectChunks(staticObjects, map.width, map.height)
  const visibleStaticChunks = chunksInView(staticChunks, bounds)
  const detail = detailLevelForZoom(zoom)
  const visibleStaticObjects = visibleStaticChunks.flatMap((chunk) =>
    chunk.objects.filter((object) => objectVisibleAtDetail(object, detail, map.gridSize, zoom)),
  )
  const visibleStaticLayerRoots = visibleStaticChunks.reduce((sum, chunk) => {
    const layers = new Set(
      chunk.objects
        .filter((object) => objectVisibleAtDetail(object, detail, map.gridSize, zoom))
        .map((object) => object.layer),
    )
    return sum + layers.size
  }, 0)
  const materialChunks = (map.materialLayers ?? [])
    .filter((layer) => entryLevelId(layer, map) === levelId)
    .flatMap((layer) => compileMaterialLayer(layer, map.width, map.height))
  const visibleMaterialChunks = materialChunks.filter(
    (chunk) =>
      chunk.x < bounds.maxX &&
      chunk.x + chunk.width > bounds.minX &&
      chunk.y < bounds.maxY &&
      chunk.y + chunk.height > bounds.minY,
  )

  return {
    mapObjects: resolved.length,
    staticObjects: staticObjects.length,
    dynamicObjects: dynamicObjects.length,
    materialChunks: materialChunks.length,
    staticChunks: staticChunks.length,
    visibleMaterialChunks: visibleMaterialChunks.length,
    visibleStaticChunks: visibleStaticChunks.length,
    visibleStaticObjects: visibleStaticObjects.length,
    // Before: one MapObject runtime root plus three chunk containers and three Graphics.
    estimatedRenderableNodesBefore: resolved.length + materialChunks.length * 6,
    // After: off-screen chunks are not renderable; static details also use zoom-dependent LOD.
    estimatedRenderableNodesAfter:
      dynamicObjects.length +
      visibleStaticObjects.length +
      visibleStaticLayerRoots +
      visibleMaterialChunks.length * 6,
  }
}
