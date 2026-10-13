<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MapCanvas from '@/components/MapCanvas.vue'
import RandomMapDialog from '@/components/RandomMapDialog.vue'
import SidebarPanel from '@/components/SidebarPanel.vue'
import TopToolbar from '@/components/TopToolbar.vue'
import { fitCameraToMap } from '@/map-engine/camera/camera'
import type { VerticalTransitionConfig } from '@/map-objects'
import type { MapGenerationRequest } from '@/map-generation'
import { mapGenerationService, withoutMapGenerationSeed } from '@/map-generation/service'
import { getDefaultLevelId } from '@/maps/api'
import { loadMapDefinitions } from '@/maps/loader'
import { useAppStore } from '@/stores/app'
import { useFogStore } from '@/stores/fog'
import { useMapStore } from '@/stores/map'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useSpellEffectStore } from '@/stores/spellEffects'
import { useTokenStore } from '@/stores/tokens'
import type { Polygon } from '@/types/geometry'
import type { ExplorationMask } from '@/map-engine/fog/fogState'
import { defaultCameraState, type RuntimeSettings } from '@/types/settings'
import { findSpellAreaPreset, type SpellEffectPatch, type SpellPlacement } from '@/types/spells'
import { tokenTemplates, type TokenPatch } from '@/types/tokens'

const appStore = useAppStore()
const mapStore = useMapStore()
const tokenStore = useTokenStore()
const fogStore = useFogStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()
const spellEffectStore = useSpellEffectStore()

const currentMap = computed(() => mapStore.currentMap)
const currentLevelId = computed(() => mapStore.currentLevelId)
const currentExplorationKey = computed(() =>
  currentMap.value && currentLevelId.value ? `${currentMap.value.id}:${currentLevelId.value}` : '',
)
const currentDoorStates = computed(() => mapStore.currentDoorStates)
const currentExplored = computed<ExplorationMask | null>(() =>
  currentExplorationKey.value
    ? (fogStore.exploredMasksByMap[currentExplorationKey.value] ?? null)
    : null,
)
const currentSpellEffects = computed(() => {
  if (!currentMap.value || !currentLevelId.value) {
    return []
  }
  const defaultLevelId = getDefaultLevelId(currentMap.value)
  return spellEffectStore
    .effectsForMap(currentMap.value.id)
    .filter((effect) => (effect.levelId ?? defaultLevelId) === currentLevelId.value)
})
const selectedCurrentSpellEffect = computed(
  () =>
    currentSpellEffects.value.find((effect) => effect.id === spellEffectStore.selectedEffectId) ??
    null,
)

interface ViewportSize {
  readonly width: number
  readonly height: number
}

const canvasViewport = ref<ViewportSize | null>(null)
const randomMapDialogOpen = ref(false)
const randomMapRequest = ref<MapGenerationRequest>({})
const aiUsageRefreshKey = ref(0)
const hasRandomMapConfiguration = ref(false)
const spellPlacement = ref<SpellPlacement | null>(null)
let autoSaveTimer: number | null = null
let pendingCameraFit = false

const isDefaultCamera = (camera: RuntimeSettings['camera']): boolean =>
  camera.x === defaultCameraState.x &&
  camera.y === defaultCameraState.y &&
  camera.zoom === defaultCameraState.zoom

const applyFitCameraToCurrentMap = (): boolean => {
  if (!currentMap.value || !canvasViewport.value) {
    return false
  }

  settingsStore.setCamera(
    fitCameraToMap(currentMap.value, canvasViewport.value, 32, settingsStore.mapRotation),
  )
  return true
}

const queueFitCameraToCurrentMap = (): void => {
  pendingCameraFit = true
  if (applyFitCameraToCurrentMap()) {
    pendingCameraFit = false
  }
}

const handleCanvasViewportChange = (viewport: ViewportSize): void => {
  canvasViewport.value = viewport
  if (pendingCameraFit && applyFitCameraToCurrentMap()) {
    pendingCameraFit = false
  }
}

const formatPersistenceError = (fallback: string, error: unknown): string =>
  error instanceof Error ? error.message : fallback

const persistSession = async (status: string): Promise<void> => {
  try {
    await sessionStore.save()
    appStore.setStatus(status)
  } catch (error) {
    appStore.setError(formatPersistenceError('Sitzung konnte nicht gespeichert werden.', error))
  }
}

const scheduleAutoSave = (status = 'Automatisch gespeichert'): void => {
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = null
    void persistSession(status)
  }, 350)
}

