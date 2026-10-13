import { Container, Sprite, Texture } from 'pixi.js'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'

const FOG_CELL_SIZE = 0.5

export const fogPolygonFingerprint = (polygon: Polygon): string =>
  polygon.map((point) => `${point.x},${point.y}`).join(';')

export const fogPolygonsFingerprint = (polygons: readonly Polygon[]): string =>
  polygons.map(fogPolygonFingerprint).join('|')

const containsPoint = (polygon: Polygon, point: GridPoint): boolean => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) {
      continue
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
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
  readonly explored: readonly Polygon[]
}

export class FogRenderer {
  private exploredCells = new Set<number>()
  private cachedMapKey: string | null = null
  private cachedExploredFingerprints: readonly string[] = []
  private currentTexture: Texture | null = null
  private currentSprite: Sprite | null = null
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private imageData: ImageData | null = null
  private renderedStateKey: string | null = null

  public render(layer: Container, map: MapDefinition, state: FogRenderState): void {
    if (!state.enabled) {
      if (this.currentSprite) this.currentSprite.visible = false
      this.renderedStateKey = null
      return
    }

    const xCells = Math.ceil(map.width / FOG_CELL_SIZE)
    const yCells = Math.ceil(map.height / FOG_CELL_SIZE)
    const mapKey = `${map.id}:${map.width}:${map.height}:${map.gridSize}:${FOG_CELL_SIZE}`
    const stateKey = `${mapKey}:${state.persistExploration ? 1 : 0}:${fogPolygonsFingerprint(state.visible)}:${state.persistExploration ? fogPolygonsFingerprint(state.explored) : ''}`
    if (stateKey === this.renderedStateKey && this.currentSprite) {
      this.currentSprite.visible = true
      if (this.currentSprite.parent !== layer) layer.addChild(this.currentSprite)
      return
    }

    this.ensureResources(layer, map, xCells, yCells, mapKey)
    if (!this.context || !this.imageData || !this.currentTexture || !this.currentSprite) return
    const visibleCells = this.rasterizePolygons(state.visible, map, xCells)
    const exploredCells = state.persistExploration
      ? this.exploredCellsFor(map, state.explored, xCells)
      : new Set<number>()
    const pixels = this.imageData.data
    pixels.fill(0)

    for (let yIndex = 0; yIndex < yCells; yIndex += 1) {
      for (let xIndex = 0; xIndex < xCells; xIndex += 1) {
        const key = this.cellKey(xIndex, yIndex, xCells)
        const offset = key * 4
        if (visibleCells.has(key)) {
          pixels[offset + 3] = 0
          continue
        }

        const explored = exploredCells.has(key)
        pixels[offset] = explored ? 0 : 2
        pixels[offset + 1] = explored ? 0 : 4
        pixels[offset + 2] = explored ? 0 : 7
        pixels[offset + 3] = explored ? 148 : 255
      }
    }

    this.context.putImageData(this.imageData, 0, 0)
    this.currentTexture.source.update()
    this.currentSprite.visible = true
    this.renderedStateKey = stateKey
  }

  public destroy(): void {
    this.currentSprite?.removeFromParent()
    this.currentSprite?.destroy()
    this.currentTexture?.destroy(true)
    this.currentSprite = null
    this.currentTexture = null
    this.canvas = null
    this.context = null
    this.imageData = null
    this.renderedStateKey = null
  }

  private ensureResources(
    layer: Container,
    map: MapDefinition,
    xCells: number,
    yCells: number,
    mapKey: string,
  ): void {
    const resourcesMatch =
      this.canvas?.width === xCells &&
      this.canvas.height === yCells &&
      this.currentTexture !== null &&
      this.currentSprite !== null
    if (!resourcesMatch) {
      this.destroy()
      const canvas = document.createElement('canvas')
      canvas.width = xCells
      canvas.height = yCells
      const context = canvas.getContext('2d')
      if (!context) return
      const texture = Texture.from(canvas)
      const sprite = new Sprite(texture)
      sprite.eventMode = 'none'
      this.canvas = canvas
      this.context = context
      this.imageData = context.createImageData(xCells, yCells)
      this.currentTexture = texture
      this.currentSprite = sprite
    }
    if (!this.currentSprite) return
    this.currentSprite.width = map.width * map.gridSize
    this.currentSprite.height = map.height * map.gridSize
    if (this.currentSprite.parent !== layer) layer.addChild(this.currentSprite)
    if (this.cachedMapKey !== mapKey) {
      this.exploredCells = new Set<number>()
      this.cachedExploredFingerprints = []
      this.cachedMapKey = mapKey
    }
  }

  private exploredCellsFor(
    map: MapDefinition,
    explored: readonly Polygon[],
    xCells: number,
  ): ReadonlySet<number> {
    const fingerprints = explored.map(fogPolygonFingerprint)
    let commonPrefixLength = 0
    while (
      commonPrefixLength < this.cachedExploredFingerprints.length &&
      commonPrefixLength < fingerprints.length &&
      this.cachedExploredFingerprints[commonPrefixLength] === fingerprints[commonPrefixLength]
    ) {
      commonPrefixLength += 1
    }
    if (commonPrefixLength < this.cachedExploredFingerprints.length) {
      this.exploredCells = new Set<number>()
      commonPrefixLength = 0
    }

    const additions = explored.slice(commonPrefixLength)
    for (const polygon of additions) {
      this.rasterizePolygonInto(this.exploredCells, polygon, map, xCells)
    }

    this.cachedExploredFingerprints = fingerprints
    return this.exploredCells
  }

  private rasterizePolygons(
    polygons: readonly Polygon[],
    map: MapDefinition,
    xCells: number,
  ): Set<number> {
    const cells = new Set<number>()
    for (const polygon of polygons) {
      this.rasterizePolygonInto(cells, polygon, map, xCells)
    }
    return cells
  }

  private rasterizePolygonInto(
    cells: Set<number>,
    polygon: Polygon,
    map: MapDefinition,
    xCells: number,
  ): void {
    if (polygon.length < 3) {
      return
    }

    const bounds = boundsForPolygon(polygon)
    const minX = Math.max(0, Math.floor(bounds.minX / FOG_CELL_SIZE))
    const maxX = Math.min(xCells - 1, Math.ceil(bounds.maxX / FOG_CELL_SIZE))
    const minY = Math.max(0, Math.floor(bounds.minY / FOG_CELL_SIZE))
    const maxY = Math.min(
      Math.ceil(map.height / FOG_CELL_SIZE) - 1,
      Math.ceil(bounds.maxY / FOG_CELL_SIZE),
    )

    for (let yIndex = minY; yIndex <= maxY; yIndex += 1) {
      for (let xIndex = minX; xIndex <= maxX; xIndex += 1) {
        const center = {
          x: xIndex * FOG_CELL_SIZE + FOG_CELL_SIZE / 2,
          y: yIndex * FOG_CELL_SIZE + FOG_CELL_SIZE / 2,
        }
        if (containsPoint(polygon, center)) {
          cells.add(this.cellKey(xIndex, yIndex, xCells))
        }
      }
    }
  }

  private cellKey(xIndex: number, yIndex: number, xCells: number): number {
    return yIndex * xCells + xIndex
  }
}
