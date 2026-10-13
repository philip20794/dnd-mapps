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
import { fitCameraToMap, panCamera, resetCamera, zoomCameraAt } from './camera/camera'
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
import { SpellEffectRenderer, type SpellEffectPreview } from './spells/SpellEffectRenderer'
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
  combineVisibilityPolygonsWithPreparedGeometry,
  prepareVisibilityGeometry,
  visibilityTokenStateKey,
  type PreparedVisibilityGeometry,
} from './visibility/visibility'
import type { FogLightSource } from './lighting/lightSources'
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
  readonly explored: readonly Polygon[]
}

export interface MapEngineHandlers {
  readonly onTokenSelect: (tokenId: string | null) => void
  readonly onTokenMove: (tokenId: string, position: GridPoint) => void
  readonly onTokenLongPress: (tokenId: string, screenPoint: PixelPoint) => void
  readonly onSpellPlace: (casterTokenId: string, presetId: string, target: GridPoint) => void
  readonly onSpellPlacementCancel: () => void
  readonly onSpellEffectSelect: (effectId: string) => void
  readonly onSpellEffectUpdate: (effectId: string, patch: SpellEffectPatch) => void
  readonly onSpellEffectDelete: (effectId: string) => void
  readonly onSpellEffectDragStateChange: (active: boolean) => void
  readonly onDoorToggle: (doorId: string) => void
  readonly onLevelTransition: (transition: VerticalTransitionConfig, sourceObjectId: string) => void
  readonly onCameraChange: (camera: RuntimeSettings['camera']) => void
  readonly onExplore: (mapId: string, levelId: string, polygons: readonly Polygon[]) => void
  readonly onError: (message: string) => void
}

interface PanState {
  readonly pointerId: number
  readonly last: { readonly x: number; readonly y: number }
}

type SpellEffectInteractionMode = 'pending-move' | 'move' | 'resize' | 'rotate'

interface SpellEffectInteraction {
  readonly pointerId: number
  readonly effect: PlacedSpellEffect
  readonly mode: SpellEffectInteractionMode
  readonly startGrid: GridPoint
  readonly startScreen: PixelPoint
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
  private doorStates: Readonly<Record<string, DoorState>> = {}
  private settings: RuntimeSettings = defaultRuntimeSettings
  private fogState: EngineFogState = { enabled: false, persistExploration: true, explored: [] }
  private currentVisiblePolygons: readonly Polygon[] = []
  private panState: PanState | null = null
  private spacePressed = false
  private movementSegmentIndex: MovementSegmentIndex | null = null
  private preparedVisibilityGeometry: PreparedVisibilityGeometry | null = null
  private cachedFogLightSources: readonly FogLightSource[] | null = null
  private visibilityRevision = 0
  private cachedVisibilityInputKey: string | null = null
  private currentDoorStateKey = ''
  private readonly tokenDragQueue = new TokenDragFrameQueue()
  private readonly tokenRendererHandlers: TokenRendererHandlers = {
    onSelect: (tokenId) => this.handlers.onTokenSelect(tokenId),
    onMoveEnd: (tokenId, position) => this.handlers.onTokenMove(tokenId, position),
    onLongPress: (tokenId, screenPoint) => {
      this.handlers.onTokenLongPress(tokenId, screenPoint)
      this.renderTokens()
    },
    constrainMove: (tokenId, from, proposed) => this.constrainTokenMove(tokenId, from, proposed),
  }

