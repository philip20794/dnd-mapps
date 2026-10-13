import { Container, Graphics } from 'pixi.js'
import type { MapObjectRegistry } from '../registry'
import type { MapObjectDefinition, MapObjectRegistration, ObjectPreset } from '../types'
import { createRuntime, toPixels } from '../renderer'
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

type TorchVariant = 'wooden-sconce' | 'iron-sconce' | 'brass-sconce' | 'crystal-sconce'
type FireObjectType = 'torch' | 'campfire' | 'hearth' | 'light-source' | 'candle'

const torchPresets: readonly ObjectPreset[] = [
  {
    name: 'small-wall-torch',
    type: 'torch',
    label: 'Kleine Wandfackel',
    defaults: {
      variant: 'wooden-sconce',
      width: 0.45,
      height: 0.8,
      light: { color: 0xffb45c, range: 4.5, intensity: 1, flickerStrength: 0.18 },
      animation: { enabled: true, speed: 1.1 },
      sparks: false,
    },
  },
  {
    name: 'large-wall-torch',
    type: 'torch',
    label: 'Große Wandfackel',
    defaults: {
      variant: 'iron-sconce',
      width: 0.65,
      height: 1.1,
      light: { color: 0xffc46b, range: 6, intensity: 1.25, flickerStrength: 0.22 },
      animation: { enabled: true, speed: 1.25 },
      sparks: true,
    },
  },
  {
    name: 'blue-magic-fire',
    type: 'torch',
    label: 'Blaues magisches Feuer',
    defaults: {
      variant: 'crystal-sconce',
      color: 0x60a5fa,
      secondaryColor: 0x1d4ed8,
      light: { color: 0x7dd3fc, range: 5.5, intensity: 1.2, flickerStrength: 0.12 },
      animation: { enabled: true, speed: 0.8 },
      sparks: true,
    },
  },
  {
    name: 'rusty-iron-torch',
    type: 'torch',
    label: 'Rostige Eisenfackel',
    defaults: {
      variant: 'iron-sconce',
      width: 0.5,
      height: 0.9,
      color: 0xff8d35,
      secondaryColor: 0x5a2e18,
      light: { color: 0xffa45a, range: 4.8, intensity: 1.05, flickerStrength: 0.24 },
      animation: { enabled: true, speed: 1.35 },
      sparks: true,
    },
  },
  {
    name: 'brass-wall-sconce',
    type: 'torch',
    label: 'Messing-Wandhalter',
    defaults: {
      variant: 'brass-sconce',
      width: 0.55,
      height: 0.85,
      color: 0xffb24a,
      secondaryColor: 0x8a5b1f,
      light: { color: 0xffc56f, range: 5.2, intensity: 1.12, flickerStrength: 0.16 },
      animation: { enabled: true, speed: 0.95 },
      sparks: false,
    },
  },
  {
    name: 'blue-crystal-torch',
    type: 'torch',
    label: 'Blaue Kristallfackel',
    defaults: {
      variant: 'crystal-sconce',
      width: 0.6,
      height: 0.95,
      color: 0x6ed8ff,
      secondaryColor: 0x2458c7,
      light: { color: 0x8be9ff, range: 6, intensity: 1.3, flickerStrength: 0.1 },
      animation: { enabled: true, speed: 0.72 },
      sparks: true,
    },
  },
  {
    name: 'green-witchlight',
    type: 'torch',
    label: 'Gruenes Hexenlicht',
    defaults: {
      variant: 'crystal-sconce',
      width: 0.58,
      height: 0.9,
      color: 0x7ee66c,
      secondaryColor: 0x1f7a38,
      light: { color: 0xa7f783, range: 6.2, intensity: 1.18, flickerStrength: 0.08 },
      animation: { enabled: true, speed: 0.58 },
      sparks: true,
    },
  },
  {
    name: 'hooded-lantern',
    type: 'torch',
    label: 'Abgeblendete Laterne',
    defaults: {
      variant: 'brass-sconce',
      width: 0.52,
      height: 0.56,
      color: 0xffc978,
      secondaryColor: 0x755326,
      light: { color: 0xffd28a, range: 4.2, intensity: 0.82, flickerStrength: 0.08 },
      animation: { enabled: true, speed: 0.5 },
      sparks: false,
    },
  },
]

