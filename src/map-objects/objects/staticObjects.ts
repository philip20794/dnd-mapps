import { Container, Graphics, Rectangle } from 'pixi.js'
import type { MapObjectRegistry } from '../registry'
import type {
  MapObjectDefinition,
  MapObjectRegistration,
  ObjectPreset,
  ResolvedMapObject,
} from '../types'
import { validateBaseObject } from '../validation'
import { createLabel, createRuntime, drawObjectRect, rectSegments, toPixels } from '../renderer'
import {
  deepShadowColor,
  detailWidth,
  drawDirtSpeckles,
  drawSketchLine,
  hashString,
  inkColor,
  jitterColor,
  outlineWidth,
  random01,
  randomRange,
  warmHighlightColor,
} from '../visualStyle'

interface DrawObjectContext {
  readonly width: number
  readonly height: number
  readonly gridSize: number
  readonly color: number
  readonly secondaryColor: number
  readonly alpha: number
  readonly seed: number
}

const drawShadow = (graphics: Graphics, width: number, height: number): void => {
  graphics
    .ellipse(width / 2, height * 0.82, width * 0.42, Math.max(2, height * 0.12))
    .fill({ color: deepShadowColor, alpha: 0.3 })
}

const drawWoodGrain = (
  graphics: Graphics,
  width: number,
  height: number,
  color: number,
  seed: number,
  alpha = 0.28,
): void => {
  const lines = 4
  for (let index = 1; index <= lines; index += 1) {
    const y = (height / (lines + 1)) * index
    drawSketchLine(
      graphics,
      width * 0.12,
      y,
      width * 0.9,
      y + randomRange(seed + index * 17, -height * 0.025, height * 0.025),
      seed + index * 29,
      { color, alpha, width: 1, wobble: Math.max(1, height * 0.025) },
    )
  }
}

const drawStoneBlockLines = (graphics: Graphics, context: DrawObjectContext): void => {
  const rows = Math.max(1, Math.round(context.height / context.gridSize))
  const cols = Math.max(1, Math.round(context.width / context.gridSize))
  for (let row = 1; row < rows; row += 1) {
    const y = (context.height / rows) * row
    drawSketchLine(graphics, 2, y, context.width - 2, y, context.seed + row * 101, {
      color: inkColor,
      alpha: context.alpha * 0.26,
      width: detailWidth(context.gridSize, 0.018),
      wobble: context.gridSize * 0.025,
    })
  }
  for (let col = 1; col < cols; col += 1) {
    const x = (context.width / cols) * col
    const offset = col % 2 === 0 ? 0 : context.height / rows / 2
    drawSketchLine(graphics, x, offset, x, context.height, context.seed + col * 113, {
      color: inkColor,
      alpha: context.alpha * 0.24,
      width: detailWidth(context.gridSize, 0.018),
      wobble: context.gridSize * 0.02,
    })
  }
}

const drawStoneWall = (graphics: Graphics, context: DrawObjectContext): void => {
  graphics
    .roundRect(
      context.gridSize * 0.025,
      context.gridSize * 0.035,
      context.width,
      context.height,
      Math.max(2, context.gridSize * 0.04),
    )
    .fill({ color: deepShadowColor, alpha: 0.34 })
  graphics
    .roundRect(0, 0, context.width, context.height, Math.max(2, context.gridSize * 0.04))
    .fill({ color: context.color, alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.95,
      width: outlineWidth(context.gridSize, 0.065),
    })
  graphics
    .rect(context.width * 0.05, context.height * 0.08, context.width * 0.9, context.height * 0.18)
    .fill({ color: warmHighlightColor, alpha: 0.09 })

  const horizontal = context.width >= context.height
  const length = horizontal ? context.width : context.height
  const thickness = horizontal ? context.height : context.width
  const blockCount = Math.max(1, Math.round(length / (context.gridSize * 0.52)))
  const inset = Math.max(2, context.gridSize * 0.035)

  for (let index = 0; index < blockCount; index += 1) {
    const seed = context.seed + index * 59
    const start = (length / blockCount) * index
    const end = (length / blockCount) * (index + 1)
    const jitterStart = index === 0 ? 0 : randomRange(seed + 1, -context.gridSize * 0.04, 0)
    const jitterEnd =
      index === blockCount - 1 ? length : end + randomRange(seed + 2, 0, context.gridSize * 0.05)
    const blockColor = jitterColor(context.color, seed + 3, 24)
    const sideInset = randomRange(seed + 4, inset * 0.45, inset)
    const crossInset = randomRange(seed + 5, inset * 0.45, inset * 1.1)

    if (horizontal) {
      const x = Math.max(inset * 0.3, start + jitterStart)
      const width = Math.max(context.gridSize * 0.22, jitterEnd - x)
      graphics
        .roundRect(x, sideInset, width, Math.max(2, thickness - crossInset * 1.5), 3)
        .fill({ color: blockColor, alpha: context.alpha * 0.72 })
        .stroke({
          color: inkColor,
          alpha: 0.38,
          width: detailWidth(context.gridSize, 0.024),
        })
      if (random01(seed + 6) > 0.48) {
        drawSketchLine(
          graphics,
          x + width * 0.2,
          thickness * randomRange(seed + 7, 0.32, 0.72),
          x + width * 0.82,
          thickness * randomRange(seed + 8, 0.28, 0.7),
          seed + 9,
          { color: inkColor, alpha: 0.25, width: 1, wobble: context.gridSize * 0.02 },
        )
      }
    } else {
      const y = Math.max(inset * 0.3, start + jitterStart)
      const height = Math.max(context.gridSize * 0.22, jitterEnd - y)
      graphics
        .roundRect(sideInset, y, Math.max(2, thickness - crossInset * 1.5), height, 3)
        .fill({ color: blockColor, alpha: context.alpha * 0.72 })
        .stroke({
          color: inkColor,
          alpha: 0.38,
          width: detailWidth(context.gridSize, 0.024),
        })
      if (random01(seed + 6) > 0.48) {
        drawSketchLine(
          graphics,
          thickness * randomRange(seed + 7, 0.28, 0.72),
          y + height * 0.22,
          thickness * randomRange(seed + 8, 0.28, 0.72),
          y + height * 0.82,
          seed + 9,
          { color: inkColor, alpha: 0.25, width: 1, wobble: context.gridSize * 0.02 },
        )
      }
    }
  }

  drawStoneBlockLines(graphics, context)
}

const drawColumn = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const radius = Math.min(context.width, context.height) * 0.45
  graphics
    .circle(context.width / 2, context.height / 2, radius)
    .fill({ color: context.color, alpha: context.alpha })
    .stroke({
      color: context.secondaryColor,
      alpha: 0.95,
      width: Math.max(2, context.gridSize * 0.045),
    })
  graphics
    .circle(context.width / 2, context.height / 2, radius * 0.68)
    .stroke({ color: 0xffffff, alpha: 0.13, width: Math.max(1, context.gridSize * 0.025) })
  graphics
    .circle(context.width * 0.4, context.height * 0.36, radius * 0.16)
    .fill({ color: 0xffffff, alpha: 0.09 })
}

const drawCrate = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const crateColor = jitterColor(context.color, context.seed, 18)
  graphics
    .roundRect(
      context.width * 0.08,
      context.height * 0.08,
      context.width * 0.84,
      context.height * 0.78,
      3,
    )
    .fill({ color: crateColor, alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.95,
      width: outlineWidth(context.gridSize, 0.045),
    })
  graphics
    .rect(context.width * 0.13, context.height * 0.12, context.width * 0.74, context.height * 0.12)
    .fill({ color: warmHighlightColor, alpha: 0.09 })
  for (const x of [0.32, 0.66]) {
    graphics
      .rect(context.width * x, context.height * 0.1, context.width * 0.06, context.height * 0.74)
      .fill({ color: context.secondaryColor, alpha: 0.5 })
  }
  graphics
    .moveTo(context.width * 0.14, context.height * 0.18)
    .lineTo(context.width * 0.86, context.height * 0.78)
    .moveTo(context.width * 0.86, context.height * 0.18)
    .lineTo(context.width * 0.14, context.height * 0.78)
    .stroke({
      color: inkColor,
      alpha: 0.62,
      width: detailWidth(context.gridSize, 0.035),
    })
  drawWoodGrain(graphics, context.width, context.height, context.secondaryColor, context.seed, 0.26)
}

const drawBarrel = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .ellipse(context.width / 2, context.height / 2, context.width * 0.38, context.height * 0.43)
    .fill({ color: jitterColor(context.color, context.seed, 18), alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.94,
      width: outlineWidth(context.gridSize, 0.045),
    })
  graphics
    .ellipse(context.width / 2, context.height * 0.28, context.width * 0.32, context.height * 0.12)
    .stroke({ color: 0xf0c58a, alpha: 0.2, width: 1 })
  for (const y of [0.34, 0.66]) {
    graphics
      .ellipse(context.width / 2, context.height * y, context.width * 0.37, context.height * 0.08)
      .stroke({
        color: context.secondaryColor,
        alpha: 0.82,
        width: detailWidth(context.gridSize, 0.04),
      })
  }
  graphics
    .moveTo(context.width * 0.5, context.height * 0.15)
    .lineTo(context.width * 0.5, context.height * 0.85)
    .stroke({ color: context.secondaryColor, alpha: 0.28, width: 1 })
}

const drawTable = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const topY = context.height * 0.14
  const topHeight = context.height * 0.66
  graphics
    .roundRect(
      context.width * 0.05,
      topY,
      context.width * 0.9,
      topHeight,
      Math.max(3, context.gridSize * 0.04),
    )
    .fill({ color: jitterColor(context.color, context.seed, 14), alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.96,
      width: outlineWidth(context.gridSize, 0.045),
    })
  for (const x of [0.18, 0.82]) {
    for (const y of [0.24, 0.68]) {
      graphics
        .circle(context.width * x, context.height * y, Math.max(2, context.gridSize * 0.055))
        .fill({ color: context.secondaryColor, alpha: 0.52 })
    }
  }
  drawWoodGrain(
    graphics,
    context.width,
    context.height,
    context.secondaryColor,
    context.seed + 11,
    0.36,
  )
  graphics
    .rect(
      context.width * 0.08,
      topY + topHeight * 0.12,
      context.width * 0.84,
      Math.max(1, context.gridSize * 0.025),
    )
    .fill({ color: 0xffffff, alpha: 0.08 })
  drawDirtSpeckles(graphics, context.width, context.height, context.seed + 37, 5, {
    color: inkColor,
    alpha: 0.14,
    minRadius: 0.8,
    maxRadius: 1.7,
  })
}

const drawChair = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const cushionColor = 0x9a3f32
  graphics
    .roundRect(
      context.width * 0.17,
      context.height * 0.3,
      context.width * 0.66,
      context.height * 0.5,
      3,
    )
    .fill({ color: cushionColor, alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.92,
      width: detailWidth(context.gridSize, 0.04),
    })
  graphics
    .roundRect(
      context.width * 0.18,
      context.height * 0.08,
      context.width * 0.64,
      context.height * 0.18,
      2,
    )
    .fill({ color: jitterColor(context.color, context.seed + 41, 12), alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.85,
      width: detailWidth(context.gridSize, 0.025),
    })
  for (const x of [0.26, 0.74]) {
    graphics
      .rect(
        context.width * x,
        context.height * 0.74,
        Math.max(2, context.gridSize * 0.045),
        context.height * 0.18,
      )
      .fill({ color: context.secondaryColor, alpha: 0.52 })
  }
  graphics
    .moveTo(context.width * 0.28, context.height * 0.42)
    .lineTo(context.width * 0.72, context.height * 0.66)
    .stroke({ color: inkColor, alpha: 0.22, width: 1 })
  drawWoodGrain(
    graphics,
    context.width,
    context.height,
    context.secondaryColor,
    context.seed + 17,
    0.24,
  )
}

const drawRock = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .ellipse(
      context.width * 0.5,
      context.height * 0.54,
      context.width * 0.42,
      context.height * 0.34,
    )
    .fill({ color: jitterColor(context.color, context.seed, 18), alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.88,
      width: detailWidth(context.gridSize, 0.045),
    })
  graphics
    .ellipse(
      context.width * 0.42,
      context.height * 0.42,
      context.width * 0.2,
      context.height * 0.15,
    )
    .fill({ color: 0xffffff, alpha: 0.08 })
  graphics
    .moveTo(context.width * 0.32, context.height * 0.58)
    .lineTo(context.width * 0.5, context.height * 0.36)
    .lineTo(context.width * 0.72, context.height * 0.58)
    .stroke({ color: inkColor, alpha: 0.32, width: 1 })
  drawDirtSpeckles(graphics, context.width, context.height, context.seed + 71, 3, {
    color: inkColor,
    alpha: 0.16,
    minRadius: 0.9,
    maxRadius: 1.8,
  })
}

