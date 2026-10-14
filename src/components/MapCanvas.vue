<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SpellRadialMenu from '@/components/SpellRadialMenu.vue'
import TokenContextMenu from '@/components/TokenContextMenu.vue'
import { MapEngine, type EngineFogState } from '@/map-engine/MapEngine'
import type { DoorState, MapDefinition } from '@/maps/api'
import type { GridPoint, Polygon } from '@/types/geometry'
import type { RuntimeSettings } from '@/types/settings'
import type { PlacedSpellEffect, SpellEffectPatch, SpellPlacement } from '@/types/spells'
import type { PlacedToken, QuickTokenCreation, TokenPatch, TokenTemplate } from '@/types/tokens'
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
  createQuickToken: [creation: QuickTokenCreation, position: GridPoint]
  cancelTokenPlacement: []
  selectToken: [tokenId: string | null]
  moveToken: [tokenId: string, position: GridPoint]
  updateToken: [tokenId: string, patch: TokenPatch]
  deleteToken: [tokenId: string]
  beginSpellPlacement: [casterTokenId: string, presetId: string]
  beginFreeSpellPlacement: [presetId: string, origin: GridPoint]
  placeSpell: [placement: SpellPlacement, target: GridPoint]
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
type SpellMenuContext =
  | { readonly kind: 'caster'; readonly tokenId: string; readonly label: string }
  | { readonly kind: 'free'; readonly origin: GridPoint; readonly label: string }

const spellMenu = ref<{
  open: boolean
  context: SpellMenuContext | null
  x: number
  y: number
}>({ open: false, context: null, x: 0, y: 0 })
const tokenContextMenu = ref<{
  open: boolean
  tokenId: string | null
  x: number
  y: number
}>({ open: false, tokenId: null, x: 0, y: 0 })
const contextToken = computed(
  () => props.tokens.find((token) => token.id === tokenContextMenu.value.tokenId) ?? null,
)
const spellEffectDragging = ref(false)
const editingSpellEffectId = ref<string | null>(null)
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
    onTokenSelect: (tokenId) => {
      emit('selectToken', tokenId)
      if (tokenContextMenu.value.tokenId !== tokenId) tokenContextMenu.value.open = false
    },
    onTokenMove: (tokenId, position) => emit('moveToken', tokenId, position),
    onTokenLongPress: (tokenId, screenPoint) => {
      const token = props.tokens.find((entry) => entry.id === tokenId)
      if (!token || !host.value) {
        return
      }
      const bounds = host.value.getBoundingClientRect()
      spellMenu.value.open = false
      tokenContextMenu.value = {
        open: true,
        tokenId,
        x: Math.max(12, Math.min(screenPoint.x + 12, bounds.width - 320)),
        y: Math.max(12, Math.min(screenPoint.y + 12, bounds.height - 420)),
      }
    },
    onMapLongPress: (position, screenPoint) => {
      if (!host.value) return
      const bounds = host.value.getBoundingClientRect()
      spellMenu.value = {
        open: true,
        context: { kind: 'free', origin: position, label: 'Freie Platzierung' },
        x: Math.max(12, Math.min(screenPoint.x + 12, bounds.width - 360)),
        y: Math.max(12, Math.min(screenPoint.y + 12, bounds.height - 450)),
      }
    },
    onSpellPlace: (placement, target) => emit('placeSpell', placement, target),
    onSpellPlacementCancel: () => emit('cancelSpellPlacement'),
    onSpellEffectSelect: (effectId) => emit('selectSpellEffect', effectId),
    onSpellEffectUpdate: (effectId, patch) => emit('updateSpellEffect', effectId, patch),
    onSpellEffectDelete: (effectId) => emit('deleteSpellEffect', effectId),
    onSpellEffectDragStateChange: (active) => {
      spellEffectDragging.value = active
    },
    onSpellEffectEditStateChange: (effectId) => {
      editingSpellEffectId.value = effectId
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
  () => {
    spellMenu.value.open = false
    tokenContextMenu.value.open = false
    syncMap()
  },
)

watch(
  () => props.tokens,
  () => {
    engine?.setTokens(props.tokens, props.selectedTokenId)
    if (tokenContextMenu.value.tokenId && !contextToken.value) tokenContextMenu.value.open = false
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
    spellMenu.value.open = false
    tokenContextMenu.value.open = false
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

const finishSpellEffectEditing = (): void => {
  engine?.finishSpellEffectEditing()
}

const chooseSpell = (presetId: string): void => {
  const context = spellMenu.value.context
  spellMenu.value.open = false
  if (context?.kind === 'caster') {
    emit('beginSpellPlacement', context.tokenId, presetId)
  } else if (context?.kind === 'free') {
    emit('beginFreeSpellPlacement', presetId, context.origin)
  }
}

const createQuickToken = (creation: QuickTokenCreation): void => {
  const context = spellMenu.value.context
  spellMenu.value.open = false
  if (context?.kind === 'free') {
    emit('createQuickToken', creation, context.origin)
  }
}

const createSpellFromTokenContext = (tokenId: string): void => {
  const token = props.tokens.find((entry) => entry.id === tokenId)
  if (!token) return
  spellMenu.value = {
    open: true,
    context: { kind: 'caster', tokenId, label: token.name },
    x: tokenContextMenu.value.x,
    y: tokenContextMenu.value.y,
  }
  tokenContextMenu.value.open = false
}

const updateContextToken = (tokenId: string, patch: TokenPatch): void => {
  emit('updateToken', tokenId, patch)
}

const updateContextTokenColor = (tokenId: string, color: string): void => {
  updateContextToken(tokenId, { color })
}

const updateContextTokenVisionRange = (tokenId: string, visionRange: number): void => {
  updateContextToken(tokenId, { visionRange })
}

const updateContextTokenVisionEnabled = (tokenId: string, visionEnabled: boolean): void => {
  updateContextToken(tokenId, { visionEnabled })
}

const deleteContextToken = (tokenId: string): void => {
  tokenContextMenu.value.open = false
  emit('deleteToken', tokenId)
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
    <div v-if="editingSpellEffectId" class="spell-edit-banner" data-testid="spell-edit-banner">
      <span>Flächenform bearbeiten</span>
      <button type="button" data-testid="finish-spell-edit" @click="finishSpellEffectEditing">
        Fertig
      </button>
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
      :context-label="spellMenu.context?.label ?? ''"
      :token-creation-enabled="spellMenu.context?.kind === 'free'"
      :x="spellMenu.x"
      :y="spellMenu.y"
      @choose="chooseSpell"
      @create-quick-token="createQuickToken"
      @close="spellMenu.open = false"
    />
    <TokenContextMenu
      :open="tokenContextMenu.open"
      :token="contextToken"
      :x="tokenContextMenu.x"
      :y="tokenContextMenu.y"
      @update-color="updateContextTokenColor"
      @update-vision-range="updateContextTokenVisionRange"
      @update-vision-enabled="updateContextTokenVisionEnabled"
      @create-spell="createSpellFromTokenContext"
      @delete-token="deleteContextToken"
      @close="tokenContextMenu.open = false"
    />
  </main>
</template>
