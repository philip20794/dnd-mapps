import { createDefaultObjectRegistry, resolveMapObject } from '@/map-objects'
import type { MapObjectDefinition } from '@/map-objects'
import { entryLevelId, getDefaultLevelId } from '@/maps/api'
import type { DoorDefinition, MapDefinition, WallDefinition } from '@/maps/api'
import type { GridPoint, Segment } from '@/types/geometry'
import type { MapEditorSelection, MapObjectLibraryEntry } from './types'

const EPSILON = 0.0001
const registry = createDefaultObjectRegistry()

const cloneMap = (map: MapDefinition): MapDefinition => JSON.parse(JSON.stringify(map))

const distance = (a: GridPoint, b: GridPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

const segmentLength = (segment: Segment): number => distance(segment.a, segment.b)

const clampPoint = (point: GridPoint, map: MapDefinition): GridPoint => ({
  x: Math.max(0, Math.min(map.width, point.x)),
  y: Math.max(0, Math.min(map.height, point.y)),
})

function uniqueId(map: MapDefinition, prefix: string): string {
  const ids = new Set([
    ...map.objects.flatMap((object) => (object.id ? [object.id] : [])),
    ...map.walls.flatMap((wall) => (wall.id ? [wall.id] : [])),
    ...map.doors.map((door) => door.id),
  ])
  for (let index = 1; index < 100_000; index += 1) {
    const candidate = `${prefix}-${index}`
    if (!ids.has(candidate)) return candidate
  }
  throw new Error('Es konnte keine eindeutige Editor-ID erzeugt werden.')
}

export function prepareMapForEditing(map: MapDefinition): MapDefinition {
  const copy = cloneMap(map)
  const used = new Set<string>()
  for (const object of copy.objects) if (object.id) used.add(object.id)
  for (const wall of copy.walls) if (wall.id) used.add(wall.id)
  for (const door of copy.doors) used.add(door.id)
  for (const layer of copy.materialLayers ?? []) {
    for (const area of layer.areas) if (area.id) used.add(area.id)
    for (const decal of layer.decals ?? []) if (decal.id) used.add(decal.id)
  }

  let objectIndex = 1
  let wallIndex = 1
  let materialAreaIndex = 1
  let materialDecalIndex = 1
  const next = (prefix: string, cursor: () => number): string => {
    let candidate = ''
    do candidate = `${prefix}-${cursor()}`
    while (used.has(candidate))
    used.add(candidate)
    return candidate
  }

  return {
    ...copy,
    objects: copy.objects.map((object) => ({
      ...object,
      id: object.id ?? next('editor-object', () => objectIndex++),
    })),
    walls: copy.walls.map((wall) => ({
      ...wall,
      id: wall.id ?? next('editor-wall', () => wallIndex++),
    })),
    materialLayers: copy.materialLayers?.map((layer) => ({
      ...layer,
      areas: layer.areas.map((area) => ({
        ...area,
        id: area.id ?? next('editor-material-area', () => materialAreaIndex++),
      })),
      decals: layer.decals?.map((decal) => ({
        ...decal,
        id: decal.id ?? next('editor-material-decal', () => materialDecalIndex++),
      })),
    })),
  }
}

export function listMapObjectLibrary(): readonly MapObjectLibraryEntry[] {
  return registry
    .listTypes()
    .flatMap((type) =>
      registry.listPresets(type).map((preset) => ({
        type,
        preset: preset.name,
        label: preset.label,
        definition: { type, preset: preset.name },
      })),
    )
    .filter((entry) => entry.type !== 'wooden-door' && entry.type !== 'stone-door')
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

export function addObject(
  map: MapDefinition,
  template: Pick<MapObjectDefinition, 'type' | 'preset'>,
  position: GridPoint,
  levelId: string,
): { readonly map: MapDefinition; readonly selection: MapEditorSelection } {
  const id = uniqueId(map, `object-${template.type}`)
  const definition: MapObjectDefinition = {
    id,
    ...template,
    levelId,
    position: clampPoint(position, map),
  }
  // Resolve once so a broken registry entry never enters the draft.
  resolveMapObject(definition, registry, map.objects.length)
  return {
    map: { ...map, objects: [...map.objects, definition] },
    selection: { kind: 'object', id },
  }
}

export function updateObject(
  map: MapDefinition,
  id: string,
  patch: Partial<MapObjectDefinition>,
): MapDefinition {
  return {
    ...map,
    objects: map.objects.map((object) =>
      object.id === id
        ? {
            ...object,
            ...patch,
            id,
            position: clampPoint(patch.position ?? object.position, map),
          }
        : object,
    ),
  }
}

export function addWall(
  map: MapDefinition,
  a: GridPoint,
  b: GridPoint,
  levelId: string,
  defaults: Pick<WallDefinition, 'blocksSight' | 'blocksMovement'> = {
    blocksSight: true,
    blocksMovement: true,
  },
): { readonly map: MapDefinition; readonly selection: MapEditorSelection } | null {
  const segment = { a: clampPoint(a, map), b: clampPoint(b, map) }
  if (segmentLength(segment) <= EPSILON) return null
  const id = uniqueId(map, 'wall')
  return {
    map: { ...map, walls: [...map.walls, { id, levelId, ...segment, ...defaults, appearance: 'stone' as const }] },
    selection: { kind: 'wall', id },
  }
}

export function updateWall(
  map: MapDefinition,
  id: string,
  patch: Partial<WallDefinition>,
): MapDefinition {
  return {
    ...map,
    walls: map.walls.map((wall) => {
      if (wall.id !== id) return wall
      const next = {
        ...wall,
        ...patch,
        id,
        a: clampPoint(patch.a ?? wall.a, map),
        b: clampPoint(patch.b ?? wall.b, map),
      }
      return segmentLength(next) <= EPSILON ? wall : next
    }),
  }
}

export function splitWall(
  map: MapDefinition,
  id: string,
  point?: GridPoint,
): { readonly map: MapDefinition; readonly selection: MapEditorSelection } | null {
  const wall = map.walls.find((entry) => entry.id === id)
  if (!wall) return null
  const split = point ? projectPointToSegment(point, wall) : midpoint(wall)
  if (distance(wall.a, split) <= EPSILON || distance(split, wall.b) <= EPSILON) return null
  const firstId = uniqueId(map, `${id}-part`)
  const mapWithFirst: MapDefinition = {
    ...map,
    walls: map.walls.filter((entry) => entry.id !== id),
  }
  const secondId = uniqueId(
    { ...mapWithFirst, walls: [...mapWithFirst.walls, { ...wall, id: firstId }] },
    `${id}-part`,
  )
  return {
    map: {
      ...mapWithFirst,
      walls: [
        ...mapWithFirst.walls,
        { ...wall, id: firstId, b: split },
        { ...wall, id: secondId, a: split },
      ],
    },
    selection: { kind: 'wall', id: secondId },
  }
}

function midpoint(segment: Segment): GridPoint {
  return { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 }
}

function projectPointToSegment(point: GridPoint, segment: Segment): GridPoint {
  const dx = segment.b.x - segment.a.x
  const dy = segment.b.y - segment.a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON) return segment.a
  const t = Math.max(
    0,
    Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared),
  )
  return { x: segment.a.x + dx * t, y: segment.a.y + dy * t }
}

