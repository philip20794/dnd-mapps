import { Application, Container, Graphics, Rectangle } from 'pixi.js'
import { entryLevelId, getDefaultLevelId } from '@/maps/api'
import type { DoorState, MapDefinition } from '@/maps/api'
import { createDefaultObjectRegistry, createRuntimeObject, resolveMapObject } from '@/map-objects'
import type { ResolvedMapObject, RuntimeMapObject, VerticalTransitionConfig } from '@/map-objects'
import type { GridPoint, Polygon } from '@/types/geometry'
import type { PixelPoint } from '@/types/geometry'
import type { RuntimeSettings } from '@/types/settings'
import { defaultRuntimeSettings, normalizeMapRotation } from '@/types/settings'
import {
  FEET_PER_GRID_UNIT,
  findSpellAreaPreset,
  type PlacedSpellEffect,
  type SpellAreaPreset,
  type SpellEffectPatch,
  type SpellPlacement,
} from '@/types/spells'
import type { PlacedToken } from '@/types/tokens'
import {
  fitCameraToMap,
  panCamera,
  resetCamera,
  rotateCameraAt,
  zoomCameraAt,
} from './camera/camera'
import { TouchCameraGesture } from './camera/TouchCameraGesture'
import { AnimationManager } from './animations/AnimationManager'
import {
  createMovementSegmentIndex,
  isTokenMoveAllowed,
  movementSegmentsForMap,
  movementSegmentsNear,
  type MovementSegmentIndex,
} from './collision/movement'
import { FogRenderer, type FogRenderState } from './fog/FogRenderer'
import {
  isSharedFogVisibility,
  resolveFogVisibilityTokens,
  sharedFogVisibilityMode,
  type ExplorationMask,
  type FogVisibilityMode,
} from './fog/fogState'
import {
  clientToLocal,
  hexCentersForBounds,
  hexCorners,
  pixelsToGrid,
  screenToWorld,
  snapGridPoint,
} from './grid/coordinates'
import { createLayerMap, layerOrder, type PixiLayerMap } from './layers'
import { collectFogLightSources } from './lighting/lightSources'
import { ResourceManager } from './resources/ResourceManager'
import {
  SpellEffectRenderer,
  type SpellEffectActiveMode,
  type SpellEffectPreview,
} from './spells/SpellEffectRenderer'
import {
  effectLocalToWorld,
  pointIsInsideSpellEffect,
  resolveSpellEffectPosition,
  spellEffectLocalHandles,
  worldPointToEffectLocal,
} from './spells/geometry'
import {
  TokenDragFrameQueue,
  TokenRenderer,
  type TokenRendererHandlers,
} from './tokens/TokenRenderer'
import {
  combineVisibilityFieldsWithPreparedGeometry,
  prepareVisibilityGeometry,
  visibilityTokenStateKey,
  type PreparedVisibilityGeometry,
  type VisibilityField,
} from './visibility/visibility'
import type { FogLightSource } from './lighting/lightSources'
import { MapEditorController } from './editor/MapEditorController'
import type { MapEditorSelection, MapEditorState } from '@/map-editor/types'
import { MaterialRenderer, type RenderedMaterialLayers } from './materials/MaterialRenderer'
import {
  createStaticObjectChunks,
  isStaticChunkCandidate,
  StaticObjectChunkRenderer,
  visibleMapBounds,
} from './chunks'

export interface EngineFogState {
  readonly enabled: boolean
  readonly persistExploration: boolean
  readonly visibilityMode: FogVisibilityMode
  readonly explored: ExplorationMask | null
}

export interface MapEngineHandlers {
  readonly onTokenSelect: (tokenId: string | null) => void
  readonly onTokenMove: (tokenId: string, position: GridPoint) => void
  readonly onTokenLongPress: (tokenId: string, screenPoint: PixelPoint) => void
  readonly onTokenRenameRequest?: (tokenId: string, screenPoint: PixelPoint) => void
  readonly onMapLongPress: (position: GridPoint, screenPoint: PixelPoint) => void
  readonly onSpellPlace: (placement: SpellPlacement, target: GridPoint) => void
  readonly onSpellPlacementCancel: () => void
  readonly onSpellEffectSelect: (effectId: string) => void
  readonly onSpellEffectUpdate: (effectId: string, patch: SpellEffectPatch) => void
  readonly onSpellEffectDelete: (effectId: string) => void
  readonly onSpellEffectDragStateChange: (active: boolean) => void
  readonly onSpellEffectEditStateChange: (effectId: string | null) => void
  readonly onDoorToggle: (doorId: string) => void
  readonly onLevelTransition: (transition: VerticalTransitionConfig, sourceObjectId: string) => void
  readonly onCameraChange: (camera: RuntimeSettings['camera']) => void
  readonly onMapRotationChange?: (rotation: RuntimeSettings['mapRotation']) => void
  readonly onExplore: (mapId: string, levelId: string, polygons: readonly Polygon[]) => void
  readonly onError: (message: string) => void
  readonly onEditorSelect?: (selection: MapEditorSelection | null) => void
  readonly onEditorCommit?: (map: MapDefinition, selection: MapEditorSelection | null) => void
}

export type MapInteractionMode = 'play' | 'map-editor'

interface PanState {
  readonly pointerId: number
  readonly last: { readonly x: number; readonly y: number }
}

interface MapLongPressState {
  readonly pointerId: number
  readonly startScreen: PixelPoint
  readonly position: GridPoint
  timer: number | null
}

type SpellEffectInteractionMode =
  | 'pending-long-press'
  | 'blocked'
  | 'move-ready'
  | 'move'
  | 'resize'
  | 'rotate'

interface SpellEffectInteraction {
  readonly pointerId: number
  readonly effect: PlacedSpellEffect
  readonly mode: SpellEffectInteractionMode
  readonly startGrid: GridPoint
  readonly startScreen: PixelPoint
  workingEffect: PlacedSpellEffect
  pendingPatch: SpellEffectPatch | null
}

export class MapEngine {
  private readonly registry = createDefaultObjectRegistry()
  private readonly animations = new AnimationManager()
  private readonly resources = new ResourceManager()
  private readonly fogRenderer = new FogRenderer()
  private readonly tokenRenderer = new TokenRenderer()
  private readonly spellEffectRenderer = new SpellEffectRenderer()
  private readonly materialRenderer = new MaterialRenderer()
  private renderedMaterials: RenderedMaterialLayers | null = null
  private staticChunkRenderer: StaticObjectChunkRenderer | null = null
  private readonly world = new Container()
  private readonly layers: PixiLayerMap = createLayerMap()
  private readonly runtimeObjects: RuntimeMapObject[] = []
  private app: Application | null = null
  private map: MapDefinition | null = null
  private currentLevelId = 'ground'
  private tokens: readonly PlacedToken[] = []
  private selectedTokenId: string | null = null
  private spellEffects: readonly PlacedSpellEffect[] = []
  private selectedSpellEffectId: string | null = null
  private spellPlacement: SpellPlacement | null = null
  private spellPlacementTarget: GridPoint | null = null
  private spellEffectInteraction: SpellEffectInteraction | null = null
  private spellEffectLongPressTimer: number | null = null
  private editingSpellEffectId: string | null = null
  private spellEffectFrame: number | null = null
  private pendingSpellEffectPoint: GridPoint | null = null
  private doorStates: Readonly<Record<string, DoorState>> = {}
  private settings: RuntimeSettings = defaultRuntimeSettings
  private fogState: EngineFogState = {
    enabled: false,
    persistExploration: true,
    visibilityMode: sharedFogVisibilityMode,
    explored: null,
  }
  private currentVisiblePolygons: readonly Polygon[] = []
  private currentVisibilityFields: readonly VisibilityField[] = []
  private panState: PanState | null = null
  private mapLongPress: MapLongPressState | null = null
  private readonly touchCameraGesture = new TouchCameraGesture()
  private touchCameraFrame: number | null = null
  private touchCameraRotationRemainder = 0
  private readonly capturedPointerIds = new Set<number>()
  private interactionMode: MapInteractionMode = 'play'
  private editorState: MapEditorState = {
    tool: 'select',
    selection: null,
    snap: true,
    objectTemplate: null,
    material: 'stone',
    brushSize: 'medium',
    materialRotation: 0,
    materialScale: 1,
    materialAlpha: 1,
    decalKind: 'crack',
  }
  private editorTouchStart: { readonly pointerId: number; screen: PixelPoint } | null = null
  private spacePressed = false
  private movementSegmentIndex: MovementSegmentIndex | null = null
  private preparedVisibilityGeometry: PreparedVisibilityGeometry | null = null
  private cachedFogLightSources: readonly FogLightSource[] | null = null
  private visibilityRevision = 0
  private cachedVisibilityInputKey: string | null = null
  private currentDoorStateKey = ''
  private readonly tokenDragQueue = new TokenDragFrameQueue()
  private readonly editorController: MapEditorController
  private pendingMaterialChunks: ReadonlySet<string> | null = null
  private readonly tokenRendererHandlers: TokenRendererHandlers = {
    onSelect: (tokenId) => this.handlers.onTokenSelect(tokenId),
    onMoveEnd: (tokenId, position) => this.handlers.onTokenMove(tokenId, position),
    onLongPress: (tokenId, screenPoint) => {
      this.handlers.onTokenLongPress(tokenId, screenPoint)
      this.renderTokens()
    },
    onRenameRequest: (tokenId, screenPoint) =>
      this.handlers.onTokenRenameRequest?.(tokenId, screenPoint),
    constrainMove: (tokenId, from, proposed) => this.constrainTokenMove(tokenId, from, proposed),
  }

