import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    onMapLongPress: vi.fn<MapEngineHandlers['onMapLongPress']>(),
    onSpellPlace: vi.fn<MapEngineHandlers['onSpellPlace']>(),
    onSpellPlacementCancel: vi.fn<MapEngineHandlers['onSpellPlacementCancel']>(),
    onSpellEffectSelect: vi.fn<MapEngineHandlers['onSpellEffectSelect']>(),
    onSpellEffectUpdate: vi.fn<MapEngineHandlers['onSpellEffectUpdate']>(),
    onSpellEffectDelete: vi.fn<MapEngineHandlers['onSpellEffectDelete']>(),
    onSpellEffectDragStateChange: vi.fn<MapEngineHandlers['onSpellEffectDragStateChange']>(),
    onSpellEffectEditStateChange: vi.fn<MapEngineHandlers['onSpellEffectEditStateChange']>(),
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
  name:
    | 'handlePointerDown'
    | 'handlePointerMove'
    | 'handlePointerUp'
    | 'handlePointerCancel'
    | 'handleLostPointerCapture',
  event: PointerEvent,
): void {
  const handler = Reflect.get(engine, name) as (event: PointerEvent) => void
  handler(event)
}

describe('MapEngine Token-/Zauberflächen-Interaktion', () => {
  afterEach(() => vi.useRealTimers())

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

  it('leitet einen unbewegten Token-Long-Press exklusiv an das Kontextmenü weiter', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    engine.setTokens([token], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 18,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    vi.advanceTimersByTime(520)

    expect(callbacks.onTokenLongPress).toHaveBeenCalledWith(token.id, { x: 240, y: 240 })
    expect((Reflect.get(engine, 'tokenRenderer') as TokenRenderer).isPointerActiveFor(18)).toBe(
      false,
    )
    engine.destroy()
    vi.useRealTimers()
  })

  it('lässt eine fixierte Form durch gewöhnliches Ziehen unverändert', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], null)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(7, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(7, 252, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(7, 252, 240, 'touch'))

    expect(callbacks.onSpellEffectSelect).toHaveBeenCalledWith(sphere.id)
    expect(callbacks.onSpellEffectDragStateChange).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('wählt eine fixierte Form per Tap nur aus', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], null)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(9, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(9, 240, 240, 'touch'))

    expect(callbacks.onSpellEffectSelect).toHaveBeenCalledWith(sphere.id)
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectEditStateChange).not.toHaveBeenCalled()
    expect(Reflect.get(engine, 'spellEffectInteraction')).toBeNull()
    engine.destroy()
  })

  it('verschiebt eine Form erst nach Long Press und committet nur beim Loslassen', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], null)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(8, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)
    expect(callbacks.onSpellEffectEditStateChange).toHaveBeenCalledWith(sphere.id)

    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(8, 252, 240, 'touch'))
    Reflect.get(engine, 'flushSpellEffectUpdate').call(engine)
    expect(callbacks.onSpellEffectDragStateChange).toHaveBeenCalledWith(true)
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()

    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(8, 252, 240, 'touch'))
    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(sphere.id, {
      position: { x: 4.25, y: 4 },
    })
    expect(callbacks.onSpellEffectDragStateChange).toHaveBeenLastCalledWith(false)
    expect(callbacks.onSpellEffectEditStateChange).toHaveBeenLastCalledWith(null)
    engine.destroy()
    vi.useRealTimers()
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

  it('verliert Pointer Capture nur fÃ¼r die zugehÃ¶rige Token-Interaktion', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const secondToken = { ...token, id: 'capture-rogue', position: { x: 6, y: 4 } }
    engine.setMap(map, {})
    engine.setTokens([token, secondToken], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 24,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    layers.tokens.children[1]?.emit('pointerdown', {
      pointerId: 25,
      global: { x: 336, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(24, 288, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(25, 384, 240, 'touch'))
    invokePointerHandler(engine, 'handleLostPointerCapture', pointerEvent(24, 288, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(25, 384, 240, 'touch'))

    expect(callbacks.onTokenMove).toHaveBeenCalledOnce()
    expect(callbacks.onTokenMove).toHaveBeenCalledWith(secondToken.id, expect.anything())
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer
    expect(renderer.isPointerActive).toBe(false)
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
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
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
    expect(Reflect.get(engine, 'touchCameraGesture').size).toBe(1)
    const initialCamera = Reflect.get(engine, 'settings').camera
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(61, 112, 100, 'touch'))
    Reflect.get(engine, 'flushTouchCameraUpdate').call(engine)
    expect(Reflect.get(engine, 'settings').camera.x).toBe(initialCamera.x + 5)

    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(60, 288, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(61, 112, 100, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(60, 288, 240, 'touch'))
    expect(callbacks.onTokenMove).toHaveBeenCalledOnce()
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(60, 240, 240, 'touch'))
    engine.destroy()
  })

  it('trifft Spell-Resize-Griffe mit Touch großzügiger als mit der Maus', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], sphere.id)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(69, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(69, 240, 240, 'touch'))

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(70, 457, 240, 'touch'))
    expect(Reflect.get(engine, 'spellEffectInteraction')).toMatchObject({ mode: 'resize' })
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(70, 480, 240, 'touch'))
    Reflect.get(engine, 'flushSpellEffectUpdate').call(engine)
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(70, 480, 240, 'touch'))
    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(
      sphere.id,
      expect.objectContaining({ size: expect.any(Number) }),
    )

    const mouseEngine = new MapEngine(document.createElement('div'), handlers())
    mouseEngine.setMap(map, {})
    mouseEngine.setSpellEffects([sphere], sphere.id)
    invokePointerHandler(mouseEngine, 'handlePointerDown', pointerEvent(68, 240, 240, 'mouse'))
    vi.advanceTimersByTime(520)
    invokePointerHandler(mouseEngine, 'handlePointerUp', pointerEvent(68, 240, 240, 'mouse'))
    invokePointerHandler(mouseEngine, 'handlePointerDown', pointerEvent(71, 457, 240, 'mouse'))
    expect(Reflect.get(mouseEngine, 'spellEffectInteraction')).toBeNull()
    engine.destroy()
    mouseEngine.destroy()
    vi.useRealTimers()
  })

  it('dreht nur im bewussten Bearbeitungsmodus und committet beim Loslassen', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], sphere.id)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(73, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(73, 240, 240, 'touch'))

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(74, 240, 10, 'touch'))
    expect(Reflect.get(engine, 'spellEffectInteraction')).toMatchObject({ mode: 'rotate' })
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(74, 300, 40, 'touch'))
    Reflect.get(engine, 'flushSpellEffectUpdate').call(engine)
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(74, 300, 40, 'touch'))

    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(
      sphere.id,
      expect.objectContaining({ rotation: expect.any(Number) }),
    )
    expect(Reflect.get(engine, 'editingSpellEffectId')).toBe(sphere.id)
    engine.finishSpellEffectEditing()
    expect(Reflect.get(engine, 'editingSpellEffectId')).toBeNull()
    engine.destroy()
    vi.useRealTimers()
  })

  it('verwirft lokale Spell-Änderungen bei pointercancel', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], sphere.id)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(75, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(75, 270, 240, 'touch'))
    Reflect.get(engine, 'flushSpellEffectUpdate').call(engine)
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(75, 270, 240, 'touch'))

    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectDragStateChange).toHaveBeenLastCalledWith(false)
    expect(Reflect.get(engine, 'editingSpellEffectId')).toBeNull()
    expect(Reflect.get(engine, 'spellEffectInteraction')).toBeNull()
    engine.destroy()
    vi.useRealTimers()
  })

  it('beendet den Spell-Bearbeitungsmodus beim Kartenwechsel', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setSpellEffects([sphere], sphere.id)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(76, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(76, 240, 240, 'touch'))
    expect(Reflect.get(engine, 'editingSpellEffectId')).toBe(sphere.id)

    engine.setMap({ ...map, id: 'spell-next-map' }, {})

    expect(Reflect.get(engine, 'editingSpellEffectId')).toBeNull()
    expect(callbacks.onSpellEffectEditStateChange).toHaveBeenLastCalledWith(null)
    engine.destroy()
    vi.useRealTimers()
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

  it('öffnet nach 520 ms auf freier Kartenfläche das Menü am ursprünglichen Punkt', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(80, 100, 120, 'touch'))
    vi.advanceTimersByTime(519)
    expect(callbacks.onMapLongPress).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(callbacks.onMapLongPress).toHaveBeenCalledOnce()
    expect(callbacks.onMapLongPress).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      { x: 100, y: 120 },
    )
    expect(Reflect.get(engine, 'touchCameraGesture').size).toBe(0)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(80, 100, 120, 'touch'))
    engine.destroy()
    vi.useRealTimers()
  })

  it('verwirft den Karten-Long-Press bei Bewegung, zweitem Finger und pointercancel', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(81, 100, 120, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(81, 108, 120, 'touch'))
    vi.advanceTimersByTime(520)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(82, 120, 140, 'touch'))
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(83, 220, 140, 'touch'))
    vi.advanceTimersByTime(520)

    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(82, 120, 140, 'touch'))
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(83, 220, 140, 'touch'))
    expect(callbacks.onMapLongPress).not.toHaveBeenCalled()
    engine.destroy()
    vi.useRealTimers()
  })

  it('öffnet auf einer vorhandenen Zauberfläche kein Kartenmenü', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    engine.setSpellEffects([effect('sphere')], null)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(84, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)

    expect(callbacks.onMapLongPress).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectEditStateChange).toHaveBeenCalledWith('effect-sphere')
    expect(callbacks.onSpellEffectDragStateChange).not.toHaveBeenCalled()
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(84, 240, 240, 'touch'))
    expect(Reflect.get(engine, 'editingSpellEffectId')).toBe('effect-sphere')
    engine.finishSpellEffectEditing()
    expect(callbacks.onSpellEffectEditStateChange).toHaveBeenLastCalledWith(null)
    engine.destroy()
    vi.useRealTimers()
  })

  it('behandelt einen Token-Long-Press ausschließlich als Token-Interaktion', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})
    engine.setTokens([token], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 86,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(86, 240, 240, 'touch'))
    vi.advanceTimersByTime(520)

    expect(callbacks.onTokenLongPress).toHaveBeenCalledWith(token.id, { x: 240, y: 240 })
    expect(callbacks.onMapLongPress).not.toHaveBeenCalled()
    engine.destroy()
    vi.useRealTimers()
  })

  it('räumt einen ausstehenden Karten-Long-Press bei Kartenwechsel und Destroy auf', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    engine.setMap(map, {})

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(87, 100, 120, 'touch'))
    engine.setMap({ ...map, id: 'next-map' }, {})
    vi.advanceTimersByTime(520)

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(88, 120, 140, 'touch'))
    engine.destroy()
    vi.advanceTimersByTime(520)

    expect(callbacks.onMapLongPress).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('erstellt und bestätigt eine freie Vorschau ohne Token', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const placement = {
      kind: 'free',
      presetId: 'shape-cone',
      origin: { x: 3, y: 5 },
    } as const
    engine.setMap(map, {})
    engine.setTokens([], null)
    engine.setSpellPlacement(placement)

    expect(Reflect.get(engine, 'createSpellPreview').call(engine)).toMatchObject({
      effect: {
        position: placement.origin,
        attachedToCaster: false,
      },
    })
    expect(Reflect.get(engine, 'createSpellPreview').call(engine).effect).not.toHaveProperty(
      'casterTokenId',
    )

    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(85, 180, 210, 'touch'))
    expect(callbacks.onSpellPlace).toHaveBeenCalledWith(
      placement,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    )
    engine.destroy()
  })
  it('laesst einen Resize-Griff neben einem laufenden Token-Drag pointer-lokal arbeiten', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setTokens([token], null)
    engine.setSpellEffects([sphere], sphere.id)
    Reflect.set(engine, 'editingSpellEffectId', sphere.id)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 90,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(90, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(91, 457, 240, 'touch'))

    expect(Reflect.get(engine, 'spellEffectInteraction')).toMatchObject({
      pointerId: 91,
      mode: 'resize',
    })
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(90, 288, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(91, 480, 240, 'touch'))
    Reflect.get(engine, 'flushSpellEffectUpdate').call(engine)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(91, 480, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(90, 288, 240, 'touch'))

    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledWith(
      sphere.id,
      expect.objectContaining({ size: expect.any(Number) }),
    )
    expect(callbacks.onTokenMove).toHaveBeenCalledWith(token.id, expect.anything())
    engine.destroy()
  })

  it('gibt einem expliziten Griff vor einem ueberlappenden Token Vorrang', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    const tokenAtHandle = { ...token, id: 'handle-token', position: { x: 8.5, y: 4 } }
    engine.setMap(map, {})
    engine.setTokens([tokenAtHandle], null)
    engine.setSpellEffects([sphere], sphere.id)
    Reflect.set(engine, 'editingSpellEffectId', sphere.id)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 92,
      global: { x: 457, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(92, 457, 240, 'touch'))

    expect(renderer.isPointerActiveFor(92)).toBe(false)
    expect(Reflect.get(engine, 'spellEffectInteraction')).toMatchObject({
      pointerId: 92,
      mode: 'resize',
    })
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(92, 480, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(92, 480, 240, 'touch'))
    expect(callbacks.onTokenMove).not.toHaveBeenCalled()
    expect(callbacks.onSpellEffectUpdate).toHaveBeenCalledOnce()
    engine.destroy()
  })

  it('beendet pointercancel nur den Spell-Griff und laesst den Token-Drag weiterlaufen', () => {
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const sphere = effect('sphere')
    engine.setMap(map, {})
    engine.setTokens([token], null)
    engine.setSpellEffects([sphere], sphere.id)
    Reflect.set(engine, 'editingSpellEffectId', sphere.id)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 93,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(93, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(94, 457, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(94, 480, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerCancel', pointerEvent(94, 480, 240, 'touch'))

    expect(renderer.isPointerActiveFor(93)).toBe(true)
    expect(Reflect.get(engine, 'spellEffectInteraction')).toBeNull()
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(93, 288, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(93, 288, 240, 'touch'))
    expect(callbacks.onTokenMove).toHaveBeenCalledWith(token.id, expect.anything())
    expect(callbacks.onSpellEffectUpdate).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('oeffnet den Long-Press eines zweiten Tokens, ohne den ersten Drag zu beenden', () => {
    vi.useFakeTimers()
    const callbacks = handlers()
    const engine = new MapEngine(document.createElement('div'), callbacks)
    const secondToken = { ...token, id: 'long-press-token', position: { x: 6, y: 4 } }
    engine.setMap(map, {})
    engine.setTokens([token, secondToken], null)
    const layers = Reflect.get(engine, 'layers') as { readonly tokens: Container }
    const renderer = Reflect.get(engine, 'tokenRenderer') as TokenRenderer

    layers.tokens.children[0]?.emit('pointerdown', {
      pointerId: 95,
      global: { x: 240, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(95, 240, 240, 'touch'))
    invokePointerHandler(engine, 'handlePointerMove', pointerEvent(95, 288, 240, 'touch'))
    Reflect.get(engine, 'flushTokenDrag').call(engine, 95, { x: 288, y: 240 })
    layers.tokens.children[1]?.emit('pointerdown', {
      pointerId: 96,
      global: { x: 336, y: 240 },
      stopPropagation: () => undefined,
    } as FederatedPointerEvent)
    invokePointerHandler(engine, 'handlePointerDown', pointerEvent(96, 336, 240, 'touch'))
    vi.advanceTimersByTime(520)

    expect(callbacks.onTokenLongPress).toHaveBeenCalledWith(secondToken.id, { x: 336, y: 240 })
    expect(renderer.isPointerActiveFor(95)).toBe(true)
    invokePointerHandler(engine, 'handlePointerUp', pointerEvent(95, 288, 240, 'touch'))
    engine.destroy()
    vi.useRealTimers()
  })
})
