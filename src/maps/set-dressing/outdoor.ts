import type { MapObjectDefinition } from '@/map-objects'
import { createSeededRandom } from '@/map-generation/random'
import type { MapPlan } from '@/map-generation/types'
import type { OutdoorLinearFeatures } from '@/maps/outdoor-generation/linearFeatures'
import type { OutdoorRegion, OutdoorRegionLayout } from '@/maps/outdoor-generation/regionLayout'
import { SetDressingPlacementGuard } from './placement'
import { createSetDressingScene } from './scenes'
import type { SetDressingResult, SetDressingSceneRequest } from './types'

const key = (x: number, y: number): string => `${x},${y}`

const protectDisk = (
  cells: Set<string>,
  center: { readonly x: number; readonly y: number },
  radius: number,
  layout: OutdoorRegionLayout,
): void => {
  for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y += 1)
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x += 1)
      if (
        x >= 0 &&
        y >= 0 &&
        x < layout.width &&
        y < layout.height &&
        Math.hypot(x - center.x, y - center.y) <= radius
      )
        cells.add(key(x, y))
}

const hardProtectedCells = (
  layout: OutdoorRegionLayout,
  linear: OutdoorLinearFeatures,
): ReadonlySet<string> => {
  const protectedCells = new Set<string>(linear.water.waterCells)
  linear.pathCells.forEach((value) => {
    const [x, y] = value.split(',').map(Number) as [number, number]
    protectDisk(protectedCells, { x, y }, 1.45, layout)
  })
  protectDisk(protectedCells, layout.start, 4, layout)
  linear.bridges.forEach((bridge) => protectDisk(protectedCells, bridge.position, 2.5, layout))
  return protectedCells
}

const edgePoint = (
  layout: OutdoorRegionLayout,
  region: OutdoorRegion,
): { readonly x: number; readonly y: number } => {
  const candidates: { x: number; y: number }[] = []
  layout.regionIds.forEach((regionId, index) => {
    if (regionId !== region.id) return
    const x = index % layout.width
    const y = Math.floor(index / layout.width)
    const neighbors = [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)]
    const isEdge = neighbors.some((neighbor) => {
      const [neighborX, neighborY] = neighbor.split(',').map(Number) as [number, number]
      return (
        neighborX < 0 ||
        neighborY < 0 ||
        neighborX >= layout.width ||
        neighborY >= layout.height ||
        layout.regionIds[neighborY * layout.width + neighborX] !== region.id
      )
    })
    if (isEdge) candidates.push({ x, y })
  })
  return (
    candidates.sort(
      (left, right) =>
        Math.hypot(left.x - region.site.x, left.y - region.site.y) -
        Math.hypot(right.x - region.site.x, right.y - region.site.y),
    )[0] ?? region.site
  )
}

export interface OutdoorSetDressingInput {
  readonly plan: MapPlan
  readonly layout: OutdoorRegionLayout
  readonly linear: OutdoorLinearFeatures
  readonly baseObjects: readonly MapObjectDefinition[]
}

export const createOutdoorSetDressing = (input: OutdoorSetDressingInput): SetDressingResult => {
  const random = createSeededRandom((input.plan.seed ^ 0x0d355ed) >>> 0)
  const protectedCells = hardProtectedCells(input.layout, input.linear)
  const requests: SetDressingSceneRequest[] = []
  const regions = input.layout.regions.filter((region) => region.id !== 'outdoor-region-start')
  const clearing = regions.find((region) =>
    ['clearing', 'grassland', 'fields'].includes(region.kind),
  )
  const campWanted =
    input.plan.theme.settlement === 'camp' ||
    input.plan.sceneFeatures.some((feature) => feature.kind === 'watch-camp')
  const abandoned =
    input.plan.theme.atmosphere === 'abandoned' ||
    input.plan.theme.atmosphere === 'destroyed' ||
    input.plan.sceneFeatures.some((feature) => feature.kind === 'abandoned-caravan')
  if (clearing && (campWanted || abandoned))
    requests.push({
      id: 'outdoor-camp-1',
      kind: abandoned ? 'abandoned-camp' : 'camp',
      levelId: input.layout.levelId,
      center: clearing.site,
      tags: [clearing.kind, 'outdoor'],
      atmosphere: input.plan.theme.atmosphere,
      biome: input.plan.theme.biome,
    })
  regions
    .filter((region) => region.kind === 'ruins')
    .slice(0, 2)
    .forEach((region, index) =>
      requests.push({
        id: `outdoor-ruin-${index + 1}`,
        kind: 'ruin',
        levelId: input.layout.levelId,
        center: region.site,
        tags: [region.kind, 'outdoor'],
        atmosphere: input.plan.theme.atmosphere,
        biome: input.plan.theme.biome,
      }),
    )
  regions
    .filter((region) => region.kind === 'dense-forest' || region.kind === 'light-forest')
    .slice(0, 2)
    .forEach((region, index) =>
      requests.push({
        id: `outdoor-forest-edge-${index + 1}`,
        kind: 'forest-edge',
        levelId: input.layout.levelId,
        center: edgePoint(input.layout, region),
        tags: [region.kind, 'outdoor'],
        atmosphere: input.plan.theme.atmosphere,
        biome: input.plan.theme.biome,
      }),
    )
  const banks = [...input.linear.water.bankCells].map((value) => {
    const [x, y] = value.split(',').map(Number) as [number, number]
    return { x, y }
  })
  for (let index = 0; index < Math.min(2, banks.length); index += 1) {
    const point = banks[Math.floor(random() * banks.length)]!
    if (
      requests.some(
        (request) => Math.hypot(request.center.x - point.x, request.center.y - point.y) < 7,
      )
    )
      continue
    requests.push({
      id: `outdoor-river-bank-${index + 1}`,
      kind: 'river-bank',
      levelId: input.layout.levelId,
      center: point,
      tags: ['riverbank', 'outdoor'],
      atmosphere: input.plan.theme.atmosphere,
      biome: input.plan.theme.biome,
    })
  }
  const ritualWanted =
    input.plan.theme.atmosphere === 'magical' ||
    input.plan.theme.atmosphere === 'cursed' ||
    input.plan.storyHooks.some((hook) => hook.kind === 'ritual')
  if (ritualWanted) {
    const site = input.layout.landmarks[0]?.position ?? clearing?.site
    if (site)
      requests.push({
        id: 'outdoor-ritual-1',
        kind: 'ritual-site',
        levelId: input.layout.levelId,
        center: site,
        tags: ['outdoor', 'ritual'],
        atmosphere: input.plan.theme.atmosphere,
        biome: input.plan.theme.biome,
      })
  }

  const objects: MapObjectDefinition[] = []
  const scenes: NonNullable<ReturnType<typeof createSetDressingScene>['scene']>[] = []
  requests.slice(0, 8).forEach((request, index) => {
    const guard = new SetDressingPlacementGuard(
      {
        width: input.layout.width,
        height: input.layout.height,
        levelId: input.layout.levelId,
        forbiddenCells: protectedCells,
        occupied: [...input.baseObjects, ...objects],
      },
      input.plan.seed + index * 3571,
    )
    const generated = createSetDressingScene(request, guard, input.plan.seed + index * 65537)
    objects.push(...generated.objects)
    if (generated.scene) scenes.push(generated.scene)
  })
  return { objects, scenes }
}