  public constructor(
    private readonly host: HTMLElement,
    private readonly handlers: MapEngineHandlers,
  ) {
    this.editorController = new MapEditorController(this.layers.selection, {
      onSelect: (selection) => this.handlers.onEditorSelect?.(selection),
      onCommit: (map, selection, dirtyMaterialChunks) => {
        this.pendingMaterialChunks = dirtyMaterialChunks ?? null
        this.handlers.onEditorCommit?.(map, selection)
      },
    })
  }

  public async init(): Promise<void> {
    try {
      this.app = new Application()
      await this.app.init({
        background: '#111418',
        resizeTo: this.host,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        culler: { updateTransform: false },
      })
      this.host.appendChild(this.app.canvas)
      this.host.classList.add('map-engine-host')
      this.world.eventMode = 'static'
      this.app.stage.addChild(this.world)
      for (const layerName of layerOrder) {
        this.world.addChild(this.layers[layerName])
      }
      this.configureLayerInteractivity()

      this.app.ticker.add((ticker) => {
        this.animations.update(ticker.deltaMS / 1000)
        this.tokenRenderer.update(ticker.deltaMS / 1000)
      })

      this.installDomEvents()
      this.applyCamera()
    } catch (error) {
      this.handlers.onError(
        error instanceof Error
          ? `PixiJS konnte nicht initialisiert werden: ${error.message}`
          : 'PixiJS konnte nicht initialisiert werden.',
      )
    }
  }

  public setMap(
    map: MapDefinition,
    doorStates: Readonly<Record<string, DoorState>>,
    levelId = getDefaultLevelId(map),
  ): void {
    if (
      this.pendingMaterialChunks &&
      this.map?.id === map.id &&
      this.currentLevelId === levelId &&
      this.map.width === map.width &&
      this.map.height === map.height &&
      this.map.gridSize === map.gridSize &&
      this.renderedMaterials
    ) {
      const dirty = this.pendingMaterialChunks
      this.pendingMaterialChunks = null
      this.map = map
      this.doorStates = doorStates
      const definitions = (map.materialLayers ?? []).filter(
        (layer) => entryLevelId(layer, map) === levelId,
      )
      this.renderedMaterials.refreshChunks(definitions, map.width, map.height, map.gridSize, dirty)
      this.editorController.setMap(map, levelId)
      this.updateChunkVisibility()
      return
    }
    this.pendingMaterialChunks = null
    this.cancelMapPointerInteractions()
    this.map = map
    this.doorStates = doorStates
    this.currentLevelId = levelId
    this.currentDoorStateKey = this.doorStateKey(map, doorStates)
    this.invalidateMovementGeometry()
    this.invalidateVisibilityGeometry()
    this.currentVisiblePolygons = []
    this.renderMap()
    this.renderTokens()
    this.renderSpellEffects()
    this.updateVisibility()
    this.editorController.setMap(map, levelId)
  }

  public setInteractionMode(mode: MapInteractionMode): void {
    if (this.interactionMode === mode) return
    this.cancelMapPointerInteractions()
    this.interactionMode = mode
    this.layers.tokens.interactiveChildren = mode === 'play' && this.spellPlacement === null
    this.layers.interactiveObjects.interactiveChildren = mode === 'play'
    this.layers.wallsDoors.interactiveChildren = mode === 'play'
  }

  public setEditorState(state: MapEditorState): void {
    this.editorState = state
    this.editorController.setState(state)
  }

  public setLevel(levelId: string): void {
    if (!this.map || this.currentLevelId === levelId) {
      return
    }
    this.cancelMapPointerInteractions()
    this.currentLevelId = levelId
    this.invalidateMovementGeometry()
    this.invalidateVisibilityGeometry()
    this.currentVisiblePolygons = []
    this.renderMap()
    this.renderTokens()
    this.renderSpellEffects()
    this.updateVisibility()
    this.editorController.setMap(this.map, levelId)
  }

  public setTokens(tokens: readonly PlacedToken[], selectedTokenId: string | null): void {
    const tokensChanged = this.tokens !== tokens
    const selectionChanged = this.selectedTokenId !== selectedTokenId
    this.tokens = tokens
    this.selectedTokenId = selectedTokenId
    if (tokensChanged || selectionChanged) {
      this.renderTokens()
    }
    if (tokensChanged) {
      this.renderSpellEffects()
      this.updateVisibility()
    }
  }

  public setSpellEffects(
    effects: readonly PlacedSpellEffect[],
    selectedSpellEffectId: string | null,
  ): void {
    this.spellEffects = effects
    this.selectedSpellEffectId = selectedSpellEffectId
    if (
      this.editingSpellEffectId &&
      this.editingSpellEffectId !== selectedSpellEffectId &&
      !this.spellEffectInteraction
    ) {
      this.setSpellEffectEditing(null)
    }
    this.renderSpellEffects()
  }

  public finishSpellEffectEditing(): void {
    this.cancelSpellEffectInteraction()
    this.setSpellEffectEditing(null)
    this.renderSpellEffects()
  }

  public setSpellPlacement(placement: SpellPlacement | null): void {
    if (placement) {
      this.cancelTouchCameraGesture()
      this.cancelSpellEffectInteraction()
      this.setSpellEffectEditing(null)
    }
    this.spellPlacement = placement
    const caster =
      placement?.kind === 'caster'
        ? this.tokens.find((token) => token.id === placement.casterTokenId)
        : undefined
    const preset = placement ? findSpellAreaPreset(placement.presetId) : undefined
    this.spellPlacementTarget =
      placement?.kind === 'free'
        ? placement.origin
        : caster && preset
          ? preset.origin === 'caster'
            ? { x: caster.position.x + preset.sizeFeet / FEET_PER_GRID_UNIT, y: caster.position.y }
            : caster.position
          : null
    this.layers.tokens.interactiveChildren = this.interactionMode === 'play' && placement === null
    this.renderSpellEffects()
  }

  public setDoorStates(doorStates: Readonly<Record<string, DoorState>>): void {
    const doorStateKey = this.map ? this.doorStateKey(this.map, doorStates) : ''
    if (doorStateKey === this.currentDoorStateKey) {
      this.doorStates = doorStates
      return
    }
    this.doorStates = doorStates
    this.currentDoorStateKey = doorStateKey
    this.invalidateMovementGeometry()
    this.invalidateVisibilityGeometry()
    if (this.map) {
      this.renderMap()
      this.renderTokens()
      this.renderSpellEffects()
      this.updateVisibility()
    }
  }

