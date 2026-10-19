import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'
import { drawWallSurfaces } from '@/map-engine/walls/WallRenderer'
import { selectVisibleWallSections } from '@/map-engine/walls/wallGeometry'
import {
  combineVisibleBlockers,
  polygonContainsPoint,
  type VisibilityField,
  type VisibilityRangeBoundary,
} from '@/map-engine/visibility/visibility'
import {
  FOG_CELL_SIZE,
  explorationMaskFingerprint,
  isExploredCell,
  type ExplorationMask,
} from './fogState'

export const FOG_RENDER_CELL_SIZE = 0.25
export const VISIBILITY_FADE_WIDTH = 1
export const EXPLORED_FOG_ALPHA = 148
export const UNKNOWN_FOG_ALPHA = 255
export const VISIBLE_BLOCKER_OUTLINE_WIDTH = 0.075
export const VISIBLE_BLOCKER_HIGHLIGHT_WIDTH = 0.03
export const FOG_FADE_SCALE = 65_534
export const FOG_INVISIBLE_CELL = 65_535
export const FOG_TEXTURE_SCALE_MODE = 'linear' as const
const FOG_RENDER_CELLS_PER_EXPLORATION_CELL = Math.round(FOG_CELL_SIZE / FOG_RENDER_CELL_SIZE)

export const fogAlphaForVisibility = (fade: number, explored: boolean): number =>
  Math.round((explored ? EXPLORED_FOG_ALPHA : UNKNOWN_FOG_ALPHA) * fade)

export const fogPolygonFingerprint = (polygon: Polygon): string =>
  polygon.map((point) => `${point.x},${point.y}`).join(';')

export const fogPolygonsFingerprint = (polygons: readonly Polygon[]): string =>
  polygons.map(fogPolygonFingerprint).join('|')

export const fogVisibilityFieldsFingerprint = (fields: readonly VisibilityField[]): string =>
  fields
    .map((field) => {
      const boundary = field.rangeBoundary
      const blockers = (field.visibleBlockers ?? [])
        .map(
          ({ blockerId, visibleSegment }) =>
            `${blockerId}:${visibleSegment.a.x},${visibleSegment.a.y},${visibleSegment.b.x},${visibleSegment.b.y}`,
        )
        .join(',')
      return `${fogPolygonFingerprint(field.polygon)}:${boundary ? `${boundary.origin.x},${boundary.origin.y},${boundary.range}` : 'hard'}:${blockers}`
    })
    .join('|')

export const visibilityRangeFadeAtPoint = (
  boundary: VisibilityRangeBoundary,
  point: GridPoint,
  fadeWidth = VISIBILITY_FADE_WIDTH,
): number => {
  const distance = Math.hypot(point.x - boundary.origin.x, point.y - boundary.origin.y)
  const effectiveWidth = Math.min(Math.max(0.01, fadeWidth), boundary.range)
  const fadeStart = boundary.range - effectiveWidth
  const linear = Math.max(0, Math.min(1, (distance - fadeStart) / effectiveWidth))
  return linear * linear * (3 - 2 * linear)
}

const visibilityRangeFadeAtCoordinates = (
  boundary: VisibilityRangeBoundary,
  x: number,
  y: number,
): number => {
  const distance = Math.hypot(x - boundary.origin.x, y - boundary.origin.y)
  const effectiveWidth = Math.min(Math.max(0.01, VISIBILITY_FADE_WIDTH), boundary.range)
  const linear = Math.max(
    0,
    Math.min(1, (distance - (boundary.range - effectiveWidth)) / effectiveWidth),
  )
  return linear * linear * (3 - 2 * linear)
}

export const visibilityFieldsFadeAtPoint = (
  fields: readonly VisibilityField[],
  point: GridPoint,
): number | null => {
  let bestFade: number | null = null
  for (const field of fields) {
    if (!polygonContainsPoint(field.polygon, point)) continue
    const fade = field.rangeBoundary ? visibilityRangeFadeAtPoint(field.rangeBoundary, point) : 0
    bestFade = bestFade === null ? fade : Math.min(bestFade, fade)
  }
  return bestFade
}

