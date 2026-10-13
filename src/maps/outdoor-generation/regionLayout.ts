import { createSeededRandom, integer, pick } from '@/map-generation/random'
import type { MapPlan, PlanLandmarkKind } from '@/map-generation/types'

export type OutdoorRegionKind =
  | 'dense-forest'
  | 'light-forest'
  | 'clearing'
  | 'swamp'
  | 'rock-field'
  | 'ruins'
  | 'riverbank'
  | 'village'
  | 'fields'
  | 'volcanic-field'
  | 'ash-field'
  | 'canyon'
  | 'coast'
  | 'grassland'
  | 'desert'
  | 'snowfield'
  | 'wasteland'

export interface OutdoorPoint {
  readonly x: number
  readonly y: number
}

export interface OutdoorRegion {
  readonly id: string
  readonly kind: OutdoorRegionKind
  readonly site: OutdoorPoint
  readonly sourceId?: string
}

export interface OutdoorLandmarkSite {
  readonly id: string
  readonly kind: PlanLandmarkKind
  readonly position: OutdoorPoint
  readonly importance: 'minor' | 'major' | 'focal'
}

export interface OutdoorRegionLayout {
  readonly width: number
  readonly height: number
  readonly levelId: string
  readonly start: OutdoorPoint
  readonly regions: readonly OutdoorRegion[]
  readonly regionIds: readonly string[]
  readonly landmarks: readonly OutdoorLandmarkSite[]
}

export const outdoorCellIndex = (
  layout: Pick<OutdoorRegionLayout, 'width'>,
  x: number,
  y: number,
): number => y * layout.width + x

const regionKindsFor = (plan: MapPlan): readonly OutdoorRegionKind[] => {
  const primary: Record<MapPlan['theme']['biome'], readonly OutdoorRegionKind[]> = {
    forest: ['dense-forest', 'dense-forest', 'light-forest', 'clearing', 'grassland'],
    jungle: ['dense-forest', 'dense-forest', 'light-forest', 'swamp', 'clearing'],
    swamp: ['swamp', 'swamp', 'riverbank', 'light-forest', 'clearing'],
    plains: ['grassland', 'grassland', 'fields', 'clearing', 'light-forest'],
    desert: ['desert', 'desert', 'rock-field', 'canyon', 'clearing'],
    snow: ['snowfield', 'snowfield', 'rock-field', 'clearing', 'light-forest'],
    volcanic: ['volcanic-field', 'ash-field', 'rock-field', 'canyon', 'wasteland'],
    underground: ['rock-field', 'canyon', 'wasteland'],
    mushroom: ['light-forest', 'swamp', 'clearing'],
    wasteland: ['wasteland', 'ash-field', 'rock-field', 'ruins', 'canyon'],
  }
  const selectedBiomes = plan.theme.biomes.length > 0 ? plan.theme.biomes : [plan.theme.biome]
  const result = selectedBiomes.flatMap((biome) => primary[biome])
  if (plan.theme.settlements.includes('ruins') || plan.theme.mapType === 'ruins')
    result.push('ruins')
  if (plan.theme.settlement === 'village' || plan.theme.settlement === 'town')
    result.push('village', 'fields')
  if (plan.theme.waterFeatures.some((water) => water !== 'none')) result.push('riverbank')
  if (plan.theme.mapType === 'coast' || plan.theme.mapType === 'island')
    result.push('coast', 'coast')
  if (plan.theme.terrain === 'canyon' || plan.theme.terrain === 'cliffs')
    result.push('canyon', 'rock-field')
  return result
}

const requiredRegionKindsFor = (plan: MapPlan): readonly OutdoorRegionKind[] => {
  const biomeRegions: Record<MapPlan['theme']['biome'], readonly OutdoorRegionKind[]> = {
    forest: ['dense-forest', 'light-forest'],
    jungle: ['dense-forest', 'light-forest', 'swamp'],
    swamp: ['swamp', 'riverbank'],
    plains: ['grassland', 'fields'],
    desert: ['desert', 'rock-field'],
    snow: ['snowfield', 'light-forest'],
    volcanic: ['volcanic-field', 'ash-field'],
    underground: ['rock-field', 'canyon'],
    mushroom: ['light-forest', 'swamp'],
    wasteland: ['wasteland', 'ash-field'],
  }
  const selectedBiomes = plan.theme.biomes.length > 0 ? plan.theme.biomes : [plan.theme.biome]
  return [
    ...new Set<OutdoorRegionKind>([
      ...selectedBiomes.flatMap((biome) => biomeRegions[biome]),
      ...(plan.theme.settlements.includes('ruins') || plan.theme.mapType === 'ruins'
        ? ['ruins' as const]
        : []),
      ...(plan.theme.mapType === 'settlement' ||
      plan.theme.settlement === 'village' ||
      plan.theme.settlement === 'town'
        ? ['village' as const, 'fields' as const]
        : []),
      ...(plan.theme.waterFeatures.some((water) => water !== 'none') ? ['riverbank' as const] : []),
      ...(plan.theme.mapType === 'coast' || plan.theme.mapType === 'island'
        ? ['coast' as const]
        : []),
      ...(plan.theme.terrain === 'canyon' || plan.theme.terrain === 'cliffs'
        ? ['canyon' as const]
        : []),
    ]),
  ]
}

