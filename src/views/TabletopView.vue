<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MapCanvas from '@/components/MapCanvas.vue'
import MapEditorToolbar from '@/components/MapEditorToolbar.vue'
import RandomMapDialog from '@/components/RandomMapDialog.vue'
import SidebarPanel from '@/components/SidebarPanel.vue'
import TopToolbar from '@/components/TopToolbar.vue'
import {
  exportMapToJson,
  importMapFromJson,
  parseMapDefinition,
  validateEditableMap,
} from '@/map-editor/mapEditor'
import {
  addObject,
  deleteSelection,
  duplicateSelection,
  listMapObjectLibrary,
  resizeDoor,
  splitWall,
  updateDoor,
  updateObject,
  updateWall,
} from '@/map-editor/operations'
import { updateMaterialArea, updateMaterialDecal } from '@/map-editor/materialOperations'
import type { MaterialAreaDefinition, MaterialDecalDefinition } from '@/map-materials'
import type { MapEditorSelection, MapEditorState } from '@/map-editor/types'
import { fitCameraToMap } from '@/map-engine/camera/camera'
import type { VerticalTransitionConfig } from '@/map-objects'
import type { MapObjectDefinition } from '@/map-objects'
import type { MapGenerationRequest } from '@/map-generation'
import { mapGenerationService, withoutMapGenerationSeed } from '@/map-generation/service'
import {
  getDefaultLevelId,
  getLevelName,
  type DoorDefinition,
  type DoorState,
  type MapDefinition,
  type WallDefinition,
} from '@/maps/api'
import { loadMapDefinitions } from '@/maps/loader'
import { useAppStore } from '@/stores/app'
import { useFogStore } from '@/stores/fog'
import { useMapStore } from '@/stores/map'
import { useMapEditorStore } from '@/stores/mapEditor'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useSpellEffectStore } from '@/stores/spellEffects'
import { useTokenStore } from '@/stores/tokens'
import type { GridPoint, Polygon } from '@/types/geometry'
import {
  normalizeFogVisibilityMode,
  type ExplorationMask,
  type FogVisibilityMode,
} from '@/map-engine/fog/fogState'
import { defaultCameraState, type RuntimeSettings } from '@/types/settings'
import { findSpellAreaPreset, type SpellEffectPatch, type SpellPlacement } from '@/types/spells'
import {
  tokenTemplates,
  type PlacedToken,
  type QuickTokenCreation,
  type TokenPatch,
} from '@/types/tokens'

const appStore = useAppStore()
const mapStore = useMapStore()
const mapEditorStore = useMapEditorStore()
const tokenStore = useTokenStore()
const fogStore = useFogStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()
const spellEffectStore = useSpellEffectStore()

