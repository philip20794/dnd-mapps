import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { PlacedToken } from '@/types/tokens'
import { defaultRuntimeSettings } from '@/types/settings'
import {
  addPolygonsToExplorationMask,
  createEmptyExplorationMask,
  sharedFogVisibilityMode,
} from './fog/fogState'
import { FogRenderer } from './fog/FogRenderer'
import { MapEngine, type MapEngineHandlers } from './MapEngine'
import { combineVisibleBlockers } from './visibility/visibility'

const map: MapDefinition = {
  id: 'fog-engine-test',
  name: 'Fog Engine Test',
  width: 12,
  height: 12,
  gridSize: 48,
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
}

const walledMap: MapDefinition = {
  ...map,
  walls: [
    {
      id: 'visible-wall',
      a: { x: 6, y: 0 },
      b: { x: 6, y: 12 },
      blocksSight: true,
      blocksMovement: true,
    },
  ],
}

function token(x: number, id = 'hero'): PlacedToken {
  return {
    id,
    mapId: map.id,
    name: 'Held',
    position: { x, y: 4 },
    size: 1,
    rotation: 0,
    visionRange: 4,
    visionAngle: null,
    visionEnabled: true,
    category: 'player',
    color: '#3f8cff',
    symbol: 'H',
  }
}

function createHandlers(onExplore: MapEngineHandlers['onExplore']): MapEngineHandlers {
  return {
    onTokenSelect: () => undefined,
    onTokenMove: () => undefined,
    onTokenLongPress: () => undefined,
    onMapLongPress: () => undefined,
    onSpellPlace: () => undefined,
    onSpellPlacementCancel: () => undefined,
    onSpellEffectSelect: () => undefined,
    onSpellEffectUpdate: () => undefined,
    onSpellEffectDelete: () => undefined,
    onSpellEffectDragStateChange: () => undefined,
    onSpellEffectEditStateChange: () => undefined,
    onDoorToggle: () => undefined,
    onLevelTransition: () => undefined,
    onCameraChange: () => undefined,
    onExplore,
    onError: () => undefined,
  }
}