  public setSettings(settings: RuntimeSettings): void {
    const gridVisibilityChanged = this.settings.grid.visible !== settings.grid.visible
    const lightingChanged = this.settings.lighting.enabled !== settings.lighting.enabled
    this.settings = settings
    this.animations.setEnabled(settings.animations.enabled)
    this.animations.setReducedMotion(settings.animations.reduced)
    this.layers.light.visible = settings.lighting.enabled
    this.applyCamera()
    this.editorController.setZoom(settings.camera.zoom)
    if (this.map && gridVisibilityChanged) {
      this.renderMap()
      this.renderTokens()
      this.renderSpellEffects()
      this.renderFog()
    }
    if (lightingChanged) {
      this.cachedFogLightSources = null
      this.cachedVisibilityInputKey = null
      this.updateVisibility()
    }
  }

  public setFogState(fogState: EngineFogState): void {
    const activated = !this.fogState.enabled && fogState.enabled
    const persistenceActivated =
      fogState.enabled && !this.fogState.persistExploration && fogState.persistExploration
    const visibilityModeChanged =
      this.fogState.visibilityMode.kind !== fogState.visibilityMode.kind ||
      (this.fogState.visibilityMode.kind === 'player' &&
        fogState.visibilityMode.kind === 'player' &&
        this.fogState.visibilityMode.tokenId !== fogState.visibilityMode.tokenId)
    this.fogState = fogState
    if (activated || persistenceActivated || visibilityModeChanged) {
      this.cachedVisibilityInputKey = null
      this.updateVisibility()
      return
    }
    this.renderFog()
  }

  public resetCamera(): void {
    const bounds = this.host.getBoundingClientRect()
    this.settings = {
      ...this.settings,
      camera:
        this.map && bounds.width > 0 && bounds.height > 0
          ? fitCameraToMap(this.map, bounds, 32, normalizeMapRotation(this.settings.mapRotation))
          : resetCamera(),
    }
    this.applyCamera()
    this.handlers.onCameraChange(this.settings.camera)
  }

  public clientToGrid(clientX: number, clientY: number): GridPoint | null {
    return this.clientToGridPoint(clientX, clientY, this.settings.grid.snap)
  }

  private clientToGridPoint(clientX: number, clientY: number, snap: boolean): GridPoint | null {
    if (!this.map) {
      return null
    }

    const bounds = this.host.getBoundingClientRect()
    const local = clientToLocal({ x: clientX, y: clientY }, bounds)
    const mapPixelSize = {
      x: this.map.width * this.map.gridSize,
      y: this.map.height * this.map.gridSize,
    }
    const world = screenToWorld(
      local,
      this.settings.camera,
      normalizeMapRotation(this.settings.mapRotation),
      mapPixelSize,
    )
    return snapGridPoint(pixelsToGrid(world, this.map.gridSize), snap)
  }

  public destroy(): void {
    this.cancelMapPointerInteractions()
    this.host.classList.remove('map-engine-host')
    this.removeDomEvents()
    this.staticChunkRenderer?.destroy()
    this.staticChunkRenderer = null
    this.spellEffectRenderer.clear()
    this.cleanupRuntimeObjects()
    this.fogRenderer.destroy()
    this.animations.destroy()
    this.resources.clear()
    this.editorController.destroy()
    this.app?.destroy(true, { children: true })
    this.app = null
  }

  private renderMap(): void {
    if (!this.map) {
      return
    }

    this.staticChunkRenderer?.destroy()
    this.staticChunkRenderer = null
    this.spellEffectRenderer.clear()
    this.renderedMaterials = null
    this.cleanupRuntimeObjects()
    for (const layerName of layerOrder) {
      if (layerName !== 'tokens' && layerName !== 'selection' && layerName !== 'fog') {
        this.layers[layerName]
          .removeChildren()
          .forEach((child) => child.destroy({ children: true }))
      }
    }
    this.animations.clear()
    this.animations.setEnabled(this.settings.animations.enabled)
    this.animations.setReducedMotion(this.settings.animations.reduced)

    this.drawBackgroundAndGrid(this.map)
    this.drawMaterials(this.map)
    this.drawSpawnPoints(this.map)

    const renderContext = {
      gridSize: this.map.gridSize,
      resources: this.resources,
      animations: this.animations,
      emitInteraction: (objectId: string) => this.handleObjectInteraction(objectId),
    }
    const staticObjects: ResolvedMapObject[] = []
    this.map.objects.forEach((object, index) => {
      if (!this.isOnCurrentLevel(object)) {
        return
      }
      const doorState = object.id ? this.doorStates[object.id] : undefined
      const definition = resolveMapObject(
        doorState ? { ...object, interactionState: doorState } : object,
        this.registry,
        index,
      )
      if (isStaticChunkCandidate(definition)) {
        staticObjects.push(definition)
        return
      }
      const runtime = createRuntimeObject(definition, this.registry, renderContext)
      const cullPadding = this.map!.gridSize
      runtime.container.cullable = true
      runtime.container.cullableChildren = false
      runtime.container.cullArea = new Rectangle(
        -cullPadding,
        -cullPadding,
        definition.width * this.map!.gridSize + cullPadding * 2,
        definition.height * this.map!.gridSize + cullPadding * 2,
      )
      this.runtimeObjects.push(runtime)
      this.layers[definition.layer].addChild(runtime.container)
      if (runtime.light) {
        this.layers.light.addChild(runtime.light)
      }
    })

    this.staticChunkRenderer = new StaticObjectChunkRenderer(
      createStaticObjectChunks(staticObjects, this.map.width, this.map.height),
      this.layers,
      this.registry,
      renderContext,
      this.map.gridSize,
    )
    this.updateChunkVisibility()

    this.layers.light.visible = this.settings.lighting.enabled
  }

  private configureLayerInteractivity(): void {
    this.layers.background.eventMode = 'none'
    this.layers.materialBase.eventMode = 'none'
    this.layers.floor.eventMode = 'none'
    this.layers.materialEdges.eventMode = 'none'
    this.layers.grid.eventMode = 'none'
    this.layers.terrainStatic.eventMode = 'none'
    this.layers.materialDecals.eventMode = 'none'
    this.layers.terrainAnimated.eventMode = 'none'
    this.layers.objectsStatic.eventMode = 'none'
    this.layers.interactiveObjects.eventMode = 'static'
    this.layers.wallsDoors.eventMode = 'static'
    this.layers.tokens.eventMode = 'passive'
    this.layers.effects.eventMode = 'none'
    this.layers.spellEffects.eventMode = 'none'
    this.layers.light.eventMode = 'none'
    this.layers.fog.eventMode = 'none'
    this.layers.selection.eventMode = 'none'
  }

  private drawMaterials(map: MapDefinition): void {
    const definitions = (map.materialLayers ?? []).filter(
      (layer) => entryLevelId(layer, map) === this.currentLevelId,
    )
    if (definitions.length === 0) return
    const rendered = this.materialRenderer.render(definitions, map.width, map.height, map.gridSize)
    this.renderedMaterials = rendered
    this.layers.materialBase.addChild(rendered.base)
    this.layers.materialEdges.addChild(rendered.edges)
    this.layers.materialDecals.addChild(rendered.decals)
  }

  private drawBackgroundAndGrid(map: MapDefinition): void {
    const background = new Graphics()
    const width = map.width * map.gridSize
    const height = map.height * map.gridSize
    background.rect(0, 0, width, height).fill({ color: 0x1b2026 })
    background.rect(0, 0, width, height).stroke({ color: 0x4b5563, width: 4, alpha: 0.9 })
    this.layers.background.addChild(background)

    if (this.settings.grid.visible) {
      const grid = new Graphics()
      for (const center of hexCentersForBounds(map.width, map.height)) {
        const corners = hexCorners(center)
        const first = corners[0]
        if (!first) {
          continue
        }
        grid.moveTo(first.x * map.gridSize, first.y * map.gridSize)
        for (const corner of corners.slice(1)) {
          grid.lineTo(corner.x * map.gridSize, corner.y * map.gridSize)
        }
        grid.lineTo(first.x * map.gridSize, first.y * map.gridSize)
      }
      grid.stroke({ color: 0x120e0a, width: Math.max(1, map.gridSize * 0.018), alpha: 0.3 })
      this.layers.grid.addChild(grid)
    }
  }

