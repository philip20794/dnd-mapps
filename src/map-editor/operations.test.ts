import { describe, expect, it } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import { movementSegmentsForMap } from '@/map-engine/collision/movement'
import { validateEditableMap } from './mapEditor'
import {
  addObject,
  addWall,
  deleteSelection,
  duplicateSelection,
  findEditorHits,
  moveDoor,
  placeDoorOnWall,
  prepareMapForEditing,
  resizeDoor,
  splitWall,
  updateObject,
  updateWall,
} from './operations'

const baseMap = (): MapDefinition => ({
  id: 'editor-test',
  name: 'Editor-Test',
  width: 20,
  height: 12,
  gridSize: 48,
  levels: [
    { id: 'ground', name: 'Unten' },
    { id: 'upper', name: 'Oben' },
  ],
  defaultLevelId: 'ground',
  objects: [],
  walls: [
    {
      id: 'support',
      levelId: 'ground',
      a: { x: 2, y: 5 },
      b: { x: 14, y: 5 },
      blocksSight: true,
      blocksMovement: true,
    },
  ],
  doors: [],
  spawnPoints: [],
})

describe('map editor operations', () => {
  it('assigns stable ids and limits hit testing to the active level', () => {
    const prepared = prepareMapForEditing({
      ...baseMap(),
      objects: [
        { type: 'crate', preset: 'small-crate', levelId: 'ground', position: { x: 3, y: 3 } },
        { type: 'barrel', preset: 'small-barrel', levelId: 'upper', position: { x: 3, y: 3 } },
      ],
      walls: [
        {
          a: { x: 1, y: 1 },
          b: { x: 5, y: 1 },
          levelId: 'ground',
          blocksSight: true,
          blocksMovement: true,
        },
      ],
    })

    expect(prepared.objects.every((object) => object.id)).toBe(true)
    expect(prepared.walls.every((wall) => wall.id)).toBe(true)
    const hits = findEditorHits(prepared, 'ground', { x: 3.2, y: 3.2 }, 0.4)
    expect(hits.map((hit) => hit.selection.kind)).toEqual(['object'])
    expect(hits[0]?.selection.id).toBe(prepared.objects[0]?.id)
  })

  it('places, edits, duplicates and deletes preset objects without losing transitions', () => {
    const placed = addObject(
      baseMap(),
      { type: 'crate', preset: 'small-crate' },
      { x: 4, y: 4 },
      'ground',
    )
    const id = placed.selection.id
    const withTransition = updateObject(placed.map, id, {
      rotation: Math.PI / 2,
      scale: 1.5,
      blocksMovement: true,
      transition: { targetLevelId: 'upper', targetPosition: { x: 2, y: 2 }, direction: 'up' },
    })
    const moved = updateObject(withTransition, id, { position: { x: 5, y: 6 } })
    const duplicated = duplicateSelection(moved, placed.selection)

    expect(moved.objects.find((object) => object.id === id)?.transition?.targetLevelId).toBe(
      'upper',
    )
    expect(duplicated?.map.objects).toHaveLength(2)
    expect(deleteSelection(duplicated!.map, duplicated!.selection).objects).toHaveLength(1)
  })

  it('rejects zero-length walls and treats endpoint drag as one valid segment', () => {
    expect(addWall(baseMap(), { x: 2, y: 2 }, { x: 2, y: 2 }, 'ground')).toBeNull()
    const added = addWall(baseMap(), { x: 2, y: 2 }, { x: 8, y: 2 }, 'ground')!
    const moved = updateWall(added.map, added.selection.id, { b: { x: 9, y: 3 } })
    const unchanged = updateWall(moved, added.selection.id, { b: { x: 2, y: 2 } })
    const wall = unchanged.walls.find((entry) => entry.id === added.selection.id)

    expect(wall?.b).toEqual({ x: 9, y: 3 })
    expect(validateEditableMap(unchanged)).toEqual([])
  })

  it('splits walls into two non-zero segments', () => {
    const result = splitWall(baseMap(), 'support')!
    expect(result.map.walls).toHaveLength(2)
    expect(result.map.walls[0]?.b).toEqual(result.map.walls[1]?.a)
    expect(validateEditableMap(result.map)).toEqual([])
  })

  it('places a door by carving its opening and keeps closed/open collision coherent', () => {
    const result = placeDoorOnWall(baseMap(), 'support', { x: 8, y: 5 }, 2)!
    const door = result.map.doors[0]!

    expect(result.map.objects.find((object) => object.id === door.id)?.type).toBe('wooden-door')
    expect(result.map.walls).toHaveLength(2)
    expect(
      result.map.walls.every(
        (wall) => wall.b.x <= door.segment.a.x || wall.a.x >= door.segment.b.x,
      ),
    ).toBe(true)
    expect(validateEditableMap(result.map)).toEqual([])
    expect(movementSegmentsForMap(result.map, { [door.id]: 'closed' }, 'ground')).toHaveLength(3)
    expect(movementSegmentsForMap(result.map, { [door.id]: 'open' }, 'ground')).toHaveLength(2)
  })

  it('moves and resizes a door while restoring the old opening and carving the new one', () => {
    const placed = placeDoorOnWall(baseMap(), 'support', { x: 6, y: 5 }, 2)!
    const doorId = placed.map.doors[0]!.id
    const moved = moveDoor(placed.map, doorId, { x: 10, y: 5 })
    const resized = resizeDoor(moved, doorId, { a: { x: 9, y: 5 }, b: { x: 12, y: 5 } })
    const door = resized.doors.find((entry) => entry.id === doorId)!

    expect(door.segment).toEqual({ a: { x: 9, y: 5 }, b: { x: 12, y: 5 } })
    expect(
      resized.walls.every((wall) => wall.b.x <= door.segment.a.x || wall.a.x >= door.segment.b.x),
    ).toBe(true)
    expect(validateEditableMap(resized)).toEqual([])
    expect(resized.walls.some((wall) => wall.a.x <= 6 && wall.b.x >= 6)).toBe(true)
  })

  it('removes a door and restores a blocking wall in the same map change', () => {
    const placed = placeDoorOnWall(baseMap(), 'support', { x: 8, y: 5 }, 2)!
    const deleted = deleteSelection(placed.map, placed.selection)

    expect(deleted.doors).toEqual([])
    expect(deleted.objects).toEqual([])
    expect(movementSegmentsForMap(deleted, {}, 'ground')).toHaveLength(3)
    expect(validateEditableMap(deleted)).toEqual([])
  })
})
