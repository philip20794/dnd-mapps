import { Container, Graphics, Text } from 'pixi.js'
import type { GridPoint, Segment } from '@/types/geometry'
import type { RenderContext, ResolvedMapObject, RuntimeMapObject } from './types'
import { inkColor, outlineWidth } from './visualStyle'

export const toPixels = (value: number, gridSize: number): number => value * gridSize

export const objectCenterPx = (definition: ResolvedMapObject, gridSize: number): GridPoint => ({
  x: toPixels(definition.position.x + definition.width / 2, gridSize),
  y: toPixels(definition.position.y + definition.height / 2, gridSize),
})

export const createRuntime = (
  definition: ResolvedMapObject,
  container: Container,
  cleanupCallbacks: readonly (() => void)[] = [],
  light?: Graphics,
): RuntimeMapObject => ({
  id: definition.id,
  type: definition.type,
  container,
  light,
  cleanup: () => {
    cleanupCallbacks.forEach((cleanup) => cleanup())
    container.destroy({ children: true })
    light?.destroy()
  },
})

export const drawObjectRect = (
  graphics: Graphics,
  definition: ResolvedMapObject,
  context: RenderContext,
  strokeColor = definition.secondaryColor,
): void => {
  const width = toPixels(definition.width, context.gridSize)
  const height = toPixels(definition.height, context.gridSize)
  graphics
    .rect(0, 0, width, height)
    .fill({ color: definition.color, alpha: definition.alpha })
    .stroke({
      color: strokeColor === definition.secondaryColor ? inkColor : strokeColor,
      alpha: 0.78,
      width: outlineWidth(context.gridSize, 0.04),
    })
}

export const createLabel = (text: string, color = 0xf8fafc): Text =>
  new Text({
    text,
    style: {
      fill: color,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      fontWeight: '700',
    },
  })

export const rectSegments = (definition: ResolvedMapObject): readonly Segment[] => {
  const { x, y } = definition.position
  const width = definition.width
  const height = definition.height
  return [
    { a: { x, y }, b: { x: x + width, y } },
    { a: { x: x + width, y }, b: { x: x + width, y: y + height } },
    { a: { x: x + width, y: y + height }, b: { x, y: y + height } },
    { a: { x, y: y + height }, b: { x, y } },
  ]
}

export const lineSegmentForObject = (definition: ResolvedMapObject): Segment => {
  const centerY = definition.position.y + definition.height / 2
  return {
    a: { x: definition.position.x, y: centerY },
    b: { x: definition.position.x + definition.width, y: centerY },
  }
}

export const createRadialLight = (
  definition: ResolvedMapObject,
  context: RenderContext,
): Graphics | undefined => {
  if (!definition.light) {
    return undefined
  }

  const center = objectCenterPx(definition, context.gridSize)
  const radius = toPixels(definition.light.range, context.gridSize)
  const light = new Graphics()
  light.position.set(center.x, center.y)
  light.blendMode = 'screen'
  light
    .circle(0, 0, radius)
    .fill({
      color: definition.light.color,
      alpha: Math.min(0.45, definition.light.intensity * 0.18),
    })
    .circle(0, 0, radius * 0.45)
    .fill({
      color: definition.light.color,
      alpha: Math.min(0.55, definition.light.intensity * 0.25),
    })
  return light
}
