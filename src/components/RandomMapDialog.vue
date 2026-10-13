<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  formatLocalResetTime,
  formatUsd,
  loadAiUsage,
  type AiUsageSnapshot,
} from '@/ai/usage'
import {
  normalizeMapGenerationRequest,
  type Atmosphere,
  type Biome,
  type Density,
  type DungeonPreferences,
  type MapGenerationRequest,
  type MapSize,
  type MapType,
  type RequestedFeature,
  type SettlementTheme,
  type Terrain,
  type WaterPreference,
} from '@/map-generation'

const props = defineProps<{
  open: boolean
  modelValue: MapGenerationRequest
  usageRefreshKey?: number
}>()
const emit = defineEmits<{
  close: []
  generate: [request: MapGenerationRequest]
  'update:modelValue': [request: MapGenerationRequest]
}>()

interface Choice<TValue extends string> {
  readonly value: TValue
  readonly label: string
}

const mapTypes: readonly Choice<MapType>[] = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'dungeon', label: 'Dungeon' },
  { value: 'cave', label: 'Höhle' },
  { value: 'building', label: 'Gebäude' },
  { value: 'settlement', label: 'Siedlung' },
  { value: 'island', label: 'Insel/Küste' },
  { value: 'ruins', label: 'Ruinen' },
]
const biomes: readonly Choice<Biome>[] = [
  { value: 'forest', label: 'Wald' },
  { value: 'jungle', label: 'Dschungel' },
  { value: 'swamp', label: 'Sumpf' },
  { value: 'plains', label: 'Ebene' },
  { value: 'desert', label: 'Wüste' },
  { value: 'snow', label: 'Schnee' },
  { value: 'volcanic', label: 'Vulkan' },
  { value: 'underground', label: 'Unterreich' },
  { value: 'mushroom', label: 'Pilzwald' },
  { value: 'wasteland', label: 'Ödland' },
]
const waterFeatures: readonly Choice<WaterPreference>[] = [
  { value: 'river', label: 'Fluss' },
  { value: 'lake', label: 'See/Teich' },
  { value: 'coast', label: 'Küste' },
  { value: 'flooded', label: 'Überflutet' },
]
const themes: readonly Choice<SettlementTheme>[] = [
  { value: 'ruins', label: 'Ruinen' },
  { value: 'village', label: 'Dorf' },
  { value: 'temple', label: 'Tempel' },
  { value: 'fortress', label: 'Burg/Festung' },
  { value: 'mine', label: 'Mine' },
  { value: 'camp', label: 'Lager' },
]
const requestedFeatures: readonly Choice<RequestedFeature>[] = [{ value: 'ship', label: 'Schiff' }]
const atmospheres: readonly Choice<Atmosphere>[] = [
  { value: 'normal', label: 'Hell/normal' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'abandoned', label: 'Verlassen' },
  { value: 'overgrown', label: 'Überwuchert' },
  { value: 'destroyed', label: 'Zerstört' },
  { value: 'magical', label: 'Magisch' },
  { value: 'cursed', label: 'Verflucht' },
]
const sizes: readonly Choice<MapSize>[] = [
  { value: 'small', label: 'Klein' },
  { value: 'medium', label: 'Mittel' },
  { value: 'large', label: 'Groß' },
  { value: 'huge', label: 'Riesig' },
  { value: 'custom', label: 'Benutzerdefiniert' },
]
const terrains: readonly Choice<Terrain>[] = [
  { value: 'flat', label: 'Flach' },
  { value: 'hilly', label: 'Hügelig' },
  { value: 'cliffs', label: 'Klippen' },
  { value: 'canyon', label: 'Canyon' },
  { value: 'mixed', label: 'Gemischt' },
]

const request = ref<MapGenerationRequest>(normalizeMapGenerationRequest(props.modelValue))
const aiUsage = ref<AiUsageSnapshot | null>(null)
const aiUsageState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let aiUsageLastLoadedAt = 0
let aiUsageRefreshTimer: number | null = null
const aiUsageRefreshIntervalMs = 5 * 60 * 1000
watch(
  () => props.modelValue,
  (value) => {
    request.value = normalizeMapGenerationRequest(value)
  },
  { deep: true },
)

const commit = (next: MapGenerationRequest): void => {
  const normalized = normalizeMapGenerationRequest(next)
  request.value = normalized
  emit('update:modelValue', normalized)
}

const toggle = <TValue extends string>(
  values: readonly TValue[] | undefined,
  value: TValue,
): readonly TValue[] | undefined => {
  const next = new Set(values ?? [])
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next.size > 0 ? [...next] : undefined
}

const isSelected = <TValue extends string>(
  values: readonly TValue[] | undefined,
  value: TValue,
): boolean => values?.includes(value) ?? false

