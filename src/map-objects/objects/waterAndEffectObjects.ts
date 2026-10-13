import { Container, Graphics } from 'pixi.js'
import type { MapObjectRegistry } from '../registry'
import type { MapObjectDefinition, MapObjectRegistration, ObjectPreset } from '../types'
import { createRuntime, toPixels } from '../renderer'
import { validateBaseObject } from '../validation'
import {
  detailWidth,
  drawSketchLine,
  hashString,
  inkColor,
  jitterColor,
  outlineWidth,
  randomRange,
  warmHighlightColor,
} from '../visualStyle'

const waterPresets: readonly ObjectPreset[] = [
  {
    name: 'standing-water',
    type: 'water',
    label: 'Stehendes Wasser',
    defaults: {
      color: 0x205f69,
      secondaryColor: 0xb6d7d4,
      water: { direction: 0, speed: 0.04, intensity: 0.2, alpha: 0.72 },
      animation: { enabled: true, speed: 0.12 },
    },
  },
  {
    name: 'slow-river',
    type: 'river',
    label: 'Langsam fließender Fluss',
    defaults: {
      color: 0x1e6471,
      secondaryColor: 0xc1ded8,
      water: { direction: 0, speed: 0.12, intensity: 0.35, alpha: 0.76 },
      animation: { enabled: true, speed: 0.18 },
    },
  },
  {
    name: 'fast-river',
    type: 'river',
    label: 'Schnell fließender Fluss',
    defaults: {
      color: 0x195a69,
      secondaryColor: 0xd5e9e4,
      water: { direction: 0, speed: 0.28, intensity: 0.55, alpha: 0.82 },
      animation: { enabled: true, speed: 0.4 },
    },
  },
]

const waterFlowScale = 0.55

const effectPresets: readonly ObjectPreset[] = [
  {
    name: 'light-smoke',
    type: 'smoke',
    label: 'Leichter Rauch',
    defaults: { color: 0xb8c1cc, alpha: 0.22, animation: { enabled: true, speed: 0.35 } },
  },
  {
    name: 'dense-smoke',
    type: 'smoke',
    label: 'Dichter Rauch',
    defaults: { color: 0x7f8791, alpha: 0.38, animation: { enabled: true, speed: 0.28 } },
  },
  {
    name: 'ground-fog',
    type: 'fog',
    label: 'Bodennebel',
    defaults: { color: 0xdbeafe, alpha: 0.2, animation: { enabled: true, speed: 0.18 } },
  },
]

const drawWater = (
  definition: MapObjectDefinition,
  gridSize: number,
): { container: Container; flow: Graphics } => {
  const container = new Container()
  const width = toPixels(definition.width ?? 1, gridSize)
  const height = toPixels(definition.height ?? 1, gridSize)
  const seed = hashString(`${definition.type}:${definition.id}:${definition.preset ?? ''}`)
  const base = new Graphics()
  base
    .roundRect(0, 0, width, height, gridSize * 0.18)
    .fill({
      color: jitterColor(definition.color ?? 0x176b87, seed, 12),
      alpha: definition.water?.alpha ?? 0.75,
    })
    .stroke({ color: inkColor, alpha: 0.42, width: outlineWidth(gridSize, 0.045) })
    .roundRect(
      gridSize * 0.08,
      gridSize * 0.06,
      Math.max(0, width - gridSize * 0.16),
      Math.max(0, height * 0.28),
      gridSize * 0.12,
    )
    .fill({ color: warmHighlightColor, alpha: 0.06 })
    .rect(0, 0, width, height * 0.14)
    .fill({ color: inkColor, alpha: 0.1 })
    .rect(0, height * 0.82, width, height * 0.18)
    .fill({ color: inkColor, alpha: 0.12 })

  const flow = new Graphics()
  const mask = new Graphics()
  mask.roundRect(0, 0, width, height, gridSize * 0.18).fill({ color: 0xffffff })
  container.addChild(base, flow, mask)
  container.mask = mask
  return { container, flow }
}

const drawCurrentSegment = (
  graphics: Graphics,
  startX: number,
  y: number,
  length: number,
  amplitude: number,
  seed: number,
  options: {
    readonly color: number
    readonly alpha: number
    readonly width: number
  },
): void => {
  graphics
    .moveTo(startX, y)
    .quadraticCurveTo(
      startX + length * 0.28,
      y + randomRange(seed + 1, -amplitude, amplitude),
      startX + length * 0.52,
      y + randomRange(seed + 2, -amplitude, amplitude),
    )
    .quadraticCurveTo(
      startX + length * 0.78,
      y + randomRange(seed + 3, -amplitude, amplitude),
      startX + length,
      y + randomRange(seed + 4, -amplitude * 0.7, amplitude * 0.7),
    )
    .stroke(options)
}