const campfirePresets: readonly ObjectPreset[] = [
  {
    name: 'small-campfire',
    type: 'campfire',
    label: 'Kleines Lagerfeuer',
    defaults: {
      width: 1.2,
      height: 1.2,
      light: { color: 0xffa24a, range: 5.5, intensity: 1.15, flickerStrength: 0.2 },
      animation: { enabled: true, speed: 1 },
      sparks: true,
    },
  },
  {
    name: 'large-hearth',
    type: 'hearth',
    label: 'Große Feuerstelle',
    defaults: {
      width: 2,
      height: 2,
      light: { color: 0xffb65f, range: 7.5, intensity: 1.4, flickerStrength: 0.25 },
      animation: { enabled: true, speed: 0.95 },
      sparks: true,
    },
  },
  {
    name: 'magic-hearth',
    type: 'hearth',
    label: 'Magische Feuerstelle',
    defaults: {
      color: 0x7dd3fc,
      secondaryColor: 0x2563eb,
      light: { color: 0x93c5fd, range: 7, intensity: 1.25, flickerStrength: 0.12 },
      animation: { enabled: true, speed: 0.7 },
      sparks: true,
    },
  },
  {
    name: 'smoldering-coals',
    type: 'campfire',
    label: 'Gluehende Kohlen',
    defaults: {
      width: 1,
      height: 0.9,
      color: 0xd94b1f,
      secondaryColor: 0xff9a4a,
      light: { color: 0xff7a35, range: 3.5, intensity: 0.65, flickerStrength: 0.12 },
      animation: { enabled: true, speed: 0.45 },
      sparks: false,
    },
  },
  {
    name: 'standing-brazier',
    type: 'hearth',
    label: 'Standkohlenbecken',
    defaults: {
      width: 1.4,
      height: 1.4,
      color: 0xff8a2a,
      secondaryColor: 0x5c4230,
      light: { color: 0xffb86c, range: 6.4, intensity: 1.15, flickerStrength: 0.18 },
      animation: { enabled: true, speed: 0.9 },
      sparks: true,
    },
  },
]

const candlePresets: readonly ObjectPreset[] = [
  {
    name: 'altar-candle',
    type: 'candle',
    label: 'Altarkerze',
    defaults: {
      width: 0.28,
      height: 0.42,
      color: 0xffd38a,
      secondaryColor: 0xf8efe0,
      light: { color: 0xffd79a, range: 2.5, intensity: 0.62, flickerStrength: 0.12 },
      animation: { enabled: true, speed: 0.9 },
      sparks: false,
    },
  },
  {
    name: 'short-candle',
    type: 'candle',
    label: 'Kurze Kerze',
    defaults: {
      width: 0.22,
      height: 0.32,
      color: 0xffc870,
      secondaryColor: 0xf4e8ce,
      light: { color: 0xffc870, range: 2, intensity: 0.48, flickerStrength: 0.1 },
      animation: { enabled: true, speed: 0.75 },
      sparks: false,
    },
  },
  {
    name: 'blue-ritual-candle',
    type: 'candle',
    label: 'Blaue Ritualkerze',
    defaults: {
      width: 0.24,
      height: 0.36,
      color: 0x7dd3fc,
      secondaryColor: 0xd9f4ff,
      light: { color: 0x93e8ff, range: 2.8, intensity: 0.7, flickerStrength: 0.08 },
      animation: { enabled: true, speed: 0.62 },
      sparks: false,
    },
  },
  {
    name: 'cold-moon-candle',
    type: 'candle',
    label: 'Kalte Mondkerze',
    defaults: {
      width: 0.26,
      height: 0.38,
      color: 0xb9e7ff,
      secondaryColor: 0xe5f6ff,
      light: { color: 0xcdefff, range: 3, intensity: 0.58, flickerStrength: 0.05 },
      animation: { enabled: true, speed: 0.45 },
      sparks: false,
    },
  },
]

