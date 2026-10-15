import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, type FederatedPointerEvent } from 'pixi.js'
import type { PixelPoint } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import { TokenDragFrameQueue, TokenRenderer, type TokenRendererHandlers } from './TokenRenderer'

interface FeedbackProbe {
  readonly container: Container
  readonly ghost: Container
  readonly target: Container
  readonly readout: Container
  readonly readoutText: { readonly text: string }
}

const handlers: TokenRendererHandlers = {
  onSelect: () => undefined,
  onMoveEnd: () => undefined,
  onLongPress: () => undefined,
}

function token(id: string, x: number, color = '#3f8cff'): PlacedToken {
  return {
    id,
    mapId: 'test-map',
    name: id,
    position: { x, y: 2 },
    size: 1,
    rotation: 0,
    visionRange: 8,
    visionAngle: null,
    visionEnabled: true,
    category: 'player',
    color,
    symbol: 'T',
  }
}

function emitPointerDown(container: Container | undefined, pointerId: number, x: number): void {
  container?.emit('pointerdown', {
    pointerId,
    global: { x, y: 96 },
    stopPropagation: () => undefined,
  } as FederatedPointerEvent)
}

function emitDoubleTap(container: Container | undefined, pointerId: number, x: number): void {
  container?.emit('pointertap', {
    pointerId,
    detail: 2,
    global: { x, y: 96 },
    stopPropagation: () => undefined,
  } as FederatedPointerEvent)
}

function renderTokens(
  renderer: TokenRenderer,
  layer: Container,
  selectionLayer: Container,
  tokens: readonly PlacedToken[],
  selectedTokenId: string | null,
  tokenHandlers: TokenRendererHandlers,
): void {
  renderer.render(
    layer,
    selectionLayer,
    tokens,
    selectedTokenId,
    48,
    { x: 0, y: 0, zoom: 1 },
    { x: 480, y: 480 },
    0,
    { visible: true, snap: true },
    tokenHandlers,
  )
}

function feedbackFor(renderer: TokenRenderer): Map<number, FeedbackProbe> {
  return Reflect.get(renderer, 'dragFeedback') as Map<number, FeedbackProbe>
}

describe('TokenDragFrameQueue', () => {
  it('bündelt pro Pointer auf die letzte Position eines Frames', () => {
    const scheduled: FrameRequestCallback[] = []
    const processed: Array<{ pointerId: number; point: PixelPoint }> = []
    const queue = new TokenDragFrameQueue(
      (callback) => {
        scheduled.push(callback)
        return 7
      },
      () => undefined,
    )
    const process = (pointerId: number, point: PixelPoint) => processed.push({ pointerId, point })

    queue.schedule(1, { x: 10, y: 12 }, process)
    queue.schedule(2, { x: 30, y: 32 }, process)
    queue.schedule(1, { x: 18, y: 24 }, process)
    queue.schedule(3, { x: 40, y: 42 }, process)

    expect(processed).toEqual([])
    scheduled[0]?.(0)
    expect(processed).toEqual([
      { pointerId: 1, point: { x: 18, y: 24 } },
      { pointerId: 2, point: { x: 30, y: 32 } },
      { pointerId: 3, point: { x: 40, y: 42 } },
    ])
  })

  it('flusht und verwirft einzelne Pointer, ohne andere Updates zu verlieren', () => {
    let cancelledHandle: number | null = null
    const scheduled: FrameRequestCallback[] = []
    const processed: Array<{ pointerId: number; point: PixelPoint }> = []
    const queue = new TokenDragFrameQueue(
      (callback) => {
        scheduled.push(callback)
        return 11
      },
      (handle) => {
        cancelledHandle = handle
      },
    )
    const process = (pointerId: number, point: PixelPoint) => processed.push({ pointerId, point })

    queue.schedule(1, { x: 10, y: 12 }, process)
    queue.schedule(2, { x: 30, y: 32 }, process)
    queue.schedule(3, { x: 40, y: 42 }, process)
    queue.flush(1, process, { x: 22, y: 26 })
    queue.cancel(2)

    expect(cancelledHandle).toBeNull()
    expect(processed).toEqual([{ pointerId: 1, point: { x: 22, y: 26 } }])
    scheduled[0]?.(0)
    expect(processed).toEqual([
      { pointerId: 1, point: { x: 22, y: 26 } },
      { pointerId: 3, point: { x: 40, y: 42 } },
    ])
  })
})

