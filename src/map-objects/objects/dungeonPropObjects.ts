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
  hashString,
  inkColor,
  outlineWidth,
  randomRange,
  shiftColor,
} from '../visualStyle'

const dungeonPropPresets: readonly ObjectPreset[] = [
  {
    name: 'frog-idol',
    type: 'dungeon-prop',
    label: 'Primitive Froschfigur',
    defaults: {
      variant: 'frog-idol',
      width: 0.9,
      height: 0.9,
      color: 0x68705b,
      secondaryColor: 0x292d24,
      blocksMovement: true,
      tags: ['dungeon-prop', 'idol', 'frog'],
    },
  },
  {
    name: 'iron-shackle',
    type: 'dungeon-prop',
    label: 'Eiserne Fessel',
    defaults: {
      variant: 'iron-shackle',
      width: 0.7,
      height: 0.7,
      color: 0x4d5354,
      secondaryColor: 0x171a1b,
      tags: ['dungeon-prop', 'shackle', 'iron'],
    },
  },
  {
    name: 'book-stack',
    type: 'dungeon-prop',
    label: 'Zwei alte Bücher',
    defaults: {
      variant: 'book-stack',
      width: 0.9,
      height: 0.7,
      color: 0x6f382b,
      secondaryColor: 0xc8ad77,
      tags: ['dungeon-prop', 'books'],
    },
  },
  {
    name: 'ironbound-chest',
    type: 'dungeon-prop',
    label: 'Eisenbeschlagene Truhe',
    defaults: {
      variant: 'ironbound-chest',
      width: 1.5,
      height: 1,
      color: 0x684027,
      secondaryColor: 0x2f3435,
      blocksMovement: true,
      tags: ['dungeon-prop', 'storage', 'chest'],
    },
  },
  {
    name: 'clay-jars',
    type: 'dungeon-prop',
    label: 'Tonkrüge',
    defaults: {
      variant: 'clay-jars',
      width: 1.2,
      height: 0.85,
      color: 0x8a6547,
      secondaryColor: 0x3e2a1d,
      tags: ['dungeon-prop', 'jars'],
    },
  },
  {
    name: 'gem-cluster',
    type: 'dungeon-prop',
    label: 'Glitzernde Edelsteine',
    defaults: {
      variant: 'gem-cluster',
      width: 1.1,
      height: 0.7,
      color: 0x78b7a7,
      secondaryColor: 0xc7eee0,
      tags: ['dungeon-prop', 'gems', 'treasure'],
    },
  },
  {
    name: 'tadpole-shadows',
    type: 'dungeon-prop',
    label: 'Kaulquappenschatten',
    defaults: {
      variant: 'tadpole-shadows',
      width: 2.2,
      height: 1.4,
      color: 0x101d1d,
      secondaryColor: 0x293c38,
      alpha: 0.68,
      layer: 'effects',
      tags: ['dungeon-prop', 'water', 'tadpoles'],
    },
  },
  {
    name: 'chalk-markings',
    type: 'dungeon-prop',
    label: 'Primitive Kreidemarkierungen',
    defaults: {
      variant: 'chalk-markings',
      width: 1.8,
      height: 1.2,
      color: 0xd4cfb6,
      secondaryColor: 0x8c866f,
      alpha: 0.62,
      layer: 'effects',
      tags: ['dungeon-prop', 'chalk', 'ritual'],
    },
  },
]

const cargoCranePreset: ObjectPreset = {
  name: 'wooden-cargo-crane',
  type: 'cargo-crane',
  label: 'Hölzerner Lastenkran',
  defaults: {
    variant: 'cargo-crane',
    width: 6,
    height: 4.5,
    color: 0x765037,
    secondaryColor: 0x2d1b11,
    blocksMovement: true,
    layer: 'objectsStatic',
    tags: ['dungeon-prop', 'crane', 'cargo', 'wood'],
  },
}

