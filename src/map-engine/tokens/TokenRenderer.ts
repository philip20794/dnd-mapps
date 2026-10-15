import { Circle, Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import type { PlacedToken } from '@/types/tokens'
import type { GridPoint, PixelPoint } from '@/types/geometry'
import {
  gridToPixels,
  hexDistanceBetweenGridPoints,
  hexCorners,
  pixelsToGrid,
  screenToWorld,
  snapGridPoint,
} from '../grid/coordinates'
import type { CameraState, GridSettings, MapRotation } from '@/types/settings'

interface DragState {
  readonly tokenId: string
  readonly pointerOffset: GridPoint
  readonly startPosition: GridPoint
  lastValidPosition: GridPoint
  readonly pointerStart: PixelPoint
  moved: boolean
}

interface DragFeedback {
  readonly container: Container
  readonly path: Graphics
  readonly target: Graphics
  readonly ghost: Container
  readonly readout: Container
  readonly readoutBackground: Graphics
  readonly readoutText: Text
  renderedHexes: number
  renderedZoom: number
}

interface SelectionAnimation {
  readonly kind: 'select' | 'drop'
  elapsed: number
  readonly duration: number
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
  private readonly pendingPoints = new Map<
    number,
    { readonly point: PixelPoint; readonly process: (pointerId: number, point: PixelPoint) => void }
  >()
  private frame: number | null = null

  public constructor(
    private readonly requestFrame: RequestFrame = window.requestAnimationFrame.bind(window),
    private readonly cancelFrame: CancelFrame = window.cancelAnimationFrame.bind(window),
  ) {}

  public schedule(
    pointerId: number,
    point: PixelPoint,
    process: (pointerId: number, point: PixelPoint) => void,
  ): void {
    this.pendingPoints.set(pointerId, { point, process })
    if (this.frame !== null) return
    this.frame = this.requestFrame(() => {
      this.frame = null
      const pending = [...this.pendingPoints.entries()]
      this.pendingPoints.clear()
      for (const [pendingPointerId, entry] of pending) {
        entry.process(pendingPointerId, entry.point)
      }
    })
  }

  public flush(
    pointerId: number,
    process: (pointerId: number, point: PixelPoint) => void,
    finalPoint?: PixelPoint,
  ): void {
    const pending = this.pendingPoints.get(pointerId)
    this.pendingPoints.delete(pointerId)
    const point = finalPoint ?? pending?.point
    if (point) process(pointerId, point)
    if (this.frame !== null && this.pendingPoints.size === 0) {
      this.cancelFrame(this.frame)
      this.frame = null
    }
  }

  public cancel(pointerId?: number): void {
    if (pointerId === undefined) {
      this.pendingPoints.clear()
    } else {
      this.pendingPoints.delete(pointerId)
    }
    if (this.frame !== null && this.pendingPoints.size === 0) {
      this.cancelFrame(this.frame)
      this.frame = null
    }
  }
}

export interface TokenRendererHandlers {
  readonly onSelect: (tokenId: string | null) => void
  readonly onMoveEnd: (tokenId: string, position: GridPoint) => void
  readonly onLongPress: (tokenId: string, screenPoint: PixelPoint) => void
  readonly onRenameRequest?: (tokenId: string, screenPoint: PixelPoint) => void
  readonly constrainMove?: (tokenId: string, from: GridPoint, proposed: GridPoint) => GridPoint
}

export class TokenRenderer {
  private readonly tokenVisuals = new Map<string, TokenVisual>()
  private selectionMarker: Graphics | null = null
  private selectedTokenId: string | null = null
  private selectionMarkerSize: number | null = null
  private selectionMarkerDragging = false
  private selectionAnimation: SelectionAnimation | null = null
  private readonly dragging = new Map<number, DragState>()
  private readonly dragFeedback = new Map<number, DragFeedback>()
  private feedbackLayer: Container | null = null
  private camera: CameraState = { x: 0, y: 0, zoom: 1 }
  private mapPixelSize: PixelPoint = { x: 0, y: 0 }
  private mapRotation: MapRotation = 0
  private gridSize = 1
  private readonly longPressTimers = new Map<number, number>()

  public get isPointerActive(): boolean {
    return this.dragging.size > 0
  }

  public isPointerActiveFor(pointerId: number): boolean {
    return this.dragging.has(pointerId)
  }

  public update(deltaSeconds: number): void {
    const animation = this.selectionAnimation
    const marker = this.selectionMarker
    if (!animation || !marker) return

    animation.elapsed = Math.min(animation.duration, animation.elapsed + deltaSeconds)
    const progress = animation.elapsed / animation.duration
    const eased = 1 - Math.pow(1 - progress, 3)
    marker.alpha = animation.kind === 'select' ? 0.45 + eased * 0.55 : 1
    const startScale = animation.kind === 'select' ? 0.86 : 1.12
    const scale = startScale + (1 - startScale) * eased
    marker.scale.set(scale)
    if (progress >= 1) {
      marker.alpha = 1
      marker.scale.set(1)
      this.selectionAnimation = null
    }
  }

  public tokenIdAtScreenPoint(screenPoint: PixelPoint, gridSize: number): string | null {
    const world = screenToWorld(screenPoint, this.camera, this.mapRotation, this.mapPixelSize)
    const visuals = [...this.tokenVisuals.values()]
    for (let index = visuals.length - 1; index >= 0; index -= 1) {
      const visual = visuals[index]
      if (!visual) continue
      const radius = (visual.token.size * gridSize) / 2
      const hitRadius = radius + Math.max(4, gridSize * 0.08)
      if (
        Math.hypot(world.x - visual.container.position.x, world.y - visual.container.position.y) <=
        hitRadius
      ) {
        return visual.token.id
      }
    }
    return null
  }

  public cancelPointerInteraction(pointerId?: number): void {
    const pointerIds = pointerId === undefined ? [...this.dragging.keys()] : [pointerId]
    for (const activePointerId of pointerIds) {
      this.clearLongPressTimer(activePointerId)
      const drag = this.dragging.get(activePointerId)
      if (!drag) continue
      const visual = this.tokenVisuals.get(drag.tokenId)
      if (visual) {
        visual.container.cursor = 'grab'
        const position = gridToPixels(visual.token.position, this.gridSize)
        visual.container.position.set(position.x, position.y)
        this.positionSelectionMarkerForVisual(visual)
      }
      this.removeDragFeedback(activePointerId)
      this.dragging.delete(activePointerId)
      this.refreshSelectionMarkerAppearance(drag.tokenId, false)
    }
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
    this.gridSize = gridSize
    this.feedbackLayer = selectionLayer
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
      const pointerId = this.pointerIdForToken(tokenId)
      if (pointerId !== null) this.cancelPointerInteraction(pointerId)
      const visual = this.tokenVisuals.get(tokenId)
      if (!visual) continue
      visual.container.removeFromParent()
      visual.container.destroy({ children: true })
      this.tokenVisuals.delete(tokenId)
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
    for (const [pointerId, drag] of this.dragging) {
      if (drag.moved) this.updateDragFeedback(pointerId, drag)
    }
  }

  public dragToScreenPoint(
    pointerId: number,
    screenPoint: PixelPoint,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): boolean {
    const drag = this.dragging.get(pointerId)
    if (!drag) {
      return false
    }

    const visual = this.tokenVisuals.get(drag.tokenId)
    if (!visual) {
      return false
    }

    const movedDistance = Math.hypot(
      screenPoint.x - drag.pointerStart.x,
      screenPoint.y - drag.pointerStart.y,
    )
    if (!drag.moved && movedDistance < 7) {
      return true
    }
    this.clearLongPressTimer(pointerId)
    const dragStarted = !drag.moved

    const world = screenToWorld(screenPoint, this.camera, this.mapRotation, this.mapPixelSize)
    const gridPoint = pixelsToGrid(world, gridSize)
    const next = {
      x: gridPoint.x - drag.pointerOffset.x,
      y: gridPoint.y - drag.pointerOffset.y,
    }
    const accepted = handlers.constrainMove?.(drag.tokenId, drag.lastValidPosition, next) ?? next
    drag.lastValidPosition = accepted
    drag.moved = true
    const pixelPosition = gridToPixels(accepted, gridSize)
    visual.container.position.set(pixelPosition.x, pixelPosition.y)
    if (dragStarted) {
      this.createDragFeedback(pointerId, drag, visual.token)
      this.refreshSelectionMarkerAppearance(visual.token.id, true)
    }
    this.updateDragFeedback(pointerId, drag)
    if (this.selectedTokenId === visual.token.id && this.selectionMarker) {
      this.selectionMarker.position.set(pixelPosition.x, pixelPosition.y)
    }
    return true
  }

  public finishDrag(
    pointerId: number,
    grid: GridSettings,
    gridSize: number,
    handlers: TokenRendererHandlers,
  ): boolean {
    const drag = this.dragging.get(pointerId)
    if (!drag) {
      return false
    }

    this.clearLongPressTimer(pointerId)

    const visual = this.tokenVisuals.get(drag.tokenId)
    if (!visual) {
      this.removeDragFeedback(pointerId)
      this.dragging.delete(pointerId)
      return false
    }

    if (!drag.moved) {
      visual.container.cursor = 'grab'
      this.removeDragFeedback(pointerId)
      this.dragging.delete(pointerId)
      return false
    }

    visual.container.cursor = 'grab'
    const unsnapped = pixelsToGrid(
      { x: visual.container.position.x, y: visual.container.position.y },
      gridSize,
    )
    const snapped = snapGridPoint(unsnapped, grid.snap)
    const accepted =
      handlers.constrainMove?.(drag.tokenId, drag.lastValidPosition, snapped) ?? snapped
    const pixelPosition = gridToPixels(accepted, gridSize)
    visual.container.position.set(pixelPosition.x, pixelPosition.y)
    if (this.selectedTokenId === visual.token.id && this.selectionMarker) {
      this.selectionMarker.position.set(pixelPosition.x, pixelPosition.y)
    }
    this.removeDragFeedback(pointerId)
    this.dragging.delete(pointerId)
    this.refreshSelectionMarkerAppearance(drag.tokenId, false)
    this.startSelectionAnimation('drop')
    handlers.onMoveEnd(drag.tokenId, accepted)
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
      if (this.dragging.has(event.pointerId) || this.pointerIdForToken(token.id) !== null) return
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
      this.dragging.set(event.pointerId, {
        tokenId: token.id,
        pointerOffset: {
          x: gridPoint.x - currentToken.position.x,
          y: gridPoint.y - currentToken.position.y,
        },
        startPosition: { ...currentToken.position },
        lastValidPosition: currentToken.position,
        pointerStart: screenPoint,
        moved: false,
      })
      this.clearLongPressTimer(event.pointerId)
      const timer = window.setTimeout(() => {
        const drag = this.dragging.get(event.pointerId)
        if (!drag || drag.tokenId !== token.id || drag.moved) {
          return
        }
        const pixelPosition = gridToPixels(visual.token.position, gridSize)
        container.position.set(pixelPosition.x, pixelPosition.y)
        container.cursor = 'grab'
        this.removeDragFeedback(event.pointerId)
        this.dragging.delete(event.pointerId)
        this.refreshSelectionMarkerAppearance(token.id, false)
        this.longPressTimers.delete(event.pointerId)
        handlers.onLongPress(token.id, screenPoint)
      }, 520)
      this.longPressTimers.set(event.pointerId, timer)
    })
    container.on('pointertap', (event: FederatedPointerEvent) => {
      if (event.detail !== 2 || this.isPointerActiveFor(event.pointerId)) return
      event.stopPropagation()
      handlers.onRenameRequest?.(token.id, { x: event.global.x, y: event.global.y })
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
    const isDragging = this.pointerIdForToken(token.id) !== null
    if (
      !isDragging &&
      (visual.renderedPosition.x !== token.position.x ||
        visual.renderedPosition.y !== token.position.y)
    ) {
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

  private clearLongPressTimer(pointerId: number): void {
    const timer = this.longPressTimers.get(pointerId)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      this.longPressTimers.delete(pointerId)
    }
  }

  private pointerIdForToken(tokenId: string): number | null {
    for (const [pointerId, drag] of this.dragging) {
      if (drag.tokenId === tokenId) return pointerId
    }
    return null
  }

  private positionSelectionMarkerForVisual(visual: TokenVisual): void {
    if (this.selectedTokenId === visual.token.id && this.selectionMarker) {
      this.selectionMarker.position.set(visual.container.position.x, visual.container.position.y)
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
      this.selectionMarkerDragging = false
      this.selectionAnimation = null
      return
    }
    const markerWasCreated = this.selectedTokenId !== token.id || !this.selectionMarker
    const tokenIsDragging = this.isTokenBeingMoved(token.id)
    if (markerWasCreated) {
      this.selectionMarker?.removeFromParent()
      this.selectionMarker?.destroy()
      this.selectionMarker = this.createSelectionMarker(token, gridSize, tokenIsDragging)
      selectionLayer.addChild(this.selectionMarker)
      this.selectedTokenId = token.id
      this.selectionMarkerSize = token.size
      this.selectionMarkerDragging = tokenIsDragging
      this.startSelectionAnimation('select')
    } else if (
      this.selectionMarkerSize !== token.size ||
      this.selectionMarkerDragging !== tokenIsDragging
    ) {
      const marker = this.selectionMarker
      if (!marker) return
      this.drawSelectionMarker(marker, token, gridSize, tokenIsDragging)
      this.selectionMarkerSize = token.size
      this.selectionMarkerDragging = tokenIsDragging
    }
    const marker = this.selectionMarker
    if (!marker) return
    const visual = this.tokenVisuals.get(token.id)
    const position =
      visual && this.pointerIdForToken(token.id) !== null
        ? visual.container.position
        : gridToPixels(token.position, gridSize)
    marker.position.set(position.x, position.y)
  }

  private createSelectionMarker(token: PlacedToken, gridSize: number, dragging: boolean): Graphics {
    const marker = new Graphics()
    this.drawSelectionMarker(marker, token, gridSize, dragging)
    return marker
  }

  private drawSelectionMarker(
    marker: Graphics,
    token: PlacedToken,
    gridSize: number,
    dragging: boolean,
  ): void {
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
    marker.stroke({
      color: 0xf3d37a,
      width: Math.max(dragging ? 4 : 2, gridSize * (dragging ? 0.075 : 0.045)),
      alpha: dragging ? 0.98 : 0.76,
    })
  }

  private createDragFeedback(pointerId: number, drag: DragState, token: PlacedToken): void {
    if (this.dragFeedback.has(pointerId) || !this.feedbackLayer) return

    const container = new Container({ label: `token-drag-feedback-${pointerId}` })
    container.eventMode = 'none'
    const path = new Graphics()
    const target = new Graphics()
    const ghost = this.createGhostToken(token)
    const readout = new Container()
    const readoutBackground = new Graphics()
    const readoutText = new Text({
      text: '',
      style: {
        fill: 0xfff4c2,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
      },
    })
    readout.eventMode = 'none'
    readoutText.anchor.set(0.5)
    readout.addChild(readoutBackground, readoutText)
    container.addChild(path, target, ghost, readout)
    this.feedbackLayer.addChildAt(container, 0)
    this.dragFeedback.set(pointerId, {
      container,
      path,
      target,
      ghost,
      readout,
      readoutBackground,
      readoutText,
      renderedHexes: -1,
      renderedZoom: -1,
    })

    const start = gridToPixels(drag.startPosition, this.gridSize)
    ghost.position.set(start.x, start.y)
  }

  private createGhostToken(token: PlacedToken): Container {
    const ghost = new Container()
    const radius = (token.size * this.gridSize) / 2
    ghost.eventMode = 'none'
    ghost.alpha = 0.34
    ghost.pivot.set(radius, radius)
    ghost.rotation = (token.rotation * Math.PI) / 180

    const body = new Graphics()
    this.drawTokenBody(body, token, this.gridSize)
    const label = new Text({
      text: token.symbol,
      style: {
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(14, this.gridSize * 0.34),
        fontWeight: '800',
      },
    })
    label.anchor.set(0.5)
    label.position.set(radius, radius)
    label.eventMode = 'none'
    ghost.addChild(body, label)
    return ghost
  }

  private updateDragFeedback(pointerId: number, drag: DragState): void {
    const feedback = this.dragFeedback.get(pointerId)
    const visual = this.tokenVisuals.get(drag.tokenId)
    if (!feedback || !visual) return

    const start = gridToPixels(drag.startPosition, this.gridSize)
    const target = gridToPixels(drag.lastValidPosition, this.gridSize)
    const zoom = Math.max(0.01, this.camera.zoom)
    this.drawDashedPath(feedback.path, start, target, zoom)
    if (feedback.renderedZoom !== zoom) {
      this.drawTargetHighlight(feedback.target, visual.token, zoom)
      feedback.renderedZoom = zoom
    }
    feedback.target.position.set(target.x, target.y)

    const hexes = hexDistanceBetweenGridPoints(drag.startPosition, drag.lastValidPosition)
    if (feedback.renderedHexes !== hexes) {
      const readoutText = `${hexes * 5} ft · ${hexes} ${hexes === 1 ? 'Hexfeld' : 'Hexfelder'}`
      feedback.readoutText.text = readoutText
      const labelWidth = Math.max(92, readoutText.length * 7.8 + 16)
      const labelHeight = 28
      feedback.readoutBackground
        .clear()
        .roundRect(-labelWidth / 2, -labelHeight / 2, labelWidth, labelHeight, 7)
        .fill({ color: 0x17120a, alpha: 0.86 })
        .stroke({ color: 0xf3d37a, alpha: 0.55, width: 1 })
      feedback.renderedHexes = hexes
    }

    const deltaX = target.x - start.x
    const deltaY = target.y - start.y
    const length = Math.hypot(deltaX, deltaY)
    const normalX = length > 0 ? -deltaY / length : 0
    const normalY = length > 0 ? deltaX / length : -1
    feedback.readout.position.set(
      (start.x + target.x) / 2 + (normalX * 18) / zoom,
      (start.y + target.y) / 2 + (normalY * 18) / zoom,
    )
    feedback.readout.scale.set(1 / zoom)
    feedback.readout.rotation = (-this.mapRotation * Math.PI) / 180
  }

  private drawDashedPath(
    path: Graphics,
    start: PixelPoint,
    target: PixelPoint,
    zoom: number,
  ): void {
    path.clear()
    const deltaX = target.x - start.x
    const deltaY = target.y - start.y
    const length = Math.hypot(deltaX, deltaY)
    if (length <= 0) return

    const dashLength = 9 / zoom
    const gapLength = 6 / zoom
    for (let offset = 0; offset < length; offset += dashLength + gapLength) {
      const dashStart = offset / length
      const dashEnd = Math.min(length, offset + dashLength) / length
      path
        .moveTo(start.x + deltaX * dashStart, start.y + deltaY * dashStart)
        .lineTo(start.x + deltaX * dashEnd, start.y + deltaY * dashEnd)
    }
    path.stroke({ color: 0xf3d37a, alpha: 0.74, width: 2 / zoom })
  }

  private drawTargetHighlight(target: Graphics, token: PlacedToken, zoom: number): void {
    target.clear()
    const corners = hexCorners({ x: 0, y: 0 }).map((corner) => ({
      x: corner.x * this.gridSize * token.size,
      y: corner.y * this.gridSize * token.size,
    }))
    const first = corners[0]
    if (!first) return
    target.moveTo(first.x, first.y)
    for (const corner of corners.slice(1)) target.lineTo(corner.x, corner.y)
    target.lineTo(first.x, first.y)
    target
      .fill({ color: 0xf3d37a, alpha: 0.1 })
      .stroke({ color: 0xf3d37a, alpha: 0.78, width: 2 / zoom })
  }

  private removeDragFeedback(pointerId: number): void {
    const feedback = this.dragFeedback.get(pointerId)
    if (!feedback) return
    feedback.container.removeFromParent()
    feedback.container.destroy({ children: true })
    this.dragFeedback.delete(pointerId)
  }

  private isTokenBeingMoved(tokenId: string): boolean {
    for (const drag of this.dragging.values()) {
      if (drag.tokenId === tokenId && drag.moved) return true
    }
    return false
  }

  private refreshSelectionMarkerAppearance(tokenId: string, dragging: boolean): void {
    if (this.selectedTokenId !== tokenId || !this.selectionMarker) return
    const token = this.tokenVisuals.get(tokenId)?.token
    if (!token) return
    this.drawSelectionMarker(this.selectionMarker, token, this.gridSize, dragging)
    this.selectionMarkerDragging = dragging
  }

  private startSelectionAnimation(kind: SelectionAnimation['kind']): void {
    if (!this.selectionMarker) return
    this.selectionAnimation = { kind, elapsed: 0, duration: kind === 'select' ? 0.16 : 0.14 }
    this.selectionMarker.alpha = kind === 'select' ? 0.45 : 1
    this.selectionMarker.scale.set(kind === 'select' ? 0.86 : 1.12)
  }
}