const drawTorch = (
  definition: MapObjectDefinition,
  gridSize: number,
): { readonly container: Container; readonly flame: Container } => {
  const container = new Container()
  const width = toPixels(definition.width ?? 0.5, gridSize)
  const height = toPixels(definition.height ?? 0.9, gridSize)
  const variant = (definition.variant ?? 'wooden-sconce') as TorchVariant
  const holderColor =
    variant === 'brass-sconce' ? 0xb88936 : variant === 'crystal-sconce' ? 0x2f59a8 : 0x4a3425
  const holderDark =
    variant === 'brass-sconce' ? 0x5f3d14 : variant === 'crystal-sconce' ? 0x122859 : 0x1f1510
  const seed = hashString(`${definition.type}:${definition.id}:${definition.preset ?? variant}`)

  const shadow = new Graphics()
  shadow
    .ellipse(width / 2, height * 0.82, width * 0.32, height * 0.08)
    .fill({ color: 0x000000, alpha: 0.24 })

  const bracket = new Graphics()
  if (variant === 'wooden-sconce') {
    bracket
      .roundRect(width * 0.36, height * 0.42, width * 0.28, height * 0.48, gridSize * 0.025)
      .fill({ color: 0x4b2d1b })
      .stroke({ color: inkColor, width: detailWidth(gridSize, 0.04) })
      .rect(width * 0.28, height * 0.55, width * 0.44, height * 0.08)
      .fill({ color: holderDark, alpha: 0.75 })
  } else if (variant === 'crystal-sconce') {
    bracket
      .ellipse(width / 2, height * 0.68, width * 0.24, height * 0.12)
      .fill({ color: holderColor, alpha: 0.9 })
      .stroke({ color: inkColor, width: detailWidth(gridSize, 0.04) })
      .rect(width * 0.42, height * 0.45, width * 0.16, height * 0.28)
      .fill({ color: 0x6ed8ff, alpha: 0.42 })
      .stroke({ color: holderDark, alpha: 0.75, width: 1 })
      .circle(width * 0.36, height * 0.64, gridSize * 0.035)
      .fill({ color: 0x9be8ff, alpha: 0.62 })
      .circle(width * 0.64, height * 0.64, gridSize * 0.035)
      .fill({ color: 0x9be8ff, alpha: 0.62 })
  } else {
    bracket
      .roundRect(width * 0.28, height * 0.62, width * 0.44, height * 0.15, gridSize * 0.035)
      .fill({ color: holderColor })
      .stroke({ color: inkColor, width: detailWidth(gridSize, 0.04) })
      .rect(width * 0.45, height * 0.42, width * 0.1, height * 0.38)
      .fill({ color: holderDark, alpha: 0.9 })
      .circle(width * 0.32, height * 0.68, gridSize * 0.025)
      .fill({ color: variant === 'brass-sconce' ? 0xf1cf77 : 0x86542e, alpha: 0.9 })
      .circle(width * 0.68, height * 0.68, gridSize * 0.025)
      .fill({ color: variant === 'brass-sconce' ? 0xf1cf77 : 0x86542e, alpha: 0.9 })
  }

  const bowl = new Graphics()
  bowl
    .ellipse(width / 2, height * 0.42, width * 0.28, height * 0.11)
    .fill({ color: holderColor, alpha: 1 })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.03) })

  const flame = new Container()
  flame.position.set(width / 2, height * 0.28)
  const flameShape = new Graphics()
  const flameColor = definition.color ?? 0xff8a2a
  const innerColor = variant === 'crystal-sconce' ? 0xd8f8ff : 0xfff2a8
  flameShape
    .ellipse(0, height * 0.03, width * 0.24, height * 0.29)
    .fill({ color: flameColor, alpha: 0.9 })
    .stroke({ color: inkColor, alpha: 0.44, width: detailWidth(gridSize, 0.02) })
    .ellipse(width * 0.09, height * 0.08, width * 0.14, height * 0.21)
    .fill({ color: variant === 'crystal-sconce' ? 0x8be9ff : 0xffb64a, alpha: 0.8 })
    .ellipse(-width * 0.07, height * 0.09, width * 0.12, height * 0.18)
    .fill({ color: variant === 'crystal-sconce' ? 0x5fb7ff : 0xff7a22, alpha: 0.72 })
    .ellipse(0, height * 0.11, width * 0.1, height * 0.15)
    .fill({ color: innerColor, alpha: 0.9 })
  drawSketchLine(flameShape, -width * 0.08, height * 0.14, width * 0.1, -height * 0.16, seed + 91, {
    color: warmHighlightColor,
    alpha: 0.36,
    width: 1,
    wobble: gridSize * 0.01,
  })
  flame.addChild(flameShape)

  if (definition.sparks) {
    const sparks = new Graphics()
    sparks
      .circle(-width * 0.22, -height * 0.04, Math.max(1, gridSize * 0.018))
      .fill({ color: innerColor, alpha: 0.72 })
      .circle(width * 0.2, -height * 0.08, Math.max(1, gridSize * 0.014))
      .fill({ color: innerColor, alpha: 0.55 })
      .circle(width * 0.29, height * 0.03, Math.max(1, gridSize * 0.012))
      .fill({ color: innerColor, alpha: 0.48 })
    flame.addChild(sparks)
  }

  container.addChild(shadow, bracket, bowl, flame)
  return { container, flame }
}