  private drawSpawnPoints(map: MapDefinition): void {
    const graphics = new Graphics()
    for (const spawn of map.spawnPoints.filter((entry) => this.isOnCurrentLevel(entry))) {
      graphics
        .circle(
          spawn.position.x * map.gridSize,
          spawn.position.y * map.gridSize,
          spawn.radius * map.gridSize,
        )
        .stroke({ color: 0x22c55e, width: 2, alpha: 0.45 })
    }
    this.layers.effects.addChild(graphics)
  }

  private renderTokens(): void {
    if (!this.map) {
      return
    }
    this.tokenRenderer.render(
      this.layers.tokens,
      this.layers.selection,
      this.activeTokens(),
      this.selectedTokenId,
      this.map.gridSize,
      this.settings.camera,
      {
        x: this.map.width * this.map.gridSize,
        y: this.map.height * this.map.gridSize,
      },
      normalizeMapRotation(this.settings.mapRotation),
      this.settings.grid,
      this.tokenRendererHandlers,
    )
  }

  private renderSpellEffects(): void {
    if (!this.map) {
      return
    }
    const interaction = this.spellEffectInteraction
    const effects = this.activeSpellEffects().map((effect) =>
      interaction?.effect.id === effect.id ? interaction.workingEffect : effect,
    )
    const activeMode: SpellEffectActiveMode =
      interaction?.mode === 'move' ||
      interaction?.mode === 'resize' ||
      interaction?.mode === 'rotate'
        ? interaction.mode
        : null
    this.spellEffectRenderer.render(
      this.layers.spellEffects,
      effects,
      this.activeTokens(),
      this.selectedSpellEffectId,
      this.map.gridSize,
      this.map.width,
      this.map.height,
      this.createSpellPreview(),
      this.editingSpellEffectId,
      activeMode ? (interaction?.effect.id ?? null) : null,
      activeMode,
    )
  }

  private createSpellPreview(): SpellEffectPreview | null {
    if (!this.map || !this.spellPlacement || !this.spellPlacementTarget) {
      return null
    }
    const placement = this.spellPlacement
    const preset = findSpellAreaPreset(placement.presetId)
    if (!preset) {
      return null
    }
    const caster =
      placement.kind === 'caster'
        ? this.tokens.find((token) => token.id === placement.casterTokenId)
        : undefined
    if (placement.kind === 'caster' && !caster) {
      return null
    }
    const target = caster
      ? this.clampSpellTarget(preset, caster.position, this.spellPlacementTarget)
      : this.spellPlacementTarget
    const position = caster && preset.origin === 'caster' ? caster.position : target
    const effect: PlacedSpellEffect = {
      id: 'spell-preview',
      mapId: this.map.id,
      levelId: this.currentLevelId,
      ...(caster ? { casterTokenId: caster.id } : {}),
      presetId: preset.id,
      name: preset.name,
      shape: preset.shape,
      position,
      rotation: 0,
      size: preset.sizeFeet / FEET_PER_GRID_UNIT,
      width: (preset.widthFeet ?? FEET_PER_GRID_UNIT) / FEET_PER_GRID_UNIT,
      heightFeet: preset.heightFeet,
      duration: preset.duration,
      color: preset.color,
      attachedToCaster:
        Boolean(caster) && preset.origin === 'caster' && preset.shape === 'emanation',
    }
    return { effect }
  }

  private updateVisibility(): void {
    if (!this.map || !this.fogState.enabled) {
      if (this.currentVisiblePolygons.length > 0) {
        this.currentVisiblePolygons = []
      }
      this.currentVisibilityFields = []
      this.renderFog()
      return
    }

    const visibilityTokens = resolveFogVisibilityTokens(
      this.activeTokens(),
      this.fogState.visibilityMode,
    )
    const inputKey = this.visibilityInputKey(visibilityTokens)
    if (inputKey === this.cachedVisibilityInputKey) {
      return
    }
    this.cachedVisibilityInputKey = inputKey
    this.currentVisibilityFields = combineVisibilityFieldsWithPreparedGeometry(
      visibilityTokens,
      this.map,
      this.visibilityGeometryForCurrentMap(),
      this.fogLightSourcesForCurrentMap(),
      this.currentLevelId,
    )
    this.currentVisiblePolygons = this.currentVisibilityFields.map((field) => field.polygon)

    if (isSharedFogVisibility(this.fogState.visibilityMode)) {
      this.handlers.onExplore(this.map.id, this.currentLevelId, this.currentVisiblePolygons)
    }
    this.renderFog()
  }

  private visibilityGeometryForCurrentMap(): PreparedVisibilityGeometry {
    if (!this.map) return { segments: [], blockers: [] }
    if (!this.preparedVisibilityGeometry) {
      this.preparedVisibilityGeometry = prepareVisibilityGeometry(
        this.map,
        this.doorStates,
        this.currentLevelId,
      )
    }
    return this.preparedVisibilityGeometry
  }

  private fogLightSourcesForCurrentMap(): readonly FogLightSource[] {
    if (!this.map || !this.settings.lighting.enabled) return []
    if (!this.cachedFogLightSources) {
      this.cachedFogLightSources = collectFogLightSources(
        this.map,
        this.doorStates,
        this.registry,
        this.currentLevelId,
      )
    }
    return this.cachedFogLightSources
  }

  private visibilityInputKey(tokens: readonly PlacedToken[]): string {
    const modeKey =
      this.fogState.visibilityMode.kind === 'shared'
        ? 'shared'
        : `player:${this.fogState.visibilityMode.tokenId}`
    return `${this.visibilityRevision}|${this.settings.lighting.enabled ? 1 : 0}|${modeKey}|${visibilityTokenStateKey(tokens)}`
  }

  private invalidateVisibilityGeometry(): void {
    this.preparedVisibilityGeometry = null
    this.cachedFogLightSources = null
    this.cachedVisibilityInputKey = null
    this.visibilityRevision += 1
  }

  private doorStateKey(
    map: MapDefinition,
    doorStates: Readonly<Record<string, DoorState>>,
  ): string {
    return map.doors
      .map((door) => `${door.id}:${doorStates[door.id] ?? door.defaultState}`)
      .join('|')
  }

  private renderFog(): void {
    if (!this.map) {
      return
    }

    const sharedVisibility = isSharedFogVisibility(this.fogState.visibilityMode)
    const state: FogRenderState = {
      enabled: this.fogState.enabled,
      persistExploration: sharedVisibility && this.fogState.persistExploration,
      visible: this.currentVisiblePolygons,
      visibilityFields: this.currentVisibilityFields,
      explored: sharedVisibility ? this.fogState.explored : null,
    }
    this.fogRenderer.render(this.layers.fog, this.map, state)
  }

  private applyCamera(): void {
    const rotation = normalizeMapRotation(this.settings.mapRotation)
    const mapPixelSize = this.map
      ? { x: this.map.width * this.map.gridSize, y: this.map.height * this.map.gridSize }
      : { x: 0, y: 0 }
    const offset =
      rotation === 90
        ? { x: mapPixelSize.y, y: 0 }
        : rotation === 180
          ? { x: mapPixelSize.x, y: mapPixelSize.y }
          : rotation === 270
            ? { x: 0, y: mapPixelSize.x }
            : { x: 0, y: 0 }

    this.world.position.set(
      this.settings.camera.x + offset.x * this.settings.camera.zoom,
      this.settings.camera.y + offset.y * this.settings.camera.zoom,
    )
    this.world.scale.set(this.settings.camera.zoom)
    this.world.rotation = (rotation * Math.PI) / 180
    this.tokenRenderer.setCamera(this.settings.camera, mapPixelSize, rotation)
    this.editorController.setZoom(this.settings.camera.zoom)
    this.updateChunkVisibility()
  }

  private updateChunkVisibility(): void {
    if (!this.map) return
    const viewport = this.host.getBoundingClientRect()
    const bounds = visibleMapBounds(
      this.map,
      this.settings.camera,
      normalizeMapRotation(this.settings.mapRotation),
      viewport,
      3,
    )
    this.renderedMaterials?.updateVisibility(bounds)
    this.staticChunkRenderer?.update(bounds, this.settings.camera.zoom)
  }

  private cleanupRuntimeObjects(): void {
    this.runtimeObjects.splice(0).forEach((runtime) => runtime.cleanup())
  }