const boundsForPolygon = (
  polygon: Polygon,
): {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
} => {
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

  return { minX, maxX, minY, maxY }
}

export const rasterizeVisibilityFieldsScanline = (
  fields: readonly VisibilityField[],
  mapWidth: number,
  mapHeight: number,
  target?: Uint16Array,
): Uint16Array => {
  const xCells = Math.ceil(mapWidth / FOG_RENDER_CELL_SIZE)
  const yCells = Math.ceil(mapHeight / FOG_RENDER_CELL_SIZE)
  const cells = target?.length === xCells * yCells ? target : new Uint16Array(xCells * yCells)
  cells.fill(FOG_INVISIBLE_CELL)
  const halfCell = FOG_RENDER_CELL_SIZE / 2
  const intersections: number[] = []

  for (const field of fields) {
    const polygon = field.polygon
    if (polygon.length < 3) continue
    const bounds = boundsForPolygon(polygon)
    const minX = Math.max(0, Math.floor(bounds.minX / FOG_RENDER_CELL_SIZE))
    const maxX = Math.min(xCells - 1, Math.ceil(bounds.maxX / FOG_RENDER_CELL_SIZE))
    const minY = Math.max(0, Math.floor(bounds.minY / FOG_RENDER_CELL_SIZE))
    const maxY = Math.min(yCells - 1, Math.ceil(bounds.maxY / FOG_RENDER_CELL_SIZE))

    for (let yIndex = minY; yIndex <= maxY; yIndex += 1) {
      const y = yIndex * FOG_RENDER_CELL_SIZE + halfCell
      intersections.length = 0
      for (
        let index = 0, previousIndex = polygon.length - 1;
        index < polygon.length;
        previousIndex = index, index += 1
      ) {
        const current = polygon[index]!
        const previous = polygon[previousIndex]!
        if (current.y > y === previous.y > y) continue
        intersections.push(
          current.x + ((y - current.y) * (previous.x - current.x)) / (previous.y - current.y),
        )
      }
      intersections.sort((left, right) => left - right)

      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const left = intersections[index]!
        const right = intersections[index + 1]!
        const startX = Math.max(minX, Math.ceil((left - halfCell) / FOG_RENDER_CELL_SIZE))
        const endX = Math.min(maxX, Math.ceil((right - halfCell) / FOG_RENDER_CELL_SIZE) - 1)
        for (let xIndex = startX; xIndex <= endX; xIndex += 1) {
          const x = xIndex * FOG_RENDER_CELL_SIZE + halfCell
          const fade = field.rangeBoundary
            ? visibilityRangeFadeAtCoordinates(field.rangeBoundary, x, y)
            : 0
          const encodedFade = Math.round(fade * FOG_FADE_SCALE)
          const key = yIndex * xCells + xIndex
          if (encodedFade < cells[key]!) cells[key] = encodedFade
        }
      }
    }
  }
  return cells
}

/**
 * Linear texture filtering is needed to hide the quarter-cell steps in the
 * radial fade. At a hard polygon edge, though, it would otherwise interpolate
 * a visible texel into the hidden side. Making the innermost edge texel fully
 * fogged moves that interpolation entirely inside the calculated visibility
 * polygon. The immutable visibility raster remains the source of truth, so
 * overlaps are guarded only at the outer edge of their combined visible area.
 */
export const isFilteredVisibilityEdgeCell = (
  cells: Uint16Array,
  xIndex: number,
  yIndex: number,
  xCells: number,
  yCells: number,
): boolean => {
  const key = yIndex * xCells + xIndex
  if (cells[key] === FOG_INVISIBLE_CELL) return false

  const minX = Math.max(0, xIndex - 1)
  const maxX = Math.min(xCells - 1, xIndex + 1)
  const minY = Math.max(0, yIndex - 1)
  const maxY = Math.min(yCells - 1, yIndex + 1)
  for (let neighborY = minY; neighborY <= maxY; neighborY += 1) {
    const rowOffset = neighborY * xCells
    for (let neighborX = minX; neighborX <= maxX; neighborX += 1) {
      if (cells[rowOffset + neighborX] === FOG_INVISIBLE_CELL) return true
    }
  }
  return false
}

