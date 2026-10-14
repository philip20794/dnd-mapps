<script setup lang="ts">
import type { PlacedToken } from '@/types/tokens'

defineProps<{
  token: PlacedToken | null
}>()

const emit = defineEmits<{
  updateName: [value: string]
  updateSize: [value: number]
  updateRotation: [value: number]
  updateVisionRange: [value: number]
  updateVisionAngle: [value: number | null]
  updateVisionEnabled: [value: boolean]
  updateColor: [value: string]
  deleteToken: []
}>()

const parseNullableNumber = (value: string): number | null => {
  if (value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
</script>

<template>
  <section>
    <h2 class="panel-title">Token-Eigenschaften</h2>
    <p v-if="!token" class="empty-state">Kein Token ausgewählt.</p>
    <div v-else class="form-grid" data-testid="token-properties">
      <label>
        Name
        <input
          data-testid="token-name-input"
          :value="token.name"
          @input="emit('updateName', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        Größe
        <input
          type="number"
          min="0.25"
          step="0.25"
          :value="token.size"
          @input="emit('updateSize', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        Rotation
        <input
          type="number"
          step="5"
          :value="token.rotation"
          @input="emit('updateRotation', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        Farbe
        <input
          type="color"
          data-testid="token-color-input"
          :value="token.color"
          @input="emit('updateColor', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        Sichtweite
        <input
          type="number"
          min="0"
          step="0.5"
          :value="token.visionRange"
          @input="emit('updateVisionRange', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        Sichtwinkel
        <input
          type="number"
          min="1"
          max="360"
          step="5"
          :value="token.visionAngle ?? ''"
          placeholder="360"
          @input="
            emit(
              'updateVisionAngle',
              parseNullableNumber(($event.target as HTMLInputElement).value),
            )
          "
        />
      </label>
      <label class="inline-toggle">
        <input
          type="checkbox"
          :checked="token.visionEnabled"
          @change="emit('updateVisionEnabled', ($event.target as HTMLInputElement).checked)"
        />
        Sichtberechnung aktiv
      </label>
      <button
        type="button"
        class="danger"
        data-testid="delete-token-button"
        @click="emit('deleteToken')"
      >
        Token löschen
      </button>
    </div>
  </section>
</template>
