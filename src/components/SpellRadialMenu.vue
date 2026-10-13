<script setup lang="ts">
import { spellAreaPresets } from '@/types/spells'

defineProps<{
  open: boolean
  tokenName: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  choose: [presetId: string]
  close: []
}>()
</script>

<template>
  <div
    v-if="open"
    class="spell-menu-backdrop"
    data-testid="spell-menu-backdrop"
    @pointerdown.self="emit('close')"
  >
    <section
      class="spell-radial-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      data-testid="spell-radial-menu"
      @pointerdown.stop
    >
      <header class="spell-menu-header">
        <div>
          <strong>Flächenform</strong>
          <small>{{ tokenName }}</small>
        </div>
        <button
          type="button"
          class="spell-menu-close"
          aria-label="Schließen"
          @click="emit('close')"
        >
          ×
        </button>
      </header>
      <div class="spell-menu-grid">
        <button
          v-for="preset in spellAreaPresets"
          :key="preset.id"
          type="button"
          class="spell-menu-option"
          :data-testid="`spell-preset-${preset.id}`"
          @click="emit('choose', preset.id)"
        >
          <span class="spell-menu-icon" :style="{ color: preset.color }">{{ preset.icon }}</span>
          <span>
            <strong>{{ preset.name }}</strong>
            <small>{{ preset.description }}</small>
          </span>
        </button>
      </div>
      <p class="spell-menu-hint">
        Form auswählen und auf der Karte absetzen. Danach direkt skalieren, drehen oder verschieben.
      </p>
    </section>
  </div>
</template>