function drawCargoCrane(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const wood = definition.color
  const darkWood = definition.secondaryColor
  const beam = Math.max(gridSize * 0.18, 7)
  const line = outlineWidth(gridSize, 0.055)

  graphics
    .ellipse(width * 0.5, height * 0.75, width * 0.47, height * 0.19)
    .fill({ color: 0x000000, alpha: 0.28 })
  graphics
    .roundRect(width * 0.08, height * 0.18, beam, height * 0.62, beam * 0.24)
    .fill({ color: wood })
    .stroke({ color: inkColor, width: line })
  graphics
    .roundRect(width * 0.36, height * 0.18, beam, height * 0.62, beam * 0.24)
    .fill({ color: shiftColor(wood, -8) })
    .stroke({ color: inkColor, width: line })
  graphics
    .roundRect(width * 0.04, height * 0.14, width * 0.42, beam, beam * 0.2)
    .fill({ color: shiftColor(wood, 10) })
    .stroke({ color: inkColor, width: line })

  graphics
    .moveTo(width * 0.13, height * 0.7)
    .lineTo(width * 0.37, height * 0.23)
    .stroke({ color: darkWood, width: beam * 0.72, alpha: 0.95 })
  graphics
    .moveTo(width * 0.4, height * 0.22)
    .lineTo(width * 0.9, height * 0.42)
    .stroke({ color: inkColor, width: beam * 1.28, alpha: 0.92 })
  graphics
    .moveTo(width * 0.4, height * 0.2)
    .lineTo(width * 0.9, height * 0.4)
    .stroke({ color: shiftColor(wood, 8), width: beam, alpha: 1 })

  const wheelX = width * 0.27
  const wheelY = height * 0.53
  const wheelRadius = Math.min(width, height) * 0.13
  graphics
    .circle(wheelX, wheelY, wheelRadius)
    .fill({ color: darkWood, alpha: 0.95 })
    .stroke({ color: inkColor, width: line })
  graphics
    .circle(wheelX, wheelY, wheelRadius * 0.66)
    .stroke({ color: 0xb7a079, width: detailWidth(gridSize, 0.035), alpha: 0.82 })
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8
    graphics
      .moveTo(wheelX, wheelY)
      .lineTo(wheelX + Math.cos(angle) * wheelRadius, wheelY + Math.sin(angle) * wheelRadius)
      .stroke({ color: 0x9b7955, width: detailWidth(gridSize, 0.025), alpha: 0.88 })
  }
  graphics
    .moveTo(wheelX + wheelRadius * 0.65, wheelY)
    .lineTo(wheelX + wheelRadius * 1.45, wheelY - wheelRadius * 0.36)
    .stroke({ color: 0x8f7457, width: detailWidth(gridSize, 0.05) })
  graphics
    .circle(wheelX + wheelRadius * 1.5, wheelY - wheelRadius * 0.39, gridSize * 0.07)
    .fill({ color: 0x3d3329 })

  const ropeX = width * 0.88
  graphics
    .moveTo(width * 0.9, height * 0.4)
    .lineTo(ropeX, height * 0.82)
    .stroke({ color: 0xc5ad7a, width: detailWidth(gridSize, 0.035), alpha: 0.95 })
  graphics
    .arc(ropeX - gridSize * 0.08, height * 0.84, gridSize * 0.14, -0.35, Math.PI * 1.35)
    .stroke({ color: 0x3f4546, width: detailWidth(gridSize, 0.06) })
  graphics
    .circle(width * 0.9, height * 0.4, gridSize * 0.11)
    .fill({ color: 0x454a49 })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
}

function drawFrogIdol(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const color = definition.color
  graphics
    .ellipse(width * 0.5, height * 0.82, width * 0.42, height * 0.13)
    .fill({ color: 0x000000, alpha: 0.24 })
  graphics
    .roundRect(width * 0.13, height * 0.69, width * 0.74, height * 0.2, gridSize * 0.05)
    .fill({ color: definition.secondaryColor, alpha: 0.92 })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.03) })
  graphics
    .ellipse(width * 0.5, height * 0.54, width * 0.3, height * 0.27)
    .fill({ color })
    .stroke({ color: inkColor, width: outlineWidth(gridSize, 0.035) })
  graphics
    .circle(width * 0.37, height * 0.3, width * 0.12)
    .fill({ color: shiftColor(color, 8) })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
  graphics
    .circle(width * 0.63, height * 0.3, width * 0.12)
    .fill({ color: shiftColor(color, 8) })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
  graphics.circle(width * 0.37, height * 0.29, width * 0.034).fill({ color: 0x171813 })
  graphics.circle(width * 0.63, height * 0.29, width * 0.034).fill({ color: 0x171813 })
  graphics
    .moveTo(width * 0.25, height * 0.55)
    .lineTo(width * 0.08, height * 0.73)
    .lineTo(width * 0.29, height * 0.69)
    .stroke({ color, width: gridSize * 0.1 })
  graphics
    .moveTo(width * 0.75, height * 0.55)
    .lineTo(width * 0.92, height * 0.73)
    .lineTo(width * 0.71, height * 0.69)
    .stroke({ color, width: gridSize * 0.1 })
}

