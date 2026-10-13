import { describe, expect, it } from 'vitest'
import {
  effectLocalToWorld,
  pointIsInsideSpellEffect,
  spellEffectLocalHandles,
  worldPointToEffectLocal,
} from './geometry'
import type { PlacedSpellEffect } from '@/types/spells'
import { spellEffectSizeLabel } from '@/types/spells'

const effect = (
  shape: PlacedSpellEffect['shape'],
  overrides: Partial<PlacedSpellEffect> = {},
): PlacedSpellEffect => ({
  id: 'effect-1',
  mapId: 'map-1',
  casterTokenId: 'token-1',
  presetId: 'test',
  name: 'Test',
  shape,
  position: { x: 0, y: 0 },
  rotation: 0,
  size: 4,
  width: 1,
  duration: 'instant',
  color: '#ff0000',
  attachedToCaster: false,
  ...overrides,
})

describe('Zauberflächen-Geometrie', () => {
  it('erkennt Punkte in einer Sphäre', () => {
    expect(pointIsInsideSpellEffect({ x: 3, y: 0 }, effect('sphere'))).toBe(true)
    expect(pointIsInsideSpellEffect({ x: 5, y: 0 }, effect('sphere'))).toBe(false)
  })

  it('berücksichtigt die Rotation einer Linie', () => {
    const line = effect('line', { rotation: 90 })
    expect(pointIsInsideSpellEffect({ x: 0, y: 3 }, line)).toBe(true)
    expect(pointIsInsideSpellEffect({ x: 3, y: 0 }, line)).toBe(false)
  })

  it('verbreitert einen Kegel mit der Entfernung', () => {
    expect(pointIsInsideSpellEffect({ x: 3, y: 1.4 }, effect('cone'))).toBe(true)
    expect(pointIsInsideSpellEffect({ x: 1, y: 1 }, effect('cone'))).toBe(false)
  })

  it('setzt den Skaliergriff eines Quadrats an die Ecke', () => {
    expect(spellEffectLocalHandles(effect('cube')).resize).toEqual({ x: 2, y: 2 })
  })

  it('dreht Griffpunkte korrekt zwischen lokalen und Weltkoordinaten', () => {
    const rotated = effect('line', { position: { x: 4, y: 5 }, rotation: 90 })
    const world = effectLocalToWorld({ x: 3, y: 0 }, rotated)

    expect(world.x).toBeCloseTo(4)
    expect(world.y).toBeCloseTo(8)
    expect(worldPointToEffectLocal(world, rotated).x).toBeCloseTo(3)
    expect(worldPointToEffectLocal(world, rotated).y).toBeCloseTo(0)
  })
})

describe('spell effect labels', () => {
  it('shows the current dimensions in feet', () => {
    expect(spellEffectSizeLabel(effect('sphere', { name: 'Kreis', size: 3 }))).toBe('15 ft Kreis')
    expect(spellEffectSizeLabel(effect('cone', { name: 'Kegel', size: 4, width: 1 }))).toBe(
      '20 × 20 ft Kegel',
    )
    expect(
      spellEffectSizeLabel(effect('line', { name: 'Linie', size: 4, width: 1.5 })),
    ).toBe('20 × 7.5 ft Linie')
  })
})
