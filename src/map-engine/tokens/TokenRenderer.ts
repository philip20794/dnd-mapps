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
  readonly lastValidPosition: GridPoint
  readonly pointerStart: PixelPoint
  readonly moved: boolean
}

export interface TokenRendererHandlers {
  readonly onSelect: (tokenId: string | null) => void
  readonly onMoveEnd: (tokenId: string, position: GridPoint) => void
  readonly onLongPress: (tokenId: string, screenPoint: PixelPoint) => void
  readonly constrainMove?: (tokenId: string, from: GridPoint, proposed: GridPoint) => GridPoint
}

export class TokenRenderer {
  private readonly tokenContainers = new Map<string, Container>()
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
      const container = this.tokenContainers.get(this.dragging.tokenId)
      if (container) {
        container.cursor = 'grab'
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
    this.clearLongPressTimer()
    this.dragging = null
    this.setCamera(camera, mapPixelSize, mapRotation)
    layer.removeAllListeners()
    layer.removeChildren().forEach((child) => child.destroy({ children: true }))
    selectionLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
    this.tokenContainers.clear()

    for (const token of tokens) {
      const container = this.createTokenContainer(token, gridSize, handlers)
      const position = gridToPixels(token.position, gridSize)
      container.position.set(position.x, position.y)
      container.rotation = (token.rotation * Math.PI) / 180
      layer.addChild(container)
      this.tokenContainers.set(token.id, container)

      if (token.id === selectedTokenId) {
        const marker = this.createSelectionMarker(token, gridSize)
        marker.position.set(position.x, position.y)
        selectionLayer.addChild(marker)
      }
    }
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

    const container = this.tokenContainers.get(this.dragging.tokenId)
    if (!container) {
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
    this.dragging = {
      ...this.dragging,
      lastValidPosition: accepted,
      moved: true,
    }
    const pixelPosition = gridToPixels(accepted, gridSize)
    container.position.set(pixelPosition.x, pixelPosition.y)
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

    const container = this.tokenContainers.get(this.dragging.tokenId)
    if (!container) {
      this.dragging = null
      return false
    }

    if (!this.dragging.moved) {
      container.cursor = 'grab'
      this.dragging = null
      return false
    }

    container.cursor = 'grab'
    const unsnapped = pixelsToGrid({ x: container.position.x, y: container.position.y }, gridSize)
    const snapped = snapGridPoint(unsnapped, grid.snap)
    const accepted =
      handlers.constrainMove?.(this.dragging.tokenId, this.dragging.lastValidPosition, snapped) ??
      snapped
    const pixelPosition = gridToPixels(accepted, gridSize)
    container.position.set(pixelPosition.x, pixelPosition.y)
    handlers.onMoveEnd(this.dragging.tokenId, accepted)
    this.dragging = null
    return true
  }

  private createTokenContainer(
    token: PlacedToken,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): Container {
    const container = new Container()
    const radius = (token.size * gridSize) / 2
    container.eventMode = 'static'
    container.cursor = 'grab'
    container.pivot.set(radius, radius)
    container.hitArea = new Circle(radius, radius, radius + Math.max(4, gridSize * 0.08))

    const body = new Graphics()
    const color = Number.parseInt(token.color.slice(1), 16)
    body
      .circle(radius, radius, radius)
      .fill({ color, alpha: 1 })
      .stroke({ color: 0x120e0a, alpha: 0.96, width: Math.max(2, gridSize * 0.06) })
      .circle(radius * 0.82, radius * 0.76, radius * 0.24)
      .fill({ color: 0xffffff, alpha: 0.12 })
      .circle(radius, radius, radius * 0.72)
      .stroke({ color: 0x120e0a, alpha: 0.18, width: Math.max(1, gridSize * 0.025) })

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
      handlers.onSelect(token.id)
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
          x: gridPoint.x - token.position.x,
          y: gridPoint.y - token.position.y,
        },
        lastValidPosition: token.position,
        pointerStart: screenPoint,
        moved: false,
      }
      this.clearLongPressTimer()
      this.longPressTimer = window.setTimeout(() => {
        if (!this.dragging || this.dragging.tokenId !== token.id || this.dragging.moved) {
          return
        }
        const pixelPosition = gridToPixels(token.position, gridSize)
        container.position.set(pixelPosition.x, pixelPosition.y)
        container.cursor = 'grab'
        this.dragging = null
        this.longPressTimer = null
        handlers.onLongPress(token.id, screenPoint)
      }, 520)
    })

    return container
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  private createSelectionMarker(token: PlacedToken, gridSize: number): Graphics {
    const marker = new Graphics()
    const corners = hexCorners({ x: 0, y: 0 }).map((corner) => ({
      x: corner.x * gridSize * token.size,
      y: corner.y * gridSize * token.size,
    }))
    const first = corners[0]
    if (!first) {
      return marker
    }
    marker.moveTo(first.x, first.y)
    for (const corner of corners.slice(1)) {
      marker.lineTo(corner.x, corner.y)
    }
    marker.lineTo(first.x, first.y)
    marker.stroke({ color: 0xf3d37a, width: Math.max(3, gridSize * 0.06), alpha: 0.96 })
    return marker
  }
}
