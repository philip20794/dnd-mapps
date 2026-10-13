import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { findSpellAreaPreset } from '@/types/spells'
import type { PlacedToken } from '@/types/tokens'
import { useSpellEffectStore } from './spellEffects'

const caster: PlacedToken = {
  id: 'hero-1',
  mapId: 'map-1',
  levelId: 'ground',
  name: 'Mira',
  position: { x: 4, y: 5 },
  size: 1,
  rotation: 0,
  visionRange: 8,
  visionAngle: null,
  visionEnabled: true,
  category: 'player',
  color: '#3f8cff',
  symbol: 'M',
}

describe('Zauberflächen-Store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('erstellt eine frei platzierte Kreisform', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-circle')
    expect(preset).toBeDefined()

    const placed = store.addFromPreset(preset!, caster, { x: 8, y: 9 }, 'ground')

    expect(placed.position).toEqual({ x: 8, y: 9 })
    expect(placed.size).toBe(3)
    expect(placed.casterTokenId).toBe(caster.id)
  })

  it('lässt auch eine Aura frei auf der Karte platzieren', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-aura')
    expect(preset).toBeDefined()

    const placed = store.addFromPreset(preset!, caster, { x: 20, y: 20 }, 'ground')

    expect(placed.attachedToCaster).toBe(false)
    expect(placed.position).toEqual({ x: 20, y: 20 })
  })

  it('entfernt die Zauber einer gelöschten Figur', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-circle')!
    store.addFromPreset(preset, caster, { x: 7, y: 7 }, 'ground')

    store.deleteEffectsForCaster(caster.id)

    expect(store.effects).toHaveLength(0)
    expect(store.selectedEffectId).toBeNull()
  })
})
