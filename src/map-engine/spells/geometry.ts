import type { GridPoint } from '@/types/geometry'
import type { PlacedSpellEffect } from '@/types/spells'
import type { GridBounds } from '../grid/coordinates'

export const worldPointToEffectLocal = (
  point: GridPoint,
  effect: Pick<PlacedSpellEffect, 'position' | 'rotation'>,
): GridPoint => {
  const radians = (-effect.rotation * Math.PI) / 180
  const x = point.x - effect.position.x
  const y = point.y - effect.position.y
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  }
}

export const pointIsInsideSpellEffect = (
  point: GridPoint,
  effect: Pick<PlacedSpellEffect, 'shape' | 'position' | 'rotation' | 'size' | 'width'>,
): boolean => {
  const local = worldPointToEffectLocal(point, effect)
  switch (effect.shape) {
    case 'sphere':
    case 'cylinder':
    case 'emanation':
      return Math.hypot(local.x, local.y) <= effect.size
    case 'cube':
      return Math.abs(local.x) <= effect.size / 2 && Math.abs(local.y) <= effect.size / 2
    case 'cone':
      return local.x >= 0 && local.x <= effect.size && Math.abs(local.y) <= local.x / 2
    case 'line':
      return local.x >= 0 && local.x <= effect.size && Math.abs(local.y) <= effect.width / 2
    case 'wall':
      return Math.abs(local.x) <= effect.size / 2 && Math.abs(local.y) <= effect.width / 2
  }
}

export const resolveSpellEffectPosition = (
  effect: PlacedSpellEffect,
  casterPosition?: GridPoint,
): GridPoint => (effect.attachedToCaster && casterPosition ? casterPosition : effect.position)

export const effectLocalToWorld = (
  point: GridPoint,
  effect: Pick<PlacedSpellEffect, 'position' | 'rotation'>,
): GridPoint => {
  const radians = (effect.rotation * Math.PI) / 180
  return {
    x: effect.position.x + point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: effect.position.y + point.x * Math.sin(radians) + point.y * Math.cos(radians),
  }
}

export const spellEffectWorldBounds = (
  effect: Pick<PlacedSpellEffect, 'shape' | 'position' | 'rotation' | 'size' | 'width'>,
): GridBounds => {
  const round = ['sphere', 'cylinder', 'emanation'].includes(effect.shape)
  if (round) {
    return {
      minX: effect.position.x - effect.size,
      minY: effect.position.y - effect.size,
      maxX: effect.position.x + effect.size,
      maxY: effect.position.y + effect.size,
    }
  }

  const localBounds =
    effect.shape === 'cube'
      ? {
          minX: -effect.size / 2,
          minY: -effect.size / 2,
          maxX: effect.size / 2,
          maxY: effect.size / 2,
        }
      : effect.shape === 'wall'
        ? {
            minX: -effect.size / 2,
            minY: -effect.width / 2,
            maxX: effect.size / 2,
            maxY: effect.width / 2,
          }
        : effect.shape === 'cone'
          ? { minX: 0, minY: -effect.size / 2, maxX: effect.size, maxY: effect.size / 2 }
          : { minX: 0, minY: -effect.width / 2, maxX: effect.size, maxY: effect.width / 2 }
  const corners = [
    { x: localBounds.minX, y: localBounds.minY },
    { x: localBounds.maxX, y: localBounds.minY },
    { x: localBounds.maxX, y: localBounds.maxY },
    { x: localBounds.minX, y: localBounds.maxY },
  ].map((point) => effectLocalToWorld(point, effect))
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  }
}

export interface SpellEffectHandles {
  readonly resize: GridPoint
  readonly rotate: GridPoint
  readonly rotateAnchor: GridPoint
}

export const spellEffectLocalHandles = (
  effect: Pick<PlacedSpellEffect, 'shape' | 'size' | 'width'>,
): SpellEffectHandles => {
  const round = ['sphere', 'cylinder', 'emanation'].includes(effect.shape)
  const centered = effect.shape === 'cube' || effect.shape === 'wall' || round
  const halfHeight =
    round || effect.shape === 'cube'
      ? effect.size / (effect.shape === 'cube' ? 2 : 1)
      : effect.shape === 'cone'
        ? effect.size / 2
        : effect.width / 2
  return {
    resize:
      effect.shape === 'cube'
        ? { x: effect.size / 2, y: effect.size / 2 }
        : effect.shape === 'wall'
          ? { x: effect.size / 2, y: effect.width / 2 }
          : { x: effect.size, y: 0 },
    rotate: { x: centered ? 0 : Math.min(effect.size / 2, 1.5), y: -halfHeight - 0.8 },
    rotateAnchor: { x: centered ? 0 : Math.min(effect.size / 2, 1.5), y: -halfHeight },
  }
}