const drawCandle = (
  definition: MapObjectDefinition,
  gridSize: number,
): { readonly container: Container; readonly flame: Container } => {
  const container = new Container()
  const width = toPixels(definition.width ?? 0.26, gridSize)
  const height = toPixels(definition.height ?? 0.38, gridSize)
  const seed = hashString(`${definition.type}:${definition.id}:${definition.preset ?? ''}`)
  const waxColor = definition.secondaryColor ?? 0xf4ead7
  const flameColor = definition.color ?? 0xffc870
  const flameInnerColor = definition.color === 0x7dd3fc ? 0xe5fbff : 0xfff0b4

  const shadow = new Graphics()
  shadow
    .ellipse(width / 2, height * 0.84, width * 0.4, height * 0.12)
    .fill({ color: 0x000000, alpha: 0.24 })

  const plate = new Graphics()
  plate
    .ellipse(width / 2, height * 0.74, width * 0.42, height * 0.16)
    .fill({ color: 0x6b6259, alpha: 0.88 })
    .stroke({ color: inkColor, alpha: 0.6, width: detailWidth(gridSize, 0.018) })
    .ellipse(width / 2, height * 0.72, width * 0.29, height * 0.08)
    .fill({ color: 0x9f9386, alpha: 0.68 })

  const wax = new Graphics()
  wax
    .roundRect(width * 0.28, height * 0.32, width * 0.44, height * 0.44, gridSize * 0.025)
    .fill({ color: waxColor, alpha: 1 })
    .stroke({ color: inkColor, alpha: 0.62, width: detailWidth(gridSize, 0.018) })
    .ellipse(width * 0.5, height * 0.33, width * 0.22, height * 0.07)
    .fill({ color: jitterColor(waxColor, seed + 9, 10), alpha: 0.96 })
    .stroke({ color: inkColor, alpha: 0.38, width: 1 })
    .roundRect(width * 0.31, height * 0.48, width * 0.07, height * 0.22, gridSize * 0.018)
    .fill({ color: 0xf7f0e2, alpha: 0.7 })
  drawSketchLine(wax, width * 0.55, height * 0.37, width * 0.55, height * 0.7, seed + 37, {
    color: 0xcdbf9d,
    alpha: 0.42,
    width: 1,
    wobble: gridSize * 0.008,
  })

  const wick = new Graphics()
  drawSketchLine(wick, width * 0.5, height * 0.34, width * 0.5, height * 0.22, seed + 77, {
    color: 0x15110d,
    alpha: 0.8,
    width: Math.max(1, detailWidth(gridSize, 0.012)),
    wobble: gridSize * 0.004,
  })

  const flame = new Container()
  flame.position.set(width / 2, height * 0.18)
  const flameShape = new Graphics()
  flameShape
    .ellipse(0, height * 0.04, width * 0.2, height * 0.21)
    .fill({ color: flameColor, alpha: 0.9 })
    .stroke({ color: inkColor, alpha: 0.34, width: 1 })
    .ellipse(width * 0.04, height * 0.08, width * 0.1, height * 0.13)
    .fill({ color: flameInnerColor, alpha: 0.88 })
  flame.addChild(flameShape)

  container.addChild(shadow, plate, wax, wick, flame)
  return { container, flame }
}

