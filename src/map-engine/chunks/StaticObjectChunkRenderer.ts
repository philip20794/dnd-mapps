import { Container, Rectangle } from 'pixi.js'
import type { MapObjectRegistry } from '@/map-objects'
import { createRuntimeObject } from '@/map-objects'
import type { MapLayerName, RenderContext, RuntimeMapObject } from '@/map-objects'
import type { PixiLayerMap } from '@/map-engine/layers'
import type { MapViewBounds } from './bounds'
import {
  chunksInView,
  detailLevelForZoom,
  objectVisibleAtDetail,
  type StaticDetailLevel,
  type StaticObjectChunk,
} from './staticObjectChunks'

interface MountedStaticChunk {
  readonly roots: readonly Container[]
  readonly runtimes: readonly RuntimeMapObject[]
  readonly detail: StaticDetailLevel
  lastVisibleTick: number
  visible: boolean
}

export interface StaticChunkStats {
  readonly totalChunks: number
  readonly mountedChunks: number
  readonly visibleChunks: number
  readonly totalObjects: number
  readonly mountedObjects: number
}

export class StaticObjectChunkRenderer {
  private readonly chunksByKey: ReadonlyMap<string, StaticObjectChunk>
  private readonly mounted = new Map<string, MountedStaticChunk>()
  private tick = 0

  public constructor(
    private readonly chunks: readonly StaticObjectChunk[],
    private readonly layers: PixiLayerMap,
    private readonly registry: MapObjectRegistry,
    private readonly context: RenderContext,
    private readonly gridSize: number,
    private readonly maxRetainedChunks = 64,
  ) {
    this.chunksByKey = new Map(chunks.map((chunk) => [chunk.key, chunk]))
  }

  public update(bounds: MapViewBounds, zoom: number): void {
    this.tick += 1
    const detail = detailLevelForZoom(zoom)
    const visibleKeys = new Set(chunksInView(this.chunks, bounds).map((chunk) => chunk.key))
    for (const [key, mounted] of this.mounted) {
      const visible = visibleKeys.has(key)
      mounted.visible = visible
      mounted.roots.forEach((root) => {
        root.renderable = visible
      })
      if (visible) mounted.lastVisibleTick = this.tick
      if (visible && mounted.detail !== detail) {
        this.unmount(key)
        this.mount(key, detail)
      }
    }
    visibleKeys.forEach((key) => {
      if (!this.mounted.has(key)) this.mount(key, detail)
    })
    this.evictHiddenChunks()
  }

  public stats(): StaticChunkStats {
    const mounted = [...this.mounted.values()]
    return {
      totalChunks: this.chunks.length,
      mountedChunks: mounted.length,
      visibleChunks: mounted.filter((chunk) => chunk.visible).length,
      totalObjects: this.chunks.reduce((sum, chunk) => sum + chunk.objects.length, 0),
      mountedObjects: mounted.reduce((sum, chunk) => sum + chunk.runtimes.length, 0),
    }
  }

  public destroy(): void {
    const keys = [...this.mounted.keys()]
    keys.forEach((key) => this.unmount(key))
  }

  private mount(key: string, detail: StaticDetailLevel): void {
    const chunk = this.chunksByKey.get(key)
    if (!chunk) return
    // The actual zoom is encoded by the selected detail band. Re-evaluate apparent size with the
    // band's conservative lower bound so results stay stable while panning inside one band.
    const bandZoom = detail === 'overview' ? 0.25 : detail === 'normal' ? 0.4 : 1
    const visibleDefinitions = chunk.objects.filter((object) =>
      objectVisibleAtDetail(object, detail, this.gridSize, bandZoom),
    )
    const rootsByLayer = new Map<MapLayerName, Container>()
    const runtimes: RuntimeMapObject[] = []
    visibleDefinitions.forEach((definition) => {
      const root =
        rootsByLayer.get(definition.layer) ??
        new Container({ label: `static-chunk:${definition.layer}:${chunk.key}` })
      if (!rootsByLayer.has(definition.layer)) {
        rootsByLayer.set(definition.layer, root)
        root.cullable = true
        root.cullableChildren = false
        const overflow = this.gridSize * 4
        root.cullArea = new Rectangle(
          chunk.x * this.gridSize - overflow,
          chunk.y * this.gridSize - overflow,
          chunk.width * this.gridSize + overflow * 2,
          chunk.height * this.gridSize + overflow * 2,
        )
        this.layers[definition.layer].addChild(root)
      }
      const runtime = createRuntimeObject(definition, this.registry, this.context)
      root.addChild(runtime.container)
      runtimes.push(runtime)
    })
    const roots = [...rootsByLayer.values()]
    this.mounted.set(key, {
      roots,
      runtimes,
      detail,
      lastVisibleTick: this.tick,
      visible: true,
    })
  }

  private unmount(key: string): void {
    const mounted = this.mounted.get(key)
    if (!mounted) return
    mounted.runtimes.forEach((runtime) => runtime.cleanup())
    mounted.roots.forEach((root) => root.destroy({ children: false }))
    this.mounted.delete(key)
  }

  private evictHiddenChunks(): void {
    const hidden = [...this.mounted.entries()]
      .filter(([, chunk]) => !chunk.visible)
      .sort((left, right) => left[1].lastVisibleTick - right[1].lastVisibleTick)
    while (this.mounted.size > this.maxRetainedChunks && hidden.length > 0) {
      const next = hidden.shift()
      if (next) this.unmount(next[0])
    }
  }
}
