import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import type { PlacedSpellEffect } from '@/types/spells'
import { SpellEffectRenderer } from './SpellEffectRenderer'

const effect = (id: string, x: number): PlacedSpellEffect => ({
  id,
  mapId: 'large-map',
  presetId: 'shape-circle',
  name: 'Kreis',
  shape: 'sphere',
  position: { x, y: 500 },
  rotation: 0,
  size: 3,
  width: 1,
  duration: 'persistent',
  color: '#ff6b4a',
  attachedToCaster: false,
})

describe('SpellEffectRenderer', () => {
  it('verschiebt den vorhandenen Container direkt und baut nur geänderte Effekte neu', () => {
    const renderer = new SpellEffectRenderer()
    const layer = new Container()
    const first = effect('first', 500)
    const second = effect('second', 520)

    renderer.render(layer, [first, second], [], first.id, 48, 1000, 1000)
    const firstContainer = layer.children[0]
    const secondContainer = layer.children[1]

    renderer.moveEffect(first.id, { x: 501, y: 501 }, 48)
    expect(layer.children[0]).toBe(firstContainer)
    expect(firstContainer?.position.x).toBe(501 * 48)

    renderer.render(layer, [{ ...first, size: 4 }, second], [], first.id, 48, 1000, 1000)
    expect(layer.children[0]).not.toBe(firstContainer)
    expect(layer.children[1]).toBe(secondContainer)

    renderer.clear()
    expect(layer.children).toHaveLength(0)
  })

  it('zeigt Griffe und textuelle Zustandsanzeige nur im Bearbeitungsmodus', () => {
    const renderer = new SpellEffectRenderer()
    const layer = new Container()
    const placed = effect('first', 20)
    const labels = (): string[] =>
      (layer.children[0]?.children ?? [])
        .map((child) => ('text' in child ? String(child.text) : ''))
        .filter(Boolean)

    renderer.render(layer, [placed], [], placed.id, 48, 100, 100)
    expect(labels()).not.toContain('BEARBEITEN')

    renderer.render(layer, [placed], [], placed.id, 48, 100, 100, null, placed.id)
    expect(labels()).toContain('BEARBEITEN')

    renderer.render(
      layer,
      [placed],
      [],
      placed.id,
      48,
      100,
      100,
      null,
      placed.id,
      placed.id,
      'move',
    )
    expect(labels()).toContain('↔ VERSCHIEBEN')
    renderer.clear()
  })
})
