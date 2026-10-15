import { Graphics } from 'pixi.js'
import type { Container } from 'pixi.js'
import { createDefaultObjectRegistry, resolveMapObject } from '@/map-objects'
import type { MapObjectDefinition, ResolvedMapObject } from '@/map-objects'
import {
  addObject,
  addWall,
  findEditorHits,
  moveDoor,
  nearestWall,
  placeDoorOnWall,
  resizeDoor,
  updateObject,
  updateWall,
} from '@/map-editor/operations'
import type { MapEditorSelection, MapEditorState } from '@/map-editor/types'
import { entryLevelId } from '@/maps/api'
import type { DoorDefinition, MapDefinition, WallDefinition } from '@/maps/api'
import { snapGridPoint } from '@/map-engine/grid/coordinates'
import type { GridPoint, Segment } from '@/types/geometry'
import { materialCatalog } from '@/map-materials'
import {
  eraseMaterialStroke,
  findMaterialSelection,
  paintMaterialStroke,
  placeMaterialDecal,
  sampleBrushCells,
} from '@/map-editor/materialOperations'

interface EditorInteraction {
  readonly pointerId: number
  readonly pointerType: string
  readonly selection: MapEditorSelection
  readonly mode: 'move' | 'endpoint-a' | 'endpoint-b' | 'rotate' | 'scale'
  readonly startPoint: GridPoint
  readonly startScreen: { readonly x: number; readonly y: number }
  readonly originalMap: MapDefinition
  readonly originalObject?: MapObjectDefinition
  readonly originalWall?: WallDefinition
  readonly originalDoor?: DoorDefinition
  readonly pointerOffset?: GridPoint
  readonly objectCenter?: GridPoint
  readonly startDistance?: number
  readonly cycleOnTap: boolean
  moved: boolean
}

export interface MapEditorControllerHandlers {
  readonly onSelect: (selection: MapEditorSelection | null) => void
  readonly onCommit: (
    map: MapDefinition,
    selection: MapEditorSelection | null,
    dirtyMaterialChunks?: ReadonlySet<string>,
  ) => void
}

const registry = createDefaultObjectRegistry()
const sameSelection = (a: MapEditorSelection | null, b: MapEditorSelection | null): boolean =>
  a?.kind === b?.kind && a?.id === b?.id

const distance = (a: GridPoint, b: GridPoint): number => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (segment: Segment): GridPoint => ({
  x: (segment.a.x + segment.b.x) / 2,
  y: (segment.a.y + segment.b.y) / 2,
})

export class MapEditorController {
  private readonly graphics = new Graphics({ label: 'map-editor-overlay' })
  private map: MapDefinition | null = null
  private levelId = 'ground'
  private state: MapEditorState = {
    tool: 'select',
    selection: null,
    snap: true,
    objectTemplate: null,
    material: 'stone',
    brushSize: 'medium',
    materialRotation: 0,
    materialScale: 1,
    materialAlpha: 1,
    decalKind: 'crack',
  }
  private zoom = 1
  private interaction: EditorInteraction | null = null
  private previewMap: MapDefinition | null = null
  private wallStart: GridPoint | null = null
  private hoverPoint: GridPoint | null = null
  private lastHitPoint: GridPoint | null = null
  private hitCycleIndex = 0
  private materialStroke: { pointerId: number; points: GridPoint[] } | null = null

  public constructor(
    selectionLayer: Container,
    private readonly handlers: MapEditorControllerHandlers,
  ) {
    this.graphics.eventMode = 'none'
    selectionLayer.addChild(this.graphics)
  }

  public setMap(map: MapDefinition | null, levelId: string): void {
    this.map = map
    this.levelId = levelId
    this.previewMap = null
    this.draw()
  }

