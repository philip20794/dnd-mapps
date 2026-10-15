<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlacedToken, TokenPatch } from '@/types/tokens'
import { positionAnchoredMenu } from './menuPosition'

const tokenColors = ['#3f8cff', '#dc4b4b', '#5fa857', '#f2b84b', '#a66cff', '#d2d7df']

const emit = defineEmits<{
  updateColor: [tokenId: string, color: string]
  updateVisionRange: [tokenId: string, visionRange: number]
  updateVisionEnabled: [tokenId: string, enabled: boolean]
  updateToken: [tokenId: string, patch: TokenPatch]
  renameToken: [tokenId: string]
  duplicateToken: [tokenId: string]
  focusVisibility: [tokenId: string]
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
const propertiesOpen = ref(false)
const backdrop = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
const position = ref<{ left: number; top: number; maxHeight: number | null }>({
  left: props.x,
  top: props.y,
  maxHeight: null,
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resizeObserver?.disconnect()
      return
    }
    confirmDelete.value = false
    propertiesOpen.value = false
    void nextTick(observeMenu)
  },
)

const updatePosition = async (): Promise<void> => {
  if (!props.open || !props.token) return
  await nextTick()
  if (!backdrop.value || !menu.value) return
  const bounds = backdrop.value.getBoundingClientRect()
  const rect = menu.value.getBoundingClientRect()
  position.value = positionAnchoredMenu(
    { x: props.x, y: props.y },
    { width: bounds.width, height: bounds.height },
    { width: rect.width, height: rect.height },
  )
  await nextTick()
  const constrainedRect = menu.value.getBoundingClientRect()
  position.value = positionAnchoredMenu(
    { x: props.x, y: props.y },
    { width: bounds.width, height: bounds.height },
    { width: constrainedRect.width, height: constrainedRect.height },
  )
}

watch(
  () => [props.open, props.token?.id, props.x, props.y, propertiesOpen.value, confirmDelete.value],
  () => void updatePosition(),
)
const refreshPosition = (): void => void updatePosition()
const observeMenu = (): void => {
  resizeObserver?.disconnect()
  if (menu.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(refreshPosition)
    resizeObserver.observe(menu.value)
  }
}
onMounted(() => {
  window.addEventListener('resize', refreshPosition)
  window.visualViewport?.addEventListener('resize', refreshPosition)
  window.visualViewport?.addEventListener('scroll', refreshPosition)
  void nextTick(observeMenu)
  void updatePosition()
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', refreshPosition)
  window.visualViewport?.removeEventListener('resize', refreshPosition)
  window.visualViewport?.removeEventListener('scroll', refreshPosition)
})

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