const drawTree = (graphics: Graphics, context: DrawObjectContext, variant = 'old-oak'): void => {
  drawShadow(graphics, context.width, context.height)
  const trunkColor = context.secondaryColor
  const canopyColor = context.color

  if (variant === 'dead-tree') {
    graphics
      .ellipse(
        context.width * 0.5,
        context.height * 0.58,
        context.width * 0.14,
        context.height * 0.26,
      )
      .fill({ color: trunkColor, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.9, width: detailWidth(context.gridSize, 0.035) })
    graphics
      .moveTo(context.width * 0.5, context.height * 0.44)
      .lineTo(context.width * 0.28, context.height * 0.28)
      .moveTo(context.width * 0.53, context.height * 0.42)
      .lineTo(context.width * 0.75, context.height * 0.24)
      .moveTo(context.width * 0.48, context.height * 0.58)
      .lineTo(context.width * 0.25, context.height * 0.66)
      .stroke({
        color: inkColor,
        alpha: context.alpha,
        width: outlineWidth(context.gridSize, 0.045),
      })
    return
  }

  if (variant === 'pine-tree') {
    graphics
      .ellipse(
        context.width * 0.5,
        context.height * 0.58,
        context.width * 0.16,
        context.height * 0.22,
      )
      .fill({ color: trunkColor, alpha: context.alpha })
    for (const [y, radiusX, radiusY] of [
      [0.3, 0.3, 0.17],
      [0.45, 0.38, 0.19],
      [0.62, 0.45, 0.21],
    ] as const) {
      graphics
        .ellipse(
          context.width * 0.5,
          context.height * y,
          context.width * radiusX,
          context.height * radiusY,
        )
        .fill({ color: canopyColor, alpha: context.alpha * 0.92 })
        .stroke({ color: inkColor, alpha: 0.38, width: detailWidth(context.gridSize, 0.022) })
    }
    graphics
      .ellipse(
        context.width * 0.4,
        context.height * 0.34,
        context.width * 0.12,
        context.height * 0.06,
      )
      .fill({ color: 0xffffff, alpha: 0.07 })
    return
  }

  if (variant === 'birch-tree') {
    graphics
      .ellipse(context.width * 0.5, context.height * 0.6, context.width * 0.1, context.height * 0.3)
      .fill({ color: 0xd9d7c8, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.72, width: detailWidth(context.gridSize, 0.02) })
    for (const y of [0.42, 0.52, 0.64]) {
      drawSketchLine(
        graphics,
        context.width * 0.42,
        context.height * y,
        context.width * 0.56,
        context.height * (y + 0.02),
        context.seed + Math.round(y * 100),
        { color: inkColor, alpha: 0.48, width: 1, wobble: 1 },
      )
    }
    for (const [x, y, rx, ry, alpha] of [
      [0.47, 0.34, 0.28, 0.19, 0.92],
      [0.32, 0.47, 0.22, 0.17, 0.84],
      [0.64, 0.48, 0.24, 0.18, 0.86],
      [0.48, 0.61, 0.26, 0.16, 0.78],
    ] as const) {
      graphics
        .ellipse(context.width * x, context.height * y, context.width * rx, context.height * ry)
        .fill({
          color: jitterColor(canopyColor, context.seed + Math.round(x * 120 + y * 90), 18),
          alpha: context.alpha * alpha,
        })
        .stroke({ color: inkColor, alpha: 0.26, width: 1 })
    }
    return
  }

  if (variant === 'autumn-maple') {
    graphics
      .ellipse(
        context.width * 0.5,
        context.height * 0.61,
        context.width * 0.16,
        context.height * 0.24,
      )
      .fill({ color: trunkColor, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.7, width: detailWidth(context.gridSize, 0.024) })
    for (const [x, y, rx, ry, color, alpha] of [
      [0.5, 0.36, 0.33, 0.23, 0x9c3f2f, 0.94],
      [0.32, 0.5, 0.25, 0.21, 0xb25e2f, 0.9],
      [0.68, 0.51, 0.25, 0.21, 0xc48632, 0.86],
      [0.48, 0.63, 0.31, 0.2, 0x7f5b2e, 0.82],
      [0.5, 0.47, 0.22, 0.16, 0xd49a3a, 0.76],
    ] as const) {
      graphics
        .ellipse(context.width * x, context.height * y, context.width * rx, context.height * ry)
        .fill({
          color: jitterColor(color, context.seed + Math.round(x * 130 + y * 110), 12),
          alpha: context.alpha * alpha,
        })
        .stroke({ color: inkColor, alpha: 0.28, width: 1 })
    }
    graphics
      .ellipse(
        context.width * 0.37,
        context.height * 0.31,
        context.width * 0.11,
        context.height * 0.06,
      )
      .fill({ color: warmHighlightColor, alpha: 0.1 })
    return
  }

  graphics
    .ellipse(context.width * 0.5, context.height * 0.6, context.width * 0.16, context.height * 0.22)
    .fill({ color: trunkColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.72, width: detailWidth(context.gridSize, 0.025) })

  for (const [x, y, rx, ry, alpha] of [
    [0.5, 0.42, 0.34, 0.28, 0.95],
    [0.32, 0.52, 0.25, 0.22, 0.88],
    [0.68, 0.52, 0.25, 0.22, 0.88],
    [0.5, 0.64, 0.3, 0.2, 0.82],
  ] as const) {
    graphics
      .ellipse(context.width * x, context.height * y, context.width * rx, context.height * ry)
      .fill({
        color: jitterColor(canopyColor, context.seed + Math.round(x * 100 + y * 100), 16),
        alpha: context.alpha * alpha,
      })
      .stroke({ color: inkColor, alpha: 0.3, width: 1 })
  }
  graphics
    .ellipse(
      context.width * 0.38,
      context.height * 0.34,
      context.width * 0.11,
      context.height * 0.06,
    )
    .fill({ color: 0xffffff, alpha: 0.08 })
}

const drawBush = (graphics: Graphics, context: DrawObjectContext, variant = 'leafy-bush'): void => {
  drawShadow(graphics, context.width, context.height)
  const thorny = variant === 'thorn-bush'
  const berry = variant === 'berry-bush'
  const leafClusters = thorny
    ? ([
        [0.32, 0.56, 0.25, 0.22],
        [0.5, 0.42, 0.3, 0.24],
        [0.68, 0.56, 0.25, 0.22],
        [0.5, 0.66, 0.34, 0.2],
      ] as const)
    : ([
        [0.28, 0.58, 0.25, 0.2],
        [0.43, 0.43, 0.3, 0.25],
        [0.62, 0.42, 0.28, 0.24],
        [0.74, 0.58, 0.23, 0.19],
        [0.5, 0.67, 0.36, 0.19],
      ] as const)

  for (const [x, y, rx, ry] of leafClusters) {
    graphics
      .ellipse(context.width * x, context.height * y, context.width * rx, context.height * ry)
      .fill({
        color: jitterColor(context.color, context.seed + Math.round(x * 140 + y * 90), 16),
        alpha: context.alpha * (thorny ? 0.84 : 0.9),
      })
      .stroke({ color: inkColor, alpha: thorny ? 0.34 : 0.25, width: 1 })
  }

  if (thorny) {
    for (let index = 0; index < 6; index += 1) {
      const seed = context.seed + index * 53
      const startX = context.width * randomRange(seed + 1, 0.16, 0.82)
      const startY = context.height * randomRange(seed + 2, 0.34, 0.7)
      drawSketchLine(
        graphics,
        startX,
        startY,
        startX + context.width * randomRange(seed + 3, -0.18, 0.18),
        startY + context.height * randomRange(seed + 4, -0.16, 0.16),
        seed + 5,
        {
          color: context.secondaryColor,
          alpha: 0.65,
          width: detailWidth(context.gridSize, 0.018),
          wobble: context.gridSize * 0.01,
        },
      )
    }
    return
  }

  if (berry) {
    for (let index = 0; index < 5; index += 1) {
      const seed = context.seed + index * 37
      graphics
        .circle(
          context.width * randomRange(seed + 1, 0.25, 0.76),
          context.height * randomRange(seed + 2, 0.38, 0.66),
          Math.max(1.5, context.gridSize * 0.026),
        )
        .fill({ color: 0x7f1d1d, alpha: 0.86 })
        .stroke({ color: inkColor, alpha: 0.32, width: 1 })
    }
  }

  graphics
    .ellipse(
      context.width * 0.42,
      context.height * 0.35,
      context.width * 0.12,
      context.height * 0.06,
    )
    .fill({ color: 0xffffff, alpha: 0.07 })
}

const drawThicket = (graphics: Graphics, context: DrawObjectContext, variant = 'bramble'): void => {
  drawShadow(graphics, context.width, context.height)
  const dry = variant === 'dry-scrub'
  const baseColor = dry ? 0x7a6a42 : context.color
  const stemColor = dry ? 0x4f3a20 : context.secondaryColor

  for (const [x, y, rx, ry, alpha] of [
    [0.22, 0.58, 0.22, 0.24, 0.58],
    [0.38, 0.47, 0.27, 0.28, 0.7],
    [0.58, 0.5, 0.3, 0.3, 0.72],
    [0.76, 0.62, 0.22, 0.22, 0.58],
    [0.48, 0.68, 0.38, 0.22, 0.62],
  ] as const) {
    graphics
      .ellipse(context.width * x, context.height * y, context.width * rx, context.height * ry)
      .fill({
        color: jitterColor(baseColor, context.seed + Math.round(x * 150 + y * 100), dry ? 22 : 16),
        alpha: context.alpha * alpha,
      })
      .stroke({ color: inkColor, alpha: 0.22, width: 1 })
  }

  for (let index = 0; index < 10; index += 1) {
    const seed = context.seed + index * 67
    const startX = context.width * randomRange(seed + 1, 0.14, 0.86)
    const startY = context.height * randomRange(seed + 2, 0.28, 0.78)
    drawSketchLine(
      graphics,
      startX,
      startY,
      startX + context.width * randomRange(seed + 3, -0.22, 0.22),
      startY + context.height * randomRange(seed + 4, -0.2, 0.18),
      seed + 5,
      {
        color: stemColor,
        alpha: dry ? 0.58 : 0.48,
        width: detailWidth(context.gridSize, 0.016),
        wobble: context.gridSize * 0.016,
      },
    )
  }

  drawDirtSpeckles(graphics, context.width, context.height, context.seed + 379, dry ? 6 : 4, {
    color: inkColor,
    alpha: dry ? 0.16 : 0.11,
    minRadius: 0.7,
    maxRadius: 1.4,
  })
}

const drawBridge = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const vertical = context.height >= context.width
  graphics
    .roundRect(
      context.width * 0.08,
      context.height * 0.06,
      context.width * 0.84,
      context.height * 0.88,
      3,
    )
    .fill({ color: jitterColor(context.color, context.seed, 14), alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.95,
      width: outlineWidth(context.gridSize, 0.045),
    })

  const plankCount = Math.max(
    4,
    Math.round((vertical ? context.height : context.width) / (context.gridSize * 0.55)),
  )
  for (let index = 1; index < plankCount; index += 1) {
    const t = index / plankCount
    if (vertical) {
      const y = context.height * (0.08 + t * 0.84)
      graphics
        .moveTo(context.width * 0.12, y)
        .lineTo(context.width * 0.88, y)
        .stroke({ color: inkColor, alpha: 0.42, width: 1 })
    } else {
      const x = context.width * (0.08 + t * 0.84)
      graphics
        .moveTo(x, context.height * 0.12)
        .lineTo(x, context.height * 0.88)
        .stroke({ color: inkColor, alpha: 0.42, width: 1 })
    }
  }

  if (vertical) {
    for (const x of [0.17, 0.83]) {
      graphics
        .rect(
          context.width * x - context.gridSize * 0.025,
          context.height * 0.06,
          context.gridSize * 0.05,
          context.height * 0.88,
        )
        .fill({ color: context.secondaryColor, alpha: 0.9 })
    }
  } else {
    for (const y of [0.17, 0.83]) {
      graphics
        .rect(
          context.width * 0.06,
          context.height * y - context.gridSize * 0.025,
          context.width * 0.88,
          context.gridSize * 0.05,
        )
        .fill({ color: context.secondaryColor, alpha: 0.9 })
    }
  }
  drawWoodGrain(
    graphics,
    context.width,
    context.height,
    context.secondaryColor,
    context.seed + 23,
    0.24,
  )
}

const drawWoodenBarricade = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const vertical = context.height >= context.width
  const length = vertical ? context.height : context.width
  const thickness = vertical ? context.width : context.height
  const plankCount = Math.max(5, Math.round(length / (context.gridSize * 0.62)))

  graphics
    .roundRect(
      context.width * 0.04,
      context.height * 0.04,
      context.width * 0.92,
      context.height * 0.92,
      Math.max(2, context.gridSize * 0.035),
    )
    .fill({ color: deepShadowColor, alpha: 0.22 })

  const drawPointedLog = (
    center: number,
    cross: number,
    logLength: number,
    logThickness: number,
    seed: number,
    color: number,
  ): void => {
    const halfLength = logLength / 2
    const halfThickness = logThickness / 2
    const tip = logThickness * 0.42

    if (vertical) {
      const x1 = cross - halfLength
      const x2 = cross + halfLength
      const y1 = center - halfThickness
      const y2 = center + halfThickness
      graphics
        .moveTo(x1 + tip, y1)
        .lineTo(x2 - tip, y1)
        .lineTo(x2, center)
        .lineTo(x2 - tip, y2)
        .lineTo(x1 + tip, y2)
        .lineTo(x1, center)
        .lineTo(x1 + tip, y1)
        .fill({ color, alpha: context.alpha })
        .stroke({ color: inkColor, alpha: 0.86, width: detailWidth(context.gridSize, 0.03) })
      drawSketchLine(graphics, x1 + tip * 1.2, center, x2 - tip * 1.2, center, seed + 13, {
        color: context.secondaryColor,
        alpha: 0.36,
        width: 1,
        wobble: context.gridSize * 0.018,
      })
      return
    }

    const x1 = center - halfThickness
    const x2 = center + halfThickness
    const y1 = cross - halfLength
    const y2 = cross + halfLength
    graphics
      .moveTo(x1, y1 + tip)
      .lineTo(x1, y2 - tip)
      .lineTo(center, y2)
      .lineTo(x2, y2 - tip)
      .lineTo(x2, y1 + tip)
      .lineTo(center, y1)
      .lineTo(x1, y1 + tip)
      .fill({ color, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.86, width: detailWidth(context.gridSize, 0.03) })
    drawSketchLine(graphics, center, y1 + tip * 1.2, center, y2 - tip * 1.2, seed + 13, {
      color: context.secondaryColor,
      alpha: 0.36,
      width: 1,
      wobble: context.gridSize * 0.018,
    })
  }

  for (let index = 0; index < plankCount; index += 1) {
    const seed = context.seed + index * 47
    const plankColor = jitterColor(context.color, seed, 22)
    const center = length * (0.09 + (index / Math.max(1, plankCount - 1)) * 0.82)
    const cross = thickness * randomRange(seed + 5, 0.42, 0.58)
    const logLength = thickness * randomRange(seed + 7, 0.82, 1.05)
    const logThickness = length * randomRange(seed + 3, 0.035, 0.055)
    drawPointedLog(center, cross, logLength, logThickness, seed, plankColor)
  }

  const drawBeam = (
    startCross: number,
    startLength: number,
    endCross: number,
    endLength: number,
    seed: number,
    widthScale: number,
  ): void => {
    const beamWidth = outlineWidth(context.gridSize, widthScale)
    const beamColor = jitterColor(context.color, seed, 16)

    if (vertical) {
      drawSketchLine(graphics, startCross, startLength, endCross, endLength, seed + 1, {
        color: inkColor,
        alpha: 0.78,
        width: beamWidth + detailWidth(context.gridSize, 0.035),
        wobble: context.gridSize * 0.02,
      })
      drawSketchLine(graphics, startCross, startLength, endCross, endLength, seed + 2, {
        color: beamColor,
        alpha: context.alpha,
        width: beamWidth,
        wobble: context.gridSize * 0.018,
      })
      drawSketchLine(graphics, startCross, startLength, endCross, endLength, seed, {
        color: context.secondaryColor,
        alpha: 0.34,
        width: detailWidth(context.gridSize, 0.018),
        wobble: context.gridSize * 0.012,
      })
      drawSketchLine(
        graphics,
        startCross - thickness * 0.04,
        startLength,
        endCross - thickness * 0.04,
        endLength,
        seed + 3,
        {
          color: warmHighlightColor,
          alpha: 0.12,
          width: detailWidth(context.gridSize, 0.02),
          wobble: context.gridSize * 0.01,
        },
      )
      return
    }

    drawSketchLine(graphics, startLength, startCross, endLength, endCross, seed + 1, {
      color: inkColor,
      alpha: 0.78,
      width: beamWidth + detailWidth(context.gridSize, 0.035),
      wobble: context.gridSize * 0.02,
    })
    drawSketchLine(graphics, startLength, startCross, endLength, endCross, seed + 2, {
      color: beamColor,
      alpha: context.alpha,
      width: beamWidth,
      wobble: context.gridSize * 0.018,
    })
    drawSketchLine(graphics, startLength, startCross, endLength, endCross, seed, {
      color: context.secondaryColor,
      alpha: 0.34,
      width: detailWidth(context.gridSize, 0.018),
      wobble: context.gridSize * 0.012,
    })
    drawSketchLine(
      graphics,
      startLength,
      startCross - thickness * 0.04,
      endLength,
      endCross - thickness * 0.04,
      seed + 3,
      {
        color: warmHighlightColor,
        alpha: 0.12,
        width: detailWidth(context.gridSize, 0.02),
        wobble: context.gridSize * 0.01,
      },
    )
  }

  const drawBinding = (cross: number, along: number, seed: number): void => {
    const bandLength = Math.max(thickness * 0.42, context.gridSize * 0.18)
    const bandWidth = Math.max(context.gridSize * 0.045, 2.5)

    if (vertical) {
      graphics
        .roundRect(cross - bandLength / 2, along - bandWidth / 2, bandLength, bandWidth, bandWidth)
        .fill({ color: context.secondaryColor, alpha: 0.9 })
        .stroke({ color: inkColor, alpha: 0.72, width: 1 })
      drawSketchLine(
        graphics,
        cross - bandLength * 0.34,
        along - bandWidth * 0.2,
        cross + bandLength * 0.34,
        along + bandWidth * 0.12,
        seed,
        {
          color: warmHighlightColor,
          alpha: 0.16,
          width: 1,
          wobble: 1,
        },
      )
      return
    }

    graphics
      .roundRect(along - bandWidth / 2, cross - bandLength / 2, bandWidth, bandLength, bandWidth)
      .fill({ color: context.secondaryColor, alpha: 0.9 })
      .stroke({ color: inkColor, alpha: 0.72, width: 1 })
    drawSketchLine(
      graphics,
      along - bandWidth * 0.2,
      cross - bandLength * 0.34,
      along + bandWidth * 0.12,
      cross + bandLength * 0.34,
      seed,
      {
        color: warmHighlightColor,
        alpha: 0.16,
        width: 1,
        wobble: 1,
      },
    )
  }

  drawBeam(
    thickness * 0.18,
    length * 0.16,
    thickness * 0.82,
    length * 0.84,
    context.seed + 701,
    0.072,
  )
  drawBeam(
    thickness * 0.78,
    length * 0.18,
    thickness * 0.22,
    length * 0.82,
    context.seed + 719,
    0.066,
  )
  drawBeam(
    thickness * 0.5,
    length * 0.06,
    thickness * 0.5,
    length * 0.94,
    context.seed + 733,
    0.058,
  )

  drawBinding(thickness * 0.5, length * 0.22, context.seed + 811)
  drawBinding(thickness * 0.5, length * 0.5, context.seed + 829)
  drawBinding(thickness * 0.5, length * 0.78, context.seed + 847)

  for (let index = 0; index < plankCount; index += 1) {
    const seed = context.seed + index * 97
    const along = length * (0.09 + (index / Math.max(1, plankCount - 1)) * 0.82)
    const cross = thickness * randomRange(seed + 5, 0.42, 0.58)
    for (const offset of [-0.18, 0.18]) {
      if (vertical) {
        graphics
          .circle(cross + thickness * offset, along, Math.max(1.6, context.gridSize * 0.028))
          .fill({ color: inkColor, alpha: 0.62 })
      } else {
        graphics
          .circle(along, cross + thickness * offset, Math.max(1.6, context.gridSize * 0.028))
          .fill({ color: inkColor, alpha: 0.62 })
      }
    }
  }
}

