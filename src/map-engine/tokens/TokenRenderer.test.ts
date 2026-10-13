import { describe, expect, it } from 'vitest'
import { Container } from 'pixi.js'
import type { PixelPoint } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import { TokenDragFrameQueue, TokenRenderer, type TokenRendererHandlers } from './TokenRenderer'

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

describe('TokenDragFrameQueue', () => {
  it('bündelt mehrere Pointer-Updates auf die letzte Position eines Frames', () => {
    const scheduled: FrameRequestCallback[] = []
    const processed: PixelPoint[] = []
    const queue = new TokenDragFrameQueue(
      (callback) => {
        scheduled.push(callback)
        return 7
      },
      () => undefined,
    )

    queue.schedule({ x: 10, y: 12 }, (point) => processed.push(point))
    queue.schedule({ x: 18, y: 24 }, (point) => processed.push(point))

    expect(processed).toEqual([])
    scheduled[0]?.(0)
    expect(processed).toEqual([{ x: 18, y: 24 }])
  })

  it('wendet beim Loslassen die finale Pointer-Position sofort an', () => {
    let cancelledHandle: number | null = null
    const processed: PixelPoint[] = []
    const queue = new TokenDragFrameQueue(
      () => 11,
      (handle) => {
        cancelledHandle = handle
      },
    )

    queue.schedule({ x: 10, y: 12 }, (point) => processed.push(point))
    queue.flush((point) => processed.push(point), { x: 22, y: 26 })

    expect(cancelledHandle).toBe(11)
    expect(processed).toEqual([{ x: 22, y: 26 }])
  })
})

describe('TokenRenderer', () => {
  it('behält Container bei Positions- und Auswahländerungen bei', () => {
    const renderer = new TokenRenderer()
    const layer = new Container()
    const selectionLayer = new Container()
    const camera = { x: 0, y: 0, zoom: 1 }
    const first = token('first', 2)

    renderer.render(
      layer,
      selectionLayer,
      [first],
      'first',
      48,
      camera,
      { x: 480, y: 480 },
      0,
      { visible: true, snap: true },
      handlers,
    )
    const container = layer.children[0]
    const marker = selectionLayer.children[0]

    renderer.render(
      layer,
      selectionLayer,
      [token('first', 4)],
      'first',
      48,
      camera,
      { x: 480, y: 480 },
      0,
      { visible: true, snap: true },
      handlers,
    )

    expect(layer.children[0]).toBe(container)
    expect(selectionLayer.children[0]).toBe(marker)
    expect(container?.position.x).not.toBe(0)
  })
})