const currentMap = computed(() => mapStore.currentMap)
const currentLevelId = computed(() => mapStore.currentLevelId)
const displayedMap = computed(() =>
  mapEditorStore.active ? mapEditorStore.draft : currentMap.value,
)
const displayedLevelId = computed(() =>
  mapEditorStore.active ? mapEditorStore.levelId : currentLevelId.value,
)
const displayedLevelName = computed(() =>
  displayedMap.value && displayedLevelId.value
    ? getLevelName(displayedMap.value, displayedLevelId.value)
    : '',
)
const editorDoorStates = computed<Readonly<Record<string, DoorState>>>(() =>
  Object.fromEntries(
    (mapEditorStore.draft?.doors ?? []).map((door) => [door.id, door.defaultState]),
  ),
)
const mapObjectLibrary = listMapObjectLibrary()
const editorState = computed<MapEditorState>(() => ({
  tool: mapEditorStore.tool,
  selection: mapEditorStore.selection,
  snap: mapEditorStore.snap,
  objectTemplate: mapEditorStore.objectTemplate,
  material: mapEditorStore.material,
  brushSize: mapEditorStore.brushSize,
  materialVariant: mapEditorStore.materialVariant,
  materialRotation: mapEditorStore.materialRotation,
  materialScale: mapEditorStore.materialScale,
  materialAlpha: mapEditorStore.materialAlpha,
  materialTint: mapEditorStore.materialTint,
  materialTransition: mapEditorStore.materialTransition,
  decalKind: mapEditorStore.decalKind,
}))
const currentExplorationKey = computed(() =>
  currentMap.value && currentLevelId.value ? `${currentMap.value.id}:${currentLevelId.value}` : '',
)
const currentDoorStates = computed(() => mapStore.currentDoorStates)
const currentExplored = computed<ExplorationMask | null>(() =>
  currentExplorationKey.value
    ? (fogStore.exploredMasksByMap[currentExplorationKey.value] ?? null)
    : null,
)
const currentPlayerTokens = computed<readonly PlacedToken[]>(() => {
  if (!currentMap.value || !currentLevelId.value) return []
  const defaultLevelId = getDefaultLevelId(currentMap.value)
  return tokenStore.tokens.filter(
    (token) =>
      token.category === 'player' &&
      token.mapId === currentMap.value?.id &&
      (token.levelId ?? defaultLevelId) === currentLevelId.value,
  )
})
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
const tokenPlacementKind = ref<string | null>(null)
const duplicateTokenId = ref<string | null>(null)
const tokenPlacementTemplate = computed(
  () => tokenTemplates.find((template) => template.kind === tokenPlacementKind.value) ?? null,
)
const duplicateTokenPlacement = computed<PlacedToken | null>(() => {
  if (!duplicateTokenId.value || !currentMap.value || !currentLevelId.value) return null
  const token = tokenStore.tokens.find((entry) => entry.id === duplicateTokenId.value) ?? null
  if (!token || token.mapId !== currentMap.value.id) return null
  const tokenLevelId = token.levelId ?? getDefaultLevelId(currentMap.value)
  return tokenLevelId === currentLevelId.value ? token : null
})
let autoSaveTimer: number | null = null
let pendingCameraFit = false

const isDefaultCamera = (camera: RuntimeSettings['camera']): boolean =>
  camera.x === defaultCameraState.x &&
  camera.y === defaultCameraState.y &&
  camera.zoom === defaultCameraState.zoom

const applyFitCameraToCurrentMap = (): boolean => {
  if (!displayedMap.value || !canvasViewport.value) {
    return false
  }

  settingsStore.setCamera(
    fitCameraToMap(displayedMap.value, canvasViewport.value, 32, settingsStore.mapRotation),
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

function setFogVisibilityMode(mode: FogVisibilityMode): void {
  const normalized = normalizeFogVisibilityMode(mode, currentPlayerTokens.value)
  fogStore.setVisibilityMode(normalized)
  const label =
    normalized.kind === 'shared'
      ? 'Gemeinsame Sicht aktiv'
      : `Nur Sicht von ${currentPlayerTokens.value.find((token) => token.id === normalized.tokenId)?.name ?? 'Spieler'} aktiv`
  appStore.setStatus(label)
  scheduleAutoSave()
}

function focusTokenVisibility(tokenId: string): void {
  const token = currentPlayerTokens.value.find((entry) => entry.id === tokenId)
  if (!token) return
  if (!fogStore.enabled) fogStore.setEnabled(true)
  setFogVisibilityMode({ kind: 'player', tokenId })
}

watch([currentPlayerTokens, () => fogStore.visibilityMode], ([players, mode]) => {
  const normalized = normalizeFogVisibilityMode(mode, players)
  if (mode.kind === 'player' && normalized.kind === 'shared') {
    fogStore.setVisibilityMode(normalized)
    scheduleAutoSave()
  }
})

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

const isTextEntryTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

const handleEditorKeyboard = (event: KeyboardEvent): void => {
  if (!mapEditorStore.active || isTextEntryTarget(event.target)) return
  const modifier = event.ctrlKey || event.metaKey
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) mapEditorStore.redo()
    else mapEditorStore.undo()
    return
  }
  if (modifier && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    mapEditorStore.redo()
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && mapEditorStore.selection) {
    event.preventDefault()
    deleteEditorSelection()
  }
}

