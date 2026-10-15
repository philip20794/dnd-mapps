<script setup lang="ts">
import { computed, ref } from 'vue'
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
const moreMenu = ref<HTMLDetailsElement | null>(null)

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

function closeMoreMenu(): void {
  if (moreMenu.value) moreMenu.value.open = false
}

function generateRandomMap(): void {
  emit('generateRandomMap')
  closeMoreMenu()
}

function openRandomMapConfig(): void {
  emit('openRandomMapConfig')
  closeMoreMenu()
}
</script>

<template>
  <header class="toolbar" :class="{ collapsed: toolbarCollapsed }" data-testid="toolbar">
    <button
      type="button"
      class="icon-button toolbar-collapse-button"
      :aria-label="toolbarCollapsed ? 'Top-Menü einblenden' : 'Top-Menü ausblenden'"
      data-testid="toggle-toolbar-button"
      @click="emit('toggleToolbar')"
    >
      {{ toolbarCollapsed ? '↓' : '↑' }}
    </button>

    <template v-if="!toolbarCollapsed">
      <button
        v-if="!editorActive"
        type="button"
        class="icon-button sidebar-toggle"
        aria-label="Seitenleiste umschalten"
        title="Seitenleiste"
        data-testid="toggle-sidebar-button"
        @click="emit('toggleSidebar')"
      >
        ☰
      </button>

      <label class="toolbar-map-select" for="map-select">
        <span>Karte</span>
        <select
          id="map-select"
          data-testid="map-select"
          :value="selectedMapId ?? ''"
          :disabled="editorActive"
          @change="emit('selectMap', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="map in maps" :key="map.id" :value="map.id">{{ map.name }}</option>
        </select>
      </label>

      <button
        v-if="!editorActive"
        type="button"
        class="map-editor-entry"
        data-testid="enter-map-editor"
        title="Karteneditor öffnen"
        @click="emit('enterMapEditor')"
      >
        <span class="toolbar-button-icon" aria-hidden="true">✦</span>
        <span class="toolbar-button-label">Bearbeiten</span>
      </button>
      <span v-else class="map-editor-active-chip" data-testid="map-editor-active-chip">
        <span class="map-editor-active-label">Bearbeitungsmodus</span>
        <span class="map-editor-active-label-compact">Editor</span>
      </span>

      <label v-if="!editorActive" class="toolbar-direct-toggle">
        <input
          data-testid="fog-toggle"
          type="checkbox"
          :checked="fogEnabled"
          @change="emit('setFog', ($event.target as HTMLInputElement).checked)"
        />
        <span>Fog</span>
      </label>

      <label v-if="!editorActive" class="toolbar-visibility-mode">
        <span>Sicht</span>
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

      <details ref="moreMenu" class="toolbar-more">
        <summary data-testid="toolbar-more-button" aria-label="Weitere Kartenfunktionen">
          Mehr <span aria-hidden="true">⌄</span>
        </summary>
        <div class="toolbar-more-content">
          <div class="toolbar-menu-section">
            <strong>Karte</strong>
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
      </details>
    </template>
  </header>
</template>
