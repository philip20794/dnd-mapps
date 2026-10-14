<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SpellRadialMenu from '@/components/SpellRadialMenu.vue'
import { MapEngine, type EngineFogState } from '@/map-engine/MapEngine'
import type { DoorState, MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'
import type { RuntimeSettings } from '@/types/settings'
import type { PlacedSpellEffect, SpellEffectPatch, SpellPlacement } from '@/types/spells'
import type { PlacedToken, TokenTemplate } from '@/types/tokens'
import type { VerticalTransitionConfig } from '@/map-objects'
import type { ExplorationMask } from '@/map-engine/fog/fogState'

const props = defineProps<{
  map: MapDefinition | null
  levelId: string | null
  tokens: readonly PlacedToken[]
  selectedTokenId: string | null
  tokenPlacementTemplate: TokenTemplate | null
  spellEffects: readonly PlacedSpellEffect[]
  selectedSpellEffectId: string | null
  spellPlacement: SpellPlacement | null
  doorStates: Readonly<Record<string, DoorState>>
  settings: RuntimeSettings
  fogEnabled: boolean
  persistExploration: boolean
  exploredMask: ExplorationMask | null
}>()

const emit = defineEmits<{
  dropToken: [kind: string, position: GridPoint]
  cancelTokenPlacement: []
  selectToken: [tokenId: string | null]
  moveToken: [tokenId: string, position: GridPoint]
  beginSpellPlacement: [casterTokenId: string, presetId: string]
  placeSpell: [casterTokenId: string, presetId: string, target: GridPoint]
  cancelSpellPlacement: []
  selectSpellEffect: [effectId: string]
  updateSpellEffect: [effectId: string, patch: SpellEffectPatch]
  deleteSpellEffect: [effectId: string]
  toggleDoor: [doorId: string]
  levelTransition: [transition: VerticalTransitionConfig, sourceObjectId: string]
  cameraChange: [camera: RuntimeSettings['camera']]
  viewportChange: [viewport: { readonly width: number; readonly height: number }]
  explore: [mapId: string, levelId: string, polygons: readonly Polygon[]]
  error: [message: string]
}>()

const host = ref<HTMLElement | null>(null)
const spellMenu = ref({ open: false, tokenId: '', tokenName: '', x: 0, y: 0 })
const spellEffectDragging = ref(false)
const tokenPlacementPreview = ref<{
  readonly position: GridPoint
  readonly screen: { readonly x: number; readonly y: number }
} | null>(null)
let engine: MapEngine | null = null
let resizeObserver: ResizeObserver | null = null

const engineFogState = computed<EngineFogState>(() => ({
  enabled: props.fogEnabled,
  persistExploration: props.persistExploration,
  explored: props.exploredMask,
}))

const syncMap = (): void => {
  if (engine && props.map && props.levelId) {
    engine.setMap(props.map, props.doorStates, props.levelId)
    engine.setTokens(props.tokens, props.selectedTokenId)
    engine.setSpellEffects(props.spellEffects, props.selectedSpellEffectId)
    engine.setSpellPlacement(props.spellPlacement)
    engine.setSettings(props.settings)
    engine.setFogState(engineFogState.value)
  }
}

const emitViewport = (): void => {
  if (!host.value) {
    return
  }

  const bounds = host.value.getBoundingClientRect()
  if (bounds.width > 0 && bounds.height > 0) {
    emit('viewportChange', { width: bounds.width, height: bounds.height })
  }
}

onMounted(async () => {
  if (!host.value) {
    return
  }
  engine = new MapEngine(host.value, {
    onTokenSelect: (tokenId) => emit('selectToken', tokenId),
    onTokenMove: (tokenId, position) => emit('moveToken', tokenId, position),
    onTokenLongPress: (tokenId, screenPoint) => {
      const token = props.tokens.find((entry) => entry.id === tokenId)
      if (!token || !host.value) {
        return
      }
      const bounds = host.value.getBoundingClientRect()
      spellMenu.value = {
        open: true,
        tokenId,
        tokenName: token.name,
        x: Math.max(12, Math.min(screenPoint.x + 12, bounds.width - 360)),
        y: Math.max(12, Math.min(screenPoint.y + 12, bounds.height - 450)),
      }
    },
    onSpellPlace: (casterTokenId, presetId, target) =>
      emit('placeSpell', casterTokenId, presetId, target),
    onSpellPlacementCancel: () => emit('cancelSpellPlacement'),
    onSpellEffectSelect: (effectId) => emit('selectSpellEffect', effectId),
    onSpellEffectUpdate: (effectId, patch) => emit('updateSpellEffect', effectId, patch),
    onSpellEffectDelete: (effectId) => emit('deleteSpellEffect', effectId),
    onSpellEffectDragStateChange: (active) => {
      spellEffectDragging.value = active
    },
    onDoorToggle: (doorId) => emit('toggleDoor', doorId),
    onLevelTransition: (transition, sourceObjectId) =>
      emit('levelTransition', transition, sourceObjectId),
    onCameraChange: (camera) => emit('cameraChange', camera),
    onExplore: (mapId, levelId, polygons) => emit('explore', mapId, levelId, polygons),
    onError: (message) => emit('error', message),
  })
  await engine.init()
  syncMap()
  emitViewport()
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(emitViewport)
    resizeObserver.observe(host.value)
  }
})