const regionCountFor = (plan: MapPlan): number => {
  const bySize = { small: 6, medium: 9, large: 13, huge: 18, custom: 10 } as const
  if (plan.dimensions.size !== 'custom') return bySize[plan.dimensions.size]
  return Math.max(
    6,
    Math.min(24, Math.round((plan.dimensions.width * plan.dimensions.height) / 320)),
  )
}

const createSite = (
  random: () => number,
  width: number,
  height: number,
  existing: readonly OutdoorRegion[],
): OutdoorPoint => {
  let candidate = { x: integer(random, 3, width - 4), y: integer(random, 3, height - 4) }
  let bestDistance = -1
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const next = { x: integer(random, 3, width - 4), y: integer(random, 3, height - 4) }
    const distance =
      existing.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(
            ...existing.map((region) => Math.hypot(next.x - region.site.x, next.y - region.site.y)),
          )
    if (distance > bestDistance) {
      candidate = next
      bestDistance = distance
    }
  }
  return candidate
}

const ensureConnectedRegions = (
  width: number,
  height: number,
  regions: readonly OutdoorRegion[],
  regionIds: string[],
): void => {
  const neighbors = (index: number): number[] => {
    const x = index % width
    const y = Math.floor(index / width)
    return [
      ...(x > 0 ? [index - 1] : []),
      ...(x + 1 < width ? [index + 1] : []),
      ...(y > 0 ? [index - width] : []),
      ...(y + 1 < height ? [index + width] : []),
    ]
  }
  for (const region of regions) {
    const anchor = outdoorCellIndex({ width }, region.site.x, region.site.y)
    const primary = new Set<number>([anchor])
    const queue = [anchor]
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const neighbor of neighbors(queue[cursor]!)) {
        if (regionIds[neighbor] === region.id && !primary.has(neighbor)) {
          primary.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    const detached = new Set(
      regionIds.flatMap((id, index) => (id === region.id && !primary.has(index) ? [index] : [])),
    )
    while (detached.size > 0) {
      const first = detached.values().next().value as number
      const component = new Set<number>([first])
      const componentQueue = [first]
      const boundaryCounts = new Map<string, number>()
      detached.delete(first)
      for (let cursor = 0; cursor < componentQueue.length; cursor += 1) {
        for (const neighbor of neighbors(componentQueue[cursor]!)) {
          const neighborId = regionIds[neighbor]!
          if (neighborId === region.id && detached.has(neighbor)) {
            detached.delete(neighbor)
            component.add(neighbor)
            componentQueue.push(neighbor)
          } else if (neighborId !== region.id) {
            boundaryCounts.set(neighborId, (boundaryCounts.get(neighborId) ?? 0) + 1)
          }
        }
      }
      const recipient = [...boundaryCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0]?.[0]
      if (recipient)
        component.forEach((index) => {
          regionIds[index] = recipient
        })
    }
  }
}

export const createOutdoorRegionLayout = (plan: MapPlan): OutdoorRegionLayout => {
  const random = createSeededRandom((plan.seed ^ 0x0a71d00) >>> 0)
  const width = Math.max(20, Math.round(plan.dimensions.width))
  const height = Math.max(18, Math.round(plan.dimensions.height))
  const levelId = plan.levels[0]?.id ?? 'ground'
  const start = { x: 4, y: Math.round(height * (0.35 + random() * 0.3)) }
  const pool = regionKindsFor(plan)
  const requiredKinds = requiredRegionKindsFor(plan)
  const targetRegionCount = Math.min(24, Math.max(regionCountFor(plan), requiredKinds.length + 1))
  const regions: OutdoorRegion[] = [
    {
      id: 'outdoor-region-start',
      kind: 'clearing',
      site: start,
      sourceId: plan.startArea.targetId,
    },
  ]
  for (let index = 1; index < targetRegionCount; index += 1) {
    regions.push({
      id: `outdoor-region-${index + 1}`,
      kind: requiredKinds[index - 1] ?? pick(random, pool),
      site: createSite(random, width, height, regions),
      sourceId: plan.regions[index % Math.max(1, plan.regions.length)]?.id,
    })
  }

  const regionIds: string[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearest = regions.reduce(
        (best, region) => {
          const distance = (x - region.site.x) ** 2 + (y - region.site.y) ** 2
          return distance < best.distance ? { region, distance } : best
        },
        { region: regions[0]!, distance: Number.POSITIVE_INFINITY },
      )
      regionIds.push(nearest.region.id)
    }
  }
  ensureConnectedRegions(width, height, regions, regionIds)

  const landmarkSource =
    plan.landmarks.length > 0
      ? plan.landmarks
      : [
          {
            id: 'landmark-focal',
            targetId: plan.startArea.targetId,
            kind: 'tree' as const,
            importance: 'focal' as const,
          },
        ]
  const landmarkRegions = regions.filter((region) => region.id !== 'outdoor-region-start')
  const landmarks = landmarkSource.map((landmark, index) => {
    const region = landmarkRegions[index % landmarkRegions.length] ?? regions[0]!
    return {
      id: landmark.id,
      kind: landmark.kind,
      importance: landmark.importance,
      position: region.site,
    }
  })
  return { width, height, levelId, start, regions, regionIds, landmarks }
}

export const regionAt = (layout: OutdoorRegionLayout, x: number, y: number): OutdoorRegion => {
  const id = layout.regionIds[outdoorCellIndex(layout, x, y)]!
  return layout.regions.find((region) => region.id === id)!
}