const drawCampfire = (
  definition: MapObjectDefinition,
  gridSize: number,
): { readonly container: Container; readonly flame: Graphics } => {
  const container = new Container()
  const width = toPixels(definition.width ?? 1.2, gridSize)
  const height = toPixels(definition.height ?? 1.2, gridSize)
  const seed = hashString(`${definition.type}:${definition.id}:${definition.preset ?? ''}`)
  const large = width > gridSize * 1.45 || height > gridSize * 1.45

  const shadow = new Graphics()
  shadow
    .ellipse(width / 2, height * 0.72, width * 0.42, height * 0.18)
    .fill({ color: 0x000000, alpha: 0.36 })

  if (large) {
    const hearth = new Graphics()
    hearth
      .roundRect(width * 0.08, height * 0.12, width * 0.84, height * 0.68, gridSize * 0.08)
      .fill({ color: 0x57514a, alpha: 1 })
      .stroke({ color: inkColor, alpha: 0.95, width: outlineWidth(gridSize, 0.055) })
      .roundRect(width * 0.18, height * 0.22, width * 0.64, height * 0.48, gridSize * 0.06)
      .fill({ color: 0x1c1714, alpha: 1 })
      .stroke({ color: inkColor, alpha: 0.7, width: detailWidth(gridSize, 0.03) })
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14
      const stoneX = width * 0.5 + Math.cos(angle) * width * 0.35
      const stoneY = height * 0.46 + Math.sin(angle) * height * 0.26
      hearth
        .ellipse(
          stoneX,
          stoneY,
          randomRange(seed + index * 17, gridSize * 0.055, gridSize * 0.1),
          randomRange(seed + index * 19, gridSize * 0.035, gridSize * 0.075),
        )
        .fill({ color: jitterColor(0x6e675e, seed + index * 23, 18), alpha: 0.92 })
        .stroke({ color: inkColor, alpha: 0.42, width: 1 })
    }
    container.addChild(shadow, hearth)
  } else {
    container.addChild(shadow)
  }

  const stones = new Graphics()
  const stoneCount = large ? 0 : 9
  for (let index = 0; index < stoneCount; index += 1) {
    const angle = (Math.PI * 2 * index) / stoneCount
    stones
      .ellipse(
        width * 0.5 + Math.cos(angle) * width * 0.34,
        height * 0.62 + Math.sin(angle) * height * 0.15,
        gridSize * randomRange(seed + index * 31, 0.055, 0.095),
        gridSize * randomRange(seed + index * 37, 0.035, 0.07),
      )
      .fill({ color: jitterColor(0x6a6259, seed + index * 41, 18), alpha: 1 })
      .stroke({ color: inkColor, alpha: 0.45, width: 1 })
  }
  if (!large) {
    stones
      .ellipse(width / 2, height * 0.62, width * 0.3, height * 0.13)
      .fill({ color: 0x201815, alpha: 1 })
  }

  const logs = new Graphics()
  logs
    .rect(width * 0.2, height * 0.56, width * 0.6, height * 0.12)
    .fill({ color: 0x6f4226 })
    .stroke({ color: inkColor, alpha: 0.7, width: detailWidth(gridSize, 0.025) })
    .rect(width * 0.28, height * 0.45, width * 0.46, height * 0.1)
    .fill({ color: 0x5c331d })
    .stroke({ color: inkColor, alpha: 0.65, width: detailWidth(gridSize, 0.02) })
  logs.rotation = -0.22
  logs.position.set(width * 0.04, height * 0.08)

  const flame = new Graphics()
  const flameBaseY = large ? height * 0.48 : height * 0.42
  const flameScale = large ? 1.32 : 1
  for (let index = 0; index < (large ? 5 : 3); index += 1) {
    const x = width * randomRange(seed + index * 71, 0.38, 0.64)
    const y = flameBaseY + randomRange(seed + index * 73, -height * 0.04, height * 0.08)
    flame
      .ellipse(
        x,
        y,
        width * randomRange(seed + index * 79, 0.07, 0.13) * flameScale,
        height * randomRange(seed + index * 83, 0.12, 0.22) * flameScale,
      )
      .fill({
        color:
          index % 3 === 0 ? (definition.color ?? 0xff7a22) : index % 3 === 1 ? 0xffb84d : 0xffe69a,
        alpha: 0.9,
      })
      .stroke({ color: inkColor, alpha: 0.3, width: 1 })
  }
  drawDirtSpeckles(flame, width, height, seed + 401, large ? 7 : 4, {
    color: 0xffd36a,
    alpha: 0.34,
    minRadius: 1,
    maxRadius: Math.max(1.5, gridSize * 0.035),
  })

  container.addChild(stones, logs, flame)
  return { container, flame }
}