const drawVerticalWagon = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'hitch-north',
): void => {
  drawShadow(graphics, context.width, context.height)
  const hitchOnTop = variant === 'hitch-north'
  const bodyLeft = context.width * 0.18
  const bodyTop = context.height * 0.18
  const bodyWidth = context.width * 0.64
  const bodyHeight = context.height * 0.64
  const bodyRight = bodyLeft + bodyWidth
  const bodyBottom = bodyTop + bodyHeight
  const hitchStart = hitchOnTop ? bodyTop : bodyBottom
  const hitchEnd = hitchOnTop ? context.height * 0.03 : context.height * 0.97
  const plankColor = jitterColor(context.color, context.seed, 16)

  for (const x of [bodyLeft + bodyWidth * 0.18, bodyRight - bodyWidth * 0.18]) {
    drawSketchLine(graphics, x, hitchStart, x, hitchEnd, context.seed + Math.round(x * 10), {
      color: context.secondaryColor,
      alpha: 0.82,
      width: detailWidth(context.gridSize, 0.035),
      wobble: context.gridSize * 0.018,
    })
  }

  for (const [x, y] of [
    [bodyLeft - context.width * 0.05, bodyTop + bodyHeight * 0.14],
    [bodyRight + context.width * 0.05, bodyTop + bodyHeight * 0.14],
    [bodyLeft - context.width * 0.05, bodyBottom - bodyHeight * 0.14],
    [bodyRight + context.width * 0.05, bodyBottom - bodyHeight * 0.14],
  ] as const) {
    graphics
      .circle(x, y, Math.max(3, context.gridSize * 0.105))
      .fill({ color: 0x2c2118, alpha: 0.94 })
      .stroke({ color: inkColor, alpha: 0.88, width: detailWidth(context.gridSize, 0.024) })
    graphics.circle(x, y, Math.max(1.4, context.gridSize * 0.035)).fill({
      color: warmHighlightColor,
      alpha: 0.16,
    })
  }

  graphics
    .roundRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, Math.max(3, context.gridSize * 0.04))
    .fill({ color: plankColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.9, width: outlineWidth(context.gridSize, 0.04) })
  graphics
    .roundRect(
      bodyLeft + bodyWidth * 0.1,
      bodyTop + bodyHeight * 0.08,
      bodyWidth * 0.8,
      bodyHeight * 0.22,
      2,
    )
    .fill({ color: warmHighlightColor, alpha: 0.09 })

  for (let index = 1; index < 5; index += 1) {
    const y = bodyTop + (bodyHeight * index) / 5
    drawSketchLine(graphics, bodyLeft + 2, y, bodyRight - 2, y, context.seed + index * 41, {
      color: context.secondaryColor,
      alpha: 0.32,
      width: 1,
      wobble: context.gridSize * 0.012,
    })
  }
  for (let index = 1; index <= 3; index += 1) {
    const x = bodyLeft + (bodyWidth / 4) * index
    drawSketchLine(
      graphics,
      x,
      bodyTop + bodyHeight * 0.09,
      x + randomRange(context.seed + index * 19, -bodyWidth * 0.03, bodyWidth * 0.03),
      bodyBottom - bodyHeight * 0.08,
      context.seed + index * 61,
      {
        color: context.secondaryColor,
        alpha: 0.22,
        width: 1,
        wobble: context.gridSize * 0.012,
      },
    )
  }

  for (const [x, y, width, height, color] of [
    [0.36, 0.32, 0.22, 0.15, 0xb99a62],
    [0.62, 0.48, 0.2, 0.18, 0x80603b],
    [0.42, 0.68, 0.2, 0.16, 0xb58a50],
  ] as const) {
    graphics
      .ellipse(
        bodyLeft + bodyWidth * x,
        bodyTop + bodyHeight * y,
        bodyWidth * width,
        bodyHeight * height,
      )
      .fill({ color, alpha: 0.72 })
      .stroke({ color: inkColor, alpha: 0.26, width: 1 })
  }

  drawDirtSpeckles(graphics, context.width, context.height, context.seed + 211, 7, {
    color: inkColor,
    alpha: 0.13,
    minRadius: 0.7,
    maxRadius: 1.6,
  })
}

const drawWagon = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'hitch-east',
): void => {
  if (variant === 'hitch-north' || variant === 'hitch-south') {
    drawVerticalWagon(graphics, context, variant)
    return
  }

  drawShadow(graphics, context.width, context.height)
  const hitchOnLeft = variant === 'hitch-west'
  const bodyLeft = context.width * 0.18
  const bodyTop = context.height * 0.18
  const bodyWidth = context.width * 0.64
  const bodyHeight = context.height * 0.62
  const bodyRight = bodyLeft + bodyWidth
  const bodyBottom = bodyTop + bodyHeight
  const hitchStart = hitchOnLeft ? bodyLeft : bodyRight
  const hitchEnd = hitchOnLeft ? context.width * 0.03 : context.width * 0.97
  const plankColor = jitterColor(context.color, context.seed, 16)

  for (const y of [bodyTop + bodyHeight * 0.16, bodyBottom - bodyHeight * 0.16]) {
    drawSketchLine(graphics, hitchStart, y, hitchEnd, y, context.seed + Math.round(y * 10), {
      color: context.secondaryColor,
      alpha: 0.82,
      width: detailWidth(context.gridSize, 0.035),
      wobble: context.gridSize * 0.018,
    })
  }

  for (const [x, y] of [
    [bodyLeft + bodyWidth * 0.12, bodyTop - context.height * 0.05],
    [bodyRight - bodyWidth * 0.12, bodyTop - context.height * 0.05],
    [bodyLeft + bodyWidth * 0.12, bodyBottom + context.height * 0.05],
    [bodyRight - bodyWidth * 0.12, bodyBottom + context.height * 0.05],
  ] as const) {
    graphics
      .circle(x, y, Math.max(3, context.gridSize * 0.105))
      .fill({ color: 0x2c2118, alpha: 0.94 })
      .stroke({ color: inkColor, alpha: 0.88, width: detailWidth(context.gridSize, 0.024) })
    graphics.circle(x, y, Math.max(1.4, context.gridSize * 0.035)).fill({
      color: warmHighlightColor,
      alpha: 0.16,
    })
  }

  for (const x of [bodyLeft + bodyWidth * 0.12, bodyRight - bodyWidth * 0.12]) {
    drawSketchLine(graphics, x, bodyTop, x, bodyBottom, context.seed + Math.round(x * 7), {
      color: context.secondaryColor,
      alpha: 0.72,
      width: detailWidth(context.gridSize, 0.026),
      wobble: context.gridSize * 0.012,
    })
  }

  graphics
    .roundRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, Math.max(3, context.gridSize * 0.04))
    .fill({ color: plankColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.9, width: outlineWidth(context.gridSize, 0.04) })
  graphics
    .roundRect(
      bodyLeft + bodyWidth * 0.08,
      bodyTop + bodyHeight * 0.13,
      bodyWidth * 0.84,
      bodyHeight * 0.2,
      2,
    )
    .fill({ color: warmHighlightColor, alpha: 0.09 })

  for (let index = 1; index < 5; index += 1) {
    const x = bodyLeft + (bodyWidth * index) / 5
    drawSketchLine(graphics, x, bodyTop + 2, x, bodyBottom - 2, context.seed + index * 41, {
      color: context.secondaryColor,
      alpha: 0.32,
      width: 1,
      wobble: context.gridSize * 0.012,
    })
  }
  for (let index = 1; index <= 3; index += 1) {
    const y = bodyTop + (bodyHeight / 4) * index
    drawSketchLine(
      graphics,
      bodyLeft + bodyWidth * 0.09,
      y,
      bodyRight - bodyWidth * 0.08,
      y + randomRange(context.seed + index * 19, -bodyHeight * 0.03, bodyHeight * 0.03),
      context.seed + index * 61,
      {
        color: context.secondaryColor,
        alpha: 0.22,
        width: 1,
        wobble: context.gridSize * 0.012,
      },
    )
  }

  for (const [x, y, width, height, color] of [
    [0.31, 0.41, 0.18, 0.2, 0xb99a62],
    [0.49, 0.55, 0.2, 0.22, 0x80603b],
    [0.65, 0.39, 0.18, 0.18, 0xb58a50],
  ] as const) {
    graphics
      .ellipse(
        bodyLeft + bodyWidth * x,
        bodyTop + bodyHeight * y,
        bodyWidth * width,
        bodyHeight * height,
      )
      .fill({ color, alpha: 0.72 })
      .stroke({ color: inkColor, alpha: 0.26, width: 1 })
  }

  drawDirtSpeckles(graphics, context.width, context.height, context.seed + 211, 6, {
    color: inkColor,
    alpha: 0.13,
    minRadius: 0.7,
    maxRadius: 1.6,
  })
}

const drawShip = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'weathered-sloop',
): void => {
  drawShadow(graphics, context.width, context.height)
  const broken = variant === 'broken-river-ship'
  const hullColor = jitterColor(context.color, context.seed, 14)
  const outline = outlineWidth(context.gridSize, 0.04)
  const hull = [
    context.width * 0.04,
    context.height * 0.5,
    context.width * 0.16,
    context.height * 0.16,
    context.width * 0.72,
    context.height * 0.1,
    context.width * 0.96,
    context.height * 0.5,
    context.width * 0.72,
    context.height * 0.9,
    context.width * 0.16,
    context.height * 0.84,
  ]
  graphics
    .poly(hull, true)
    .fill({ color: hullColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.94, width: outline })
  graphics
    .poly(
      [
        context.width * 0.14,
        context.height * 0.5,
        context.width * 0.24,
        context.height * 0.25,
        context.width * 0.7,
        context.height * 0.22,
        context.width * 0.86,
        context.height * 0.5,
        context.width * 0.7,
        context.height * 0.78,
        context.width * 0.24,
        context.height * 0.75,
      ],
      true,
    )
    .fill({ color: jitterColor(context.color, context.seed + 31, 22), alpha: 0.88 })
    .stroke({
      color: context.secondaryColor,
      alpha: 0.74,
      width: detailWidth(context.gridSize, 0.025),
    })

  for (let index = 1; index < 8; index += 1) {
    const x = context.width * (0.18 + index * 0.075)
    drawSketchLine(
      graphics,
      x,
      context.height * 0.25,
      x + randomRange(context.seed + index * 13, -2, 2),
      context.height * 0.75,
      context.seed + index * 47,
      {
        color: context.secondaryColor,
        alpha: 0.28,
        width: 1,
        wobble: context.gridSize * 0.01,
      },
    )
  }

  const mastX = context.width * 0.52
  if (!broken) {
    graphics
      .circle(mastX, context.height * 0.5, Math.max(3, context.gridSize * 0.075))
      .fill({ color: context.secondaryColor, alpha: 0.96 })
      .stroke({ color: inkColor, alpha: 0.82, width: detailWidth(context.gridSize, 0.025) })
    drawSketchLine(
      graphics,
      context.width * 0.3,
      context.height * 0.5,
      context.width * 0.74,
      context.height * 0.5,
      context.seed + 401,
      {
        color: context.secondaryColor,
        alpha: 0.9,
        width: detailWidth(context.gridSize, 0.035),
        wobble: context.gridSize * 0.01,
      },
    )
    graphics
      .poly(
        [
          mastX,
          context.height * 0.48,
          context.width * 0.69,
          context.height * 0.28,
          context.width * 0.68,
          context.height * 0.47,
        ],
        true,
      )
      .fill({ color: 0xd8d0b4, alpha: 0.38 })
      .stroke({ color: inkColor, alpha: 0.3, width: 1 })
  } else {
    drawSketchLine(
      graphics,
      context.width * 0.4,
      context.height * 0.68,
      context.width * 0.68,
      context.height * 0.35,
      context.seed + 409,
      {
        color: context.secondaryColor,
        alpha: 0.9,
        width: detailWidth(context.gridSize, 0.04),
        wobble: context.gridSize * 0.014,
      },
    )
    for (let index = 0; index < 3; index += 1) {
      const crackX = context.width * (0.34 + index * 0.14)
      drawSketchLine(
        graphics,
        crackX,
        context.height * 0.25,
        crackX + context.width * 0.06,
        context.height * 0.7,
        context.seed + 503 + index * 31,
        {
          color: inkColor,
          alpha: 0.72,
          width: detailWidth(context.gridSize, 0.018),
          wobble: context.gridSize * 0.018,
        },
      )
    }
  }
}