describe('TokenRenderer', () => {
  afterEach(() => vi.useRealTimers())

  it('behält Container bei Positions- und Auswahländerungen bei', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    renderTokens(renderer, layer, selectionLayer, [token('first', 2)], 'first', handlers)
    const container = layer.children[0]
    const marker = selectionLayer.children[0]

    renderTokens(renderer, layer, selectionLayer, [token('first', 4)], 'first', handlers)

    expect(layer.children[0]).toBe(container)
    expect(selectionLayer.children[0]).toBe(marker)
    expect(container?.position.x).not.toBe(0)
  })

  it('requests inline renaming only for an inactive double tap', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const requested: Array<{ tokenId: string; point: PixelPoint }> = []
    const renameHandlers: TokenRendererHandlers = {
      ...handlers,
      onRenameRequest: (tokenId, point) => requested.push({ tokenId, point }),
    }
    renderTokens(renderer, layer, new Container(), [token('first', 2)], null, renameHandlers)

    emitDoubleTap(layer.children[0], 6, 96)
    expect(requested).toEqual([{ tokenId: 'first', point: { x: 96, y: 96 } }])

    emitPointerDown(layer.children[0], 7, 96)
    emitDoubleTap(layer.children[0], 7, 96)
    expect(requested).toHaveLength(1)
  })

  it('shows a ghost, target, hex distance and animates the same selection ring', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    const first = token('first', 2)
    renderTokens(renderer, layer, selectionLayer, [first], first.id, handlers)
    const marker = Reflect.get(renderer, 'selectionMarker') as Container

    expect(marker.scale.x).toBeCloseTo(0.86)
    renderer.update(0.2)
    expect(marker.scale.x).toBe(1)

    emitPointerDown(layer.children[0], 9, 96)
    renderer.dragToScreenPoint(9, { x: 144, y: 96 }, 48, handlers)
    const feedback = feedbackFor(renderer).get(9)

    expect(feedback?.ghost.position).toMatchObject({ x: 96, y: 96 })
    expect(feedback?.target.position).toMatchObject({ x: 144, y: 96 })
    expect(feedback?.readoutText.text).toBe('5 ft · 1 Hexfeld')
    expect(Reflect.get(renderer, 'selectionMarker')).toBe(marker)
    expect(Reflect.get(renderer, 'selectionMarkerDragging')).toBe(true)

    renderer.finishDrag(9, { visible: true, snap: true }, 48, handlers)
    expect(feedbackFor(renderer).size).toBe(0)
    expect(Reflect.get(renderer, 'selectionMarkerDragging')).toBe(false)
    expect(marker.scale.x).toBeCloseTo(1.12)
    renderer.update(0.2)
    expect(marker.scale.x).toBe(1)
  })

  it('keeps feedback readable through zoom and map rotation without recreating it', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    renderTokens(renderer, layer, selectionLayer, [token('first', 2)], null, handlers)
    emitPointerDown(layer.children[0], 10, 96)
    renderer.dragToScreenPoint(10, { x: 144, y: 96 }, 48, handlers)
    const feedback = feedbackFor(renderer).get(10)

    renderer.setCamera({ x: 20, y: 30, zoom: 2 }, { x: 480, y: 480 }, 90)

    expect(feedbackFor(renderer).get(10)).toBe(feedback)
    expect(feedback?.readout.scale.x).toBeCloseTo(0.5)
    expect(feedback?.readout.rotation).toBeCloseTo(-Math.PI / 2)
  })

  it('ordnet einen Token-Drag eindeutig dem auslösenden Pointer zu', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selected: string[] = []
    const dragHandlers: TokenRendererHandlers = {
      ...handlers,
      onSelect: (tokenId) => {
        if (tokenId) selected.push(tokenId)
      },
    }
    renderTokens(renderer, layer, new Container(), [token('first', 2)], null, dragHandlers)
    emitPointerDown(layer.children[0], 17, 96)

    expect(selected).toEqual(['first'])
    expect(renderer.isPointerActiveFor(17)).toBe(true)
    expect(renderer.isPointerActiveFor(18)).toBe(false)
  })

  it('bewegt drei Pointer unabhängig und committed nur den jeweils losgelassenen Token', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    const tokens = [
      token('first', 2),
      token('second', 4),
      token('third', 6),
      token('fourth', 8),
      token('fifth', 10),
    ]
    const moves: Array<{ tokenId: string; position: { x: number; y: number } }> = []
    const dragHandlers: TokenRendererHandlers = {
      ...handlers,
      onMoveEnd: (tokenId, position) => moves.push({ tokenId, position }),
    }
    renderTokens(renderer, layer, selectionLayer, tokens, null, dragHandlers)

    for (const [index, pointerId] of [11, 12, 13, 14, 15].entries()) {
      emitPointerDown(layer.children[index], pointerId, tokens[index]!.position.x * 48)
      renderer.dragToScreenPoint(
        pointerId,
        { x: (tokens[index]!.position.x + 1) * 48, y: 96 },
        48,
        dragHandlers,
      )
    }

    expect(feedbackFor(renderer).size).toBe(5)

    // A Pinia/selection update with stale positions must not move active visuals back.
    renderTokens(renderer, layer, selectionLayer, tokens, 'second', dragHandlers)
    expect(layer.children.map((child) => child.position.x)).toEqual([144, 240, 336, 432, 528])

    expect(renderer.finishDrag(12, { visible: true, snap: true }, 48, dragHandlers)).toBe(true)
    expect(renderer.isPointerActiveFor(11)).toBe(true)
    expect(renderer.isPointerActiveFor(13)).toBe(true)
    expect(renderer.isPointerActiveFor(14)).toBe(true)
    expect(renderer.isPointerActiveFor(15)).toBe(true)
    expect(moves).toEqual([{ tokenId: 'second', position: expect.objectContaining({ x: 5 }) }])
    expect(feedbackFor(renderer).has(12)).toBe(false)
    expect(feedbackFor(renderer).size).toBe(4)

    renderer.finishDrag(11, { visible: true, snap: true }, 48, dragHandlers)
    renderer.finishDrag(13, { visible: true, snap: true }, 48, dragHandlers)
    renderer.finishDrag(14, { visible: true, snap: true }, 48, dragHandlers)
    renderer.finishDrag(15, { visible: true, snap: true }, 48, dragHandlers)
    expect(moves.map((move) => move.tokenId)).toEqual([
      'second',
      'first',
      'third',
      'fourth',
      'fifth',
    ])
  })

  it('bricht nur den angegebenen Pointer ab und sperrt doppelte Token-Zugriffe', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const first = token('first', 2)
    const second = token('second', 4)
    const selected: string[] = []
    const dragHandlers: TokenRendererHandlers = {
      ...handlers,
      onSelect: (tokenId) => {
        if (tokenId) selected.push(tokenId)
      },
    }
    renderTokens(renderer, layer, new Container(), [first, second], null, dragHandlers)

    emitPointerDown(layer.children[0], 21, 96)
    emitPointerDown(layer.children[0], 22, 96)
    emitPointerDown(layer.children[1], 23, 192)
    renderer.dragToScreenPoint(21, { x: 144, y: 96 }, 48, dragHandlers)
    renderer.dragToScreenPoint(23, { x: 240, y: 96 }, 48, dragHandlers)
    renderer.cancelPointerInteraction(21)

    expect(renderer.isPointerActiveFor(21)).toBe(false)
    expect(renderer.isPointerActiveFor(22)).toBe(false)
    expect(renderer.isPointerActiveFor(23)).toBe(true)
    expect(layer.children[0]?.position.x).toBe(96)
    expect(layer.children[1]?.position.x).toBe(240)
    expect(selected).toEqual(['first', 'second'])
    expect(feedbackFor(renderer).has(21)).toBe(false)
    expect(feedbackFor(renderer).has(23)).toBe(true)
  })

  it('führt Long Press pro Pointer aus, ohne einen dritten Drag zu beeinflussen', () => {
    vi.useFakeTimers()
    const renderer = new TokenRenderer()
    const layer = new Container()
    const tokens = [token('first', 2), token('second', 4), token('third', 6)]
    const longPresses: string[] = []
    const dragHandlers: TokenRendererHandlers = {
      ...handlers,
      onLongPress: (tokenId) => longPresses.push(tokenId),
    }
    renderTokens(renderer, layer, new Container(), tokens, null, dragHandlers)
    for (const [index, pointerId] of [31, 32, 33].entries()) {
      emitPointerDown(layer.children[index], pointerId, tokens[index]!.position.x * 48)
    }
    renderer.dragToScreenPoint(33, { x: 336, y: 96 }, 48, dragHandlers)
    vi.advanceTimersByTime(520)

    expect(longPresses).toEqual(['first', 'second'])
    expect(renderer.isPointerActiveFor(31)).toBe(false)
    expect(renderer.isPointerActiveFor(32)).toBe(false)
    expect(renderer.isPointerActiveFor(33)).toBe(true)
    expect(layer.children[2]?.position.x).toBe(336)
    expect(feedbackFor(renderer).size).toBe(1)
  })

  it('cleans up feedback when an actively dragged token is removed', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    const first = token('first', 2)
    renderTokens(renderer, layer, selectionLayer, [first], null, handlers)
    emitPointerDown(layer.children[0], 41, 96)
    renderer.dragToScreenPoint(41, { x: 144, y: 96 }, 48, handlers)
    const feedback = feedbackFor(renderer).get(41)

    renderTokens(renderer, layer, selectionLayer, [], null, handlers)

    expect(renderer.isPointerActiveFor(41)).toBe(false)
    expect(feedbackFor(renderer).size).toBe(0)
    expect(feedback?.container.destroyed).toBe(true)
  })

  it('trifft den obersten Token anhand seiner tatsächlichen Kreisfläche', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    renderTokens(
      renderer,
      layer,
      new Container(),
      [token('lower', 2), token('upper', 2)],
      null,
      handlers,
    )

    expect(renderer.tokenIdAtScreenPoint({ x: 96, y: 96 }, 48)).toBe('upper')
    expect(renderer.tokenIdAtScreenPoint({ x: 140, y: 140 }, 48)).toBeNull()
  })
})
