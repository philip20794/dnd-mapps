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

  it('entfernt nur tatsächlich an eine gelöschte Figur gebundene Zauber', () => {
    const store = useSpellEffectStore()
    const attachedPreset = findSpellAreaPreset('shape-aura')!
    const detachedPreset = findSpellAreaPreset('shape-circle')!
    const attached = {
      ...store.addFromPreset(attachedPreset, caster, { x: 7, y: 7 }, 'ground'),
      attachedToCaster: true,
    }
    const detached = store.addFromPreset(detachedPreset, caster, { x: 8, y: 8 }, 'ground')
    store.replaceEffects([attached, detached])
    store.setSelectedEffect(detached.id)

    store.deleteEffectsForCaster(caster.id)

    expect(attached.attachedToCaster).toBe(true)
    expect(store.effects).toEqual([detached])
    expect(store.selectedEffectId).toBe(detached.id)
  })

  it('erstellt eine freie Form ohne Dummy-Caster und behält sie beim Löschen eines Tokens', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-wall')!

    const placed = store.addFreeFromPreset(preset, caster.mapId, { x: 3, y: 6 }, 'ground')
    store.deleteEffectsForCaster(caster.id)

    expect(placed).not.toHaveProperty('casterTokenId')
    expect(placed.attachedToCaster).toBe(false)
    expect(placed.position).toEqual({ x: 3, y: 6 })
    expect(store.effects).toEqual([placed])
  })

  it('lädt bestehende castergebundene Effekte unverändert', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-circle')!
    const existing = store.addFromPreset(preset, caster, { x: 8, y: 9 }, 'ground')

    store.replaceEffects([existing])

    expect(store.effects[0]?.casterTokenId).toBe(caster.id)
  })

  it('vergibt nach einem Restore keine bereits vorhandene Effect-ID erneut', () => {
    const store = useSpellEffectStore()
    const preset = findSpellAreaPreset('shape-circle')!
    const restored = {
      ...store.addFreeFromPreset(preset, caster.mapId, { x: 2, y: 2 }, 'ground'),
      id: 'spell-effect-z',
    }

    store.replaceEffects([restored])
    const placed = store.addFreeFromPreset(preset, caster.mapId, { x: 3, y: 3 }, 'ground')

    expect(placed.id).toBe('spell-effect-10')
    expect(new Set(store.effects.map((effect) => effect.id)).size).toBe(2)
  })
})
