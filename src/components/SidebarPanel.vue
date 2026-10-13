<script setup lang="ts">
import TokenProperties from './TokenProperties.vue'
import SpellEffectPanel from './SpellEffectPanel.vue'
import type { PlacedSpellEffect } from '@/types/spells'
import type { PlacedToken, TokenTemplate } from '@/types/tokens'

defineProps<{
  collapsed: boolean
  tokenTemplates: readonly TokenTemplate[]
  selectedToken: PlacedToken | null
  spellEffects: readonly PlacedSpellEffect[]
  selectedSpellEffect: PlacedSpellEffect | null
}>()

const emit = defineEmits<{
  updateTokenName: [value: string]
  updateTokenSize: [value: number]
  updateTokenRotation: [value: number]
  updateTokenVisionRange: [value: number]
  updateTokenVisionAngle: [value: number | null]
  updateTokenVisionEnabled: [value: boolean]
  deleteToken: []
  selectSpellEffect: [effectId: string]
  deleteSpellEffect: [effectId: string]
}>()

const handleDragStart = (event: DragEvent, kind: string): void => {
  event.dataTransfer?.setData('application/x-token-kind', kind)
  event.dataTransfer?.setData('text/plain', kind)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }" data-testid="sidebar">
    <div v-if="!collapsed" class="sidebar-content">
      <section>
        <h2 class="panel-title">Token-Bibliothek</h2>
        <div class="token-library" data-testid="token-library">
          <div
            v-for="template in tokenTemplates"
            :key="template.kind"
            class="token-template"
            draggable="true"
            :data-testid="`token-template-${template.kind}`"
            @dragstart="handleDragStart($event, template.kind)"
          >
            <span class="token-chip" :style="{ backgroundColor: template.color }">{{
              template.symbol
            }}</span>
            <span>{{ template.name }}</span>
          </div>
        </div>
      </section>

      <TokenProperties
        :token="selectedToken"
        @update-name="emit('updateTokenName', $event)"
        @update-size="emit('updateTokenSize', $event)"
        @update-rotation="emit('updateTokenRotation', $event)"
        @update-vision-range="emit('updateTokenVisionRange', $event)"
        @update-vision-angle="emit('updateTokenVisionAngle', $event)"
        @update-vision-enabled="emit('updateTokenVisionEnabled', $event)"
        @delete-token="emit('deleteToken')"
      />

      <SpellEffectPanel
        :effects="spellEffects"
        :selected-effect="selectedSpellEffect"
        @select-effect="emit('selectSpellEffect', $event)"
        @delete-effect="emit('deleteSpellEffect', $event)"
      />
    </div>
  </aside>
</template>