const selectMapType = (mapType: MapType | undefined): void => commit({ ...request.value, mapType })
const selectAtmosphere = (atmosphere: Atmosphere | undefined): void =>
  commit({ ...request.value, atmosphere })
const selectSize = (size: MapSize | undefined): void => commit({ ...request.value, size })
const selectTerrain = (terrain: Terrain | undefined): void => commit({ ...request.value, terrain })
const toggleBiome = (biome: Biome): void =>
  commit({ ...request.value, biomes: toggle(request.value.biomes, biome) })
const toggleWaterFeature = (waterFeature: WaterPreference): void =>
  commit({ ...request.value, waterFeatures: toggle(request.value.waterFeatures, waterFeature) })
const toggleTheme = (theme: SettlementTheme): void =>
  commit({ ...request.value, themes: toggle(request.value.themes, theme) })
const toggleRequestedFeature = (feature: RequestedFeature): void =>
  commit({ ...request.value, features: toggle(request.value.features, feature) })

const updateDungeon = (patch: Partial<DungeonPreferences>): void => {
  const dungeon = { ...request.value.dungeon, ...patch }
  commit({
    ...request.value,
    dungeon: Object.values(dungeon).some((value) => value !== undefined) ? dungeon : undefined,
  })
}
const toggleDungeonFlag = (key: 'secretRooms' | 'largeHalls'): void =>
  updateDungeon({ [key]: request.value.dungeon?.[key] ? undefined : true })
const toggleDungeonDensity = (key: 'loops' | 'deadEnds', density: Density): void =>
  updateDungeon({ [key]: request.value.dungeon?.[key] === density ? undefined : density })
const optionalPositiveInteger = (value: string): number | undefined => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const selectedCount = computed(
  () =>
    [
      request.value.mapType,
      ...(request.value.biomes ?? []),
      ...(request.value.waterFeatures ?? []),
      ...(request.value.themes ?? []),
      ...(request.value.features ?? []),
      request.value.atmosphere,
      request.value.size,
      request.value.terrain,
    ].filter((value) => value !== undefined).length,
)
const summary = computed(() =>
  selectedCount.value === 0 && !request.value.description
    ? 'Ohne Vorgaben entscheidet der Planner über Typ, Umgebung und Aufbau.'
    : 'Nicht gesetzte Werte ergänzt der Planner später automatisch.',
)
const aiUsageVisible = computed(() => props.open && request.value.aiEnabled)
const aiUsageResetTime = computed(() =>
  aiUsage.value ? formatLocalResetTime(aiUsage.value.period.endUtc) : '',
)
const refreshAiUsage = async (force = false): Promise<void> => {
  // A completed AI generation may close the dialog immediately. A forced refresh
  // still records the latest usage for the next time it is opened.
  if ((!aiUsageVisible.value && !force) || aiUsageState.value === 'loading') return
  if (!force && Date.now() - aiUsageLastLoadedAt < aiUsageRefreshIntervalMs) return
  aiUsageState.value = 'loading'
  try {
    aiUsage.value = await loadAiUsage()
    aiUsageLastLoadedAt = Date.now()
    aiUsageState.value = 'ready'
  } catch {
    aiUsageState.value = 'error'
  }
}
const stopAiUsageRefresh = (): void => {
  if (aiUsageRefreshTimer !== null) {
    window.clearInterval(aiUsageRefreshTimer)
    aiUsageRefreshTimer = null
  }
}
const startAiUsageRefresh = (): void => {
  stopAiUsageRefresh()
  aiUsageRefreshTimer = window.setInterval(() => void refreshAiUsage(), aiUsageRefreshIntervalMs)
}
watch(
  aiUsageVisible,
  (visible) => {
    if (!visible) {
      stopAiUsageRefresh()
      return
    }
    void refreshAiUsage()
    startAiUsageRefresh()
  },
  { immediate: true },
)
watch(
  () => props.usageRefreshKey,
  (value, previous) => {
    if (value !== previous && request.value.aiEnabled) void refreshAiUsage(true)
  },
)
const generate = (): void => {
  emit('generate', request.value)
}
const clearSelection = (): void => commit({})
const handleEscape = (event: KeyboardEvent): void => {
  if (props.open && event.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
  stopAiUsageRefresh()
})
</script>