describe('MapEngine Fog-Aktualisierung', () => {
  let renderSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    renderSpy = vi.spyOn(FogRenderer.prototype, 'render').mockImplementation(() => undefined)
  })

  afterEach(() => {
    renderSpy.mockRestore()
  })

  it('rendert neue aktuelle Sicht auch ohne neue Erkundungszellen', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    engine.setMap(map, {})
    engine.setTokens([token(3)], null)
    const fullyExplored = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 12 },
        { x: 0, y: 12 },
      ],
    ])
    engine.setFogState({
      enabled: true,
      persistExploration: true,
      visibilityMode: sharedFogVisibilityMode,
      explored: fullyExplored,
    })
    renderSpy.mockClear()
    onExplore.mockClear()

    engine.setTokens([token(4)], null)

    expect(onExplore).toHaveBeenCalledOnce()
    expect(renderSpy).toHaveBeenCalledOnce()
    engine.destroy()
  })

  it('aktualisiert Fog sofort, wenn die Sicht eines Tokens deaktiviert wird', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    engine.setMap(map, {})
    engine.setFogState({
      enabled: true,
      persistExploration: false,
      visibilityMode: sharedFogVisibilityMode,
      explored: null,
    })
    engine.setTokens([token(3)], null)
    renderSpy.mockClear()

    engine.setTokens([{ ...token(3), visionRange: 0, visionEnabled: false }], null)

    expect(renderSpy).toHaveBeenCalledOnce()
    expect(Reflect.get(engine, 'currentVisiblePolygons')).toEqual([])
    engine.destroy()
  })

  it('speichert die aktuelle Sicht sofort beim Einschalten persistenter Erkundung', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    engine.setMap(map, {})
    engine.setTokens([token(3)], null)
    engine.setFogState({
      enabled: true,
      persistExploration: false,
      visibilityMode: sharedFogVisibilityMode,
      explored: null,
    })
    renderSpy.mockClear()
    onExplore.mockClear()

    engine.setFogState({
      enabled: true,
      persistExploration: true,
      visibilityMode: sharedFogVisibilityMode,
      explored: null,
    })

    expect(onExplore).toHaveBeenCalledOnce()
    expect(renderSpy).toHaveBeenCalledOnce()
    engine.destroy()
  })

  it('rotiert und zoomt Fog samt Blockerkontur ohne Sichtgeometrie neu zu berechnen', () => {
    const engine = new MapEngine(
      document.createElement('div'),
      createHandlers(() => undefined),
    )
    engine.setMap(walledMap, {})
    engine.setFogState({
      enabled: true,
      persistExploration: false,
      visibilityMode: sharedFogVisibilityMode,
      explored: null,
    })
    engine.setTokens([token(3)], null)
    const fields = Reflect.get(engine, 'currentVisibilityFields')
    expect(combineVisibleBlockers(fields)[0]?.blockerId).toBe('wall:visible-wall')
    renderSpy.mockClear()

    for (const mapRotation of [0, 90, 180, 270] as const) {
      for (const zoom of [0.5, 1, 2]) {
        engine.setSettings({
          ...defaultRuntimeSettings,
          mapRotation,
          camera: { ...defaultRuntimeSettings.camera, zoom },
        })

        expect(Reflect.get(engine, 'currentVisibilityFields')).toBe(fields)
        expect(Reflect.get(engine, 'world').rotation).toBeCloseTo((mapRotation * Math.PI) / 180)
        expect(Reflect.get(engine, 'world').scale.x).toBeCloseTo(zoom)
      }
    }
    expect(renderSpy).not.toHaveBeenCalled()
    engine.destroy()
  })
  it('aktualisiert Fog sofort, wenn einem vorher sichtlosen Gegner Sicht gegeben wird', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    engine.setMap(map, {})
    engine.setFogState({
      enabled: true,
      persistExploration: false,
      visibilityMode: sharedFogVisibilityMode,
      explored: null,
    })
    const sightlessMonster = {
      ...token(3),
      id: 'goblin',
      category: 'monster' as const,
      visionRange: 0,
      visionEnabled: false,
    }
    engine.setTokens([sightlessMonster], null)
    renderSpy.mockClear()

    engine.setTokens([{ ...sightlessMonster, visionRange: 6, visionEnabled: true }], null)

    expect(renderSpy).toHaveBeenCalledOnce()
    expect(Reflect.get(engine, 'currentVisiblePolygons')).not.toEqual([])
    engine.destroy()
  })

  it('zeigt im Spielermodus nur dessen aktuelle Sicht und verwendet keine gemeinsame Erkundung', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    const explored = addPolygonsToExplorationMask(createEmptyExplorationMask(), [
      [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 12 },
        { x: 0, y: 12 },
      ],
    ])
    engine.setMap(walledMap, {})
    engine.setTokens([token(3, 'hero-left'), token(9, 'hero-right')], null)
    engine.setFogState({
      enabled: true,
      persistExploration: true,
      visibilityMode: sharedFogVisibilityMode,
      explored,
    })
    onExplore.mockClear()
    renderSpy.mockClear()

    engine.setFogState({
      enabled: true,
      persistExploration: true,
      visibilityMode: { kind: 'player', tokenId: 'hero-left' },
      explored,
    })

    const fields: readonly unknown[] = Reflect.get(engine, 'currentVisibilityFields')
    const renderState = renderSpy.mock.calls.at(-1)?.[2]
    expect(fields).toHaveLength(1)
    expect(onExplore).not.toHaveBeenCalled()
    expect(renderState).toMatchObject({ persistExploration: false, explored: null })
    expect(combineVisibleBlockers(Reflect.get(engine, 'currentVisibilityFields'))[0]?.blockerId).toBe(
      'wall:visible-wall',
    )
    engine.destroy()
  })
})