function doorObjectForSegment(
  id: string,
  label: string,
  segment: Segment,
  levelId: string,
  type: 'wooden-door' | 'stone-door' = 'wooden-door',
): MapObjectDefinition {
  return {
    id,
    type,
    preset: type === 'wooden-door' ? 'closed-wooden-door' : 'closed-stone-door',
    levelId,
    position: segment.a,
    width: segmentLength(segment),
    height: type === 'wooden-door' ? 0.25 : 0.3,
    rotation: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x),
    label,
    interactionState: 'closed',
  }
}

function splitWallForDoor(
  map: MapDefinition,
  wall: WallDefinition,
  center: GridPoint,
  requestedWidth: number,
  doorId: string,
  label: string,
  type: 'wooden-door' | 'stone-door' = 'wooden-door',
): MapDefinition | null {
  const length = segmentLength(wall)
  if (length <= EPSILON) return null
  const width = Math.min(Math.max(0.25, requestedWidth), length)
  const projected = projectPointToSegment(center, wall)
  const dx = (wall.b.x - wall.a.x) / length
  const dy = (wall.b.y - wall.a.y) / length
  const projectedDistance = (projected.x - wall.a.x) * dx + (projected.y - wall.a.y) * dy
  const centerDistance = Math.max(width / 2, Math.min(length - width / 2, projectedDistance))
  const doorSegment: Segment = {
    a: {
      x: wall.a.x + dx * (centerDistance - width / 2),
      y: wall.a.y + dy * (centerDistance - width / 2),
    },
    b: {
      x: wall.a.x + dx * (centerDistance + width / 2),
      y: wall.a.y + dy * (centerDistance + width / 2),
    },
  }
  const levelId = entryLevelId(wall, map)
  const replacementWalls: WallDefinition[] = []
  if (distance(wall.a, doorSegment.a) > EPSILON) {
    replacementWalls.push({
      ...wall,
      id: uniqueId(map, `${wall.id ?? 'wall'}-door`),
      b: doorSegment.a,
    })
  }
  const withFirst =
    replacementWalls.length > 0 ? { ...map, walls: [...map.walls, ...replacementWalls] } : map
  if (distance(doorSegment.b, wall.b) > EPSILON) {
    replacementWalls.push({
      ...wall,
      id: uniqueId(withFirst, `${wall.id ?? 'wall'}-door`),
      a: doorSegment.b,
    })
  }
  const door: DoorDefinition = {
    id: doorId,
    label,
    levelId,
    segment: doorSegment,
    defaultState: 'closed',
    blocksSightWhenClosed: true,
    blocksMovementWhenClosed: true,
  }
  return {
    ...map,
    walls: [...map.walls.filter((entry) => entry !== wall), ...replacementWalls],
    doors: [...map.doors.filter((entry) => entry.id !== doorId), door],
    objects: [
      ...map.objects.filter((object) => object.id !== doorId),
      doorObjectForSegment(doorId, label, doorSegment, levelId, type),
    ],
  }
}