function drawIronShackle(
  graphics: Graphics,
  definition: ResolvedMapObject,
  gridSize: number,
): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const line = detailWidth(gridSize, 0.045)
  graphics
    .circle(width * 0.5, height * 0.5, width * 0.34)
    .fill({ color: definition.secondaryColor, alpha: 0.52 })
    .stroke({ color: definition.color, width: line * 1.5 })
  graphics
    .circle(width * 0.5, height * 0.5, width * 0.19)
    .stroke({ color: 0x8b9290, width: line, alpha: 0.9 })
  for (let index = 0; index < 3; index += 1)
    graphics
      .ellipse(
        width * (0.17 + index * 0.15),
        height * (0.18 + index * 0.11),
        width * 0.12,
        height * 0.08,
      )
      .stroke({ color: definition.color, width: line })
}

function drawBookStack(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  graphics
    .roundRect(width * 0.08, height * 0.42, width * 0.78, height * 0.36, gridSize * 0.035)
    .fill({ color: definition.color })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
  graphics
    .rect(width * 0.17, height * 0.47, width * 0.62, height * 0.25)
    .fill({ color: 0xd0bc91, alpha: 0.72 })
  graphics
    .roundRect(width * 0.2, height * 0.16, width * 0.72, height * 0.35, gridSize * 0.035)
    .fill({ color: 0x3f5165 })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
  graphics
    .moveTo(width * 0.27, height * 0.22)
    .lineTo(width * 0.83, height * 0.22)
    .stroke({ color: definition.secondaryColor, width: detailWidth(gridSize, 0.025), alpha: 0.8 })
}

function drawChest(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  graphics
    .ellipse(width * 0.5, height * 0.84, width * 0.46, height * 0.13)
    .fill({ color: 0x000000, alpha: 0.26 })
  graphics
    .roundRect(width * 0.06, height * 0.18, width * 0.88, height * 0.65, gridSize * 0.09)
    .fill({ color: definition.color })
    .stroke({ color: inkColor, width: outlineWidth(gridSize, 0.04) })
  for (const x of [0.18, 0.74])
    graphics
      .rect(width * x, height * 0.17, width * 0.08, height * 0.67)
      .fill({ color: definition.secondaryColor, alpha: 0.96 })
  graphics
    .moveTo(width * 0.08, height * 0.43)
    .lineTo(width * 0.92, height * 0.43)
    .stroke({ color: definition.secondaryColor, width: detailWidth(gridSize, 0.05) })
  graphics
    .roundRect(width * 0.44, height * 0.39, width * 0.14, height * 0.22, gridSize * 0.025)
    .fill({ color: 0xa68a4b })
    .stroke({ color: inkColor, width: detailWidth(gridSize, 0.02) })
}

function drawClayJars(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const jars = [
    { x: 0.25, y: 0.55, rx: 0.18, ry: 0.31 },
    { x: 0.53, y: 0.48, rx: 0.21, ry: 0.38 },
    { x: 0.79, y: 0.59, rx: 0.15, ry: 0.27 },
  ]
  for (const [index, jar] of jars.entries()) {
    graphics
      .ellipse(width * jar.x, height * jar.y, width * jar.rx, height * jar.ry)
      .fill({ color: shiftColor(definition.color, index * 6 - 4) })
      .stroke({ color: inkColor, width: detailWidth(gridSize, 0.025) })
    graphics
      .ellipse(
        width * jar.x,
        height * (jar.y - jar.ry * 0.75),
        width * jar.rx * 0.58,
        height * 0.055,
      )
      .fill({ color: definition.secondaryColor })
  }
}

function drawGemCluster(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const seed = hashString(definition.id)
  for (let index = 0; index < 7; index += 1) {
    const x = randomRange(seed + index * 17, width * 0.12, width * 0.88)
    const y = randomRange(seed + index * 19, height * 0.22, height * 0.82)
    const radius = randomRange(seed + index * 23, gridSize * 0.055, gridSize * 0.13)
    graphics
      .moveTo(x, y - radius)
      .lineTo(x + radius * 0.75, y)
      .lineTo(x, y + radius)
      .lineTo(x - radius * 0.75, y)
      .closePath()
      .fill({ color: index % 2 === 0 ? definition.color : definition.secondaryColor, alpha: 0.88 })
      .stroke({ color: 0xe9fff7, width: 1, alpha: 0.55 })
  }
}

