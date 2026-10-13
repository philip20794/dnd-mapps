import type { Graphics } from 'pixi.js'

export const inkColor = 0x15100d
export const deepShadowColor = 0x050505
export const warmHighlightColor = 0xffe3b0

export const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const random01 = (seed: number): number => {
  let value = seed + 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export const randomRange = (seed: number, min: number, max: number): number =>
  min + (max - min) * random01(seed)

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

export const shiftColor = (color: number, amount: number): number => {
  const r = clampChannel(((color >> 16) & 0xff) + amount)
  const g = clampChannel(((color >> 8) & 0xff) + amount)
  const b = clampChannel((color & 0xff) + amount)
  return (r << 16) + (g << 8) + b
}

export const mixColor = (a: number, b: number, amount: number): number => {
  const mix = Math.max(0, Math.min(1, amount))
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = clampChannel(ar + (br - ar) * mix)
  const g = clampChannel(ag + (bg - ag) * mix)
  const bl = clampChannel(ab + (bb - ab) * mix)
  return (r << 16) + (g << 8) + bl
}

export const jitterColor = (color: number, seed: number, amount: number): number => {
  const brightness = (random01(seed + 11) - 0.5) * amount
  const warmth = (random01(seed + 17) - 0.5) * amount * 0.22
  const r = clampChannel(((color >> 16) & 0xff) + brightness + warmth)
  const g = clampChannel(((color >> 8) & 0xff) + brightness)
  const b = clampChannel((color & 0xff) + brightness - warmth)
  return (r << 16) + (g << 8) + b
}

export const outlineWidth = (gridSize: number, scale = 0.055): number =>
  Math.max(2, gridSize * scale)

export const detailWidth = (gridSize: number, scale = 0.025): number =>
  Math.max(1, gridSize * scale)

export const drawSketchLine = (
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  options: {
    readonly color?: number
    readonly alpha?: number
    readonly width?: number
    readonly wobble?: number
  } = {},
): void => {
  const color = options.color ?? inkColor
  const alpha = options.alpha ?? 0.8
  const width = options.width ?? 1
  const wobble = options.wobble ?? 2
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  const oneX = x1 + dx * 0.34 + nx * randomRange(seed + 1, -wobble, wobble)
  const oneY = y1 + dy * 0.34 + ny * randomRange(seed + 2, -wobble, wobble)
  const twoX = x1 + dx * 0.68 + nx * randomRange(seed + 3, -wobble, wobble)
  const twoY = y1 + dy * 0.68 + ny * randomRange(seed + 4, -wobble, wobble)

  graphics
    .moveTo(x1, y1)
    .lineTo(oneX, oneY)
    .lineTo(twoX, twoY)
    .lineTo(x2, y2)
    .stroke({ color, alpha, width })
}

export const drawSketchRect = (
  graphics: Graphics,
  width: number,
  height: number,
  seed: number,
  options: {
    readonly color?: number
    readonly alpha?: number
    readonly width?: number
    readonly wobble?: number
    readonly inset?: number
  } = {},
): void => {
  const inset = options.inset ?? 0
  const left = inset
  const top = inset
  const right = Math.max(left, width - inset)
  const bottom = Math.max(top, height - inset)
  drawSketchLine(graphics, left, top, right, top, seed + 10, options)
  drawSketchLine(graphics, right, top, right, bottom, seed + 20, options)
  drawSketchLine(graphics, right, bottom, left, bottom, seed + 30, options)
  drawSketchLine(graphics, left, bottom, left, top, seed + 40, options)
}

export const drawDirtSpeckles = (
  graphics: Graphics,
  width: number,
  height: number,
  seed: number,
  count: number,
  options: {
    readonly color?: number
    readonly alpha?: number
    readonly minRadius?: number
    readonly maxRadius?: number
  } = {},
): void => {
  for (let index = 0; index < count; index += 1) {
    const pointSeed = seed + index * 43
    graphics
      .circle(
        randomRange(pointSeed + 1, width * 0.06, width * 0.94),
        randomRange(pointSeed + 2, height * 0.08, height * 0.92),
        randomRange(pointSeed + 3, options.minRadius ?? 0.8, options.maxRadius ?? 2.2),
      )
      .fill({ color: options.color ?? inkColor, alpha: options.alpha ?? 0.18 })
  }
}

export const drawDropShadow = (
  graphics: Graphics,
  width: number,
  height: number,
  alpha = 0.28,
): void => {
  graphics
    .ellipse(width * 0.52, height * 0.82, width * 0.43, Math.max(2, height * 0.12))
    .fill({ color: deepShadowColor, alpha })
}
