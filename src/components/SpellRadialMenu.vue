<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { spellAreaPresets } from '@/types/spells'
import { tokenSizeOptions, type QuickTokenCategory, type TokenSizeId } from '@/types/tokens'
import { positionAnchoredMenu } from './menuPosition'

const emit = defineEmits<{
  choose: [presetId: string]
  createQuickToken: [creation: { category: QuickTokenCategory; size: number; color: string }]
  close: []
}>()

const props = defineProps<{
  open: boolean
  contextLabel: string
  tokenCreationEnabled: boolean
  x: number
  y: number
}>()

type CreationView = 'quick' | 'spells' | 'tokens'

const activeView = ref<CreationView>(props.tokenCreationEnabled ? 'quick' : 'spells')
const selectedTokenCategory = ref<QuickTokenCategory | null>(null)
const selectedMonsterSize = ref<TokenSizeId>('medium')
const playerColor = ref('#3f8cff')
const monsterColor = ref('#dc4b4b')
const backdrop = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
const position = ref<{ left: number; top: number; maxHeight: number | null }>({
  left: props.x,
  top: props.y,
  maxHeight: null,
})
const selectedSize = computed(
  () => tokenSizeOptions.find((option) => option.id === selectedMonsterSize.value)?.size ?? 1,
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resizeObserver?.disconnect()
      return
    }
    activeView.value = props.tokenCreationEnabled ? 'quick' : 'spells'
    selectedTokenCategory.value = null
    selectedMonsterSize.value = 'medium'
    playerColor.value = '#3f8cff'
    monsterColor.value = '#dc4b4b'
    void nextTick(observeMenu)
  },
)

const updatePosition = async (): Promise<void> => {
  if (!props.open) return
  await nextTick()
  if (!backdrop.value || !menu.value) return
  const bounds = backdrop.value.getBoundingClientRect()
  const rect = menu.value.getBoundingClientRect()
  position.value = positionAnchoredMenu(
    { x: props.x, y: props.y },
    { width: bounds.width, height: bounds.height },
    { width: rect.width, height: rect.height },
  )
  // A newly constrained max-height changes the measured box. Place it once more with
  // that real height so the upper edge is never clipped.
  await nextTick()
  const constrainedRect = menu.value.getBoundingClientRect()
  position.value = positionAnchoredMenu(
    { x: props.x, y: props.y },
    { width: bounds.width, height: bounds.height },
    { width: constrainedRect.width, height: constrainedRect.height },
  )
}

watch(
  () => [props.open, props.x, props.y, activeView.value, selectedTokenCategory.value],
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

const selectTokenCategory = (category: QuickTokenCategory): void => {
  selectedTokenCategory.value = category
}

const createQuickToken = (): void => {
  const category = selectedTokenCategory.value
  if (!category) return
  emit('createQuickToken', {
    category,
    size: category === 'player' ? 1 : selectedSize.value,
    color: category === 'player' ? playerColor.value : monsterColor.value,
  })
}
</script>

<template>
  <div
    v-if="open"
    ref="backdrop"
    class="spell-menu-backdrop"
    data-testid="spell-menu-backdrop"
    @pointerdown.self="emit('close')"
  >
    <section
      class="spell-radial-menu"
      :style="{
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: position.maxHeight === null ? undefined : `${position.maxHeight}px`,
      }"
      data-testid="spell-radial-menu"
      ref="menu"
      @pointerdown.stop
    >
      <header class="spell-menu-header">
        <div>
          <strong>
            {{
              activeView === 'quick'
                ? 'Erstellen'
                : activeView === 'spells'
                  ? 'Zauberform erstellen'
                  : 'Token erstellen'
            }}
          </strong>
          <small>{{ contextLabel }}</small>
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
      <section v-if="activeView === 'quick'" class="menu-quick-actions" aria-label="Erstellen">
        <button
          type="button"
          class="menu-quick-action primary"
          data-testid="creation-category-spells"
          @click="activeView = 'spells'"
        >
          <span aria-hidden="true">✦</span>
          <span
            ><strong>Zauberform erstellen</strong><small>Kreis, Kegel, Linie und mehr</small></span
          >
        </button>
        <button
          type="button"
          class="menu-quick-action"
          data-testid="creation-category-tokens"
          @click="activeView = 'tokens'"
        >
          <span aria-hidden="true">●</span>
          <span><strong>Token erstellen</strong><small>Spieler oder Gegner</small></span>
        </button>
      </section>
      <button
        v-else-if="tokenCreationEnabled"
        type="button"
        class="menu-back-button"
        data-testid="creation-menu-back"
        @click="activeView = 'quick'"
      >
        ← Auswahl
      </button>
      <section
        v-if="activeView === 'spells'"
        class="spell-menu-category"
        aria-labelledby="spell-shapes-heading"
      >
        <h3 id="spell-shapes-heading">Zauberformen</h3>
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
      </section>
      <section
        v-else-if="activeView === 'tokens'"
        class="spell-menu-category"
        aria-labelledby="token-creation-heading"
      >
        <h3 id="token-creation-heading">Token</h3>
        <div class="token-creation-options">
          <button
            type="button"
            class="spell-menu-option"
            :class="{ active: selectedTokenCategory === 'player' }"
            data-testid="quick-token-player"
            @click="selectTokenCategory('player')"
          >
            <span class="spell-menu-icon token-player-icon">P</span>
            <span><strong>Spieler</strong><small>Medium · Sichtweite 8</small></span>
          </button>
          <button
            type="button"
            class="spell-menu-option"
            :class="{ active: selectedTokenCategory === 'monster' }"
            data-testid="quick-token-monster"
            @click="selectTokenCategory('monster')"
          >
            <span class="spell-menu-icon token-monster-icon">G</span>
            <span><strong>Gegner</strong><small>Ohne Sicht</small></span>
          </button>
        </div>
        <template v-if="selectedTokenCategory">
          <label class="token-creation-color">
            Farbe
            <input
              v-if="selectedTokenCategory === 'player'"
              v-model="playerColor"
              data-testid="quick-token-player-color"
              type="color"
            />
            <input
              v-else
              v-model="monsterColor"
              data-testid="quick-token-monster-color"
              type="color"
            />
          </label>
          <div v-if="selectedTokenCategory === 'monster'" class="token-size-options">
            <span>Größe</span>
            <button
              v-for="option in tokenSizeOptions"
              :key="option.id"
              type="button"
              :class="{ active: selectedMonsterSize === option.id }"
              :data-testid="`quick-token-size-${option.id}`"
              @click="selectedMonsterSize = option.id"
            >
              {{ option.label }}
            </button>
          </div>
          <button
            type="button"
            class="primary"
            data-testid="create-quick-token"
            @click="createQuickToken"
          >
            {{ selectedTokenCategory === 'player' ? 'Spieler erstellen' : 'Gegner erstellen' }}
          </button>
        </template>
      </section>
      <p v-if="activeView === 'spells'" class="spell-menu-hint">
        Form auswählen und auf der Karte absetzen. Danach direkt skalieren, drehen oder verschieben.
      </p>
      <p v-else-if="activeView === 'tokens'" class="spell-menu-hint">
        Der Token wird an der gedrückten Kartenposition erstellt.
      </p>
    </section>
  </div>
</template>
