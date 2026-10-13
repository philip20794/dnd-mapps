import { Container, Graphics } from 'pixi.js'
import type { MapObjectRegistry } from '../registry'
import type {
  MapObjectDefinition,
  MapObjectRegistration,
  ObjectPreset,
  ResolvedMapObject,
  RuntimeMapObject,
} from '../types'
import { createRuntime, toPixels } from '../renderer'
import { validateBaseObject } from '../validation'
import {
  detailWidth,
  drawSketchLine,
  inkColor,
  shiftColor,
  warmHighlightColor,
} from '../visualStyle'

export const groundPresetNames = [
  'packed-earth',
  'dark-earth',
  'cave-ground',
  'meadow',
  'forest-floor',
  'dirt-path',
  'muddy-ruts',
  'cobblestone',
  'stone-tiles',
  'cracked-tiles',
  'mossy-stone',
  'wet-stone',
  'grave-dust',
  'loose-gravel',
  'burnt-ground',
  'leaf-litter',
  'field-stubble',
  'shallow-mud',
  'wood-planks',
  'sand',
  'snow',
  'marsh',
] as const

export type GroundPresetName = (typeof groundPresetNames)[number]

type GroundVariant =
  | 'earth'
  | 'cave'
  | 'grass'
  | 'forest'
  | 'path'
  | 'tile'
  | 'wood'
  | 'sand'
  | 'snow'
  | 'marsh'

interface GroundTileContext {
  readonly graphics: Graphics
  readonly variant: GroundVariant
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly gridSize: number
  readonly seed: number
  readonly baseColor: number
  readonly secondaryColor: number
  readonly alpha: number
}

const groundVariants: readonly GroundVariant[] = [
  'earth',
  'cave',
  'grass',
  'forest',
  'path',
  'tile',
  'wood',
  'sand',
  'snow',
  'marsh',
]

const groundVariantSet = new Set<string>(groundVariants)

