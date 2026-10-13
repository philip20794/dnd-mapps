import { Container, Graphics, Text } from 'pixi.js'
import { spellEffectSizeLabel, type PlacedSpellEffect } from '@/types/spells'
import type { PlacedToken } from '@/types/tokens'
import { gridToPixels, hexCentersForBounds, hexCorners } from '../grid/coordinates'
import {
  pointIsInsideSpellEffect,
  resolveSpellEffectPosition,
  spellEffectLocalHandles,
  worldPointToEffectLocal,
} from './geometry'

export interface SpellEffectPreview {
  readonly effect: PlacedSpellEffect
}

const colorNumber = (color: string): number => Number.parseInt(color.replace('#', ''), 16)

export class SpellEffectRenderer {
  public render(
    layer: Container,
    effects: readonly PlacedSpellEffect[],
    tokens: readonly PlacedToken[],
    selectedEffectId: string | null,
    gridSize: number,
    mapWidth: number,
    mapHeight: number,
    preview: SpellEffectPreview | null = null,
  ): void {
    layer.removeChildren().forEach((child) => child.destroy({ children: true }))

    for (const effect of effects) {
      const caster = tokens.find((token) => token.id === effect.casterTokenId)
      const resolved = {
        ...effect,
        position: resolveSpellEffectPosition(effect, caster?.position),
      }
      layer.addChild(
        this.createEffectContainer(
          resolved,
          gridSize,
          mapWidth,
          mapHeight,
          effect.id === selectedEffectId,
          false,
        ),
      )
    }

    if (preview) {
      layer.addChild(
        this.createEffectContainer(preview.effect, gridSize, mapWidth, mapHeight, true, true),
      )
    }
  }

  private createEffectContainer(
    effect: PlacedSpellEffect,
    gridSize: number,
    mapWidth: number,
    mapHeight: number,
    selected: boolean,
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
    const strokeWidth = selected ? Math.max(4, gridSize * 0.075) : Math.max(2, gridSize * 0.04)
    const strokeAlpha = selected ? 1 : 0.78

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

    if (selected && !preview) {
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
    }

    if (selected || preview) {
      const affected = new Graphics()
      const absoluteEffect = { ...effect, rotation: effect.rotation }
      for (const center of hexCentersForBounds(mapWidth, mapHeight)) {
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