  public constructor(
    private readonly host: HTMLElement,
    private readonly handlers: MapEngineHandlers,
  ) {}

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
  }

  public setLevel(levelId: string): void {
    if (!this.map || this.currentLevelId === levelId) {
      return
    }
    this.currentLevelId = levelId
    this.invalidateMovementGeometry()
    this.invalidateVisibilityGeometry()
    this.currentVisiblePolygons = []
    this.renderMap()
    this.renderTokens()
    this.renderSpellEffects()
    this.updateVisibility()
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
    this.renderSpellEffects()
  }

  public setSpellPlacement(placement: SpellPlacement | null): void {
    this.spellPlacement = placement
    const caster = placement
      ? this.tokens.find((token) => token.id === placement.casterTokenId)
      : undefined
    const preset = placement ? findSpellAreaPreset(placement.presetId) : undefined
    this.spellPlacementTarget =
      caster && preset
        ? preset.origin === 'caster'
          ? { x: caster.position.x + preset.sizeFeet / FEET_PER_GRID_UNIT, y: caster.position.y }
          : caster.position
        : null
    this.layers.tokens.interactiveChildren = placement === null
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
    this.fogState = fogState
    if (activated) {
      this.cachedVisibilityInputKey = null
      this.updateVisibility()
      this.renderFog()
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
    this.cancelPendingTokenDrag()
    this.clearSpellEffectLongPressTimer()
    this.handlers.onSpellEffectDragStateChange(false)
    this.host.classList.remove('map-engine-host')
    this.removeDomEvents()
    this.staticChunkRenderer?.destroy()
    this.staticChunkRenderer = null
    this.cleanupRuntimeObjects()
    this.fogRenderer.destroy()
    this.animations.destroy()
    this.resources.clear()
    this.app?.destroy(true, { children: true })
    this.app = null
  }

  private renderMap(): void {
    if (!this.map) {
      return
    }

    this.staticChunkRenderer?.destroy()
    this.staticChunkRenderer = null
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
    this.spellEffectRenderer.render(
      this.layers.spellEffects,
      this.activeSpellEffects(),
      this.activeTokens(),
      this.selectedSpellEffectId,
      this.map.gridSize,
      this.map.width,
      this.map.height,
      this.createSpellPreview(),
    )
  }

  private createSpellPreview(): SpellEffectPreview | null {
    if (!this.map || !this.spellPlacement || !this.spellPlacementTarget) {
      return null
    }
    const caster = this.tokens.find((token) => token.id === this.spellPlacement?.casterTokenId)
    const preset = findSpellAreaPreset(this.spellPlacement.presetId)
    if (!caster || !preset) {
      return null
    }
    const target = this.clampSpellTarget(preset, caster.position, this.spellPlacementTarget)
    const position = preset.origin === 'caster' ? caster.position : target
    const effect: PlacedSpellEffect = {
      id: 'spell-preview',
      mapId: this.map.id,
      levelId: this.currentLevelId,
      casterTokenId: caster.id,
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
      attachedToCaster: preset.origin === 'caster' && preset.shape === 'emanation',
    }
    return { effect }
  }

  private updateVisibility(): void {
    if (!this.map || !this.fogState.enabled) {
      if (this.currentVisiblePolygons.length > 0) {
        this.currentVisiblePolygons = []
      }
      this.renderFog()
      return
    }

    const activeTokens = this.activeTokens()
    const inputKey = this.visibilityInputKey(activeTokens)
    if (inputKey === this.cachedVisibilityInputKey) {
      return
    }
    this.cachedVisibilityInputKey = inputKey
    this.currentVisiblePolygons = combineVisibilityPolygonsWithPreparedGeometry(
      activeTokens,
      this.map,
      this.visibilityGeometryForCurrentMap(),
      this.fogLightSourcesForCurrentMap(),
      this.currentLevelId,
    )

    this.handlers.onExplore(this.map.id, this.currentLevelId, this.currentVisiblePolygons)
    if (this.fogState.persistExploration && this.currentVisiblePolygons.length > 0) {
      return
    }
    this.renderFog()
  }

  private visibilityGeometryForCurrentMap(): PreparedVisibilityGeometry {
    if (!this.map) return { segments: [] }
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
    return `${this.visibilityRevision}|${this.settings.lighting.enabled ? 1 : 0}|${visibilityTokenStateKey(tokens)}`
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

    const state: FogRenderState = {
      enabled: this.fogState.enabled,
      persistExploration: this.fogState.persistExploration,
      visible: this.currentVisiblePolygons,
      explored: this.fogState.explored,
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

  private selectedSpellHandleAt(point: GridPoint): 'resize' | 'rotate' | null {
    if (!this.map || !this.selectedSpellEffectId) {
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
    const hitRadius = 16 / (this.map.gridSize * this.settings.camera.zoom)
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
    this.spellEffectInteraction = {
      pointerId: event.pointerId,
      effect,
      mode,
      startGrid,
      startScreen: { x: event.clientX, y: event.clientY },
    }
    if (mode === 'pending-move') {
      this.spellEffectLongPressTimer = window.setTimeout(() => {
        if (this.spellEffectInteraction?.mode !== 'pending-move') {
          return
        }
        this.spellEffectInteraction = { ...this.spellEffectInteraction, mode: 'move' }
        this.spellEffectLongPressTimer = null
        this.host.classList.add('spell-effect-moving')
        this.handlers.onSpellEffectDragStateChange(true)
      }, 520)
    }
  }

  private updateLocalSpellEffect(effectId: string, patch: SpellEffectPatch): void {
    this.spellEffects = this.spellEffects.map((effect) =>
      effect.id === effectId ? { ...effect, ...patch } : effect,
    )
    this.renderSpellEffects()
    this.handlers.onSpellEffectUpdate(effectId, patch)
  }

  private resizeSpellEffect(effect: PlacedSpellEffect, point: GridPoint): void {
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
    this.updateLocalSpellEffect(effect.id, {
      size,
      width:
        effect.shape === 'line' || effect.shape === 'wall'
          ? Math.max(0.25, size * widthRatio)
          : effect.width,
    })
  }

  private rotateSpellEffect(effect: PlacedSpellEffect, point: GridPoint): void {
    const handles = spellEffectLocalHandles(effect)
    const handleAngle = Math.atan2(handles.rotate.y, handles.rotate.x)
    const pointerAngle = Math.atan2(point.y - effect.position.y, point.x - effect.position.x)
    this.updateLocalSpellEffect(effect.id, {
      rotation: ((pointerAngle - handleAngle) * 180) / Math.PI,
    })
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
    if (interaction.mode === 'move') {
      const bounds = this.host.getBoundingClientRect()
      const droppedOnTrash =
        event.clientX >= bounds.right - 118 &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.bottom - 118 &&
        event.clientY <= bounds.bottom
      if (droppedOnTrash) {
        this.handlers.onSpellEffectDelete(interaction.effect.id)
      }
      this.host.classList.remove('spell-effect-moving')
      this.handlers.onSpellEffectDragStateChange(false)
    }
    this.spellEffectInteraction = null
    return true
  }

  private handleObjectInteraction(objectId: string): void {
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
    canvas.addEventListener('contextmenu', this.preventContextMenu)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerUp)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  private removeDomEvents(): void {
    const canvas = this.app?.canvas
    if (canvas) {
      canvas.removeEventListener('wheel', this.handleWheel)
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('contextmenu', this.preventContextMenu)
    }
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
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
    if (this.spellPlacement) {
      if (event.button === 2) {
        event.preventDefault()
        this.handlers.onSpellPlacementCancel()
        return
      }
      if (event.button === 0) {
        const target = this.clientToGridPoint(event.clientX, event.clientY, false)
        const caster = this.tokens.find((token) => token.id === this.spellPlacement?.casterTokenId)
        const preset = findSpellAreaPreset(this.spellPlacement.presetId)
        if (target && caster && preset) {
          event.preventDefault()
          const accepted = this.clampSpellTarget(preset, caster.position, target)
          this.handlers.onSpellPlace(caster.id, preset.id, accepted)
        }
        return
      }
    }
    if (event.button === 0) {
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (point) {
        const handle = this.selectedSpellHandleAt(point)
        const selected = this.activeSpellEffects().find(
          (effect) => effect.id === this.selectedSpellEffectId,
        )
        if (handle && selected) {
          event.preventDefault()
          this.tokenRenderer.cancelPointerInteraction()
          this.beginSpellEffectInteraction(event, this.resolvedSpellEffect(selected), handle, point)
          return
        }

        const hitEffect = this.findSpellEffectAt(point)
        if (hitEffect) {
          event.preventDefault()
          this.tokenRenderer.cancelPointerInteraction()
          this.selectedSpellEffectId = hitEffect.id
          this.handlers.onSpellEffectSelect(hitEffect.id)
          this.renderSpellEffects()
          this.beginSpellEffectInteraction(event, hitEffect, 'pending-move', point)
          return
        }
      }
    }
    if (event.button !== 1 && event.button !== 2 && !this.spacePressed) {
      return
    }
    event.preventDefault()
    this.panState = { pointerId: event.pointerId, last: { x: event.clientX, y: event.clientY } }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
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
      const interaction = this.spellEffectInteraction
      const point = this.clientToGridPoint(event.clientX, event.clientY, false)
      if (!point) {
        return
      }
      if (interaction.mode === 'pending-move') {
        const distance = Math.hypot(
          event.clientX - interaction.startScreen.x,
          event.clientY - interaction.startScreen.y,
        )
        if (distance > 7) {
          this.clearSpellEffectLongPressTimer()
          this.spellEffectInteraction = null
        }
        event.preventDefault()
        return
      }
      if (interaction.mode === 'move') {
        this.updateLocalSpellEffect(interaction.effect.id, {
          position: {
            x: interaction.effect.position.x + point.x - interaction.startGrid.x,
            y: interaction.effect.position.y + point.y - interaction.startGrid.y,
          },
        })
      } else if (interaction.mode === 'resize') {
        this.resizeSpellEffect(interaction.effect, point)
      } else {
        this.rotateSpellEffect(interaction.effect, point)
      }
      event.preventDefault()
      return
    }
    if (this.map) {
      if (this.tokenRenderer.isPointerActive) {
        const bounds = this.host.getBoundingClientRect()
        this.queueTokenDrag(clientToLocal({ x: event.clientX, y: event.clientY }, bounds))
        event.preventDefault()
        return
      }
      const bounds = this.host.getBoundingClientRect()
      const local = clientToLocal({ x: event.clientX, y: event.clientY }, bounds)
      if (
        this.tokenRenderer.dragToScreenPoint(local, this.map.gridSize, this.tokenRendererHandlers)
      ) {
        event.preventDefault()
        return
      }
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
    if (this.finishSpellEffectInteraction(event)) {
      event.preventDefault()
      return
    }
    if (this.map) {
      const tokenPointerWasActive = this.tokenRenderer.isPointerActive
      if (tokenPointerWasActive) {
        const bounds = this.host.getBoundingClientRect()
        this.flushTokenDrag(clientToLocal({ x: event.clientX, y: event.clientY }, bounds))
      }
      const finishedTokenDrag = this.tokenRenderer.finishDrag(
        this.settings.grid,
        this.map.gridSize,
        this.tokenRendererHandlers,
      )
      if (finishedTokenDrag) {
        event.preventDefault()
      }
    }

    if (this.panState?.pointerId === event.pointerId) {
      this.panState = null
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.spellEffectInteraction) {
      this.clearSpellEffectLongPressTimer()
      this.spellEffectInteraction = null
      this.host.classList.remove('spell-effect-moving')
      this.handlers.onSpellEffectDragStateChange(false)
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

  private queueTokenDrag(point: PixelPoint): void {
    this.tokenDragQueue.schedule(point, (nextPoint) => this.applyTokenDrag(nextPoint))
  }

  private flushTokenDrag(finalPoint?: PixelPoint): void {
    this.tokenDragQueue.flush((point) => this.applyTokenDrag(point), finalPoint)
  }

  private cancelPendingTokenDrag(): void {
    this.tokenDragQueue.cancel()
  }

  private applyTokenDrag(point: PixelPoint): void {
    if (this.map) {
      this.tokenRenderer.dragToScreenPoint(point, this.map.gridSize, this.tokenRendererHandlers)
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
