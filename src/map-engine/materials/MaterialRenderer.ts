import { Container, Graphics, Rectangle } from 'pixi.js'
import { materialCatalog, compileMaterialLayer } from '@/map-materials'
import type {
  CompiledMaterialCell,
  MaterialDecalDefinition,
  MaterialEdgeDirection,
  MaterialLayerDefinition,
} from '@/map-materials'
import { random01, shiftColor } from '@/map-objects/visualStyle'
import { boundsIntersect, type MapViewBounds } from '@/map-engine/chunks/bounds'

export interface RenderedMaterialLayers {
  readonly base: Container
  readonly edges: Container
  readonly decals: Container
  readonly chunkCount: number
  readonly updateVisibility: (bounds: MapViewBounds) => void
  readonly visibleChunkCount: () => number
}

interface MaterialRuntimeChunk {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  readonly containers: readonly Container[]
  visible: boolean
}

const px = (value: number, gridSize: number): number => value * gridSize

const drawPattern = (
  graphics: Graphics,
  cell: CompiledMaterialCell,
  size: number,
  originX: number,
  originY: number,
): void => {
  const descriptor = materialCatalog[cell.material]
  const detail = Math.max(1, size * 0.025)
  const phase = (cell.variant % descriptor.variantCount) / descriptor.variantCount
  const scale = cell.scale
  const transform = (x: number, y: number): readonly [number, number] => {
    const angle = (cell.rotation * Math.PI) / 180
    const centeredX = (x - 0.5) * scale
    const centeredY = (y - 0.5) * scale
    return [
      originX + size * (0.5 + centeredX * Math.cos(angle) - centeredY * Math.sin(angle)),
      originY + size * (0.5 + centeredX * Math.sin(angle) + centeredY * Math.cos(angle)),
    ]
  }
  const line = (x1: number, y1: number, x2: number, y2: number, alpha = 0.22): void => {
    const start = transform(x1, y1)
    const end = transform(x2, y2)
    graphics
      .moveTo(start[0], start[1])
      .lineTo(end[0], end[1])
      .stroke({
        color: descriptor.secondaryColor,
        alpha: alpha * cell.alpha,
        width: detail,
      })
  }

  switch (cell.material) {
    case 'grass':
      for (let index = 0; index < 5; index += 1) {
        const seed = cell.seed + index * 31
        const x = 0.12 + random01(seed) * 0.76
        const y = 0.18 + random01(seed + 1) * 0.68
        line(x, y + 0.1, x + (random01(seed + 2) - 0.5) * 0.08, y, 0.3)
      }
      break
    case 'forest-floor':
    case 'dirt':
    case 'ash':
      for (let index = 0; index < 5 + (cell.variant % 4); index += 1) {
        const seed = cell.seed + index * 43
        const point = transform(0.08 + random01(seed) * 0.84, 0.08 + random01(seed + 1) * 0.84)
        graphics.circle(point[0], point[1], size * (0.012 + random01(seed + 2) * 0.022)).fill({
          color: descriptor.secondaryColor,
          alpha: (0.12 + phase * 0.1) * cell.alpha,
        })
      }
      break
    case 'mud':
      graphics
        .ellipse(
          originX + size * (0.32 + phase * 0.2),
          originY + size * 0.58,
          size * 0.22,
          size * 0.08,
        )
        .fill({ color: descriptor.shadowColor, alpha: 0.2 * cell.alpha })
        .ellipse(
          originX + size * 0.68,
          originY + size * (0.31 + phase * 0.2),
          size * 0.14,
          size * 0.05,
        )
        .stroke({ color: descriptor.secondaryColor, alpha: 0.34 * cell.alpha, width: detail })
      break
    case 'stone':
    case 'dungeon-stone': {
      const inset = size * (0.035 + (cell.variant % 3) * 0.01)
      graphics.rect(originX + inset, originY + inset, size - inset * 2, size - inset * 2).stroke({
        color: descriptor.shadowColor,
        alpha: 0.38 * cell.alpha,
        width: detail * 1.15,
      })
      if (cell.material === 'dungeon-stone')
        line(0.08, 0.48 + phase * 0.08, 0.92, 0.48 + phase * 0.08, 0.14)
      break
    }
    case 'sand':
    case 'snow':
    case 'shallow-water':
    case 'deep-water':
      for (let index = 0; index < 3; index += 1) {
        const y = 0.24 + index * 0.24 + phase * 0.035
        const start = transform(0.14, y)
        const end = transform(0.82, y + (index % 2 ? 0.025 : -0.02))
        graphics
          .moveTo(start[0], start[1])
          .quadraticCurveTo(originX + size * 0.5, start[1] + size * 0.05, end[0], end[1])
          .stroke({
            color: descriptor.secondaryColor,
            alpha: (cell.material.includes('water') ? 0.3 : 0.16) * cell.alpha,
            width: detail,
          })
      }
      break
    case 'volcanic':
      line(0.08, 0.32, 0.43, 0.48, 0.42)
      line(0.43, 0.48, 0.74, 0.34 + phase * 0.22, 0.48)
      line(0.43, 0.48, 0.62, 0.86, 0.34)
      break
    case 'wood':
      for (let index = 1; index < 4; index += 1) line(0.04, index / 4, 0.96, index / 4, 0.34)
      break
  }
}

