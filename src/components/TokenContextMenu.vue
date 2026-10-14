<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlacedToken } from '@/types/tokens'

const tokenColors = ['#3f8cff', '#dc4b4b', '#5fa857', '#f2b84b', '#a66cff', '#d2d7df']

const emit = defineEmits<{
  updateColor: [tokenId: string, color: string]
  updateVisionRange: [tokenId: string, visionRange: number]
  updateVisionEnabled: [tokenId: string, enabled: boolean]
  createSpell: [tokenId: string]
  deleteToken: [tokenId: string]
  close: []
}>()

const props = defineProps<{
  open: boolean
  token: PlacedToken | null
  x: number
  y: number
}>()

const confirmDelete = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) confirmDelete.value = false
  },
)

const updateVisionRange = (value: string): void => {
  if (!props.token) return
  const visionRange = Number(value)
  if (Number.isFinite(visionRange)) {
    emit('updateVisionRange', props.token.id, Math.max(0, visionRange))
  }
}

const deleteToken = (): void => {
  if (!props.token) return
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  emit('deleteToken', props.token.id)
  emit('close')
}
</script>

<template>
  <div
    v-if="open && token"
    class="token-context-backdrop"
    data-testid="token-context-backdrop"
    @pointerdown.self="emit('close')"
  >
    <section
      class="token-context-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      data-testid="token-context-menu"
      @pointerdown.stop
    >
      <header class="spell-menu-header">
        <div>
          <strong>Token: {{ token.name }}</strong>
          <small>Aktionen und Eigenschaften</small>
        </div>
        <button type="button" class="spell-menu-close" aria-label="Schließen" @click="emit('close')">
          ×
        </button>
      </header>

      <section class="token-context-section" aria-labelledby="token-context-color">
        <h3 id="token-context-color">Farbe</h3>
        <div class="token-color-swatches">
          <button
            v-for="color in tokenColors"
            :key="color"
            type="button"
            class="token-color-swatch"
            :class="{ active: token.color === color }"
            :style="{ backgroundColor: color }"
            :aria-label="`Farbe ${color}`"
            :aria-pressed="token.color === color"
            @click="emit('updateColor', token.id, color)"
          />
          <label class="token-context-color-picker">
            Eigene Farbe
            <input
              data-testid="token-context-color-input"
              type="color"
              :value="token.color"
              @input="emit('updateColor', token.id, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </section>

      <section class="token-context-section" aria-labelledby="token-context-vision">
        <h3 id="token-context-vision">Sichtweite</h3>
        <label class="token-context-vision-range">
          Rastereinheiten
          <input
            data-testid="token-context-vision-range"
            type="number"
            min="0"
            step="0.5"
            :value="token.visionRange"
            @change="updateVisionRange(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="inline-toggle">
          <input
            data-testid="token-context-vision-enabled"
            type="checkbox"
            :checked="token.visionEnabled"
            :disabled="token.visionRange <= 0"
            @change="emit('updateVisionEnabled', token.id, ($event.target as HTMLInputElement).checked)"
          />
          Sichtberechnung aktiv
        </label>
      </section>

      <button type="button" class="primary token-context-action" @click="emit('createSpell', token.id)">
        Zauberform erstellen
      </button>
      <button
        type="button"
        class="danger token-context-action"
        data-testid="token-context-delete"
        @click="deleteToken"
      >
        {{ confirmDelete ? 'Löschen bestätigen' : 'Token löschen' }}
      </button>
      <p v-if="confirmDelete" class="token-context-delete-hint">
        Erneut antippen, um „{{ token.name }}“ zu löschen.
      </p>
    </section>
  </div>
</template>