export const visibilityFadeForFilteredCell = (
  cells: Uint16Array,
  xIndex: number,
  yIndex: number,
  xCells: number,
  yCells: number,
): number => {
  const encodedFade = cells[yIndex * xCells + xIndex]!
  return isFilteredVisibilityEdgeCell(cells, xIndex, yIndex, xCells, yCells)
    ? FOG_FADE_SCALE
    : encodedFade
}

const hasUnexploredRenderNeighbor = (
  exploredMask: ExplorationMask | null,
  xIndex: number,
  yIndex: number,
  xCells: number,
  yCells: number,
): boolean => {
  const explorationX = Math.floor(xIndex / FOG_RENDER_CELLS_PER_EXPLORATION_CELL)
  const explorationY = Math.floor(yIndex / FOG_RENDER_CELLS_PER_EXPLORATION_CELL)
  const localX = xIndex % FOG_RENDER_CELLS_PER_EXPLORATION_CELL
  const localY = yIndex % FOG_RENDER_CELLS_PER_EXPLORATION_CELL
  const adjacentExplorationX =
    localX === 0 && xIndex > 0
      ? explorationX - 1
      : localX === FOG_RENDER_CELLS_PER_EXPLORATION_CELL - 1 && xIndex < xCells - 1
        ? explorationX + 1
        : explorationX
  const adjacentExplorationY =
    localY === 0 && yIndex > 0
      ? explorationY - 1
      : localY === FOG_RENDER_CELLS_PER_EXPLORATION_CELL - 1 && yIndex < yCells - 1
        ? explorationY + 1
        : explorationY

  return (
    (adjacentExplorationX !== explorationX &&
      !isExploredCell(exploredMask, adjacentExplorationX, explorationY)) ||
    (adjacentExplorationY !== explorationY &&
      !isExploredCell(exploredMask, explorationX, adjacentExplorationY)) ||
    (adjacentExplorationX !== explorationX &&
      adjacentExplorationY !== explorationY &&
      !isExploredCell(exploredMask, adjacentExplorationX, adjacentExplorationY))
  )
}

export const writeFogPixels = (
  visibleCells: Uint16Array,
  xCells: number,
  yCells: number,
  exploredMask: ExplorationMask | null,
  pixels: Uint8ClampedArray,
  protectFilteredEdges = true,
): void => {
  for (let yIndex = 0; yIndex < yCells; yIndex += 1) {
    const explorationY = Math.floor((yIndex * FOG_RENDER_CELL_SIZE) / FOG_CELL_SIZE)
    for (let xIndex = 0; xIndex < xCells; xIndex += 1) {
      const key = yIndex * xCells + xIndex
      const offset = key * 4
      const guardedEdge =
        protectFilteredEdges &&
        isFilteredVisibilityEdgeCell(visibleCells, xIndex, yIndex, xCells, yCells)
      const encodedFade = guardedEdge ? FOG_FADE_SCALE : visibleCells[key]!
      const explored = isExploredCell(
        exploredMask,
        Math.floor((xIndex * FOG_RENDER_CELL_SIZE) / FOG_CELL_SIZE),
        explorationY,
      )
      pixels[offset] = explored ? 0 : 2
      pixels[offset + 1] = explored ? 0 : 4
      pixels[offset + 2] = explored ? 0 : 7
      let alpha =
        encodedFade === FOG_INVISIBLE_CELL
          ? explored
            ? EXPLORED_FOG_ALPHA
            : UNKNOWN_FOG_ALPHA
          : fogAlphaForVisibility(encodedFade / FOG_FADE_SCALE, explored)
      if (guardedEdge && alpha < UNKNOWN_FOG_ALPHA) {
        const minX = Math.max(0, xIndex - 1)
        const maxX = Math.min(xCells - 1, xIndex + 1)
        const minY = Math.max(0, yIndex - 1)
        const maxY = Math.min(yCells - 1, yIndex + 1)
        hiddenNeighbors: for (let neighborY = minY; neighborY <= maxY; neighborY += 1) {
          const explorationNeighborY = Math.floor(
            (neighborY * FOG_RENDER_CELL_SIZE) / FOG_CELL_SIZE,
          )
          for (let neighborX = minX; neighborX <= maxX; neighborX += 1) {
            if (visibleCells[neighborY * xCells + neighborX] !== FOG_INVISIBLE_CELL) continue
            const neighborExplored = isExploredCell(
              exploredMask,
              Math.floor((neighborX * FOG_RENDER_CELL_SIZE) / FOG_CELL_SIZE),
              explorationNeighborY,
            )
            if (!neighborExplored) {
              alpha = UNKNOWN_FOG_ALPHA
              break hiddenNeighbors
            }
          }
        }
      }
      if (
        encodedFade === FOG_INVISIBLE_CELL &&
        explored &&
        hasUnexploredRenderNeighbor(exploredMask, xIndex, yIndex, xCells, yCells)
      ) {
        alpha = UNKNOWN_FOG_ALPHA
      }
      pixels[offset + 3] = alpha
    }
  }
}