onMounted(() => window.addEventListener('keydown', handleEditorKeyboard))
onBeforeUnmount(() => {
  cancelAutoSave()
  window.removeEventListener('keydown', handleEditorKeyboard)
})

const selectMap = (mapId: string): void => {
  if (mapEditorStore.active) return
  try {
    spellPlacement.value = null
    cancelTokenPlacement()
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
    appStore.setStatus(
      `${plan.theme.atmosphere === 'dark' ? 'Dunkle' : 'Helle'} Zufallskarte ${plannerLabel}`,
    )
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(
      error instanceof Error ? error.message : 'Zufallskarte konnte nicht erstellt werden.',
    )
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
    cancelTokenPlacement()
    appStore.setStatus('Token platziert')
    scheduleAutoSave()
  } catch (error) {
    appStore.setError(
      error instanceof Error ? error.message : 'Token konnte nicht platziert werden.',
    )
  }
}

const addQuickToken = (creation: QuickTokenCreation, position: GridPoint): void => {
  if (!currentMap.value || !currentLevelId.value) return
  tokenStore.addQuickToken(creation, currentMap.value.id, position, currentLevelId.value)
  appStore.setStatus(creation.category === 'player' ? 'Spieler platziert' : 'Gegner platziert')
  scheduleAutoSave()
}

const beginTokenPlacement = (kind: string): void => {
  if (!currentMap.value || !currentLevelId.value) {
    return
  }
  tokenPlacementKind.value = kind
  duplicateTokenId.value = null
  spellPlacement.value = null
  appStore.setStatus('Tokenposition auf der Karte auswählen')
}

const beginTokenDuplicate = (tokenId: string): void => {
  if (!currentMap.value || !currentLevelId.value) return
  const source = tokenStore.tokens.find((token) => token.id === tokenId)
  const sourceLevelId = source?.levelId ?? getDefaultLevelId(currentMap.value)
  if (!source || source.mapId !== currentMap.value.id || sourceLevelId !== currentLevelId.value) {
    appStore.setError('Dieses Token kann auf der aktuellen Ebene nicht dupliziert werden.')
    return
  }

  duplicateTokenId.value = tokenId
  tokenPlacementKind.value = null
  spellPlacement.value = null
  appStore.setStatus('Position für die Kopie auf der Karte auswählen')
}

const placeTokenDuplicate = (sourceId: string, position: GridPoint): void => {
  if (!currentMap.value || !currentLevelId.value || sourceId !== duplicateTokenId.value) return
  const duplicate = tokenStore.duplicateToken(
    sourceId,
    currentMap.value.id,
    position,
    currentLevelId.value,
  )
  cancelTokenPlacement()
  if (!duplicate) {
    appStore.setError('Token konnte nicht dupliziert werden.')
    return
  }
  appStore.setStatus('Token dupliziert und platziert')
  scheduleAutoSave()
}

const cancelTokenPlacement = (): void => {
  tokenPlacementKind.value = null
  duplicateTokenId.value = null
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
  cancelTokenPlacement()
  spellPlacement.value = { kind: 'caster', casterTokenId, presetId }
  appStore.setStatus(`${preset.name}: Position auswählen`)
}

const beginFreeSpellPlacement = (presetId: string, origin: GridPoint): void => {
  const preset = findSpellAreaPreset(presetId)
  if (!preset || !currentMap.value || !currentLevelId.value) {
    appStore.setError('Die freie Flächenform konnte nicht vorbereitet werden.')
    return
  }
  spellEffectStore.setSelectedEffect(null)
  cancelTokenPlacement()
  spellPlacement.value = { kind: 'free', presetId, origin }
  appStore.setStatus(`${preset.name}: Position bestätigen oder anpassen`)
}