export function placeDoorOnWall(
  map: MapDefinition,
  wallId: string,
  center: GridPoint,
  width = 1,
): { readonly map: MapDefinition; readonly selection: MapEditorSelection } | null {
  const wall = map.walls.find((entry) => entry.id === wallId)
  if (!wall) return null
  const id = uniqueId(map, 'door')
  const next = splitWallForDoor(map, wall, center, width, id, 'Tür')
  return next ? { map: next, selection: { kind: 'door', id } } : null
}

function restoredDoorWall(map: MapDefinition, door: DoorDefinition): WallDefinition {
  return {
    id: uniqueId(map, `${door.id}-opening`),
    levelId: door.levelId,
    a: door.segment.a,
    b: door.segment.b,
    blocksSight: door.blocksSightWhenClosed,
    blocksMovement: door.blocksMovementWhenClosed,
  }
}

export function updateDoor(
  map: MapDefinition,
  id: string,
  patch: Partial<DoorDefinition>,
): MapDefinition {
  const door = map.doors.find((entry) => entry.id === id)
  if (!door) return map
  const nextDoor = { ...door, ...patch, id, segment: patch.segment ?? door.segment }
  const oldObject = map.objects.find((object) => object.id === id)
  const levelId = nextDoor.levelId ?? oldObject?.levelId ?? getDefaultLevelId(map)
  const type = oldObject?.type === 'stone-door' ? 'stone-door' : 'wooden-door'
  return {
    ...map,
    doors: map.doors.map((entry) => (entry.id === id ? nextDoor : entry)),
    objects: map.objects.map((object) =>
      object.id === id
        ? {
            ...doorObjectForSegment(id, nextDoor.label, nextDoor.segment, levelId, type),
            color: object.color,
            secondaryColor: object.secondaryColor,
          }
        : object,
    ),
  }
}