const edgeRect = (
  direction: MaterialEdgeDirection,
  size: number,
  width: number,
): readonly [number, number, number, number] => {
  if (direction === 'north') return [0, 0, size, width]
  if (direction === 'east') return [size - width, 0, width, size]
  if (direction === 'south') return [0, size - width, size, width]
  return [0, 0, width, size]
}

const drawEdges = (
  graphics: Graphics,
  cell: CompiledMaterialCell,
  size: number,
  originX: number,
  originY: number,
): void => {
  if (cell.transition === 'none') return
  const descriptor = materialCatalog[cell.material]
  const width = size * (cell.transition === 'soft' ? 0.15 : cell.transition === 'shore' ? 0.2 : 0.1)
  cell.edges.forEach((direction, index) => {
    const rect = edgeRect(direction, size, width)
    graphics.rect(originX + rect[0], originY + rect[1], rect[2], rect[3]).fill({
      color: descriptor.shadowColor,
      alpha: (cell.transition === 'soft' ? 0.12 : 0.22) * cell.alpha,
    })
    if (cell.transition === 'shore') {
      const foamWidth = Math.max(1.5, size * 0.035)
      if (direction === 'north' || direction === 'south') {
        const y = direction === 'north' ? width * 0.42 : size - width * 0.42
        graphics
          .moveTo(originX, originY + y)
          .quadraticCurveTo(
            originX + size * 0.5,
            originY + y + ((index % 2) * 2 - 1) * size * 0.04,
            originX + size,
            originY + y,
          )
          .stroke({ color: 0xd7e5d5, alpha: 0.34 * cell.alpha, width: foamWidth })
      } else {
        const x = direction === 'west' ? width * 0.42 : size - width * 0.42
        graphics
          .moveTo(originX + x, originY)
          .quadraticCurveTo(
            originX + x + ((index % 2) * 2 - 1) * size * 0.04,
            originY + size * 0.5,
            originX + x,
            originY + size,
          )
          .stroke({ color: 0xd7e5d5, alpha: 0.34 * cell.alpha, width: foamWidth })
      }
    }
    if (direction === 'east' || direction === 'south') {
      const shadow = edgeRect(direction, size, Math.max(2, size * 0.045))
      graphics.rect(originX + shadow[0], originY + shadow[1], shadow[2], shadow[3]).fill({
        color: 0x090807,
        alpha: 0.14 * cell.alpha,
      })
    }
  })
}