const placeSpell = (placement: SpellPlacement, target: GridPoint): void => {
  const preset = findSpellAreaPreset(placement.presetId)
  if (!preset || !currentMap.value || !currentLevelId.value) {
    spellPlacement.value = null
    cancelTokenPlacement()
    return
  }
  if (placement.kind === 'caster') {
    const caster = tokenStore.tokens.find((token) => token.id === placement.casterTokenId)
    if (!caster) {
      spellPlacement.value = null
      return
    }
    spellEffectStore.addFromPreset(preset, caster, target, currentLevelId.value)
  } else {
    spellEffectStore.addFreeFromPreset(preset, currentMap.value.id, target, currentLevelId.value)
  }
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
  cancelTokenPlacement()

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
  if (!displayedMap.value) {
    return
  }

  try {
    spellPlacement.value = null
    cancelTokenPlacement()
    if (mapEditorStore.active) {
      mapEditorStore.setLevel(levelId)
      appStore.setStatus(`Editor-Ebene: ${getLevelName(displayedMap.value, levelId)}`)
      return
    }
    const map = currentMap.value
    if (!map) return
    mapStore.setCurrentLevel(map.id, levelId)
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

const setMapRotation = (rotation: RuntimeSettings['mapRotation']): void => {
  settingsStore.setMapRotation(rotation)
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
  cancelTokenPlacement()
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

const updateToken = (tokenId: string, patch: TokenPatch): void => {
  if ('visionRange' in patch && patch.visionRange !== undefined) {
    tokenStore.setTokenVisionRange(tokenId, patch.visionRange)
  } else if ('visionEnabled' in patch && patch.visionEnabled !== undefined) {
    tokenStore.setTokenVisionEnabled(tokenId, patch.visionEnabled)
  } else if ('color' in patch && patch.color !== undefined) {
    tokenStore.updateTokenColor(tokenId, patch.color)
  } else {
    tokenStore.updateToken(tokenId, patch)
  }
  scheduleAutoSave()
}

const updateSelectedToken = (patch: TokenPatch): void => {
  if (tokenStore.selectedTokenId) updateToken(tokenStore.selectedTokenId, patch)
}

const deleteToken = (tokenId: string): void => {
  if (duplicateTokenId.value === tokenId) cancelTokenPlacement()
  spellEffectStore.deleteEffectsForCaster(tokenId)
  tokenStore.deleteToken(tokenId)
  appStore.setStatus('Token gelöscht')
  scheduleAutoSave()
}

const deleteSelectedToken = (): void => {
  if (tokenStore.selectedTokenId) deleteToken(tokenStore.selectedTokenId)
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
  if (mapEditorStore.active) return
  const changed = fogStore.record(`${mapId}:${levelId}`, polygons)
  if (changed && fogStore.enabled && fogStore.persistExploration) {
    scheduleAutoSave()
  }
}

function enterMapEditor(): void {
  if (!currentMap.value || !currentLevelId.value || mapEditorStore.active) return
  spellPlacement.value = null
  cancelTokenPlacement()
  tokenStore.setSelectedToken(null)
  spellEffectStore.setSelectedEffect(null)
  mapEditorStore.enter(
    currentMap.value,
    new Set(mapStore.maps.map((map) => map.id)),
    currentLevelId.value,
  )
  appStore.setStatus('Bearbeitungsmodus aktiv')
}

function commitEditorMap(map: MapDefinition, selection: MapEditorSelection | null): void {
  if (!mapEditorStore.active) return
  mapEditorStore.apply(map)
  mapEditorStore.select(selection)
}

function placeEditorObject(
  template: Pick<MapObjectDefinition, 'type' | 'preset'>,
  position: GridPoint,
): void {
  const draft = mapEditorStore.draft
  const levelId = mapEditorStore.levelId
  if (!draft || !levelId) return
  const result = addObject(draft, template, position, levelId)
  commitEditorMap(result.map, result.selection)
}

function updateEditorObject(id: string, patch: Partial<MapObjectDefinition>): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  commitEditorMap(updateObject(draft, id, patch), mapEditorStore.selection)
}

function updateEditorWall(id: string, patch: Partial<WallDefinition>): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  commitEditorMap(updateWall(draft, id, patch), mapEditorStore.selection)
}

function updateEditorDoor(id: string, patch: Partial<DoorDefinition>): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  let next = patch.segment ? resizeDoor(draft, id, patch.segment) : draft
  const metadataPatch = { ...patch }
  delete metadataPatch.segment
  if (Object.keys(metadataPatch).length > 0) next = updateDoor(next, id, metadataPatch)
  commitEditorMap(next, mapEditorStore.selection)
}

