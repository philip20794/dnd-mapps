<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FogVisibilityMode } from '@/map-engine/fog/fogState'
import type { MapDefinition, MapLevelDefinition } from '@/maps/api'
import type { MapRotation } from '@/types/settings'
import type { PlacedToken } from '@/types/tokens'

const props = defineProps<{
  maps: readonly MapDefinition[]
  selectedMapId: string | null
  fogEnabled: boolean
  persistExploration: boolean
  fogVisibilityMode: FogVisibilityMode
  playerTokens: readonly PlacedToken[]
  gridVisible: boolean
  snapToGrid: boolean
  toolbarCollapsed: boolean
  zoomPercent: number
  mapRotation: MapRotation
  activeLevelName: string
  activeLevelId: string | null
  levels: readonly MapLevelDefinition[]
  editorActive?: boolean
  editorMapName?: string
}>()

const emit = defineEmits<{
  selectMap: [mapId: string]
  selectLevel: [levelId: string]
  generateRandomMap: []
  openRandomMapConfig: []
  rotateMap: []
  toggleSidebar: []
  toggleToolbar: []
  setFog: [enabled: boolean]
  setPersistExploration: [enabled: boolean]
  setFogVisibilityMode: [mode: FogVisibilityMode]
  setGridVisible: [enabled: boolean]
  setSnapToGrid: [enabled: boolean]
  resetCamera: []
  resetTokens: []
  resetFog: []
  resetSession: []
  enterMapEditor: []
}>()

const visibilityModeValue = computed(() =>
  props.fogVisibilityMode.kind === 'shared'
    ? 'shared'
    : `player:${props.fogVisibilityMode.tokenId}`,
)
const explorationModeLabel = computed(() =>
  props.persistExploration ? 'Erkundung speichern' : 'Nur aktuelle Sicht',
)
const activeMapName = computed(
  () =>
    props.editorMapName ??
    props.maps.find((map) => map.id === props.selectedMapId)?.name ??
    'Karte',
)
const levelMenu = ref<HTMLDetailsElement | null>(null)
const fullscreenActive = ref(false)
const fullscreenSupported = ref(false)
const fullscreenError = ref('')

function updateFullscreenState(): void {
  fullscreenActive.value = document.fullscreenElement === document.documentElement
}

function closeDrawer(): void {
  if (!props.toolbarCollapsed) emit('toggleToolbar')
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !props.toolbarCollapsed) closeDrawer()
}

async function toggleFullscreen(): Promise<void> {
  if (!fullscreenSupported.value) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
    fullscreenError.value = ''
    updateFullscreenState()
  } catch {
    fullscreenError.value = 'Der Browser hat den Vollbildmodus nicht erlaubt.'
  }
}

onMounted(() => {
  fullscreenSupported.value =
    typeof document.documentElement.requestFullscreen === 'function' &&
    typeof document.exitFullscreen === 'function'
  updateFullscreenState()
  document.addEventListener('fullscreenchange', updateFullscreenState)
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  window.removeEventListener('keydown', handleEscape)
})

function updateFogVisibilityMode(event: Event): void {
  if (!(event.currentTarget instanceof HTMLSelectElement)) return
  const value = event.currentTarget.value
  if (value === 'shared') emit('setFogVisibilityMode', { kind: 'shared' })
  else if (value.startsWith('player:'))
    emit('setFogVisibilityMode', { kind: 'player', tokenId: value.slice('player:'.length) })
}

function playerVisibilityLabel(player: PlacedToken): string {
  const sameNamePlayers = props.playerTokens.filter((entry) => entry.name === player.name)
  return sameNamePlayers.length <= 1
    ? `Nur ${player.name}`
    : `Nur ${player.name} (${sameNamePlayers.indexOf(player) + 1})`
}

function selectLevel(levelId: string): void {
  emit('selectLevel', levelId)
  if (levelMenu.value) levelMenu.value.open = false
}

