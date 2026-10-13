import { Container, Sprite, Texture } from 'pixi.js'
import type { MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'

const FOG_CELL_SIZE = 0.5

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
  private cachedExploredPolygons: readonly Polygon[] | null = null
  private cachedExploredCount = 0
  private currentTexture: Texture | null = null

  public render(layer: Container, map: MapDefinition, state: FogRenderState): void {
    layer.removeChildren().forEach((child) => child.destroy({ children: true }))
    this.currentTexture?.destroy(true)
    this.currentTexture = null

    if (!state.enabled) {
      return
    }

    const xCells = Math.ceil(map.width / FOG_CELL_SIZE)
    const yCells = Math.ceil(map.height / FOG_CELL_SIZE)
    const visibleCells = this.rasterizePolygons(state.visible, map, xCells)
    const exploredCells = state.persistExploration
      ? this.exploredCellsFor(map, state.explored, xCells)
      : new Set<number>()
    const canvas = document.createElement('canvas')
    canvas.width = xCells
    canvas.height = yCells
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const imageData = context.createImageData(xCells, yCells)
    const pixels = imageData.data

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

    context.putImageData(imageData, 0, 0)
    const texture = Texture.from(canvas)
    const sprite = new Sprite(texture)
    sprite.eventMode = 'none'
    sprite.width = map.width * map.gridSize
    sprite.height = map.height * map.gridSize
    this.currentTexture = texture
    layer.addChild(sprite)
  }

  private exploredCellsFor(
    map: MapDefinition,
    explored: readonly Polygon[],
    xCells: number,
  ): ReadonlySet<number> {
    const mapKey = `${map.id}:${map.width}:${map.height}:${FOG_CELL_SIZE}`
    const canReuse =
      this.cachedMapKey === mapKey &&
      this.cachedExploredPolygons !== null &&
      explored.length >= this.cachedExploredCount &&
      this.cachedExploredPolygons.length === this.cachedExploredCount

    if (!canReuse || explored.length < this.cachedExploredCount) {
      this.exploredCells = new Set<number>()
      this.cachedExploredCount = 0
    }

    const additions = explored.slice(this.cachedExploredCount)
    for (const polygon of additions) {
      this.rasterizePolygonInto(this.exploredCells, polygon, map, xCells)
    }

    this.cachedMapKey = mapKey
    this.cachedExploredPolygons = explored
    this.cachedExploredCount = explored.length
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