const createFireRegistration = (
  type: FireObjectType,
  defaults: Partial<MapObjectDefinition>,
  presets: readonly ObjectPreset[],
): MapObjectRegistration => ({
  type,
  defaults,
  presets,
  validate: validateBaseObject,
  render: (definition, context) => {
    const fire =
      type === 'torch'
        ? drawTorch(definition, context.gridSize)
        : type === 'candle'
          ? drawCandle(definition, context.gridSize)
          : drawCampfire(definition, context.gridSize)
    const { container, flame } = fire
    container.position.set(
      toPixels(definition.position.x, context.gridSize),
      toPixels(definition.position.y, context.gridSize),
    )
    container.rotation = definition.rotation
    container.scale.set(definition.scale)
    container.visible = definition.visible

    const animation = definition.animation?.enabled
      ? context.animations.register((elapsed, _delta, reduced) => {
          if (!definition.animation) {
            return
          }
          const speed = reduced ? definition.animation.speed * 0.35 : definition.animation.speed
          const wave = Math.sin(elapsed * speed * 5.2 + definition.position.x) * 0.5 + 0.5
          const flicker = definition.light?.flickerStrength ?? 0.15
          flame.scale.set(1 + wave * flicker * 0.3, 1 + wave * flicker)
          flame.alpha = 0.78 + wave * 0.18
        })
      : null

    return createRuntime(definition, container, animation ? [animation.dispose] : [])
  },
})

export const registerFireObjects = (registry: MapObjectRegistry): void => {
  registry.register(
    createFireRegistration(
      'torch',
      {
        width: 0.5,
        height: 0.9,
        color: 0xff8a2a,
        secondaryColor: 0xffe69a,
        layer: 'terrainAnimated',
        tags: ['fire', 'light'],
        light: { color: 0xffb45c, range: 4.5, intensity: 1, flickerStrength: 0.18 },
        animation: { enabled: true, speed: 1 },
      },
      torchPresets,
    ),
  )

  registry.register(
    createFireRegistration(
      'campfire',
      {
        width: 1.2,
        height: 1.2,
        color: 0xff7a22,
        secondaryColor: 0xffdd8a,
        layer: 'terrainAnimated',
        tags: ['fire', 'light'],
        light: { color: 0xffa24a, range: 5.5, intensity: 1.15, flickerStrength: 0.2 },
        animation: { enabled: true, speed: 1 },
      },
      campfirePresets.filter((preset) => preset.type === 'campfire'),
    ),
  )

  registry.register(
    createFireRegistration(
      'hearth',
      {
        width: 2,
        height: 2,
        color: 0xff7a22,
        secondaryColor: 0xffdd8a,
        layer: 'terrainAnimated',
        tags: ['fire', 'light'],
        light: { color: 0xffb65f, range: 7.5, intensity: 1.4, flickerStrength: 0.25 },
        animation: { enabled: true, speed: 0.95 },
      },
      campfirePresets.filter((preset) => preset.type === 'hearth'),
    ),
  )

  registry.register(
    createFireRegistration(
      'candle',
      {
        width: 0.25,
        height: 0.36,
        color: 0xffc870,
        secondaryColor: 0xf4ead7,
        layer: 'terrainAnimated',
        tags: ['fire', 'light', 'candle'],
        light: { color: 0xffcc88, range: 2.2, intensity: 0.52, flickerStrength: 0.1 },
        animation: { enabled: true, speed: 0.8 },
      },
      candlePresets,
    ),
  )

  registry.register(
    createFireRegistration(
      'light-source',
      {
        width: 0.1,
        height: 0.1,
        visible: false,
        layer: 'light',
        tags: ['light'],
        light: { color: 0xffffff, range: 4, intensity: 0.8 },
      },
      [],
    ),
  )
}
