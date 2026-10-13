<script setup lang="ts">
import type { PlacedSpellEffect } from '@/types/spells'
import { spellShapeLabel } from '@/types/spells'

defineProps<{
  effects: readonly PlacedSpellEffect[]
  selectedEffect: PlacedSpellEffect | null
}>()

const emit = defineEmits<{
  selectEffect: [effectId: string]
  deleteEffect: [effectId: string]
}>()
</script>

<template>
  <section>
    <h2 class="panel-title">Flächenformen</h2>
    <p v-if="effects.length === 0" class="empty-state">
      Figur gedrückt halten und eine Grundform auswählen.
    </p>
    <div v-else class="spell-effect-list" data-testid="spell-effect-list">
      <button
        v-for="effect in effects"
        :key="effect.id"
        type="button"
        class="spell-effect-list-item"
        :class="{ active: effect.id === selectedEffect?.id }"
        @click="emit('selectEffect', effect.id)"
      >
        <span class="spell-effect-dot" :style="{ backgroundColor: effect.color }" />
        <span>
          <strong>{{ effect.name }}</strong>
          <small>{{ spellShapeLabel(effect.shape) }}</small>
        </span>
      </button>
    </div>

    <div v-if="selectedEffect" class="spell-effect-help" data-testid="spell-effect-editor">
      <p><span class="handle-key resize" /> Blau ziehen: größer oder kleiner</p>
      <p><span class="handle-key rotate" /> Gelb ziehen: frei drehen</p>
      <p>Fläche gedrückt halten: frei verschieben</p>
      <button type="button" class="danger" @click="emit('deleteEffect', selectedEffect.id)">
        Fläche entfernen
      </button>
    </div>
  </section>
</template>
