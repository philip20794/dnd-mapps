import { describe, expect, it } from 'vitest'
import type { MaterialLayerDefinition } from '@/map-materials'
import { MaterialRenderer } from './MaterialRenderer'

describe('MaterialRenderer chunk refresh', () => {
  it('rebuilds dirty chunks while retaining unaffected Pixi containers', () => {
    const renderer = new MaterialRenderer()
    const layer: MaterialLayerDefinition = {
      id: 'terrain',
      seed: 42,
      chunkSize: 16,
      areas: [{ material: 'stone', position: { x: 0, y: 0 }, width: 40, height: 16 }],
    }
    const rendered = renderer.render([layer], 40, 16, 32)
    const originalDirty = rendered.base.getChildByLabel('material-base:terrain:0,0')
    const originalUntouched = rendered.base.getChildByLabel('material-base:terrain:32,0')

    rendered.refreshChunks(
      [{ ...layer, areas: [{ ...layer.areas[0]!, tint: 0x556677 }] }],
      40,
      16,
      32,
      new Set(['terrain:0,0']),
    )

    expect(rendered.base.getChildByLabel('material-base:terrain:0,0')).not.toBe(originalDirty)
    expect(rendered.base.getChildByLabel('material-base:terrain:32,0')).toBe(originalUntouched)
    expect(rendered.chunkCount).toBe(3)
    rendered.base.destroy({ children: true })
    rendered.edges.destroy({ children: true })
    rendered.decals.destroy({ children: true })
  })
})