export interface FogRenderState {
  readonly enabled: boolean
  readonly persistExploration: boolean
  readonly visible: readonly Polygon[]
  readonly visibilityFields?: readonly VisibilityField[]
  readonly explored: ExplorationMask | null
}

export class FogRenderer {
  private currentTexture: Texture | null = null
  private currentSprite: Sprite | null = null
  private blockerOverlay: Graphics | null = null
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private imageData: ImageData | null = null
  private renderedStateKey: string | null = null
  private hasVisibleBlockers = false
  private visibilityCells: Uint16Array | null = null

  public render(layer: Container, map: MapDefinition, state: FogRenderState): void {
    if (!state.enabled) {
      if (this.currentSprite) this.currentSprite.visible = false
      if (this.blockerOverlay) this.blockerOverlay.visible = false
      this.renderedStateKey = null
      return
    }

    const xCells = Math.ceil(map.width / FOG_RENDER_CELL_SIZE)
    const yCells = Math.ceil(map.height / FOG_RENDER_CELL_SIZE)
    const mapKey = `${map.id}:${map.width}:${map.height}:${map.gridSize}:${FOG_RENDER_CELL_SIZE}`
    const exploredKey = state.persistExploration
      ? explorationMaskFingerprint(state.explored)
      : 'none'
    const visibilityFields =
      state.visibilityFields ?? state.visible.map((polygon): VisibilityField => ({ polygon }))
    const stateKey = `${mapKey}:${state.persistExploration ? 1 : 0}:${fogVisibilityFieldsFingerprint(visibilityFields)}:${exploredKey}`
    if (stateKey === this.renderedStateKey && this.currentSprite) {
      this.currentSprite.visible = true
      if (this.currentSprite.parent !== layer) layer.addChild(this.currentSprite)
      if (this.blockerOverlay) {
        this.blockerOverlay.visible = this.hasVisibleBlockers
        if (this.blockerOverlay.parent !== layer) layer.addChild(this.blockerOverlay)
      }
      return
    }

    this.ensureResources(layer, map, xCells, yCells)
    if (!this.context || !this.imageData || !this.currentTexture || !this.currentSprite) return
    this.visibilityCells = rasterizeVisibilityFieldsScanline(
      visibilityFields,
      map.width,
      map.height,
      this.visibilityCells ?? undefined,
    )
    const visibleCells = this.visibilityCells
    const exploredMask = state.persistExploration ? state.explored : null
    writeFogPixels(visibleCells, xCells, yCells, exploredMask, this.imageData.data)

    this.context.putImageData(this.imageData, 0, 0)
    this.currentTexture.source.update()
    this.currentSprite.visible = true
    this.renderVisibleBlockers(visibilityFields, map)
    this.renderedStateKey = stateKey
  }

