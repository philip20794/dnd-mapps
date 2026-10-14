import { defineStore } from 'pinia'
import type { GridPoint } from '@/types/geometry'
import type { PlacedToken } from '@/types/tokens'
import {
  FEET_PER_GRID_UNIT,
  type PlacedSpellEffect,
  type SpellAreaPreset,
  type SpellEffectPatch,
} from '@/types/spells'

interface SpellEffectState {
  effects: PlacedSpellEffect[]
  selectedEffectId: string | null
  nextEffectNumber: number
}

const createEffectId = (number: number): string => `spell-effect-${number.toString(36)}`

const effectNumber = (id: string): number | null => {
  const match = /^spell-effect-([0-9a-z]+)$/i.exec(id)
  if (!match) return null

  const parsed = Number.parseInt(match[1]!, 36)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const nextEffectNumberFor = (effects: readonly PlacedSpellEffect[]): number =>
  effects.reduce((nextNumber, effect) => Math.max(nextNumber, (effectNumber(effect.id) ?? 0) + 1), 1)

const nextUniqueEffect = (
  effects: readonly PlacedSpellEffect[],
  requestedNumber: number,
): { id: string; nextNumber: number } => {
  const existingIds = new Set(effects.map((effect) => effect.id))
  let number = Math.max(1, requestedNumber)
  let id = createEffectId(number)

  while (existingIds.has(id)) {
    number += 1
    id = createEffectId(number)
  }

  return { id, nextNumber: number + 1 }
}

export const useSpellEffectStore = defineStore('spellEffects', {
  state: (): SpellEffectState => ({
    effects: [],
    selectedEffectId: null,
    nextEffectNumber: 1,
  }),
  getters: {
    selectedEffect: (state): PlacedSpellEffect | null =>
      state.effects.find((effect) => effect.id === state.selectedEffectId) ?? null,
    effectsForMap:
      (state) =>
      (mapId: string): readonly PlacedSpellEffect[] =>
        state.effects.filter((effect) => effect.mapId === mapId),
  },
  actions: {
    addFromPreset(
      preset: SpellAreaPreset,
      caster: PlacedToken,
      target: GridPoint,
      levelId?: string,
    ): PlacedSpellEffect {
      const startsAtCaster = preset.origin === 'caster'
      const identity = nextUniqueEffect(this.effects, this.nextEffectNumber)
      const effect: PlacedSpellEffect = {
        id: identity.id,
        mapId: caster.mapId,
        levelId,
        casterTokenId: caster.id,
        presetId: preset.id,
        name: preset.name,
        shape: preset.shape,
        position: startsAtCaster ? caster.position : target,
        rotation: 0,
        size: preset.sizeFeet / FEET_PER_GRID_UNIT,
        width: (preset.widthFeet ?? FEET_PER_GRID_UNIT) / FEET_PER_GRID_UNIT,
        heightFeet: preset.heightFeet,
        duration: preset.duration,
        color: preset.color,
        attachedToCaster: preset.origin === 'caster' && preset.shape === 'emanation',
      }
      this.nextEffectNumber = identity.nextNumber
      this.effects.push(effect)
      this.selectedEffectId = effect.id
      return effect
    },
    addFreeFromPreset(
      preset: SpellAreaPreset,
      mapId: string,
      target: GridPoint,
      levelId?: string,
    ): PlacedSpellEffect {
      const identity = nextUniqueEffect(this.effects, this.nextEffectNumber)
      const effect: PlacedSpellEffect = {
        id: identity.id,
        mapId,
        levelId,
        presetId: preset.id,
        name: preset.name,
        shape: preset.shape,
        position: target,
        rotation: 0,
        size: preset.sizeFeet / FEET_PER_GRID_UNIT,
        width: (preset.widthFeet ?? FEET_PER_GRID_UNIT) / FEET_PER_GRID_UNIT,
        heightFeet: preset.heightFeet,
        duration: preset.duration,
        color: preset.color,
        attachedToCaster: false,
      }
      this.nextEffectNumber = identity.nextNumber
      this.effects.push(effect)
      this.selectedEffectId = effect.id
      return effect
    },
    setSelectedEffect(effectId: string | null): void {
      this.selectedEffectId = effectId
    },
    updateEffect(effectId: string, patch: SpellEffectPatch): void {
      this.effects = this.effects.map((effect) =>
        effect.id === effectId ? { ...effect, ...patch } : effect,
      )
    },
    deleteEffect(effectId: string): void {
      this.effects = this.effects.filter((effect) => effect.id !== effectId)
      if (this.selectedEffectId === effectId) {
        this.selectedEffectId = null
      }
    },
    deleteEffectsForCaster(tokenId: string): void {
      this.effects = this.effects.filter(
        (effect) => effect.casterTokenId !== tokenId || !effect.attachedToCaster,
      )
      if (!this.effects.some((effect) => effect.id === this.selectedEffectId)) {
        this.selectedEffectId = null
      }
    },
    resetMapEffects(mapId: string): void {
      this.effects = this.effects.filter((effect) => effect.mapId !== mapId)
      if (!this.effects.some((effect) => effect.id === this.selectedEffectId)) {
        this.selectedEffectId = null
      }
    },
    replaceEffects(effects: readonly PlacedSpellEffect[]): void {
      this.effects = effects.map((effect) => ({
        ...effect,
        attachedToCaster: Boolean(effect.casterTokenId) && effect.attachedToCaster,
      }))
      this.selectedEffectId = null
      this.nextEffectNumber = nextEffectNumberFor(this.effects)
    },
    resetAll(): void {
      this.effects = []
      this.selectedEffectId = null
      this.nextEffectNumber = 1
    },
  },
})