function drawTadpoles(graphics: Graphics, definition: ResolvedMapObject, gridSize: number): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const seed = hashString(definition.id)
  for (let index = 0; index < 15; index += 1) {
    const x = randomRange(seed + index * 29, width * 0.08, width * 0.92)
    const y = randomRange(seed + index * 31, height * 0.1, height * 0.9)
    const radius = randomRange(seed + index * 37, gridSize * 0.025, gridSize * 0.052)
    graphics.circle(x, y, radius).fill({ color: definition.color, alpha: definition.alpha })
    graphics
      .moveTo(x + radius, y)
      .quadraticCurveTo(x + radius * 2.6, y - radius * 1.2, x + radius * 3.2, y + radius * 0.6)
      .stroke({
        color: definition.secondaryColor,
        width: Math.max(1, radius * 0.55),
        alpha: definition.alpha,
      })
  }
}

function drawChalkMarkings(
  graphics: Graphics,
  definition: ResolvedMapObject,
  gridSize: number,
): void {
  const width = toPixels(definition.width, gridSize)
  const height = toPixels(definition.height, gridSize)
  const line = detailWidth(gridSize, 0.025)
  graphics
    .circle(width * 0.5, height * 0.5, Math.min(width, height) * 0.34)
    .stroke({ color: definition.color, width: line, alpha: definition.alpha })
  graphics
    .moveTo(width * 0.16, height * 0.68)
    .lineTo(width * 0.42, height * 0.19)
    .lineTo(width * 0.62, height * 0.76)
    .lineTo(width * 0.84, height * 0.27)
    .stroke({ color: definition.secondaryColor, width: line, alpha: definition.alpha })
  graphics
    .moveTo(width * 0.23, height * 0.48)
    .lineTo(width * 0.76, height * 0.48)
    .stroke({ color: definition.color, width: line, alpha: definition.alpha * 0.8 })
}

function drawDungeonProp(
  graphics: Graphics,
  definition: ResolvedMapObject,
  gridSize: number,
): void {
  switch (definition.variant) {
    case 'frog-idol':
      drawFrogIdol(graphics, definition, gridSize)
      break
    case 'iron-shackle':
      drawIronShackle(graphics, definition, gridSize)
      break
    case 'book-stack':
      drawBookStack(graphics, definition, gridSize)
      break
    case 'ironbound-chest':
      drawChest(graphics, definition, gridSize)
      break
    case 'clay-jars':
      drawClayJars(graphics, definition, gridSize)
      break
    case 'gem-cluster':
      drawGemCluster(graphics, definition, gridSize)
      break
    case 'tadpole-shadows':
      drawTadpoles(graphics, definition, gridSize)
      break
    case 'chalk-markings':
      drawChalkMarkings(graphics, definition, gridSize)
      break
    default:
      graphics
        .rect(0, 0, toPixels(definition.width, gridSize), toPixels(definition.height, gridSize))
        .fill({ color: definition.color, alpha: definition.alpha })
  }
}

function renderObject(definition: ResolvedMapObject, gridSize: number): RuntimeMapObject {
  const container = new Container()
  container.position.set(
    toPixels(definition.position.x, gridSize),
    toPixels(definition.position.y, gridSize),
  )
  container.rotation = definition.rotation
  container.scale.set(definition.scale)
  container.visible = definition.visible
  const graphics = new Graphics()
  if (definition.type === 'cargo-crane') drawCargoCrane(graphics, definition, gridSize)
  else drawDungeonProp(graphics, definition, gridSize)
  container.addChild(graphics)
  return createRuntime(definition, container)
}

function createRegistration(
  type: string,
  defaults: Partial<MapObjectDefinition>,
  presets: readonly ObjectPreset[],
): MapObjectRegistration {
  return {
    type,
    defaults,
    presets,
    validate: validateBaseObject,
    render: (definition, context) => renderObject(definition, context.gridSize),
  }
}

export function registerDungeonPropObjects(registry: MapObjectRegistry): void {
  registry.register(
    createRegistration('cargo-crane', cargoCranePreset.defaults, [cargoCranePreset]),
  )
  registry.register(
    createRegistration(
      'dungeon-prop',
      {
        width: 1,
        height: 1,
        color: 0x77736b,
        secondaryColor: 0x25221d,
        alpha: 1,
        layer: 'objectsStatic',
        tags: ['dungeon-prop'],
        variant: 'frog-idol',
      },
      dungeonPropPresets,
    ),
  )
}