function updateEditorMaterialArea(
  layerId: string,
  id: string,
  patch: Partial<MaterialAreaDefinition>,
): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  commitEditorMap(updateMaterialArea(draft, layerId, id, patch), mapEditorStore.selection)
}

function updateEditorMaterialDecal(
  layerId: string,
  id: string,
  patch: Partial<MaterialDecalDefinition>,
): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  commitEditorMap(updateMaterialDecal(draft, layerId, id, patch), mapEditorStore.selection)
}

function deleteEditorSelection(): void {
  const draft = mapEditorStore.draft
  const selection = mapEditorStore.selection
  if (!draft || !selection) return
  commitEditorMap(deleteSelection(draft, selection), null)
}

function duplicateEditorSelection(): void {
  const draft = mapEditorStore.draft
  const selection = mapEditorStore.selection
  if (!draft || !selection) return
  const result = duplicateSelection(draft, selection)
  if (result) commitEditorMap(result.map, result.selection)
}

function splitSelectedEditorWall(): void {
  const draft = mapEditorStore.draft
  const selection = mapEditorStore.selection
  if (!draft || selection?.kind !== 'wall') return
  const result = splitWall(draft, selection.id)
  if (result) commitEditorMap(result.map, result.selection)
}

async function saveEditorMap(): Promise<void> {
  const draft = mapEditorStore.draft
  if (!draft?.editor) return
  const plainDraft = parseMapDefinition(draft)
  const savedMap = {
    ...plainDraft,
    editor: { ...draft.editor, updatedAt: new Date().toISOString() },
  }
  const errors = validateEditableMap(savedMap)
  if (errors.length > 0) {
    appStore.setError(`Karte kann nicht gespeichert werden: ${errors.join(' | ')}`)
    return
  }
  try {
    mapStore.upsertCustomMap(savedMap)
    if (mapEditorStore.levelId) {
      mapStore.setCurrentLevel(savedMap.id, mapEditorStore.levelId)
    }
    mapEditorStore.markSaved(savedMap)
    await persistSession('Eigene Karte gespeichert')
  } catch (error) {
    appStore.setError(formatPersistenceError('Karte konnte nicht gespeichert werden.', error))
  }
}

function discardEditorAndLeave(): void {
  const returnMapId = mapEditorStore.originalMapId
  mapEditorStore.discardChanges()
  mapEditorStore.leave()
  if (returnMapId && mapStore.maps.some((map) => map.id === returnMapId)) {
    mapStore.selectMap(returnMapId)
  }
  appStore.setStatus('Editoränderungen verworfen')
}

function leaveMapEditor(): void {
  if (mapEditorStore.dirty) {
    appStore.setError('Bitte die Editoränderungen zuerst speichern oder verwerfen.')
    return
  }
  const mapId = mapEditorStore.draft?.id ?? mapEditorStore.originalMapId
  mapEditorStore.leave()
  if (mapId && mapStore.maps.some((map) => map.id === mapId)) mapStore.selectMap(mapId)
  appStore.setStatus('Spielmodus aktiv')
}

