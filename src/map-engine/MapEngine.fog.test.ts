import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { PlacedToken } from '@/types/tokens'
import { addPolygonsToExplorationMask, createEmptyExplorationMask } from './fog/fogState'
import { FogRenderer } from './fog/FogRenderer'
import { MapEngine, type MapEngineHandlers } from './MapEngine'

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

function token(x: number): PlacedToken {
  return {
    id: 'hero',
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
    onSpellPlace: () => undefined,
    onSpellPlacementCancel: () => undefined,
    onSpellEffectSelect: () => undefined,
    onSpellEffectUpdate: () => undefined,
    onSpellEffectDelete: () => undefined,
    onSpellEffectDragStateChange: () => undefined,
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
    const fullyExplored = addPolygonsToExplorationMask(createEmptyExplorationMask(), [[
      { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 },
    ]])
    engine.setFogState({ enabled: true, persistExploration: true, explored: fullyExplored })
    renderSpy.mockClear()
    onExplore.mockClear()

    engine.setTokens([token(4)], null)

    expect(onExplore).toHaveBeenCalledOnce()
    expect(renderSpy).toHaveBeenCalledOnce()
    engine.destroy()
  })

  it('speichert die aktuelle Sicht sofort beim Einschalten persistenter Erkundung', () => {
    const onExplore = vi.fn<MapEngineHandlers['onExplore']>()
    const engine = new MapEngine(document.createElement('div'), createHandlers(onExplore))
    engine.setMap(map, {})
    engine.setTokens([token(3)], null)
    engine.setFogState({ enabled: true, persistExploration: false, explored: null })
    renderSpy.mockClear()
    onExplore.mockClear()

    engine.setFogState({ enabled: true, persistExploration: true, explored: null })

    expect(onExplore).toHaveBeenCalledOnce()
    expect(renderSpy).toHaveBeenCalledOnce()
    engine.destroy()
  })
})
