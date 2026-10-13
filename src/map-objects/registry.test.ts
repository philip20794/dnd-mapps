import { describe, expect, it } from 'vitest'
import {
  createDefaultObjectRegistry,
  resolveMapObject,
  serializeMapObject,
  validateMapObject,
} from '.'

describe('Map Object Library', () => {
  it('registriert wiederverwendbare Objekttypen zentral', () => {
    const registry = createDefaultObjectRegistry()
    expect(registry.has('ground-area')).toBe(true)
    expect(registry.has('torch')).toBe(true)
    expect(registry.has('river')).toBe(true)
    expect(registry.has('tree')).toBe(true)
    expect(registry.has('bush')).toBe(true)
    expect(registry.has('thicket')).toBe(true)
    expect(registry.has('bridge')).toBe(true)
    expect(registry.has('hill-slope')).toBe(true)
    expect(registry.has('wooden-barricade')).toBe(true)
    expect(registry.has('wagon')).toBe(true)
    expect(registry.has('draft-animal')).toBe(true)
    expect(registry.has('daylight-area')).toBe(true)
    expect(registry.has('candle')).toBe(true)
    expect(registry.has('wooden-door')).toBe(true)
    expect(registry.has('cargo-crane')).toBe(true)
    expect(registry.has('dungeon-prop')).toBe(true)
  })

  it('laedt wiederverwendbare Boden-Presets', () => {
    const registry = createDefaultObjectRegistry()
    expect(registry.requirePreset('ground-area', 'meadow').defaults.variant).toBe('grass')
    expect(registry.requirePreset('ground-area', 'wood-planks').defaults.variant).toBe('wood')
    expect(registry.requirePreset('ground-area', 'muddy-ruts').defaults.variant).toBe('path')
    expect(registry.requirePreset('ground-area', 'field-stubble').defaults.variant).toBe('grass')
  })

  it('laedt Natur- und Bruecken-Presets', () => {
    const registry = createDefaultObjectRegistry()
    expect(registry.requirePreset('tree', 'pine-tree').defaults.variant).toBe('pine-tree')
    expect(registry.requirePreset('tree', 'birch-tree').defaults.variant).toBe('birch-tree')
    expect(registry.requirePreset('tree', 'autumn-maple').defaults.variant).toBe('autumn-maple')
    expect(registry.requirePreset('bush', 'thorn-bush').defaults.variant).toBe('thorn-bush')
    expect(registry.requirePreset('thicket', 'dry-scrub').defaults.variant).toBe('dry-scrub')
    expect(registry.requirePreset('bridge', 'old-forest-bridge').defaults.color).toBe(0x73563a)
    expect(registry.requirePreset('hill-slope', 'grassy-north-rise').defaults.variant).toBe(
      'rise-north',
    )
    expect(registry.requirePreset('wooden-barricade', 'rough-road-barricade').defaults.width).toBe(
      1.15,
    )
    expect(registry.requirePreset('wagon', 'loaded-farm-wagon-west').defaults.variant).toBe(
      'hitch-west',
    )
    expect(registry.requirePreset('draft-animal', 'brown-draft-ox-east').defaults.variant).toBe(
      'facing-east',
    )
    expect(registry.requirePreset('daylight-area', 'forest-daylight').defaults.alpha).toBe(0.08)
    expect(registry.requirePreset('rock', 'mossy-boulder').defaults.width).toBe(1.25)
    expect(registry.requirePreset('rock', 'rubble-pile').defaults.blocksMovement).toBe(false)
    expect(registry.requirePreset('wooden-barricade', 'thorn-deadfall').defaults.width).toBe(3.2)
    expect(registry.requirePreset('decoration', 'road-sign').defaults.variant).toBe('road-sign')
    expect(registry.requirePreset('cargo-crane', 'wooden-cargo-crane').defaults.width).toBe(6)
    expect(registry.requirePreset('dungeon-prop', 'frog-idol').defaults.variant).toBe('frog-idol')
  })

  it('ueberschreibt einzelne Boden-Preset-Eigenschaften', () => {
    const registry = createDefaultObjectRegistry()
    const object = resolveMapObject(
      {
        id: 'meadow-a',
        type: 'ground-area',
        preset: 'meadow',
        position: { x: 2, y: 3 },
        width: 4,
        height: 2,
        color: 0x225522,
      },
      registry,
      0,
    )
    expect(object.variant).toBe('grass')
    expect(object.color).toBe(0x225522)
    expect(object.width).toBe(4)
  })

  it('validiert unbekannte Bodenvarianten', () => {
    const registry = createDefaultObjectRegistry()
    expect(
      validateMapObject(
        {
          id: 'bad-ground',
          type: 'ground-area',
          position: { x: 0, y: 0 },
          variant: 'moon-cheese',
        },
        registry,
      )[0],
    ).toContain('Unbekannte Bodenvariante')
  })

  it('lädt ein Objekt-Preset typisiert', () => {
    const registry = createDefaultObjectRegistry()
    const preset = registry.requirePreset('torch', 'small-wall-torch')
    expect(preset.defaults.light?.range).toBe(4.5)
    expect(registry.requirePreset('torch', 'green-witchlight').defaults.light?.color).toBe(0xa7f783)
    expect(registry.requirePreset('hearth', 'standing-brazier').defaults.light?.range).toBe(6.4)
    expect(registry.requirePreset('candle', 'altar-candle').defaults.light?.range).toBe(2.5)
  })

  it('überschreibt einzelne Preset-Eigenschaften', () => {
    const registry = createDefaultObjectRegistry()
    const object = resolveMapObject(
      {
        id: 'torch-a',
        type: 'torch',
        preset: 'small-wall-torch',
        position: { x: 1, y: 2 },
        light: { color: 0x7dd3fc, range: 9, intensity: 2 },
      },
      registry,
      0,
    )
    expect(object.width).toBe(0.45)
    expect(object.light?.range).toBe(9)
  })

  it('validiert unbekannte Objekttypen', () => {
    const registry = createDefaultObjectRegistry()
    expect(validateMapObject({ type: 'missing', position: { x: 0, y: 0 } }, registry)[0]).toContain(
      'Unbekannter Objekttyp',
    )
  })

  it('serialisiert Kartenobjekte ohne Runtime-Daten', () => {
    const registry = createDefaultObjectRegistry()
    const object = resolveMapObject(
      { id: 'crate-a', type: 'crate', preset: 'small-crate', position: { x: 3, y: 4 } },
      registry,
      0,
    )
    expect(serializeMapObject(object, registry)).toMatchObject({
      id: 'crate-a',
      type: 'crate',
      position: { x: 3, y: 4 },
    })
  })
})