const drawVerticalDraftAnimal = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'horse-north',
): void => {
  drawShadow(graphics, context.width, context.height)
  const direction = variant.endsWith('north') ? -1 : 1
  const bodyCenterY = context.height * (direction < 0 ? 0.56 : 0.44)
  const headCenterY = context.height * (direction < 0 ? 0.24 : 0.76)
  const rearY = context.height * (direction < 0 ? 0.86 : 0.14)
  const animalColor = jitterColor(context.color, context.seed, 14)

  graphics
    .ellipse(context.width * 0.5, bodyCenterY, context.width * 0.22, context.height * 0.28)
    .fill({ color: animalColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.88, width: detailWidth(context.gridSize, 0.032) })
  graphics
    .ellipse(context.width * 0.5, headCenterY, context.width * 0.15, context.height * 0.13)
    .fill({ color: jitterColor(context.color, context.seed + 23, 12), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.82, width: detailWidth(context.gridSize, 0.026) })
  graphics
    .ellipse(
      context.width * 0.5,
      headCenterY + direction * context.height * 0.08,
      context.width * 0.08,
      context.height * 0.06,
    )
    .fill({ color: context.secondaryColor, alpha: context.alpha * 0.82 })
    .stroke({ color: inkColor, alpha: 0.46, width: 1 })

  for (const x of [0.38, 0.62]) {
    for (const y of [bodyCenterY - context.height * 0.16, bodyCenterY + context.height * 0.16]) {
      drawSketchLine(
        graphics,
        context.width * x,
        bodyCenterY,
        context.width * x,
        y,
        context.seed + Math.round(x * 100 + y * 17),
        {
          color: context.secondaryColor,
          alpha: 0.82,
          width: detailWidth(context.gridSize, 0.022),
          wobble: context.gridSize * 0.012,
        },
      )
    }
  }

  drawSketchLine(
    graphics,
    context.width * 0.5,
    rearY,
    context.width * 0.42,
    rearY - direction * context.height * 0.13,
    context.seed + 503,
    {
      color: context.secondaryColor,
      alpha: 0.72,
      width: detailWidth(context.gridSize, 0.024),
      wobble: context.gridSize * 0.014,
    },
  )
  drawSketchLine(
    graphics,
    context.width * 0.38,
    bodyCenterY - direction * context.height * 0.04,
    context.width * 0.47,
    headCenterY - direction * context.height * 0.06,
    context.seed + 431,
    {
      color: inkColor,
      alpha: 0.55,
      width: detailWidth(context.gridSize, 0.026),
      wobble: context.gridSize * 0.012,
    },
  )
  for (const x of [0.42, 0.58]) {
    drawSketchLine(
      graphics,
      context.width * x,
      headCenterY - direction * context.height * 0.02,
      context.width * (x + (x < 0.5 ? -0.04 : 0.04)),
      headCenterY + direction * context.height * 0.1,
      context.seed + Math.round(x * 300),
      { color: inkColor, alpha: 0.82, width: 1, wobble: 1 },
    )
  }
}

const drawDraftAnimal = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'facing-east',
): void => {
  if (variant === 'horse-north' || variant === 'horse-south') {
    drawVerticalDraftAnimal(graphics, context, variant)
    return
  }

  drawShadow(graphics, context.width, context.height)
  const isHorse = variant.startsWith('horse-')
  const direction = variant === 'facing-west' || variant === 'horse-west' ? -1 : 1
  const bodyCenterX = context.width * (direction > 0 ? 0.45 : 0.55)
  const headCenterX = context.width * (direction > 0 ? 0.76 : 0.24)
  const rearX = context.width * (direction > 0 ? 0.15 : 0.85)
  const animalColor = jitterColor(context.color, context.seed, 14)

  graphics
    .ellipse(
      bodyCenterX,
      context.height * (isHorse ? 0.5 : 0.53),
      context.width * (isHorse ? 0.28 : 0.26),
      context.height * (isHorse ? 0.2 : 0.25),
    )
    .fill({ color: animalColor, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.88, width: detailWidth(context.gridSize, 0.032) })
  graphics
    .ellipse(headCenterX, context.height * 0.48, context.width * 0.14, context.height * 0.15)
    .fill({ color: jitterColor(context.color, context.seed + 23, 12), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.82, width: detailWidth(context.gridSize, 0.026) })
  graphics
    .ellipse(
      headCenterX + direction * context.width * 0.08,
      context.height * 0.5,
      context.width * 0.06,
      context.height * 0.08,
    )
    .fill({ color: 0x6f5135, alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.46, width: 1 })

  if (isHorse) {
    drawSketchLine(
      graphics,
      bodyCenterX + direction * context.width * 0.2,
      context.height * 0.38,
      headCenterX - direction * context.width * 0.04,
      context.height * 0.44,
      context.seed + 101,
      {
        color: context.secondaryColor,
        alpha: 0.66,
        width: detailWidth(context.gridSize, 0.03),
        wobble: context.gridSize * 0.012,
      },
    )
    for (const y of [0.32, 0.37]) {
      drawSketchLine(
        graphics,
        headCenterX - direction * context.width * 0.01,
        context.height * 0.36,
        headCenterX + direction * context.width * 0.06,
        context.height * y,
        context.seed + Math.round(y * 200),
        { color: inkColor, alpha: 0.82, width: 1, wobble: 1 },
      )
    }
  } else {
    for (const y of [0.35, 0.62]) {
      drawSketchLine(
        graphics,
        bodyCenterX + direction * context.width * 0.16,
        context.height * y,
        headCenterX - direction * context.width * 0.04,
        context.height * (y - 0.01),
        context.seed + Math.round(y * 100),
        {
          color: context.secondaryColor,
          alpha: 0.54,
          width: detailWidth(context.gridSize, 0.022),
          wobble: context.gridSize * 0.01,
        },
      )
    }
  }

  for (const x of [bodyCenterX - context.width * 0.15, bodyCenterX + context.width * 0.14]) {
    for (const y of [0.29, 0.77]) {
      drawSketchLine(
        graphics,
        x,
        context.height * 0.46,
        x,
        context.height * y,
        context.seed + Math.round(x * 17 + y * 100),
        {
          color: context.secondaryColor,
          alpha: 0.82,
          width: detailWidth(context.gridSize, isHorse ? 0.022 : 0.026),
          wobble: context.gridSize * 0.012,
        },
      )
    }
  }

  if (isHorse) {
    drawSketchLine(
      graphics,
      bodyCenterX - direction * context.width * 0.02,
      context.height * 0.33,
      headCenterX - direction * context.width * 0.08,
      context.height * 0.4,
      context.seed + 431,
      {
        color: inkColor,
        alpha: 0.55,
        width: detailWidth(context.gridSize, 0.026),
        wobble: context.gridSize * 0.012,
      },
    )
  } else {
    for (const y of [0.34, 0.62]) {
      drawSketchLine(
        graphics,
        headCenterX + direction * context.width * 0.02,
        context.height * y,
        headCenterX + direction * context.width * 0.2,
        context.height * (y - 0.05),
        context.seed + Math.round(y * 139),
        { color: warmHighlightColor, alpha: 0.54, width: 1, wobble: 1 },
      )
    }
  }

  drawSketchLine(
    graphics,
    rearX,
    context.height * 0.48,
    rearX - direction * context.width * 0.12,
    context.height * 0.39,
    context.seed + 503,
    {
      color: context.secondaryColor,
      alpha: 0.72,
      width: detailWidth(context.gridSize, isHorse ? 0.024 : 0.02),
      wobble: context.gridSize * 0.014,
    },
  )
  drawSketchLine(
    graphics,
    context.width * (direction > 0 ? 0.05 : 0.95),
    context.height * 0.35,
    context.width * (direction > 0 ? 0.98 : 0.02),
    context.height * 0.35,
    context.seed + 557,
    { color: context.secondaryColor, alpha: 0.38, width: 1, wobble: context.gridSize * 0.012 },
  )
}

const drawContourLoop = (
  graphics: Graphics,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  seed: number,
  options: {
    readonly color: number
    readonly alpha: number
    readonly width: number
    readonly wobble: number
  },
): void => {
  const points = 38
  let firstPoint: { readonly x: number; readonly y: number } | null = null

  for (let index = 0; index <= points; index += 1) {
    const angle = (Math.PI * 2 * index) / points
    const wave =
      1 +
      Math.sin(angle * 3 + seed * 0.013) * options.wobble +
      Math.cos(angle * 5 + seed * 0.021) * options.wobble * 0.45
    const point = {
      x: centerX + Math.cos(angle) * radiusX * wave,
      y: centerY + Math.sin(angle) * radiusY * wave,
    }

    if (index === 0) {
      firstPoint = point
      graphics.moveTo(point.x, point.y)
    } else {
      graphics.lineTo(point.x, point.y)
    }
  }

  if (firstPoint) {
    graphics.lineTo(firstPoint.x, firstPoint.y)
  }
  graphics.stroke({ color: options.color, alpha: options.alpha, width: options.width })
}

const fillContourLoop = (
  graphics: Graphics,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  seed: number,
  options: {
    readonly color: number
    readonly alpha: number
    readonly wobble: number
  },
): void => {
  const points = 38
  let firstPoint: { readonly x: number; readonly y: number } | null = null

  for (let index = 0; index <= points; index += 1) {
    const angle = (Math.PI * 2 * index) / points
    const wave =
      1 +
      Math.sin(angle * 3 + seed * 0.013) * options.wobble +
      Math.cos(angle * 5 + seed * 0.021) * options.wobble * 0.45
    const point = {
      x: centerX + Math.cos(angle) * radiusX * wave,
      y: centerY + Math.sin(angle) * radiusY * wave,
    }

    if (index === 0) {
      firstPoint = point
      graphics.moveTo(point.x, point.y)
    } else {
      graphics.lineTo(point.x, point.y)
    }
  }

  if (firstPoint) {
    graphics.lineTo(firstPoint.x, firstPoint.y)
  }
  graphics.fill({ color: options.color, alpha: options.alpha })
}

interface HillRingGeometry {
  readonly ring: number
  readonly centerX: number
  readonly centerY: number
  readonly radiusX: number
  readonly radiusY: number
  readonly seed: number
}

const drawTopographicHill = (
  graphics: Graphics,
  context: DrawObjectContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  seed: number,
): void => {
  const rings = 5
  const ringGeometries: HillRingGeometry[] = []

  for (let ring = rings; ring >= 1; ring -= 1) {
    const scale = ring / rings
    ringGeometries.push({
      ring,
      centerX:
        centerX + randomRange(seed + ring * 19, -context.gridSize * 0.1, context.gridSize * 0.1),
      centerY:
        centerY + randomRange(seed + ring * 23, -context.gridSize * 0.08, context.gridSize * 0.08),
      radiusX: radiusX * scale,
      radiusY: radiusY * scale,
      seed: seed + ring * 37,
    })
  }

  for (const geometry of ringGeometries) {
    const heightFactor = (rings - geometry.ring) / Math.max(1, rings - 1)
    fillContourLoop(
      graphics,
      geometry.centerX,
      geometry.centerY,
      geometry.radiusX,
      geometry.radiusY,
      geometry.seed,
      {
        color: context.secondaryColor,
        alpha: context.alpha * (0.065 + heightFactor * 0.16),
        wobble: 0.055,
      },
    )
  }

  for (const geometry of ringGeometries) {
    drawContourLoop(
      graphics,
      geometry.centerX,
      geometry.centerY,
      geometry.radiusX,
      geometry.radiusY,
      geometry.seed,
      {
        color: context.secondaryColor,
        alpha: context.alpha * (0.26 + (rings - geometry.ring) * 0.055),
        width:
          geometry.ring === 1
            ? detailWidth(context.gridSize, 0.04)
            : detailWidth(context.gridSize, 0.026),
        wobble: 0.055,
      },
    )
  }
}

const drawHillSlope = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'rise-north',
): void => {
  const vertical = variant === 'rise-west' || variant === 'rise-east'
  const reverse = variant === 'rise-south' || variant === 'rise-east'
  const hillCount = 1

  if (vertical) {
    const highSideX = reverse ? context.width * 0.62 : context.width * 0.38
    for (let index = 0; index < hillCount; index += 1) {
      const t = (index + 0.55) / hillCount
      const seed = context.seed + index * 101
      drawTopographicHill(
        graphics,
        context,
        highSideX + randomRange(seed + 1, -context.width * 0.08, context.width * 0.08),
        context.height * t + randomRange(seed + 2, -context.height * 0.08, context.height * 0.08),
        context.width * randomRange(seed + 3, 0.38, 0.48),
        context.height * randomRange(seed + 4, 0.29, 0.39),
        seed + 5,
      )
    }
    return
  }

  const highSideY = reverse ? context.height * 0.62 : context.height * 0.38
  for (let index = 0; index < hillCount; index += 1) {
    const t = (index + 0.55) / hillCount
    const seed = context.seed + index * 109
    drawTopographicHill(
      graphics,
      context,
      context.width * t + randomRange(seed + 1, -context.width * 0.06, context.width * 0.06),
      highSideY + randomRange(seed + 2, -context.height * 0.08, context.height * 0.08),
      context.width * randomRange(seed + 3, 0.38, 0.48),
      context.height * randomRange(seed + 4, 0.29, 0.39),
      seed + 5,
    )
  }
}

const drawTransitionArrow = (
  graphics: Graphics,
  context: DrawObjectContext,
  direction: 'up' | 'down',
): void => {
  const centerX = context.width * 0.5
  const centerY = context.height * 0.52
  const sign = direction === 'up' ? -1 : 1
  const arrowColor = direction === 'up' ? 0xf4d17a : 0x9fd0ff
  graphics
    .moveTo(centerX, centerY + sign * context.height * 0.22)
    .lineTo(centerX, centerY - sign * context.height * 0.22)
    .stroke({ color: inkColor, alpha: 0.86, width: outlineWidth(context.gridSize, 0.055) })
  graphics
    .moveTo(centerX, centerY + sign * context.height * 0.22)
    .lineTo(centerX, centerY - sign * context.height * 0.22)
    .stroke({ color: arrowColor, alpha: 0.95, width: outlineWidth(context.gridSize, 0.035) })
  graphics
    .moveTo(centerX, centerY - sign * context.height * 0.27)
    .lineTo(centerX - context.width * 0.13, centerY - sign * context.height * 0.08)
    .lineTo(centerX + context.width * 0.13, centerY - sign * context.height * 0.08)
    .lineTo(centerX, centerY - sign * context.height * 0.27)
    .fill({ color: arrowColor, alpha: 0.96 })
    .stroke({ color: inkColor, alpha: 0.75, width: detailWidth(context.gridSize, 0.025) })
}

const drawStairs = (graphics: Graphics, context: DrawObjectContext, direction: 'up' | 'down') => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .roundRect(
      context.width * 0.08,
      context.height * 0.1,
      context.width * 0.84,
      context.height * 0.78,
      context.gridSize * 0.05,
    )
    .fill({ color: jitterColor(context.color, context.seed, 14), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.94, width: outlineWidth(context.gridSize, 0.045) })

  const steps = 5
  for (let index = 1; index < steps; index += 1) {
    const y = context.height * (0.15 + (index / steps) * 0.68)
    drawSketchLine(
      graphics,
      context.width * 0.14,
      y,
      context.width * 0.86,
      y + randomRange(context.seed + index * 17, -1.5, 1.5),
      context.seed + index * 31,
      { color: inkColor, alpha: 0.38, width: detailWidth(context.gridSize, 0.024), wobble: 1.5 },
    )
  }
  drawTransitionArrow(graphics, context, direction)
}

const drawLadder = (graphics: Graphics, context: DrawObjectContext, direction: 'up' | 'down') => {
  drawShadow(graphics, context.width, context.height)
  const left = context.width * 0.34
  const right = context.width * 0.66
  for (const x of [left, right]) {
    drawSketchLine(
      graphics,
      x,
      context.height * 0.12,
      x + randomRange(context.seed + Math.round(x), -2, 2),
      context.height * 0.88,
      context.seed + Math.round(x * 11),
      {
        color: inkColor,
        alpha: 0.9,
        width: outlineWidth(context.gridSize, 0.04),
        wobble: context.gridSize * 0.02,
      },
    )
  }
  for (let index = 0; index < 5; index += 1) {
    const y = context.height * (0.18 + index * 0.15)
    drawSketchLine(
      graphics,
      left,
      y,
      right,
      y + randomRange(context.seed + index * 23, -1, 1),
      context.seed + index * 29,
      {
        color: context.color,
        alpha: 0.95,
        width: outlineWidth(context.gridSize, 0.035),
        wobble: 1.5,
      },
    )
  }
  drawTransitionArrow(graphics, context, direction)
}