const cancelAutoSave = (): void => {
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

onMounted(async () => {
  try {
    const maps = loadMapDefinitions()
    mapStore.setMaps(maps)
    const restored = await sessionStore.restore()
    if (!restored && currentMap.value) {
      tokenStore.resetMapTokens(currentMap.value.id, currentMap.value.startTokens ?? [])
      queueFitCameraToCurrentMap()
    } else if (restored && isDefaultCamera(settingsStore.camera)) {
      queueFitCameraToCurrentMap()
    }
    appStore.setStatus('Bereit')
  } catch (error) {
    appStore.setError(error instanceof Error ? error.message : 'Karte konnte nicht geladen werden.')
  }
})

onBeforeUnmount(cancelAutoSave)

const selectMap = (mapId: string): void => {
  try {
    spellPlacement.value = null
    mapStore.selectMap(mapId)
    const map = mapStore.currentMap
    if (map && tokenStore.tokensForMap(map.id).length === 0) {
      tokenStore.resetMapTokens(map.id, map.startTokens ?? [])
    }
    queueFitCameraToCurrentMap()
    appStore.setStatus('Karte geladen')
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(error instanceof Error ? error.message : 'Karte konnte nicht geladen werden.')
  }
}

const createRandomMapWithRequest = async (request: MapGenerationRequest): Promise<void> => {
  try {
    const result = await mapGenerationService.generateNew(request)
    const { map, plan } = result
    randomMapRequest.value = withoutMapGenerationSeed(result.request)
    mapStore.upsertGeneratedMap(map)
    tokenStore.resetMapTokens(map.id, map.startTokens ?? [])
    spellEffectStore.resetMapEffects(map.id)
    fogStore.resetMap(map.id)
    queueFitCameraToCurrentMap()
    if (request.aiEnabled) aiUsageRefreshKey.value += 1
    randomMapDialogOpen.value = false
    const plannerLabel = result.planner === 'ai' ? 'mit Luna geplant' : 'lokal geplant'
    appStore.setStatus(`${plan.theme.atmosphere === 'dark' ? 'Dunkle' : 'Helle'} Zufallskarte ${plannerLabel}`)
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(error instanceof Error ? error.message : 'Zufallskarte konnte nicht erstellt werden.')
  }
}

const generateRandomMap = (request: MapGenerationRequest): void => {
  randomMapRequest.value = withoutMapGenerationSeed(request)
  hasRandomMapConfiguration.value = true
  void createRandomMapWithRequest(randomMapRequest.value)
}

const updateRandomMapRequest = (request: MapGenerationRequest): void => {
  randomMapRequest.value = withoutMapGenerationSeed(request)
  hasRandomMapConfiguration.value = true
}

const generateQuickRandomMap = (): void => {
  void createRandomMapWithRequest(
    hasRandomMapConfiguration.value
      ? randomMapRequest.value
      : fogStore.enabled
        ? { atmosphere: 'dark' }
        : {},
  )
}

const addToken = (kind: string, position: { readonly x: number; readonly y: number }): void => {
  if (!currentMap.value || !currentLevelId.value) {
    return
  }
  try {
    tokenStore.addTokenFromTemplate(kind, currentMap.value.id, position, currentLevelId.value)
    appStore.setStatus('Token platziert')
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(
      error instanceof Error ? error.message : 'Token konnte nicht platziert werden.',
    )
  }
}

const moveToken = (tokenId: string, position: { readonly x: number; readonly y: number }): void => {
  tokenStore.moveToken(tokenId, position)
  appStore.setStatus('Token bewegt')
  scheduleAutoSave()
}

const beginSpellPlacement = (casterTokenId: string, presetId: string): void => {
  const caster = tokenStore.tokens.find((token) => token.id === casterTokenId)
  const preset = findSpellAreaPreset(presetId)
  if (!caster || !preset || !currentLevelId.value) {
    appStore.setError('Die Flächenform konnte nicht vorbereitet werden.')
    return
  }
  tokenStore.setSelectedToken(casterTokenId)
  spellEffectStore.setSelectedEffect(null)
  spellPlacement.value = { casterTokenId, presetId }
  appStore.setStatus(`${preset.name}: Position auswählen`)
}

const placeSpell = (
  casterTokenId: string,
  presetId: string,
  target: { readonly x: number; readonly y: number },
): void => {
  const caster = tokenStore.tokens.find((token) => token.id === casterTokenId)
  const preset = findSpellAreaPreset(presetId)
  if (!caster || !preset || !currentLevelId.value) {
    spellPlacement.value = null
    return
  }
  spellEffectStore.addFromPreset(preset, caster, target, currentLevelId.value)
  spellPlacement.value = null
  appStore.setStatus(`${preset.name} auf der Karte eingezeichnet`)
  scheduleAutoSave()
}

const updateSpellEffect = (effectId: string, patch: SpellEffectPatch): void => {
  spellEffectStore.updateEffect(effectId, patch)
  scheduleAutoSave('Flächenform gespeichert')
}

const deleteSpellEffect = (effectId: string): void => {
  spellEffectStore.deleteEffect(effectId)
  appStore.setStatus('Flächenform entfernt')
  scheduleAutoSave()
}

const pickTransitionTokenId = (): string | null => {
  if (!currentMap.value || !currentLevelId.value) {
    return null
  }

  const selected = tokenStore.selectedToken
  const defaultLevelId = getDefaultLevelId(currentMap.value)
  if (
    selected?.mapId === currentMap.value.id &&
    (selected.levelId ?? defaultLevelId) === currentLevelId.value
  ) {
    return selected.id
  }

  return (
    tokenStore.tokens.find(
      (token) =>
        token.mapId === currentMap.value?.id &&
        (token.levelId ?? defaultLevelId) === currentLevelId.value &&
        token.category === 'player',
    )?.id ?? null
  )
}

const changeLevel = (transition: VerticalTransitionConfig): void => {
  if (!currentMap.value) {
    return
  }

  spellPlacement.value = null

  const tokenId = pickTransitionTokenId()
  if (tokenId) {
    tokenStore.updateToken(tokenId, {
      levelId: transition.targetLevelId,
      position: transition.targetPosition,
    })
    tokenStore.setSelectedToken(tokenId)
  }
  mapStore.setCurrentLevel(currentMap.value.id, transition.targetLevelId)
  appStore.setStatus(transition.label ?? 'Ebene gewechselt')
  scheduleAutoSave()
}

const selectLevel = (levelId: string): void => {
  if (!currentMap.value) {
    return
  }

  try {
    spellPlacement.value = null
    mapStore.setCurrentLevel(currentMap.value.id, levelId)
    appStore.setStatus(`Ebene gewechselt: ${mapStore.currentLevelName}`)
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(
      error instanceof Error ? error.message : 'Ebene konnte nicht gewechselt werden.',
    )
  }
}

const toggleDoor = (doorId: string): void => {
  try {
    mapStore.toggleDoor(doorId)
    appStore.setStatus('Türzustand geändert')
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(error instanceof Error ? error.message : 'Tür konnte nicht geändert werden.')
  }
}

const resetCamera = (): void => {
  queueFitCameraToCurrentMap()
  appStore.setStatus('Kamera zurückgesetzt')
  scheduleAutoSave()
}

const rotateMap = (): void => {
  settingsStore.rotateMapClockwise()
  queueFitCameraToCurrentMap()
  appStore.setStatus(`Karte auf ${settingsStore.mapRotation} Grad gedreht`)
  scheduleAutoSave()
}

const setCamera = (camera: RuntimeSettings['camera']): void => {
  settingsStore.setCamera(camera)
  scheduleAutoSave()
}

const resetTokens = async (): Promise<void> => {
  if (currentMap.value) {
    tokenStore.resetMapTokens(currentMap.value.id, currentMap.value.startTokens ?? [])
    spellEffectStore.resetMapEffects(currentMap.value.id)
    await persistSession('Tokens zurückgesetzt')
  }
}

const resetFog = async (): Promise<void> => {
  if (currentMap.value) {
    fogStore.resetMap(currentMap.value.id)
    await persistSession('Fog of War zurückgesetzt')
  }
}

const resetSession = async (): Promise<void> => {
  cancelAutoSave()
  await sessionStore.resetLocalData()
  if (currentMap.value) {
    tokenStore.resetMapTokens(currentMap.value.id, currentMap.value.startTokens ?? [])
    spellEffectStore.resetAll()
    fogStore.resetAll()
    mapStore.resetDoorStates(currentMap.value.id)
    mapStore.replaceCurrentLevels({})
    settingsStore.resetAll()
    queueFitCameraToCurrentMap()
  }
  await persistSession('Sitzung zurückgesetzt')
}

const updateSelectedToken = (patch: TokenPatch): void => {
  if (tokenStore.selectedTokenId) {
    tokenStore.updateToken(tokenStore.selectedTokenId, patch)
    scheduleAutoSave()
  }
}

const deleteSelectedToken = (): void => {
  const tokenId = tokenStore.selectedTokenId
  if (tokenId) {
    spellEffectStore.deleteEffectsForCaster(tokenId)
  }
  tokenStore.deleteSelectedToken()
  appStore.setStatus('Token gelöscht')
  scheduleAutoSave()
}

const setFogEnabled = (enabled: boolean): void => {
  fogStore.setEnabled(enabled)
  appStore.setStatus(enabled ? 'Fog of War aktiviert' : 'Fog of War deaktiviert')
  scheduleAutoSave()
}

const setPersistExploration = (enabled: boolean): void => {
  fogStore.setPersistExploration(enabled)
  appStore.setStatus(enabled ? 'Erkundung wird gespeichert' : 'Nur aktuelle Sicht aktiv')
  scheduleAutoSave()
}

const setGridVisible = (visible: boolean): void => {
  settingsStore.setGridVisible(visible)
  scheduleAutoSave()
}

const setSnapToGrid = (snap: boolean): void => {
  settingsStore.setSnapToGrid(snap)
  scheduleAutoSave()
}

const recordExploration = (mapId: string, levelId: string, polygons: readonly Polygon[]): void => {
  const changed = fogStore.record(`${mapId}:${levelId}`, polygons)
  if (changed && fogStore.enabled && fogStore.persistExploration) {
    scheduleAutoSave()
  }
}
</script>

<template>
  <div class="app-shell" :class="{ 'toolbar-collapsed': appStore.toolbarCollapsed }">
    <TopToolbar
      :maps="mapStore.maps"
      :selected-map-id="mapStore.selectedMapId"
      :fog-enabled="fogStore.enabled"
      :persist-exploration="fogStore.persistExploration"
      :grid-visible="settingsStore.grid.visible"
      :snap-to-grid="settingsStore.grid.snap"
      :toolbar-collapsed="appStore.toolbarCollapsed"
      :zoom-percent="settingsStore.zoomPercent"
      :map-rotation="settingsStore.mapRotation"
      :active-level-name="mapStore.currentLevelName"
      :active-level-id="currentLevelId"
      :levels="currentMap?.levels ?? []"
      @toggle-sidebar="appStore.toggleSidebar()"
      @toggle-toolbar="appStore.toggleToolbar()"
      @select-map="selectMap"
      @select-level="selectLevel"
      @generate-random-map="generateQuickRandomMap"
      @open-random-map-config="randomMapDialogOpen = true"
      @rotate-map="rotateMap"
      @set-fog="setFogEnabled"
      @set-persist-exploration="setPersistExploration"
      @set-grid-visible="setGridVisible"
      @set-snap-to-grid="setSnapToGrid"
      @reset-camera="resetCamera"
      @reset-tokens="resetTokens"
      @reset-fog="resetFog"
      @reset-session="resetSession"
    />

    <div class="main-layout" :class="{ 'sidebar-collapsed': appStore.sidebarCollapsed }">
      <SidebarPanel
        :collapsed="appStore.sidebarCollapsed"
        :token-templates="tokenTemplates"
        :selected-token="tokenStore.selectedToken"
        :spell-effects="currentSpellEffects"
        :selected-spell-effect="selectedCurrentSpellEffect"
        @update-token-name="updateSelectedToken({ name: $event })"
        @update-token-size="updateSelectedToken({ size: $event })"
        @update-token-rotation="updateSelectedToken({ rotation: $event })"
        @update-token-vision-range="updateSelectedToken({ visionRange: $event })"
        @update-token-vision-angle="updateSelectedToken({ visionAngle: $event })"
        @update-token-vision-enabled="updateSelectedToken({ visionEnabled: $event })"
        @delete-token="deleteSelectedToken"
        @select-spell-effect="spellEffectStore.setSelectedEffect"
        @delete-spell-effect="deleteSpellEffect"
      />

      <MapCanvas
        :map="currentMap"
        :level-id="currentLevelId"
        :tokens="tokenStore.tokens"
        :selected-token-id="tokenStore.selectedTokenId"
        :spell-effects="spellEffectStore.effects"
        :selected-spell-effect-id="spellEffectStore.selectedEffectId"
        :spell-placement="spellPlacement"
        :door-states="currentDoorStates"
        :settings="settingsStore.$state"
        :fog-enabled="fogStore.enabled"
        :persist-exploration="fogStore.persistExploration"
        :explored-mask="currentExplored"
        @drop-token="addToken"
        @select-token="tokenStore.setSelectedToken"
        @move-token="moveToken"
        @begin-spell-placement="beginSpellPlacement"
        @place-spell="placeSpell"
        @cancel-spell-placement="spellPlacement = null"
        @select-spell-effect="spellEffectStore.setSelectedEffect"
        @update-spell-effect="updateSpellEffect"
        @delete-spell-effect="deleteSpellEffect"
        @toggle-door="toggleDoor"
        @level-transition="changeLevel"
        @camera-change="setCamera"
        @viewport-change="handleCanvasViewportChange"
        @explore="recordExploration"
        @error="appStore.setError"
      />
    </div>

    <RandomMapDialog
      :model-value="randomMapRequest"
      :open="randomMapDialogOpen"
      :usage-refresh-key="aiUsageRefreshKey"
      @close="randomMapDialogOpen = false"
      @generate="generateRandomMap"
      @update:model-value="updateRandomMapRequest"
    />

    <div v-if="appStore.error" class="error-panel" data-testid="error-panel">
      <strong>Fehler</strong>
      <pre>{{ appStore.error }}</pre>
      <button type="button" class="danger" @click="resetSession">Lokale Daten zurücksetzen</button>
      <button type="button" @click="appStore.setError(null)">Schließen</button>
    </div>
  </div>
</template>
