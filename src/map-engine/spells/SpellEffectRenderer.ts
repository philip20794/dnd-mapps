import { Container, Graphics, Text } from 'pixi.js'
import { spellEffectSizeLabel, type PlacedSpellEffect } from '@/types/spells'
import type { PlacedToken } from '@/types/tokens'
import { gridToPixels, hexCentersForRegion, hexCorners } from '../grid/coordinates'
import {
  pointIsInsideSpellEffect,
  resolveSpellEffectPosition,
  spellEffectWorldBounds,
  spellEffectLocalHandles,
  worldPointToEffectLocal,
} from './geometry'

export interface SpellEffectPreview {
  readonly effect: PlacedSpellEffect
}

export type SpellEffectActiveMode = 'move' | 'resize' | 'rotate' | null

interface RenderedSpellEffect {
  container: Container
  signature: string
}

const colorNumber = (color: string): number => Number.parseInt(color.replace('#', ''), 16)

export class SpellEffectRenderer {
  private readonly visuals = new Map<string, RenderedSpellEffect>()
  private previewContainer: Container | null = null

  public clear(): void {
    for (const visual of this.visuals.values()) {
      visual.container.parent?.removeChild(visual.container)
      visual.container.destroy({ children: true })
    }
    this.visuals.clear()
    if (this.previewContainer) {
      this.previewContainer.parent?.removeChild(this.previewContainer)
      this.previewContainer.destroy({ children: true })
      this.previewContainer = null
    }
  }

  public render(
    layer: Container,
    effects: readonly PlacedSpellEffect[],
    tokens: readonly PlacedToken[],
    selectedEffectId: string | null,
    gridSize: number,
    mapWidth: number,
    mapHeight: number,
    preview: SpellEffectPreview | null = null,
    editingEffectId: string | null = null,
    activeEffectId: string | null = null,
    activeMode: SpellEffectActiveMode = null,
  ): void {
    const activeIds = new Set(effects.map((effect) => effect.id))
    for (const [effectId, visual] of this.visuals) {
      if (activeIds.has(effectId)) continue
      layer.removeChild(visual.container)
      visual.container.destroy({ children: true })
      this.visuals.delete(effectId)
    }

    for (const effect of effects) {
      const caster = tokens.find((token) => token.id === effect.casterTokenId)
      const resolved = {
        ...effect,
        position: resolveSpellEffectPosition(effect, caster?.position),
      }
      const selected = effect.id === selectedEffectId
      const editing = effect.id === editingEffectId
      const effectActiveMode = effect.id === activeEffectId ? activeMode : null
      const signature = this.effectSignature(resolved, selected, editing, effectActiveMode)
      const current = this.visuals.get(effect.id)
      if (current?.signature === signature && current.container.parent === layer) continue
      const container = this.createEffectContainer(
        resolved,
        gridSize,
        mapWidth,
        mapHeight,
        selected,
        editing,
        effectActiveMode,
        false,
      )
      if (current?.container.parent === layer) {
        const index = layer.getChildIndex(current.container)
        layer.removeChild(current.container)
        current.container.destroy({ children: true })
        layer.addChildAt(container, Math.min(index, layer.children.length))
      } else {
        layer.addChild(container)
      }
      this.visuals.set(effect.id, { container, signature })
    }

    if (this.previewContainer) {
      layer.removeChild(this.previewContainer)
      this.previewContainer.destroy({ children: true })
      this.previewContainer = null
    }
    if (preview) {
      this.previewContainer = this.createEffectContainer(
        preview.effect,
        gridSize,
        mapWidth,
        mapHeight,
        true,
        false,
        null,
        true,
      )
      layer.addChild(this.previewContainer)
    }
  }

  public moveEffect(
    effectId: string,
    position: PlacedSpellEffect['position'],
    gridSize: number,
  ): void {
    const visual = this.visuals.get(effectId)
    if (!visual) return
    const pixels = gridToPixels(position, gridSize)
    visual.container.position.set(pixels.x, pixels.y)
  }

  private effectSignature(
    effect: PlacedSpellEffect,
    selected: boolean,
    editing: boolean,
    activeMode: SpellEffectActiveMode,
  ): string {
    return [
      effect.position.x,
      effect.position.y,
      effect.rotation,
      effect.size,
      effect.width,
      effect.color,
      effect.shape,
      selected ? 1 : 0,
      editing ? 1 : 0,
      activeMode ?? '',
    ].join('|')
  }