  public setState(state: MapEditorState): void {
    const toolChanged = this.state.tool !== state.tool
    this.state = state
    if (toolChanged) this.wallStart = null
    this.draw()
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.01, zoom)
    this.draw()
  }

  public get activePointerId(): number | null {
    return this.interaction?.pointerId ?? this.materialStroke?.pointerId ?? null
  }

  public get activePointerStart(): GridPoint | null {
    return this.interaction?.startPoint ?? this.materialStroke?.points[0] ?? null
  }

  public get activePointerScreen(): { readonly x: number; readonly y: number } | null {
    return this.interaction?.startScreen ?? null
  }

  public pointerDown(event: PointerEvent, point: GridPoint): boolean {
    if (!this.map || event.button !== 0) return false
    const accepted = this.snap(point)
    if (this.state.tool === 'material-brush' || this.state.tool === 'material-eraser') {
      this.materialStroke = { pointerId: event.pointerId, points: [point] }
      this.hoverPoint = point
      this.draw()
      return true
    }
    if (this.state.tool === 'material-decal') {
      const result = placeMaterialDecal(this.map, this.levelId, point, this.state)
      this.handlers.onSelect(result.selection ?? null)
      this.handlers.onCommit(result.map, result.selection ?? null, result.dirtyChunks)
      return true
    }
    if (this.state.tool === 'material-select') {
      const selection = findMaterialSelection(this.map, this.levelId, point)
      this.handlers.onSelect(selection)
      return true
    }
    if (this.state.tool === 'object') {
      if (!this.state.objectTemplate) return true
      const result = addObject(this.map, this.state.objectTemplate, accepted, this.levelId)
      this.handlers.onSelect(result.selection)
      this.handlers.onCommit(result.map, result.selection)
      return true
    }
    if (this.state.tool === 'wall') {
      if (!this.wallStart) {
        this.wallStart = accepted
        this.hoverPoint = accepted
        this.draw()
        return true
      }
      const result = addWall(this.map, this.wallStart, accepted, this.levelId)
      if (result) {
        this.handlers.onSelect(result.selection)
        this.handlers.onCommit(result.map, result.selection)
        this.wallStart = accepted
      }
      this.draw()
      return true
    }
    if (this.state.tool === 'door') {
      const wall = nearestWall(
        this.map,
        point,
        this.levelId,
        Math.max(0.75, this.hitTolerance(event.pointerType)),
      )
      if (wall?.id) {
        const result = placeDoorOnWall(this.map, wall.id, accepted)
        if (result) {
          this.handlers.onSelect(result.selection)
          this.handlers.onCommit(result.map, result.selection)
        }
      }
      return true
    }

    const selected = this.state.selection
    const handle = selected ? this.handleAt(selected, point, event.pointerType) : null
    if (selected && handle) {
      this.beginInteraction(event, point, selected, handle, false)
      return true
    }
    if (
      selected &&
      findEditorHits(this.map, this.levelId, point, this.hitTolerance(event.pointerType)).some(
        (hit) => sameSelection(hit.selection, selected),
      )
    ) {
      this.beginInteraction(event, point, selected, 'move', true)
      return true
    }
    let selection = selected
    selection = this.cycleHit(point, event.pointerType)
    if (!sameSelection(selection, selected)) this.handlers.onSelect(selection)
    if (!selection) {
      this.interaction = null
      this.draw()
      return true
    }
    this.beginInteraction(event, point, selection, 'move', false)
    return true
  }

  public pointerMove(event: PointerEvent, point: GridPoint): boolean {
    this.hoverPoint = this.snap(point)
    if (this.materialStroke?.pointerId === event.pointerId) {
      this.materialStroke.points.push(point)
      this.draw()
      return true
    }
    const interaction = this.interaction
    if (!interaction || interaction.pointerId !== event.pointerId) {
      if (this.state.tool === 'wall') this.draw()
      return this.state.tool !== 'select'
    }
    if (distance(interaction.startPoint, point) > 5 / (48 * this.zoom)) interaction.moved = true
    this.previewMap = this.mapForInteraction(interaction, this.snap(point))
    this.draw()
    return true
  }

  public pointerUp(event: PointerEvent, point: GridPoint): boolean {
    if (this.materialStroke?.pointerId === event.pointerId && this.map) {
      this.materialStroke.points.push(point)
      const result =
        this.state.tool === 'material-eraser'
          ? eraseMaterialStroke(
              this.map,
              this.levelId,
              this.materialStroke.points,
              this.state.brushSize ?? 'medium',
            )
          : paintMaterialStroke(this.map, this.levelId, this.materialStroke.points, this.state)
      this.materialStroke = null
      this.handlers.onSelect(null)
      this.handlers.onCommit(result.map, null, result.dirtyChunks)
      this.draw()
      return true
    }
    const interaction = this.interaction
    if (!interaction || interaction.pointerId !== event.pointerId) return false
    this.previewMap = this.mapForInteraction(interaction, this.snap(point))
    this.interaction = null
    if (!interaction.moved && interaction.cycleOnTap) {
      this.previewMap = null
      this.handlers.onSelect(this.cycleHit(point, event.pointerType))
      this.draw()
    } else if (interaction.moved && this.previewMap && this.map && this.previewMap !== this.map) {
      const committed = this.previewMap
      this.previewMap = null
      this.handlers.onCommit(committed, interaction.selection)
    } else {
      this.previewMap = null
      this.draw()
    }
    return true
  }

  public cancelPointer(pointerId?: number): boolean {
    if (
      this.materialStroke &&
      (pointerId === undefined || this.materialStroke.pointerId === pointerId)
    ) {
      this.materialStroke = null
      this.draw()
      return true
    }
    if (
      !this.interaction ||
      (pointerId !== undefined && this.interaction.pointerId !== pointerId)
    ) {
      return false
    }
    this.interaction = null
    this.previewMap = null
    this.draw()
    return true
  }

  public cancelPendingTool(): boolean {
    if (this.materialStroke) {
      this.materialStroke = null
      this.draw()
      return true
    }
    if (!this.wallStart) return false
    this.wallStart = null
    this.hoverPoint = null
    this.draw()
    return true
  }

  public destroy(): void {
    this.graphics.removeFromParent()
    this.graphics.destroy()
  }

  private beginInteraction(
    event: PointerEvent,
    point: GridPoint,
    selection: MapEditorSelection,
    mode: EditorInteraction['mode'],
    cycleOnTap: boolean,
  ): void {
    if (!this.map) return
    const object =
      selection.kind === 'object'
        ? this.map.objects.find((entry) => entry.id === selection.id)
        : undefined
    const wall =
      selection.kind === 'wall'
        ? this.map.walls.find((entry) => entry.id === selection.id)
        : undefined
    const door =
      selection.kind === 'door'
        ? this.map.doors.find((entry) => entry.id === selection.id)
        : undefined
    const resolved = object
      ? resolveMapObject(object, registry, this.map.objects.indexOf(object))
      : null
    const center = resolved ? this.objectCenter(resolved) : undefined
    this.interaction = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      selection,
      mode,
      startPoint: point,
      startScreen: { x: event.clientX, y: event.clientY },
      originalMap: this.map,
      originalObject: object,
      originalWall: wall,
      originalDoor: door,
      pointerOffset:
        mode === 'move' && object
          ? { x: point.x - object.position.x, y: point.y - object.position.y }
          : undefined,
      objectCenter: center,
      startDistance: center ? Math.max(0.01, distance(center, point)) : undefined,
      cycleOnTap,
      moved: false,
    }
  }

  private mapForInteraction(interaction: EditorInteraction, point: GridPoint): MapDefinition {
    if (interaction.selection.kind === 'object' && interaction.originalObject) {
      const object = interaction.originalObject
      if (interaction.mode === 'rotate' && interaction.objectCenter) {
        const angle = Math.atan2(
          point.y - interaction.objectCenter.y,
          point.x - interaction.objectCenter.x,
        )
        return updateObject(interaction.originalMap, interaction.selection.id, { rotation: angle })
      }
      if (interaction.mode === 'scale' && interaction.objectCenter && interaction.startDistance) {
        const original = resolveMapObject(
          object,
          registry,
          interaction.originalMap.objects.indexOf(object),
        )
        const scale = Math.max(
          0.1,
          Math.min(
            10,
            (original.scale * distance(interaction.objectCenter, point)) /
              interaction.startDistance,
          ),
        )
        return updateObject(interaction.originalMap, interaction.selection.id, { scale })
      }
      const offset = interaction.pointerOffset ?? { x: 0, y: 0 }
      return updateObject(interaction.originalMap, interaction.selection.id, {
        position: { x: point.x - offset.x, y: point.y - offset.y },
      })
    }
    if (interaction.selection.kind === 'wall' && interaction.originalWall) {
      const wall = interaction.originalWall
      if (interaction.mode === 'endpoint-a')
        return updateWall(interaction.originalMap, interaction.selection.id, { a: point })
      if (interaction.mode === 'endpoint-b')
        return updateWall(interaction.originalMap, interaction.selection.id, { b: point })
      const delta = { x: point.x - interaction.startPoint.x, y: point.y - interaction.startPoint.y }
      return updateWall(interaction.originalMap, interaction.selection.id, {
        a: { x: wall.a.x + delta.x, y: wall.a.y + delta.y },
        b: { x: wall.b.x + delta.x, y: wall.b.y + delta.y },
      })
    }
    if (interaction.selection.kind === 'door' && interaction.originalDoor) {
      const door = interaction.originalDoor
      if (interaction.mode === 'endpoint-a') {
        return resizeDoor(interaction.originalMap, interaction.selection.id, {
          a: point,
          b: door.segment.b,
        })
      }
      if (interaction.mode === 'endpoint-b') {
        return resizeDoor(interaction.originalMap, interaction.selection.id, {
          a: door.segment.a,
          b: point,
        })
      }
      const center = midpoint(door.segment)
      const delta = { x: point.x - interaction.startPoint.x, y: point.y - interaction.startPoint.y }
      return moveDoor(interaction.originalMap, interaction.selection.id, {
        x: center.x + delta.x,
        y: center.y + delta.y,
      })
    }
    return interaction.originalMap
  }

  private cycleHit(point: GridPoint, pointerType: string): MapEditorSelection | null {
    if (!this.map) return null
    const hits = findEditorHits(this.map, this.levelId, point, this.hitTolerance(pointerType))
    if (hits.length === 0) {
      this.lastHitPoint = point
      this.hitCycleIndex = 0
      return null
    }
    if (this.lastHitPoint && distance(this.lastHitPoint, point) <= this.hitTolerance(pointerType)) {
      this.hitCycleIndex = (this.hitCycleIndex + 1) % hits.length
    } else {
      this.hitCycleIndex = 0
    }
    this.lastHitPoint = point
    return hits[this.hitCycleIndex]?.selection ?? null
  }

  private handleAt(
    selection: MapEditorSelection,
    point: GridPoint,
    pointerType: string,
  ): EditorInteraction['mode'] | null {
    if (!this.map) return null
    const radius = this.handleRadius(pointerType)
    if (selection.kind === 'wall') {
      const wall = this.map.walls.find((entry) => entry.id === selection.id)
      if (!wall) return null
      if (distance(point, wall.a) <= radius) return 'endpoint-a'
      if (distance(point, wall.b) <= radius) return 'endpoint-b'
      return null
    }
    if (selection.kind === 'door') {
      const door = this.map.doors.find((entry) => entry.id === selection.id)
      if (!door) return null
      if (distance(point, door.segment.a) <= radius) return 'endpoint-a'
      if (distance(point, door.segment.b) <= radius) return 'endpoint-b'
      return null
    }
    const object = this.map.objects.find((entry) => entry.id === selection.id)
    if (!object) return null
    const resolved = resolveMapObject(object, registry, this.map.objects.indexOf(object))
    const handles = this.objectHandles(resolved)
    if (distance(point, handles.rotate) <= radius) return 'rotate'
    if (distance(point, handles.scale) <= radius) return 'scale'
    return null
  }

  private snap(point: GridPoint): GridPoint {
    return snapGridPoint(point, this.state.snap)
  }

  private hitTolerance(pointerType: string): number {
    return (pointerType === 'touch' ? 20 : 10) / (48 * this.zoom)
  }

  private handleRadius(pointerType: string): number {
    return (pointerType === 'touch' ? 24 : 12) / (48 * this.zoom)
  }

  private objectCenter(object: ResolvedMapObject): GridPoint {
    const local = { x: (object.width * object.scale) / 2, y: (object.height * object.scale) / 2 }
    return {
      x:
        object.position.x +
        local.x * Math.cos(object.rotation) -
        local.y * Math.sin(object.rotation),
      y:
        object.position.y +
        local.x * Math.sin(object.rotation) +
        local.y * Math.cos(object.rotation),
    }
  }

  private objectHandles(object: ResolvedMapObject) {
    const transform = (x: number, y: number): GridPoint => ({
      x:
        object.position.x +
        (x * Math.cos(object.rotation) - y * Math.sin(object.rotation)) * object.scale,
      y:
        object.position.y +
        (x * Math.sin(object.rotation) + y * Math.cos(object.rotation)) * object.scale,
    })
    return {
      corners: [
        transform(0, 0),
        transform(object.width, 0),
        transform(object.width, object.height),
        transform(0, object.height),
      ] as const,
      scale: transform(object.width, object.height),
      rotate: transform(object.width / 2, -Math.max(0.55, object.height * 0.25)),
      center: transform(object.width / 2, object.height / 2),
    }
  }

  private draw(): void {
    const map = this.previewMap ?? this.map
    this.graphics.clear()
    if (!map) return
    const gridSize = map.gridSize
    const lineWidth = Math.max(1.5, 2 / this.zoom)
    for (const wall of map.walls) {
      if (entryLevelId(wall, map) !== this.levelId) continue
      this.graphics
        .moveTo(wall.a.x * gridSize, wall.a.y * gridSize)
        .lineTo(wall.b.x * gridSize, wall.b.y * gridSize)
        .stroke({ color: 0x38bdf8, alpha: 0.72, width: lineWidth })
    }
    for (const door of map.doors) {
      if (entryLevelId(door, map) !== this.levelId) continue
      this.graphics
        .moveTo(door.segment.a.x * gridSize, door.segment.a.y * gridSize)
        .lineTo(door.segment.b.x * gridSize, door.segment.b.y * gridSize)
        .stroke({ color: 0xfb923c, alpha: 0.9, width: Math.max(4, 6 / this.zoom) })
    }
    if (this.wallStart && this.hoverPoint) {
      this.graphics
        .moveTo(this.wallStart.x * gridSize, this.wallStart.y * gridSize)
        .lineTo(this.hoverPoint.x * gridSize, this.hoverPoint.y * gridSize)
        .stroke({ color: 0xfde68a, alpha: 0.92, width: Math.max(2, 3 / this.zoom) })
      this.drawHandle(this.wallStart, gridSize, 0xfde68a)
    }
    if (
      this.state.tool === 'material-brush' ||
      this.state.tool === 'material-eraser' ||
      this.state.tool === 'material-decal'
    ) {
      const points = this.materialStroke?.points ?? (this.hoverPoint ? [this.hoverPoint] : [])
      const cells = sampleBrushCells(points, this.state.brushSize ?? 'medium', map)
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number) as [number, number]
        this.graphics.rect(x * gridSize, y * gridSize, gridSize, gridSize)
      }
      this.graphics.fill({
        color:
          this.state.tool === 'material-eraser'
            ? 0xef4444
            : materialCatalog[this.state.material ?? 'stone'].baseColor,
        alpha: this.materialStroke ? 0.28 : 0.18,
      })
      this.graphics.stroke({ color: 0xffffff, alpha: 0.75, width: lineWidth })
    }
    const selection = this.state.selection
    if (!selection) return
    if (selection.kind === 'material-area' || selection.kind === 'material-decal') {
      const layer = map.materialLayers?.find((entry) => entry.id === selection.layerId)
      const bounds =
        selection.kind === 'material-area'
          ? layer?.areas.find((area) => area.id === selection.id)
          : layer?.decals?.find((decal) => decal.id === selection.id)
      if (!bounds) return
      this.graphics
        .rect(
          bounds.position.x * gridSize,
          bounds.position.y * gridSize,
          (bounds.width ?? 1) * ('scale' in bounds ? (bounds.scale ?? 1) : 1) * gridSize,
          (bounds.height ?? 1) * ('scale' in bounds ? (bounds.scale ?? 1) : 1) * gridSize,
        )
        .stroke({ color: 0xfde047, alpha: 1, width: Math.max(2, 3 / this.zoom) })
      return
    }
    if (selection.kind === 'object') {
      const object = map.objects.find((entry) => entry.id === selection.id)
      if (!object) return
      const resolved = resolveMapObject(object, registry, map.objects.indexOf(object))
      const handles = this.objectHandles(resolved)
      const first = handles.corners[0]
      this.graphics.moveTo(first.x * gridSize, first.y * gridSize)
      for (const corner of handles.corners.slice(1))
        this.graphics.lineTo(corner.x * gridSize, corner.y * gridSize)
      this.graphics
        .lineTo(first.x * gridSize, first.y * gridSize)
        .stroke({ color: 0xfde047, alpha: 1, width: Math.max(2, 3 / this.zoom) })
      this.graphics
        .moveTo(handles.center.x * gridSize, handles.center.y * gridSize)
        .lineTo(handles.rotate.x * gridSize, handles.rotate.y * gridSize)
        .stroke({ color: 0xfde047, alpha: 0.8, width: lineWidth })
      this.drawHandle(handles.scale, gridSize, 0x22c55e)
      this.drawHandle(handles.rotate, gridSize, 0xa78bfa)
      return
    }
    const segment =
      selection.kind === 'wall'
        ? map.walls.find((entry) => entry.id === selection.id)
        : selection.kind === 'door'
          ? map.doors.find((entry) => entry.id === selection.id)?.segment
          : undefined
    if (!segment) return
    this.graphics
      .moveTo(segment.a.x * gridSize, segment.a.y * gridSize)
      .lineTo(segment.b.x * gridSize, segment.b.y * gridSize)
      .stroke({ color: 0xfde047, alpha: 1, width: Math.max(3, 5 / this.zoom) })
    this.drawHandle(segment.a, gridSize, 0xfde047)
    this.drawHandle(segment.b, gridSize, 0xfde047)
  }

  private drawHandle(point: GridPoint, gridSize: number, color: number): void {
    this.graphics
      .circle(point.x * gridSize, point.y * gridSize, Math.max(7 / this.zoom, gridSize * 0.12))
      .fill({ color, alpha: 0.96 })
      .stroke({ color: 0x111827, alpha: 0.95, width: Math.max(1, 2 / this.zoom) })
  }
}