const groundPresets: readonly ObjectPreset[] = [
  {
    name: 'packed-earth',
    type: 'ground-area',
    label: 'Festgetretene Erde',
    defaults: { variant: 'earth', color: 0x7a6042, secondaryColor: 0x2f2118, tags: ['ground'] },
  },
  {
    name: 'dark-earth',
    type: 'ground-area',
    label: 'Dunkle Erde',
    defaults: { variant: 'earth', color: 0x4a3729, secondaryColor: 0x18110d, tags: ['ground'] },
  },
  {
    name: 'cave-ground',
    type: 'ground-area',
    label: 'Hoehlenboden',
    defaults: { variant: 'cave', color: 0x57524a, secondaryColor: 0x1a1714, tags: ['ground'] },
  },
  {
    name: 'meadow',
    type: 'ground-area',
    label: 'Wiese',
    defaults: { variant: 'grass', color: 0x5f8443, secondaryColor: 0x213515, tags: ['ground'] },
  },
  {
    name: 'forest-floor',
    type: 'ground-area',
    label: 'Waldboden',
    defaults: { variant: 'forest', color: 0x4b4a2f, secondaryColor: 0x1f170f, tags: ['ground'] },
  },
  {
    name: 'dirt-path',
    type: 'ground-area',
    label: 'Erdweg',
    defaults: { variant: 'path', color: 0x957044, secondaryColor: 0x342315, tags: ['ground'] },
  },
  {
    name: 'muddy-ruts',
    type: 'ground-area',
    label: 'Schlammige Fahrspuren',
    defaults: {
      variant: 'path',
      color: 0x665039,
      secondaryColor: 0x23160d,
      tags: ['ground', 'mud', 'difficult-terrain'],
    },
  },
  {
    name: 'cobblestone',
    type: 'ground-area',
    label: 'Kopfsteinpflaster',
    defaults: {
      variant: 'tile',
      color: 0x7c7a70,
      secondaryColor: 0x24211d,
      tags: ['ground', 'stone', 'road'],
    },
  },
  {
    name: 'stone-tiles',
    type: 'ground-area',
    label: 'Steinfliesen',
    defaults: { variant: 'tile', color: 0x9b856b, secondaryColor: 0x1a1410, tags: ['ground'] },
  },
  {
    name: 'cracked-tiles',
    type: 'ground-area',
    label: 'Rissige Kryptafliesen',
    defaults: { variant: 'tile', color: 0x8d7a64, secondaryColor: 0x17110d, tags: ['ground'] },
  },
  {
    name: 'mossy-stone',
    type: 'ground-area',
    label: 'Moosige Steinplatten',
    defaults: { variant: 'tile', color: 0x7c7860, secondaryColor: 0x18200f, tags: ['ground'] },
  },
  {
    name: 'wet-stone',
    type: 'ground-area',
    label: 'Feuchter Stein',
    defaults: { variant: 'cave', color: 0x5f635d, secondaryColor: 0x161817, tags: ['ground'] },
  },
  {
    name: 'grave-dust',
    type: 'ground-area',
    label: 'Grabstaub',
    defaults: { variant: 'earth', color: 0x8c8069, secondaryColor: 0x2b241d, tags: ['ground'] },
  },
  {
    name: 'loose-gravel',
    type: 'ground-area',
    label: 'Loser Schotter',
    defaults: { variant: 'cave', color: 0x6c675e, secondaryColor: 0x211e1a, tags: ['ground'] },
  },
  {
    name: 'burnt-ground',
    type: 'ground-area',
    label: 'Verbrannter Boden',
    defaults: {
      variant: 'earth',
      color: 0x3a332b,
      secondaryColor: 0x14100d,
      tags: ['ground', 'ash'],
    },
  },
  {
    name: 'leaf-litter',
    type: 'ground-area',
    label: 'Laubboden',
    defaults: {
      variant: 'forest',
      color: 0x6b5435,
      secondaryColor: 0x2c1c11,
      tags: ['ground', 'forest', 'leaves'],
    },
  },
  {
    name: 'field-stubble',
    type: 'ground-area',
    label: 'Stoppelfeld',
    defaults: {
      variant: 'grass',
      color: 0x8b7a42,
      secondaryColor: 0x49371d,
      tags: ['ground', 'field'],
    },
  },
  {
    name: 'shallow-mud',
    type: 'ground-area',
    label: 'Seichter Schlamm',
    defaults: {
      variant: 'marsh',
      color: 0x46513a,
      secondaryColor: 0x141b11,
      tags: ['ground', 'mud', 'marsh'],
    },
  },
  {
    name: 'wood-planks',
    type: 'ground-area',
    label: 'Holzbohlen',
    defaults: { variant: 'wood', color: 0x8a5a39, secondaryColor: 0x21140d, tags: ['ground'] },
  },
  {
    name: 'sand',
    type: 'ground-area',
    label: 'Sand',
    defaults: { variant: 'sand', color: 0xb69a62, secondaryColor: 0x765f38, tags: ['ground'] },
  },
  {
    name: 'snow',
    type: 'ground-area',
    label: 'Schnee',
    defaults: { variant: 'snow', color: 0xd6e0e5, secondaryColor: 0x8ea1aa, tags: ['ground'] },
  },
  {
    name: 'marsh',
    type: 'ground-area',
    label: 'Sumpfboden',
    defaults: { variant: 'marsh', color: 0x4d5b38, secondaryColor: 0x151d12, tags: ['ground'] },
  },
]

const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const random01 = (seed: number): number => {
  let value = seed + 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

const randomRange = (seed: number, min: number, max: number): number =>
  min + (max - min) * random01(seed)

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

const jitterColor = (color: number, seed: number, amount: number): number => {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const brightness = (random01(seed + 11) - 0.5) * amount
  const warmth = (random01(seed + 17) - 0.5) * amount * 0.18
  const nextR = clampChannel(r + brightness + warmth)
  const nextG = clampChannel(g + brightness)
  const nextB = clampChannel(b + brightness - warmth)
  return (nextR << 16) + (nextG << 8) + nextB
}

const drawLine = (
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  alpha: number,
  width: number,
): void => {
  graphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, alpha, width })
}

const drawPebbles = (context: GroundTileContext, count: number): void => {
  for (let index = 0; index < count; index += 1) {
    const seed = context.seed + index * 41
    const radius = randomRange(seed + 1, context.gridSize * 0.025, context.gridSize * 0.07)
    context.graphics
      .circle(
        context.x + randomRange(seed + 2, context.width * 0.12, context.width * 0.88),
        context.y + randomRange(seed + 3, context.height * 0.12, context.height * 0.88),
        radius,
      )
      .fill({
        color: context.secondaryColor,
        alpha: context.alpha * randomRange(seed + 4, 0.1, 0.3),
      })
  }
}