const drawAutoDecals = (
  graphics: Graphics,
  cell: CompiledMaterialCell,
  size: number,
  originX: number,
  originY: number,
): void => {
  const descriptor = materialCatalog[cell.material]
  descriptor.decals.forEach((profile, profileIndex) => {
    if (random01(cell.seed + 701 + profileIndex * 113) > profile.density) return
    const seed = cell.seed + 809 + profileIndex * 151
    const x = originX + size * (0.16 + random01(seed) * 0.68)
    const y = originY + size * (0.16 + random01(seed + 1) * 0.68)
    const alpha = profile.alpha * cell.alpha
    if (profile.kind === 'crack') {
      graphics
        .moveTo(x - size * 0.18, y - size * 0.12)
        .lineTo(x, y)
        .lineTo(x + size * 0.17, y - size * 0.03)
        .stroke({ color: profile.color, alpha, width: Math.max(1, size * 0.025) })
    } else if (
      profile.kind === 'moss' ||
      profile.kind === 'dirt' ||
      profile.kind === 'irregularity'
    ) {
      graphics
        .ellipse(
          x,
          y,
          size * (0.1 + random01(seed + 2) * 0.16),
          size * (0.04 + random01(seed + 3) * 0.09),
        )
        .fill({ color: profile.color, alpha })
    } else if (profile.kind === 'leaves') {
      for (let index = 0; index < 3; index += 1)
        graphics
          .ellipse(
            x + index * size * 0.06,
            y + (index % 2) * size * 0.04,
            size * 0.045,
            size * 0.018,
          )
          .fill({ color: shiftColor(profile.color, index * 8 - 7), alpha })
    } else {
      graphics
        .circle(x, y, size * (0.025 + random01(seed + 4) * 0.035))
        .fill({ color: profile.color, alpha })
    }
  })
}

const drawExplicitDecal = (
  graphics: Graphics,
  decal: MaterialDecalDefinition,
  chunkX: number,
  chunkY: number,
  gridSize: number,
): void => {
  const x = px(decal.position.x - chunkX, gridSize)
  const y = px(decal.position.y - chunkY, gridSize)
  const width = px(decal.width ?? 1, gridSize) * (decal.scale ?? 1)
  const height = px(decal.height ?? 1, gridSize) * (decal.scale ?? 1)
  const color = decal.color ?? 0x2d241b
  const alpha = decal.alpha ?? 0.28
  if (decal.kind === 'crack') {
    graphics
      .moveTo(x, y + height * 0.3)
      .lineTo(x + width * 0.46, y + height * 0.55)
      .lineTo(x + width, y + height * 0.28)
      .stroke({ color, alpha, width: Math.max(1, gridSize * 0.035) })
    return
  }
  graphics
    .ellipse(x + width / 2, y + height / 2, width / 2, Math.max(2, height / 2))
    .fill({ color, alpha })
}

export class MaterialRenderer {
  public render(
    layers: readonly MaterialLayerDefinition[],
    mapWidth: number,
    mapHeight: number,
    gridSize: number,
  ): RenderedMaterialLayers {
    const base = new Container({ label: 'material-base-runtime' })
    const edges = new Container({ label: 'material-edges-runtime' })
    const decals = new Container({ label: 'material-decals-runtime' })
    const runtimeChunks: MaterialRuntimeChunk[] = []
    const compiledLayers = layers.map((layer) => ({
      layer,
      chunks: compileMaterialLayer(layer, mapWidth, mapHeight),
    }))
    const chunkCount = compiledLayers.reduce((sum, entry) => sum + entry.chunks.length, 0)
    const cellCount = compiledLayers.reduce(
      (sum, entry) =>
        sum + entry.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.cells.length, 0),
      0,
    )
    // RenderTexture creation has an up-front GPU cost. It pays off for normal maps, while large
    // maps are already cheap scene-graph-wise (three Graphics per chunk) and stay uncached.
    const cacheBaseChunks = chunkCount <= 24
    const patternStride = cellCount > 6_000 ? 4 : cellCount > 3_000 ? 2 : 1
    const decalStride = cellCount > 6_000 ? 5 : cellCount > 3_000 ? 3 : 1

