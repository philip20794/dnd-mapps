import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapEditorToolbar from './MapEditorToolbar.vue'
import type { MapDefinition } from '@/maps/api'

const map: MapDefinition = {
  id: 'editor-map',
  name: 'Alte Karte',
  width: 10,
  height: 10,
  gridSize: 48,
  objects: [],
  walls: [],
  doors: [],
  spawnPoints: [],
}

const baseProps = {
  map,
  mapName: map.name,
  dirty: false,
  canUndo: true,
  canRedo: false,
  tool: 'select' as const,
  snap: true,
  selection: null,
  objectLibrary: [],
}

describe('MapEditorToolbar', () => {
  it('commits the map name before save and exposes only working foundation actions', async () => {
    const wrapper = mount(MapEditorToolbar, {
      props: baseProps,
    })
    await wrapper.get('[data-testid="map-editor-name"]').setValue('Neue Karte')
    await wrapper.get('[data-testid="map-editor-save"]').trigger('click')

    expect(wrapper.emitted('rename')?.at(-1)).toEqual(['Neue Karte'])
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.get('[data-testid="map-editor-redo"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="map-editor-tool-wall"]')).toBeTruthy()
  })

  it('prevents leaving with unsaved changes while keeping discard available', () => {
    const wrapper = mount(MapEditorToolbar, {
      props: { ...baseProps, mapName: 'Entwurf', dirty: true, canUndo: false, canRedo: false },
    })

    expect(wrapper.get('[data-testid="map-editor-leave"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="map-editor-discard"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Ungespeicherte Änderungen')
  })

  it('selects a preset for touch placement and exposes snap and tools', async () => {
    const wrapper = mount(MapEditorToolbar, {
      props: {
        ...baseProps,
        objectLibrary: [
          {
            type: 'crate',
            preset: 'small-crate',
            label: 'Kleine Kiste',
            definition: { type: 'crate', preset: 'small-crate' },
          },
        ],
      },
    })
    await wrapper.get('[data-testid="map-editor-preset-small-crate"]').trigger('click')
    await wrapper.get('[data-testid="map-editor-tool-wall"]').trigger('click')
    await wrapper.get('[data-testid="map-editor-snap"]').setValue(false)

    expect(wrapper.emitted('beginObjectPlacement')?.[0]).toEqual([
      { type: 'crate', preset: 'small-crate' },
    ])
    expect(wrapper.emitted('toolChange')?.at(-1)).toEqual(['wall'])
    expect(wrapper.emitted('snapChange')?.at(-1)).toEqual([false])
  })

  it('exposes the material palette, brush sizes and decal tools for touch use', async () => {
    const wrapper = mount(MapEditorToolbar, {
      props: { ...baseProps, tool: 'material-brush', material: 'stone', brushSize: 'medium' },
    })

    await wrapper.get('[data-testid="map-editor-material-shallow-water"]').trigger('click')
    await wrapper.get('[data-testid="map-editor-brush-large"]').trigger('click')
    await wrapper.get('[data-testid="map-editor-decal-moss"]').trigger('click')

    expect(wrapper.emitted('materialChange')?.at(-1)).toEqual(['shallow-water'])
    expect(wrapper.emitted('brushSizeChange')?.at(-1)).toEqual(['large'])
    expect(wrapper.emitted('decalKindChange')?.at(-1)).toEqual(['moss'])
    expect(wrapper.find('[data-testid="map-editor-preset-small-crate"]').exists()).toBe(false)
  })
})