  private isOnCurrentLevel(entry: { readonly levelId?: string }): boolean {
    return this.map ? entryLevelId(entry, this.map) === this.currentLevelId : false
  }

  private activeTokens(): readonly PlacedToken[] {
    if (!this.map) {
      return []
    }
    return this.tokens.filter(
      (token) => token.mapId === this.map?.id && this.isOnCurrentLevel(token),
    )
  }

  private activeSpellEffects(): readonly PlacedSpellEffect[] {
    if (!this.map) {
      return []
    }
    return this.spellEffects.filter(
      (effect) => effect.mapId === this.map?.id && this.isOnCurrentLevel(effect),
    )
  }

  private resolvedSpellEffect(effect: PlacedSpellEffect): PlacedSpellEffect {
    const caster = this.tokens.find((token) => token.id === effect.casterTokenId)
    return {
      ...effect,
      position: resolveSpellEffectPosition(effect, caster?.position),
    }
  }

  private findSpellEffectAt(point: GridPoint): PlacedSpellEffect | null {
    return (
      [...this.activeSpellEffects()]
        .reverse()
        .map((effect) => this.resolvedSpellEffect(effect))
        .find((effect) => pointIsInsideSpellEffect(point, effect)) ?? null
    )
  }

  private selectedSpellHandleAt(
    point: GridPoint,
    pointerType: PointerEvent['pointerType'],
  ): 'resize' | 'rotate' | null {
    if (
      !this.map ||
      !this.selectedSpellEffectId ||
      this.editingSpellEffectId !== this.selectedSpellEffectId
    ) {
      return null
    }
    const selected = this.activeSpellEffects().find(
      (effect) => effect.id === this.selectedSpellEffectId,
    )
    if (!selected) {
      return null
    }
    const effect = this.resolvedSpellEffect(selected)
    const handles = spellEffectLocalHandles(effect)
    const hitRadiusInPixels = pointerType === 'touch' ? 32 : pointerType === 'pen' ? 24 : 16
    const hitRadius = hitRadiusInPixels / (this.map.gridSize * this.settings.camera.zoom)
    const resize = effectLocalToWorld(handles.resize, effect)
    const rotate = effectLocalToWorld(handles.rotate, effect)
    if (Math.hypot(point.x - resize.x, point.y - resize.y) <= hitRadius) {
      return 'resize'
    }
    if (Math.hypot(point.x - rotate.x, point.y - rotate.y) <= hitRadius) {
      return 'rotate'
    }
    return null
  }

  private beginSpellEffectInteraction(
    event: PointerEvent,
    effect: PlacedSpellEffect,
    mode: SpellEffectInteractionMode,
    startGrid: GridPoint,
  ): void {
    this.clearSpellEffectLongPressTimer()
    this.capturePointer(event.pointerId)
    this.spellEffectInteraction = {
      pointerId: event.pointerId,
      effect,
      mode,
      startGrid,
      startScreen: { x: event.clientX, y: event.clientY },
      workingEffect: effect,
      pendingPatch: null,
    }
    if (mode === 'pending-long-press') {
      this.spellEffectLongPressTimer = window.setTimeout(() => {
        if (this.spellEffectInteraction?.mode !== 'pending-long-press') {
          return
        }
        this.spellEffectInteraction = { ...this.spellEffectInteraction, mode: 'move-ready' }
        this.spellEffectLongPressTimer = null
        this.setSpellEffectEditing(effect.id)
        this.renderSpellEffects()
      }, 520)
    } else {
      this.renderSpellEffects()
    }
  }

  private setSpellEffectEditing(effectId: string | null): void {
    if (this.editingSpellEffectId === effectId) return
    this.editingSpellEffectId = effectId
    this.handlers.onSpellEffectEditStateChange(effectId)
  }

  private resizeSpellEffect(effect: PlacedSpellEffect, point: GridPoint): SpellEffectPatch {
    const local = worldPointToEffectLocal(point, effect)
    let size: number
    switch (effect.shape) {
      case 'sphere':
      case 'cylinder':
      case 'emanation':
        size = Math.hypot(local.x, local.y)
        break
      case 'cube':
        size = Math.max(Math.abs(local.x), Math.abs(local.y)) * 2
        break
      case 'wall':
        size = Math.abs(local.x) * 2
        break
      case 'cone':
      case 'line':
        size = local.x
        break
    }
    size = Math.max(0.5, size)
    const widthRatio = effect.width / Math.max(effect.size, 0.5)
    return {
      size,
      width:
        effect.shape === 'line' || effect.shape === 'wall'
          ? Math.max(0.25, size * widthRatio)
          : effect.width,
    }
  }

  private rotateSpellEffect(effect: PlacedSpellEffect, point: GridPoint): SpellEffectPatch {
    const handles = spellEffectLocalHandles(effect)
    const handleAngle = Math.atan2(handles.rotate.y, handles.rotate.x)
    const pointerAngle = Math.atan2(point.y - effect.position.y, point.x - effect.position.x)
    return {
      rotation: ((pointerAngle - handleAngle) * 180) / Math.PI,
    }
  }

  private scheduleSpellEffectUpdate(point: GridPoint): void {
    this.pendingSpellEffectPoint = point
    if (this.spellEffectFrame !== null) return
    this.spellEffectFrame = window.requestAnimationFrame(() => {
      this.spellEffectFrame = null
      const pending = this.pendingSpellEffectPoint
      this.pendingSpellEffectPoint = null
      if (pending) this.applySpellEffectUpdate(pending)
    })
  }

  private flushSpellEffectUpdate(point?: GridPoint): void {
    if (this.spellEffectFrame !== null) {
      window.cancelAnimationFrame(this.spellEffectFrame)
      this.spellEffectFrame = null
    }
    const pending = point ?? this.pendingSpellEffectPoint
    this.pendingSpellEffectPoint = null
    if (pending) this.applySpellEffectUpdate(pending)
  }

  private applySpellEffectUpdate(point: GridPoint): void {
    const interaction = this.spellEffectInteraction
    if (!interaction) return
    let patch: SpellEffectPatch | null = null
    if (interaction.mode === 'move') {
      patch = {
        position: {
          x: interaction.effect.position.x + point.x - interaction.startGrid.x,
          y: interaction.effect.position.y + point.y - interaction.startGrid.y,
        },
      }
    } else if (interaction.mode === 'resize') {
      patch = this.resizeSpellEffect(interaction.effect, point)
    } else if (interaction.mode === 'rotate') {
      patch = this.rotateSpellEffect(interaction.effect, point)
    }
    if (!patch) return
    const changed =
      (patch.position !== undefined &&
        (patch.position.x !== interaction.effect.position.x ||
          patch.position.y !== interaction.effect.position.y)) ||
      (patch.rotation !== undefined && patch.rotation !== interaction.effect.rotation) ||
      (patch.size !== undefined && patch.size !== interaction.effect.size) ||
      (patch.width !== undefined && patch.width !== interaction.effect.width)
    if (!changed) {
      interaction.pendingPatch = null
      interaction.workingEffect = interaction.effect
    } else {
      interaction.pendingPatch = patch
      interaction.workingEffect = { ...interaction.effect, ...patch }
    }
    if (interaction.mode === 'move' && patch.position && this.map) {
      this.spellEffectRenderer.moveEffect(interaction.effect.id, patch.position, this.map.gridSize)
      return
    }
    this.renderSpellEffects()
  }

  private clearSpellEffectLongPressTimer(): void {
    if (this.spellEffectLongPressTimer !== null) {
      window.clearTimeout(this.spellEffectLongPressTimer)
      this.spellEffectLongPressTimer = null
    }
  }