  private createEffectContainer(
    effect: PlacedSpellEffect,
    gridSize: number,
    mapWidth: number,
    mapHeight: number,
    selected: boolean,
    editing: boolean,
    activeMode: SpellEffectActiveMode,
    preview: boolean,
  ): Container {
    const container = new Container()
    container.eventMode = 'none'
    const position = gridToPixels(effect.position, gridSize)
    container.position.set(position.x, position.y)
    container.rotation = (effect.rotation * Math.PI) / 180

    const color = colorNumber(effect.color)
    const area = new Graphics()
    const size = effect.size * gridSize
    const width = Math.max(effect.width * gridSize, gridSize * 0.16)
    const fillAlpha = preview ? 0.28 : 0.2
    const strokeWidth = editing ? Math.max(4, gridSize * 0.075) : Math.max(2, gridSize * 0.04)
    const strokeAlpha = editing ? 1 : selected ? 0.88 : 0.72

    switch (effect.shape) {
      case 'sphere':
      case 'cylinder':
      case 'emanation':
        area
          .circle(0, 0, size)
          .fill({ color, alpha: fillAlpha })
          .stroke({ color, alpha: strokeAlpha, width: strokeWidth })
        if (effect.shape === 'cylinder') {
          area.circle(0, 0, size * 0.82).stroke({ color, alpha: 0.42, width: 1.5 })
        }
        break
      case 'cube':
        area
          .rect(-size / 2, -size / 2, size, size)
          .fill({ color, alpha: fillAlpha })
          .stroke({ color, alpha: strokeAlpha, width: strokeWidth })
        break
      case 'cone': {
        const halfWidth = size / 2
        area
          .moveTo(0, 0)
          .lineTo(size, -halfWidth)
          .lineTo(size, halfWidth)
          .closePath()
          .fill({ color, alpha: fillAlpha })
          .stroke({ color, alpha: strokeAlpha, width: strokeWidth })
        break
      }
      case 'line':
        area
          .rect(0, -width / 2, size, width)
          .fill({ color, alpha: fillAlpha })
          .stroke({ color, alpha: strokeAlpha, width: strokeWidth })
        break
      case 'wall':
        area
          .rect(-size / 2, -width / 2, size, width)
          .fill({ color, alpha: fillAlpha })
          .stroke({ color, alpha: strokeAlpha, width: strokeWidth })
        break
    }

    const origin = new Graphics()
      .circle(0, 0, Math.max(4, gridSize * 0.09))
      .fill({ color: 0xffffff, alpha: 0.95 })
      .stroke({ color, width: 2, alpha: 1 })
    container.addChild(area, origin)

    if (editing && !preview) {
      const handles = spellEffectLocalHandles(effect)
      const controls = new Graphics()
      controls
        .moveTo(handles.rotateAnchor.x * gridSize, handles.rotateAnchor.y * gridSize)
        .lineTo(handles.rotate.x * gridSize, handles.rotate.y * gridSize)
        .stroke({ color: 0xffffff, alpha: 0.85, width: Math.max(2, gridSize * 0.035) })
        .circle(
          handles.resize.x * gridSize,
          handles.resize.y * gridSize,
          Math.max(7, gridSize * 0.13),
        )
        .fill({ color: 0x58a6ff, alpha: 1 })
        .stroke({ color: 0xffffff, alpha: 1, width: 2 })
        .circle(
          handles.rotate.x * gridSize,
          handles.rotate.y * gridSize,
          Math.max(7, gridSize * 0.13),
        )
        .fill({ color: 0xf3d37a, alpha: 1 })
        .stroke({ color: 0xffffff, alpha: 1, width: 2 })
      container.addChild(controls)

      const modeLabel =
        activeMode === 'move'
          ? '↔ VERSCHIEBEN'
          : activeMode === 'resize'
            ? '↔ GRÖSSE'
            : activeMode === 'rotate'
              ? '↻ DREHEN'
              : 'BEARBEITEN'
      const indicator = new Text({
        text: modeLabel,
        style: {
          fill: 0xffffff,
          fontFamily: 'system-ui, sans-serif',
          fontSize: Math.max(10, gridSize * 0.2),
          fontWeight: '800',
          stroke: { color: 0x111318, width: 4 },
        },
      })
      indicator.anchor.set(0.5, 0)
      indicator.position.set(0, Math.max(gridSize * 0.22, effect.shape === 'sphere' ? size : width))
      indicator.rotation = (-effect.rotation * Math.PI) / 180
      container.addChild(indicator)
    }

    if ((selected || preview) && activeMode === null) {
      const affected = new Graphics()
      const absoluteEffect = { ...effect, rotation: effect.rotation }
      const effectBounds = spellEffectWorldBounds(absoluteEffect)
      for (const center of hexCentersForRegion(mapWidth, mapHeight, effectBounds)) {
        if (!pointIsInsideSpellEffect(center, absoluteEffect)) {
          continue
        }
        const corners = hexCorners(center).map((corner) => {
          const localCorner = worldPointToEffectLocal(corner, effect)
          return { x: localCorner.x * gridSize, y: localCorner.y * gridSize }
        })
        const first = corners[0]
        if (!first) {
          continue
        }
        affected.moveTo(first.x, first.y)
        corners.slice(1).forEach((corner) => affected.lineTo(corner.x, corner.y))
        affected.closePath()
      }
      affected.fill({ color, alpha: preview ? 0.12 : 0.08 })
      container.addChildAt(affected, 0)
    }

    const label = new Text({
      text: spellEffectSizeLabel(effect),
      style: {
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(11, gridSize * 0.23),
        fontWeight: '700',
        stroke: { color: 0x111318, width: 3 },
      },
    })
    label.anchor.set(0.5, 1)
    label.position.set(0, -Math.max(gridSize * 0.18, effect.shape === 'sphere' ? size : width))
    label.rotation = (-effect.rotation * Math.PI) / 180
    container.addChild(label)
    return container
  }
}
