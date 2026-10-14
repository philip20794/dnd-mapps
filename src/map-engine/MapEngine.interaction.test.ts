import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { PlacedSpellEffect } from '@/types/spells'
import type { PlacedToken } from '@/types/tokens'
import { Container, type FederatedPointerEvent } from 'pixi.js'
import { MapEngine, type MapEngineHandlers } from './MapEngine'
import { TokenRenderer, type TokenRendererHandlers } from './tokens/TokenRenderer'

const map: MapDefinition = {
  id: 'interaction-test',
  name: 'Interaction Test',
  width: 12,
  height: 12,
  gridSize: 48,
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
}

const token: PlacedToken = {
  id: 'hero',
  mapId: map.id,
  name: 'Held',
  position: { x: 4, y: 4 },
  size: 1,
  rotation: 0,
  visionRange: 8,
  visionAngle: null,
  visionEnabled: true,
  category: 'player',
  color: '#3f8cff',
  symbol: 'H',
}

function effect(shape: PlacedSpellEffect['shape']): PlacedSpellEffect {
  const startsAtOrigin = shape === 'cone' || shape === 'line'
  return {
    id: `effect-${shape}`,
    mapId: map.id,
    casterTokenId: token.id,
    presetId: 'test',
    name: shape,
    shape,
    position: startsAtOrigin ? { x: 2, y: 4 } : { x: 4, y: 4 },
    rotation: 0,
    size: 4,
    width: 2,
    duration: 'instant',
    color: '#ff0000',
    attachedToCaster: false,
  }
}

function handlers() {
  return {
    onTokenSelect: vi.fn<MapEngineHandlers['onTokenSelect']>(),
    onTokenMove: vi.fn<MapEngineHandlers['onTokenMove']>(),
    onTokenLongPress: vi.fn<MapEngineHandlers['onTokenLongPress']>(),
    onSpellPlace: vi.fn<MapEngineHandlers['onSpellPlace']>(),
    onSpellPlacementCancel: vi.fn<MapEngineHandlers['onSpellPlacementCancel']>(),
    onSpellEffectSelect: vi.fn<MapEngineHandlers['onSpellEffectSelect']>(),
    onSpellEffectUpdate: vi.fn<MapEngineHandlers['onSpellEffectUpdate']>(),
    onSpellEffectDelete: vi.fn<MapEngineHandlers['onSpellEffectDelete']>(),
    onSpellEffectDragStateChange: vi.fn<MapEngineHandlers['onSpellEffectDragStateChange']>(),
    onDoorToggle: vi.fn<MapEngineHandlers['onDoorToggle']>(),
    onLevelTransition: vi.fn<MapEngineHandlers['onLevelTransition']>(),
    onCameraChange: vi.fn<MapEngineHandlers['onCameraChange']>(),
    onExplore: vi.fn<MapEngineHandlers['onExplore']>(),
    onError: vi.fn<MapEngineHandlers['onError']>(),
  } satisfies MapEngineHandlers
}