function downloadEditorMap(): void {
  const draft = mapEditorStore.draft
  if (!draft) return
  const blob = new Blob([exportMapToJson(draft)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${draft.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '-').replace(/^-|-$/g, '') || 'karte'}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function importEditorMap(json: string): Promise<void> {
  try {
    const imported = importMapFromJson(json, new Set(mapStore.maps.map((map) => map.id)))
    mapStore.upsertCustomMap(imported)
    const levelId = getDefaultLevelId(imported)
    mapStore.setCurrentLevel(imported.id, levelId)
    mapEditorStore.enter(imported, new Set(mapStore.maps.map((map) => map.id)), levelId)
    await persistSession('Karte importiert')
  } catch (error) {
    appStore.setError(formatPersistenceError('Karte konnte nicht importiert werden.', error))
  }
}
</script>

<template>
  <div class="app-shell">
    <TopToolbar
      :maps="mapStore.maps"
      :selected-map-id="mapStore.selectedMapId"
      :fog-enabled="fogStore.enabled"
      :persist-exploration="fogStore.persistExploration"
      :fog-visibility-mode="fogStore.visibilityMode"
      :player-tokens="currentPlayerTokens"
      :grid-visible="settingsStore.grid.visible"
      :snap-to-grid="settingsStore.grid.snap"
      :toolbar-collapsed="appStore.toolbarCollapsed"
      :zoom-percent="settingsStore.zoomPercent"
      :map-rotation="settingsStore.mapRotation"
      :active-level-name="displayedLevelName"
      :active-level-id="displayedLevelId"
      :levels="displayedMap?.levels ?? []"
      :editor-active="mapEditorStore.active"
      :editor-map-name="mapEditorStore.draft?.name"
      @toggle-sidebar="appStore.toggleSidebar()"
      @toggle-toolbar="appStore.toggleToolbar()"
      @select-map="selectMap"
      @select-level="selectLevel"
      @generate-random-map="generateQuickRandomMap"
      @open-random-map-config="randomMapDialogOpen = true"
      @rotate-map="rotateMap"
      @set-fog="setFogEnabled"
      @set-persist-exploration="setPersistExploration"
      @set-fog-visibility-mode="setFogVisibilityMode"
      @set-grid-visible="setGridVisible"
      @set-snap-to-grid="setSnapToGrid"
      @reset-camera="resetCamera"
      @reset-tokens="resetTokens"
      @reset-fog="resetFog"
      @reset-session="resetSession"
      @enter-map-editor="enterMapEditor"
    />

    <MapEditorToolbar
      v-if="mapEditorStore.active && mapEditorStore.draft"
      :map="mapEditorStore.draft"
      :map-name="mapEditorStore.draft.name"
      :dirty="mapEditorStore.dirty"
      :can-undo="mapEditorStore.canUndo"
      :can-redo="mapEditorStore.canRedo"
      :tool="mapEditorStore.tool"
      :snap="mapEditorStore.snap"
      :selection="mapEditorStore.selection"
      :object-library="mapObjectLibrary"
      :material="mapEditorStore.material"
      :brush-size="mapEditorStore.brushSize"
      :material-variant="mapEditorStore.materialVariant"
      :material-rotation="mapEditorStore.materialRotation"
      :material-scale="mapEditorStore.materialScale"
      :material-alpha="mapEditorStore.materialAlpha"
      :material-tint="mapEditorStore.materialTint"
      :material-transition="mapEditorStore.materialTransition"
      :decal-kind="mapEditorStore.decalKind"
      @rename="mapEditorStore.rename"
      @undo="mapEditorStore.undo"
      @redo="mapEditorStore.redo"
      @save="saveEditorMap"
      @discard="discardEditorAndLeave"
      @leave="leaveMapEditor"
      @export-map="downloadEditorMap"
      @import-map="importEditorMap"
      @error="appStore.setError"
      @tool-change="mapEditorStore.setTool"
      @snap-change="mapEditorStore.setSnap"
      @material-change="mapEditorStore.setMaterial"
      @brush-size-change="mapEditorStore.setBrushSize"
      @material-settings-change="mapEditorStore.setMaterialSettings"
      @decal-kind-change="mapEditorStore.setDecalKind"
      @select="mapEditorStore.select"
      @begin-object-placement="mapEditorStore.beginObjectPlacement"
      @update-object="updateEditorObject"
      @update-wall="updateEditorWall"
      @update-door="updateEditorDoor"
      @update-material-area="updateEditorMaterialArea"
      @update-material-decal="updateEditorMaterialDecal"
      @delete-selection="deleteEditorSelection"
      @duplicate-selection="duplicateEditorSelection"
      @split-wall="splitSelectedEditorWall"
    />

    <div
      class="main-layout"
      :class="{ 'sidebar-collapsed': appStore.sidebarCollapsed || mapEditorStore.active }"
    >
      <SidebarPanel
        v-if="!mapEditorStore.active"
        :collapsed="appStore.sidebarCollapsed"
        :token-templates="tokenTemplates"
        :token-placement-kind="tokenPlacementKind"
        :selected-token="tokenStore.selectedToken"
        :spell-effects="currentSpellEffects"
        :selected-spell-effect="selectedCurrentSpellEffect"
        @update-token-name="updateSelectedToken({ name: $event })"
        @update-token-size="updateSelectedToken({ size: $event })"
        @update-token-rotation="updateSelectedToken({ rotation: $event })"
        @update-token-vision-range="updateSelectedToken({ visionRange: $event })"
        @update-token-vision-angle="updateSelectedToken({ visionAngle: $event })"
        @update-token-vision-enabled="updateSelectedToken({ visionEnabled: $event })"
        @update-token-color="updateSelectedToken({ color: $event })"
        @delete-token="deleteSelectedToken"
        @begin-token-placement="beginTokenPlacement"
        @select-spell-effect="spellEffectStore.setSelectedEffect"
        @delete-spell-effect="deleteSpellEffect"
      />

      <MapCanvas
        :map="displayedMap"
        :level-id="displayedLevelId"
        :tokens="mapEditorStore.active ? [] : tokenStore.tokens"
        :selected-token-id="mapEditorStore.active ? null : tokenStore.selectedTokenId"
        :token-placement-template="mapEditorStore.active ? null : tokenPlacementTemplate"
        :duplicate-token-placement="mapEditorStore.active ? null : duplicateTokenPlacement"
        :spell-effects="mapEditorStore.active ? [] : spellEffectStore.effects"
        :selected-spell-effect-id="mapEditorStore.active ? null : spellEffectStore.selectedEffectId"
        :spell-placement="mapEditorStore.active ? null : spellPlacement"
        :door-states="mapEditorStore.active ? editorDoorStates : currentDoorStates"
        :settings="settingsStore.$state"
        :fog-enabled="mapEditorStore.active ? false : fogStore.enabled"
        :persist-exploration="fogStore.persistExploration"
        :fog-visibility-mode="fogStore.visibilityMode"
        :explored-mask="mapEditorStore.active ? null : currentExplored"
        :editor-mode="mapEditorStore.active"
        :editor-state="editorState"
        @drop-token="addToken"
        @place-token-duplicate="placeTokenDuplicate"
        @begin-token-duplicate="beginTokenDuplicate"
        @create-quick-token="addQuickToken"
        @cancel-token-placement="cancelTokenPlacement"
        @select-token="tokenStore.setSelectedToken"
        @move-token="moveToken"
        @update-token="updateToken"
        @delete-token="deleteToken"
        @focus-token-visibility="focusTokenVisibility"
        @begin-spell-placement="beginSpellPlacement"
        @begin-free-spell-placement="beginFreeSpellPlacement"
        @place-spell="placeSpell"
        @cancel-spell-placement="spellPlacement = null"
        @select-spell-effect="spellEffectStore.setSelectedEffect"
        @update-spell-effect="updateSpellEffect"
        @delete-spell-effect="deleteSpellEffect"
        @toggle-door="toggleDoor"
        @level-transition="changeLevel"
        @camera-change="setCamera"
        @map-rotation-change="setMapRotation"
        @viewport-change="handleCanvasViewportChange"
        @explore="recordExploration"
        @error="appStore.setError"
        @editor-select="mapEditorStore.select"
        @editor-commit="commitEditorMap"
        @editor-cancel-tool="mapEditorStore.setTool('select')"
        @editor-place-object="placeEditorObject"
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