const drawAltar = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .roundRect(
      context.width * 0.12,
      context.height * 0.2,
      context.width * 0.76,
      context.height * 0.56,
      context.gridSize * 0.08,
    )
    .fill({ color: jitterColor(context.color, context.seed, 12), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.96, width: outlineWidth(context.gridSize, 0.05) })
    .roundRect(
      context.width * 0.2,
      context.height * 0.3,
      context.width * 0.6,
      context.height * 0.26,
      context.gridSize * 0.04,
    )
    .fill({ color: 0x6f2f2a, alpha: 0.92 })
    .stroke({ color: inkColor, alpha: 0.58, width: detailWidth(context.gridSize, 0.024) })
  for (const x of [0.34, 0.5, 0.66]) {
    graphics
      .circle(context.width * x, context.height * 0.39, Math.max(2, context.gridSize * 0.04))
      .fill({ color: 0xf4d17a, alpha: 0.92 })
      .stroke({ color: inkColor, alpha: 0.5, width: 1 })
  }
}

const drawWindow = (graphics: Graphics, context: DrawObjectContext): void => {
  graphics
    .roundRect(
      context.width * 0.08,
      context.height * 0.12,
      context.width * 0.84,
      context.height * 0.76,
      context.gridSize * 0.03,
    )
    .fill({ color: 0x9bd6ff, alpha: 0.42 })
    .stroke({ color: inkColor, alpha: 0.9, width: outlineWidth(context.gridSize, 0.04) })
  graphics
    .moveTo(context.width * 0.5, context.height * 0.14)
    .lineTo(context.width * 0.5, context.height * 0.86)
    .moveTo(context.width * 0.12, context.height * 0.5)
    .lineTo(context.width * 0.88, context.height * 0.5)
    .stroke({ color: inkColor, alpha: 0.62, width: detailWidth(context.gridSize, 0.025) })
  graphics
    .rect(context.width * 0.14, context.height * 0.16, context.width * 0.28, context.height * 0.22)
    .fill({ color: warmHighlightColor, alpha: 0.22 })
}

const drawDaylightArea = (graphics: Graphics, context: DrawObjectContext): void => {
  graphics
    .rect(0, 0, context.width, context.height)
    .fill({ color: context.color, alpha: context.alpha })

  const stripeCount = Math.max(4, Math.round(context.width / context.gridSize / 2))
  for (let index = -1; index < stripeCount; index += 1) {
    const startX = index * context.gridSize * 2.2
    graphics
      .moveTo(startX, 0)
      .lineTo(startX + context.height * 0.5, context.height)
      .stroke({
        color: context.secondaryColor,
        alpha: context.alpha * 0.42,
        width: Math.max(1, context.gridSize * 0.035),
      })
  }
}

const drawSpawnPoint = (graphics: Graphics, context: DrawObjectContext): void => {
  graphics
    .circle(context.width / 2, context.height / 2, Math.min(context.width, context.height) * 0.42)
    .fill({ color: context.color, alpha: 0.2 })
    .stroke({ color: inkColor, alpha: 0.68, width: detailWidth(context.gridSize, 0.035) })
  graphics
    .circle(context.width / 2, context.height / 2, Math.min(context.width, context.height) * 0.13)
    .fill({ color: context.color, alpha: 0.8 })
}

const drawTrap = (graphics: Graphics, context: DrawObjectContext): void => {
  graphics
    .roundRect(
      context.width * 0.12,
      context.height * 0.12,
      context.width * 0.76,
      context.height * 0.76,
      2,
    )
    .fill({ color: 0x4a1414, alpha: context.alpha })
    .stroke({
      color: inkColor,
      alpha: 0.92,
      width: detailWidth(context.gridSize, 0.04),
    })
  for (const x of [0.3, 0.5, 0.7]) {
    graphics
      .moveTo(context.width * x, context.height * 0.24)
      .lineTo(context.width * (x - 0.08), context.height * 0.5)
      .lineTo(context.width * x, context.height * 0.76)
      .stroke({
        color: warmHighlightColor,
        alpha: 0.55,
        width: detailWidth(context.gridSize, 0.02),
      })
  }
}

const drawLever = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .ellipse(
      context.width * 0.5,
      context.height * 0.78,
      context.width * 0.34,
      context.height * 0.16,
    )
    .fill({ color: 0x33373d, alpha: 1 })
    .stroke({ color: inkColor, alpha: 0.82, width: 1 })
  graphics
    .moveTo(context.width * 0.5, context.height * 0.74)
    .lineTo(context.width * 0.68, context.height * 0.22)
    .stroke({ color: inkColor, alpha: 1, width: outlineWidth(context.gridSize, 0.055) })
  graphics
    .circle(context.width * 0.69, context.height * 0.2, Math.max(3, context.gridSize * 0.08))
    .fill({ color: 0xd7b84a, alpha: 1 })
    .stroke({ color: inkColor, alpha: 0.8, width: 1 })
}

const drawDecoration = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'sack-pile',
): void => {
  if (variant === 'ritual-runes') {
    const centerX = context.width * 0.5
    const centerY = context.height * 0.5
    const radius = Math.min(context.width, context.height) * 0.38
    graphics.circle(centerX, centerY, radius).stroke({
      color: context.color,
      alpha: context.alpha * 0.72,
      width: detailWidth(context.gridSize, 0.035),
    })
    graphics.circle(centerX, centerY, radius * 0.55).stroke({
      color: context.secondaryColor,
      alpha: context.alpha * 0.64,
      width: detailWidth(context.gridSize, 0.026),
    })
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const x = centerX + Math.cos(angle) * radius * 0.78
      const y = centerY + Math.sin(angle) * radius * 0.78
      graphics
        .circle(x, y, Math.max(2, context.gridSize * 0.045))
        .fill({ color: index % 2 === 0 ? context.color : context.secondaryColor, alpha: 0.45 })
      drawSketchLine(graphics, centerX, centerY, x, y, context.seed + index * 19, {
        color: context.color,
        alpha: context.alpha * 0.34,
        width: detailWidth(context.gridSize, 0.014),
        wobble: context.gridSize * 0.018,
      })
    }
    return
  }

  drawShadow(graphics, context.width, context.height)

  if (variant === 'bedroll') {
    graphics
      .roundRect(
        context.width * 0.08,
        context.height * 0.18,
        context.width * 0.84,
        context.height * 0.58,
        Math.max(3, context.gridSize * 0.08),
      )
      .fill({ color: context.color, alpha: context.alpha })
      .stroke({
        color: inkColor,
        alpha: 0.72,
        width: detailWidth(context.gridSize, 0.026),
      })
    for (const x of [0.26, 0.72]) {
      graphics
        .rect(context.width * x, context.height * 0.15, context.width * 0.08, context.height * 0.64)
        .fill({ color: context.secondaryColor, alpha: context.alpha * 0.82 })
    }
    drawSketchLine(
      graphics,
      context.width * 0.12,
      context.height * 0.48,
      context.width * 0.88,
      context.height * 0.48,
      context.seed + 11,
      { color: warmHighlightColor, alpha: 0.22, width: 1, wobble: context.gridSize * 0.02 },
    )
    return
  }

  if (variant === 'road-sign') {
    graphics
      .rect(context.width * 0.44, context.height * 0.18, context.width * 0.14, context.height * 0.7)
      .fill({ color: context.secondaryColor, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.72, width: detailWidth(context.gridSize, 0.022) })
    graphics
      .roundRect(
        context.width * 0.12,
        context.height * 0.24,
        context.width * 0.66,
        context.height * 0.22,
        Math.max(2, context.gridSize * 0.035),
      )
      .fill({ color: context.color, alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.8, width: detailWidth(context.gridSize, 0.024) })
    graphics
      .roundRect(
        context.width * 0.24,
        context.height * 0.52,
        context.width * 0.64,
        context.height * 0.2,
        Math.max(2, context.gridSize * 0.035),
      )
      .fill({ color: jitterColor(context.color, context.seed + 5, 12), alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.78, width: detailWidth(context.gridSize, 0.024) })
    drawWoodGrain(graphics, context.width, context.height, inkColor, context.seed + 31, 0.24)
    return
  }

  if (variant === 'farm-tools') {
    const width = detailWidth(context.gridSize, 0.032)
    drawSketchLine(
      graphics,
      context.width * 0.18,
      context.height * 0.76,
      context.width * 0.84,
      context.height * 0.2,
      context.seed + 1,
      { color: context.secondaryColor, alpha: 0.9, width, wobble: context.gridSize * 0.018 },
    )
    drawSketchLine(
      graphics,
      context.width * 0.22,
      context.height * 0.2,
      context.width * 0.78,
      context.height * 0.75,
      context.seed + 2,
      { color: context.secondaryColor, alpha: 0.88, width, wobble: context.gridSize * 0.018 },
    )
    graphics
      .ellipse(
        context.width * 0.84,
        context.height * 0.2,
        context.width * 0.12,
        context.height * 0.08,
      )
      .fill({ color: context.color, alpha: context.alpha * 0.9 })
      .stroke({ color: inkColor, alpha: 0.68, width: detailWidth(context.gridSize, 0.02) })
    for (let index = 0; index < 4; index += 1) {
      drawSketchLine(
        graphics,
        context.width * (0.16 + index * 0.04),
        context.height * 0.18,
        context.width * (0.16 + index * 0.04),
        context.height * 0.34,
        context.seed + index * 7,
        { color: context.color, alpha: 0.78, width: 1, wobble: context.gridSize * 0.01 },
      )
    }
    return
  }

  if (variant === 'plank-debris') {
    const plankCount = 4
    for (let index = 0; index < plankCount; index += 1) {
      const x = context.width * (0.08 + index * 0.18)
      const y = context.height * randomRange(context.seed + index * 13, 0.24, 0.58)
      const width = context.width * randomRange(context.seed + index * 17, 0.38, 0.58)
      const height = context.height * randomRange(context.seed + index * 23, 0.11, 0.18)
      graphics
        .roundRect(x, y, width, height, Math.max(2, context.gridSize * 0.025))
        .fill({
          color: jitterColor(context.color, context.seed + index * 29, 18),
          alpha: context.alpha * 0.92,
        })
        .stroke({ color: inkColor, alpha: 0.62, width: detailWidth(context.gridSize, 0.018) })
      drawSketchLine(
        graphics,
        x + width * 0.12,
        y + height * 0.5,
        x + width * 0.9,
        y + height * 0.5,
        context.seed + index * 37,
        { color: inkColor, alpha: 0.22, width: 1, wobble: context.gridSize * 0.014 },
      )
    }
    return
  }

  if (variant === 'grave-marker') {
    graphics
      .roundRect(
        context.width * 0.24,
        context.height * 0.12,
        context.width * 0.52,
        context.height * 0.68,
        Math.max(4, context.gridSize * 0.09),
      )
      .fill({ color: context.color, alpha: context.alpha })
      .stroke({
        color: inkColor,
        alpha: 0.72,
        width: detailWidth(context.gridSize, 0.028),
      })
    graphics
      .rect(
        context.width * 0.38,
        context.height * 0.28,
        context.width * 0.24,
        context.height * 0.05,
      )
      .fill({ color: context.secondaryColor, alpha: context.alpha * 0.55 })
    graphics
      .rect(context.width * 0.48, context.height * 0.2, context.width * 0.04, context.height * 0.23)
      .fill({ color: context.secondaryColor, alpha: context.alpha * 0.55 })
    drawDirtSpeckles(graphics, context.width, context.height, context.seed, 8, {
      color: context.secondaryColor,
      alpha: 0.18,
    })
    return
  }

  if (variant === 'mushroom-ring') {
    const centerX = context.width * 0.5
    const centerY = context.height * 0.52
    const radiusX = context.width * 0.35
    const radiusY = context.height * 0.28
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10
      const x = centerX + Math.cos(angle) * radiusX
      const y = centerY + Math.sin(angle) * radiusY
      graphics
        .circle(x, y, Math.max(2, context.gridSize * 0.055))
        .fill({
          color: index % 3 === 0 ? context.secondaryColor : context.color,
          alpha: context.alpha * 0.9,
        })
        .stroke({ color: inkColor, alpha: 0.45, width: 1 })
      graphics
        .circle(x - context.gridSize * 0.015, y - context.gridSize * 0.012, 1)
        .fill({ color: warmHighlightColor, alpha: 0.65 })
    }
    return
  }

  for (const item of [
    { x: 0.28, y: 0.58, rx: 0.18, ry: 0.16 },
    { x: 0.5, y: 0.46, rx: 0.2, ry: 0.18 },
    { x: 0.64, y: 0.66, rx: 0.18, ry: 0.13 },
  ]) {
    graphics
      .ellipse(
        context.width * item.x,
        context.height * item.y,
        context.width * item.rx,
        context.height * item.ry,
      )
      .fill({ color: context.color, alpha: context.alpha * 0.84 })
      .stroke({ color: inkColor, alpha: 0.58, width: detailWidth(context.gridSize, 0.02) })
  }
  graphics
    .rect(context.width * 0.2, context.height * 0.48, context.width * 0.58, context.height * 0.05)
    .fill({ color: context.secondaryColor, alpha: context.alpha * 0.55 })
}

const drawSpiderWeb = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'tree-web',
): void => {
  const centerX = context.width * 0.5
  const centerY = context.height * 0.5
  const webColor = context.color
  const anchorColor = context.secondaryColor
  const radialCount = variant === 'road-snare' ? 10 : 8

  graphics
    .roundRect(0, 0, context.width, context.height, Math.max(3, context.gridSize * 0.08))
    .fill({ color: webColor, alpha: variant === 'road-snare' ? context.alpha * 0.08 : 0 })

  for (let index = 0; index < radialCount; index += 1) {
    const angle =
      (Math.PI * 2 * index) / radialCount + randomRange(context.seed + index, -0.12, 0.12)
    const endX = centerX + Math.cos(angle) * context.width * 0.5
    const endY = centerY + Math.sin(angle) * context.height * 0.5
    drawSketchLine(graphics, centerX, centerY, endX, endY, context.seed + index * 31, {
      color: webColor,
      alpha: context.alpha * 0.72,
      width: detailWidth(context.gridSize, 0.026),
      wobble: context.gridSize * 0.025,
    })
  }

  for (const ring of [0.24, 0.42, 0.62, 0.82]) {
    graphics
      .ellipse(centerX, centerY, context.width * ring * 0.5, context.height * ring * 0.5)
      .stroke({
        color: webColor,
        alpha: context.alpha * (variant === 'canopy-web' ? 0.45 : 0.58),
        width: detailWidth(context.gridSize, 0.02),
      })
  }

  if (variant === 'road-snare') {
    for (const offset of [0.28, 0.48, 0.68]) {
      drawSketchLine(
        graphics,
        context.width * 0.06,
        context.height * offset,
        context.width * 0.94,
        context.height *
          (offset + randomRange(context.seed + Math.round(offset * 100), -0.12, 0.12)),
        context.seed + Math.round(offset * 500),
        {
          color: anchorColor,
          alpha: context.alpha * 0.78,
          width: detailWidth(context.gridSize, 0.045),
          wobble: context.gridSize * 0.04,
        },
      )
    }
  }

  if (variant === 'hanging-strands') {
    for (let index = 0; index < 6; index += 1) {
      const x = context.width * randomRange(context.seed + index * 19, 0.14, 0.86)
      drawSketchLine(
        graphics,
        x,
        context.height * 0.08,
        x + randomRange(context.seed + index * 23, -context.width * 0.08, context.width * 0.08),
        context.height * randomRange(context.seed + index * 29, 0.58, 0.96),
        context.seed + index * 37,
        {
          color: webColor,
          alpha: context.alpha * 0.54,
          width: detailWidth(context.gridSize, 0.018),
          wobble: context.gridSize * 0.03,
        },
      )
    }
  }
}