const organicEdgeVariantSet = new Set<GroundVariant>([
  'earth',
  'cave',
  'grass',
  'forest',
  'path',
  'sand',
  'marsh',
])

const fillOrganicArea = (
  graphics: Graphics,
  width: number,
  height: number,
  gridSize: number,
  seed: number,
  color: number,
  alpha: number,
  variant: GroundVariant,
): void => {
  const horizontalPath = variant === 'path' && width >= height
  const verticalPath = variant === 'path' && height > width
  const stepsX = Math.max(4, Math.ceil(width / gridSize))
  const stepsY = Math.max(4, Math.ceil(height / gridSize))
  const edgeInset = variant === 'path' ? 0.14 : 0.04
  const edgeWobble = variant === 'path' ? 0.16 : 0.1

  if (horizontalPath) {
    const capWobble = Math.min(width * 0.06, gridSize * 0.35)
    for (let index = 0; index <= stepsX; index += 1) {
      const x = (width / stepsX) * index
      const y = height * randomRange(seed + index * 17, edgeInset, edgeInset + edgeWobble)
      if (index === 0) {
        graphics.moveTo(x, y)
      } else {
        graphics.lineTo(x, y)
      }
    }
    for (let index = 1; index <= stepsY; index += 1) {
      const t = index / (stepsY + 1)
      const x = width - randomRange(seed + 500 + index * 23, 0, capWobble)
      const y =
        height * (edgeInset + t * (1 - edgeInset * 2)) +
        randomRange(seed + 530 + index * 29, -height * 0.035, height * 0.035)
      graphics.lineTo(x, y)
    }
    for (let index = stepsX; index >= 0; index -= 1) {
      const x = (width / stepsX) * index
      const y =
        height * randomRange(seed + 200 + index * 19, 1 - edgeInset - edgeWobble, 1 - edgeInset)
      graphics.lineTo(x, y)
    }
    for (let index = stepsY; index > 0; index -= 1) {
      const t = index / (stepsY + 1)
      const x = randomRange(seed + 700 + index * 23, 0, capWobble)
      const y =
        height * (edgeInset + t * (1 - edgeInset * 2)) +
        randomRange(seed + 730 + index * 29, -height * 0.035, height * 0.035)
      graphics.lineTo(x, y)
    }
    graphics.closePath().fill({ color, alpha })
    return
  }

  if (verticalPath) {
    const capWobble = Math.min(height * 0.06, gridSize * 0.35)
    for (let index = 0; index <= stepsY; index += 1) {
      const y = (height / stepsY) * index
      const x = width * randomRange(seed + index * 17, edgeInset, edgeInset + edgeWobble)
      if (index === 0) {
        graphics.moveTo(x, y)
      } else {
        graphics.lineTo(x, y)
      }
    }
    for (let index = 1; index <= stepsX; index += 1) {
      const t = index / (stepsX + 1)
      const x =
        width * (edgeInset + t * (1 - edgeInset * 2)) +
        randomRange(seed + 500 + index * 23, -width * 0.035, width * 0.035)
      const y = height - randomRange(seed + 530 + index * 29, 0, capWobble)
      graphics.lineTo(x, y)
    }
    for (let index = stepsY; index >= 0; index -= 1) {
      const y = (height / stepsY) * index
      const x =
        width * randomRange(seed + 200 + index * 19, 1 - edgeInset - edgeWobble, 1 - edgeInset)
      graphics.lineTo(x, y)
    }
    for (let index = stepsX; index > 0; index -= 1) {
      const t = index / (stepsX + 1)
      const x =
        width * (edgeInset + t * (1 - edgeInset * 2)) +
        randomRange(seed + 700 + index * 23, -width * 0.035, width * 0.035)
      const y = randomRange(seed + 730 + index * 29, 0, capWobble)
      graphics.lineTo(x, y)
    }
    graphics.closePath().fill({ color, alpha })
    return
  }

  for (let index = 0; index <= stepsX; index += 1) {
    const x = (width / stepsX) * index
    const y = height * randomRange(seed + index * 17, 0, edgeWobble)
    if (index === 0) {
      graphics.moveTo(x, y)
    } else {
      graphics.lineTo(x, y)
    }
  }
  for (let index = 1; index <= stepsY; index += 1) {
    const x = width * randomRange(seed + 300 + index * 23, 1 - edgeWobble, 1)
    const y = (height / stepsY) * index
    graphics.lineTo(x, y)
  }
  for (let index = stepsX - 1; index >= 0; index -= 1) {
    const x = (width / stepsX) * index
    const y = height * randomRange(seed + 600 + index * 29, 1 - edgeWobble, 1)
    graphics.lineTo(x, y)
  }
  for (let index = stepsY - 1; index > 0; index -= 1) {
    const x = width * randomRange(seed + 900 + index * 31, 0, edgeWobble)
    const y = (height / stepsY) * index
    graphics.lineTo(x, y)
  }

  graphics.closePath().fill({ color, alpha })
}