  private finishSpellEffectInteraction(event: PointerEvent): boolean {
    const interaction = this.spellEffectInteraction
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return false
    }
    this.clearSpellEffectLongPressTimer()
    const point = this.clientToGridPoint(event.clientX, event.clientY, false)
    if (point) this.flushSpellEffectUpdate(point)
    else this.flushSpellEffectUpdate()
    if (interaction.mode === 'move') {
      const bounds = this.host.getBoundingClientRect()
      const droppedOnTrash =
        event.clientX >= bounds.right - 118 &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.bottom - 118 &&
        event.clientY <= bounds.bottom
      if (droppedOnTrash) {
        this.spellEffects = this.spellEffects.filter(
          (effect) => effect.id !== interaction.effect.id,
        )
        this.handlers.onSpellEffectDelete(interaction.effect.id)
      } else if (interaction.pendingPatch) {
        this.spellEffects = this.spellEffects.map((effect) =>
          effect.id === interaction.effect.id ? interaction.workingEffect : effect,
        )
        this.handlers.onSpellEffectUpdate(interaction.effect.id, interaction.pendingPatch)
      }
      this.host.classList.remove('spell-effect-moving')
      this.handlers.onSpellEffectDragStateChange(false)
      this.setSpellEffectEditing(null)
    } else if (
      (interaction.mode === 'resize' || interaction.mode === 'rotate') &&
      interaction.pendingPatch
    ) {
      this.spellEffects = this.spellEffects.map((effect) =>
        effect.id === interaction.effect.id ? interaction.workingEffect : effect,
      )
      this.handlers.onSpellEffectUpdate(interaction.effect.id, interaction.pendingPatch)
    }
    this.spellEffectInteraction = null
    this.renderSpellEffects()
    return true
  }

  private handleObjectInteraction(objectId: string): void {
    if (this.interactionMode === 'map-editor') return
    if (!this.map) {
      return
    }

    const objectIndex = this.map.objects.findIndex(
      (object) => object.id === objectId && this.isOnCurrentLevel(object),
    )
    const object = objectIndex >= 0 ? this.map.objects[objectIndex] : undefined
    if (!object) {
      return
    }

    const doorState = object.id ? this.doorStates[object.id] : undefined
    const definition = resolveMapObject(
      doorState ? { ...object, interactionState: doorState } : object,
      this.registry,
      objectIndex,
    )

    if (definition.transition) {
      this.handlers.onLevelTransition(definition.transition, definition.id)
      return
    }

    this.handlers.onDoorToggle(objectId)
  }

  private installDomEvents(): void {
    const canvas = this.app?.canvas
    if (!canvas) {
      return
    }
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.addEventListener('lostpointercapture', this.handleLostPointerCapture)
    canvas.addEventListener('contextmenu', this.preventContextMenu)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerCancel)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  private removeDomEvents(): void {
    const canvas = this.app?.canvas
    if (canvas) {
      canvas.removeEventListener('wheel', this.handleWheel)
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('pointerleave', this.handlePointerLeave)
      canvas.removeEventListener('lostpointercapture', this.handleLostPointerCapture)
      canvas.removeEventListener('contextmenu', this.preventContextMenu)
    }
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerCancel)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const bounds = this.host.getBoundingClientRect()
    const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1
    this.settings = {
      ...this.settings,
      camera: zoomCameraAt(this.settings.camera, local, zoomDelta),
    }
    this.applyCamera()
    this.handlers.onCameraChange(this.settings.camera)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (
      this.interactionMode === 'map-editor' &&
      event.button === 0 &&
      !this.spacePressed &&
      this.map
    ) {
      const bounds = this.host.getBoundingClientRect()
      const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
      const activeEditorPointer = this.editorController.activePointerId
      if (
        event.pointerType === 'touch' &&
        this.editorTouchStart !== null &&
        this.editorTouchStart.pointerId !== event.pointerId
      ) {
        const firstTouch = this.editorTouchStart
        if (activeEditorPointer !== null) this.editorController.cancelPointer(activeEditorPointer)
        this.touchCameraGesture.add(firstTouch.pointerId, clientToLocal(firstTouch.screen, bounds))
        this.touchCameraGesture.add(event.pointerId, local)
        this.editorTouchStart = null
        this.touchCameraRotationRemainder = 0
        this.capturePointer(event.pointerId)
        event.preventDefault()
        return
      }
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (point && this.editorController.pointerDown(event, point)) {
        if (event.pointerType === 'touch') {
          this.editorTouchStart = {
            pointerId: event.pointerId,
            screen: { x: event.clientX, y: event.clientY },
          }
        }
        this.capturePointer(event.pointerId)
        event.preventDefault()
      }
      return
    }
    if (this.spellPlacement) {
      if (event.button === 2) {
        event.preventDefault()
        this.handlers.onSpellPlacementCancel()
        return
      }
      if (event.button === 0) {
        const target = this.clientToGridPoint(event.clientX, event.clientY, false)
        const placement = this.spellPlacement
        const preset = findSpellAreaPreset(placement.presetId)
        const caster =
          placement.kind === 'caster'
            ? this.tokens.find((token) => token.id === placement.casterTokenId)
            : undefined
        if (target && preset && (placement.kind === 'free' || caster)) {
          event.preventDefault()
          const accepted = caster ? this.clampSpellTarget(preset, caster.position, target) : target
          this.handlers.onSpellPlace(placement, accepted)
        }
        return
      }
    }
    if (
      event.pointerType === 'touch' &&
      this.spellEffectInteraction &&
      this.tokenRenderer.isPointerActiveFor(event.pointerId)
    ) {
      this.capturePointer(event.pointerId)
      event.preventDefault()
      return
    }
    if (event.pointerType === 'touch' && this.spellEffectInteraction) {
      event.preventDefault()
      return
    }
    if (event.button === 0) {
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (point) {
        const handle = this.selectedSpellHandleAt(point, event.pointerType)
        const selected = this.activeSpellEffects().find(
          (effect) => effect.id === this.selectedSpellEffectId,
        )
        if (handle && selected) {
          event.preventDefault()
          if (this.tokenRenderer.isPointerActiveFor(event.pointerId)) {
            this.tokenDragQueue.cancel(event.pointerId)
            this.tokenRenderer.cancelPointerInteraction(event.pointerId)
          }
          this.cancelTouchCameraGesture()
          this.beginSpellEffectInteraction(event, this.resolvedSpellEffect(selected), handle, point)
          return
        }

        const bounds = this.host.getBoundingClientRect()
        const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
        const hitTokenId = this.map
          ? this.tokenRenderer.tokenIdAtScreenPoint(local, this.map.gridSize)
          : null
        if (hitTokenId) {
          if (this.tokenRenderer.isPointerActiveFor(event.pointerId)) {
            this.cancelTouchCameraGesture()
            this.capturePointer(event.pointerId)
          }
          event.preventDefault()
          return
        }

        if (this.tokenRenderer.isPointerActive) {
          if (event.pointerType === 'touch') {
            const bounds = this.host.getBoundingClientRect()
            this.clearMapLongPress()
            const touchCount = this.touchCameraGesture.size
            this.touchCameraGesture.add(
              event.pointerId,
              clientToLocal({ x: event.clientX, y: event.clientY }, bounds),
            )
            if (touchCount < 2 && this.touchCameraGesture.size === 2) {
              this.touchCameraRotationRemainder = 0
            }
            this.capturePointer(event.pointerId)
          }
          event.preventDefault()
          return
        }

        const hitEffect = this.findSpellEffectAt(point)
        if (hitEffect) {
          event.preventDefault()
          this.cancelTouchCameraGesture()
          this.tokenRenderer.cancelPointerInteraction()
          this.selectedSpellEffectId = hitEffect.id
          this.handlers.onSpellEffectSelect(hitEffect.id)
          if (this.editingSpellEffectId && this.editingSpellEffectId !== hitEffect.id) {
            this.setSpellEffectEditing(null)
          }
          this.renderSpellEffects()
          this.beginSpellEffectInteraction(event, hitEffect, 'pending-long-press', point)
          return
        }
      }
    }
    if (event.pointerType === 'touch' && event.button === 0 && this.map) {
      const bounds = this.host.getBoundingClientRect()
      const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
      const position = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (this.touchCameraGesture.size > 0) {
        this.clearMapLongPress()
      }
      const touchCount = this.touchCameraGesture.size
      this.touchCameraGesture.add(event.pointerId, local)
      if (touchCount < 2 && this.touchCameraGesture.size === 2) {
        this.touchCameraRotationRemainder = 0
      }
      if (this.touchCameraGesture.size === 1 && position) {
        this.beginMapLongPress(event.pointerId, local, position)
      } else {
        this.clearMapLongPress()
      }
      this.capturePointer(event.pointerId)
      event.preventDefault()
      return
    }
    if (event.button !== 1 && event.button !== 2 && !this.spacePressed) {
      return
    }
    event.preventDefault()
    this.panState = { pointerId: event.pointerId, last: { x: event.clientX, y: event.clientY } }
    this.capturePointer(event.pointerId)
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.editorTouchStart?.pointerId === event.pointerId) {
      this.editorTouchStart.screen = { x: event.clientX, y: event.clientY }
    }
    if (this.interactionMode === 'map-editor' && !this.touchCameraGesture.has(event.pointerId)) {
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (point && this.editorController.pointerMove(event, point)) {
        event.preventDefault()
        return
      }
    }
    if (this.spellPlacement) {
      const target = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (target) {
        this.spellPlacementTarget = target
        this.renderSpellEffects()
        event.preventDefault()
      }
      return
    }
    if (this.spellEffectInteraction?.pointerId === event.pointerId) {
      let interaction = this.spellEffectInteraction
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (!point) {
        return
      }
      if (interaction.mode === 'pending-long-press') {
        const distance = Math.hypot(
          event.clientX - interaction.startScreen.x,
          event.clientY - interaction.startScreen.y,
        )
        if (distance > 7) {
          this.clearSpellEffectLongPressTimer()
          interaction = { ...interaction, mode: 'blocked' }
          this.spellEffectInteraction = interaction
        }
        event.preventDefault()
        return
      }
      if (interaction.mode === 'blocked') {
        event.preventDefault()
        return
      }
      if (interaction.mode === 'move-ready') {
        const distance = Math.hypot(
          event.clientX - interaction.startScreen.x,
          event.clientY - interaction.startScreen.y,
        )
        if (distance <= 7) {
          event.preventDefault()
          return
        }
        interaction = { ...interaction, mode: 'move' }
        this.spellEffectInteraction = interaction
        this.host.classList.add('spell-effect-moving')
        this.handlers.onSpellEffectDragStateChange(true)
        this.renderSpellEffects()
      }
      this.scheduleSpellEffectUpdate(point)
      event.preventDefault()
      return
    }
    if (this.map) {
      if (this.tokenRenderer.isPointerActiveFor(event.pointerId)) {
        const bounds = this.host.getBoundingClientRect()
        this.queueTokenDrag(
          event.pointerId,
          clientToLocal({ x: event.clientX, y: event.clientY }, bounds),
        )
        event.preventDefault()
        return
      }
    }
    if (this.spellEffectInteraction) {
      if (event.pointerType === 'touch') event.preventDefault()
      return
    }

    if (this.touchCameraGesture.has(event.pointerId)) {
      const bounds = this.host.getBoundingClientRect()
      const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
      if (
        this.mapLongPress?.pointerId === event.pointerId &&
        Math.hypot(
          local.x - this.mapLongPress.startScreen.x,
          local.y - this.mapLongPress.startScreen.y,
        ) > 7
      ) {
        this.clearMapLongPress(event.pointerId)
      }
      this.touchCameraGesture.move(event.pointerId, local)
      this.scheduleTouchCameraUpdate()
      event.preventDefault()
      return
    }

    if (!this.panState || this.panState.pointerId !== event.pointerId) {
      return
    }
    const delta = {
      x: event.clientX - this.panState.last.x,
      y: event.clientY - this.panState.last.y,
    }
    this.panState = { pointerId: event.pointerId, last: { x: event.clientX, y: event.clientY } }
    this.settings = {
      ...this.settings,
      camera: panCamera(this.settings.camera, delta),
    }
    this.applyCamera()
    this.handlers.onCameraChange(this.settings.camera)
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.editorTouchStart?.pointerId === event.pointerId) this.editorTouchStart = null
    if (this.interactionMode === 'map-editor') {
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (point && this.editorController.pointerUp(event, point)) {
        this.releasePointer(event.pointerId)
        event.preventDefault()
        return
      }
    }
    this.clearMapLongPress(event.pointerId)
    if (this.finishSpellEffectInteraction(event)) {
      this.releasePointer(event.pointerId)
      event.preventDefault()
      return
    }
    if (this.map) {
      const tokenPointerWasActive = this.tokenRenderer.isPointerActiveFor(event.pointerId)
      if (tokenPointerWasActive) {
        const bounds = this.host.getBoundingClientRect()
        this.flushTokenDrag(
          event.pointerId,
          clientToLocal({ x: event.clientX, y: event.clientY }, bounds),
        )
      }
      const finishedTokenDrag = tokenPointerWasActive
        ? this.tokenRenderer.finishDrag(
            event.pointerId,
            this.settings.grid,
            this.map.gridSize,
            this.tokenRendererHandlers,
          )
        : false
      if (finishedTokenDrag) {
        event.preventDefault()
      }
    }

    if (this.finishTouchCameraPointer(event)) {
      event.preventDefault()
    }

    if (this.panState?.pointerId === event.pointerId) {
      this.panState = null
    }
    this.releasePointer(event.pointerId)
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.cancelPointerInteraction(event.pointerId)) event.preventDefault()
    this.releasePointer(event.pointerId)
  }

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    this.capturedPointerIds.delete(event.pointerId)
    this.cancelPointerInteraction(event.pointerId)
  }

  private readonly handlePointerLeave = (event: PointerEvent): void => {
    if (this.capturedPointerIds.has(event.pointerId)) return
    this.cancelPointerInteraction(event.pointerId)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.spellEffectInteraction) {
      this.cancelSpellEffectInteraction()
      this.setSpellEffectEditing(null)
      this.renderSpellEffects()
      return
    }
    if (event.code === 'Escape' && this.interactionMode === 'map-editor') {
      if (this.editorController.cancelPointer() || this.editorController.cancelPendingTool()) {
        event.preventDefault()
      }
      return
    }
    if (event.code === 'Escape' && this.editingSpellEffectId) {
      this.finishSpellEffectEditing()
      return
    }
    if (event.code === 'Escape' && this.spellPlacement) {
      event.preventDefault()
      this.handlers.onSpellPlacementCancel()
      return
    }
    if (event.code === 'Space') {
      this.spacePressed = true
    }
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      this.spacePressed = false
    }
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private readonly constrainTokenMove = (
    tokenId: string,
    from: GridPoint,
    proposed: GridPoint,
  ): GridPoint => {
    if (!this.map) {
      return proposed
    }

    const token = this.tokens.find((entry) => entry.id === tokenId)
    if (!token) {
      return from
    }

    const tokenRadius = Math.max(0.2, token.size / 2)
    const blockers = movementSegmentsNear(
      this.movementIndexForCurrentMap(),
      from,
      proposed,
      tokenRadius,
    )
    return isTokenMoveAllowed(from, proposed, tokenRadius, blockers, this.map) ? proposed : from
  }

  private movementIndexForCurrentMap(): MovementSegmentIndex {
    if (!this.map) {
      return createMovementSegmentIndex([])
    }
    if (!this.movementSegmentIndex) {
      this.movementSegmentIndex = createMovementSegmentIndex(
        movementSegmentsForMap(this.map, this.doorStates, this.currentLevelId),
      )
    }
    return this.movementSegmentIndex
  }

  private invalidateMovementGeometry(): void {
    this.movementSegmentIndex = null
  }

  private queueTokenDrag(pointerId: number, point: PixelPoint): void {
    this.tokenDragQueue.schedule(pointerId, point, (nextPointerId, nextPoint) =>
      this.applyTokenDrag(nextPointerId, nextPoint),
    )
  }

  private flushTokenDrag(pointerId: number, finalPoint?: PixelPoint): void {
    this.tokenDragQueue.flush(
      pointerId,
      (nextPointerId, point) => this.applyTokenDrag(nextPointerId, point),
      finalPoint,
    )
  }

  private cancelPendingTokenDrag(): void {
    this.tokenDragQueue.cancel()
  }

  private cancelTokenInteractions(): void {
    this.cancelPendingTokenDrag()
    this.tokenRenderer.cancelPointerInteraction()
  }

  private beginMapLongPress(pointerId: number, screenPoint: PixelPoint, position: GridPoint): void {
    this.clearMapLongPress()
    const state: MapLongPressState = {
      pointerId,
      startScreen: screenPoint,
      position,
      timer: null,
    }
    state.timer = window.setTimeout(() => {
      if (
        this.mapLongPress !== state ||
        this.touchCameraGesture.size !== 1 ||
        !this.touchCameraGesture.has(pointerId) ||
        this.tokenRenderer.isPointerActive ||
        this.spellEffectInteraction ||
        this.spellPlacement
      ) {
        if (this.mapLongPress === state) this.mapLongPress = null
        return
      }
      this.mapLongPress = null
      this.touchCameraGesture.remove(pointerId)
      this.cancelTouchCameraFrame()
      this.touchCameraRotationRemainder = 0
      this.handlers.onMapLongPress(position, screenPoint)
    }, 520)
    this.mapLongPress = state
  }

  private clearMapLongPress(pointerId?: number): boolean {
    const state = this.mapLongPress
    if (!state || (pointerId !== undefined && state.pointerId !== pointerId)) {
      return false
    }
    if (state.timer !== null) window.clearTimeout(state.timer)
    this.mapLongPress = null
    return true
  }

  private scheduleTouchCameraUpdate(): void {
    if (this.touchCameraFrame !== null) return
    this.touchCameraFrame = window.requestAnimationFrame(() => {
      this.touchCameraFrame = null
      this.applyTouchCameraUpdate()
    })
  }

  private flushTouchCameraUpdate(): void {
    if (this.touchCameraFrame !== null) {
      window.cancelAnimationFrame(this.touchCameraFrame)
      this.touchCameraFrame = null
    }
    this.applyTouchCameraUpdate()
  }

  private applyTouchCameraUpdate(): void {
    const update = this.touchCameraGesture.apply(this.settings.camera)
    if (!update) return
    const previousRotation = normalizeMapRotation(this.settings.mapRotation)
    const nextRotation = this.consumeTouchRotation(update.rotationDelta)
    const camera =
      nextRotation !== previousRotation && this.map
        ? rotateCameraAt(
            update.camera,
            update.center,
            { x: this.map.width * this.map.gridSize, y: this.map.height * this.map.gridSize },
            previousRotation,
            nextRotation,
          )
        : update.camera
    this.settings = { ...this.settings, camera, mapRotation: nextRotation }
    this.applyCamera()
    this.handlers.onCameraChange(camera)
    if (nextRotation !== previousRotation) {
      this.handlers.onMapRotationChange?.(nextRotation)
    }
  }

  private consumeTouchRotation(rotationDelta: number): RuntimeSettings['mapRotation'] {
    const quarterTurn = Math.PI / 2
    const threshold = quarterTurn / 2
    let rotation = normalizeMapRotation(this.settings.mapRotation)
    this.touchCameraRotationRemainder += rotationDelta

    while (this.touchCameraRotationRemainder >= threshold) {
      rotation = normalizeMapRotation(rotation + 90)
      this.touchCameraRotationRemainder -= quarterTurn
    }
    while (this.touchCameraRotationRemainder <= -threshold) {
      rotation = normalizeMapRotation(rotation - 90)
      this.touchCameraRotationRemainder += quarterTurn
    }
    return rotation
  }

  private finishTouchCameraPointer(event: PointerEvent): boolean {
    if (!this.touchCameraGesture.has(event.pointerId)) return false
    const bounds = this.host.getBoundingClientRect()
    this.touchCameraGesture.move(
      event.pointerId,
      clientToLocal({ x: event.clientX, y: event.clientY }, bounds),
    )
    this.flushTouchCameraUpdate()
    this.touchCameraGesture.remove(event.pointerId)
    if (this.touchCameraGesture.size < 2) this.touchCameraRotationRemainder = 0
    return true
  }

  private cancelPointerInteraction(pointerId: number): boolean {
    let cancelled = this.clearMapLongPress(pointerId)
    if (this.editorTouchStart?.pointerId === pointerId) {
      this.editorTouchStart = null
      cancelled = true
    }
    if (this.editorController.cancelPointer(pointerId)) cancelled = true
    if (this.tokenRenderer.isPointerActiveFor(pointerId)) {
      this.tokenDragQueue.cancel(pointerId)
      this.tokenRenderer.cancelPointerInteraction(pointerId)
      cancelled = true
    }
    if (this.touchCameraGesture.remove(pointerId)) {
      this.cancelTouchCameraFrame()
      if (this.touchCameraGesture.size < 2) this.touchCameraRotationRemainder = 0
      cancelled = true
    }
    if (this.cancelSpellEffectInteraction(pointerId)) {
      cancelled = true
    }
    if (this.panState?.pointerId === pointerId) {
      this.panState = null
      cancelled = true
    }
    return cancelled
  }

  private cancelTouchCameraFrame(): void {
    if (this.touchCameraFrame !== null) {
      window.cancelAnimationFrame(this.touchCameraFrame)
      this.touchCameraFrame = null
    }
  }

  private cancelTouchCameraGesture(): void {
    const pointerIds = this.touchCameraGesture.pointerIds
    this.cancelTouchCameraFrame()
    this.touchCameraGesture.clear()
    this.touchCameraRotationRemainder = 0
    for (const pointerId of pointerIds) this.releasePointer(pointerId)
  }

  private cancelSpellEffectInteraction(pointerId?: number): boolean {
    if (
      !this.spellEffectInteraction ||
      (pointerId !== undefined && this.spellEffectInteraction.pointerId !== pointerId)
    ) {
      return false
    }
    this.clearSpellEffectLongPressTimer()
    if (this.spellEffectFrame !== null) {
      window.cancelAnimationFrame(this.spellEffectFrame)
      this.spellEffectFrame = null
    }
    this.pendingSpellEffectPoint = null
    const wasMoving = this.spellEffectInteraction.mode === 'move'
    this.spellEffectInteraction = null
    this.host.classList.remove('spell-effect-moving')
    if (wasMoving) this.handlers.onSpellEffectDragStateChange(false)
    this.setSpellEffectEditing(null)
    this.renderSpellEffects()
    return true
  }

  private cancelMapPointerInteractions(): void {
    this.clearMapLongPress()
    this.cancelTokenInteractions()
    this.cancelTouchCameraGesture()
    this.cancelSpellEffectInteraction()
    this.setSpellEffectEditing(null)
    this.panState = null
    this.editorTouchStart = null
    this.releaseAllPointers()
  }

  private capturePointer(pointerId: number): void {
    const canvas = this.app?.canvas
    if (!canvas?.setPointerCapture) return
    try {
      canvas.setPointerCapture(pointerId)
      this.capturedPointerIds.add(pointerId)
    } catch {
      // Synthetic pointer events and already-ended pointers cannot be captured.
    }
  }

  private releasePointer(pointerId: number): void {
    if (!this.capturedPointerIds.delete(pointerId)) return
    const canvas = this.app?.canvas
    if (!canvas?.releasePointerCapture) return
    try {
      if (!canvas.hasPointerCapture || canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }
    } catch {
      // The browser may already have released capture after pointercancel.
    }
  }

  private releaseAllPointers(): void {
    for (const pointerId of this.capturedPointerIds) {
      this.releasePointer(pointerId)
    }
  }

  private applyTokenDrag(pointerId: number, point: PixelPoint): void {
    if (this.map) {
      this.tokenRenderer.dragToScreenPoint(
        pointerId,
        point,
        this.map.gridSize,
        this.tokenRendererHandlers,
      )
    }
  }

  private clampSpellTarget(
    preset: SpellAreaPreset,
    caster: GridPoint,
    target: GridPoint,
  ): GridPoint {
    if (preset.origin === 'caster' || preset.rangeFeet <= 0) {
      return target
    }
    const maxDistance = preset.rangeFeet / FEET_PER_GRID_UNIT
    const delta = { x: target.x - caster.x, y: target.y - caster.y }
    const distance = Math.hypot(delta.x, delta.y)
    if (distance <= maxDistance || distance === 0) {
      return target
    }
    return {
      x: caster.x + (delta.x / distance) * maxDistance,
      y: caster.y + (delta.y / distance) * maxDistance,
    }
  }
}