const drawFallenLog = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'fallen-tree',
): void => {
  drawShadow(graphics, context.width, context.height)

  if (variant === 'raised-roots') {
    const rootBaseX = context.width * 0.48
    const rootBaseY = context.height * 0.58
    graphics
      .ellipse(rootBaseX, rootBaseY, context.width * 0.18, context.height * 0.2)
      .fill({ color: jitterColor(context.color, context.seed, 12), alpha: context.alpha })
      .stroke({ color: inkColor, alpha: 0.78, width: detailWidth(context.gridSize, 0.03) })
    for (let index = 0; index < 9; index += 1) {
      const angle = randomRange(context.seed + index * 29, -Math.PI * 0.95, Math.PI * 0.15)
      const length = randomRange(
        context.seed + index * 31,
        context.width * 0.25,
        context.width * 0.55,
      )
      drawSketchLine(
        graphics,
        rootBaseX,
        rootBaseY,
        rootBaseX + Math.cos(angle) * length,
        rootBaseY + Math.sin(angle) * context.height * 0.55,
        context.seed + index * 43,
        {
          color: context.secondaryColor,
          alpha: 0.82,
          width: detailWidth(context.gridSize, 0.035),
          wobble: context.gridSize * 0.025,
        },
      )
    }
    return
  }

  const horizontal = context.width >= context.height
  const x = horizontal ? context.width * 0.06 : context.width * 0.32
  const y = horizontal ? context.height * 0.32 : context.height * 0.06
  const width = horizontal ? context.width * 0.88 : context.width * 0.36
  const height = horizontal ? context.height * 0.36 : context.height * 0.88
  const radius = Math.min(width, height) * 0.48

  graphics
    .roundRect(x, y, width, height, radius)
    .fill({ color: jitterColor(context.color, context.seed, 18), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.88, width: detailWidth(context.gridSize, 0.035) })

  if (horizontal) {
    for (const along of [0.2, 0.42, 0.66, 0.82]) {
      drawSketchLine(
        graphics,
        x + width * along,
        y + height * 0.16,
        x + width * (along + 0.05),
        y + height * 0.84,
        context.seed + Math.round(along * 100),
        {
          color: context.secondaryColor,
          alpha: 0.35,
          width: 1,
          wobble: context.gridSize * 0.01,
        },
      )
    }
    for (const [branchX, branchY, endX, endY] of [
      [0.3, 0.32, 0.18, 0.02],
      [0.58, 0.66, 0.72, 0.95],
    ] as const) {
      drawSketchLine(
        graphics,
        x + width * branchX,
        y + height * branchY,
        context.width * endX,
        context.height * endY,
        context.seed + Math.round(branchX * 300),
        {
          color: context.secondaryColor,
          alpha: 0.7,
          width: detailWidth(context.gridSize, 0.03),
          wobble: context.gridSize * 0.025,
        },
      )
    }
  } else {
    for (const along of [0.2, 0.42, 0.66, 0.82]) {
      drawSketchLine(
        graphics,
        x + width * 0.16,
        y + height * along,
        x + width * 0.84,
        y + height * (along + 0.05),
        context.seed + Math.round(along * 100),
        {
          color: context.secondaryColor,
          alpha: 0.35,
          width: 1,
          wobble: context.gridSize * 0.01,
        },
      )
    }
  }
}

const drawTreeStump = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  graphics
    .ellipse(
      context.width * 0.5,
      context.height * 0.55,
      context.width * 0.38,
      context.height * 0.32,
    )
    .fill({ color: jitterColor(context.color, context.seed, 14), alpha: context.alpha })
    .stroke({ color: inkColor, alpha: 0.86, width: detailWidth(context.gridSize, 0.035) })
  for (const ring of [0.18, 0.3]) {
    graphics
      .ellipse(
        context.width * 0.5,
        context.height * 0.48,
        context.width * ring,
        context.height * ring * 0.7,
      )
      .stroke({ color: context.secondaryColor, alpha: 0.36, width: 1 })
  }
  drawSketchLine(
    graphics,
    context.width * 0.35,
    context.height * 0.48,
    context.width * 0.62,
    context.height * 0.58,
    context.seed + 57,
    { color: context.secondaryColor, alpha: 0.42, width: 1, wobble: 1 },
  )
}

const drawHarness = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'intact-harness',
): void => {
  const vertical = context.height >= context.width
  const cut = variant === 'cut-harness'
  const lines = vertical
    ? [context.width * 0.35, context.width * 0.65]
    : [context.height * 0.35, context.height * 0.65]

  for (const line of lines) {
    if (vertical) {
      if (cut) {
        drawSketchLine(
          graphics,
          line,
          0,
          line,
          context.height * 0.42,
          context.seed + Math.round(line),
          {
            color: context.color,
            alpha: context.alpha,
            width: detailWidth(context.gridSize, 0.03),
            wobble: context.gridSize * 0.01,
          },
        )
        drawSketchLine(
          graphics,
          line + randomRange(context.seed + Math.round(line), -2, 2),
          context.height * 0.6,
          line,
          context.height,
          context.seed + Math.round(line) + 17,
          {
            color: context.color,
            alpha: context.alpha,
            width: detailWidth(context.gridSize, 0.03),
            wobble: context.gridSize * 0.01,
          },
        )
        continue
      }
      drawSketchLine(graphics, line, 0, line, context.height, context.seed + Math.round(line), {
        color: context.color,
        alpha: context.alpha,
        width: detailWidth(context.gridSize, 0.03),
        wobble: context.gridSize * 0.012,
      })
      continue
    }

    if (cut) {
      drawSketchLine(
        graphics,
        0,
        line,
        context.width * 0.42,
        line,
        context.seed + Math.round(line),
        {
          color: context.color,
          alpha: context.alpha,
          width: detailWidth(context.gridSize, 0.03),
          wobble: context.gridSize * 0.01,
        },
      )
      drawSketchLine(
        graphics,
        context.width * 0.6,
        line + randomRange(context.seed + Math.round(line), -2, 2),
        context.width,
        line,
        context.seed + Math.round(line) + 17,
        {
          color: context.color,
          alpha: context.alpha,
          width: detailWidth(context.gridSize, 0.03),
          wobble: context.gridSize * 0.01,
        },
      )
      continue
    }
    drawSketchLine(graphics, 0, line, context.width, line, context.seed + Math.round(line), {
      color: context.color,
      alpha: context.alpha,
      width: detailWidth(context.gridSize, 0.03),
      wobble: context.gridSize * 0.012,
    })
  }

  if (cut) {
    for (let index = 0; index < 4; index += 1) {
      const x = vertical
        ? context.width * randomRange(context.seed + index, 0.32, 0.68)
        : context.width * 0.5
      const y = vertical
        ? context.height * 0.5
        : context.height * randomRange(context.seed + index, 0.32, 0.68)
      graphics
        .circle(x, y, Math.max(1.2, context.gridSize * 0.025))
        .fill({ color: context.secondaryColor, alpha: 0.78 })
    }
  }
}

const drawWagonWheel = (graphics: Graphics, context: DrawObjectContext): void => {
  drawShadow(graphics, context.width, context.height)
  const radius = Math.min(context.width, context.height) * 0.38
  const centerX = context.width * 0.5
  const centerY = context.height * 0.5
  graphics.circle(centerX, centerY, radius).stroke({
    color: context.color,
    alpha: context.alpha,
    width: detailWidth(context.gridSize, 0.06),
  })
  graphics
    .circle(centerX, centerY, radius * 0.16)
    .fill({ color: context.secondaryColor, alpha: 0.82 })
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8
    drawSketchLine(
      graphics,
      centerX,
      centerY,
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
      context.seed + index * 31,
      { color: context.secondaryColor, alpha: 0.64, width: 1, wobble: 1 },
    )
  }
}

const drawForestRemains = (
  graphics: Graphics,
  context: DrawObjectContext,
  variant = 'scattered-bones',
): void => {
  drawShadow(graphics, context.width, context.height)

  if (variant === 'webbed-deer') {
    graphics
      .ellipse(
        context.width * 0.45,
        context.height * 0.58,
        context.width * 0.28,
        context.height * 0.18,
      )
      .fill({ color: context.color, alpha: context.alpha * 0.78 })
      .stroke({ color: inkColor, alpha: 0.45, width: 1 })
    graphics
      .ellipse(
        context.width * 0.68,
        context.height * 0.48,
        context.width * 0.11,
        context.height * 0.08,
      )
      .fill({ color: context.color, alpha: context.alpha * 0.7 })
      .stroke({ color: inkColor, alpha: 0.38, width: 1 })
    for (const y of [0.42, 0.52, 0.63]) {
      drawSketchLine(
        graphics,
        context.width * 0.14,
        context.height * y,
        context.width * 0.88,
        context.height * (y + 0.05),
        context.seed + Math.round(y * 200),
        {
          color: context.secondaryColor,
          alpha: 0.62,
          width: detailWidth(context.gridSize, 0.02),
          wobble: context.gridSize * 0.03,
        },
      )
    }
    return
  }

  for (let index = 0; index < 7; index += 1) {
    const seed = context.seed + index * 47
    const x = context.width * randomRange(seed + 1, 0.16, 0.84)
    const y = context.height * randomRange(seed + 2, 0.18, 0.82)
    drawSketchLine(
      graphics,
      x - context.width * 0.06,
      y,
      x + context.width * 0.06,
      y + randomRange(seed + 3, -context.height * 0.04, context.height * 0.04),
      seed + 4,
      {
        color: context.color,
        alpha: context.alpha * 0.82,
        width: detailWidth(context.gridSize, 0.026),
        wobble: 1,
      },
    )
    graphics.circle(x, y, Math.max(1.2, context.gridSize * 0.025)).fill({
      color: context.color,
      alpha: context.alpha * 0.7,
    })
  }
}

const drawDetailedObject = (
  graphics: Graphics,
  definition: ResolvedMapObject,
  gridSize: number,
): boolean => {
  const context: DrawObjectContext = {
    width: toPixels(definition.width, gridSize),
    height: toPixels(definition.height, gridSize),
    gridSize,
    color: definition.color,
    secondaryColor: definition.secondaryColor,
    alpha: definition.alpha,
    seed: hashString(`${definition.type}:${definition.id}:${definition.preset ?? ''}`),
  }

  switch (definition.type) {
    case 'stone-wall':
      drawStoneWall(graphics, context)
      return true
    case 'column':
      drawColumn(graphics, context)
      return true
    case 'crate':
      drawCrate(graphics, context)
      return true
    case 'barrel':
      drawBarrel(graphics, context)
      return true
    case 'table':
      drawTable(graphics, context)
      return true
    case 'chair':
      drawChair(graphics, context)
      return true
    case 'rock':
      drawRock(graphics, context)
      return true
    case 'tree':
      drawTree(graphics, context, definition.variant)
      return true
    case 'bush':
      drawBush(graphics, context, definition.variant)
      return true
    case 'thicket':
      drawThicket(graphics, context, definition.variant)
      return true
    case 'bridge':
      drawBridge(graphics, context)
      return true
    case 'wooden-barricade':
      drawWoodenBarricade(graphics, context)
      return true
    case 'wagon':
      drawWagon(graphics, context, definition.variant)
      return true
    case 'ship':
      drawShip(graphics, context, definition.variant)
      return true
    case 'draft-animal':
      drawDraftAnimal(graphics, context, definition.variant)
      return true
    case 'hill-slope':
      drawHillSlope(graphics, context, definition.variant)
      return true
    case 'daylight-area':
      drawDaylightArea(graphics, context)
      return true
    case 'stairs':
      drawStairs(graphics, context, definition.transition?.direction ?? 'down')
      return true
    case 'ladder':
      drawLadder(graphics, context, definition.transition?.direction ?? 'up')
      return true
    case 'altar':
      drawAltar(graphics, context)
      return true
    case 'window':
      drawWindow(graphics, context)
      return true
    case 'spawn-point':
      drawSpawnPoint(graphics, context)
      return true
    case 'decoration':
      drawDecoration(graphics, context, definition.variant)
      return true
    case 'spider-web':
      drawSpiderWeb(graphics, context, definition.variant)
      return true
    case 'fallen-log':
      drawFallenLog(graphics, context, definition.variant)
      return true
    case 'tree-stump':
      drawTreeStump(graphics, context)
      return true
    case 'harness':
      drawHarness(graphics, context, definition.variant)
      return true
    case 'wagon-wheel':
      drawWagonWheel(graphics, context)
      return true
    case 'forest-remains':
      drawForestRemains(graphics, context, definition.variant)
      return true
    case 'trap':
      drawTrap(graphics, context)
      return true
    case 'lever':
      drawLever(graphics, context)
      return true
    default:
      return false
  }
}

const createRectRegistration = (
  type: string,
  defaults: Partial<MapObjectDefinition>,
  presets: readonly ObjectPreset[],
): MapObjectRegistration => ({
  type,
  defaults,
  presets,
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
    if (definition.transition) {
      container.eventMode = 'static'
      container.cursor = 'pointer'
      container.hitArea = new Rectangle(
        0,
        0,
        toPixels(definition.width, context.gridSize),
        toPixels(definition.height, context.gridSize),
      )
      container.on('pointertap', () => context.emitInteraction(definition.id))
    }

    const graphics = new Graphics()
    if (!drawDetailedObject(graphics, definition, context.gridSize)) {
      drawObjectRect(graphics, definition, context)
    }

    if (definition.label) {
      const label = createLabel(definition.label, 0x111827)
      label.anchor.set(0.5)
      label.position.set(
        toPixels(definition.width, context.gridSize) / 2,
        toPixels(definition.height, context.gridSize) / 2,
      )
      container.addChild(graphics, label)
    } else {
      container.addChild(graphics)
    }

    return createRuntime(definition, container)
  },
  getSightGeometry: (definition: ResolvedMapObject) =>
    definition.blocksSight ? rectSegments(definition) : [],
  getCollisionGeometry: (definition: ResolvedMapObject) =>
    definition.blocksMovement ? rectSegments(definition) : [],
})

const registerRect = (
  registry: MapObjectRegistry,
  type: string,
  defaults: Partial<MapObjectDefinition>,
  presets: readonly ObjectPreset[] = [],
): void => registry.register(createRectRegistration(type, defaults, presets))