const fillGroundBase = (
  graphics: Graphics,
  width: number,
  height: number,
  gridSize: number,
  seed: number,
  color: number,
  alpha: number,
  variant: GroundVariant,
): void => {
  const useOrganicEdges = organicEdgeVariantSet.has(variant) && alpha < 0.95

  if (useOrganicEdges) {
    fillOrganicArea(graphics, width, height, gridSize, seed, color, alpha, variant)
    return
  }

  graphics.rect(0, 0, width, height).fill({ color, alpha })
}

const drawOrganicPatch = (
  context: GroundTileContext,
  color: number,
  alpha: number,
  seed: number,
): void => {
  context.graphics
    .ellipse(
      context.x + randomRange(seed + 1, context.width * 0.12, context.width * 0.88),
      context.y + randomRange(seed + 2, context.height * 0.12, context.height * 0.88),
      randomRange(seed + 3, context.gridSize * 0.12, context.gridSize * 0.32),
      randomRange(seed + 4, context.gridSize * 0.06, context.gridSize * 0.2),
    )
    .fill({ color, alpha: context.alpha * alpha })
}

const drawCrack = (context: GroundTileContext, seed: number, alpha = 0.42): void => {
  const startX = context.x + randomRange(seed + 1, context.width * 0.12, context.width * 0.35)
  const startY = context.y + randomRange(seed + 2, context.height * 0.15, context.height * 0.85)
  const midX = context.x + randomRange(seed + 3, context.width * 0.38, context.width * 0.62)
  const midY = context.y + randomRange(seed + 4, context.height * 0.15, context.height * 0.85)
  const endX = context.x + randomRange(seed + 5, context.width * 0.65, context.width * 0.9)
  const endY = context.y + randomRange(seed + 6, context.height * 0.15, context.height * 0.85)
  context.graphics
    .moveTo(startX, startY)
    .lineTo(midX, midY)
    .lineTo(endX, endY)
    .stroke({
      color: inkColor,
      alpha: context.alpha * alpha,
      width: detailWidth(context.gridSize, 0.02),
    })

  if (random01(seed + 12) > 0.62) {
    drawSketchLine(
      context.graphics,
      midX,
      midY,
      midX + randomRange(seed + 13, -context.width * 0.18, context.width * 0.18),
      midY + randomRange(seed + 14, context.height * 0.08, context.height * 0.22),
      seed + 15,
      {
        color: inkColor,
        alpha: context.alpha * alpha * 0.72,
        width: detailWidth(context.gridSize, 0.016),
        wobble: context.gridSize * 0.015,
      },
    )
  }
}

