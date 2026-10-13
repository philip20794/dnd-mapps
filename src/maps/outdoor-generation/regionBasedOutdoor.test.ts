import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry } from '@/map-objects'
import { createLocalMapPlan } from '@/map-generation/localPlanner'
import type { Biome, MapGenerationRequest } from '@/map-generation/types'
import { validateMapDefinition } from '@/maps/validation'
import { createRegionBasedOutdoorMap } from './geometry'
import { createOutdoorRegionLayout } from './regionLayout'
import { createOutdoorTerrainFields } from './terrainFields'

const key = (x: number, y: number): string => `${x},${y}`

const reachableCount = (cells: ReadonlySet<string>): number => {
  const first = cells.values().next().value as string | undefined
  if (!first) return 0
  const visited = new Set([first])
  const queue = [first]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!
    const [x, y] = current.split(',').map(Number) as [number, number]
    for (const neighbor of [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)]) {
      if (cells.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  return visited.size
}

const outdoorPlan = (seed: number, request: MapGenerationRequest = {}) =>
  createLocalMapPlan({
    seed,
    mapType: 'outdoor',
    biomes: ['forest'],
    size: 'large',
    ...request,
  })

describe('regionenbasierter Outdoor-Generator', () => {
  it('ist fuer denselben MapPlan und Seed vollstaendig deterministisch', () => {
    const plan = outdoorPlan(7123, {
      waterFeatures: ['multiple-rivers', 'lake'],
      themes: ['ruins'],
    })
    const first = createRegionBasedOutdoorMap(plan)
    const second = createRegionBasedOutdoorMap(plan)

    expect(second).toEqual(first)
  })

  it('erzeugt ueber viele Seeds zusammenhaengende semantische Regionen', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const layout = createOutdoorRegionLayout(outdoorPlan(seed))
      expect(layout.regions.some((region) => region.kind === 'dense-forest')).toBe(true)
      expect(layout.regions.some((region) => region.kind === 'light-forest')).toBe(true)
      for (const region of layout.regions) {
        const cells = new Set<string>()
        layout.regionIds.forEach((regionId, index) => {
          if (regionId === region.id)
            cells.add(key(index % layout.width, Math.floor(index / layout.width)))
        })
        expect(cells.size, `leere Region ${region.id}, Seed ${seed}`).toBeGreaterThan(0)
        expect(reachableCount(cells), `geteilte Region ${region.id}, Seed ${seed}`).toBe(cells.size)
      }
    }
  })

  it('formt Vegetationsdichte aus kohärenten Regions- und Noise-Feldern', () => {
    const densities = new Map<string, number[]>()
    let transitions = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const plan = outdoorPlan(seed)
      const layout = createOutdoorRegionLayout(plan)
      const terrain = createOutdoorTerrainFields(plan, layout)
      terrain.cells.forEach((cell) => {
        densities.set(cell.regionKind, [
          ...(densities.get(cell.regionKind) ?? []),
          cell.vegetationDensity,
        ])
        if (cell.transition) transitions += 1
      })
    }
    const average = (kind: string) => {
      const values = densities.get(kind) ?? []
      return values.reduce((sum, value) => sum + value, 0) / values.length
    }
    expect(average('dense-forest')).toBeGreaterThan(average('light-forest'))
    expect(average('light-forest')).toBeGreaterThan(average('clearing'))
    expect(transitions).toBeGreaterThan(250)
  })

  it('setzt mehrere gewaehlte Biome und Siedlungsthemen als garantierte Regionen um', () => {
    const plan = outdoorPlan(551, {
      mapType: 'settlement',
      biomes: ['forest', 'swamp', 'volcanic'],
      themes: ['town'],
    })
    const layout = createOutdoorRegionLayout(plan)
    const kinds = new Set(layout.regions.map((region) => region.kind))

    expect(kinds.has('dense-forest')).toBe(true)
    expect(kinds.has('swamp')).toBe(true)
    expect(kinds.has('volcanic-field')).toBe(true)
    expect(kinds.has('village')).toBe(true)
    expect(kinds.has('fields')).toBe(true)
  })

  it('haelt Wege, Fluesse, Zufluesse und Ufer jeweils zusammenhaengend', () => {
    for (let seed = 31; seed <= 42; seed += 1) {
      const result = createRegionBasedOutdoorMap(
        outdoorPlan(seed, { waterFeatures: ['multiple-rivers', 'lake'] }),
      )
      result.linear.paths.forEach((path) => {
        const cells = new Set(path.cells.map((cell) => key(cell.x, cell.y)))
        expect(reachableCount(cells), `${path.id}, Seed ${seed}`).toBe(cells.size)
      })
      result.linear.water.rivers.forEach((river) => {
        const cells = new Set(river.cells.map((cell) => key(cell.x, cell.y)))
        expect(reachableCount(cells), `${river.id}, Seed ${seed}`).toBe(cells.size)
        expect(new Set(river.widths).size).toBeGreaterThan(1)
      })
      const [main, tributary] = result.linear.water.rivers
      expect(main).toBeDefined()
      expect(tributary).toBeDefined()
      expect(
        tributary!.cells.some((cell) =>
          main!.cells.some((mainCell) => mainCell.x === cell.x && mainCell.y === cell.y),
        ),
      ).toBe(true)
      expect(
        main!.cells.some((cell) => result.linear.water.lakeCells.has(key(cell.x, cell.y))),
      ).toBe(true)
      expect(result.linear.water.bankCells.size).toBeGreaterThan(0)
      expect(result.linear.bridges.length, `fehlende Bruecke, Seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('laesst Start, Landmarken, Wege, Wasser und Bruecken von Vegetationsblockern frei', () => {
    let denseForestPlacements = 0
    for (let seed = 70; seed < 90; seed += 1) {
      const result = createRegionBasedOutdoorMap(outdoorPlan(seed, { waterFeatures: ['river'] }))
      for (const placement of result.vegetation.placements) {
        expect(result.vegetation.protectedCells.has(key(placement.cell.x, placement.cell.y))).toBe(
          false,
        )
        if (placement.regionKind === 'dense-forest') denseForestPlacements += 1
      }
    }
    expect(denseForestPlacements).toBeGreaterThan(30)
  })

  it('erzeugt valide und biome-spezifisch unterschiedliche MapDefinitions ueber viele Seeds', () => {
    const registry = createDefaultObjectRegistry()
    const biomes: readonly Biome[] = ['forest', 'swamp', 'desert', 'snow', 'volcanic', 'wasteland']
    const expectedGround = new Map<Biome, string>([
      ['forest', 'forest-floor'],
      ['swamp', 'marsh'],
      ['desert', 'sand'],
      ['snow', 'snow'],
      ['volcanic', 'burnt-ground'],
      ['wasteland', 'dark-earth'],
    ])
    const seen = new Map<Biome, Set<string>>()
    for (let seed = 1; seed <= 48; seed += 1) {
      const biome = biomes[(seed - 1) % biomes.length]!
      const waterFeatures =
        seed % 3 === 0 ? ['multiple-rivers' as const] : seed % 3 === 1 ? ['lake' as const] : []
      const result = createRegionBasedOutdoorMap(
        outdoorPlan(seed * 101, { biomes: [biome], waterFeatures }),
      )
      const errors = validateMapDefinition(result.map, registry)
      expect(errors, `${biome}, Seed ${seed}: ${errors.join(' | ')}`).toHaveLength(0)
      seen.set(
        biome,
        new Set(
          result.map.materialLayers?.flatMap((layer) => layer.areas).map((area) => area.material) ??
            [],
        ),
      )
    }
    const expectedMaterial = new Map<string, string>([
      ['forest-floor', 'forest-floor'],
      ['marsh', 'mud'],
      ['sand', 'sand'],
      ['snow', 'snow'],
      ['burnt-ground', 'volcanic'],
      ['dark-earth', 'ash'],
    ])
    biomes.forEach((biome) =>
      expect(seen.get(biome)?.has(expectedMaterial.get(expectedGround.get(biome)!)!)).toBe(true),
    )
  })

  it('skaliert auf sehr grosse Karten ohne Objekt-Explosion', () => {
    const started = performance.now()
    const result = createRegionBasedOutdoorMap(
      outdoorPlan(99117, {
        size: 'custom',
        width: 120,
        height: 90,
        biomes: ['jungle', 'swamp'],
        waterFeatures: ['multiple-rivers', 'lake'],
        themes: ['ruins'],
      }),
    )
    const elapsed = performance.now() - started

    expect(result.map.width).toBe(120)
    expect(result.map.height).toBe(90)
    expect(result.layout.regions.length).toBeGreaterThanOrEqual(18)
    expect(result.map.objects.length).toBeLessThan(5000)
    expect(elapsed).toBeLessThan(5000)
  })

  it('erhaelt auch auf dunklen Outdoor-Karten eine Lichtquelle am Start', () => {
    const result = createRegionBasedOutdoorMap(outdoorPlan(6601, { atmosphere: 'dark' }))

    expect(result.map.objects.some((object) => object.id === 'outdoor-daylight')).toBe(false)
    expect(
      result.map.objects.some(
        (object) => object.id === 'outdoor-start-light' && object.type === 'campfire',
      ),
    ).toBe(true)
  })
})