export const registerStaticObjects = (registry: MapObjectRegistry): void => {
  registerRect(registry, 'floor', {
    width: 1,
    height: 1,
    color: 0x8d7a64,
    secondaryColor: 0x17110d,
    layer: 'floor',
  })

  registerRect(
    registry,
    'stone-floor',
    {
      width: 2,
      height: 2,
      color: 0x9b856b,
      secondaryColor: 0x17110d,
      layer: 'floor',
      tags: ['floor', 'stone'],
    },
    [
      {
        name: 'crypt-slab',
        type: 'stone-floor',
        label: 'Kryptaplatten',
        defaults: { color: 0x8d7a64, secondaryColor: 0x17110d },
      },
    ],
  )

  registerRect(
    registry,
    'wood-floor',
    {
      width: 2,
      height: 2,
      color: 0x8a5a39,
      secondaryColor: 0x21140d,
      layer: 'floor',
      tags: ['floor', 'wood'],
    },
    [
      {
        name: 'old-planks',
        type: 'wood-floor',
        label: 'Alte Bohlen',
        defaults: { color: 0x8a5a39, secondaryColor: 0x21140d },
      },
    ],
  )

  registerRect(
    registry,
    'stone-wall',
    {
      width: 1,
      height: 1,
      color: 0x78746c,
      secondaryColor: 0x15100d,
      blocksSight: true,
      blocksMovement: true,
      layer: 'wallsDoors',
      tags: ['wall', 'stone'],
    },
    [
      {
        name: 'crypt-wall',
        type: 'stone-wall',
        label: 'Kryptawand',
        defaults: { color: 0x776f66, secondaryColor: 0x15100d },
      },
      {
        name: 'outer-wall',
        type: 'stone-wall',
        label: 'Außenwand',
        defaults: { color: 0x55575a, secondaryColor: 0x080707 },
      },
    ],
  )

  registerRect(
    registry,
    'column',
    {
      width: 1,
      height: 1,
      color: 0x81796f,
      secondaryColor: 0x17110d,
      blocksSight: true,
      blocksMovement: true,
      layer: 'terrainStatic',
      tags: ['column', 'stone'],
    },
    [
      {
        name: 'round-stone',
        type: 'column',
        label: 'Steinsäule',
        defaults: { color: 0x82796f, width: 0.9, height: 0.9 },
      },
    ],
  )

  registerRect(
    registry,
    'crate',
    {
      width: 1,
      height: 1,
      color: 0xa06a3e,
      secondaryColor: 0x26170d,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['storage'],
    },
    [
      {
        name: 'small-crate',
        type: 'crate',
        label: 'Kleine Kiste',
        defaults: { width: 0.8, height: 0.8 },
      },
      {
        name: 'large-crate',
        type: 'crate',
        label: 'Große Kiste',
        defaults: { width: 1.25, height: 1.25 },
      },
    ],
  )

  registerRect(
    registry,
    'barrel',
    {
      width: 1,
      height: 1,
      color: 0x925d34,
      secondaryColor: 0x21130c,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['storage'],
    },
    [
      {
        name: 'small-barrel',
        type: 'barrel',
        label: 'Kleines Fass',
        defaults: { width: 0.75, height: 0.75 },
      },
      {
        name: 'large-barrel',
        type: 'barrel',
        label: 'Großes Fass',
        defaults: { width: 1.1, height: 1.1 },
      },
    ],
  )

  registerRect(
    registry,
    'table',
    {
      width: 2,
      height: 1,
      color: 0x7a4f35,
      secondaryColor: 0x21140d,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['furniture'],
    },
    [
      {
        name: 'rough-table',
        type: 'table',
        label: 'Grober Holztisch',
        defaults: { width: 2, height: 1, color: 0x7a4f35, secondaryColor: 0x21140d },
      },
      {
        name: 'market-stall',
        type: 'table',
        label: 'Marktstand',
        defaults: {
          width: 2.8,
          height: 1.15,
          color: 0x8a5d38,
          secondaryColor: 0x2b1a10,
        },
      },
      {
        name: 'workbench',
        type: 'table',
        label: 'Werkbank',
        defaults: {
          width: 2.4,
          height: 1,
          color: 0x6f4b30,
          secondaryColor: 0x24170e,
        },
      },
    ],
  )

  registerRect(
    registry,
    'chair',
    {
      width: 0.65,
      height: 0.65,
      color: 0x71462e,
      secondaryColor: 0x21140d,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['furniture'],
    },
    [
      {
        name: 'wooden-stool',
        type: 'chair',
        label: 'Holzschemel',
        defaults: { width: 0.58, height: 0.58, color: 0x6f4b30, secondaryColor: 0x21140d },
      },
      {
        name: 'simple-bench',
        type: 'chair',
        label: 'Einfache Bank',
        defaults: { width: 1.45, height: 0.65, color: 0x755033, secondaryColor: 0x21140d },
      },
      {
        name: 'broken-chair',
        type: 'chair',
        label: 'Zerbrochener Stuhl',
        defaults: { width: 0.75, height: 0.62, color: 0x5f3f28, secondaryColor: 0x21140d },
      },
    ],
  )

  registerRect(
    registry,
    'rock',
    {
      width: 1,
      height: 1,
      color: 0x77736b,
      secondaryColor: 0x191512,
      blocksMovement: true,
      layer: 'terrainStatic',
      tags: ['rock'],
    },
    [
      {
        name: 'small-rock',
        type: 'rock',
        label: 'Kleiner Felsen',
        defaults: { width: 0.75, height: 0.65, color: 0x77736b },
      },
      {
        name: 'mossy-boulder',
        type: 'rock',
        label: 'Moosiger Fels',
        defaults: { width: 1.25, height: 1.1, color: 0x656e5c, secondaryColor: 0x1d2418 },
      },
      {
        name: 'large-boulder',
        type: 'rock',
        label: 'Großer Felsblock',
        defaults: { width: 1.6, height: 1.35, color: 0x77736b },
      },
      {
        name: 'rubble-pile',
        type: 'rock',
        label: 'Geroellhaufen',
        defaults: {
          width: 2.1,
          height: 1.35,
          color: 0x6f6a62,
          secondaryColor: 0x24211d,
          blocksMovement: false,
          tags: ['rock', 'rubble', 'difficult-terrain'],
        },
      },
      {
        name: 'standing-stone',
        type: 'rock',
        label: 'Stehender Stein',
        defaults: {
          width: 1.05,
          height: 1.75,
          color: 0x696d64,
          secondaryColor: 0x1d2418,
          blocksSight: true,
        },
      },
      {
        name: 'sharp-scree',
        type: 'rock',
        label: 'Scharfer Geroellhang',
        defaults: {
          width: 2.4,
          height: 1.2,
          color: 0x777063,
          secondaryColor: 0x2f2a24,
          blocksMovement: false,
          tags: ['rock', 'scree', 'difficult-terrain'],
        },
      },
    ],
  )

  registerRect(
    registry,
    'tree',
    {
      width: 1.4,
      height: 1.6,
      color: 0x355f2e,
      secondaryColor: 0x3a2414,
      blocksMovement: true,
      blocksSight: true,
      layer: 'objectsStatic',
      tags: ['nature', 'tree'],
      variant: 'old-oak',
    },
    [
      {
        name: 'old-oak',
        type: 'tree',
        label: 'Alter Baum',
        defaults: { variant: 'old-oak', color: 0x3d6f34, secondaryColor: 0x3a2414 },
      },
      {
        name: 'pine-tree',
        type: 'tree',
        label: 'Dunkle Tanne',
        defaults: { variant: 'pine-tree', color: 0x244d35, secondaryColor: 0x342211 },
      },
      {
        name: 'birch-tree',
        type: 'tree',
        label: 'Helle Birke',
        defaults: {
          variant: 'birch-tree',
          width: 1.25,
          height: 1.7,
          color: 0x78a85b,
          secondaryColor: 0xd9d7c8,
        },
      },
      {
        name: 'autumn-maple',
        type: 'tree',
        label: 'Herbstahorn',
        defaults: {
          variant: 'autumn-maple',
          width: 1.55,
          height: 1.55,
          color: 0xa65a32,
          secondaryColor: 0x3b2616,
        },
      },
      {
        name: 'dead-tree',
        type: 'tree',
        label: 'Toter Baum',
        defaults: { variant: 'dead-tree', color: 0x6b533a, secondaryColor: 0x3b2616 },
      },
    ],
  )

  registerRect(
    registry,
    'bush',
    {
      width: 0.9,
      height: 0.75,
      color: 0x477139,
      secondaryColor: 0x2b2414,
      layer: 'objectsStatic',
      tags: ['nature', 'bush', 'undergrowth'],
      variant: 'leafy-bush',
    },
    [
      {
        name: 'leafy-bush',
        type: 'bush',
        label: 'Blattbusch',
        defaults: { variant: 'leafy-bush', color: 0x4f7f3e, secondaryColor: 0x2b2414 },
      },
      {
        name: 'thorn-bush',
        type: 'bush',
        label: 'Dornenbusch',
        defaults: {
          variant: 'thorn-bush',
          width: 1.05,
          height: 0.85,
          color: 0x52633a,
          secondaryColor: 0x342211,
        },
      },
      {
        name: 'berry-bush',
        type: 'bush',
        label: 'Beerenbusch',
        defaults: { variant: 'berry-bush', color: 0x476f37, secondaryColor: 0x2b2414 },
      },
      {
        name: 'reed-clump',
        type: 'bush',
        label: 'Schilfbueschel',
        defaults: {
          variant: 'leafy-bush',
          width: 1,
          height: 1.15,
          color: 0x6f7a3d,
          secondaryColor: 0x3e3517,
        },
      },
      {
        name: 'mushroom-cluster',
        type: 'bush',
        label: 'Pilzgruppe',
        defaults: {
          variant: 'berry-bush',
          width: 0.8,
          height: 0.65,
          color: 0x7f5f45,
          secondaryColor: 0xb9d2a0,
        },
      },
    ],
  )

  registerRect(
    registry,
    'thicket',
    {
      width: 1.45,
      height: 1.05,
      color: 0x3f6130,
      secondaryColor: 0x2b2414,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['nature', 'thicket', 'undergrowth', 'difficult-terrain'],
      variant: 'bramble',
    },
    [
      {
        name: 'dense-bramble',
        type: 'thicket',
        label: 'Dichtes Gestruepp',
        defaults: { variant: 'bramble', color: 0x3f6130, secondaryColor: 0x2b2414 },
      },
      {
        name: 'dry-scrub',
        type: 'thicket',
        label: 'Trockenes Gestruepp',
        defaults: { variant: 'dry-scrub', color: 0x75683c, secondaryColor: 0x4f3a20 },
      },
      {
        name: 'reed-bed',
        type: 'thicket',
        label: 'Dichtes Schilf',
        defaults: {
          variant: 'dry-scrub',
          width: 1.7,
          height: 1.35,
          color: 0x6f7b3f,
          secondaryColor: 0x3e3517,
          blocksMovement: false,
        },
      },
      {
        name: 'nettles',
        type: 'thicket',
        label: 'Brennnesseln',
        defaults: {
          variant: 'bramble',
          width: 1.35,
          height: 1,
          color: 0x4d793f,
          secondaryColor: 0x27431d,
          blocksMovement: false,
        },
      },
    ],
  )

  registerRect(
    registry,
    'bridge',
    {
      width: 3,
      height: 2,
      color: 0x81613e,
      secondaryColor: 0x1f150d,
      layer: 'objectsStatic',
      tags: ['bridge', 'crossing', 'wood'],
    },
    [
      {
        name: 'wooden-footbridge',
        type: 'bridge',
        label: 'Holzsteg',
        defaults: { color: 0x81613e, secondaryColor: 0x1f150d },
      },
      {
        name: 'old-forest-bridge',
        type: 'bridge',
        label: 'Alter Waldsteg',
        defaults: { color: 0x73563a, secondaryColor: 0x1c150e },
      },
      {
        name: 'stone-causeway',
        type: 'bridge',
        label: 'Steinerner Damm',
        defaults: {
          color: 0x77736b,
          secondaryColor: 0x24211d,
          tags: ['bridge', 'crossing', 'stone'],
        },
      },
    ],
  )

  registerRect(
    registry,
    'wooden-barricade',
    {
      width: 1.15,
      height: 4,
      color: 0x7b4f2f,
      secondaryColor: 0x21140d,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['barricade', 'wood', 'blocker'],
    },
    [
      {
        name: 'rough-road-barricade',
        type: 'wooden-barricade',
        label: 'Grobe Wegbarrikade',
        defaults: { color: 0x7b4f2f, secondaryColor: 0x21140d, width: 1.15, height: 4 },
      },
      {
        name: 'spiked-road-barricade',
        type: 'wooden-barricade',
        label: 'Zugespitzte Wegbarrikade',
        defaults: { color: 0x6f4125, secondaryColor: 0x1c1009, width: 1.25, height: 4.4 },
      },
      {
        name: 'split-rail-fence',
        type: 'wooden-barricade',
        label: 'Weidezaun',
        defaults: {
          width: 3.4,
          height: 0.35,
          color: 0x765338,
          secondaryColor: 0x2a1a10,
          blocksSight: false,
          tags: ['fence', 'wood', 'cover'],
        },
      },
      {
        name: 'broken-fence',
        type: 'wooden-barricade',
        label: 'Gebrochener Zaun',
        defaults: {
          width: 2.6,
          height: 0.45,
          color: 0x604329,
          secondaryColor: 0x21140d,
          blocksSight: false,
          tags: ['fence', 'wood', 'debris'],
        },
      },
      {
        name: 'thorn-deadfall',
        type: 'wooden-barricade',
        label: 'Dornenverhau',
        defaults: {
          width: 3.2,
          height: 1.2,
          color: 0x5b3b24,
          secondaryColor: 0x2f4a1f,
          blocksSight: false,
          tags: ['barricade', 'wood', 'thorn', 'difficult-terrain'],
        },
      },
    ],
  )

  registerRect(
    registry,
    'hill-slope',
    {
      width: 6,
      height: 3,
      color: 0x6f8846,
      secondaryColor: 0x2d3f19,
      alpha: 1,
      layer: 'terrainStatic',
      tags: ['terrain', 'hill', 'slope', 'elevation'],
      variant: 'rise-north',
    },
    [
      {
        name: 'grassy-north-rise',
        type: 'hill-slope',
        label: 'Grashang nach Norden',
        defaults: { variant: 'rise-north', color: 0x708a48, secondaryColor: 0x2e421b },
      },
      {
        name: 'grassy-south-rise',
        type: 'hill-slope',
        label: 'Grashang nach Sueden',
        defaults: { variant: 'rise-south', color: 0x6d8746, secondaryColor: 0x2b3d19 },
      },
      {
        name: 'rocky-north-rise',
        type: 'hill-slope',
        label: 'Steiniger Hang nach Norden',
        defaults: { variant: 'rise-north', color: 0x6d7654, secondaryColor: 0x2f3425 },
      },
      {
        name: 'rocky-south-rise',
        type: 'hill-slope',
        label: 'Steiniger Hang nach Sueden',
        defaults: { variant: 'rise-south', color: 0x687052, secondaryColor: 0x2f3425 },
      },
      {
        name: 'grassy-west-rise',
        type: 'hill-slope',
        label: 'Grashang nach Westen',
        defaults: { variant: 'rise-west', color: 0x708a48, secondaryColor: 0x2e421b },
      },
      {
        name: 'rocky-east-rise',
        type: 'hill-slope',
        label: 'Steiniger Hang nach Osten',
        defaults: { variant: 'rise-east', color: 0x687052, secondaryColor: 0x2f3425 },
      },
    ],
  )

  registerRect(
    registry,
    'wagon',
    {
      width: 2.25,
      height: 1.1,
      color: 0x8a5d38,
      secondaryColor: 0x21140d,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['wagon', 'cart', 'road'],
      variant: 'hitch-east',
    },
    [
      {
        name: 'loaded-farm-wagon-east',
        type: 'wagon',
        label: 'Beladener Wagen nach Osten',
        defaults: { variant: 'hitch-east', color: 0x8a5d38, secondaryColor: 0x21140d },
      },
      {
        name: 'loaded-farm-wagon-west',
        type: 'wagon',
        label: 'Beladener Wagen nach Westen',
        defaults: { variant: 'hitch-west', color: 0x805535, secondaryColor: 0x21140d },
      },
      {
        name: 'loaded-farm-wagon-north',
        type: 'wagon',
        label: 'Beladener Wagen nach Norden',
        defaults: {
          variant: 'hitch-north',
          width: 2.2,
          height: 3.2,
          color: 0x8a5d38,
          secondaryColor: 0x21140d,
        },
      },
      {
        name: 'loaded-farm-wagon-south',
        type: 'wagon',
        label: 'Beladener Wagen nach Sueden',
        defaults: {
          variant: 'hitch-south',
          width: 2.2,
          height: 3.2,
          color: 0x805535,
          secondaryColor: 0x21140d,
        },
      },
    ],
  )

  registerRect(
    registry,
    'ship',
    {
      width: 7,
      height: 3.2,
      color: 0x765033,
      secondaryColor: 0x26180f,
      blocksMovement: true,
      blocksSight: false,
      layer: 'objectsStatic',
      tags: ['ship', 'boat', 'water', 'cover'],
      variant: 'weathered-sloop',
    },
    [
      {
        name: 'weathered-sloop',
        type: 'ship',
        label: 'Verwittertes Flussschiff',
        defaults: {
          variant: 'weathered-sloop',
          color: 0x765033,
          secondaryColor: 0x26180f,
        },
      },
      {
        name: 'broken-river-ship',
        type: 'ship',
        label: 'Geborstenes Schiffswrack',
        defaults: {
          variant: 'broken-river-ship',
          color: 0x5f432e,
          secondaryColor: 0x21150e,
          blocksSight: false,
        },
      },
    ],
  )

  registerRect(
    registry,
    'draft-animal',
    {
      width: 1.2,
      height: 0.8,
      color: 0x7a5639,
      secondaryColor: 0x2a1a10,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['animal', 'draft'],
      variant: 'facing-east',
    },
    [
      {
        name: 'brown-draft-ox-east',
        type: 'draft-animal',
        label: 'Zugochse nach Osten',
        defaults: {
          variant: 'facing-east',
          color: 0x7a5639,
          secondaryColor: 0x2a1a10,
          tags: ['ox'],
        },
      },
      {
        name: 'brown-draft-ox-west',
        type: 'draft-animal',
        label: 'Zugochse nach Westen',
        defaults: {
          variant: 'facing-west',
          color: 0x725136,
          secondaryColor: 0x2a1a10,
          tags: ['ox'],
        },
      },
      {
        name: 'brown-draft-horse-east',
        type: 'draft-animal',
        label: 'Zugpferd nach Osten',
        defaults: {
          variant: 'horse-east',
          color: 0x8a5f3d,
          secondaryColor: 0x2a1a10,
          tags: ['horse'],
        },
      },
      {
        name: 'brown-draft-horse-west',
        type: 'draft-animal',
        label: 'Zugpferd nach Westen',
        defaults: {
          variant: 'horse-west',
          color: 0x765031,
          secondaryColor: 0x24170e,
          tags: ['horse'],
        },
      },
      {
        name: 'brown-draft-horse-north',
        type: 'draft-animal',
        label: 'Zugpferd nach Norden',
        defaults: {
          variant: 'horse-north',
          width: 1,
          height: 1.45,
          color: 0x8a5f3d,
          secondaryColor: 0x2a1a10,
          tags: ['horse'],
        },
      },
      {
        name: 'brown-draft-horse-south',
        type: 'draft-animal',
        label: 'Zugpferd nach Sueden',
        defaults: {
          variant: 'horse-south',
          width: 1,
          height: 1.45,
          color: 0x765031,
          secondaryColor: 0x24170e,
          tags: ['horse'],
        },
      },
      {
        name: 'gray-draft-mule-north',
        type: 'draft-animal',
        label: 'Maultier nach Norden',
        defaults: {
          variant: 'horse-north',
          width: 0.9,
          height: 1.25,
          color: 0x6f6b60,
          secondaryColor: 0x27241f,
          tags: ['mule'],
        },
      },
      {
        name: 'gray-draft-mule-south',
        type: 'draft-animal',
        label: 'Maultier nach Sueden',
        defaults: {
          variant: 'horse-south',
          width: 0.9,
          height: 1.25,
          color: 0x68645a,
          secondaryColor: 0x27241f,
          tags: ['mule'],
        },
      },
    ],
  )

  registerRect(
    registry,
    'daylight-area',
    {
      width: 4,
      height: 4,
      color: 0xffe9a6,
      secondaryColor: 0xffffff,
      alpha: 0.1,
      layer: 'terrainStatic',
      tags: ['daylight', 'sunlight'],
    },
    [
      {
        name: 'open-sunlight',
        type: 'daylight-area',
        label: 'Offenes Sonnenlicht',
        defaults: { color: 0xffe6a3, secondaryColor: 0xffffff, alpha: 0.12 },
      },
      {
        name: 'forest-daylight',
        type: 'daylight-area',
        label: 'Gefiltertes Waldlicht',
        defaults: { color: 0xd8ef9f, secondaryColor: 0xfff1ba, alpha: 0.08 },
      },
      {
        name: 'dappled-sunbeams',
        type: 'daylight-area',
        label: 'Sonnenflecken',
        defaults: {
          color: 0xffefb0,
          secondaryColor: 0xffffff,
          alpha: 0.1,
          width: 5,
          height: 4,
        },
      },
      {
        name: 'pale-overcast-light',
        type: 'daylight-area',
        label: 'Blasses Wolkenlicht',
        defaults: {
          color: 0xd6e4ef,
          secondaryColor: 0xffffff,
          alpha: 0.07,
          width: 6,
          height: 5,
        },
      },
    ],
  )

  registerRect(
    registry,
    'stairs',
    {
      width: 1.4,
      height: 1.4,
      color: 0x746d64,
      secondaryColor: 0x17110d,
      layer: 'interactiveObjects',
      tags: ['transition', 'stairs', 'interactive'],
    },
    [
      {
        name: 'stone-stairs-down',
        type: 'stairs',
        label: 'Steintreppe nach unten',
        defaults: { color: 0x746d64, secondaryColor: 0x17110d },
      },
      {
        name: 'stone-stairs-up',
        type: 'stairs',
        label: 'Steintreppe nach oben',
        defaults: { color: 0x7d756b, secondaryColor: 0x17110d },
      },
    ],
  )

  registerRect(
    registry,
    'ladder',
    {
      width: 1,
      height: 1.35,
      color: 0x9a6b3f,
      secondaryColor: 0x21140d,
      layer: 'interactiveObjects',
      tags: ['transition', 'ladder', 'interactive'],
    },
    [
      {
        name: 'wooden-ladder-up',
        type: 'ladder',
        label: 'Holzleiter nach oben',
        defaults: { color: 0x9a6b3f, secondaryColor: 0x21140d },
      },
      {
        name: 'wooden-ladder-down',
        type: 'ladder',
        label: 'Holzleiter nach unten',
        defaults: { color: 0x815735, secondaryColor: 0x21140d },
      },
    ],
  )

  registerRect(registry, 'altar', {
    width: 2.2,
    height: 1.4,
    color: 0x81776a,
    secondaryColor: 0x17110d,
    blocksMovement: true,
    layer: 'objectsStatic',
    tags: ['chapel', 'altar'],
  })

  registerRect(registry, 'window', {
    width: 1,
    height: 0.3,
    color: 0x9bd6ff,
    secondaryColor: 0x17110d,
    layer: 'wallsDoors',
    tags: ['window', 'daylight'],
  })

  registerRect(registry, 'spawn-point', {
    width: 0.5,
    height: 0.5,
    color: 0x48bb78,
    secondaryColor: 0x10351f,
    alpha: 0.7,
    layer: 'selection',
    tags: ['spawn'],
  })

  registerRect(
    registry,
    'decoration',
    {
      width: 1,
      height: 1,
      color: 0xa0aec0,
      secondaryColor: 0x2d3748,
      layer: 'objectsStatic',
      tags: ['decoration'],
      variant: 'sack-pile',
    },
    [
      {
        name: 'sack-pile',
        type: 'decoration',
        label: 'Sackstapel',
        defaults: {
          variant: 'sack-pile',
          width: 1.25,
          height: 0.9,
          color: 0x9a7651,
          secondaryColor: 0x3b2a1b,
        },
      },
      {
        name: 'bedroll',
        type: 'decoration',
        label: 'Bettrolle',
        defaults: {
          variant: 'bedroll',
          width: 1.5,
          height: 0.7,
          color: 0x53616a,
          secondaryColor: 0x1f2930,
        },
      },
      {
        name: 'road-sign',
        type: 'decoration',
        label: 'Wegschild',
        defaults: {
          variant: 'road-sign',
          width: 0.85,
          height: 1.45,
          color: 0x8a5d38,
          secondaryColor: 0x2b1a10,
          blocksMovement: true,
          blocksSight: false,
          tags: ['decoration', 'road', 'sign'],
        },
      },
      {
        name: 'farm-tools',
        type: 'decoration',
        label: 'Feldwerkzeug',
        defaults: {
          variant: 'farm-tools',
          width: 1.25,
          height: 0.85,
          color: 0x8a7a61,
          secondaryColor: 0x4f351f,
          tags: ['decoration', 'farm', 'tools'],
        },
      },
      {
        name: 'plank-debris',
        type: 'decoration',
        label: 'Bretterreste',
        defaults: {
          variant: 'plank-debris',
          width: 1.8,
          height: 0.8,
          color: 0x6f4a2e,
          secondaryColor: 0x24160d,
          blocksMovement: false,
          tags: ['decoration', 'debris', 'wood'],
        },
      },
      {
        name: 'ritual-runes',
        type: 'decoration',
        label: 'Ritualrunen',
        defaults: {
          variant: 'ritual-runes',
          width: 1.5,
          height: 1.5,
          color: 0x8be9ff,
          secondaryColor: 0x9f7aea,
          alpha: 0.88,
          layer: 'effects',
          tags: ['decoration', 'magic', 'runes'],
        },
      },
      {
        name: 'grave-marker',
        type: 'decoration',
        label: 'Grabstein',
        defaults: {
          variant: 'grave-marker',
          width: 0.85,
          height: 1.05,
          color: 0x787b74,
          secondaryColor: 0x2b2f2a,
          blocksMovement: true,
          tags: ['decoration', 'grave', 'stone'],
        },
      },
      {
        name: 'mushroom-ring',
        type: 'decoration',
        label: 'Pilzring',
        defaults: {
          variant: 'mushroom-ring',
          width: 1.45,
          height: 1.15,
          color: 0x8f6a4f,
          secondaryColor: 0xd8d7ba,
          tags: ['decoration', 'mushroom', 'fae'],
        },
      },
    ],
  )

  registerRect(
    registry,
    'spider-web',
    {
      width: 2,
      height: 2,
      color: 0xf4f7f2,
      secondaryColor: 0xcbd5cf,
      alpha: 0.82,
      layer: 'objectsStatic',
      tags: ['web', 'spider', 'difficult-terrain'],
      variant: 'tree-web',
    },
    [
      {
        name: 'road-snare',
        type: 'spider-web',
        label: 'Dickes Straßennetz',
        defaults: {
          variant: 'road-snare',
          width: 4,
          height: 3,
          blocksMovement: true,
          alpha: 0.88,
        },
      },
      {
        name: 'tree-web',
        type: 'spider-web',
        label: 'Netz zwischen Bäumen',
        defaults: { variant: 'tree-web', width: 2.4, height: 2.4, alpha: 0.7 },
      },
      {
        name: 'canopy-web',
        type: 'spider-web',
        label: 'Netz in Baumkronen',
        defaults: {
          variant: 'canopy-web',
          width: 3,
          height: 2.6,
          alpha: 0.56,
          layer: 'effects',
        },
      },
      {
        name: 'hanging-strands',
        type: 'spider-web',
        label: 'Hängende Netzfäden',
        defaults: {
          variant: 'hanging-strands',
          width: 2.2,
          height: 3,
          alpha: 0.62,
          layer: 'effects',
        },
      },
    ],
  )

  registerRect(
    registry,
    'fallen-log',
    {
      width: 3,
      height: 1,
      color: 0x6a442b,
      secondaryColor: 0x2b1a10,
      blocksMovement: true,
      layer: 'objectsStatic',
      tags: ['tree', 'log', 'cover'],
      variant: 'fallen-tree',
    },
    [
      {
        name: 'fallen-tree',
        type: 'fallen-log',
        label: 'Umgestürzter Baum',
        defaults: { variant: 'fallen-tree', width: 4.2, height: 1.2 },
      },
      {
        name: 'raised-roots',
        type: 'fallen-log',
        label: 'Erhöhte Wurzeln',
        defaults: {
          variant: 'raised-roots',
          width: 2.8,
          height: 1.9,
          color: 0x644126,
          secondaryColor: 0x24160d,
        },
      },
    ],
  )

  registerRect(registry, 'tree-stump', {
    width: 0.9,
    height: 0.85,
    color: 0x6c472b,
    secondaryColor: 0x2b1a10,
    blocksMovement: true,
    layer: 'objectsStatic',
    tags: ['tree', 'stump', 'cover'],
  })

  registerRect(
    registry,
    'harness',
    {
      width: 0.8,
      height: 1.6,
      color: 0x4d2f1d,
      secondaryColor: 0xd1b182,
      alpha: 0.9,
      layer: 'objectsStatic',
      tags: ['wagon', 'tack', 'harness'],
      variant: 'intact-harness',
    },
    [
      {
        name: 'intact-harness',
        type: 'harness',
        label: 'Intaktes Geschirr',
        defaults: { variant: 'intact-harness' },
      },
      {
        name: 'cut-harness',
        type: 'harness',
        label: 'Angeschnittenes Geschirr',
        defaults: { variant: 'cut-harness', secondaryColor: 0xe9d5a1 },
      },
    ],
  )

  registerRect(registry, 'wagon-wheel', {
    width: 0.9,
    height: 0.9,
    color: 0x5a3b25,
    secondaryColor: 0x22140c,
    layer: 'objectsStatic',
    tags: ['wagon', 'debris', 'wheel'],
  })

  registerRect(
    registry,
    'forest-remains',
    {
      width: 1.4,
      height: 1,
      color: 0xd6cfb9,
      secondaryColor: 0xf4f7f2,
      alpha: 0.82,
      layer: 'objectsStatic',
      tags: ['forest', 'debris', 'bones'],
      variant: 'scattered-bones',
    },
    [
      {
        name: 'scattered-bones',
        type: 'forest-remains',
        label: 'Verstreute Knochen',
        defaults: { variant: 'scattered-bones' },
      },
      {
        name: 'webbed-deer',
        type: 'forest-remains',
        label: 'Eingesponnener Hirsch',
        defaults: {
          variant: 'webbed-deer',
          width: 1.8,
          height: 1.2,
          color: 0x79614a,
          secondaryColor: 0xf4f7f2,
        },
      },
    ],
  )

  registerRect(registry, 'trap', {
    width: 1,
    height: 1,
    color: 0xb91c1c,
    secondaryColor: 0x450a0a,
    layer: 'interactiveObjects',
    tags: ['trap', 'interactive'],
    interactionState: 'idle',
  })

  registerRect(registry, 'lever', {
    width: 0.45,
    height: 0.75,
    color: 0xc9a227,
    secondaryColor: 0x533f07,
    layer: 'interactiveObjects',
    tags: ['switch', 'interactive'],
    interactionState: 'idle',
  })
}