const redrawRiverFlow = (
  flow: Graphics,
  definition: MapObjectDefinition,
  gridSize: number,
  offset: number,
): void => {
  const width = toPixels(definition.width ?? 1, gridSize)
  const height = toPixels(definition.height ?? 1, gridSize)
  const intensity = definition.water?.intensity ?? 0.35
  const seedBase = hashString(`${definition.type}:${definition.id}:${definition.preset ?? ''}:flow`)
  const segmentLength = Math.max(gridSize * 1.9, width * 0.28)
  const cycle = segmentLength * 1.55
  const shiftedOffset = offset % cycle
  const lanes = [0.2, 0.34, 0.49, 0.64, 0.78]
  flow.clear()

  for (const [laneIndex, lane] of lanes.entries()) {
    const seed = seedBase + laneIndex * 211
    const baseY = height * lane + randomRange(seed + 1, -height * 0.035, height * 0.035)
    const laneOffset = shiftedOffset * randomRange(seed + 2, 0.76, 1.18)
    const amplitude = height * randomRange(seed + 3, 0.035, 0.09)

    for (let x = -cycle * 2; x < width + cycle; x += cycle) {
      const startX = x + laneOffset
      drawCurrentSegment(flow, startX, baseY, segmentLength, amplitude, seed + Math.round(x), {
        color: 0x0d3540,
        alpha: 0.18 + intensity * 0.16,
        width: Math.max(3, gridSize * 0.12),
      })
      drawCurrentSegment(
        flow,
        startX + segmentLength * 0.08,
        baseY + randomRange(seed + 6, -height * 0.025, height * 0.025),
        segmentLength * 0.72,
        amplitude * 0.65,
        seed + Math.round(x) + 7,
        {
          color: definition.secondaryColor ?? 0xc1ded8,
          alpha: 0.2 + intensity * 0.28,
          width: detailWidth(gridSize, 0.045),
        },
      )
    }
  }

  const foamCount = Math.max(5, Math.round((width / gridSize) * 2.2))
  const travelWidth = width + gridSize * 2
  for (let index = 0; index < foamCount; index += 1) {
    const seed = seedBase + index * 97
    const x =
      ((randomRange(seed + 1, 0, travelWidth) + offset * randomRange(seed + 2, 0.75, 1.35)) %
        travelWidth) -
      gridSize
    const y = height * randomRange(seed + 3, 0.18, 0.82)
    const dashLength = gridSize * randomRange(seed + 4, 0.18, 0.42)
    drawSketchLine(flow, x, y, x + dashLength, y + randomRange(seed + 5, -2, 2), seed + 6, {
      color: definition.secondaryColor ?? 0xd5e9e4,
      alpha: 0.2 + intensity * 0.24,
      width: detailWidth(gridSize, 0.025),
      wobble: gridSize * 0.015,
    })
  }
}

const redrawStillWater = (
  flow: Graphics,
  definition: MapObjectDefinition,
  gridSize: number,
  elapsed: number,
): void => {
  const width = toPixels(definition.width ?? 1, gridSize)
  const height = toPixels(definition.height ?? 1, gridSize)
  const seedBase = hashString(
    `${definition.type}:${definition.id}:${definition.preset ?? ''}:ripples`,
  )
  const intensity = definition.water?.intensity ?? 0.2
  flow.clear()

  for (let index = 0; index < 6; index += 1) {
    const seed = seedBase + index * 83
    const phase = (elapsed * 0.18 + randomRange(seed + 1, 0, 1)) % 1
    const x = width * randomRange(seed + 2, 0.16, 0.84)
    const y = height * randomRange(seed + 3, 0.18, 0.82)
    const radiusX = gridSize * (0.18 + phase * 0.32)
    const radiusY = radiusX * randomRange(seed + 4, 0.36, 0.58)
    flow.ellipse(x, y, radiusX, radiusY).stroke({
      color: definition.secondaryColor ?? 0xb6d7d4,
      alpha: (1 - phase) * (0.12 + intensity * 0.2),
      width: detailWidth(gridSize, 0.022),
    })
  }
}