watch(
  () => props.map,
  () => syncMap(),
)

watch(
  () => props.tokens,
  () => {
    engine?.setTokens(props.tokens, props.selectedTokenId)
  },
)

watch(
  () => props.tokenPlacementTemplate,
  () => {
    tokenPlacementPreview.value = null
  },
)

watch(
  () => props.selectedTokenId,
  () => {
    engine?.setTokens(props.tokens, props.selectedTokenId)
  },
)

watch(
  () => props.spellEffects,
  () => engine?.setSpellEffects(props.spellEffects, props.selectedSpellEffectId),
  { deep: true },
)

watch(
  () => props.selectedSpellEffectId,
  () => engine?.setSpellEffects(props.spellEffects, props.selectedSpellEffectId),
)

watch(
  () => props.spellPlacement,
  (placement) => engine?.setSpellPlacement(placement),
  { deep: true },
)

watch(
  () => props.levelId,
  (levelId) => {
    if (levelId) {
      engine?.setLevel(levelId)
    }
  },
)

watch(
  () => props.doorStates,
  () => {
    engine?.setDoorStates(props.doorStates)
  },
  { deep: true },
)

watch(
  () => props.settings,
  () => {
    engine?.setSettings(props.settings)
  },
  { deep: true },
)

watch(engineFogState, (fogState) => {
  engine?.setFogState(fogState)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  engine?.destroy()
  engine = null
})

const handleDragOver = (event: DragEvent): void => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDrop = (event: DragEvent): void => {
  event.preventDefault()
  const kind =
    event.dataTransfer?.getData('application/x-token-kind') ||
    event.dataTransfer?.getData('text/plain')
  const position = engine?.clientToGrid(event.clientX, event.clientY)
  if (kind && position) {
    emit('dropToken', kind, position)
  }
}

const updateTokenPlacementPreview = (event: PointerEvent): void => {
  if (!props.tokenPlacementTemplate || !host.value) {
    tokenPlacementPreview.value = null
    return
  }
  const bounds = host.value.getBoundingClientRect()
  const position = engine?.clientToGrid(event.clientX, event.clientY)
  tokenPlacementPreview.value = position
    ? {
        position,
        screen: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      }
    : null
}

const placeTokenFromTemplate = (event: PointerEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  updateTokenPlacementPreview(event)
  const template = props.tokenPlacementTemplate
  const preview = tokenPlacementPreview.value
  if (template && preview) {
    emit('dropToken', template.kind, preview.position)
    emit('cancelTokenPlacement')
  }
}

const cancelTokenPlacement = (): void => {
  tokenPlacementPreview.value = null
  emit('cancelTokenPlacement')
}

const chooseSpell = (presetId: string): void => {
  const tokenId = spellMenu.value.tokenId
  spellMenu.value.open = false
  if (tokenId) {
    emit('beginSpellPlacement', tokenId, presetId)
  }
}
</script>

<template>
  <main class="canvas-shell">
    <div
      ref="host"
      class="map-canvas"
      tabindex="0"
      data-testid="map-canvas"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />
    <div
      v-if="tokenPlacementTemplate"
      class="token-placement-overlay"
      data-testid="token-placement-overlay"
      @pointermove="updateTokenPlacementPreview"
      @pointerdown="placeTokenFromTemplate"
      @pointerleave="tokenPlacementPreview = null"
    >
      <div
        v-if="tokenPlacementPreview"
        class="token-placement-preview"
        :style="{
          left: `${tokenPlacementPreview.screen.x}px`,
          top: `${tokenPlacementPreview.screen.y}px`,
          backgroundColor: tokenPlacementTemplate.color,
        }"
        aria-hidden="true"
      >
        {{ tokenPlacementTemplate.symbol }}
      </div>
    </div>
    <div
      v-if="tokenPlacementTemplate"
      class="token-placement-banner"
      data-testid="token-placement-banner"
    >
      <span>{{ tokenPlacementTemplate.name }}: Position auf der Karte antippen</span>
      <button type="button" @click="cancelTokenPlacement">Abbrechen</button>
    </div>
    <div v-if="spellPlacement" class="spell-placement-banner" data-testid="spell-placement-banner">
      Position für die Form anklicken
      <button type="button" @click="emit('cancelSpellPlacement')">Abbrechen</button>
    </div>
    <div
      v-if="spellEffectDragging"
      class="spell-trash-target"
      data-testid="spell-trash-target"
      aria-label="Fläche hierher ziehen, um sie zu entfernen"
    >
      <span aria-hidden="true">🗑</span>
      <strong>Hierher ziehen</strong>
    </div>
    <SpellRadialMenu
      :open="spellMenu.open"
      :token-name="spellMenu.tokenName"
      :x="spellMenu.x"
      :y="spellMenu.y"
      @choose="chooseSpell"
      @close="spellMenu.open = false"
    />
  </main>
</template>