<template>
  <div
    v-if="open"
    class="random-map-dialog-backdrop"
    data-testid="random-map-dialog"
    @mousedown.self="emit('close')"
  >
    <section
      class="random-map-dialog generation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-dialog-title"
    >
      <header class="random-map-dialog-header">
        <div>
          <h2 id="generation-dialog-title">Zufallskarte erstellen</h2>
          <p>Alle Angaben sind optional. Nicht gesetzte Details plant die lokale Generierung.</p>
        </div>
        <button
          type="button"
          class="dialog-close-button"
          aria-label="Dialog schließen"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <section class="generation-ai-control" aria-label="KI-Unterstützung">
        <strong>KI-Unterstützung</strong>
        <div class="generation-segmented">
          <button
            type="button"
            :class="{ active: !request.aiEnabled }"
            :aria-pressed="!request.aiEnabled"
            data-testid="generation-ai-off"
            @click="commit({ ...request, aiEnabled: false })"
          >
            Aus
          </button>
          <button
            type="button"
            :class="{ active: request.aiEnabled }"
            :aria-pressed="request.aiEnabled"
            data-testid="generation-ai-luna"
            @click="commit({ ...request, aiEnabled: true })"
          >
            Luna
          </button>
        </div>
        <small>Luna wird über den Cloudflare Worker angefragt; die lokale Planung bleibt verfügbar.</small>
      </section>

      <section v-if="request.aiEnabled" class="generation-ai-usage" aria-live="polite" data-testid="ai-usage-panel">
        <strong>Luna</strong>
        <p v-if="aiUsageState === 'loading'" class="generation-ai-usage-muted" data-testid="ai-usage-loading">
          API-Verbrauch wird geladen …
        </p>
        <template v-else-if="aiUsage">
          <div class="generation-ai-usage-row">
            <span>API-Verbrauch heute</span>
            <strong data-testid="ai-usage-measured">{{ formatUsd(aiUsage.usage.amountUsd) }}</strong>
          </div>
          <div v-if="aiUsage.dailyBudget.amountUsd !== null" class="generation-ai-usage-row">
            <span>Konfiguriertes Tagesbudget</span>
            <strong data-testid="ai-usage-budget">{{ formatUsd(aiUsage.dailyBudget.amountUsd) }}</strong>
          </div>
          <div v-if="aiUsage.remaining" class="generation-ai-usage-row">
            <span>Geschätzt innerhalb des Budgets verfügbar</span>
            <strong data-testid="ai-usage-remaining">ca. {{ formatUsd(aiUsage.remaining.amountUsd) }}</strong>
          </div>
          <p class="generation-ai-usage-muted">Freikontingent ist nicht verifizierbar.</p>
          <p class="generation-ai-usage-muted">Reset des UTC-Tagesfensters: {{ aiUsageResetTime }} lokale Zeit</p>
          <small v-if="aiUsage.usage.mayBeDelayed">Kostenmeldungen der API können verzögert sein.</small>
        </template>
        <p v-else-if="aiUsageState === 'error'" class="generation-ai-usage-muted" data-testid="ai-usage-error">
          API-Verbrauch momentan nicht verfügbar. Die Kartenerzeugung bleibt möglich.
        </p>
      </section>

      <label class="generation-description">
        Beschreibung <span>(optional)</span>
        <textarea
          :value="request.description ?? ''"
          rows="3"
          data-testid="generation-description"
          placeholder="Ein riesiger verlassener Zwergentempel tief unter einem Vulkan. Der Ostteil ist teilweise überflutet."
          @input="
            commit({
              ...request,
              description: ($event.target as HTMLTextAreaElement).value || undefined,
            })
          "
        />
      </label>

      <div class="generation-choice-sections">
        <fieldset class="generation-choice-group">
          <legend>Kartentyp</legend>
          <div class="generation-choice-grid compact">
            <button
              type="button"
              :class="{ selected: !request.mapType }"
              @click="selectMapType(undefined)"
            >
              Zufällig
            </button>
            <button
              v-for="option in mapTypes"
              :key="option.value"
              type="button"
              :class="{ selected: request.mapType === option.value }"
              :data-testid="`generation-map-type-${option.value}`"
              @click="selectMapType(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="generation-choice-group wide">
          <legend>Umgebung <small>Mehrfachauswahl</small></legend>
          <div class="generation-choice-grid">
            <button
              v-for="option in biomes"
              :key="option.value"
              type="button"
              :class="{ selected: isSelected(request.biomes, option.value) }"
              :aria-pressed="isSelected(request.biomes, option.value)"
              :data-testid="`generation-biome-${option.value}`"
              @click="toggleBiome(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="generation-choice-group wide">
          <legend>Elemente</legend>
          <div class="generation-choice-grid">
            <button
              v-for="option in waterFeatures"
              :key="option.value"
              type="button"
              :class="{ selected: isSelected(request.waterFeatures, option.value) }"
              :data-testid="`generation-water-${option.value}`"
              @click="toggleWaterFeature(option.value)"
            >
              {{ option.label }}
            </button>
            <button
              v-for="option in themes"
              :key="option.value"
              type="button"
              :class="{ selected: isSelected(request.themes, option.value) }"
              :data-testid="`generation-theme-${option.value}`"
              @click="toggleTheme(option.value)"
            >
              {{ option.label }}
            </button>
            <button
              v-for="option in requestedFeatures"
              :key="option.value"
              type="button"
              :class="{ selected: isSelected(request.features, option.value) }"
              :data-testid="`generation-feature-${option.value}`"
              @click="toggleRequestedFeature(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="generation-choice-group wide">
          <legend>Atmosphäre</legend>
          <div class="generation-choice-grid">
            <button
              type="button"
              :class="{ selected: !request.atmosphere }"
              @click="selectAtmosphere(undefined)"
            >
              Zufällig
            </button>
            <button
              v-for="option in atmospheres"
              :key="option.value"
              type="button"
              :class="{ selected: request.atmosphere === option.value }"
              :data-testid="`generation-atmosphere-${option.value}`"
              @click="selectAtmosphere(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="generation-choice-group wide">
          <legend>Größe</legend>
          <div class="generation-choice-grid compact">
            <button
              type="button"
              :class="{ selected: !request.size }"
              @click="selectSize(undefined)"
            >
              Zufällig
            </button>
            <button
              v-for="option in sizes"
              :key="option.value"
              type="button"
              :class="{ selected: request.size === option.value }"
              :data-testid="`generation-size-${option.value}`"
              @click="selectSize(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>
      </div>

      <details class="generation-more-options">
        <summary>Weitere Optionen</summary>
        <div class="generation-more-grid">
          <label
            >Breite<input
              type="number"
              min="1"
              :value="request.width ?? ''"
              data-testid="generation-width"
              @input="
                commit({
                  ...request,
                  width: optionalPositiveInteger(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label
            >Höhe<input
              type="number"
              min="1"
              :value="request.height ?? ''"
              data-testid="generation-height"
              @input="
                commit({
                  ...request,
                  height: optionalPositiveInteger(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label
            >Ungefähre Raumanzahl<input
              type="number"
              min="1"
              :value="request.dungeon?.roomCount ?? ''"
              @input="
                updateDungeon({
                  roomCount: optionalPositiveInteger(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label
            >Ebenen<input
              type="number"
              min="1"
              :value="request.dungeon?.levelCount ?? ''"
              @input="
                updateDungeon({
                  levelCount: optionalPositiveInteger(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label
            >Eingänge<input
              type="number"
              min="1"
              :value="request.dungeon?.entranceCount ?? ''"
              @input="
                updateDungeon({
                  entranceCount: optionalPositiveInteger(($event.target as HTMLInputElement).value),
                })
              "
          /></label>
          <label class="generation-toggle-option"
            ><input
              type="checkbox"
              :checked="request.dungeon?.secretRooms ?? false"
              data-testid="generation-secret-rooms"
              @change="toggleDungeonFlag('secretRooms')"
            />Geheimräume</label
          >
          <label class="generation-toggle-option"
            ><input
              type="checkbox"
              :checked="request.dungeon?.largeHalls ?? false"
              @change="toggleDungeonFlag('largeHalls')"
            />Große Räume/Hallen</label
          >
          <div class="generation-inline-options">
            <span>Schleifen</span
            ><button
              type="button"
              :class="{ selected: request.dungeon?.loops === 'few' }"
              @click="toggleDungeonDensity('loops', 'few')"
            >
              Wenige</button
            ><button
              type="button"
              :class="{ selected: request.dungeon?.loops === 'many' }"
              @click="toggleDungeonDensity('loops', 'many')"
            >
              Viele
            </button>
          </div>
          <div class="generation-inline-options">
            <span>Sackgassen</span
            ><button
              type="button"
              :class="{ selected: request.dungeon?.deadEnds === 'few' }"
              @click="toggleDungeonDensity('deadEnds', 'few')"
            >
              Wenige</button
            ><button
              type="button"
              :class="{ selected: request.dungeon?.deadEnds === 'many' }"
              @click="toggleDungeonDensity('deadEnds', 'many')"
            >
              Viele
            </button>
          </div>
          <div class="generation-inline-options terrain-options">
            <span>Geländeart</span
            ><button
              type="button"
              :class="{ selected: !request.terrain }"
              @click="selectTerrain(undefined)"
            >
              Zufällig</button
            ><button
              v-for="option in terrains"
              :key="option.value"
              type="button"
              :class="{ selected: request.terrain === option.value }"
              @click="selectTerrain(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </details>

      <div class="random-map-combination" data-testid="generation-summary">{{ summary }}</div>
      <footer class="random-map-dialog-actions">
        <button type="button" data-testid="clear-generation-request" @click="clearSelection">
          Auswahl löschen
        </button>
        <div class="dialog-action-spacer" />
        <button type="button" @click="emit('close')">Abbrechen</button>
        <button
          type="button"
          class="primary"
          data-testid="confirm-random-map-button"
          @click="generate"
        >
          Karte erzeugen
        </button>
      </footer>
    </section>
  </div>
</template>