const drawGrass = (context: GroundTileContext): void => {
  if (random01(context.seed + 91) > 0.5) {
    drawOrganicPatch(
      context,
      random01(context.seed + 92) > 0.5 ? 0x789653 : 0x4f7136,
      randomRange(context.seed + 93, 0.08, 0.18),
      context.seed + 94,
    )
  }

  const blades = 4 + Math.floor(random01(context.seed + 1) * 5)
  for (let index = 0; index < blades; index += 1) {
    const seed = context.seed + index * 53
    const x = context.x + randomRange(seed + 2, context.width * 0.08, context.width * 0.92)
    const y = context.y + randomRange(seed + 3, context.height * 0.18, context.height * 0.88)
    const length = randomRange(seed + 4, context.gridSize * 0.08, context.gridSize * 0.2)
    drawLine(
      context.graphics,
      x,
      y,
      x + randomRange(seed + 5, -context.gridSize * 0.06, context.gridSize * 0.06),
      y - length,
      jitterColor(0x79a855, seed, 22),
      context.alpha * 0.38,
      1,
    )
  }

  if (random01(context.seed + 77) > 0.76) {
    const flowerX =
      context.x + randomRange(context.seed + 78, context.width * 0.18, context.width * 0.82)
    const flowerY =
      context.y + randomRange(context.seed + 79, context.height * 0.18, context.height * 0.82)
    context.graphics.circle(flowerX, flowerY, Math.max(1.2, context.gridSize * 0.035)).fill({
      color: random01(context.seed + 80) > 0.5 ? 0xf3d36b : 0xc084fc,
      alpha: context.alpha * 0.58,
    })
  }
}

const drawForestFloor = (context: GroundTileContext): void => {
  drawOrganicPatch(context, 0x394822, 0.14, context.seed + 5)
  drawPebbles(context, 1)
  const leaves = 3 + Math.floor(random01(context.seed + 9) * 4)
  for (let index = 0; index < leaves; index += 1) {
    const seed = context.seed + index * 67
    context.graphics
      .ellipse(
        context.x + randomRange(seed + 1, context.width * 0.1, context.width * 0.9),
        context.y + randomRange(seed + 2, context.height * 0.1, context.height * 0.9),
        randomRange(seed + 3, context.gridSize * 0.035, context.gridSize * 0.09),
        randomRange(seed + 4, context.gridSize * 0.012, context.gridSize * 0.035),
      )
      .fill({
        color: random01(seed + 5) > 0.5 ? 0x7f6a32 : 0x355a2c,
        alpha: context.alpha * 0.38,
      })
  }

  if (random01(context.seed + 31) > 0.55) {
    drawLine(
      context.graphics,
      context.x + randomRange(context.seed + 32, context.width * 0.1, context.width * 0.4),
      context.y + randomRange(context.seed + 33, context.height * 0.2, context.height * 0.8),
      context.x + randomRange(context.seed + 34, context.width * 0.55, context.width * 0.9),
      context.y + randomRange(context.seed + 35, context.height * 0.2, context.height * 0.8),
      0x2a1a0e,
      context.alpha * 0.36,
      Math.max(1, context.gridSize * 0.025),
    )
  }
}

const drawPath = (context: GroundTileContext): void => {
  drawPebbles(context, 1)
  const scuffs = 2 + Math.floor(random01(context.seed + 12) * 3)
  for (let index = 0; index < scuffs; index += 1) {
    const seed = context.seed + index * 43
    const x = context.x + randomRange(seed + 1, context.width * 0.12, context.width * 0.78)
    const y = context.y + randomRange(seed + 2, context.height * 0.18, context.height * 0.82)
    drawSketchLine(
      context.graphics,
      x,
      y,
      x + randomRange(seed + 3, context.width * 0.12, context.width * 0.36),
      y + randomRange(seed + 4, -context.height * 0.12, context.height * 0.12),
      seed + 5,
      {
        color: context.secondaryColor,
        alpha: context.alpha * randomRange(seed + 6, 0.13, 0.24),
        width: detailWidth(context.gridSize, 0.02),
        wobble: context.gridSize * 0.018,
      },
    )
  }

  if (random01(context.seed + 71) > 0.62) {
    context.graphics
      .ellipse(
        context.x + randomRange(context.seed + 72, context.width * 0.2, context.width * 0.8),
        context.y + randomRange(context.seed + 73, context.height * 0.22, context.height * 0.78),
        randomRange(context.seed + 74, context.gridSize * 0.08, context.gridSize * 0.18),
        randomRange(context.seed + 75, context.gridSize * 0.025, context.gridSize * 0.055),
      )
      .fill({
        color: context.secondaryColor,
        alpha: context.alpha * 0.12,
      })
  }
}

