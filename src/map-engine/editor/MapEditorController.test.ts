import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import type { MapDefinition } from '@/maps/api'
import type { MapEditorSelection, MapEditorState } from '@/map-editor/types'
import { MapEditorController, type MapEditorControllerHandlers } from './MapEditorController'

const map: MapDefinition = {
  id: 'controller-test',
  name: 'Controller',
  width: 12,
  height: 12,
  gridSize: 48,
  objects: [
    { id: 'crate-a', type: 'crate', preset: 'small-crate', position: { x: 2, y: 2 } },
    { id: 'barrel-a', type: 'barrel', preset: 'small-barrel', position: { x: 2, y: 2 } },
  ],
  walls: [],
  doors: [],
  spawnPoints: [],
}

const state = (selection: MapEditorSelection | null = null): MapEditorState => ({
  tool: 'select',
  selection,
  snap: false,
  objectTemplate: null,
})

const pointer = (pointerId: number, pointerType: 'mouse' | 'touch' = 'touch') =>
  ({ pointerId, pointerType, button: 0, clientX: 100, clientY: 100 }) as PointerEvent

describe('MapEditorController', () => {
  it('cycles overlapping objects on repeated touch taps', () => {
    const selected: Array<MapEditorSelection | null> = []
    const controller = new MapEditorController(new Container(), {
      onSelect: (selection) => selected.push(selection),
      onCommit: vi.fn<MapEditorControllerHandlers['onCommit']>(),
    })
    controller.setActive(true)
    controller.setMap(map, 'ground')
    controller.setState(state())

    controller.pointerDown(pointer(1), { x: 2.2, y: 2.2 })
    controller.pointerUp(pointer(1), { x: 2.2, y: 2.2 })
    controller.pointerDown(pointer(2), { x: 2.2, y: 2.2 })

    expect(selected).toHaveLength(2)
    expect(selected[0]).not.toEqual(selected[1])
    controller.destroy()
  })

  it('commits one map update for a complete touch drag', () => {
    const commits = vi.fn<MapEditorControllerHandlers['onCommit']>()
    const controller = new MapEditorController(new Container(), {
      onSelect: vi.fn<MapEditorControllerHandlers['onSelect']>(),
      onCommit: commits,
    })
    controller.setActive(true)
    controller.setMap(map, 'ground')
    controller.setState(state({ kind: 'object', id: 'crate-a' }))

    controller.pointerDown(pointer(3), { x: 2.2, y: 2.2 })
    controller.pointerMove(pointer(3), { x: 3.2, y: 3.2 })
    controller.pointerMove(pointer(3), { x: 4.2, y: 4.2 })
    controller.pointerUp(pointer(3), { x: 4.2, y: 4.2 })

    expect(commits).toHaveBeenCalledOnce()
    const committed = commits.mock.calls[0]?.[0] as MapDefinition
    expect(committed.objects.find((object) => object.id === 'crate-a')?.position).toEqual({
      x: 4,
      y: 4,
    })
    controller.destroy()
  })

  it('creates no zero-length wall from two identical touch taps', () => {
    const commits = vi.fn<MapEditorControllerHandlers['onCommit']>()
    const controller = new MapEditorController(new Container(), {
      onSelect: vi.fn<MapEditorControllerHandlers['onSelect']>(),
      onCommit: commits,
    })
    controller.setActive(true)
    controller.setMap(map, 'ground')
    controller.setState({ tool: 'wall', selection: null, snap: false, objectTemplate: null })

    controller.pointerDown(pointer(4), { x: 5, y: 5 })
    controller.pointerDown(pointer(5), { x: 5, y: 5 })

    expect(commits).not.toHaveBeenCalled()
    controller.destroy()
  })

  it('collects a fast touch brush stroke and commits it as one material history action', () => {
    const commits = vi.fn<MapEditorControllerHandlers['onCommit']>()
    const controller = new MapEditorController(new Container(), {
      onSelect: vi.fn<MapEditorControllerHandlers['onSelect']>(),
      onCommit: commits,
    })
    controller.setActive(true)
    controller.setMap(map, 'ground')
    controller.setState({
      ...state(),
      tool: 'material-brush',
      material: 'mud',
      brushSize: 'large',
      materialRotation: 0,
      materialScale: 1,
      materialAlpha: 1,
      decalKind: 'crack',
    })

    controller.pointerDown(pointer(9), { x: 1, y: 6 })
    controller.pointerMove(pointer(9), { x: 10, y: 6 })
    controller.pointerUp(pointer(9), { x: 11, y: 6 })

    expect(commits).toHaveBeenCalledOnce()
    const committed = commits.mock.calls[0]?.[0] as MapDefinition
    expect(committed.materialLayers?.[0]?.areas.length).toBeLessThan(6)
    expect(committed.materialLayers?.[0]?.areas.every((area) => area.material === 'mud')).toBe(true)
    expect(commits.mock.calls[0]?.[2]).toBeInstanceOf(Set)
    controller.destroy()
  })

  it('never renders editor overlays in play mode, including after leaving the editor and changing maps', () => {
    const layer = new Container()
    const controller = new MapEditorController(layer, {
      onSelect: vi.fn<MapEditorControllerHandlers['onSelect']>(),
      onCommit: vi.fn<MapEditorControllerHandlers['onCommit']>(),
    })
    const overlay = layer.getChildByLabel('map-editor-overlay')

    controller.setMap(map, 'ground')
    expect(overlay?.visible).toBe(false)

    controller.setActive(true)
    expect(overlay?.visible).toBe(true)
    controller.setActive(false)
    controller.setMap({ ...map, id: 'another-map' }, 'ground')
    controller.setState({ ...state(), tool: 'wall' })

    expect(overlay?.visible).toBe(false)
    expect(controller.pointerDown(pointer(12), { x: 3, y: 3 })).toBe(false)
    controller.destroy()
  })

  it('cancels pending object placement through the shared Escape action', () => {
    const cancelTool = vi.fn<NonNullable<MapEditorControllerHandlers['onCancelTool']>>()
    const controller = new MapEditorController(new Container(), {
      onSelect: vi.fn<MapEditorControllerHandlers['onSelect']>(),
      onCommit: vi.fn<MapEditorControllerHandlers['onCommit']>(),
      onCancelTool: cancelTool,
    })
    controller.setActive(true)
    controller.setMap(map, 'ground')
    controller.setState({
      ...state(),
      tool: 'object',
      objectTemplate: { type: 'crate', preset: 'small-crate' },
    })

    expect(controller.cancelPendingTool()).toBe(true)
    expect(cancelTool).toHaveBeenCalledOnce()
    controller.destroy()
  })
})
