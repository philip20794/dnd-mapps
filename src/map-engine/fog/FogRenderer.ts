import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'
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
    const visibleCells = this.rasterizeVisibilityFields(visibilityFields, map, xCells)
    const exploredMask = state.persistExploration ? state.explored : null
    const pixels = this.imageData.data
    pixels.fill(0)

    for (let yIndex = 0; yIndex < yCells; yIndex += 1) {
      for (let xIndex = 0; xIndex < xCells; xIndex += 1) {
        const key = this.cellKey(xIndex, yIndex, xCells)
        const offset = key * 4
        const fade = visibleCells.get(key)
        const center = {
          x: xIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
          y: yIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
        }
        const explored = isExploredCell(
          exploredMask,
          Math.floor(center.x / FOG_CELL_SIZE),
          Math.floor(center.y / FOG_CELL_SIZE),
        )
        if (fade !== undefined) {
          pixels[offset] = explored ? 0 : 2
          pixels[offset + 1] = explored ? 0 : 4
          pixels[offset + 2] = explored ? 0 : 7
          pixels[offset + 3] = fogAlphaForVisibility(fade, explored)
          continue
        }

        pixels[offset] = explored ? 0 : 2
        pixels[offset + 1] = explored ? 0 : 4
        pixels[offset + 2] = explored ? 0 : 7
        pixels[offset + 3] = explored ? EXPLORED_FOG_ALPHA : UNKNOWN_FOG_ALPHA
      }
    }

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
      texture.source.scaleMode = 'nearest'
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

    const drawPaths = (): void => {
      for (const blocker of blockers) {
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
    this.hasVisibleBlockers = true
    overlay.visible = true
  }

  private rasterizeVisibilityFields(
    fields: readonly VisibilityField[],
    map: MapDefinition,
    xCells: number,
  ): Map<number, number> {
    const cells = new Map<number, number>()
    for (const field of fields) {
      this.rasterizeVisibilityFieldInto(cells, field, map, xCells)
    }
    return cells
  }

  private rasterizeVisibilityFieldInto(
    cells: Map<number, number>,
    field: VisibilityField,
    map: MapDefinition,
    xCells: number,
  ): void {
    const polygon = field.polygon
    if (polygon.length < 3) {
      return
    }

    const bounds = boundsForPolygon(polygon)
    const minX = Math.max(0, Math.floor(bounds.minX / FOG_RENDER_CELL_SIZE))
    const maxX = Math.min(xCells - 1, Math.ceil(bounds.maxX / FOG_RENDER_CELL_SIZE))
    const minY = Math.max(0, Math.floor(bounds.minY / FOG_RENDER_CELL_SIZE))
    const maxY = Math.min(
      Math.ceil(map.height / FOG_RENDER_CELL_SIZE) - 1,
      Math.ceil(bounds.maxY / FOG_RENDER_CELL_SIZE),
    )

    for (let yIndex = minY; yIndex <= maxY; yIndex += 1) {
      for (let xIndex = minX; xIndex <= maxX; xIndex += 1) {
        const center = {
          x: xIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
          y: yIndex * FOG_RENDER_CELL_SIZE + FOG_RENDER_CELL_SIZE / 2,
        }
        if (!polygonContainsPoint(polygon, center)) continue
        const fade = field.rangeBoundary
          ? visibilityRangeFadeAtPoint(field.rangeBoundary, center)
          : 0
        const key = this.cellKey(xIndex, yIndex, xCells)
        const existing = cells.get(key)
        if (existing === undefined || fade < existing) cells.set(key, fade)
      }
    }
  }

  private cellKey(xIndex: number, yIndex: number, xCells: number): number {
    return yIndex * xCells + xIndex
  }
}