function pointerEvent(
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = 'mouse',
): PointerEvent {
  return {
    pointerId,
    pointerType,
    button: 0,
    clientX,
    clientY,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent
}

function invokePointerHandler(
  engine: MapEngine,
  name: 'handlePointerDown' | 'handlePointerMove' | 'handlePointerUp' | 'handlePointerCancel',
  event: PointerEvent,
): void {
  const handler = Reflect.get(engine, name) as (event: PointerEvent) => void
  handler(event)
}

describe('MapEngine Token-/Zauberflächen-Interaktion', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  it.each(['cube', 'cone', 'sphere', 'cylinder', 'line', 'wall', 'emanation'] as const)(
    'gibt einem Token innerhalb von %s Vorrang vor der Zauberfläche',
    (shape) => {
      const callbacks = handlers()
      const engine = new MapEngine(document.createElement('div'), callbacks)
      engine.setMap(map, {})
      engine.setTokens([token], null)
      engine.setSpellEffects([effect(shape)], null)

      invokePointerHandler(engine, 'handlePointerDown', pointerEvent(3, 240, 240))

      expect(callbacks.onSpellEffectSelect).not.toHaveBeenCalled()
      expect(callbacks.onSpellEffectDragStateChange).not.toHaveBeenCalled()
      engine.destroy()
    },
  )

  it('behandelt denselben Token-Pointerdown aus Pixi und DOM nur als Token-Drag', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    engine.setTokens([token], null)
    engine.setSpellEffects([effect('sphere')], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 5,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(5, 240, 240))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(5, 264, 240))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(5, 264, 240))

    expect(callbacks.onTokenSelect).toHaveBeenCalledWith(token.id)
    expect(callbacks.onTokenMove).toHaveBeenCalledOnce()
    expect(callbacks.onSpellEffectSelect).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectDragStateChange).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('startet den direkten Spell-Drag nach Überschreiten der Bewegungsschwelle', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], null)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(7, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(8, 252, 240, 'touch'))
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()

    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(7, 252, 240, 'touch'))

    expect(callbacks.onSpellEffectDragStateChange).toHaveBeenCalledWith(true)
    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(sphere.id, {
      position: { x: 4.25, y: 4 },
    })
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(7, 252, 240, 'touch'))
    expect(callbacks.onSpellEffectDragStateChange).toHaveBeenLastCalledWith(false)
    engine.destroy()
  })

  it('lässt einen zweiten Pointer den laufenden Token-Drag nicht übernehmen', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const tokenHandlers: TokenRendererHandlers = {
      onSelect: () => undefined,
      onMoveEnd: () => undefined,
      onLongPress: () => undefined,
    }
    renderer.render(
      layer,
      new Container(),
      [token],
      null,
      map.gridSize,
      { x: 48, y: 48, zoom: 1 },
      { x: map.width * map.gridSize, y: map.height * map.gridSize },
      0,
      { visible: true, snap: true },
      tokenHandlers,
    )
    layer.children[0]?.emit('pointerdown', {
      pointerId: 10,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)

    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    engine.setSpellEffects([effect('sphere')], null)
    Reflect.set(engine, 'tokenRenderer', renderer)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(11, 300, 240))

    expect(renderer.isPointerActiveFor(10)).toBe(true)
    expect(callbacks.onSpellEffectSelect).not.toHaveBeenCalled()
    renderer.cancelPointerInteraction()
    engine.destroy()
  })

  it('bricht bei pointercancel nur den betroffenen Token ab', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const secondToken = { ...token, id: 'rogue', position: { x: 6, y: 4 } }
    engine.setMap(map, {})
    engine.setTokens([token, secondToken], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 20,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    layers.tokens.children[1]?.emit('pointerdown', {
      pointerId: 21,
      global: { x: 336, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(20, 288, 240))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(21, 384, 240))
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(20, 288, 240))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(21, 384, 240))

    expect(callbacks.onTokenMove).toHaveBeenCalledOnce()
    expect(callbacks.onTokenMove).toHaveBeenCalledWith(
      secondToken.id,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    )
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer
    expect(renderer.isPointerActiveFor(20)).toBe(false)
    expect(renderer.isPointerActiveFor(21)).toBe(false)
    engine.destroy()
  })

  it('bereinigt alle Token-Interaktionen beim Kartenwechsel', () => {
    const engine = new MapEngine(document.createElement('div'), handlers())
    engine.setMap(map, {})
    engine.setTokens([token], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer
    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 30,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)

    engine.setMap({ ...map, id: 'next-map' }, {})

    expect(renderer.isPointerActive).toBe(false)
    engine.destroy()
  })

  it('verschiebt die Kamera mit einem leeren Touch-Pointer erst nach der Schwelle', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    const initialCamera = Reflect.get(engine, 'settings').camera

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(40, 100, 100, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(40, 105, 100, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    expect(Reflect.get(engine, 'settings').camera).toEqual(initialCamera)

    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(40, 112, 100, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    expect(Reflect.get(engine, 'settings').camera.x).toBe(initialCamera.x + 5)
    expect(callbacks.onCameraChange).toHaveBeenCalledOnce()
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(40, 112, 100, 'touch'))
    engine.destroy()
  })

  it('kombiniert Zwei-Finger-Panning und Pinch-Zoom ohne Sprung beim Übergang', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    const initialCamera = Reflect.get(engine, 'settings').camera

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(50, 100, 100, 'touch'))
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(51, 200, 100, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    expect(Reflect.get(engine, 'settings').camera).toEqual(initialCamera)

    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(50, 110, 110, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(51, 230, 110, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    const pinchedCamera = Reflect.get(engine, 'settings').camera
    expect(pinchedCamera.zoom).toBeGreaterThan(initialCamera.zoom)
    expect(pinchedCamera.y).not.toBe(initialCamera.y)

    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(51, 230, 110, 'touch'))
    const cameraAfterRelease = Reflect.get(engine, 'settings').camera
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(50, 114, 110, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    expect(Reflect.get(engine, 'settings').camera).toEqual(cameraAfterRelease)
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(50, 114, 110, 'touch'))
    engine.destroy()
  })

  it('übernimmt einen laufenden Token-Drag nicht als Touch-Kamerageste', () => {
    const engine = new MapEngine(document.createElement('div'), handlers())
    engine.setMap(map, {})
    engine.setTokens([token], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 60,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(60, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(61, 100, 100, 'touch'))

    expect(renderer.isPointerActiveFor(60)).toBe(true)
    expect(Reflect.get(engine, 'touchCameraGesture').size).toBe(0)
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(60, 240, 240, 'touch'))
    engine.destroy()
  })

  it('trifft Spell-Resize-Griffe mit Touch großzügiger als mit der Maus', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], sphere.id)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(70, 457, 240, 'touch'))
    expect(Reflect.get(engine, 'spellEffectInteraction')).toMatchObject({ mode: 'resize' })
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(70, 480, 240, 'touch'))
    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(
      sphere.id,
      expect.objectContaining({ size: expect.any(Number) }),
    )
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(70, 480, 240, 'touch'))

    const mouseEngine = new MapEngine(document.createElement('div'), handlers())
    mouseEngine.setMap(map, {})
    mouseEngine.setSpellEffects([sphere], sphere.id)
    invokePointerHandler(mouseEngine, 'handlePointerDown', pointerEvent(71, 457, 240, 'mouse'))
    expect(Reflect.get(mouseEngine, 'spellEffectInteraction')).toBeNull()
    engine.destroy()
    mouseEngine.destroy()
  })

  it('gibt einem Token innerhalb einer Spell-Fläche außerhalb der Griffe Vorrang', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setTokens([token], null)
    engine.setSpellEffects([sphere], sphere.id)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 72,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(72, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(72, 264, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(72, 264, 240, 'touch'))

    expect(callbacks.onTokenMove).toHaveBeenCalledOnce()
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    engine.destroy()
  })
})