const parseNullableNumber = (value: string): number | null => {
  if (value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const toggleVision = (): void => {
  if (!props.token) return
  if (props.token.visionRange <= 0) {
    propertiesOpen.value = true
    return
  }
  emit('updateVisionEnabled', props.token.id, !props.token.visionEnabled)
}

function focusVisibility(): void {
  if (!props.token || props.token.category !== 'player') return
  emit('focusVisibility', props.token.id)
  emit('close')
}
</script>

<template>
  <div
    v-if="open && token"
    ref="backdrop"
    class="token-context-backdrop"
    data-testid="token-context-backdrop"
    @pointerdown.self="emit('close')"
  >
    <section
      class="token-context-menu"
      :style="{
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: position.maxHeight === null ? undefined : `${position.maxHeight}px`,
      }"
      data-testid="token-context-menu"
      ref="menu"
      @pointerdown.stop
    >
      <header class="spell-menu-header">
        <div>
          <strong>Token: {{ token.name }}</strong>
          <small>Aktionen und Eigenschaften</small>
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

      <section v-if="!propertiesOpen" class="token-quick-actions" aria-label="Token-Aktionen">
        <button
          type="button"
          class="token-quick-action"
          data-testid="token-context-rename"
          @click="emit('renameToken', token.id)"
        >
          <span aria-hidden="true">✎</span
          ><span><strong>Umbenennen</strong><small>Name ändern</small></span>
        </button>
        <button
          type="button"
          class="token-quick-action"
          data-testid="token-context-duplicate"
          @click="emit('duplicateToken', token.id)"
        >
          <span aria-hidden="true">⧉</span
          ><span><strong>Duplizieren</strong><small>Kopie platzieren</small></span>
        </button>
        <button
          type="button"
          class="token-quick-action"
          data-testid="token-context-vision-toggle"
          @click="toggleVision"
        >
          <span aria-hidden="true">◉</span>
          <span
            ><strong>{{
              token.visionRange > 0
                ? token.visionEnabled
                  ? 'Sicht aus'
                  : 'Sicht an'
                : 'Sicht einstellen'
            }}</strong
            ><small>{{
              token.visionRange > 0 ? `${token.visionRange} Rastereinheiten` : 'Keine Sichtweite'
            }}</small></span
          >
        </button>
        <button
          type="button"
          class="token-quick-action"
          data-testid="token-context-properties"
          @click="propertiesOpen = true"
        >
          <span aria-hidden="true">⚙</span
          ><span><strong>Eigenschaften</strong><small>Größe, Farbe und mehr</small></span>
        </button>
        <button
          v-if="token.category === 'player'"
          type="button"
          class="token-quick-action primary"
          data-testid="token-context-focus-visibility"
          @click="focusVisibility"
        >
          <span aria-hidden="true">◎</span>
          <span><strong>Nur diese Sicht</strong><small>Fog auf Spieler begrenzen</small></span>
        </button>
        <button
          type="button"
          class="token-quick-action primary"
          data-testid="token-context-create-spell"
          @click="emit('createSpell', token.id)"
        >
          <span aria-hidden="true">✦</span
          ><span><strong>Zauberform</strong><small>Fläche erstellen</small></span>
        </button>
        <button
          type="button"
          class="token-quick-action danger"
          data-testid="token-context-delete"
          @click="deleteToken"
        >
          <span aria-hidden="true">⌫</span
          ><span
            ><strong>{{ confirmDelete ? 'Löschen bestätigen' : 'Token löschen' }}</strong
            ><small>{{
              confirmDelete ? 'Erneut antippen' : 'Nicht rückgängig machbar'
            }}</small></span
          >
        </button>
      </section>

      <section v-else class="token-context-properties" aria-label="Token-Eigenschaften">
        <button
          type="button"
          class="menu-back-button"
          data-testid="token-context-properties-back"
          @click="propertiesOpen = false"
        >
          ← Aktionen
        </button>
        <label
          >Name<input
            data-testid="token-context-name-input"
            :value="token.name"
            @change="
              emit('updateToken', token.id, { name: ($event.target as HTMLInputElement).value })
            "
        /></label>
        <label
          >Größe<input
            data-testid="token-context-size-input"
            type="number"
            min="0.25"
            step="0.25"
            :value="token.size"
            @change="
              emit('updateToken', token.id, {
                size: Number(($event.target as HTMLInputElement).value),
              })
            "
        /></label>
        <label
          >Rotation<input
            data-testid="token-context-rotation-input"
            type="number"
            step="5"
            :value="token.rotation"
            @change="
              emit('updateToken', token.id, {
                rotation: Number(($event.target as HTMLInputElement).value),
              })
            "
        /></label>
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
            <label class="token-context-color-picker"
              >Eigene Farbe<input
                data-testid="token-context-color-input"
                type="color"
                :value="token.color"
                @input="emit('updateColor', token.id, ($event.target as HTMLInputElement).value)"
            /></label>
          </div>
        </section>
        <section class="token-context-section" aria-labelledby="token-context-vision">
          <h3 id="token-context-vision">Sicht</h3>
          <label class="token-context-vision-range"
            >Rastereinheiten<input
              data-testid="token-context-vision-range"
              type="number"
              min="0"
              step="0.5"
              :value="token.visionRange"
              @change="updateVisionRange(($event.target as HTMLInputElement).value)"
          /></label>
          <label
            >Sichtwinkel<input
              data-testid="token-context-vision-angle"
              type="number"
              min="1"
              max="360"
              step="5"
              :value="token.visionAngle ?? ''"
              placeholder="360"
              @change="
                emit('updateToken', token.id, {
                  visionAngle: parseNullableNumber(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label class="inline-toggle"
            ><input
              data-testid="token-context-vision-enabled"
              type="checkbox"
              :checked="token.visionEnabled"
              :disabled="token.visionRange <= 0"
              @change="
                emit('updateVisionEnabled', token.id, ($event.target as HTMLInputElement).checked)
              "
            />Sichtberechnung aktiv</label
          >
        </section>
      </section>

      <p v-if="confirmDelete" class="token-context-delete-hint">
        Erneut antippen, um „{{ token.name }}“ zu löschen.
      </p>
    </section>
  </div>
</template>