const drawPathTracks = (
  graphics: Graphics,
  width: number,
  height: number,
  gridSize: number,
  seed: number,
  color: number,
  alpha: number,
): void => {
  const horizontal = width >= height
  const length = horizontal ? width : height
  const cross = horizontal ? height : width
  const trackOffset = cross * 0.18
  const center = cross * 0.5

  for (const side of [-1, 1]) {
    if (horizontal) {
      drawSketchLine(
        graphics,
        gridSize * 0.18,
        center +
          side * trackOffset +
          randomRange(seed + side * 11, -gridSize * 0.05, gridSize * 0.05),
        length - gridSize * 0.18,
        center +
          side * trackOffset +
          randomRange(seed + side * 13, -gridSize * 0.08, gridSize * 0.08),
        seed + side * 17,
        {
          color,
          alpha: alpha * 0.2,
          width: detailWidth(gridSize, 0.035),
          wobble: gridSize * 0.08,
        },
      )
      continue
    }

    drawSketchLine(
      graphics,
      center +
        side * trackOffset +
        randomRange(seed + side * 11, -gridSize * 0.05, gridSize * 0.05),
      gridSize * 0.18,
      center +
        side * trackOffset +
        randomRange(seed + side * 13, -gridSize * 0.08, gridSize * 0.08),
      length - gridSize * 0.18,
      seed + side * 17,
      {
        color,
        alpha: alpha * 0.2,
        width: detailWidth(gridSize, 0.035),
        wobble: gridSize * 0.08,
      },
    )
  }

  for (let index = 0; index < Math.max(3, Math.floor(length / gridSize)); index += 1) {
    const markSeed = seed + index * 37
    if (horizontal) {
      const x = randomRange(markSeed + 1, gridSize * 0.2, length - gridSize * 0.2)
      const y = center + randomRange(markSeed + 2, -cross * 0.2, cross * 0.2)
      drawSketchLine(
        graphics,
        x,
        y,
        x + randomRange(markSeed + 3, gridSize * 0.16, gridSize * 0.34),
        y + randomRange(markSeed + 4, -gridSize * 0.06, gridSize * 0.06),
        markSeed + 5,
        {
          color,
          alpha: alpha * 0.13,
          width: detailWidth(gridSize, 0.018),
          wobble: gridSize * 0.02,
        },
      )
    } else {
      const x = center + randomRange(markSeed + 2, -cross * 0.2, cross * 0.2)
      const y = randomRange(markSeed + 1, gridSize * 0.2, length - gridSize * 0.2)
      drawSketchLine(
        graphics,
        x,
        y,
        x + randomRange(markSeed + 3, -gridSize * 0.06, gridSize * 0.06),
        y + randomRange(markSeed + 4, gridSize * 0.16, gridSize * 0.34),
        markSeed + 5,
        {
          color,
          alpha: alpha * 0.13,
          width: detailWidth(gridSize, 0.018),
          wobble: gridSize * 0.02,
        },
      )
    }
  }
}

const drawEarthDetails = (context: GroundTileContext): void => {
  if (random01(context.seed + 20) > 0.42) {
    drawOrganicPatch(
      context,
      random01(context.seed + 21) > 0.5
        ? shiftColor(context.baseColor, -16)
        : shiftColor(context.baseColor, 14),
      randomRange(context.seed + 22, 0.07, 0.16),
      context.seed + 23,
    )
  }

  drawPebbles(context, 1 + Math.floor(random01(context.seed + 3) * 2))
  if (random01(context.seed + 4) > 0.78) {
    drawCrack(context, context.seed + 5, 0.16)
  }
}

const drawCaveDetails = (context: GroundTileContext): void => {
  drawOrganicPatch(context, shiftColor(context.baseColor, -14), 0.1, context.seed + 15)
  drawPebbles(context, 2)
  if (random01(context.seed + 6) > 0.55) {
    drawCrack(context, context.seed + 7, 0.3)
  }
}

const drawSandOrSnow = (context: GroundTileContext): void => {
  const marks = 2 + Math.floor(random01(context.seed + 1) * 3)
  for (let index = 0; index < marks; index += 1) {
    const seed = context.seed + index * 37
    drawLine(
      context.graphics,
      context.x + randomRange(seed + 1, context.width * 0.12, context.width * 0.65),
      context.y + randomRange(seed + 2, context.height * 0.16, context.height * 0.84),
      context.x + randomRange(seed + 3, context.width * 0.35, context.width * 0.92),
      context.y + randomRange(seed + 4, context.height * 0.16, context.height * 0.84),
      context.secondaryColor,
      context.alpha * 0.2,
      1,
    )
  }
}

