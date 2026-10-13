import type { MapPlan } from '@/map-generation/types'
import {
  outdoorCellIndex,
  regionAt,
  type OutdoorRegionKind,
  type OutdoorRegionLayout,
} from './regionLayout'

export type OutdoorGroundPreset =
  | 'meadow'
  | 'forest-floor'
  | 'leaf-litter'
  | 'marsh'
  | 'shallow-mud'
  | 'loose-gravel'
  | 'mossy-stone'
  | 'cobblestone'
  | 'field-stubble'
  | 'burnt-ground'
  | 'dark-earth'
  | 'sand'
  | 'snow'
  | 'packed-earth'

export interface OutdoorTerrainCell {
  readonly x: number
  readonly y: number
  readonly regionId: string
  readonly regionKind: OutdoorRegionKind
  readonly height: number
  readonly moisture: number
  readonly vegetationDensity: number
  readonly transition: boolean
  readonly groundPreset: OutdoorGroundPreset
}

export interface OutdoorTerrainFields {
  readonly width: number
  readonly height: number
  readonly cells: readonly OutdoorTerrainCell[]
}

const hash01 = (seed: number, x: number, y: number): number => {
  let value = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b)
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296
}

const smooth = (value: number): number => value * value * (3 - 2 * value)

const valueNoise = (seed: number, x: number, y: number, scale: number): number => {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smooth(gx - x0)
  const ty = smooth(gy - y0)
  const top = hash01(seed, x0, y0) * (1 - tx) + hash01(seed, x0 + 1, y0) * tx
  const bottom = hash01(seed, x0, y0 + 1) * (1 - tx) + hash01(seed, x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

const baseDensity: Record<OutdoorRegionKind, number> = {
  'dense-forest': 0.92,
  'light-forest': 0.55,
  clearing: 0.06,
  swamp: 0.44,
  'rock-field': 0.08,
  ruins: 0.16,
  riverbank: 0.22,
  village: 0.04,
  fields: 0.06,
  'volcanic-field': 0.02,
  'ash-field': 0.01,
  canyon: 0.03,
  coast: 0.03,
  grassland: 0.13,
  desert: 0.01,
  snowfield: 0.08,
  wasteland: 0.03,
}

const groundFor = (kind: OutdoorRegionKind): OutdoorGroundPreset => {
  const presets: Record<OutdoorRegionKind, OutdoorGroundPreset> = {
    'dense-forest': 'forest-floor',
    'light-forest': 'leaf-litter',
    clearing: 'meadow',
    swamp: 'marsh',
    'rock-field': 'loose-gravel',
    ruins: 'mossy-stone',
    riverbank: 'shallow-mud',
    village: 'cobblestone',
    fields: 'field-stubble',
    'volcanic-field': 'burnt-ground',
    'ash-field': 'dark-earth',
    canyon: 'loose-gravel',
    coast: 'sand',
    grassland: 'meadow',
    desert: 'sand',
    snowfield: 'snow',
    wasteland: 'dark-earth',
  }
  return presets[kind]
}

const transitionGround = (
  kind: OutdoorRegionKind,
  fallback: OutdoorGroundPreset,
): OutdoorGroundPreset => {
  if (kind === 'dense-forest' || kind === 'light-forest') return 'leaf-litter'
  if (kind === 'swamp' || kind === 'riverbank') return 'shallow-mud'
  if (kind === 'desert' || kind === 'coast') return 'loose-gravel'
  if (kind === 'volcanic-field') return 'dark-earth'
  if (kind === 'snowfield') return 'packed-earth'
  return fallback
}

export const createOutdoorTerrainFields = (
  plan: MapPlan,
  layout: OutdoorRegionLayout,
): OutdoorTerrainFields => {
  const cells: OutdoorTerrainCell[] = []
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const region = regionAt(layout, x, y)
      const neighborIds: string[] = []
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          if (Math.abs(offsetX) + Math.abs(offsetY) > 2) continue
          const neighborX = x + offsetX
          const neighborY = y + offsetY
          if (
            neighborX >= 0 &&
            neighborY >= 0 &&
            neighborX < layout.width &&
            neighborY < layout.height
          )
            neighborIds.push(layout.regionIds[outdoorCellIndex(layout, neighborX, neighborY)]!)
        }
      }
      const transition = neighborIds.some((id) => id !== region.id)
      const height =
        valueNoise(plan.seed + 101, x, y, 11) * 0.72 + valueNoise(plan.seed + 102, x, y, 27) * 0.28
      const moisture =
        valueNoise(plan.seed + 201, x, y, 9) * 0.6 + valueNoise(plan.seed + 202, x, y, 23) * 0.4
      const densityNoise =
        valueNoise(plan.seed + 301, x, y, 7) * 0.68 + valueNoise(plan.seed + 302, x, y, 19) * 0.32
      const density = Math.max(
        0,
        Math.min(1, baseDensity[region.kind] * (0.55 + densityNoise * 0.75)),
      )
      const baseGround = groundFor(region.kind)
      const terrainGround =
        (plan.theme.terrain === 'cliffs' || plan.theme.terrain === 'canyon') && height > 0.76
          ? 'loose-gravel'
          : baseGround
      cells.push({
        x,
        y,
        regionId: region.id,
        regionKind: region.kind,
        height,
        moisture,
        vegetationDensity: transition ? density * 0.58 : density,
        transition,
        groundPreset: transition ? transitionGround(region.kind, terrainGround) : terrainGround,
      })
    }
  }
  return { width: layout.width, height: layout.height, cells }
}
