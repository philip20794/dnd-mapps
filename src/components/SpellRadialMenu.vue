<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { spellAreaPresets } from '@/types/spells'
import {
  tokenSizeOptions,
  type QuickTokenCategory,
  type TokenSizeId,
} from '@/types/tokens'

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

const activeCategory = ref<'spells' | 'tokens'>('spells')
const selectedTokenCategory = ref<QuickTokenCategory | null>(null)
const selectedMonsterSize = ref<TokenSizeId>('medium')
const playerColor = ref('#3f8cff')
const monsterColor = ref('#dc4b4b')
const selectedSize = computed(
  () => tokenSizeOptions.find((option) => option.id === selectedMonsterSize.value)?.size ?? 1,
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    activeCategory.value = 'spells'
    selectedTokenCategory.value = null
    selectedMonsterSize.value = 'medium'
    playerColor.value = '#3f8cff'
    monsterColor.value = '#dc4b4b'
  },
)

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
          <strong>{{ activeCategory === 'spells' ? 'Flächenform' : 'Token erstellen' }}</strong>
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
      <div v-if="tokenCreationEnabled" class="spell-menu-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="activeCategory === 'spells'"
          :class="{ active: activeCategory === 'spells' }"
          data-testid="creation-category-spells"
          @click="activeCategory = 'spells'"
        >
          Zauberformen
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeCategory === 'tokens'"
          :class="{ active: activeCategory === 'tokens' }"
          data-testid="creation-category-tokens"
          @click="activeCategory = 'tokens'"
        >
          Tokens
        </button>
      </div>
      <section
        v-if="activeCategory === 'spells'"
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
      <section v-else class="spell-menu-category" aria-labelledby="token-creation-heading">
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
          <button type="button" class="primary" data-testid="create-quick-token" @click="createQuickToken">
            {{ selectedTokenCategory === 'player' ? 'Spieler erstellen' : 'Gegner erstellen' }}
          </button>
        </template>
      </section>
      <p v-if="activeCategory === 'spells'" class="spell-menu-hint">
        Form auswählen und auf der Karte absetzen. Danach direkt skalieren, drehen oder verschieben.
      </p>
      <p v-else class="spell-menu-hint">Der Token wird an der gedrückten Kartenposition erstellt.</p>
    </section>
  </div>
</template>
