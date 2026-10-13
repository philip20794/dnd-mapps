import { Container, Graphics, Rectangle } from 'pixi.js'
import type { MapObjectRegistry } from '../registry'
import type {
  MapObjectDefinition,
  MapObjectRegistration,
  ObjectPreset,
  ResolvedMapObject,
} from '../types'
import { createRuntime, lineSegmentForObject, toPixels } from '../renderer'
import { validateBaseObject } from '../validation'
import {
  detailWidth,
  drawDirtSpeckles,
  drawSketchLine,
  hashString,
  inkColor,
  jitterColor,
  outlineWidth,
  randomRange,
  warmHighlightColor,
} from '../visualStyle'

const doorPresets: readonly ObjectPreset[] = [
  {
    name: 'closed-wooden-door',
    type: 'wooden-door',
    label: 'Geschlossene Holztür',
    defaults: {
      color: 0x8f5a34,
      secondaryColor: 0x1f120a,
      interactionState: 'closed',
    },
  },
  {
    name: 'closed-stone-door',
    type: 'stone-door',
    label: 'Geschlossene Steintür',
    defaults: {
      color: 0x7a746b,
      secondaryColor: 0x15100d,
      interactionState: 'closed',
    },
  },
]

const createDoorRegistration = (
  type: 'wooden-door' | 'stone-door',
  defaults: Partial<MapObjectDefinition>,
): MapObjectRegistration => ({
  type,
  defaults,
  presets: doorPresets.filter((preset) => preset.type === type),
  validate: validateBaseObject,
  render: (definition, context) => {
    const container = new Container()
    container.position.set(
      toPixels(definition.position.x, context.gridSize),
      toPixels(definition.position.y, context.gridSize),
    )
    container.rotation = definition.rotation
    container.scale.set(definition.scale)
    container.visible = definition.visible
    container.eventMode = 'static'
    container.cursor = 'pointer'
    container.hitArea = new Rectangle(
      -context.gridSize * 0.12,
      -context.gridSize * 0.24,
      toPixels(definition.width, context.gridSize) + context.gridSize * 0.24,
      Math.max(toPixels(definition.height, context.gridSize), context.gridSize * 0.5),
    )
    container.on('pointertap', () => context.emitInteraction(definition.id))

    const graphics = new Graphics()
    const width = toPixels(definition.width, context.gridSize)
    const height = Math.max(toPixels(definition.height, context.gridSize), context.gridSize * 0.16)
    const isOpen = definition.interactionState === 'open'
    const doorWidth = isOpen ? Math.max(context.gridSize * 0.16, height) : width
    const doorHeight = isOpen ? width : height
    const seed = hashString(`${definition.type}:${definition.id}:${definition.interactionState}`)

    const drawClosedWoodenDoor = (): void => {
      const plankCount = Math.max(2, Math.round(definition.width))
      const plankWidth = doorWidth / plankCount
      graphics
        .roundRect(0, 0, doorWidth, doorHeight, context.gridSize * 0.06)
        .fill({ color: jitterColor(definition.color, seed, 16), alpha: 1 })
        .stroke({ color: inkColor, width: outlineWidth(context.gridSize, 0.055) })
      graphics
        .rect(doorWidth * 0.06, doorHeight * 0.08, doorWidth * 0.88, doorHeight * 0.16)
        .fill({ color: warmHighlightColor, alpha: 0.08 })
      for (let plank = 1; plank < plankCount; plank += 1) {
        drawSketchLine(
          graphics,
          plank * plankWidth,
          doorHeight * 0.08,
          plank * plankWidth + randomRange(seed + plank * 11, -1.5, 1.5),
          doorHeight * 0.92,
          seed + plank * 19,
          { color: inkColor, alpha: 0.45, width: 1, wobble: context.gridSize * 0.012 },
        )
      }
      for (const y of [0.24, 0.76]) {
        graphics
          .rect(
            doorWidth * 0.06,
            doorHeight * y - context.gridSize * 0.025,
            doorWidth * 0.88,
            context.gridSize * 0.05,
          )
          .fill({ color: inkColor, alpha: 0.72 })
      }
      graphics
        .circle(doorWidth * 0.84, doorHeight * 0.52, Math.max(2, context.gridSize * 0.045))
        .fill({ color: 0xd6a84f, alpha: 0.9 })
        .stroke({ color: inkColor, alpha: 0.6, width: 1 })
      drawDirtSpeckles(graphics, doorWidth, doorHeight, seed + 41, 4, {
        color: inkColor,
        alpha: 0.13,
        minRadius: 0.7,
        maxRadius: 1.5,
      })
    }

    const drawClosedStoneDoor = (): void => {
      graphics
        .roundRect(0, 0, doorWidth, doorHeight, context.gridSize * 0.04)
        .fill({ color: jitterColor(definition.color, seed, 14), alpha: 1 })
        .stroke({ color: inkColor, width: outlineWidth(context.gridSize, 0.06) })
      graphics
        .moveTo(doorWidth * 0.5, doorHeight * 0.08)
        .lineTo(doorWidth * 0.5, doorHeight * 0.92)
        .moveTo(doorWidth * 0.1, doorHeight * 0.5)
        .lineTo(doorWidth * 0.9, doorHeight * 0.5)
        .stroke({ color: inkColor, alpha: 0.42, width: detailWidth(context.gridSize, 0.025) })
      graphics
        .rect(doorWidth * 0.08, doorHeight * 0.12, doorWidth * 0.84, doorHeight * 0.18)
        .fill({ color: warmHighlightColor, alpha: 0.08 })
      drawDirtSpeckles(graphics, doorWidth, doorHeight, seed + 71, 5, {
        color: inkColor,
        alpha: 0.16,
        minRadius: 0.7,
        maxRadius: 1.4,
      })
    }

    const drawOpenDoor = (): void => {
      graphics
        .roundRect(0, 0, doorWidth, doorHeight, context.gridSize * 0.05)
        .fill({ color: jitterColor(definition.color, seed, 12), alpha: 0.82 })
        .stroke({ color: inkColor, width: outlineWidth(context.gridSize, 0.045) })
      graphics
        .rect(doorWidth * 0.2, doorHeight * 0.08, doorWidth * 0.6, doorHeight * 0.84)
        .fill({ color: inkColor, alpha: 0.12 })
    }

    if (isOpen) {
      drawOpenDoor()
    } else if (type === 'stone-door') {
      drawClosedStoneDoor()
    } else {
      drawClosedWoodenDoor()
    }
    graphics.eventMode = 'none'

    if (isOpen) {
      graphics.rotation = -Math.PI / 2
      graphics.position.set(0, height)
    }

    container.addChild(graphics)
    return createRuntime(definition, container)
  },
  getSightGeometry: (definition: ResolvedMapObject) =>
    definition.interactionState === 'closed' ? [lineSegmentForObject(definition)] : [],
  getCollisionGeometry: (definition: ResolvedMapObject) =>
    definition.interactionState === 'closed' ? [lineSegmentForObject(definition)] : [],
})

export const registerDoorObjects = (registry: MapObjectRegistry): void => {
  registry.register(
    createDoorRegistration('wooden-door', {
      width: 1,
      height: 0.25,
      color: 0x8f5a34,
      secondaryColor: 0x1f120a,
      blocksSight: true,
      blocksMovement: true,
      interactionState: 'closed',
      layer: 'wallsDoors',
      tags: ['door', 'interactive', 'wood'],
    }),
  )

  registry.register(
    createDoorRegistration('stone-door', {
      width: 1,
      height: 0.3,
      color: 0x7a746b,
      secondaryColor: 0x15100d,
      blocksSight: true,
      blocksMovement: true,
      interactionState: 'closed',
      layer: 'wallsDoors',
      tags: ['door', 'interactive', 'stone'],
    }),
  )
}
