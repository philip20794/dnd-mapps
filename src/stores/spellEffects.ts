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
      const effect: PlacedSpellEffect = {
        id: createEffectId(this.nextEffectNumber),
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
      this.nextEffectNumber += 1
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
      this.effects = this.effects.filter((effect) => effect.casterTokenId !== tokenId)
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
      this.effects = [...effects]
      this.selectedEffectId = null
      this.nextEffectNumber = Math.max(1, effects.length + 1)
    },
    resetAll(): void {
      this.effects = []
      this.selectedEffectId = null
      this.nextEffectNumber = 1
    },
  },
})
