import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { MapDefinition } from '@/maps/api'
import { useMapEditorStore } from './mapEditor'

const source: MapDefinition = {
  id: 'source',
  name: 'Quelle',
  width: 10,
  height: 10,
  gridSize: 48,
  levels: [
    { id: 'ground', name: 'Unten' },
    { id: 'upper', name: 'Oben' },
  ],
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
}

describe('Map Editor Store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps draft history separate from the source and supports undo/redo/discard', () => {
    const editor = useMapEditorStore()
    editor.enter(source, new Set([source.id]), 'ground')
    const originalDraftName = editor.draft?.name

    editor.rename('Meine Burg')
    expect(editor.draft?.name).toBe('Meine Burg')
    expect(editor.dirty).toBe(true)
    expect(source.name).toBe('Quelle')

    editor.undo()
    expect(editor.draft?.name).toBe(originalDraftName)
    expect(editor.dirty).toBe(false)
    editor.redo()
    expect(editor.draft?.name).toBe('Meine Burg')
    editor.discardChanges()
    expect(editor.draft?.name).toBe(originalDraftName)
    expect(editor.dirty).toBe(false)
  })

  it('retains a custom map id and switches valid draft levels', () => {
    const custom: MapDefinition = {
      ...source,
      id: 'custom-map-existing',
      editor: { schemaVersion: 1, sourceMapId: source.id, updatedAt: '2026-10-14T10:00:00Z' },
    }
    const editor = useMapEditorStore()
    editor.enter(custom, new Set([source.id, custom.id]), 'ground')
    editor.setLevel('upper')

    expect(editor.draft?.id).toBe(custom.id)
    expect(editor.levelId).toBe('upper')
    expect(() => editor.setLevel('missing')).toThrow('Unbekannte Ebene')
  })

  it('keeps tool state outside history and records a completed drag as one action', () => {
    const editor = useMapEditorStore()
    editor.enter(
      {
        ...source,
        objects: [{ id: 'crate', type: 'crate', preset: 'small-crate', position: { x: 2, y: 2 } }],
      },
      new Set([source.id]),
      'ground',
    )
    editor.setTool('wall')
    editor.setSnap(false)
    editor.select({ kind: 'object', id: 'crate' })
    editor.apply({
      ...editor.draft!,
      objects: editor.draft!.objects.map((object) =>
        object.id === 'crate' ? { ...object, position: { x: 6, y: 5 } } : object,
      ),
    })

    expect(editor.past).toHaveLength(1)
    editor.undo()
    expect(editor.draft?.objects.find((object) => object.id === 'crate')?.position).toEqual({
      x: 2,
      y: 2,
    })
    expect(editor.tool).toBe('wall')
    expect(editor.snap).toBe(false)
  })
})