const drawTile = (context: GroundTileContext): void => {
  const inset = Math.max(1, context.gridSize * 0.025)
  context.graphics
    .rect(
      context.x + inset,
      context.y + inset,
      Math.max(0, context.width - inset * 2),
      Math.max(0, context.height - inset * 2),
    )
    .stroke({
      color: inkColor,
      alpha: context.alpha * 0.48,
      width: detailWidth(context.gridSize, 0.026),
    })
  context.graphics
    .rect(context.x + inset, context.y + inset, context.width - inset * 2, context.height * 0.11)
    .fill({ color: warmHighlightColor, alpha: context.alpha * 0.06 })
    .rect(
      context.x + context.width - context.width * 0.12,
      context.y + inset,
      context.width * 0.1,
      context.height - inset * 2,
    )
    .fill({ color: inkColor, alpha: context.alpha * 0.035 })

  if (random01(context.seed + 5) > 0.36) {
    drawCrack(context, context.seed + 6, 0.38)
  }
  if (random01(context.seed + 7) > 0.54) {
    drawPebbles(context, 1 + Math.floor(random01(context.seed + 8) * 2))
  }
}

const drawWood = (context: GroundTileContext): void => {
  const lines = 3 + Math.floor(random01(context.seed + 1) * 3)
  for (let index = 0; index < lines; index += 1) {
    const seed = context.seed + index * 29
    const y = context.y + randomRange(seed + 2, context.height * 0.16, context.height * 0.84)
    drawLine(
      context.graphics,
      context.x + context.width * 0.08,
      y,
      context.x + context.width * 0.92,
      y + randomRange(seed + 3, -context.gridSize * 0.03, context.gridSize * 0.03),
      context.secondaryColor,
      context.alpha * 0.28,
      1,
    )
  }

  if (random01(context.seed + 41) > 0.74) {
    context.graphics
      .circle(
        context.x + randomRange(context.seed + 42, context.width * 0.2, context.width * 0.8),
        context.y + randomRange(context.seed + 43, context.height * 0.2, context.height * 0.8),
        randomRange(context.seed + 44, context.gridSize * 0.05, context.gridSize * 0.11),
      )
      .stroke({ color: context.secondaryColor, alpha: context.alpha * 0.34, width: 1 })
  }
}

const drawMarsh = (context: GroundTileContext): void => {
  drawGrass(context)
  if (random01(context.seed + 19) > 0.58) {
    context.graphics
      .ellipse(
        context.x + randomRange(context.seed + 20, context.width * 0.15, context.width * 0.85),
        context.y + randomRange(context.seed + 21, context.height * 0.15, context.height * 0.85),
        randomRange(context.seed + 22, context.gridSize * 0.08, context.gridSize * 0.18),
        randomRange(context.seed + 23, context.gridSize * 0.04, context.gridSize * 0.1),
      )
      .fill({ color: 0x223f3b, alpha: context.alpha * 0.34 })
  }
}

const drawGroundDetails = (context: GroundTileContext): void => {
  switch (context.variant) {
    case 'earth':
      drawEarthDetails(context)
      break
    case 'cave':
      drawCaveDetails(context)
      break
    case 'grass':
      drawGrass(context)
      break
    case 'forest':
      drawForestFloor(context)
      break
    case 'path':
      drawPath(context)
      break
    case 'tile':
      drawTile(context)
      break
    case 'wood':
      drawWood(context)
      break
    case 'sand':
    case 'snow':
      drawSandOrSnow(context)
      break
    case 'marsh':
      drawMarsh(context)
      break
  }
}

