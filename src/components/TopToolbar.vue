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

const explorationModeLabel = computed(() =>
  props.persistExploration ? 'Erkundung speichern' : 'Nur aktuelle Sicht',
)

const visibilityModeValue = computed(() =>
  props.fogVisibilityMode.kind === 'shared'
    ? 'shared'
    : `player:${props.fogVisibilityMode.tokenId}`,
)

function updateFogVisibilityMode(event: Event): void {
  if (!(event.currentTarget instanceof HTMLSelectElement)) return
  const value = event.currentTarget.value
  if (value === 'shared') {
    emit('setFogVisibilityMode', { kind: 'shared' })
    return
  }
  if (value.startsWith('player:')) {
    emit('setFogVisibilityMode', { kind: 'player', tokenId: value.slice('player:'.length) })
  }
}

function playerVisibilityLabel(player: PlacedToken): string {
  const sameNamePlayers = props.playerTokens.filter((entry) => entry.name === player.name)
  if (sameNamePlayers.length <= 1) return `Nur ${player.name}`
  return `Nur ${player.name} (${sameNamePlayers.indexOf(player) + 1})`
}

const activeMapName = computed(
  () =>
    props.editorMapName ??
    props.maps.find((map) => map.id === props.selectedMapId)?.name ??
    'Karte',
)

const levelMenu = ref<HTMLDetailsElement | null>(null)
const compactToolbar = ref(false)
let compactToolbarMedia: MediaQueryList | null = null

const updateCompactToolbar = (): void => {
  compactToolbar.value = compactToolbarMedia?.matches ?? false
}

onMounted(() => {
  compactToolbarMedia = window.matchMedia('(max-width: 900px)')
  updateCompactToolbar()
  compactToolbarMedia.addEventListener('change', updateCompactToolbar)
})

onBeforeUnmount(() => compactToolbarMedia?.removeEventListener('change', updateCompactToolbar))

const selectLevel = (levelId: string): void => {
  emit('selectLevel', levelId)
  if (levelMenu.value) {
    levelMenu.value.open = false
  }
}
</script>

<template>
  <header class="toolbar" :class="{ collapsed: toolbarCollapsed }" data-testid="toolbar">
    <button
      type="button"
      class="icon-button"
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
        class="icon-button"
        aria-label="Seitenleiste umschalten"
        data-testid="toggle-sidebar-button"
        @click="emit('toggleSidebar')"
      >
        ☰
      </button>

      <div class="toolbar-group map-group">
        <label for="map-select">Karte</label>
        <select
          id="map-select"
          data-testid="map-select"
          :value="selectedMapId ?? ''"
          :disabled="editorActive"
          @change="emit('selectMap', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="map in maps" :key="map.id" :value="map.id">{{ map.name }}</option>
        </select>
      </div>

      <button
        v-if="!editorActive"
        type="button"
        class="map-editor-entry"
        data-testid="enter-map-editor"
        @click="emit('enterMapEditor')"
      >
        Karte bearbeiten
      </button>
      <span v-else class="map-editor-active-chip" data-testid="map-editor-active-chip">
        Bearbeitungsmodus
      </span>

      <details class="toolbar-more" :open="!compactToolbar">
        <summary data-testid="toolbar-more-button" aria-label="Weitere Kartenfunktionen">Mehr</summary>
        <div class="toolbar-more-content">
          <button
            v-if="!editorActive"
            type="button"
            class="primary random-map-button"
            data-testid="generate-random-map-button"
            @click="emit('generateRandomMap')"
          >
            Zufallskarte
          </button>

          <button
            v-if="!editorActive"
            type="button"
            class="random-map-config-button"
            data-testid="open-random-map-config-button"
            @click="emit('openRandomMapConfig')"
          >
            Karte konfigurieren
          </button>

          <button
            type="button"
            class="map-rotate-button"
            data-testid="rotate-map-button"
            :aria-label="`Karte um 90 Grad drehen, aktuell ${mapRotation} Grad`"
            @click="emit('rotateMap')"
          >
            90 Grad drehen
          </button>

          <div v-if="!editorActive" class="toolbar-group">
        <label class="inline-toggle">
          <input
            data-testid="fog-toggle"
            type="checkbox"
            :checked="fogEnabled"
            @change="emit('setFog', ($event.target as HTMLInputElement).checked)"
          />
          Fog
        </label>

        <button
          type="button"
          class="mode-toggle"
          :class="{ active: persistExploration }"
          :aria-pressed="persistExploration"
          data-testid="persist-exploration-toggle"
          @click="emit('setPersistExploration', !persistExploration)"
        >
          {{ explorationModeLabel }}
        </button>
        <label class="fog-visibility-mode">
          <span>Sichtmodus</span>
          <select
            data-testid="fog-visibility-mode"
            :value="visibilityModeValue"
            :disabled="!fogEnabled"
            :aria-describedby="fogEnabled ? undefined : 'fog-visibility-inactive'"
            @change="updateFogVisibilityMode"
          >
            <option value="shared">Gemeinsame Sicht</option>
            <option
              v-for="player in playerTokens"
              :key="player.id"
              :value="`player:${player.id}`"
            >
              {{ playerVisibilityLabel(player) }}
            </option>
          </select>
          <small v-if="!fogEnabled" id="fog-visibility-inactive">Inaktiv: Fog ist aus</small>
        </label>
        <button
          v-if="fogVisibilityMode.kind === 'player'"
          type="button"
          class="mode-toggle active"
          data-testid="shared-visibility-button"
          @click="emit('setFogVisibilityMode', { kind: 'shared' })"
        >
          Gemeinsam
        </button>
          </div>

          <div class="toolbar-group">
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
          </div>

          <div class="toolbar-spacer" />

          <span class="zoom-chip" data-testid="zoom-status">{{ zoomPercent }}%</span>

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
          <span v-else-if="activeLevelName" class="zoom-chip" data-testid="level-status">
            Ebene: {{ activeLevelName }}
          </span>

          <details class="reset-menu">
        <summary data-testid="reset-menu-button">Zurücksetzen</summary>
        <div class="reset-menu-content">
          <button type="button" data-testid="reset-camera-button" @click="emit('resetCamera')">
            Kamera
          </button>
          <button v-if="!editorActive" type="button" data-testid="reset-tokens-button" @click="emit('resetTokens')">
            Tokens
          </button>
          <button v-if="!editorActive" type="button" data-testid="reset-fog-button" @click="emit('resetFog')">
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