const redrawWaterAnimation = (
  flow: Graphics,
  definition: MapObjectDefinition,
  gridSize: number,
  elapsed: number,
): void => {
  if (definition.type === 'river') {
    const speed = definition.water?.speed ?? 0.12
    redrawRiverFlow(flow, definition, gridSize, elapsed * gridSize * speed * waterFlowScale)
    return
  }

  redrawStillWater(flow, definition, gridSize, elapsed)
}

const createWaterRegistration = (
  type: 'water' | 'river',
  defaults: Partial<MapObjectDefinition>,
): MapObjectRegistration => ({
  type,
  defaults,
  presets: waterPresets.filter((preset) => preset.type === type),
  validate: validateBaseObject,
  render: (definition, context) => {
    const { container, flow } = drawWater(definition, context.gridSize)
    container.position.set(
      toPixels(definition.position.x, context.gridSize),
      toPixels(definition.position.y, context.gridSize),
    )
    container.rotation = definition.rotation + (definition.water?.direction ?? 0)
    container.scale.set(definition.scale)
    container.visible = definition.visible
    redrawWaterAnimation(flow, definition, context.gridSize, 0)

    const animation = definition.animation?.enabled
      ? context.animations.register((elapsed, _delta, reduced) => {
          redrawWaterAnimation(
            flow,
            definition,
            context.gridSize,
            reduced ? elapsed * 0.25 : elapsed,
          )
        })
      : null

    return createRuntime(definition, container, animation ? [animation.dispose] : [])
  },
})

const createEffectRegistration = (
  type: 'smoke' | 'fog',
  defaults: Partial<MapObjectDefinition>,
): MapObjectRegistration => ({
  type,
  defaults,
  presets: effectPresets.filter((preset) => preset.type === type),
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

    const particles = new Graphics()
    container.addChild(particles)
    const redraw = (elapsed: number): void => {
      const width = toPixels(definition.width, context.gridSize)
      const height = toPixels(definition.height, context.gridSize)
      particles.clear()
      for (let index = 0; index < 8; index += 1) {
        const phase = elapsed * (definition.animation?.speed ?? 0.2) + index * 0.74
        const x = ((index * 0.31 + Math.sin(phase) * 0.08 + 1) % 1) * width
        const y = ((index * 0.19 + Math.cos(phase * 0.8) * 0.07 + 1) % 1) * height
        const radius = context.gridSize * (0.28 + (index % 3) * 0.1)
        particles.circle(x, y, radius).fill({
          color: definition.color,
          alpha: Math.max(0.04, definition.alpha * (0.55 + Math.sin(phase) * 0.18)),
        })
      }
    }
    redraw(0)

    const animation = definition.animation?.enabled
      ? context.animations.register((elapsed, _delta, reduced) => {
          redraw(reduced ? elapsed * 0.35 : elapsed)
        })
      : null

    return createRuntime(definition, container, animation ? [animation.dispose] : [])
  },
})

export const registerWaterAndEffectObjects = (registry: MapObjectRegistry): void => {
  registry.register(
    createWaterRegistration('water', {
      width: 2,
      height: 2,
      color: 0x205f69,
      secondaryColor: 0xb6d7d4,
      layer: 'terrainAnimated',
      tags: ['water'],
      water: { direction: 0, speed: 0.04, intensity: 0.2, alpha: 0.72 },
      animation: { enabled: true, speed: 0.12 },
    }),
  )

  registry.register(
    createWaterRegistration('river', {
      width: 4,
      height: 1.2,
      color: 0x1e6471,
      secondaryColor: 0xc1ded8,
      layer: 'terrainAnimated',
      tags: ['water', 'river'],
      water: { direction: 0, speed: 0.12, intensity: 0.35, alpha: 0.76 },
      animation: { enabled: true, speed: 0.18 },
    }),
  )

  registry.register(
    createEffectRegistration('smoke', {
      width: 2,
      height: 2,
      color: 0xb8c1cc,
      alpha: 0.22,
      layer: 'effects',
      tags: ['effect', 'smoke'],
      animation: { enabled: true, speed: 0.35 },
    }),
  )

  registry.register(
    createEffectRegistration('fog', {
      width: 4,
      height: 3,
      color: 0xdbeafe,
      alpha: 0.2,
      layer: 'effects',
      tags: ['effect', 'fog'],
      animation: { enabled: true, speed: 0.18 },
    }),
  )
}