export function moveDoor(map: MapDefinition, id: string, center: GridPoint): MapDefinition {
  const door = map.doors.find((entry) => entry.id === id)
  if (!door) return map
  const restored = restoredDoorWall(map, door)
  const withoutDoor: MapDefinition = {
    ...map,
    doors: map.doors.filter((entry) => entry.id !== id),
    objects: map.objects.filter((object) => object.id !== id),
    walls: [...map.walls, restored],
  }
  const supporting = mergeSupportingWalls(withoutDoor, restored)
  const oldObject = map.objects.find((object) => object.id === id)
  return (
    splitWallForDoor(
      supporting.map,
      supporting.wall,
      center,
      segmentLength(door.segment),
      id,
      door.label,
      oldObject?.type === 'stone-door' ? 'stone-door' : 'wooden-door',
    ) ?? map
  )
}

export function resizeDoor(
  map: MapDefinition,
  id: string,
  requestedSegment: Segment,
): MapDefinition {
  const door = map.doors.find((entry) => entry.id === id)
  if (!door || segmentLength(requestedSegment) <= EPSILON) return map
  const restored = restoredDoorWall(map, door)
  const withoutDoor: MapDefinition = {
    ...map,
    doors: map.doors.filter((entry) => entry.id !== id),
    objects: map.objects.filter((object) => object.id !== id),
    walls: [...map.walls, restored],
  }
  const supporting = mergeSupportingWalls(withoutDoor, restored)
  const requestedA = projectPointToSegment(requestedSegment.a, supporting.wall)
  const requestedB = projectPointToSegment(requestedSegment.b, supporting.wall)
  const width = distance(requestedA, requestedB)
  if (width <= EPSILON) return map
  const oldObject = map.objects.find((object) => object.id === id)
  return (
    splitWallForDoor(
      supporting.map,
      supporting.wall,
      midpoint({ a: requestedA, b: requestedB }),
      width,
      id,
      door.label,
      oldObject?.type === 'stone-door' ? 'stone-door' : 'wooden-door',
    ) ?? map
  )
}

