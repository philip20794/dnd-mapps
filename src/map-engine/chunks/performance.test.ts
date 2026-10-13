import { describe, expect, it } from 'vitest'
import { createLocalMapPlan } from '@/map-generation'
import { compileMaterialLayer } from '@/map-materials'
import { createGraphFirstDungeon } from '@/maps/dungeon-generation'
import { createRegionBasedOutdoorMap } from '@/maps/outdoor-generation'
import type { MapDefinition } from '@/maps/api'
import { profileMapRendering } from './profiling'

interface BaselineProfile {
  readonly scenario: string
  readonly width: number
  readonly height: number
  readonly generationMs: number
  readonly mapObjects: number
  readonly materialAreas: number
  readonly materialChunks: number
  readonly estimatedDisplayObjectsBeforeChunking: number
  readonly preparationMs?: number
  readonly estimatedRenderableNodesAfter?: number
  readonly visibleChunksAfter?: number
}

const profile = (scenario: string, started: number, map: MapDefinition): BaselineProfile => {
  const materialChunks = (map.materialLayers ?? []).reduce(
    (sum, layer) => sum + compileMaterialLayer(layer, map.width, map.height).length,
    0,
  )
  return {
    scenario,
    width: map.width,
    height: map.height,
    generationMs: Math.round((performance.now() - started) * 10) / 10,
    mapObjects: map.objects.length,
    materialAreas: (map.materialLayers ?? []).reduce((sum, layer) => sum + layer.areas.length, 0),
    materialChunks,
    // Previous engine: one runtime root per MapObject plus three containers and three Graphics per
    // material chunk. Children inside individual object renderers are intentionally not estimated.
    estimatedDisplayObjectsBeforeChunking: map.objects.length + materialChunks * 6,
  }
}

const outdoor = (size: number, seed: number): BaselineProfile => {
  const started = performance.now()
  const plan = createLocalMapPlan({
    seed,
    mapType: 'outdoor',
    size: 'custom',
    width: size,
    height: size,
    biomes: ['forest'],
    waterFeatures: ['river'],
    themes: ['ruins'],
  })
  return profile(`outdoor-${size}x${size}`, started, createRegionBasedOutdoorMap(plan).map)
}

describe('MapEngine Performance-Baseline', () => {
  it(
    'misst reproduzierbar Karten von 50x50 bis 150x150 und sehr grosse Generatorfaelle',
    { timeout: 30_000 },
    () => {
      const profiles = [outdoor(50, 50_050), outdoor(100, 100_100), outdoor(150, 150_150)]

      const dungeonStarted = performance.now()
      const dungeon = createGraphFirstDungeon(
        createLocalMapPlan({
          seed: 880_120,
          mapType: 'dungeon',
          size: 'huge',
          dungeon: {
            roomCount: 120,
            levelCount: 4,
            entranceCount: 4,
            loops: 'many',
            deadEnds: 'many',
            secretRooms: true,
            largeHalls: true,
            bossRoom: true,
            naturalCaveRatio: 0.25,
          },
        }),
      ).map
      profiles.push(profile('dungeon-120-rooms', dungeonStarted, dungeon))

      const veryLargeOutdoorStarted = performance.now()
      const veryLargeOutdoor = createRegionBasedOutdoorMap(
        createLocalMapPlan({
          seed: 990_150,
          mapType: 'outdoor',
          size: 'custom',
          width: 150,
          height: 150,
          biomes: ['forest', 'swamp'],
          waterFeatures: ['multiple-rivers', 'lake'],
          themes: ['ruins'],
        }),
      ).map
      profiles.push(profile('outdoor-150-complex', veryLargeOutdoorStarted, veryLargeOutdoor))

      console.info(`MAP_ENGINE_BASELINE=${JSON.stringify(profiles)}`)
      const afterProfiles = profiles.map((entry, index) => {
        const map =
          index < 3
            ? createRegionBasedOutdoorMap(
                createLocalMapPlan({
                  seed: [50_050, 100_100, 150_150][index]!,
                  mapType: 'outdoor',
                  size: 'custom',
                  width: [50, 100, 150][index]!,
                  height: [50, 100, 150][index]!,
                  biomes: ['forest'],
                  waterFeatures: ['river'],
                  themes: ['ruins'],
                }),
              ).map
            : index === 3
              ? dungeon
              : veryLargeOutdoor
        const profileStarted = performance.now()
        const visibleWidth = Math.min(40, map.width)
        const visibleHeight = Math.min(30, map.height)
        const renderProfile = profileMapRendering(
          map,
          { minX: 0, minY: 0, maxX: visibleWidth, maxY: visibleHeight },
          0.7,
        )
        return {
          ...entry,
          preparationMs: Math.round((performance.now() - profileStarted) * 10) / 10,
          estimatedRenderableNodesAfter: renderProfile.estimatedRenderableNodesAfter,
          visibleChunksAfter:
            renderProfile.visibleMaterialChunks + renderProfile.visibleStaticChunks,
        }
      })
      console.info(`MAP_ENGINE_CHUNKED=${JSON.stringify(afterProfiles)}`)
      expect(profiles).toHaveLength(5)
      expect(profiles.every((entry) => entry.generationMs < 15_000)).toBe(true)
      expect(profiles.find((entry) => entry.scenario === 'outdoor-150x150')?.width).toBe(150)
      expect(dungeon.width).toBeGreaterThan(80)
      expect(dungeon.height).toBeGreaterThan(80)
      expect(
        afterProfiles.every(
          (entry) =>
            entry.estimatedRenderableNodesAfter! < entry.estimatedDisplayObjectsBeforeChunking,
        ),
      ).toBe(true)
      expect(afterProfiles.every((entry) => entry.preparationMs! < 1_000)).toBe(true)
    },
  )
})
