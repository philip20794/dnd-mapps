<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MapDefinition, MapLevelDefinition } from '@/maps/api'
import type { MapRotation } from '@/types/settings'

const props = defineProps<{
  maps: readonly MapDefinition[]
  selectedMapId: string | null
  fogEnabled: boolean
  persistExploration: boolean
  gridVisible: boolean
  snapToGrid: boolean
  toolbarCollapsed: boolean
  zoomPercent: number
  mapRotation: MapRotation
  activeLevelName: string
  activeLevelId: string | null
  levels: readonly MapLevelDefinition[]
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
  setGridVisible: [enabled: boolean]
  setSnapToGrid: [enabled: boolean]
  resetCamera: []
  resetTokens: []
  resetFog: []
  resetSession: []
}>()

const explorationModeLabel = computed(() =>
  props.persistExploration ? 'Erkundung speichern' : 'Nur aktuelle Sicht',
)

const activeMapName = computed(
  () => props.maps.find((map) => map.id === props.selectedMapId)?.name ?? 'Karte',
)

const levelMenu = ref<HTMLDetailsElement | null>(null)

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
          @change="emit('selectMap', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="map in maps" :key="map.id" :value="map.id">{{ map.name }}</option>
        </select>
      </div>

      <button
        type="button"
        class="primary random-map-button"
        data-testid="generate-random-map-button"
        @click="emit('generateRandomMap')"
      >
        Zufallskarte
      </button>

      <button
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

      <div class="toolbar-group">
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
          <button type="button" data-testid="reset-tokens-button" @click="emit('resetTokens')">
            Tokens
          </button>
          <button type="button" data-testid="reset-fog-button" @click="emit('resetFog')">
            Fog
          </button>
          <button
            type="button"
            class="danger"
            data-testid="reset-session-button"
            @click="emit('resetSession')"
          >
            Sitzung
          </button>
        </div>
      </details>
    </template>
  </header>
</template>