function cross(a: GridPoint, b: GridPoint, c: GridPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function mergeSupportingWalls(
  map: MapDefinition,
  seed: WallDefinition,
): { readonly map: MapDefinition; readonly wall: WallDefinition } {
  const levelId = entryLevelId(seed, map)
  const candidates = map.walls.filter(
    (wall) =>
      entryLevelId(wall, map) === levelId &&
      Math.abs(cross(seed.a, seed.b, wall.a)) <= EPSILON &&
      Math.abs(cross(seed.a, seed.b, wall.b)) <= EPSILON,
  )
  const dx = seed.b.x - seed.a.x
  const dy = seed.b.y - seed.a.y
  const length = Math.max(EPSILON, Math.hypot(dx, dy))
  const unit = { x: dx / length, y: dy / length }
  const projection = (point: GridPoint): number =>
    (point.x - seed.a.x) * unit.x + (point.y - seed.a.y) * unit.y
  let min = Math.min(0, projection(seed.b))
  let max = Math.max(0, projection(seed.b))
  const included = new Set<WallDefinition>([seed])
  let changed = true
  while (changed) {
    changed = false
    for (const wall of candidates) {
      if (included.has(wall)) continue
      const wallMin = Math.min(projection(wall.a), projection(wall.b))
      const wallMax = Math.max(projection(wall.a), projection(wall.b))
      if (wallMax + EPSILON < min || wallMin - EPSILON > max) continue
      included.add(wall)
      min = Math.min(min, wallMin)
      max = Math.max(max, wallMax)
      changed = true
    }
  }
  const merged: WallDefinition = {
    ...seed,
    a: { x: seed.a.x + unit.x * min, y: seed.a.y + unit.y * min },
    b: { x: seed.a.x + unit.x * max, y: seed.a.y + unit.y * max },
  }
  return {
    map: { ...map, walls: map.walls.filter((wall) => !included.has(wall)) },
    wall: merged,
  }
}

export function deleteSelection(map: MapDefinition, selection: MapEditorSelection): MapDefinition {
  if (selection.kind === 'material-area' || selection.kind === 'material-decal') {
    return {
      ...map,
      materialLayers: (map.materialLayers ?? []).map((layer) =>
        layer.id !== selection.layerId
          ? layer
          : selection.kind === 'material-area'
            ? { ...layer, areas: layer.areas.filter((area) => area.id !== selection.id) }
            : {
                ...layer,
                decals: (layer.decals ?? []).filter((decal) => decal.id !== selection.id),
              },
      ),
    }
  }
  if (selection.kind === 'object') {
    return { ...map, objects: map.objects.filter((object) => object.id !== selection.id) }
  }
  if (selection.kind === 'wall') {
    return { ...map, walls: map.walls.filter((wall) => wall.id !== selection.id) }
  }
  const door = map.doors.find((entry) => entry.id === selection.id)
  if (!door) return map
  const restored = restoredDoorWall(map, door)
  return {
    ...map,
    doors: map.doors.filter((entry) => entry.id !== selection.id),
    objects: map.objects.filter((object) => object.id !== selection.id),
    walls: [...map.walls, restored],
  }
}

export function duplicateSelection(
  map: MapDefinition,
  selection: MapEditorSelection,
): { readonly map: MapDefinition; readonly selection: MapEditorSelection } | null {
  if (selection.kind === 'material-area' || selection.kind === 'material-decal') {
    const layer = map.materialLayers?.find((entry) => entry.id === selection.layerId)
    if (!layer) return null
    if (selection.kind === 'material-area') {
      const source = layer.areas.find((area) => area.id === selection.id)
      if (!source) return null
      const id = `${selection.id}-copy-${layer.areas.length + 1}`
      const duplicate = {
        ...source,
        id,
        position: { x: source.position.x + 0.5, y: source.position.y + 0.5 },
      }
      return {
        map: {
          ...map,
          materialLayers: map.materialLayers?.map((entry) =>
            entry.id === layer.id ? { ...entry, areas: [...entry.areas, duplicate] } : entry,
          ),
        },
        selection: { kind: 'material-area', id, layerId: layer.id },
      }
    }
    const source = layer.decals?.find((decal) => decal.id === selection.id)
    if (!source) return null
    const id = `${selection.id}-copy-${(layer.decals?.length ?? 0) + 1}`
    const duplicate = {
      ...source,
      id,
      position: { x: source.position.x + 0.5, y: source.position.y + 0.5 },
    }
    return {
      map: {
        ...map,
        materialLayers: map.materialLayers?.map((entry) =>
          entry.id === layer.id
            ? { ...entry, decals: [...(entry.decals ?? []), duplicate] }
            : entry,
        ),
      },
      selection: { kind: 'material-decal', id, layerId: layer.id },
    }
  }
  if (selection.kind === 'object') {
    const source = map.objects.find((object) => object.id === selection.id)
    if (!source) return null
    const id = uniqueId(map, `object-${source.type}`)
    const duplicate: MapObjectDefinition = {
      ...source,
      id,
      position: clampPoint({ x: source.position.x + 0.5, y: source.position.y + 0.5 }, map),
    }
    return {
      map: { ...map, objects: [...map.objects, duplicate] },
      selection: { kind: 'object', id },
    }
  }
  if (selection.kind === 'wall') {
    const source = map.walls.find((wall) => wall.id === selection.id)
    if (!source) return null
    const id = uniqueId(map, 'wall')
    const offset = { x: 0.25, y: 0.25 }
    const duplicate: WallDefinition = {
      ...source,
      id,
      a: clampPoint({ x: source.a.x + offset.x, y: source.a.y + offset.y }, map),
      b: clampPoint({ x: source.b.x + offset.x, y: source.b.y + offset.y }, map),
    }
    return {
      map: { ...map, walls: [...map.walls, duplicate] },
      selection: { kind: 'wall', id },
    }
  }
  const door = map.doors.find((entry) => entry.id === selection.id)
  if (!door) return null
  const center = midpoint(door.segment)
  const direction = {
    x: door.segment.b.x - door.segment.a.x,
    y: door.segment.b.y - door.segment.a.y,
  }
  const target = {
    x: center.x + direction.x * 1.5,
    y: center.y + direction.y * 1.5,
  }
  const supportingWall = nearestWall(map, target, entryLevelId(door, map))
  return supportingWall
    ? placeDoorOnWall(map, supportingWall.id ?? '', target, segmentLength(door.segment))
    : null
}

export function nearestWall(
  map: MapDefinition,
  point: GridPoint,
  levelId: string,
  maxDistance = 0.75,
): WallDefinition | null {
  let best: { wall: WallDefinition; distance: number } | null = null
  for (const wall of map.walls) {
    if (entryLevelId(wall, map) !== levelId) continue
    const candidateDistance = distance(point, projectPointToSegment(point, wall))
    if (candidateDistance > maxDistance || (best && candidateDistance >= best.distance)) continue
    best = { wall, distance: candidateDistance }
  }
  return best?.wall ?? null
}

export interface EditorHit {
  readonly selection: MapEditorSelection
  readonly distance: number
}

export function findEditorHits(
  map: MapDefinition,
  levelId: string,
  point: GridPoint,
  tolerance = 0.3,
): readonly EditorHit[] {
  const hits: EditorHit[] = []
  for (const door of map.doors) {
    if (entryLevelId(door, map) !== levelId) continue
    const hitDistance = distance(point, projectPointToSegment(point, door.segment))
    if (hitDistance <= tolerance)
      hits.push({ selection: { kind: 'door', id: door.id }, distance: hitDistance })
  }
  map.objects.forEach((object, index) => {
    if (
      !object.id ||
      entryLevelId(object, map) !== levelId ||
      map.doors.some((door) => door.id === object.id)
    )
      return
    const resolved = resolveMapObject(object, registry, index)
    const dx = point.x - resolved.position.x
    const dy = point.y - resolved.position.y
    const cos = Math.cos(-resolved.rotation)
    const sin = Math.sin(-resolved.rotation)
    const localX = (dx * cos - dy * sin) / Math.max(EPSILON, resolved.scale)
    const localY = (dx * sin + dy * cos) / Math.max(EPSILON, resolved.scale)
    if (
      localX >= -tolerance &&
      localY >= -tolerance &&
      localX <= resolved.width + tolerance &&
      localY <= resolved.height + tolerance
    ) {
      hits.push({
        selection: { kind: 'object', id: object.id },
        distance: Math.hypot(localX - resolved.width / 2, localY - resolved.height / 2),
      })
    }
  })
  for (const wall of map.walls) {
    if (!wall.id || entryLevelId(wall, map) !== levelId) continue
    const hitDistance = distance(point, projectPointToSegment(point, wall))
    if (hitDistance <= tolerance)
      hits.push({ selection: { kind: 'wall', id: wall.id }, distance: hitDistance })
  }
  const priority = (kind: MapEditorSelection['kind']): number =>
    kind === 'door' ? 0 : kind === 'object' ? 1 : 2
  return hits.sort(
    (a, b) => priority(a.selection.kind) - priority(b.selection.kind) || a.distance - b.distance,
  )
}

export function selectedObject(map: MapDefinition, selection: MapEditorSelection | null) {
  return selection?.kind === 'object'
    ? (map.objects.find((object) => object.id === selection.id) ?? null)
    : null
}

export function selectedWall(map: MapDefinition, selection: MapEditorSelection | null) {
  return selection?.kind === 'wall'
    ? (map.walls.find((wall) => wall.id === selection.id) ?? null)
    : null
}

export function selectedDoor(map: MapDefinition, selection: MapEditorSelection | null) {
  return selection?.kind === 'door'
    ? (map.doors.find((door) => door.id === selection.id) ?? null)
    : null
}