function generateRandomMap(): void {
  emit('generateRandomMap')
  closeDrawer()
}

function openRandomMapConfig(): void {
  emit('openRandomMapConfig')
  closeDrawer()
}
</script>

<template>
  <div class="tabletop-floating-menu" data-testid="toolbar">
    <button
      type="button"
      class="icon-button tabletop-menu-toggle"
      :aria-label="toolbarCollapsed ? 'Menü öffnen' : 'Menü schließen'"
      :aria-expanded="!toolbarCollapsed"
      aria-controls="tabletop-controls"
      data-testid="toggle-toolbar-button"
      @click="emit('toggleToolbar')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path v-if="toolbarCollapsed" d="M4 6h16M4 12h16M4 18h16" />
        <path v-else d="M5 5l14 14M19 5L5 19" />
      </svg>
    </button>
  </div>

  <div v-show="!toolbarCollapsed" class="tabletop-menu-layer">
    <button
      type="button"
      class="tabletop-menu-backdrop"
      aria-label="Menü schließen"
      tabindex="-1"
      @click="closeDrawer"
    />
    <section
      id="tabletop-controls"
      class="tabletop-menu-panel"
      role="dialog"
      aria-labelledby="tabletop-menu-title"
      aria-modal="false"
    >
      <div class="tabletop-menu-heading">
        <div>
          <strong id="tabletop-menu-title">Werkzeuge</strong>
          <span>{{ activeMapName }} · {{ activeLevelName }}</span>
        </div>
      </div>
      <div class="tabletop-menu-scroll">
        <div class="toolbar-menu-section tabletop-map-section">
    <label class="toolbar-map-select tabletop-map-select" for="map-select">
      <span>Karte auswählen</span>
      <select
        id="map-select"
        data-testid="map-select"
        :value="selectedMapId ?? ''"
        :disabled="editorActive"
        @change="emit('selectMap', ($event.target as HTMLSelectElement).value); closeDrawer()"
      >
        <option v-for="map in maps" :key="map.id" :value="map.id">{{ map.name }}</option>
      </select>
    </label>
        </div>
          <div v-if="!editorActive" class="toolbar-menu-section">
            <strong>Spiel</strong>
            <button
              type="button"
              data-testid="toggle-sidebar-button"
              @click="emit('toggleSidebar'); closeDrawer()"
            >
              Tokens und Zauber öffnen/schließen
            </button>
            <label class="toolbar-direct-toggle">
              <input
                data-testid="fog-toggle"
                type="checkbox"
                :checked="fogEnabled"
                @change="emit('setFog', ($event.target as HTMLInputElement).checked)"
              />
              <span>Fog of War</span>
            </label>
            <label class="toolbar-visibility-mode">
              <span>Sichtmodus</span>
              <select
                data-testid="fog-visibility-mode"
                :value="visibilityModeValue"
                :disabled="!fogEnabled"
                aria-label="Sichtmodus"
                @change="updateFogVisibilityMode"
              >
                <option value="shared">Gemeinsame Sicht</option>
                <option v-for="player in playerTokens" :key="player.id" :value="`player:${player.id}`">
                  {{ playerVisibilityLabel(player) }}
                </option>
              </select>
              <small v-if="!fogEnabled" class="visually-hidden">Inaktiv: Fog ist aus</small>
            </label>
          </div>
          <div class="toolbar-menu-section">
            <strong>Karte und Editor</strong>
            <button
              v-if="!editorActive"
              type="button"
              class="map-editor-entry"
              data-testid="enter-map-editor"
              @click="emit('enterMapEditor'); closeDrawer()"
            >
              <span aria-hidden="true">✦</span> Karteneditor öffnen
            </button>
            <span v-else class="map-editor-active-chip" data-testid="map-editor-active-chip">
              Bearbeitungsmodus
            </span>
            <button
              v-if="!editorActive"
              type="button"
              class="primary random-map-button"
              data-testid="generate-random-map-button"
              @click="generateRandomMap"
            >
              Zufallskarte
            </button>
            <button
              v-if="!editorActive"
              type="button"
              data-testid="open-random-map-config-button"
              @click="openRandomMapConfig"
            >
              Karte konfigurieren
            </button>
            <button
              type="button"
              data-testid="rotate-map-button"
              :aria-label="`Karte um 90 Grad drehen, aktuell ${mapRotation} Grad`"
              @click="emit('rotateMap')"
            >
              90 Grad drehen
            </button>
          </div>

          <div class="toolbar-menu-section">
            <strong>Darstellung</strong>
            <button
              type="button"
              class="tabletop-fullscreen-button"
              data-testid="fullscreen-button"
              :aria-pressed="fullscreenActive"
              :disabled="!fullscreenSupported"
              @click="toggleFullscreen"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path v-if="!fullscreenActive" d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
                <path v-else d="M3 9h6V3m12 6h-6V3M3 15h6v6m12-6h-6v6" />
              </svg>
              {{ fullscreenActive ? 'Vollbild verlassen' : 'Vollbild aktivieren' }}
            </button>
            <small v-if="!fullscreenSupported" class="tabletop-menu-note">
              Dieser Browser unterstützt den Vollbildmodus hier nicht.
            </small>
            <small v-if="fullscreenError" class="tabletop-menu-note" role="status">{{ fullscreenError }}</small>
            <button
              v-if="!editorActive"
              type="button"
              class="mode-toggle"
              :class="{ active: persistExploration }"
              :aria-pressed="persistExploration"
              data-testid="persist-exploration-toggle"
              @click="emit('setPersistExploration', !persistExploration)"
            >
              {{ explorationModeLabel }}
            </button>
            <label class="inline-toggle">
              <input
                type="checkbox"
                :checked="gridVisible"
                @change="emit('setGridVisible', ($event.target as HTMLInputElement).checked)"
              />
              Hexraster
            </label>
            <label class="inline-toggle">
              <input
                type="checkbox"
                :checked="snapToGrid"
                @change="emit('setSnapToGrid', ($event.target as HTMLInputElement).checked)"
              />
              Hex einrasten
            </label>
            <span class="zoom-chip" data-testid="zoom-status">Zoom: {{ zoomPercent }}%</span>
          </div>

          <div class="toolbar-menu-section">
            <strong>Ebene</strong>
            <details v-if="levels.length > 1" ref="levelMenu" class="level-menu">
              <summary data-testid="level-menu-button">
                <span data-testid="level-status">{{ activeMapName }}: {{ activeLevelName }}</span>
              </summary>
              <div class="level-menu-content">
                <button
                  v-for="level in levels"
                  :key="level.id"
                  type="button"
                  :class="{ active: level.id === activeLevelId }"
                  :data-testid="`level-option-${level.id}`"
                  @click="selectLevel(level.id)"
                >
                  {{ level.name }}
                </button>
              </div>
            </details>
            <span v-else class="zoom-chip" data-testid="level-status">
              {{ activeLevelName || 'Standardebene' }}
            </span>
          </div>

          <details class="reset-menu toolbar-menu-section">
            <summary data-testid="reset-menu-button">Zurücksetzen</summary>
            <div class="reset-menu-content">
              <button type="button" data-testid="reset-camera-button" @click="emit('resetCamera')">
                Kamera
              </button>
              <button
                v-if="!editorActive"
                type="button"
                data-testid="reset-tokens-button"
                @click="emit('resetTokens')"
              >
                Tokens
              </button>
              <button
                v-if="!editorActive"
                type="button"
                data-testid="reset-fog-button"
                @click="emit('resetFog')"
              >
                Fog
              </button>
              <button
                v-if="!editorActive"
                type="button"
                class="danger"
                data-testid="reset-session-button"
                @click="emit('resetSession')"
              >
                Sitzung
              </button>
            </div>
          </details>
      </div>
    </section>
  </div>
</template>