  public destroy(): void {
    this.currentSprite?.removeFromParent()
    this.currentSprite?.destroy()
    this.blockerOverlay?.removeFromParent()
    this.blockerOverlay?.destroy()
    this.currentTexture?.destroy(true)
    this.currentSprite = null
    this.blockerOverlay = null
    this.currentTexture = null
    this.canvas = null
    this.context = null
    this.imageData = null
    this.renderedStateKey = null
    this.hasVisibleBlockers = false
    this.visibilityCells = null
  }

  private ensureResources(
    layer: Container,
    map: MapDefinition,
    xCells: number,
    yCells: number,
  ): void {
    const resourcesMatch =
      this.canvas?.width === xCells &&
      this.canvas.height === yCells &&
      this.currentTexture !== null &&
      this.currentSprite !== null &&
      this.blockerOverlay !== null
    if (!resourcesMatch) {
      this.destroy()
      const canvas = document.createElement('canvas')
      canvas.width = xCells
      canvas.height = yCells
      const context = canvas.getContext('2d')
      if (!context) return
      const texture = Texture.from(canvas)
      texture.source.scaleMode = FOG_TEXTURE_SCALE_MODE
      const sprite = new Sprite(texture)
      sprite.eventMode = 'none'
      const blockerOverlay = new Graphics()
      blockerOverlay.eventMode = 'none'
      this.canvas = canvas
      this.context = context
      this.imageData = context.createImageData(xCells, yCells)
      this.currentTexture = texture
      this.currentSprite = sprite
      this.blockerOverlay = blockerOverlay
    }
    if (!this.currentSprite) return
    this.currentSprite.width = map.width * map.gridSize
    this.currentSprite.height = map.height * map.gridSize
    if (this.currentSprite.parent !== layer) layer.addChild(this.currentSprite)
    const blockerOverlay = this.blockerOverlay
    if (blockerOverlay && blockerOverlay.parent !== layer) layer.addChild(blockerOverlay)
  }

  private renderVisibleBlockers(fields: readonly VisibilityField[], map: MapDefinition): void {
    const overlay = this.blockerOverlay
    if (!overlay) return
    overlay.clear()
    const blockers = combineVisibleBlockers(fields)
    if (blockers.length === 0) {
      this.hasVisibleBlockers = false
      overlay.visible = false
      return
    }

    const visibleWallSections = selectVisibleWallSections(map.walls, blockers)
    const decoratedIds = new Set(visibleWallSections.map((section) => section.blockerId))
    drawWallSurfaces(overlay, visibleWallSections, map.gridSize)
    // Plain line-only blockers and closed doors keep their existing high-contrast outline.
    const outlineBlockers = blockers.filter((blocker) => !decoratedIds.has(blocker.blockerId))
    const drawPaths = (): void => {
      for (const blocker of outlineBlockers) {
        overlay
          .moveTo(
            blocker.visibleSegment.a.x * map.gridSize,
            blocker.visibleSegment.a.y * map.gridSize,
          )
          .lineTo(
            blocker.visibleSegment.b.x * map.gridSize,
            blocker.visibleSegment.b.y * map.gridSize,
          )
      }
    }

    if (outlineBlockers.length > 0) {
      drawPaths()
      overlay.stroke({
      color: 0x20170f,
      width: Math.max(2, map.gridSize * VISIBLE_BLOCKER_OUTLINE_WIDTH),
      alpha: 0.92,
    })
    drawPaths()
    overlay.stroke({
      color: 0xffe2a3,
      width: Math.max(1.25, map.gridSize * VISIBLE_BLOCKER_HIGHLIGHT_WIDTH),
      alpha: 0.98,
    })
    }
    this.hasVisibleBlockers = true
    overlay.visible = true
  }
}
