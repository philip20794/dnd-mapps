import { Circle, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import type { PlacedToken } from '@/types/tokens'
import type { GridPoint, PixelPoint } from '@/types/geometry'
import {
  gridToPixels,
  hexCorners,
  pixelsToGrid,
  screenToWorld,
  snapGridPoint,
} from '../grid/coordinates'
import type { CameraState, GridSettings, MapRotation } from '@/types/settings'

interface DragState {
  readonly tokenId: string
  readonly pointerOffset: GridPoint
  lastValidPosition: GridPoint
  readonly pointerStart: PixelPoint
  moved: boolean
}

interface TokenVisual {
  readonly container: Container
  readonly body: Graphics
  readonly label: Text
  token: PlacedToken
  renderedPosition: GridPoint
  renderedSize: number
  renderedRotation: number
  renderedColor: string
  renderedSymbol: string
}

type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void

export class TokenDragFrameQueue {
  private pendingPoint: PixelPoint | null = null
  private frame: number | null = null

  public constructor(
    private readonly requestFrame: RequestFrame = window.requestAnimationFrame.bind(window),
    private readonly cancelFrame: CancelFrame = window.cancelAnimationFrame.bind(window),
  ) {}

  public schedule(point: PixelPoint, process: (point: PixelPoint) => void): void {
    this.pendingPoint = point
    if (this.frame !== null) return
    this.frame = this.requestFrame(() => {
      this.frame = null
      this.flush(process)
    })
  }

  public flush(process: (point: PixelPoint) => void, finalPoint?: PixelPoint): void {
    if (finalPoint) this.pendingPoint = finalPoint
    if (this.frame !== null) {
      this.cancelFrame(this.frame)
      this.frame = null
    }
    const point = this.pendingPoint
    this.pendingPoint = null
    if (point) process(point)
  }

  public cancel(): void {
    if (this.frame !== null) this.cancelFrame(this.frame)
    this.frame = null
    this.pendingPoint = null
  }
}

export interface TokenRendererHandlers {
  readonly onSelect: (tokenId: string | null) => void
  readonly onMoveEnd: (tokenId: string, position: GridPoint) => void
  readonly onLongPress: (tokenId: string, screenPoint: PixelPoint) => void
  readonly constrainMove?: (tokenId: string, from: GridPoint, proposed: GridPoint) => GridPoint
}

export class TokenRenderer {
  private readonly tokenVisuals = new Map<string, TokenVisual>()
  private selectionMarker: Graphics | null = null
  private selectedTokenId: string | null = null
  private selectionMarkerSize: number | null = null
  private dragging: DragState | null = null
  private camera: CameraState = { x: 0, y: 0, zoom: 1 }
  private mapPixelSize: PixelPoint = { x: 0, y: 0 }
  private mapRotation: MapRotation = 0
  private longPressTimer: number | null = null

  public get isPointerActive(): boolean {
    return this.dragging !== null
  }

  public cancelPointerInteraction(): void {
    this.clearLongPressTimer()
    if (this.dragging) {
      const visual = this.tokenVisuals.get(this.dragging.tokenId)
      if (visual) {
        visual.container.cursor = 'grab'
      }
    }
    this.dragging = null
  }

  public render(
    layer: Container,
    selectionLayer: Container,
    tokens: readonly PlacedToken[],
    selectedTokenId: string | null,
    gridSize: number,
    camera: CameraState,
    mapPixelSize: PixelPoint,
    mapRotation: MapRotation,
    _grid: GridSettings,
    handlers: TokenRendererHandlers,
  ): void {
    this.setCamera(camera, mapPixelSize, mapRotation)
    const remainingIds = new Set(this.tokenVisuals.keys())
    for (const token of tokens) {
      remainingIds.delete(token.id)
      const visual = this.tokenVisuals.get(token.id)
      if (visual) {
        this.updateTokenVisual(visual, token, gridSize)
      } else {
        const created = this.createTokenVisual(token, gridSize, handlers)
        layer.addChild(created.container)
        this.tokenVisuals.set(token.id, created)
      }
    }
    for (const tokenId of remainingIds) {
      const visual = this.tokenVisuals.get(tokenId)
      if (!visual) continue
      visual.container.removeFromParent()
      visual.container.destroy({ children: true })
      this.tokenVisuals.delete(tokenId)
      if (this.dragging?.tokenId === tokenId) this.cancelPointerInteraction()
    }
    this.updateSelectionMarker(selectionLayer, selectedTokenId, gridSize)
  }

  public setCamera(
    camera: CameraState,
    mapPixelSize: PixelPoint = this.mapPixelSize,
    mapRotation: MapRotation = this.mapRotation,
  ): void {
    this.camera = camera
    this.mapPixelSize = mapPixelSize
    this.mapRotation = mapRotation
  }

  public dragToScreenPoint(
    screenPoint: PixelPoint,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): boolean {
    if (!this.dragging) {
      return false
    }

    const visual = this.tokenVisuals.get(this.dragging.tokenId)
    if (!visual) {
      return false
    }

    const movedDistance = Math.hypot(
      screenPoint.x - this.dragging.pointerStart.x,
      screenPoint.y - this.dragging.pointerStart.y,
    )
    if (!this.dragging.moved && movedDistance < 7) {
      return true
    }
    this.clearLongPressTimer()

    const world = screenToWorld(screenPoint, this.camera, this.mapRotation, this.mapPixelSize)
    const gridPoint = pixelsToGrid(world, gridSize)
    const next = {
      x: gridPoint.x - this.dragging.pointerOffset.x,
      y: gridPoint.y - this.dragging.pointerOffset.y,
    }
    const accepted =
      handlers.constrainMove?.(this.dragging.tokenId, this.dragging.lastValidPosition, next) ?? next
    this.dragging.lastValidPosition = accepted
    this.dragging.moved = true
    const pixelPosition = gridToPixels(accepted, gridSize)
    visual.container.position.set(pixelPosition.x, pixelPosition.y)
    if (this.selectedTokenId === visual.token.id && this.selectionMarker) {
      this.selectionMarker.position.set(pixelPosition.x, pixelPosition.y)
    }
    return true
  }

  public finishDrag(
    grid: GridSettings,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): boolean {
    if (!this.dragging) {
      return false
    }

    this.clearLongPressTimer()

    const visual = this.tokenVisuals.get(this.dragging.tokenId)
    if (!visual) {
      this.dragging = null
      return false
    }

    if (!this.dragging.moved) {
      visual.container.cursor = 'grab'
      this.dragging = null
      return false
    }

    visual.container.cursor = 'grab'
    const unsnapped = pixelsToGrid(
      { x: visual.container.position.x, y: visual.container.position.y },
      gridSize,
    )
    const snapped = snapGridPoint(unsnapped, grid.snap)
    const accepted =
      handlers.constrainMove?.(this.dragging.tokenId, this.dragging.lastValidPosition, snapped) ??
      snapped
    const pixelPosition = gridToPixels(accepted, gridSize)
    visual.container.position.set(pixelPosition.x, pixelPosition.y)
    if (this.selectedTokenId === visual.token.id && this.selectionMarker) {
      this.selectionMarker.position.set(pixelPosition.x, pixelPosition.y)
    }
    handlers.onMoveEnd(this.dragging.tokenId, accepted)
    this.dragging = null
    return true
  }

  private createTokenVisual(
    token: PlacedToken,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): TokenVisual {
    const container = new Container()
    const radius = (token.size * gridSize) / 2
    container.eventMode = 'static'
    container.cursor = 'grab'
    container.pivot.set(radius, radius)
    container.hitArea = new Circle(radius, radius, radius + Math.max(4, gridSize * 0.08))

    const body = new Graphics()
    this.drawTokenBody(body, token, gridSize)

    const label = new Text({
      text: token.symbol,
      style: {
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(14, gridSize * 0.34),
        fontWeight: '800',
      },
    })
    label.anchor.set(0.5)
    label.position.set(radius, radius)
    label.eventMode = 'none'

    container.addChild(body, label)
    container.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation()
      const visual = this.tokenVisuals.get(token.id)
      if (!visual) return
      const currentToken = visual.token
      handlers.onSelect(currentToken.id)
      container.cursor = 'grabbing'
      const world = screenToWorld(
        { x: event.global.x, y: event.global.y },
        this.camera,
        this.mapRotation,
        this.mapPixelSize,
      )
      const gridPoint = pixelsToGrid(world, gridSize)
      const screenPoint = { x: event.global.x, y: event.global.y }
      this.dragging = {
        tokenId: token.id,
        pointerOffset: {
          x: gridPoint.x - currentToken.position.x,
          y: gridPoint.y - currentToken.position.y,
        },
        lastValidPosition: currentToken.position,
        pointerStart: screenPoint,
        moved: false,
      }
      this.clearLongPressTimer()
      this.longPressTimer = window.setTimeout(() => {
        if (!this.dragging || this.dragging.tokenId !== token.id || this.dragging.moved) {
          return
        }
        const pixelPosition = gridToPixels(currentToken.position, gridSize)
        container.position.set(pixelPosition.x, pixelPosition.y)
        container.cursor = 'grab'
        this.dragging = null
        this.longPressTimer = null
        handlers.onLongPress(token.id, screenPoint)
      }, 520)
    })

    const position = gridToPixels(token.position, gridSize)
    container.position.set(position.x, position.y)
    container.rotation = (token.rotation * Math.PI) / 180
    return {
      container,
      body,
      label,
      token,
      renderedPosition: token.position,
      renderedSize: token.size,
      renderedRotation: token.rotation,
      renderedColor: token.color,
      renderedSymbol: token.symbol,
    }
  }

  private updateTokenVisual(visual: TokenVisual, token: PlacedToken, gridSize: number): void {
    const isDragging = this.dragging?.tokenId === token.id
    if (!isDragging &&
      (visual.renderedPosition.x !== token.position.x || visual.renderedPosition.y !== token.position.y)) {
      const position = gridToPixels(token.position, gridSize)
      visual.container.position.set(position.x, position.y)
    }
    if (visual.renderedRotation !== token.rotation) {
      visual.container.rotation = (token.rotation * Math.PI) / 180
    }
    if (visual.renderedSize !== token.size || visual.renderedColor !== token.color) {
      const radius = (token.size * gridSize) / 2
      visual.container.pivot.set(radius, radius)
      visual.container.hitArea = new Circle(radius, radius, radius + Math.max(4, gridSize * 0.08))
      this.drawTokenBody(visual.body, token, gridSize)
      visual.label.style.fontSize = Math.max(14, gridSize * 0.34)
      visual.label.position.set(radius, radius)
    }
    if (visual.renderedSymbol !== token.symbol) {
      visual.label.text = token.symbol
    }
    visual.token = token
    visual.renderedPosition = token.position
    visual.renderedSize = token.size
    visual.renderedRotation = token.rotation
    visual.renderedColor = token.color
    visual.renderedSymbol = token.symbol
  }

  private drawTokenBody(body: Graphics, token: PlacedToken, gridSize: number): void {
    const radius = (token.size * gridSize) / 2
    const color = Number.parseInt(token.color.slice(1), 16)
    body.clear()
    body
      .circle(radius, radius, radius)
      .fill({ color, alpha: 1 })
      .stroke({ color: 0x120e0a, alpha: 0.96, width: Math.max(2, gridSize * 0.06) })
      .circle(radius * 0.82, radius * 0.76, radius * 0.24)
      .fill({ color: 0xffffff, alpha: 0.12 })
      .circle(radius, radius, radius * 0.72)
      .stroke({ color: 0x120e0a, alpha: 0.18, width: Math.max(1, gridSize * 0.025) })
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  private updateSelectionMarker(
    selectionLayer: Container,
    selectedTokenId: string | null,
    gridSize: number,
  ): void {
    const token = selectedTokenId ? this.tokenVisuals.get(selectedTokenId)?.token : undefined
    if (!token) {
      this.selectionMarker?.removeFromParent()
      this.selectionMarker?.destroy()
      this.selectionMarker = null
      this.selectedTokenId = null
      this.selectionMarkerSize = null
      return
    }
    const markerWasCreated = this.selectedTokenId !== token.id || !this.selectionMarker
    if (markerWasCreated) {
      this.selectionMarker?.removeFromParent()
      this.selectionMarker?.destroy()
      this.selectionMarker = this.createSelectionMarker(token, gridSize)
      selectionLayer.addChild(this.selectionMarker)
      this.selectedTokenId = token.id
      this.selectionMarkerSize = token.size
    } else if (this.selectionMarkerSize !== token.size) {
      const marker = this.selectionMarker
      if (!marker) return
      this.drawSelectionMarker(marker, token, gridSize)
      this.selectionMarkerSize = token.size
    }
    const marker = this.selectionMarker
    if (!marker) return
    const position = gridToPixels(token.position, gridSize)
    if (markerWasCreated || this.dragging?.tokenId !== token.id) {
      marker.position.set(position.x, position.y)
    }
  }

  private createSelectionMarker(token: PlacedToken, gridSize: number): Graphics {
    const marker = new Graphics()
    this.drawSelectionMarker(marker, token, gridSize)
    return marker
  }

  private drawSelectionMarker(marker: Graphics, token: PlacedToken, gridSize: number): void {
    marker.clear()
    const corners = hexCorners({ x: 0, y: 0 }).map((corner) => ({
      x: corner.x * gridSize * token.size,
      y: corner.y * gridSize * token.size,
    }))
    const first = corners[0]
    if (!first) {
      return
    }
    marker.moveTo(first.x, first.y)
    for (const corner of corners.slice(1)) {
      marker.lineTo(corner.x, corner.y)
    }
    marker.lineTo(first.x, first.y)
    marker.stroke({ color: 0xf3d37a, width: Math.max(3, gridSize * 0.06), alpha: 0.96 })
  }
}