    compiledLayers.forEach(({ layer, chunks }) => {
      chunks.forEach((chunk) => {
        const baseChunk = new Container({
          label: `material-base:${layer.id}:${chunk.x},${chunk.y}`,
        })
        const edgeChunk = new Container({
          label: `material-edge:${layer.id}:${chunk.x},${chunk.y}`,
        })
        const decalChunk = new Container({
          label: `material-decal:${layer.id}:${chunk.x},${chunk.y}`,
        })
        baseChunk.position.set(px(chunk.x, gridSize), px(chunk.y, gridSize))
        edgeChunk.position.copyFrom(baseChunk.position)
        decalChunk.position.copyFrom(baseChunk.position)
        const chunkContainers = [baseChunk, edgeChunk, decalChunk]
        chunkContainers.forEach((container) => {
          container.cullable = true
          container.cullableChildren = false
          container.cullArea = new Rectangle(
            0,
            0,
            px(chunk.width, gridSize),
            px(chunk.height, gridSize),
          )
        })
        const baseGraphics = new Graphics()
        const edgeGraphics = new Graphics()
        const decalGraphics = new Graphics()
        const baseGroups = new Map<
          string,
          { readonly color: number; readonly alpha: number; readonly cells: CompiledMaterialCell[] }
        >()
        chunk.cells.forEach((cell) => {
          const key = `${cell.color}:${cell.alpha}`
          const group = baseGroups.get(key)
          if (group) group.cells.push(cell)
          else baseGroups.set(key, { color: cell.color, alpha: cell.alpha, cells: [cell] })
        })
        baseGroups.forEach((group) => {
          group.cells.forEach((cell) => {
            const localX = px(cell.x - chunk.x, gridSize)
            const localY = px(cell.y - chunk.y, gridSize)
            baseGraphics.rect(localX, localY, gridSize + 0.5, gridSize + 0.5)
          })
          baseGraphics.fill({ color: group.color, alpha: group.alpha })
        })
        chunk.cells.forEach((cell, cellIndex) => {
          const localX = px(cell.x - chunk.x, gridSize)
          const localY = px(cell.y - chunk.y, gridSize)
          if ((cell.x + cell.y * 3 + cellIndex) % patternStride === 0)
            drawPattern(baseGraphics, cell, gridSize, localX, localY)
          drawEdges(edgeGraphics, cell, gridSize, localX, localY)
          if ((cell.x * 3 + cell.y + cellIndex) % decalStride === 0)
            drawAutoDecals(decalGraphics, cell, gridSize, localX, localY)
        })
        chunk.decals.forEach((decal) =>
          drawExplicitDecal(decalGraphics, decal, chunk.x, chunk.y, gridSize),
        )
        baseChunk.addChild(baseGraphics)
        edgeChunk.addChild(edgeGraphics)
        decalChunk.addChild(decalGraphics)
        if (cacheBaseChunks) baseChunk.cacheAsTexture({ resolution: 1, antialias: true })
        base.addChild(baseChunk)
        edges.addChild(edgeChunk)
        decals.addChild(decalChunk)
        runtimeChunks.push({
          minX: chunk.x,
          minY: chunk.y,
          maxX: chunk.x + chunk.width,
          maxY: chunk.y + chunk.height,
          containers: [baseChunk, edgeChunk, decalChunk],
          visible: true,
        })
      })
    })
    return {
      base,
      edges,
      decals,
      chunkCount,
      updateVisibility: (bounds) => {
        runtimeChunks.forEach((chunk) => {
          chunk.visible = boundsIntersect(chunk, bounds)
          chunk.containers.forEach((container) => {
            container.renderable = chunk.visible
          })
        })
      },
      visibleChunkCount: () => runtimeChunks.filter((chunk) => chunk.visible).length,
    }
  }
}
