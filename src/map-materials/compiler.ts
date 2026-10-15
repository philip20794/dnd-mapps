import { jitterColor, random01 } from '@/map-objects/visualStyle'
import { materialCatalog } from './catalog'
import type {
  MaterialAreaDefinition,
  MaterialDecalDefinition,
  MaterialId,
  MaterialLayerDefinition,
  MaterialTransitionStyle,
} from './types'

export type MaterialEdgeDirection = 'north' | 'east' | 'south' | 'west'

export interface CompiledMaterialCell {
  readonly x: number
  readonly y: number
  readonly material: MaterialId
  readonly variant: number
  readonly rotation: 0 | 90 | 180 | 270
  readonly scale: number
  readonly color: number
  readonly alpha: number
  readonly transition: MaterialTransitionStyle
  readonly edges: readonly MaterialEdgeDirection[]
  readonly seed: number
}

export interface CompiledMaterialChunk {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly cells: readonly CompiledMaterialCell[]
  readonly decals: readonly MaterialDecalDefinition[]
}

const key = (x: number, y: number): string => `${x},${y}`

const cellSeed = (seed: number, x: number, y: number, areaIndex: number): number =>
  (seed ^ Math.imul(x + 1, 0x1f123bb5) ^ Math.imul(y + 1, 0x5f356495) ^ areaIndex) >>> 0

const covers = (area: MaterialAreaDefinition, x: number, y: number): boolean =>
  x + 1 > area.position.x &&
  y + 1 > area.position.y &&
  x < area.position.x + area.width &&
  y < area.position.y + area.height

export const compileMaterialLayer = (
  layer: MaterialLayerDefinition,
  mapWidth: number,
  mapHeight: number,
): readonly CompiledMaterialChunk[] => {
  const selected = new Map<string, { area: MaterialAreaDefinition; areaIndex: number }>()
  layer.areas.forEach((area, areaIndex) => {
    const minX = Math.max(0, Math.floor(area.position.x))
    const minY = Math.max(0, Math.floor(area.position.y))
    const maxX = Math.min(mapWidth, Math.ceil(area.position.x + area.width))
    const maxY = Math.min(mapHeight, Math.ceil(area.position.y + area.height))
    for (let y = minY; y < maxY; y += 1)
      for (let x = minX; x < maxX; x += 1)
        if (covers(area, x, y)) selected.set(key(x, y), { area, areaIndex })
  })

  const cells = new Map<string, CompiledMaterialCell>()
  for (const [cellKey, { area, areaIndex }] of selected) {
    const [x, y] = cellKey.split(',').map(Number) as [number, number]
    const seed = cellSeed(layer.seed, x, y, areaIndex)
    const descriptor = materialCatalog[area.material]
    const rotations = [0, 90, 180, 270] as const
    const rotation = area.rotation ?? rotations[Math.floor(random01(seed + 2) * rotations.length)]!
    cells.set(cellKey, {
      x,
      y,
      material: area.material,
      variant: area.variant ?? Math.floor(random01(seed + 1) * descriptor.variantCount),
      rotation,
      scale: area.scale ?? 0.94 + random01(seed + 3) * 0.12,
      color:
        area.tint ??
        jitterColor(
          descriptor.baseColor,
          (area.variant ?? Math.floor(random01(seed + 1) * descriptor.variantCount)) * 104729 +
            layer.seed,
          descriptor.tintJitter,
        ),
      alpha: area.alpha ?? 1,
      transition: area.transition ?? descriptor.transition,
      edges: [],
      seed,
    })
  }

  const directions: readonly [MaterialEdgeDirection, number, number][] = [
    ['north', 0, -1],
    ['east', 1, 0],
    ['south', 0, 1],
    ['west', -1, 0],
  ]
  for (const [cellKey, cell] of cells) {
    const edges = directions
      .filter(([, dx, dy]) => cells.get(key(cell.x + dx, cell.y + dy))?.material !== cell.material)
      .map(([direction]) => direction)
    cells.set(cellKey, { ...cell, edges })
  }

  const chunkSize = Math.max(8, Math.min(32, Math.round(layer.chunkSize ?? 16)))
  const chunks = new Map<string, { x: number; y: number; cells: CompiledMaterialCell[] }>()
  for (const cell of cells.values()) {
    const chunkX = Math.floor(cell.x / chunkSize) * chunkSize
    const chunkY = Math.floor(cell.y / chunkSize) * chunkSize
    const chunkKey = key(chunkX, chunkY)
    const chunk = chunks.get(chunkKey) ?? { x: chunkX, y: chunkY, cells: [] }
    chunk.cells.push(cell)
    chunks.set(chunkKey, chunk)
  }

  // Explicit decals may live on an otherwise empty editor layer. Give every touched decal chunk
  // a runtime entry so decals never depend on an underlying painted area in the same layer.
  for (const decal of layer.decals ?? []) {
    const chunkX = Math.floor(Math.max(0, decal.position.x) / chunkSize) * chunkSize
    const chunkY = Math.floor(Math.max(0, decal.position.y) / chunkSize) * chunkSize
    const chunkKey = key(chunkX, chunkY)
    if (!chunks.has(chunkKey)) chunks.set(chunkKey, { x: chunkX, y: chunkY, cells: [] })
  }

  return [...chunks.values()]
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map((chunk) => ({
      ...chunk,
      width: Math.min(chunkSize, mapWidth - chunk.x),
      height: Math.min(chunkSize, mapHeight - chunk.y),
      decals: (layer.decals ?? []).filter(
        (decal) =>
          Math.floor(Math.max(0, decal.position.x) / chunkSize) * chunkSize === chunk.x &&
          Math.floor(Math.max(0, decal.position.y) / chunkSize) * chunkSize === chunk.y,
      ),
    }))
}