const renderGroundArea = (definition: ResolvedMapObject, gridSize: number): RuntimeMapObject => {
  const container = new Container()
  container.eventMode = 'none'
  container.position.set(
    toPixels(definition.position.x, gridSize),
    toPixels(definition.position.y, gridSize),
  )
  container.rotation = definition.rotation
  container.scale.set(definition.scale)
  container.visible = definition.visible

  const graphics = new Graphics()
  const variant = groundVariantSet.has(definition.variant ?? '')
    ? (definition.variant as GroundVariant)
    : 'earth'
  const cellsX = Math.ceil(definition.width)
  const cellsY = Math.ceil(definition.height)
  const objectSeed = hashString(
    `${definition.type}:${definition.id}:${definition.preset ?? variant}`,
  )
  const totalWidth = toPixels(definition.width, gridSize)
  const totalHeight = toPixels(definition.height, gridSize)
  const organicBase = organicEdgeVariantSet.has(variant)
  const baseColor = jitterColor(definition.color, objectSeed, organicBase ? 10 : 18)

  fillGroundBase(
    graphics,
    totalWidth,
    totalHeight,
    gridSize,
    objectSeed,
    baseColor,
    definition.alpha,
    variant,
  )

  if (variant === 'path') {
    drawPathTracks(
      graphics,
      totalWidth,
      totalHeight,
      gridSize,
      objectSeed + 71,
      jitterColor(definition.secondaryColor, objectSeed + 13, 8),
      definition.alpha,
    )
  }

  for (let cellY = 0; cellY < cellsY; cellY += 1) {
    for (let cellX = 0; cellX < cellsX; cellX += 1) {
      const cellWidthGrid = Math.min(1, definition.width - cellX)
      const cellHeightGrid = Math.min(1, definition.height - cellY)
      if (cellWidthGrid <= 0 || cellHeightGrid <= 0) {
        continue
      }

      const seed = objectSeed + cellX * 92821 + cellY * 68917
      const x = toPixels(cellX, gridSize)
      const y = toPixels(cellY, gridSize)
      const width = toPixels(cellWidthGrid, gridSize)
      const height = toPixels(cellHeightGrid, gridSize)
      const cellBaseColor = jitterColor(definition.color, seed, variant === 'tile' ? 18 : 12)
      const secondaryColor = jitterColor(definition.secondaryColor, seed + 13, 10)

      if (!organicBase) {
        graphics.rect(x, y, width, height).fill({ color: cellBaseColor, alpha: definition.alpha })
        graphics
          .rect(x, y, width, Math.max(1, gridSize * 0.08))
          .fill({ color: shiftColor(cellBaseColor, 26), alpha: definition.alpha * 0.05 })
          .rect(x, y + height - Math.max(1, gridSize * 0.12), width, Math.max(1, gridSize * 0.12))
          .fill({ color: inkColor, alpha: definition.alpha * 0.035 })
      }

      drawGroundDetails({
        graphics,
        variant,
        x,
        y,
        width,
        height,
        gridSize,
        seed,
        baseColor: cellBaseColor,
        secondaryColor,
        alpha: definition.alpha,
      })
    }
  }

  container.addChild(graphics)
  return createRuntime(definition, container)
}

const validateGroundArea = (definition: MapObjectDefinition): readonly string[] => {
  const errors = [...validateBaseObject(definition)]
  if (definition.variant && !groundVariantSet.has(definition.variant)) {
    errors.push(`Unbekannte Bodenvariante "${definition.variant}".`)
  }
  return errors
}

const serializeGroundArea = (definition: ResolvedMapObject): MapObjectDefinition => ({
  id: definition.id,
  type: definition.type,
  preset: definition.preset,
  levelId: definition.levelId,
  position: definition.position,
  width: definition.width,
  height: definition.height,
  rotation: definition.rotation,
  scale: definition.scale,
  variant: definition.variant,
  visible: definition.visible,
  layer: definition.layer,
  tags: definition.tags,
  color: definition.color,
  secondaryColor: definition.secondaryColor,
  alpha: definition.alpha,
})

export const registerGroundObjects = (registry: MapObjectRegistry): void => {
  const registration: MapObjectRegistration = {
    type: 'ground-area',
    defaults: {
      width: 4,
      height: 4,
      variant: 'earth',
      color: 0x5f4a31,
      secondaryColor: 0x2f2418,
      layer: 'floor',
      tags: ['ground'],
    },
    presets: groundPresets,
    validate: validateGroundArea,
    render: (definition, context) => renderGroundArea(definition, context.gridSize),
    serialize: serializeGroundArea,
  }

  registry.register(registration)
}
