import type { MapObjectDefinition } from '@/map-objects'
import type { PlacedToken } from '@/types/tokens'
import { defineMap, type DoorDefinition, type MapDefinition, type WallDefinition } from './api'
import { floorArea } from './prefabs/common'

export const randomMapId = 'zufallskarte'

export type RandomMapFeature =
  | 'dark'
  | 'desert'
  | 'dungeon'
  | 'forest'
  | 'outdoor'
  | 'river'
  | 'ruins'
  | 'settlement'
  | 'ship'
  | 'snow'
  | 'swamp'
  | 'water'

export interface RandomMapFeatureOption {
  readonly id: RandomMapFeature
  readonly label: string
  readonly description: string
  readonly group: 'Ort' | 'Landschaft' | 'Elemente' | 'Atmosphäre'
}

export const randomMapFeatureOptions: readonly RandomMapFeatureOption[] = [
  { id: 'outdoor', label: 'Outdoor', description: 'Eine offene Landschaft.', group: 'Ort' },
  { id: 'dungeon', label: 'Dungeon', description: 'Räume und Gänge.', group: 'Ort' },
  { id: 'forest', label: 'Wald', description: 'Baumgruppen und Bewuchs.', group: 'Landschaft' },
  {
    id: 'snow',
    label: 'Schnee',
    description: 'Verschneiter oder vereister Boden.',
    group: 'Landschaft',
  },
  { id: 'swamp', label: 'Sumpf', description: 'Schlamm, Schilf und Nebel.', group: 'Landschaft' },
  {
    id: 'desert',
    label: 'Wüste',
    description: 'Sand und trockener Bewuchs.',
    group: 'Landschaft',
  },
  { id: 'ruins', label: 'Ruinen', description: 'Mauerreste und alte Steine.', group: 'Landschaft' },
  {
    id: 'settlement',
    label: 'Siedlung',
    description: 'Häuser, Felder und Wege.',
    group: 'Landschaft',
  },
  {
    id: 'river',
    label: 'Fluss',
    description: 'Ein Fluss durchquert die Karte.',
    group: 'Elemente',
  },
  { id: 'water', label: 'Wasser', description: 'Teich, See oder Wasserbecken.', group: 'Elemente' },
  {
    id: 'ship',
    label: 'Schiff',
    description: 'Ein Schiff oder Wrack im Wasser.',
    group: 'Elemente',
  },
  {
    id: 'dark',
    label: 'Dunkel',
    description: 'Nacht, Nebel und Lichtquellen.',
    group: 'Atmosphäre',
  },
] as const

export const normalizeRandomMapFeatures = (
  features: readonly RandomMapFeature[],
): readonly RandomMapFeature[] => {
  const normalized = new Set(features)
  if (normalized.has('river')) {
    normalized.add('water')
  }

  if (normalized.has('dungeon')) {
    normalized.delete('outdoor')
    normalized.delete('forest')
    normalized.delete('swamp')
    normalized.delete('desert')
    normalized.delete('settlement')
    normalized.delete('ship')
  } else if (
    normalized.has('forest') ||
    normalized.has('swamp') ||
    normalized.has('desert') ||
    normalized.has('settlement') ||
    normalized.has('ship')
  ) {
    normalized.add('outdoor')
  }

  if (normalized.has('ship')) {
    normalized.add('water')
  }

  return [...normalized]
}

interface RandomMapOptions {
  readonly dark: boolean
  readonly seed?: number
  readonly features?: readonly RandomMapFeature[]
}

type Rng = () => number

interface GenerationContext {
  readonly rng: Rng
  readonly seed: number
  readonly dark: boolean
  readonly features: ReadonlySet<RandomMapFeature>
  readonly width: number
  readonly height: number
  readonly objects: MapObjectDefinition[]
  readonly walls: WallDefinition[]
  readonly doors: DoorDefinition[]
  startPosition?: { readonly x: number; readonly y: number }
  storyLabel?: string
}

interface BuildingOptions {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly material: 'wood' | 'stone'
  readonly doorSide: 'north' | 'south' | 'east' | 'west'
}

type BaseGroundPreset =
  | 'meadow'
  | 'forest-floor'
  | 'dark-earth'
  | 'marsh'
  | 'packed-earth'
  | 'cave-ground'
  | 'loose-gravel'
  | 'stone-tiles'
  | 'mossy-stone'
  | 'wet-stone'
  | 'grave-dust'
  | 'sand'
  | 'snow'
  | 'muddy-ruts'
  | 'cobblestone'
  | 'burnt-ground'
  | 'leaf-litter'
  | 'field-stubble'
  | 'shallow-mud'

interface ObjectPlacementOption {
  readonly type: string
  readonly preset?: string
  readonly width?: number
  readonly height?: number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly minHeight?: number
  readonly maxHeight?: number
  readonly blocksMovement?: boolean
  readonly blocksSight?: boolean
  readonly layer?: MapObjectDefinition['layer']
}

interface DungeonRoom {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly centerX: number
  readonly centerY: number
}

interface DungeonDoorPlacement {
  readonly x: number
  readonly y: number
  readonly orientation: 'horizontal' | 'vertical'
  readonly type: 'wooden-door' | 'stone-door'
}

interface DungeonFloorRect {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly preset: BaseGroundPreset
}

type DungeonStyle = 'stone' | 'cave'

type StorySceneKind =
  | 'abandoned-caravan'
  | 'grave-site'
  | 'logging-site'
  | 'ritual-site'
  | 'spider-nest'
  | 'watch-camp'

type RandomMapBuilder = (context: GenerationContext) => void

interface RandomMapTemplate {
  readonly names: readonly string[]
  readonly suffixes?: {
    readonly light: readonly string[]
    readonly dark: readonly string[]
  }
  readonly traits: readonly RandomMapFeature[]
  readonly storyScenes?: readonly StorySceneKind[]
  readonly build: RandomMapBuilder
}

const lightNameSuffixes = [
  'bei Tageslicht',
  'im Morgenlicht',
  'am offenen Weg',
  'unter klarem Himmel',
  'zur Mittagsrast',
  'im warmen Licht',
] as const

const darkNameSuffixes = [
  'bei Nacht',
  'im Fackelschein',
  'unter kaltem Mond',
  'in der Daemmerung',
  'im Nebellicht',
  'bei flackernden Feuern',
] as const

const mulberry32 = (seed: number): Rng => {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff)

const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min

const between = (rng: Rng, min: number, max: number): number => min + (max - min) * rng()

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const chance = (rng: Rng, probability: number): boolean => rng() < probability

const pick = <TValue>(rng: Rng, values: readonly TValue[]): TValue =>
  values[Math.min(values.length - 1, Math.floor(rng() * values.length))] as TValue

const wallSegment = (
  id: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  blocksSight = true,
): WallDefinition => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  blocksSight,
  blocksMovement: true,
})

const object = (
  id: string,
  type: string,
  preset: string | undefined,
  x: number,
  y: number,
  width?: number,
  height?: number,
  overrides: Partial<MapObjectDefinition> = {},
): MapObjectDefinition => ({
  id,
  type,
  preset,
  position: { x, y },
  ...(width === undefined ? {} : { width }),
  ...(height === undefined ? {} : { height }),
  ...overrides,
})

const addFullMapLight = (context: GenerationContext): void => {
  if (context.dark) {
    return
  }

  context.objects.push(
    object(
      'generated-daylight',
      'daylight-area',
      'open-sunlight',
      0,
      0,
      context.width,
      context.height,
      {
        alpha: 0.08,
      },
    ),
  )
}

const addDarkLightSources = (context: GenerationContext, count: number): void => {
  if (!context.dark) {
    return
  }

  const lightOptions = [
    { type: 'campfire', preset: 'small-campfire' },
    { type: 'campfire', preset: 'smoldering-coals' },
    { type: 'torch', preset: 'green-witchlight' },
    { type: 'torch', preset: 'hooded-lantern' },
    { type: 'torch', preset: 'blue-crystal-torch' },
    { type: 'candle', preset: 'blue-ritual-candle' },
    { type: 'candle', preset: 'cold-moon-candle' },
    { type: 'hearth', preset: 'standing-brazier' },
  ] as const

  for (let index = 0; index < count; index += 1) {
    const x = between(context.rng, 4, context.width - 5)
    const y = between(context.rng, 4, context.height - 5)
    const option = pick(context.rng, lightOptions)
    context.objects.push(
      object(`generated-${option.type}-${index}`, option.type, option.preset, x, y),
    )
  }
}

const baseGroundPalettes: Record<
  BaseGroundPreset,
  {
    readonly light: { readonly color: number; readonly secondaryColor: number }
    readonly dark: { readonly color: number; readonly secondaryColor: number }
  }
> = {
  meadow: {
    light: { color: 0x66874a, secondaryColor: 0x213515 },
    dark: { color: 0x313827, secondaryColor: 0x11170f },
  },
  'forest-floor': {
    light: { color: 0x49613b, secondaryColor: 0x213515 },
    dark: { color: 0x263626, secondaryColor: 0x11170f },
  },
  'dark-earth': {
    light: { color: 0x5b4936, secondaryColor: 0x24180f },
    dark: { color: 0x30271f, secondaryColor: 0x120d09 },
  },
  marsh: {
    light: { color: 0x53623e, secondaryColor: 0x182514 },
    dark: { color: 0x293326, secondaryColor: 0x0e150d },
  },
  'packed-earth': {
    light: { color: 0x745d40, secondaryColor: 0x2f2118 },
    dark: { color: 0x473626, secondaryColor: 0x15100b },
  },
  'cave-ground': {
    light: { color: 0x5d5a52, secondaryColor: 0x1a1714 },
    dark: { color: 0x343330, secondaryColor: 0x11100e },
  },
  'loose-gravel': {
    light: { color: 0x6c675e, secondaryColor: 0x211e1a },
    dark: { color: 0x3d3c38, secondaryColor: 0x12110f },
  },
  'stone-tiles': {
    light: { color: 0x7b7a72, secondaryColor: 0x25231f },
    dark: { color: 0x42413d, secondaryColor: 0x14120f },
  },
  'mossy-stone': {
    light: { color: 0x68705d, secondaryColor: 0x25311d },
    dark: { color: 0x3c4538, secondaryColor: 0x11170f },
  },
  'wet-stone': {
    light: { color: 0x5e696b, secondaryColor: 0x1a2427 },
    dark: { color: 0x313b3e, secondaryColor: 0x0d1214 },
  },
  'grave-dust': {
    light: { color: 0x736d62, secondaryColor: 0x2a261f },
    dark: { color: 0x403b35, secondaryColor: 0x120f0c },
  },
  sand: {
    light: { color: 0xb69a62, secondaryColor: 0x765f38 },
    dark: { color: 0x665434, secondaryColor: 0x231a0e },
  },
  snow: {
    light: { color: 0xd1dce2, secondaryColor: 0x8ea1aa },
    dark: { color: 0x59656b, secondaryColor: 0x263039 },
  },
  'muddy-ruts': {
    light: { color: 0x6b5439, secondaryColor: 0x2a1b12 },
    dark: { color: 0x3d3226, secondaryColor: 0x130d09 },
  },
  cobblestone: {
    light: { color: 0x7c7a70, secondaryColor: 0x26231f },
    dark: { color: 0x45443f, secondaryColor: 0x151310 },
  },
  'burnt-ground': {
    light: { color: 0x3f372f, secondaryColor: 0x15100c },
    dark: { color: 0x2a2520, secondaryColor: 0x0c0907 },
  },
  'leaf-litter': {
    light: { color: 0x6b5435, secondaryColor: 0x2f2112 },
    dark: { color: 0x3c3022, secondaryColor: 0x130d08 },
  },
  'field-stubble': {
    light: { color: 0x8b7a42, secondaryColor: 0x3b3218 },
    dark: { color: 0x4b432a, secondaryColor: 0x171309 },
  },
  'shallow-mud': {
    light: { color: 0x46513a, secondaryColor: 0x172112 },
    dark: { color: 0x273023, secondaryColor: 0x0d130b },
  },
}

const addBaseGround = (context: GenerationContext, preset: BaseGroundPreset): void => {
  const selectedPreset = context.features.has('dungeon')
    ? preset
    : context.features.has('snow')
      ? 'snow'
      : context.features.has('desert')
        ? 'sand'
        : context.features.has('swamp')
          ? 'marsh'
          : preset
  const palette = baseGroundPalettes[selectedPreset][context.dark ? 'dark' : 'light']

  context.objects.push(
    floorArea('generated-ground-base', 0, 0, context.width, context.height, selectedPreset, {
      color: palette.color,
      secondaryColor: palette.secondaryColor,
    }),
  )
}

const wildSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'rock', preset: 'rubble-pile' },
  { type: 'rock', preset: 'standing-stone' },
  { type: 'rock', preset: 'sharp-scree' },
  { type: 'bush', preset: 'reed-clump' },
  { type: 'bush', preset: 'mushroom-cluster' },
  { type: 'thicket', preset: 'nettles', blocksMovement: false },
  { type: 'thicket', preset: 'reed-bed', blocksMovement: false },
  { type: 'wooden-barricade', preset: 'thorn-deadfall', blocksSight: false },
  { type: 'decoration', preset: 'mushroom-ring' },
  { type: 'forest-remains', preset: 'scattered-bones' },
  { type: 'forest-remains', preset: 'webbed-deer' },
]

const roadSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'decoration', preset: 'sack-pile' },
  { type: 'decoration', preset: 'road-sign' },
  { type: 'decoration', preset: 'plank-debris' },
  { type: 'wagon-wheel' },
  { type: 'crate', preset: 'small-crate' },
  { type: 'crate', preset: 'large-crate' },
  { type: 'barrel', preset: 'small-barrel' },
  { type: 'wooden-barricade', preset: 'broken-fence', blocksSight: false },
  { type: 'wooden-barricade', preset: 'split-rail-fence', blocksSight: false },
]

const farmSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'decoration', preset: 'farm-tools' },
  { type: 'decoration', preset: 'sack-pile' },
  { type: 'table', preset: 'market-stall' },
  { type: 'table', preset: 'workbench' },
  { type: 'chair', preset: 'simple-bench' },
  { type: 'chair', preset: 'wooden-stool' },
  { type: 'chair', preset: 'broken-chair' },
  { type: 'wooden-barricade', preset: 'split-rail-fence', blocksSight: false },
  { type: 'wooden-barricade', preset: 'broken-fence', blocksSight: false },
  { type: 'crate', preset: 'large-crate' },
  { type: 'barrel', preset: 'large-barrel' },
]

const ruinSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'decoration', preset: 'ritual-runes', blocksMovement: false },
  { type: 'decoration', preset: 'grave-marker' },
  { type: 'decoration', preset: 'plank-debris' },
  { type: 'rock', preset: 'rubble-pile', blocksMovement: false },
  { type: 'rock', preset: 'standing-stone' },
  { type: 'candle', preset: 'blue-ritual-candle' },
  { type: 'candle', preset: 'cold-moon-candle' },
  { type: 'hearth', preset: 'standing-brazier' },
  { type: 'trap' },
]

const dungeonSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'crate', preset: 'small-crate' },
  { type: 'crate', preset: 'large-crate' },
  { type: 'barrel', preset: 'small-barrel' },
  { type: 'table', preset: 'rough-table' },
  { type: 'table', preset: 'workbench' },
  { type: 'chair', preset: 'wooden-stool' },
  { type: 'chair', preset: 'broken-chair' },
  { type: 'column', preset: 'round-stone' },
  { type: 'altar' },
  { type: 'trap' },
  { type: 'decoration', preset: 'sack-pile' },
  { type: 'decoration', preset: 'plank-debris' },
  { type: 'decoration', preset: 'ritual-runes', blocksMovement: false },
  { type: 'decoration', preset: 'grave-marker' },
  { type: 'rock', preset: 'rubble-pile', blocksMovement: false },
  { type: 'candle', preset: 'short-candle' },
  { type: 'candle', preset: 'blue-ritual-candle' },
  { type: 'hearth', preset: 'standing-brazier' },
]

const caveSceneryPool: readonly ObjectPlacementOption[] = [
  { type: 'rock', preset: 'small-rock' },
  { type: 'rock', preset: 'mossy-boulder' },
  { type: 'rock', preset: 'rubble-pile', blocksMovement: false },
  { type: 'rock', preset: 'standing-stone' },
  { type: 'bush', preset: 'mushroom-cluster' },
  { type: 'decoration', preset: 'mushroom-ring' },
  { type: 'decoration', preset: 'ritual-runes', blocksMovement: false },
  { type: 'forest-remains', preset: 'scattered-bones' },
  { type: 'candle', preset: 'cold-moon-candle' },
  { type: 'torch', preset: 'green-witchlight' },
  { type: 'campfire', preset: 'smoldering-coals' },
]

const chooseObjectSize = (
  context: GenerationContext,
  option: ObjectPlacementOption,
): {
  readonly width?: number
  readonly height?: number
  readonly footprintWidth: number
  readonly footprintHeight: number
} => {
  const width =
    option.width ??
    (option.minWidth === undefined || option.maxWidth === undefined
      ? undefined
      : between(context.rng, option.minWidth, option.maxWidth))
  const height =
    option.height ??
    (option.minHeight === undefined || option.maxHeight === undefined
      ? undefined
      : between(context.rng, option.minHeight, option.maxHeight))

  return {
    width,
    height,
    footprintWidth: width ?? option.maxWidth ?? 1.8,
    footprintHeight: height ?? option.maxHeight ?? 1.5,
  }
}

const addTerrainPatches = (
  context: GenerationContext,
  prefix: string,
  presets: readonly BaseGroundPreset[],
  count: number,
): void => {
  for (let index = 0; index < count; index += 1) {
    const preset = pick(context.rng, presets)
    const width = between(context.rng, 3, 8.5)
    const height = between(context.rng, 2, 6)
    const palette = baseGroundPalettes[preset][context.dark ? 'dark' : 'light']
    context.objects.push(
      floorArea(
        `${prefix}-terrain-patch-${index}`,
        between(context.rng, 0.6, Math.max(0.6, context.width - width - 0.6)),
        between(context.rng, 0.6, Math.max(0.6, context.height - height - 0.6)),
        width,
        height,
        preset,
        {
          color: palette.color,
          secondaryColor: palette.secondaryColor,
          alpha: between(context.rng, context.dark ? 0.32 : 0.38, context.dark ? 0.56 : 0.64),
          rotation: between(context.rng, -0.28, 0.28),
        },
      ),
    )
  }
}

const addSceneryObjects = (
  context: GenerationContext,
  prefix: string,
  count: number,
  pool: readonly ObjectPlacementOption[],
): void => {
  for (let index = 0; index < count; index += 1) {
    const option = pick(context.rng, pool)
    const { width, height, footprintWidth, footprintHeight } = chooseObjectSize(context, option)
    const overrides: Partial<MapObjectDefinition> = {
      rotation: between(context.rng, -0.65, 0.65),
      ...(option.blocksMovement === undefined ? {} : { blocksMovement: option.blocksMovement }),
      ...(option.blocksSight === undefined ? {} : { blocksSight: option.blocksSight }),
      ...(option.layer === undefined ? {} : { layer: option.layer }),
    }

    context.objects.push(
      object(
        `${prefix}-${option.type}-${index}`,
        option.type,
        option.preset,
        between(context.rng, 1, Math.max(1, context.width - footprintWidth - 1)),
        between(context.rng, 1, Math.max(1, context.height - footprintHeight - 1)),
        width,
        height,
        overrides,
      ),
    )
  }
}

const addPathSegment = (
  context: GenerationContext,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): void => {
  context.objects.push(
    floorArea(id, x, y, width, height, 'dirt-path', {
      color: context.dark ? 0x5d4932 : 0x7b5f3e,
      secondaryColor: context.dark ? 0x21170f : 0x2d2116,
      alpha: context.dark ? 0.72 : 0.76,
      rotation,
    }),
  )
}

const addWindingVerticalRoad = (
  context: GenerationContext,
  idPrefix: string,
  centerX = context.width / 2,
  roadWidth = 6,
): number[] => {
  const segments = 6
  const sectionHeight = context.height / segments
  const centers: number[] = []
  let x = centerX + between(context.rng, -2, 2)

  for (let index = 0; index < segments; index += 1) {
    x = Math.max(
      roadWidth / 2 + 2,
      Math.min(context.width - roadWidth / 2 - 2, x + between(context.rng, -1.6, 1.6)),
    )
    centers.push(x)
    const y = Math.max(0, index * sectionHeight - 0.6)
    addPathSegment(
      context,
      `${idPrefix}-road-${index}`,
      x - roadWidth / 2,
      y,
      roadWidth,
      Math.min(sectionHeight + 1.6, context.height - y),
      between(context.rng, -0.06, 0.06),
    )
  }

  return centers
}

const addWindingHorizontalRoad = (
  context: GenerationContext,
  idPrefix: string,
  centerY = context.height / 2,
  roadWidth = 5.5,
): number[] => {
  const segments = 6
  const sectionWidth = context.width / segments
  const centers: number[] = []
  let y = centerY + between(context.rng, -1.8, 1.8)

  for (let index = 0; index < segments; index += 1) {
    y = Math.max(
      roadWidth / 2 + 2,
      Math.min(context.height - roadWidth / 2 - 2, y + between(context.rng, -1.5, 1.5)),
    )
    centers.push(y)
    const x = Math.max(0, index * sectionWidth - 0.6)
    addPathSegment(
      context,
      `${idPrefix}-road-${index}`,
      x,
      y - roadWidth / 2,
      Math.min(sectionWidth + 1.6, context.width - x),
      roadWidth,
      between(context.rng, -0.06, 0.06),
    )
  }

  return centers
}

const addHorizontalTrail = (
  context: GenerationContext,
  id: string,
  fromEdge: 'west' | 'east',
  y: number,
  endX: number,
): void => {
  const x = fromEdge === 'west' ? 0 : endX
  const width = fromEdge === 'west' ? endX : context.width - endX
  addPathSegment(
    context,
    id,
    x,
    y,
    width,
    between(context.rng, 1.3, 2),
    between(context.rng, -0.12, 0.12),
  )
}

const addVerticalTrail = (
  context: GenerationContext,
  id: string,
  fromEdge: 'north' | 'south',
  x: number,
  endY: number,
): void => {
  const y = fromEdge === 'north' ? 0 : endY
  const height = fromEdge === 'north' ? endY : context.height - endY
  addPathSegment(
    context,
    id,
    x,
    y,
    between(context.rng, 1.4, 2.1),
    height,
    between(context.rng, -0.12, 0.12),
  )
}

const addEdgeTrees = (context: GenerationContext, roadCenters: readonly number[]): void => {
  const presets = ['old-oak', 'pine-tree', 'birch-tree', 'autumn-maple'] as const
  const treeCount = Math.round((context.width * context.height) / 36)

  for (let index = 0; index < treeCount; index += 1) {
    const y = between(context.rng, 0.5, context.height - 2)
    const roadCenter =
      roadCenters[
        Math.min(roadCenters.length - 1, Math.floor((y / context.height) * roadCenters.length))
      ] ?? context.width / 2
    const side = chance(context.rng, 0.5) ? -1 : 1
    const minDistance = between(context.rng, 5.2, 8.8)
    const x =
      side < 0
        ? between(context.rng, 0.4, Math.max(1, roadCenter - minDistance))
        : between(
            context.rng,
            Math.min(context.width - 2, roadCenter + minDistance),
            context.width - 2,
          )

    if (x < 0.2 || x > context.width - 1.8) {
      continue
    }

    context.objects.push(
      object(`generated-tree-${index}`, 'tree', pick(context.rng, presets), x, y),
    )
  }
}

const createClusterCenters = (
  context: GenerationContext,
  count: number,
  margin: number,
): readonly { readonly x: number; readonly y: number }[] =>
  Array.from({ length: Math.max(1, count) }, () => ({
    x: between(context.rng, margin, Math.max(margin, context.width - margin)),
    y: between(context.rng, margin, Math.max(margin, context.height - margin)),
  }))

const clusteredPosition = (
  context: GenerationContext,
  centers: readonly { readonly x: number; readonly y: number }[],
  radius: number,
  footprintWidth = 1,
  footprintHeight = 1,
): { readonly x: number; readonly y: number } => {
  const center = pick(context.rng, centers)
  // The sum of two random offsets concentrates most objects near the cluster center while
  // still producing a soft, irregular edge instead of a visible circle.
  const offsetX = (context.rng() + context.rng() - 1) * radius
  const offsetY = (context.rng() + context.rng() - 1) * radius
  return {
    x: clamp(center.x + offsetX, 0.5, Math.max(0.5, context.width - footprintWidth - 0.5)),
    y: clamp(center.y + offsetY, 0.5, Math.max(0.5, context.height - footprintHeight - 0.5)),
  }
}

const addScatteredTrees = (context: GenerationContext, prefix: string, count: number): void => {
  const presets = ['old-oak', 'pine-tree', 'birch-tree', 'autumn-maple', 'dead-tree'] as const
  const centers = createClusterCenters(context, Math.ceil(count / 5), 4)
  for (let index = 0; index < count; index += 1) {
    const position = clusteredPosition(context, centers, 4.8, 1.6, 1.8)
    context.objects.push(
      object(`${prefix}-tree-${index}`, 'tree', pick(context.rng, presets), position.x, position.y),
    )
  }
}

const addThemedTreeClusters = (
  context: GenerationContext,
  prefix: string,
  count: number,
  presets: readonly string[],
  clusterCount = Math.ceil(count / 5),
): void => {
  const centers = createClusterCenters(context, clusterCount, 4)
  for (let index = 0; index < count; index += 1) {
    const position = clusteredPosition(context, centers, 4.5, 1.6, 1.8)
    context.objects.push(
      object(
        `${prefix}-tree-${index}`,
        'tree',
        pick(context.rng, presets),
        position.x,
        position.y,
        undefined,
        undefined,
        {
          rotation: between(context.rng, -0.18, 0.18),
        },
      ),
    )
  }
}

const addUndergrowth = (context: GenerationContext, count: number, prefix = 'generated'): void => {
  const bushPresets = ['leafy-bush', 'thorn-bush', 'berry-bush'] as const
  const thicketPresets = ['dense-bramble', 'dry-scrub'] as const
  const centers = createClusterCenters(context, Math.ceil(count / 7), 3)

  for (let index = 0; index < count; index += 1) {
    const useThicket = chance(context.rng, 0.35)
    const position = clusteredPosition(context, centers, 5.5, useThicket ? 1.7 : 0.9, 1.35)
    context.objects.push(
      object(
        `${prefix}-${useThicket ? 'thicket' : 'bush'}-${index}`,
        useThicket ? 'thicket' : 'bush',
        useThicket ? pick(context.rng, thicketPresets) : pick(context.rng, bushPresets),
        position.x,
        position.y,
        undefined,
        undefined,
        useThicket ? { blocksMovement: false } : {},
      ),
    )
  }
}

const addRocksAndCover = (context: GenerationContext, count: number): void => {
  const rockPresets = ['small-rock', 'mossy-boulder', 'large-boulder'] as const
  for (let index = 0; index < count; index += 1) {
    context.objects.push(
      object(
        `generated-rock-${index}`,
        'rock',
        pick(context.rng, rockPresets),
        between(context.rng, 1.5, context.width - 3),
        between(context.rng, 1.5, context.height - 3),
      ),
    )
  }
}

const addFallenLogsAndStumps = (
  context: GenerationContext,
  prefix: string,
  count: number,
): void => {
  for (let index = 0; index < count; index += 1) {
    const width = between(context.rng, 2.4, 5.4)
    const height = between(context.rng, 0.8, 1.6)
    context.objects.push(
      chance(context.rng, 0.55)
        ? object(
            `${prefix}-fallen-log-${index}`,
            'fallen-log',
            pick(context.rng, ['fallen-tree', 'raised-roots'] as const),
            between(context.rng, 2, Math.max(2, context.width - width - 1)),
            between(context.rng, 2, Math.max(2, context.height - height - 1)),
            width,
            height,
            {
              rotation: between(context.rng, -0.7, 0.7),
            },
          )
        : object(
            `${prefix}-tree-stump-${index}`,
            'tree-stump',
            undefined,
            between(context.rng, 2, context.width - 3),
            between(context.rng, 2, context.height - 3),
          ),
    )
  }
}

const addHillSlopes = (context: GenerationContext, prefix: string, count: number): void => {
  const presets = [
    'grassy-north-rise',
    'grassy-south-rise',
    'rocky-north-rise',
    'rocky-south-rise',
  ] as const
  for (let index = 0; index < count; index += 1) {
    context.objects.push(
      object(
        `${prefix}-hill-slope-${index}`,
        'hill-slope',
        pick(context.rng, presets),
        between(context.rng, 2, context.width - 8),
        between(context.rng, 2, context.height - 5),
        between(context.rng, 4.5, 8),
        between(context.rng, 2.2, 4.4),
        {
          rotation: between(context.rng, -0.35, 0.35),
          alpha: context.dark ? 0.82 : 0.92,
        },
      ),
    )
  }
}

const addAmbientFogPatches = (context: GenerationContext, prefix: string, count: number): void => {
  if (!context.dark) {
    return
  }

  for (let index = 0; index < count; index += 1) {
    const width = between(context.rng, 4, 8)
    const height = between(context.rng, 2.5, 5)
    context.objects.push(
      object(
        `${prefix}-ground-fog-${index}`,
        'fog',
        'ground-fog',
        between(context.rng, 1, Math.max(1, context.width - width - 1)),
        between(context.rng, 1, Math.max(1, context.height - height - 1)),
        width,
        height,
        {
          alpha: between(context.rng, 0.12, 0.24),
        },
      ),
    )
  }
}

const addFieldStrips = (
  context: GenerationContext,
  prefix: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const stripCount = intBetween(context.rng, 4, 7)
  const stripWidth = width / stripCount
  for (let index = 0; index < stripCount; index += 1) {
    context.objects.push(
      floorArea(
        `${prefix}-field-strip-${index}`,
        x + index * stripWidth,
        y,
        Math.max(0.4, stripWidth - 0.08),
        height,
        'field-stubble',
        {
          color: context.dark ? 0x4b432a : 0x8b7a42,
          secondaryColor: context.dark ? 0x171309 : 0x3b3218,
          alpha: index % 2 === 0 ? 0.58 : 0.42,
        },
      ),
    )
  }
}

const addFenceLine = (
  context: GenerationContext,
  prefix: string,
  x: number,
  y: number,
  length: number,
  vertical = false,
): void => {
  const segmentLength = 2
  const count = Math.max(1, Math.floor(length / segmentLength))
  for (let index = 0; index < count; index += 1) {
    const preset = chance(context.rng, 0.2) ? 'broken-fence' : 'split-rail-fence'
    context.objects.push(
      object(
        `${prefix}-fence-${index}`,
        'wooden-barricade',
        preset,
        vertical ? x : x + index * segmentLength,
        vertical ? y + index * segmentLength : y,
        vertical ? 0.28 : Math.min(segmentLength * 0.85, length - index * segmentLength),
        vertical ? Math.min(segmentLength * 0.85, length - index * segmentLength) : 0.28,
        {
          blocksSight: false,
        },
      ),
    )
  }
}

const addCampsite = (
  context: GenerationContext,
  prefix: string,
  x: number,
  y: number,
  lit = true,
): void => {
  context.objects.push(
    object(
      `${prefix}-campfire`,
      lit ? 'campfire' : 'decoration',
      lit ? 'small-campfire' : undefined,
      x,
      y,
      lit ? undefined : 1.1,
      lit ? undefined : 1.1,
      lit
        ? {}
        : {
            color: 0x3f352a,
            secondaryColor: 0x1d1712,
          },
    ),
    object(`${prefix}-crate`, 'crate', 'small-crate', Math.max(0.5, x - 2.1), y + 1.1),
    object(`${prefix}-barrel`, 'barrel', 'small-barrel', Math.min(context.width - 1.2, x + 2), y),
    object(
      `${prefix}-bedroll-a`,
      'decoration',
      undefined,
      Math.max(0.5, x - 2.6),
      Math.max(0.5, y - 1.8),
      1.5,
      0.7,
      {
        color: 0x53616a,
        secondaryColor: 0x1f2930,
        rotation: between(context.rng, -0.4, 0.4),
      },
    ),
    object(
      `${prefix}-bedroll-b`,
      'decoration',
      undefined,
      Math.min(context.width - 2, x + 1.7),
      Math.max(0.5, y - 2.0),
      1.5,
      0.7,
      {
        color: 0x6a5940,
        secondaryColor: 0x2d2418,
        rotation: between(context.rng, -0.4, 0.4),
      },
    ),
  )
}

const addSceneObject = (
  context: GenerationContext,
  id: string,
  type: string,
  preset: string | undefined,
  anchorX: number,
  anchorY: number,
  offsetX: number,
  offsetY: number,
  width?: number,
  height?: number,
  overrides: Partial<MapObjectDefinition> = {},
): void => {
  const footprintWidth = width ?? 1.8
  const footprintHeight = height ?? 1.8
  context.objects.push(
    object(
      id,
      type,
      preset,
      clamp(anchorX + offsetX, 0.5, Math.max(0.5, context.width - footprintWidth - 0.5)),
      clamp(anchorY + offsetY, 0.5, Math.max(0.5, context.height - footprintHeight - 0.5)),
      width,
      height,
      overrides,
    ),
  )
}

const addStoryScene = (
  context: GenerationContext,
  prefix: string,
  allowedScenes: readonly StorySceneKind[],
): void => {
  if (allowedScenes.length === 0) {
    return
  }

  const scene = pick(context.rng, allowedScenes)
  const anchors = [
    { x: context.width * 0.23, y: context.height * 0.24 },
    { x: context.width * 0.72, y: context.height * 0.25 },
    { x: context.width * 0.24, y: context.height * 0.72 },
    { x: context.width * 0.7, y: context.height * 0.7 },
  ] as const
  const anchor = pick(context.rng, anchors)
  const anchorX = anchor.x + between(context.rng, -1.5, 1.5)
  const anchorY = anchor.y + between(context.rng, -1.5, 1.5)

  if (scene === 'abandoned-caravan') {
    context.storyLabel = 'mit verlassenem Wagen'
    addSceneObject(
      context,
      `${prefix}-caravan-wagon`,
      'wagon',
      pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
      anchorX,
      anchorY,
      -1.6,
      -0.7,
      3.2,
      1.4,
      { blocksMovement: false, rotation: between(context.rng, -0.3, 0.3) },
    )
    addSceneObject(
      context,
      `${prefix}-caravan-harness`,
      'harness',
      'cut-harness',
      anchorX,
      anchorY,
      1.2,
      -0.4,
      1.5,
      0.9,
      { rotation: Math.PI / 2 + between(context.rng, -0.25, 0.25) },
    )
    addSceneObject(
      context,
      `${prefix}-caravan-wheel`,
      'wagon-wheel',
      undefined,
      anchorX,
      anchorY,
      -2.2,
      1.2,
    )
    addSceneObject(
      context,
      `${prefix}-caravan-crate`,
      'crate',
      'large-crate',
      anchorX,
      anchorY,
      1.3,
      1.1,
    )
    addSceneObject(
      context,
      `${prefix}-caravan-sacks`,
      'decoration',
      'sack-pile',
      anchorX,
      anchorY,
      2.4,
      0.5,
    )
    if (chance(context.rng, 0.55)) {
      addSceneObject(
        context,
        `${prefix}-caravan-bones`,
        'forest-remains',
        'scattered-bones',
        anchorX,
        anchorY,
        -0.3,
        1.8,
      )
    }
    return
  }

  if (scene === 'ritual-site') {
    context.storyLabel = 'am alten Ritualplatz'
    addSceneObject(
      context,
      `${prefix}-ritual-runes`,
      'decoration',
      'ritual-runes',
      anchorX,
      anchorY,
      -0.75,
      -0.75,
      1.5,
      1.5,
      { blocksMovement: false },
    )
    const stoneCount = intBetween(context.rng, 4, 6)
    for (let index = 0; index < stoneCount; index += 1) {
      const angle = (index / stoneCount) * Math.PI * 2 + between(context.rng, -0.12, 0.12)
      addSceneObject(
        context,
        `${prefix}-ritual-stone-${index}`,
        'rock',
        'standing-stone',
        anchorX,
        anchorY,
        Math.cos(angle) * between(context.rng, 2.1, 2.8),
        Math.sin(angle) * between(context.rng, 1.7, 2.3),
      )
    }
    addSceneObject(
      context,
      `${prefix}-ritual-light`,
      context.dark ? 'candle' : 'hearth',
      context.dark ? 'blue-ritual-candle' : 'standing-brazier',
      anchorX,
      anchorY,
      0.75,
      0.55,
    )
    return
  }

  if (scene === 'spider-nest') {
    context.storyLabel = 'unter dichten Spinnennetzen'
    addSceneObject(
      context,
      `${prefix}-spider-canopy`,
      'spider-web',
      'canopy-web',
      anchorX,
      anchorY,
      -2.3,
      -1.7,
      3,
      2.6,
    )
    addSceneObject(
      context,
      `${prefix}-spider-snare`,
      'spider-web',
      'road-snare',
      anchorX,
      anchorY,
      0.2,
      0.4,
      4,
      3,
    )
    addSceneObject(
      context,
      `${prefix}-spider-prey`,
      'forest-remains',
      'webbed-deer',
      anchorX,
      anchorY,
      -1.5,
      1.5,
    )
    addSceneObject(
      context,
      `${prefix}-spider-tree`,
      'tree',
      'dead-tree',
      anchorX,
      anchorY,
      2.8,
      -1.8,
    )
    return
  }

  if (scene === 'grave-site') {
    context.storyLabel = 'bei vergessenen Graebern'
    const graveCount = intBetween(context.rng, 4, 7)
    for (let index = 0; index < graveCount; index += 1) {
      addSceneObject(
        context,
        `${prefix}-grave-${index}`,
        'decoration',
        'grave-marker',
        anchorX,
        anchorY,
        (index % 3) * 1.35 - 1.5 + between(context.rng, -0.18, 0.18),
        Math.floor(index / 3) * 1.55 - 1 + between(context.rng, -0.18, 0.18),
        undefined,
        undefined,
        { rotation: between(context.rng, -0.18, 0.18) },
      )
    }
    addSceneObject(
      context,
      `${prefix}-grave-tree`,
      'tree',
      'dead-tree',
      anchorX,
      anchorY,
      2.5,
      -1.6,
    )
    return
  }

  if (scene === 'logging-site') {
    context.storyLabel = 'an einer alten Holzfaellerstelle'
    for (let index = 0; index < 3; index += 1) {
      addSceneObject(
        context,
        `${prefix}-logging-stump-${index}`,
        'tree-stump',
        undefined,
        anchorX,
        anchorY,
        between(context.rng, -2.5, 2.5),
        between(context.rng, -1.8, 1.8),
      )
    }
    addSceneObject(
      context,
      `${prefix}-logging-trunk`,
      'fallen-log',
      'fallen-tree',
      anchorX,
      anchorY,
      -2.2,
      1.8,
      4.2,
      1.2,
      { rotation: between(context.rng, -0.45, 0.45) },
    )
    addSceneObject(
      context,
      `${prefix}-logging-tools`,
      'decoration',
      'farm-tools',
      anchorX,
      anchorY,
      1.6,
      1.4,
    )
    return
  }

  context.storyLabel = 'bei einem befestigten Wachlager'
  addCampsite(
    context,
    `${prefix}-watch`,
    anchorX,
    anchorY,
    context.dark || chance(context.rng, 0.6),
  )
  addSceneObject(
    context,
    `${prefix}-watch-barricade-a`,
    'wooden-barricade',
    'rough-road-barricade',
    anchorX,
    anchorY,
    -4,
    -2.8,
    4.6,
    0.35,
    { blocksSight: false, rotation: between(context.rng, -0.2, 0.2) },
  )
  addSceneObject(
    context,
    `${prefix}-watch-barricade-b`,
    'wooden-barricade',
    'spiked-road-barricade',
    anchorX,
    anchorY,
    1.1,
    3,
    4.4,
    0.35,
    { blocksSight: false, rotation: between(context.rng, -0.2, 0.2) },
  )
  addSceneObject(context, `${prefix}-watch-trap`, 'trap', undefined, anchorX, anchorY, 3.3, -2.2)
}

const addRoadsideCargo = (context: GenerationContext, roadCenters: readonly number[]): void => {
  const center = roadCenters[Math.floor(roadCenters.length * 0.58)] ?? context.width / 2
  const y = context.height * 0.58
  context.objects.push(
    object('generated-road-wagon', 'wagon', 'loaded-farm-wagon-north', center - 1.1, y, 2.3, 3.3, {
      blocksMovement: false,
    }),
    object(
      'generated-road-horse-left',
      'draft-animal',
      'brown-draft-horse-north',
      center - 1.45,
      y - 2.1,
    ),
    object(
      'generated-road-horse-right',
      'draft-animal',
      'gray-draft-mule-north',
      center + 0.15,
      y - 2.1,
    ),
    object('generated-road-harness', 'harness', 'intact-harness', center - 1.25, y - 0.8, 2.2, 1.7),
  )

  if (chance(context.rng, 0.65)) {
    context.objects.push(
      object('generated-road-crate', 'crate', 'small-crate', center + 2.3, y + 1.1),
      object('generated-road-barrel', 'barrel', 'small-barrel', center - 2.4, y + 2.1),
    )
  }
}

const addBuilding = (context: GenerationContext, options: BuildingOptions): void => {
  const wallColor = options.material === 'wood' ? 0x6e4a31 : 0x68645c
  const wallSecondaryColor = options.material === 'wood' ? 0x21140d : 0x171512
  const wallPreset = options.material === 'wood' ? 'outer-wall' : 'crypt-wall'
  const floorPreset = options.material === 'wood' ? 'wood-planks' : 'stone-tiles'
  const wallThickness = 0.35
  const x2 = options.x + options.width
  const y2 = options.y + options.height
  const doorWidth = 1.5
  const doorX = options.x + options.width / 2 - doorWidth / 2
  const doorY = options.y + options.height / 2 - doorWidth / 2
  const wallOverrides = { color: wallColor, secondaryColor: wallSecondaryColor }

  context.objects.push(
    floorArea(
      `${options.id}-floor`,
      options.x + wallThickness,
      options.y + wallThickness,
      options.width - wallThickness * 2,
      options.height - wallThickness * 2,
      floorPreset,
      {
        alpha: 0.92,
      },
    ),
  )

  if (options.doorSide === 'north') {
    context.objects.push(
      object(
        `${options.id}-wall-north-left`,
        'stone-wall',
        wallPreset,
        options.x,
        options.y,
        doorX - options.x,
        wallThickness,
        wallOverrides,
      ),
      object(
        `${options.id}-wall-north-right`,
        'stone-wall',
        wallPreset,
        doorX + doorWidth,
        options.y,
        x2 - doorX - doorWidth,
        wallThickness,
        wallOverrides,
      ),
      object(
        `${options.id}-door`,
        'wooden-door',
        'closed-wooden-door',
        doorX,
        options.y - 0.02,
        doorWidth,
        0.25,
      ),
    )
    context.walls.push(
      wallSegment(`${options.id}-wall-north-left`, options.x, options.y, doorX, options.y),
      wallSegment(`${options.id}-wall-north-right`, doorX + doorWidth, options.y, x2, options.y),
    )
    context.doors.push({
      id: `${options.id}-door`,
      label: 'Holztuer',
      segment: { a: { x: doorX, y: options.y }, b: { x: doorX + doorWidth, y: options.y } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    })
  } else {
    context.objects.push(
      object(
        `${options.id}-wall-north`,
        'stone-wall',
        wallPreset,
        options.x,
        options.y,
        options.width,
        wallThickness,
        wallOverrides,
      ),
    )
    context.walls.push(wallSegment(`${options.id}-wall-north`, options.x, options.y, x2, options.y))
  }

  if (options.doorSide === 'south') {
    context.objects.push(
      object(
        `${options.id}-wall-south-left`,
        'stone-wall',
        wallPreset,
        options.x,
        y2 - wallThickness,
        doorX - options.x,
        wallThickness,
        wallOverrides,
      ),
      object(
        `${options.id}-wall-south-right`,
        'stone-wall',
        wallPreset,
        doorX + doorWidth,
        y2 - wallThickness,
        x2 - doorX - doorWidth,
        wallThickness,
        wallOverrides,
      ),
      object(
        `${options.id}-door`,
        'wooden-door',
        'closed-wooden-door',
        doorX,
        y2 - wallThickness / 2,
        doorWidth,
        0.25,
      ),
    )
    context.walls.push(
      wallSegment(`${options.id}-wall-south-left`, options.x, y2, doorX, y2),
      wallSegment(`${options.id}-wall-south-right`, doorX + doorWidth, y2, x2, y2),
    )
    context.doors.push({
      id: `${options.id}-door`,
      label: 'Holztuer',
      segment: { a: { x: doorX, y: y2 }, b: { x: doorX + doorWidth, y: y2 } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    })
  } else {
    context.objects.push(
      object(
        `${options.id}-wall-south`,
        'stone-wall',
        wallPreset,
        options.x,
        y2 - wallThickness,
        options.width,
        wallThickness,
        wallOverrides,
      ),
    )
    context.walls.push(wallSegment(`${options.id}-wall-south`, options.x, y2, x2, y2))
  }

  if (options.doorSide === 'west') {
    context.objects.push(
      object(
        `${options.id}-wall-west-top`,
        'stone-wall',
        wallPreset,
        options.x,
        options.y,
        wallThickness,
        doorY - options.y,
        wallOverrides,
      ),
      object(
        `${options.id}-wall-west-bottom`,
        'stone-wall',
        wallPreset,
        options.x,
        doorY + doorWidth,
        wallThickness,
        y2 - doorY - doorWidth,
        wallOverrides,
      ),
      object(
        `${options.id}-door`,
        'wooden-door',
        'closed-wooden-door',
        options.x - 0.02,
        doorY,
        doorWidth,
        0.25,
        {
          rotation: Math.PI / 2,
        },
      ),
    )
    context.walls.push(
      wallSegment(`${options.id}-wall-west-top`, options.x, options.y, options.x, doorY),
      wallSegment(`${options.id}-wall-west-bottom`, options.x, doorY + doorWidth, options.x, y2),
    )
    context.doors.push({
      id: `${options.id}-door`,
      label: 'Holztuer',
      segment: { a: { x: options.x, y: doorY }, b: { x: options.x, y: doorY + doorWidth } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    })
  } else {
    context.objects.push(
      object(
        `${options.id}-wall-west`,
        'stone-wall',
        wallPreset,
        options.x,
        options.y,
        wallThickness,
        options.height,
        wallOverrides,
      ),
    )
    context.walls.push(wallSegment(`${options.id}-wall-west`, options.x, options.y, options.x, y2))
  }

  if (options.doorSide === 'east') {
    context.objects.push(
      object(
        `${options.id}-wall-east-top`,
        'stone-wall',
        wallPreset,
        x2 - wallThickness,
        options.y,
        wallThickness,
        doorY - options.y,
        wallOverrides,
      ),
      object(
        `${options.id}-wall-east-bottom`,
        'stone-wall',
        wallPreset,
        x2 - wallThickness,
        doorY + doorWidth,
        wallThickness,
        y2 - doorY - doorWidth,
        wallOverrides,
      ),
      object(
        `${options.id}-door`,
        'wooden-door',
        'closed-wooden-door',
        x2 - wallThickness / 2,
        doorY,
        doorWidth,
        0.25,
        {
          rotation: Math.PI / 2,
        },
      ),
    )
    context.walls.push(
      wallSegment(`${options.id}-wall-east-top`, x2, options.y, x2, doorY),
      wallSegment(`${options.id}-wall-east-bottom`, x2, doorY + doorWidth, x2, y2),
    )
    context.doors.push({
      id: `${options.id}-door`,
      label: 'Holztuer',
      segment: { a: { x: x2, y: doorY }, b: { x: x2, y: doorY + doorWidth } },
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    })
  } else {
    context.objects.push(
      object(
        `${options.id}-wall-east`,
        'stone-wall',
        wallPreset,
        x2 - wallThickness,
        options.y,
        wallThickness,
        options.height,
        wallOverrides,
      ),
    )
    context.walls.push(wallSegment(`${options.id}-wall-east`, x2, options.y, x2, y2))
  }

  if (options.width >= 5 && options.height >= 5) {
    context.objects.push(
      object(
        `${options.id}-table`,
        'table',
        undefined,
        options.x + options.width * 0.36,
        options.y + options.height * 0.4,
        1.6,
        0.85,
      ),
      object(
        `${options.id}-crate`,
        'crate',
        'small-crate',
        options.x + options.width - 1.3,
        options.y + options.height - 1.3,
      ),
    )
  }

  if (context.dark) {
    const torchPosition =
      options.doorSide === 'north'
        ? { x: doorX - 0.7, y: options.y + 0.2, rotation: 0 }
        : options.doorSide === 'south'
          ? { x: doorX - 0.7, y: y2 - 1.0, rotation: Math.PI }
          : options.doorSide === 'east'
            ? { x: x2 - 0.9, y: doorY - 0.2, rotation: Math.PI / 2 }
            : { x: options.x + 0.2, y: doorY - 0.2, rotation: -Math.PI / 2 }
    context.objects.push(
      object(
        `${options.id}-door-torch`,
        'torch',
        'small-wall-torch',
        torchPosition.x,
        torchPosition.y,
        undefined,
        undefined,
        {
          rotation: torchPosition.rotation,
        },
      ),
    )
  }
}

const addRiver = (context: GenerationContext, y: number): void => {
  context.objects.push(
    floorArea('generated-river-north-bank', 0, Math.max(0, y - 1.1), context.width, 1.2, 'marsh', {
      color: context.dark ? 0x303b2c : 0x59633e,
      secondaryColor: 0x172112,
      alpha: 0.45,
    }),
    object('generated-river', 'river', 'slow-river', 0, y, context.width, 2.4),
    floorArea('generated-river-south-bank', 0, y + 2.2, context.width, 1.3, 'marsh', {
      color: context.dark ? 0x303b2c : 0x56613e,
      secondaryColor: 0x172112,
      alpha: 0.45,
    }),
    object(
      'generated-river-bridge',
      'bridge',
      'old-forest-bridge',
      context.width / 2 - 1.9,
      y - 0.65,
      3.8,
      4.2,
    ),
  )
  context.walls.push(
    wallSegment(
      'generated-river-west-blocker',
      0,
      y + 1.2,
      context.width / 2 - 2.0,
      y + 1.2,
      false,
    ),
    wallSegment(
      'generated-river-east-blocker',
      context.width / 2 + 2.0,
      y + 1.2,
      context.width,
      y + 1.2,
      false,
    ),
  )
}

const addVerticalRiver = (context: GenerationContext, x: number, bridgeY: number): void => {
  const riverWidth = between(context.rng, 2.2, 3.2)
  const bridgeGap = 2.2
  context.objects.push(
    floorArea('vertical-river-west-bank', Math.max(0, x - 1.1), 0, 1.2, context.height, 'marsh', {
      color: context.dark ? 0x303b2c : 0x59633e,
      secondaryColor: 0x172112,
      alpha: 0.45,
    }),
    object('vertical-river-water', 'river', 'slow-river', x, 0, riverWidth, context.height, {
      water: {
        direction: Math.PI / 2,
        speed: 0.12,
        intensity: 0.35,
        alpha: context.dark ? 0.68 : 0.76,
      },
    }),
    floorArea(
      'vertical-river-east-bank',
      Math.min(context.width - 1.2, x + riverWidth),
      0,
      1.2,
      context.height,
      'marsh',
      {
        color: context.dark ? 0x303b2c : 0x56613e,
        secondaryColor: 0x172112,
        alpha: 0.45,
      },
    ),
    object(
      'vertical-river-bridge',
      'bridge',
      'wooden-footbridge',
      x - 1.2,
      bridgeY - 1.8,
      riverWidth + 2.4,
      3.6,
    ),
  )

  const blockerX = x + riverWidth / 2
  context.walls.push(
    wallSegment('vertical-river-north-blocker', blockerX, 0, blockerX, bridgeY - bridgeGap, false),
    wallSegment(
      'vertical-river-south-blocker',
      blockerX,
      bridgeY + bridgeGap,
      blockerX,
      context.height,
      false,
    ),
  )
}

const addPond = (
  context: GenerationContext,
  prefix: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  context.objects.push(
    floorArea(
      `${prefix}-muddy-bank`,
      Math.max(0, x - 0.8),
      Math.max(0, y - 0.7),
      width + 1.6,
      height + 1.4,
      'marsh',
      {
        color: context.dark ? 0x2d3627 : 0x53603f,
        secondaryColor: 0x172112,
        alpha: 0.45,
      },
    ),
    object(`${prefix}-water`, 'water', 'standing-water', x, y, width, height, {
      water: {
        direction: 0,
        speed: 0.04,
        intensity: 0.22,
        alpha: context.dark ? 0.62 : 0.72,
      },
    }),
  )
}

const addSelectedFeatureLayers = (context: GenerationContext): void => {
  const hasObjectType = (type: string): boolean =>
    context.objects.some((entry) => entry.type === type)

  if (context.features.has('snow') && context.features.has('dungeon')) {
    addTerrainPatches(
      context,
      'selected-snow',
      ['snow', 'wet-stone'],
      intBetween(context.rng, 5, 8),
    )
  }

  if (context.features.has('forest')) {
    const existingTrees = context.objects.filter((entry) => entry.type === 'tree').length
    if (existingTrees < 12) {
      const presets = context.features.has('snow')
        ? (['pine-tree', 'dead-tree'] as const)
        : (['old-oak', 'pine-tree', 'birch-tree', 'autumn-maple'] as const)
      addThemedTreeClusters(
        context,
        'selected-forest',
        Math.max(12, Math.round((context.width * context.height) / 75)),
        presets,
        3,
      )
      addUndergrowth(context, Math.round((context.width * context.height) / 125), 'selected-forest')
    }
  }

  if (context.features.has('swamp')) {
    addTerrainPatches(
      context,
      'selected-swamp',
      ['marsh', 'shallow-mud', 'wet-stone'],
      intBetween(context.rng, 4, 7),
    )
    if (!hasObjectType('water') && !hasObjectType('river')) {
      addPond(
        context,
        'selected-swamp-pool',
        context.width * 0.12,
        context.height * 0.18,
        between(context.rng, 4.5, 7),
        between(context.rng, 3.2, 5),
      )
    }
    const reedPool: readonly ObjectPlacementOption[] = [
      { type: 'bush', preset: 'reed-clump' },
      { type: 'thicket', preset: 'reed-bed', blocksMovement: false },
    ]
    addSceneryObjects(context, 'selected-swamp-reeds', intBetween(context.rng, 8, 13), reedPool)
  }

  if (context.features.has('river') && !hasObjectType('river')) {
    if (context.features.has('dungeon')) {
      context.objects.push(
        object(
          'selected-underground-river',
          'river',
          'slow-river',
          2,
          context.height / 2 - 1.3,
          context.width - 4,
          2.6,
        ),
      )
    } else if (chance(context.rng, 0.5)) {
      addRiver(context, context.height * between(context.rng, 0.32, 0.68))
    } else {
      addVerticalRiver(
        context,
        context.width * between(context.rng, 0.32, 0.68),
        context.height * between(context.rng, 0.35, 0.65),
      )
    }
  }

  if (
    context.features.has('water') &&
    !context.features.has('ship') &&
    !hasObjectType('water') &&
    !hasObjectType('river')
  ) {
    addPond(
      context,
      'selected-water',
      context.width * 0.66,
      context.height * 0.18,
      between(context.rng, 5, 8),
      between(context.rng, 3.5, 5.5),
    )
  }

  if (context.features.has('ship')) {
    const coveWidth = between(context.rng, 11, 14)
    const coveHeight = between(context.rng, 7, 9)
    const coveX = clamp(
      context.width * between(context.rng, 0.16, 0.55),
      1.2,
      context.width - coveWidth - 1.2,
    )
    const coveY = clamp(
      context.height * between(context.rng, 0.16, 0.55),
      1.2,
      context.height - coveHeight - 1.2,
    )
    addPond(context, 'selected-ship-cove', coveX, coveY, coveWidth, coveHeight)
    context.objects.push(
      object(
        'selected-ship',
        'ship',
        chance(context.rng, 0.4) ? 'broken-river-ship' : 'weathered-sloop',
        coveX + (coveWidth - 7) / 2,
        coveY + (coveHeight - 3.2) / 2,
        7,
        3.2,
        { rotation: between(context.rng, -0.38, 0.38) },
      ),
    )
  }

  if (context.features.has('ruins')) {
    const alreadyRuined = context.objects.some(
      (entry) => entry.id?.startsWith('ruin-') || entry.id?.startsWith('cave-mouth-wall-'),
    )
    if (!alreadyRuined) {
      const ruinX = context.width * 0.68
      const ruinY = context.height * 0.68
      addSceneObject(
        context,
        'selected-ruin-wall-a',
        'stone-wall',
        'crypt-wall',
        ruinX,
        ruinY,
        -4,
        -2,
        5.5,
        0.35,
        { rotation: between(context.rng, -0.25, 0.25) },
      )
      addSceneObject(
        context,
        'selected-ruin-wall-b',
        'stone-wall',
        'crypt-wall',
        ruinX,
        ruinY,
        1.5,
        -2,
        0.35,
        4.8,
      )
      for (let index = 0; index < 3; index += 1) {
        addSceneObject(
          context,
          `selected-ruin-column-${index}`,
          'column',
          'round-stone',
          ruinX,
          ruinY,
          -2.5 + index * 2,
          between(context.rng, -0.5, 2.4),
        )
      }
      addSceneryObjects(
        context,
        'selected-ruin-rubble',
        intBetween(context.rng, 4, 7),
        ruinSceneryPool,
      )
    }
  }

  if (context.features.has('settlement')) {
    const alreadySettled = context.objects.some(
      (entry) => entry.id?.includes('building-') || entry.id === 'farm-house-floor',
    )
    if (!alreadySettled) {
      addBuilding(context, {
        id: 'selected-settlement-house',
        x: 2.5,
        y: 2.5,
        width: between(context.rng, 5, 7),
        height: between(context.rng, 5, 7),
        material: chance(context.rng, 0.7) ? 'wood' : 'stone',
        doorSide: pick(context.rng, ['south', 'east'] as const),
      })
    }
  }
}

const createDungeonTiles = (width: number, height: number): boolean[][] =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => false))

const isDungeonWalkable = (tiles: readonly boolean[][], x: number, y: number): boolean =>
  tiles[y]?.[x] === true

const carveDungeonRect = (
  tiles: boolean[][],
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const mapHeight = tiles.length
  const mapWidth = tiles[0]?.length ?? 0
  const left = clamp(Math.floor(x), 1, mapWidth - 2)
  const top = clamp(Math.floor(y), 1, mapHeight - 2)
  const right = clamp(Math.ceil(x + width), left + 1, mapWidth - 1)
  const bottom = clamp(Math.ceil(y + height), top + 1, mapHeight - 1)

  for (let tileY = top; tileY < bottom; tileY += 1) {
    const row = tiles[tileY]
    if (!row) {
      continue
    }
    for (let tileX = left; tileX < right; tileX += 1) {
      row[tileX] = true
    }
  }
}

const addDungeonFloorArea = (
  context: GenerationContext,
  rect: DungeonFloorRect,
  alpha: number,
): void => {
  const palette = baseGroundPalettes[rect.preset][context.dark ? 'dark' : 'light']
  context.objects.push(
    floorArea(rect.id, rect.x, rect.y, rect.width, rect.height, rect.preset, {
      color: palette.color,
      secondaryColor: palette.secondaryColor,
      alpha,
    }),
  )
}

const createDungeonRooms = (context: GenerationContext): DungeonRoom[] => {
  const columns = context.width >= 38 ? 4 : 3
  const rows = context.height >= 34 ? 4 : 3
  const margin = 2
  const cellWidth = (context.width - margin * 2) / columns
  const cellHeight = (context.height - margin * 2) / rows
  const cells: Array<{ readonly column: number; readonly row: number }> = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({ column, row })
    }
  }

  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = intBetween(context.rng, 0, index)
    const current = cells[index]
    cells[index] = cells[swapIndex] as { readonly column: number; readonly row: number }
    cells[swapIndex] = current as { readonly column: number; readonly row: number }
  }

  const maxRoomCount = Math.min(12, cells.length)
  const targetRoomCount = intBetween(context.rng, Math.min(7, maxRoomCount), maxRoomCount)
  const rooms: DungeonRoom[] = []

  for (const cell of cells.slice(0, targetRoomCount)) {
    const cellLeft = margin + cell.column * cellWidth
    const cellTop = margin + cell.row * cellHeight
    const cellRight = margin + (cell.column + 1) * cellWidth
    const cellBottom = margin + (cell.row + 1) * cellHeight
    const maxRoomWidth = Math.max(4, Math.min(8, Math.floor(cellWidth - 2)))
    const maxRoomHeight = Math.max(4, Math.min(7, Math.floor(cellHeight - 2)))
    const width = intBetween(context.rng, 4, maxRoomWidth)
    const height = intBetween(context.rng, 4, maxRoomHeight)
    const xMin = Math.ceil(cellLeft + 1)
    const yMin = Math.ceil(cellTop + 1)
    const xMax = Math.floor(cellRight - width - 1)
    const yMax = Math.floor(cellBottom - height - 1)
    const x = clamp(
      xMax >= xMin ? intBetween(context.rng, xMin, xMax) : xMin,
      1,
      context.width - width - 1,
    )
    const y = clamp(
      yMax >= yMin ? intBetween(context.rng, yMin, yMax) : yMin,
      1,
      context.height - height - 1,
    )

    rooms.push({
      id: `room-${rooms.length}`,
      x,
      y,
      width,
      height,
      centerX: x + Math.floor(width / 2),
      centerY: y + Math.floor(height / 2),
    })
  }

  return rooms
}

const orderDungeonRooms = (rooms: readonly DungeonRoom[]): DungeonRoom[] => {
  const remaining = [...rooms]
  const startIndex = remaining.reduce(
    (bestIndex, room, index) => (room.centerY > remaining[bestIndex]!.centerY ? index : bestIndex),
    0,
  )
  const ordered = [remaining.splice(startIndex, 1)[0] as DungeonRoom]

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1] as DungeonRoom
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < remaining.length; index += 1) {
      const room = remaining[index] as DungeonRoom
      const distance = (room.centerX - current.centerX) ** 2 + (room.centerY - current.centerY) ** 2
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }
    ordered.push(remaining.splice(nearestIndex, 1)[0] as DungeonRoom)
  }

  return ordered
}

const addDungeonCorridorRect = (
  tiles: boolean[][],
  rects: DungeonFloorRect[],
  rect: DungeonFloorRect,
): void => {
  carveDungeonRect(tiles, rect.x, rect.y, rect.width, rect.height)
  rects.push(rect)
}

const addDungeonHorizontalCorridor = (
  context: GenerationContext,
  tiles: boolean[][],
  rects: DungeonFloorRect[],
  id: string,
  xA: number,
  xB: number,
  y: number,
  corridorWidth: number,
  style: DungeonStyle,
): void => {
  const left = Math.min(xA, xB)
  const right = Math.max(xA, xB)
  const top = clamp(y - Math.floor(corridorWidth / 2), 1, context.height - corridorWidth - 1)
  addDungeonCorridorRect(tiles, rects, {
    id,
    x: left,
    y: top,
    width: right - left + 1,
    height: corridorWidth,
    preset: style === 'stone' ? 'stone-tiles' : pick(context.rng, ['cave-ground', 'wet-stone']),
  })
}

const addDungeonVerticalCorridor = (
  context: GenerationContext,
  tiles: boolean[][],
  rects: DungeonFloorRect[],
  id: string,
  x: number,
  yA: number,
  yB: number,
  corridorWidth: number,
  style: DungeonStyle,
): void => {
  const top = Math.min(yA, yB)
  const bottom = Math.max(yA, yB)
  const left = clamp(x - Math.floor(corridorWidth / 2), 1, context.width - corridorWidth - 1)
  addDungeonCorridorRect(tiles, rects, {
    id,
    x: left,
    y: top,
    width: corridorWidth,
    height: bottom - top + 1,
    preset: style === 'stone' ? 'stone-tiles' : pick(context.rng, ['cave-ground', 'loose-gravel']),
  })
}

const addDungeonDoorForConnection = (
  context: GenerationContext,
  fromRoom: DungeonRoom,
  toRoom: DungeonRoom,
  horizontalFirst: boolean,
  placements: DungeonDoorPlacement[],
  usedDoorKeys: Set<string>,
  style: DungeonStyle,
): void => {
  const xDelta = toRoom.centerX - fromRoom.centerX
  const yDelta = toRoom.centerY - fromRoom.centerY
  const useVerticalDoor = (horizontalFirst && xDelta !== 0) || yDelta === 0
  const type: DungeonDoorPlacement['type'] =
    style === 'stone' && chance(context.rng, 0.68) ? 'wooden-door' : 'stone-door'

  const placement = useVerticalDoor
    ? {
        x: xDelta >= 0 ? fromRoom.x + fromRoom.width : fromRoom.x,
        y: clamp(fromRoom.centerY - 1, fromRoom.y, fromRoom.y + fromRoom.height - 2),
        orientation: 'vertical' as const,
        type,
      }
    : {
        x: clamp(fromRoom.centerX - 1, fromRoom.x, fromRoom.x + fromRoom.width - 2),
        y: yDelta >= 0 ? fromRoom.y + fromRoom.height : fromRoom.y,
        orientation: 'horizontal' as const,
        type,
      }
  const key = `${placement.orientation}:${placement.x}:${placement.y}`
  if (usedDoorKeys.has(key)) {
    return
  }

  usedDoorKeys.add(key)
  placements.push(placement)
}

const connectDungeonRooms = (
  context: GenerationContext,
  tiles: boolean[][],
  rects: DungeonFloorRect[],
  rooms: readonly DungeonRoom[],
  style: DungeonStyle,
): DungeonDoorPlacement[] => {
  const orderedRooms = orderDungeonRooms(rooms)
  const placements: DungeonDoorPlacement[] = []
  const usedDoorKeys = new Set<string>()
  const connectedPairs = new Set<string>()

  const connect = (
    fromRoom: DungeonRoom,
    toRoom: DungeonRoom,
    index: number,
    loop = false,
  ): void => {
    const horizontalFirst = chance(context.rng, 0.5)
    const corridorWidth = style === 'cave' && chance(context.rng, 0.35) ? 3 : 2
    const pairKey = [fromRoom.id, toRoom.id].sort().join(':')
    connectedPairs.add(pairKey)

    if (!loop || chance(context.rng, 0.45)) {
      addDungeonDoorForConnection(
        context,
        fromRoom,
        toRoom,
        horizontalFirst,
        placements,
        usedDoorKeys,
        style,
      )
    }

    if (horizontalFirst) {
      addDungeonHorizontalCorridor(
        context,
        tiles,
        rects,
        `dungeon-corridor-${index}-a`,
        fromRoom.centerX,
        toRoom.centerX,
        fromRoom.centerY,
        corridorWidth,
        style,
      )
      addDungeonVerticalCorridor(
        context,
        tiles,
        rects,
        `dungeon-corridor-${index}-b`,
        toRoom.centerX,
        fromRoom.centerY,
        toRoom.centerY,
        corridorWidth,
        style,
      )
    } else {
      addDungeonVerticalCorridor(
        context,
        tiles,
        rects,
        `dungeon-corridor-${index}-a`,
        fromRoom.centerX,
        fromRoom.centerY,
        toRoom.centerY,
        corridorWidth,
        style,
      )
      addDungeonHorizontalCorridor(
        context,
        tiles,
        rects,
        `dungeon-corridor-${index}-b`,
        fromRoom.centerX,
        toRoom.centerX,
        toRoom.centerY,
        corridorWidth,
        style,
      )
    }
  }

  for (let index = 1; index < orderedRooms.length; index += 1) {
    connect(orderedRooms[index - 1] as DungeonRoom, orderedRooms[index] as DungeonRoom, index)
  }

  const loopCount = intBetween(context.rng, 1, 3)
  for (let index = 0; index < loopCount; index += 1) {
    const fromRoom = pick(context.rng, orderedRooms)
    const toRoom = pick(context.rng, orderedRooms)
    if (fromRoom.id === toRoom.id) {
      continue
    }
    const pairKey = [fromRoom.id, toRoom.id].sort().join(':')
    if (connectedPairs.has(pairKey)) {
      continue
    }
    connect(fromRoom, toRoom, orderedRooms.length + index, true)
  }

  return placements
}

const addDungeonBoundaryWalls = (
  context: GenerationContext,
  tiles: readonly boolean[][],
  style: DungeonStyle,
): void => {
  const wallThickness = 0.35
  const wallPreset = style === 'stone' ? 'crypt-wall' : 'outer-wall'
  const wallOverrides =
    style === 'stone'
      ? {
          color: context.dark ? 0x4f4a43 : 0x776f66,
          secondaryColor: context.dark ? 0x100c09 : 0x15100d,
        }
      : {
          color: context.dark ? 0x373833 : 0x57564f,
          secondaryColor: context.dark ? 0x0d0c0a : 0x171512,
        }
  let wallIndex = 0

  const addHorizontalWall = (startX: number, endX: number, y: number, openBelow: boolean): void => {
    if (endX <= startX) {
      return
    }
    const id = `dungeon-wall-h-${wallIndex}`
    wallIndex += 1
    context.walls.push(wallSegment(id, startX, y, endX, y))
    context.objects.push(
      object(
        id,
        'stone-wall',
        wallPreset,
        startX,
        clamp(openBelow ? y : y - wallThickness, 0, context.height - wallThickness),
        endX - startX,
        wallThickness,
        wallOverrides,
      ),
    )
  }

  const addVerticalWall = (x: number, startY: number, endY: number, openRight: boolean): void => {
    if (endY <= startY) {
      return
    }
    const id = `dungeon-wall-v-${wallIndex}`
    wallIndex += 1
    context.walls.push(wallSegment(id, x, startY, x, endY))
    context.objects.push(
      object(
        id,
        'stone-wall',
        wallPreset,
        clamp(openRight ? x : x - wallThickness, 0, context.width - wallThickness),
        startY,
        wallThickness,
        endY - startY,
        wallOverrides,
      ),
    )
  }

  for (let y = 0; y <= context.height; y += 1) {
    let x = 0
    while (x < context.width) {
      const openAbove = y > 0 && isDungeonWalkable(tiles, x, y - 1)
      const openBelow = y < context.height && isDungeonWalkable(tiles, x, y)
      const edgeKind = openBelow && !openAbove ? 'below' : openAbove && !openBelow ? 'above' : null
      if (!edgeKind) {
        x += 1
        continue
      }
      const startX = x
      x += 1
      while (x < context.width) {
        const nextOpenAbove = y > 0 && isDungeonWalkable(tiles, x, y - 1)
        const nextOpenBelow = y < context.height && isDungeonWalkable(tiles, x, y)
        const nextEdgeKind =
          nextOpenBelow && !nextOpenAbove
            ? 'below'
            : nextOpenAbove && !nextOpenBelow
              ? 'above'
              : null
        if (nextEdgeKind !== edgeKind) {
          break
        }
        x += 1
      }
      addHorizontalWall(startX, x, y, edgeKind === 'below')
    }
  }

  for (let x = 0; x <= context.width; x += 1) {
    let y = 0
    while (y < context.height) {
      const openLeft = x > 0 && isDungeonWalkable(tiles, x - 1, y)
      const openRight = x < context.width && isDungeonWalkable(tiles, x, y)
      const edgeKind = openRight && !openLeft ? 'right' : openLeft && !openRight ? 'left' : null
      if (!edgeKind) {
        y += 1
        continue
      }
      const startY = y
      y += 1
      while (y < context.height) {
        const nextOpenLeft = x > 0 && isDungeonWalkable(tiles, x - 1, y)
        const nextOpenRight = x < context.width && isDungeonWalkable(tiles, x, y)
        const nextEdgeKind =
          nextOpenRight && !nextOpenLeft ? 'right' : nextOpenLeft && !nextOpenRight ? 'left' : null
        if (nextEdgeKind !== edgeKind) {
          break
        }
        y += 1
      }
      addVerticalWall(x, startY, y, edgeKind === 'right')
    }
  }
}

const addDungeonDoors = (
  context: GenerationContext,
  prefix: string,
  placements: readonly DungeonDoorPlacement[],
): void => {
  const doorWidth = 2
  for (const [index, placement] of placements.entries()) {
    const id = `${prefix}-door-${index}`
    const isVertical = placement.orientation === 'vertical'
    const x = isVertical
      ? clamp(placement.x - 0.12, 0, context.width - 0.3)
      : clamp(placement.x, 0, context.width - doorWidth)
    const y = isVertical
      ? clamp(placement.y, 0, context.height - doorWidth)
      : clamp(placement.y - 0.12, 0, context.height - 0.3)
    const segment = isVertical
      ? {
          a: { x: placement.x, y: placement.y },
          b: { x: placement.x, y: placement.y + doorWidth },
        }
      : {
          a: { x: placement.x, y: placement.y },
          b: { x: placement.x + doorWidth, y: placement.y },
        }

    context.objects.push(
      object(
        id,
        placement.type,
        placement.type === 'wooden-door' ? 'closed-wooden-door' : 'closed-stone-door',
        x,
        y,
        doorWidth,
        placement.type === 'wooden-door' ? 0.25 : 0.3,
        {
          rotation: isVertical ? Math.PI / 2 : 0,
          interactionState: 'closed',
        },
      ),
    )
    context.doors.push({
      id,
      label: placement.type === 'wooden-door' ? 'Holztuer' : 'Steintuer',
      segment,
      defaultState: 'closed',
      blocksSightWhenClosed: true,
      blocksMovementWhenClosed: true,
    })
  }
}

const addDungeonRoomScenery = (
  context: GenerationContext,
  prefix: string,
  rooms: readonly DungeonRoom[],
  pool: readonly ObjectPlacementOption[],
  style: DungeonStyle,
): void => {
  let objectIndex = 0
  for (const room of rooms) {
    const roomArea = room.width * room.height
    const objectCount = intBetween(context.rng, roomArea >= 36 ? 2 : 1, roomArea >= 36 ? 4 : 2)
    for (let index = 0; index < objectCount; index += 1) {
      if (roomArea < 24 && chance(context.rng, 0.45)) {
        continue
      }
      const option = pick(context.rng, pool)
      const { width, height, footprintWidth, footprintHeight } = chooseObjectSize(context, option)
      const minX = room.x + 0.6
      const minY = room.y + 0.6
      const maxX = room.x + room.width - footprintWidth - 0.6
      const maxY = room.y + room.height - footprintHeight - 0.6
      context.objects.push(
        object(
          `${prefix}-${option.type}-${objectIndex}`,
          option.type,
          option.preset,
          between(context.rng, minX, Math.max(minX, maxX)),
          between(context.rng, minY, Math.max(minY, maxY)),
          width,
          height,
          {
            rotation: between(context.rng, -0.45, 0.45),
            ...(style === 'cave' && option.type === 'rock' ? { blocksSight: false } : {}),
            ...(option.blocksMovement === undefined
              ? {}
              : { blocksMovement: option.blocksMovement }),
            ...(option.blocksSight === undefined ? {} : { blocksSight: option.blocksSight }),
          },
        ),
      )
      objectIndex += 1
    }
  }
}

const addDungeonRoomLights = (
  context: GenerationContext,
  prefix: string,
  rooms: readonly DungeonRoom[],
  style: DungeonStyle,
  count: number,
): void => {
  if (!context.dark) {
    return
  }

  const lightOptions: readonly { readonly type: string; readonly preset: string }[] =
    style === 'stone'
      ? [
          { type: 'torch', preset: 'hooded-lantern' },
          { type: 'torch', preset: 'small-wall-torch' },
          { type: 'candle', preset: 'short-candle' },
          { type: 'hearth', preset: 'standing-brazier' },
        ]
      : [
          { type: 'torch', preset: 'green-witchlight' },
          { type: 'torch', preset: 'blue-crystal-torch' },
          { type: 'candle', preset: 'cold-moon-candle' },
          { type: 'campfire', preset: 'smoldering-coals' },
        ]

  for (let index = 0; index < count; index += 1) {
    const room = pick(context.rng, rooms)
    const option = pick(context.rng, lightOptions)
    context.objects.push(
      object(
        `${prefix}-light-${index}`,
        option.type,
        option.preset,
        between(context.rng, room.x + 0.8, Math.max(room.x + 0.8, room.x + room.width - 1.4)),
        between(context.rng, room.y + 0.8, Math.max(room.y + 0.8, room.y + room.height - 1.4)),
        undefined,
        undefined,
        {
          rotation: between(context.rng, -0.35, 0.35),
        },
      ),
    )
  }
}

const addDungeonWaterFeatures = (
  context: GenerationContext,
  prefix: string,
  rooms: readonly DungeonRoom[],
): void => {
  const eligibleRooms = rooms.filter((room) => room.width >= 6 && room.height >= 5)
  const count = Math.min(eligibleRooms.length, intBetween(context.rng, 1, 2))

  for (let index = 0; index < count; index += 1) {
    const room = pick(context.rng, eligibleRooms)
    const width = between(context.rng, 2.2, Math.min(4.2, room.width - 1.4))
    const height = between(context.rng, 1.8, Math.min(3.2, room.height - 1.3))
    addPond(
      context,
      `${prefix}-pool-${index}`,
      between(context.rng, room.x + 0.7, Math.max(room.x + 0.7, room.x + room.width - width - 0.7)),
      between(
        context.rng,
        room.y + 0.7,
        Math.max(room.y + 0.7, room.y + room.height - height - 0.7),
      ),
      width,
      height,
    )
  }
}

const buildDungeonLayout = (
  context: GenerationContext,
  prefix: string,
  style: DungeonStyle,
): void => {
  addBaseGround(context, style === 'stone' ? 'dark-earth' : 'cave-ground')
  const tiles = createDungeonTiles(context.width, context.height)
  const rooms = createDungeonRooms(context)
  const corridorRects: DungeonFloorRect[] = []
  const roomFloorPresets =
    style === 'stone'
      ? (['stone-tiles', 'mossy-stone', 'grave-dust'] as const)
      : (['cave-ground', 'wet-stone', 'loose-gravel'] as const)

  for (const room of rooms) {
    const preset = pick(context.rng, roomFloorPresets)
    carveDungeonRect(tiles, room.x, room.y, room.width, room.height)
    addDungeonFloorArea(
      context,
      {
        id: `${prefix}-${room.id}-floor`,
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        preset,
      },
      0.94,
    )
  }

  const doorPlacements = connectDungeonRooms(context, tiles, corridorRects, rooms, style)
  for (const rect of corridorRects) {
    addDungeonFloorArea(context, rect, style === 'stone' ? 0.88 : 0.84)
  }

  addDungeonBoundaryWalls(context, tiles, style)
  addDungeonDoors(context, prefix, doorPlacements)
  if (style === 'cave' && chance(context.rng, 0.68)) {
    addDungeonWaterFeatures(context, prefix, rooms)
  }
  addDungeonRoomScenery(
    context,
    `${prefix}-room-clutter`,
    rooms,
    style === 'stone' ? dungeonSceneryPool : caveSceneryPool,
    style,
  )
  addAmbientFogPatches(context, prefix, intBetween(context.rng, style === 'stone' ? 1 : 2, 4))
  addFullMapLight(context)
  addDungeonRoomLights(context, prefix, rooms, style, intBetween(context.rng, 4, 7))

  const startRoom = rooms.reduce(
    (best, room) => (room.centerY > best.centerY ? room : best),
    rooms[0]!,
  )
  context.startPosition = { x: startRoom.centerX + 0.5, y: startRoom.centerY + 0.5 }
}

const buildDungeonHalls = (context: GenerationContext): void => {
  buildDungeonLayout(context, 'dungeon-halls', 'stone')
}

const buildCaveLabyrinth = (context: GenerationContext): void => {
  buildDungeonLayout(context, 'cave-labyrinth', 'cave')
}

const buildForestRoad = (context: GenerationContext): void => {
  addBaseGround(context, 'forest-floor')
  addTerrainPatches(
    context,
    'forest',
    ['leaf-litter', 'muddy-ruts', 'burnt-ground'],
    intBetween(context.rng, 4, 8),
  )
  const roadCenters = addWindingVerticalRoad(context, 'forest', context.width / 2, 5.6)
  addHorizontalTrail(
    context,
    'forest-west-escape-trail',
    'west',
    context.height * 0.35,
    roadCenters[2] ?? context.width / 2,
  )
  addHorizontalTrail(
    context,
    'forest-east-escape-trail',
    'east',
    context.height * 0.64,
    roadCenters[3] ?? context.width / 2,
  )
  if (chance(context.rng, 0.58)) {
    addRiver(context, between(context.rng, context.height * 0.35, context.height * 0.55))
  } else if (chance(context.rng, 0.45)) {
    addPond(
      context,
      'forest-hidden-pond',
      between(context.rng, 3, context.width * 0.38),
      between(context.rng, context.height * 0.18, context.height * 0.62),
      between(context.rng, 3.2, 5.5),
      between(context.rng, 2.4, 4.2),
    )
  }
  if (chance(context.rng, 0.62)) {
    addRoadsideCargo(context, roadCenters)
  } else {
    addCampsite(
      context,
      'forest-waycamp',
      between(context.rng, context.width * 0.55, context.width - 5),
      between(context.rng, context.height * 0.45, context.height - 5),
      context.dark || chance(context.rng, 0.45),
    )
  }
  if (chance(context.rng, 0.36)) {
    context.objects.push(
      object(
        'forest-canopy-web-a',
        'spider-web',
        'canopy-web',
        between(context.rng, context.width * 0.58, context.width - 5),
        between(context.rng, 3, context.height * 0.48),
      ),
      object(
        'forest-tree-web-b',
        'spider-web',
        'tree-web',
        between(context.rng, 2, context.width * 0.38),
        between(context.rng, context.height * 0.5, context.height - 5),
      ),
    )
  }
  addFallenLogsAndStumps(context, 'forest', intBetween(context.rng, 3, 7))
  addHillSlopes(context, 'forest', intBetween(context.rng, 1, 3))
  addEdgeTrees(context, roadCenters)
  addUndergrowth(context, Math.round((context.width * context.height) / 55))
  addRocksAndCover(context, intBetween(context.rng, 5, 10))
  addSceneryObjects(context, 'forest-wild-clutter', intBetween(context.rng, 4, 8), wildSceneryPool)
  addSceneryObjects(context, 'forest-road-clutter', intBetween(context.rng, 2, 5), roadSceneryPool)
  addAmbientFogPatches(context, 'forest', intBetween(context.rng, 1, 3))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildRoadsideHamlet = (context: GenerationContext): void => {
  addBaseGround(context, 'meadow')
  addTerrainPatches(
    context,
    'hamlet',
    ['field-stubble', 'cobblestone', 'muddy-ruts'],
    intBetween(context.rng, 4, 7),
  )
  const roadCenters = addWindingVerticalRoad(context, 'hamlet', context.width / 2, 6.2)
  addHorizontalTrail(
    context,
    'hamlet-west-lane',
    'west',
    context.height * 0.5,
    context.width / 2 - 2,
  )
  addHorizontalTrail(
    context,
    'hamlet-east-lane',
    'east',
    context.height * 0.42,
    context.width / 2 + 1,
  )

  const buildingCount = intBetween(context.rng, 2, 4)
  for (let index = 0; index < buildingCount; index += 1) {
    const side = index % 2 === 0 ? 'west' : 'east'
    const width = intBetween(context.rng, 4, 7)
    const height = intBetween(context.rng, 4, 7)
    const x =
      side === 'west'
        ? between(context.rng, 2, 8)
        : between(context.rng, context.width - width - 8, context.width - width - 2)
    const y =
      4 +
      index * ((context.height - 10) / Math.max(1, buildingCount)) +
      between(context.rng, -1.4, 1.4)
    addBuilding(context, {
      id: `hamlet-building-${index}`,
      x,
      y: Math.max(1.5, Math.min(context.height - height - 1.5, y)),
      width,
      height,
      material: chance(context.rng, 0.55) ? 'wood' : 'stone',
      doorSide: side === 'west' ? 'east' : 'west',
    })
  }

  addFieldStrips(
    context,
    'hamlet-west-field',
    1.2,
    context.height * 0.68,
    context.width * 0.28,
    context.height * 0.22,
  )
  if (chance(context.rng, 0.48)) {
    addFieldStrips(
      context,
      'hamlet-east-field',
      context.width * 0.68,
      context.height * 0.12,
      context.width * 0.24,
      context.height * 0.24,
    )
  }
  addFenceLine(context, 'hamlet-west-field-north', 1.1, context.height * 0.66, context.width * 0.3)
  addFenceLine(
    context,
    'hamlet-west-field-east',
    1.1 + context.width * 0.3,
    context.height * 0.66,
    context.height * 0.24,
    true,
  )

  if (chance(context.rng, 0.35)) {
    addPond(
      context,
      'hamlet-duck-pond',
      between(context.rng, context.width * 0.66, context.width - 7),
      between(context.rng, context.height * 0.58, context.height - 6),
      between(context.rng, 3.4, 5.4),
      between(context.rng, 2.4, 3.6),
    )
  }

  context.objects.push(
    object(
      'hamlet-market-crate-a',
      'crate',
      'large-crate',
      context.width / 2 + 2.5,
      context.height * 0.52,
    ),
    object(
      'hamlet-market-barrel-a',
      'barrel',
      'small-barrel',
      context.width / 2 - 3.2,
      context.height * 0.49,
    ),
  )
  if (chance(context.rng, 0.45)) {
    context.objects.push(
      object(
        'hamlet-parked-wagon',
        'wagon',
        pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
        context.width / 2 + between(context.rng, -2.8, 2.8),
        context.height * between(context.rng, 0.25, 0.75),
        3.2,
        1.4,
        {
          blocksMovement: false,
        },
      ),
    )
  }
  addEdgeTrees(context, roadCenters)
  addUndergrowth(context, Math.round((context.width * context.height) / 85))
  addRocksAndCover(context, intBetween(context.rng, 3, 6))
  addSceneryObjects(context, 'hamlet-road-clutter', intBetween(context.rng, 4, 7), roadSceneryPool)
  addSceneryObjects(context, 'hamlet-yard-clutter', intBetween(context.rng, 3, 6), farmSceneryPool)
  addAmbientFogPatches(context, 'hamlet', intBetween(context.rng, 1, 2))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 3, 5))
}

const buildRuins = (context: GenerationContext): void => {
  addBaseGround(context, context.dark ? 'dark-earth' : 'meadow')
  addTerrainPatches(
    context,
    'ruin',
    ['mossy-stone', 'grave-dust', 'burnt-ground', 'cobblestone', 'stone-tiles'],
    intBetween(context.rng, 5, 9),
  )
  const roadCenters = addWindingVerticalRoad(
    context,
    'ruin',
    context.width / 2 + between(context.rng, -2, 2),
    4.8,
  )
  context.objects.push(
    floorArea(
      'ruin-courtyard',
      context.width / 2 - 7,
      context.height / 2 - 5,
      14,
      10,
      'loose-gravel',
      {
        color: context.dark ? 0x4c4d42 : 0x696d58,
        secondaryColor: 0x252719,
        alpha: 0.55,
      },
    ),
  )

  addBuilding(context, {
    id: 'ruin-old-hall',
    x: context.width / 2 - 6.5,
    y: context.height / 2 - 4.5,
    width: 8,
    height: 7,
    material: 'stone',
    doorSide: pick(context.rng, ['north', 'south'] as const),
  })
  context.objects.push(
    object(
      'ruin-broken-column-a',
      'column',
      'round-stone',
      context.width / 2 - 3.8,
      context.height / 2 - 2.4,
    ),
    object(
      'ruin-broken-column-b',
      'column',
      'round-stone',
      context.width / 2 + 1.4,
      context.height / 2 + 1.6,
    ),
    object(
      'ruin-old-campfire',
      'campfire',
      'small-campfire',
      context.width / 2 + 4.2,
      context.height / 2 + 3.0,
    ),
  )
  if (chance(context.rng, 0.52)) {
    context.objects.push(
      object(
        'ruin-altar-stone',
        'altar',
        undefined,
        context.width / 2 + 3.0,
        context.height / 2 - 3.2,
        undefined,
        undefined,
        {
          rotation: between(context.rng, -0.25, 0.25),
        },
      ),
      object(
        'ruin-warning-trap',
        'trap',
        undefined,
        context.width / 2 - 0.5,
        context.height / 2 + 3.8,
        0.8,
        0.8,
      ),
    )
  }
  if (chance(context.rng, 0.45)) {
    context.objects.push(
      object(
        'ruin-old-wall-a',
        'stone-wall',
        'crypt-wall',
        context.width / 2 + 3.2,
        context.height / 2 - 5.2,
        between(context.rng, 3, 6),
        0.35,
        {
          rotation: between(context.rng, -0.28, 0.28),
        },
      ),
      object(
        'ruin-old-wall-b',
        'stone-wall',
        'crypt-wall',
        context.width / 2 - 8.5,
        context.height / 2 + 4.6,
        between(context.rng, 3, 5.5),
        0.35,
        {
          rotation: between(context.rng, -0.32, 0.32),
        },
      ),
    )
  }
  if (chance(context.rng, 0.5)) {
    addRiver(context, between(context.rng, context.height * 0.68, context.height * 0.78))
  } else if (chance(context.rng, 0.5)) {
    addPond(
      context,
      'ruin-cistern',
      context.width / 2 + between(context.rng, 4, 8),
      context.height / 2 + between(context.rng, -1, 3),
      between(context.rng, 2.5, 4.2),
      between(context.rng, 2.2, 3.5),
    )
  }
  addFallenLogsAndStumps(context, 'ruin', intBetween(context.rng, 2, 5))
  addEdgeTrees(context, roadCenters)
  addUndergrowth(context, Math.round((context.width * context.height) / 65))
  addRocksAndCover(context, intBetween(context.rng, 8, 14))
  addSceneryObjects(context, 'ruin-clutter', intBetween(context.rng, 6, 10), ruinSceneryPool)
  addAmbientFogPatches(context, 'ruin', intBetween(context.rng, 1, 3))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildMarshCrossing = (context: GenerationContext): void => {
  addBaseGround(context, 'marsh')
  addTerrainPatches(
    context,
    'marsh',
    ['shallow-mud', 'muddy-ruts', 'leaf-litter', 'wet-stone'],
    intBetween(context.rng, 6, 10),
  )
  const roadY = context.height * between(context.rng, 0.42, 0.58)
  const roadCenters = addWindingHorizontalRoad(
    context,
    'marsh',
    roadY,
    between(context.rng, 4.8, 6),
  )
  const bridgeY = roadCenters[Math.floor(roadCenters.length / 2)] ?? roadY
  addVerticalRiver(
    context,
    between(context.rng, context.width * 0.36, context.width * 0.58),
    bridgeY,
  )

  addVerticalTrail(
    context,
    'marsh-north-cut',
    'north',
    between(context.rng, context.width * 0.16, context.width * 0.28),
    bridgeY - 1.5,
  )
  addVerticalTrail(
    context,
    'marsh-south-cut',
    'south',
    between(context.rng, context.width * 0.7, context.width * 0.82),
    bridgeY + 1.4,
  )
  addPond(
    context,
    'marsh-west-pool',
    between(context.rng, 2.2, context.width * 0.22),
    between(context.rng, 2.5, context.height * 0.28),
    between(context.rng, 3.5, 6),
    between(context.rng, 2.6, 4.4),
  )
  if (chance(context.rng, 0.65)) {
    addPond(
      context,
      'marsh-south-pool',
      between(context.rng, context.width * 0.58, context.width - 8),
      between(context.rng, context.height * 0.64, context.height - 6),
      between(context.rng, 3.8, 6.5),
      between(context.rng, 2.6, 4.2),
    )
  }

  context.objects.push(
    object(
      'marsh-sunken-crate',
      'crate',
      'small-crate',
      between(context.rng, context.width * 0.45, context.width * 0.58),
      bridgeY + between(context.rng, 2, 4),
    ),
    object(
      'marsh-broken-wheel',
      'wagon-wheel',
      undefined,
      between(context.rng, context.width * 0.28, context.width * 0.42),
      bridgeY - between(context.rng, 3, 5),
    ),
  )
  addScatteredTrees(context, 'marsh', Math.round((context.width * context.height) / 95))
  addFallenLogsAndStumps(context, 'marsh', intBetween(context.rng, 4, 8))
  addUndergrowth(context, Math.round((context.width * context.height) / 70))
  addRocksAndCover(context, intBetween(context.rng, 3, 7))
  addSceneryObjects(context, 'marsh-wild-clutter', intBetween(context.rng, 5, 9), wildSceneryPool)
  addSceneryObjects(context, 'marsh-road-clutter', intBetween(context.rng, 2, 4), roadSceneryPool)
  addAmbientFogPatches(context, 'marsh', intBetween(context.rng, 3, 5))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 3, 6))
}

const buildHillCamp = (context: GenerationContext): void => {
  addBaseGround(context, chance(context.rng, 0.55) ? 'meadow' : 'packed-earth')
  addTerrainPatches(
    context,
    'hill-camp',
    ['burnt-ground', 'leaf-litter', 'muddy-ruts', 'loose-gravel'],
    intBetween(context.rng, 4, 8),
  )
  const roadCenters = addWindingVerticalRoad(
    context,
    'hill-camp',
    context.width * between(context.rng, 0.34, 0.66),
    between(context.rng, 4.2, 5.4),
  )
  addHorizontalTrail(
    context,
    'hill-camp-ridge-path',
    chance(context.rng, 0.5) ? 'west' : 'east',
    context.height * between(context.rng, 0.42, 0.56),
    context.width / 2,
  )
  addHillSlopes(context, 'hill-camp', intBetween(context.rng, 4, 7))
  addCampsite(
    context,
    'hill-camp-main',
    context.width / 2 + between(context.rng, -2, 2),
    context.height / 2 + between(context.rng, -1.5, 1.5),
    context.dark || chance(context.rng, 0.55),
  )
  context.objects.push(
    object(
      'hill-camp-lookout-barricade',
      'wooden-barricade',
      'rough-road-barricade',
      context.width / 2 - 5.5,
      context.height / 2 - 4.5,
      5.5,
      0.35,
      {
        blocksSight: false,
        rotation: between(context.rng, -0.18, 0.18),
      },
    ),
    object(
      'hill-camp-supply-wagon',
      'wagon',
      pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
      roadCenters[3] ?? context.width / 2,
      context.height * 0.66,
      3.2,
      1.4,
      {
        blocksMovement: false,
      },
    ),
  )
  if (chance(context.rng, 0.42)) {
    addPond(
      context,
      'hill-camp-rainpool',
      between(context.rng, context.width * 0.64, context.width - 7),
      between(context.rng, context.height * 0.14, context.height * 0.36),
      between(context.rng, 2.8, 4.8),
      between(context.rng, 2.2, 3.8),
    )
  }
  addScatteredTrees(context, 'hill-camp', Math.round((context.width * context.height) / 115))
  addFallenLogsAndStumps(context, 'hill-camp', intBetween(context.rng, 2, 5))
  addUndergrowth(context, Math.round((context.width * context.height) / 90))
  addRocksAndCover(context, intBetween(context.rng, 10, 16))
  addSceneryObjects(
    context,
    'hill-camp-wild-clutter',
    intBetween(context.rng, 4, 7),
    wildSceneryPool,
  )
  addSceneryObjects(
    context,
    'hill-camp-road-clutter',
    intBetween(context.rng, 3, 5),
    roadSceneryPool,
  )
  addAmbientFogPatches(context, 'hill-camp', intBetween(context.rng, 1, 2))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildAbandonedFarm = (context: GenerationContext): void => {
  addBaseGround(context, 'meadow')
  addTerrainPatches(
    context,
    'farm',
    ['field-stubble', 'muddy-ruts', 'cobblestone'],
    intBetween(context.rng, 5, 8),
  )
  const roadCenters = addWindingHorizontalRoad(
    context,
    'farm',
    context.height * between(context.rng, 0.5, 0.62),
    between(context.rng, 5, 6.2),
  )
  const roadY = roadCenters[Math.floor(roadCenters.length / 2)] ?? context.height * 0.56
  addVerticalTrail(
    context,
    'farm-yard-lane',
    'north',
    context.width / 2 + between(context.rng, -2, 2),
    roadY,
  )

  addBuilding(context, {
    id: 'farm-house',
    x: between(context.rng, 3, 6),
    y: between(context.rng, 3, 5),
    width: between(context.rng, 5.4, 7.2),
    height: between(context.rng, 5, 6.8),
    material: 'wood',
    doorSide: 'south',
  })
  addBuilding(context, {
    id: 'farm-barn',
    x: between(context.rng, context.width - 12, context.width - 9),
    y: between(context.rng, context.height - 11, context.height - 8),
    width: between(context.rng, 6.5, 8.5),
    height: between(context.rng, 5.8, 7.5),
    material: chance(context.rng, 0.7) ? 'wood' : 'stone',
    doorSide: 'west',
  })
  addFieldStrips(
    context,
    'farm-north-field',
    context.width * 0.34,
    2,
    context.width * 0.34,
    context.height * 0.28,
  )
  addFieldStrips(
    context,
    'farm-south-field',
    2,
    context.height * 0.68,
    context.width * 0.34,
    context.height * 0.22,
  )
  addFenceLine(context, 'farm-north-fence', context.width * 0.32, 1.8, context.width * 0.38)
  addFenceLine(context, 'farm-south-fence', 1.8, context.height * 0.66, context.width * 0.36)
  addFenceLine(context, 'farm-west-fence', 1.8, context.height * 0.66, context.height * 0.25, true)

  context.objects.push(
    object(
      'farm-yard-wagon',
      'wagon',
      pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
      context.width / 2 + between(context.rng, -2.5, 2.5),
      roadY - 0.6,
      3.2,
      1.4,
      {
        blocksMovement: false,
      },
    ),
    object('farm-yard-barrel-a', 'barrel', 'large-barrel', context.width / 2 - 4, roadY + 2.2),
    object('farm-yard-crate-a', 'crate', 'large-crate', context.width / 2 + 4.4, roadY + 1.8),
  )
  if (chance(context.rng, 0.5)) {
    addPond(context, 'farm-well-pond', context.width / 2 - 1.2, context.height * 0.36, 2.4, 2.2)
  }
  addScatteredTrees(context, 'farm', Math.round((context.width * context.height) / 135))
  addUndergrowth(context, Math.round((context.width * context.height) / 105))
  addRocksAndCover(context, intBetween(context.rng, 3, 7))
  addSceneryObjects(context, 'farm-yard-clutter', intBetween(context.rng, 5, 9), farmSceneryPool)
  addSceneryObjects(context, 'farm-road-clutter', intBetween(context.rng, 2, 4), roadSceneryPool)
  addAmbientFogPatches(context, 'farm', intBetween(context.rng, 1, 2))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildCaveMouth = (context: GenerationContext): void => {
  addBaseGround(context, chance(context.rng, 0.5) ? 'forest-floor' : 'loose-gravel')
  addTerrainPatches(
    context,
    'cave-mouth',
    ['loose-gravel', 'wet-stone', 'mossy-stone', 'burnt-ground'],
    intBetween(context.rng, 4, 8),
  )
  const roadCenters = addWindingVerticalRoad(
    context,
    'cave-mouth',
    context.width / 2 + between(context.rng, -2, 2),
    between(context.rng, 4.2, 5.4),
  )
  const caveWidth = between(context.rng, 13, 17)
  const caveHeight = between(context.rng, 8.5, 11.5)
  const caveX = context.width / 2 - caveWidth / 2
  const caveY = between(context.rng, 1.8, 3.5)
  const caveBottom = caveY + caveHeight
  const openingWidth = between(context.rng, 3.2, 4.8)
  const openingX = context.width / 2 - openingWidth / 2

  context.objects.push(
    floorArea(
      'cave-mouth-gravel-apron',
      caveX - 1.2,
      caveBottom - 0.8,
      caveWidth + 2.4,
      5.6,
      'loose-gravel',
      {
        color: context.dark ? 0x3d3c38 : 0x6a665d,
        secondaryColor: context.dark ? 0x12110f : 0x211e1a,
        alpha: 0.82,
      },
    ),
    floorArea('cave-mouth-interior', caveX, caveY, caveWidth, caveHeight, 'cave-ground', {
      color: context.dark ? 0x30302e : 0x55514a,
      secondaryColor: context.dark ? 0x11100e : 0x1a1714,
      alpha: 0.96,
    }),
    object('cave-mouth-wall-north', 'stone-wall', 'crypt-wall', caveX, caveY, caveWidth, 0.45),
    object('cave-mouth-wall-west', 'stone-wall', 'crypt-wall', caveX, caveY, 0.45, caveHeight),
    object(
      'cave-mouth-wall-east',
      'stone-wall',
      'crypt-wall',
      caveX + caveWidth - 0.45,
      caveY,
      0.45,
      caveHeight,
    ),
    object(
      'cave-mouth-wall-south-left',
      'stone-wall',
      'crypt-wall',
      caveX,
      caveBottom - 0.45,
      openingX - caveX,
      0.45,
    ),
    object(
      'cave-mouth-wall-south-right',
      'stone-wall',
      'crypt-wall',
      openingX + openingWidth,
      caveBottom - 0.45,
      caveX + caveWidth - openingX - openingWidth,
      0.45,
    ),
  )
  context.walls.push(
    wallSegment('cave-mouth-wall-north', caveX, caveY, caveX + caveWidth, caveY),
    wallSegment('cave-mouth-wall-west', caveX, caveY, caveX, caveBottom),
    wallSegment('cave-mouth-wall-east', caveX + caveWidth, caveY, caveX + caveWidth, caveBottom),
    wallSegment('cave-mouth-wall-south-left', caveX, caveBottom, openingX, caveBottom),
    wallSegment(
      'cave-mouth-wall-south-right',
      openingX + openingWidth,
      caveBottom,
      caveX + caveWidth,
      caveBottom,
    ),
  )
  if (chance(context.rng, 0.55)) {
    addPond(context, 'cave-mouth-underground-pool', caveX + caveWidth - 5, caveY + 2, 3.4, 2.8)
  }
  context.objects.push(
    object('cave-mouth-column-a', 'column', 'round-stone', caveX + 3, caveY + caveHeight - 3),
    object(
      'cave-mouth-column-b',
      'column',
      'round-stone',
      caveX + caveWidth - 4,
      caveY + caveHeight - 3.5,
    ),
    object(
      'cave-mouth-warning-crate',
      'crate',
      'small-crate',
      openingX + openingWidth + 1.1,
      caveBottom + 1.3,
    ),
  )
  if (context.dark) {
    context.objects.push(
      object(
        'cave-mouth-blue-fire',
        'torch',
        chance(context.rng, 0.5) ? 'blue-magic-fire' : 'blue-crystal-torch',
        caveX + 1.1,
        caveY + 1.2,
      ),
    )
  }
  addScatteredTrees(context, 'cave-mouth', Math.round((context.width * context.height) / 130))
  addFallenLogsAndStumps(context, 'cave-mouth', intBetween(context.rng, 2, 5))
  addHillSlopes(context, 'cave-mouth', intBetween(context.rng, 2, 4))
  addUndergrowth(context, Math.round((context.width * context.height) / 95))
  addRocksAndCover(context, intBetween(context.rng, 12, 18))
  addSceneryObjects(
    context,
    'cave-mouth-ruin-clutter',
    intBetween(context.rng, 3, 6),
    ruinSceneryPool,
  )
  addSceneryObjects(
    context,
    'cave-mouth-wild-clutter',
    intBetween(context.rng, 3, 6),
    wildSceneryPool,
  )
  addAmbientFogPatches(context, 'cave-mouth', intBetween(context.rng, 1, 3))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
  if (chance(context.rng, 0.35)) {
    addHorizontalTrail(
      context,
      'cave-mouth-side-track',
      chance(context.rng, 0.5) ? 'west' : 'east',
      context.height * between(context.rng, 0.62, 0.78),
      roadCenters[4] ?? context.width / 2,
    )
  }
}

const buildSacredGrove = (context: GenerationContext): void => {
  addBaseGround(context, 'forest-floor')
  addTerrainPatches(
    context,
    'sacred-grove',
    ['leaf-litter', 'mossy-stone', 'meadow'],
    intBetween(context.rng, 5, 9),
  )
  const centerX = context.width / 2 + between(context.rng, -2.5, 2.5)
  const centerY = context.height / 2 + between(context.rng, -2, 2)
  const clearingWidth = between(context.rng, 10, 14)
  const clearingHeight = between(context.rng, 8, 11)
  context.objects.push(
    floorArea(
      'sacred-grove-clearing',
      centerX - clearingWidth / 2,
      centerY - clearingHeight / 2,
      clearingWidth,
      clearingHeight,
      'meadow',
      {
        color: context.dark ? 0x34432c : 0x698a4d,
        secondaryColor: context.dark ? 0x151c12 : 0x2c421e,
        alpha: 0.8,
        rotation: between(context.rng, -0.18, 0.18),
      },
    ),
  )

  const entrances = pick(context.rng, [
    ['west', 'north'],
    ['east', 'south'],
    ['west', 'east'],
    ['north', 'south'],
  ] as const)
  for (const entrance of entrances) {
    if (entrance === 'west' || entrance === 'east') {
      addHorizontalTrail(
        context,
        `sacred-grove-${entrance}-trail`,
        entrance,
        centerY + between(context.rng, -1, 1),
        centerX,
      )
    } else {
      addVerticalTrail(
        context,
        `sacred-grove-${entrance}-trail`,
        entrance,
        centerX + between(context.rng, -1, 1),
        centerY,
      )
    }
  }

  const stoneCount = intBetween(context.rng, 7, 10)
  for (let index = 0; index < stoneCount; index += 1) {
    const angle = (index / stoneCount) * Math.PI * 2 + between(context.rng, -0.09, 0.09)
    const radiusX = clearingWidth * between(context.rng, 0.33, 0.41)
    const radiusY = clearingHeight * between(context.rng, 0.32, 0.4)
    addSceneObject(
      context,
      `sacred-grove-standing-stone-${index}`,
      'rock',
      'standing-stone',
      centerX,
      centerY,
      Math.cos(angle) * radiusX - 0.5,
      Math.sin(angle) * radiusY - 0.8,
    )
  }
  context.objects.push(
    object(
      'sacred-grove-center-runes',
      'decoration',
      'ritual-runes',
      centerX - 0.75,
      centerY - 0.75,
      1.5,
      1.5,
      { blocksMovement: false },
    ),
  )
  if (chance(context.rng, 0.55)) {
    addSceneObject(
      context,
      'sacred-grove-altar',
      'altar',
      undefined,
      centerX,
      centerY,
      -1.1,
      1.3,
      2.2,
      1.4,
    )
  } else {
    addSceneObject(
      context,
      'sacred-grove-brazier',
      'hearth',
      'standing-brazier',
      centerX,
      centerY,
      1.3,
      0.8,
    )
  }

  const treeCount = Math.round((context.width * context.height) / 30)
  for (let index = 0; index < treeCount; index += 1) {
    const angle = context.rng() * Math.PI * 2
    const radiusX = clearingWidth * between(context.rng, 0.58, 1.15)
    const radiusY = clearingHeight * between(context.rng, 0.58, 1.2)
    const x = clamp(centerX + Math.cos(angle) * radiusX, 0.5, context.width - 2.1)
    const y = clamp(centerY + Math.sin(angle) * radiusY, 0.5, context.height - 2.3)
    context.objects.push(
      object(
        `sacred-grove-tree-${index}`,
        'tree',
        pick(context.rng, ['old-oak', 'birch-tree', 'autumn-maple'] as const),
        x,
        y,
      ),
    )
  }
  addUndergrowth(context, Math.round((context.width * context.height) / 75))
  addFallenLogsAndStumps(context, 'sacred-grove', intBetween(context.rng, 2, 5))
  addSceneryObjects(context, 'sacred-grove-clutter', intBetween(context.rng, 4, 7), wildSceneryPool)
  addAmbientFogPatches(context, 'sacred-grove', intBetween(context.rng, 2, 4))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
  context.startPosition = { x: centerX, y: context.height - 3 }
}

const buildFrozenPass = (context: GenerationContext): void => {
  addBaseGround(context, 'snow')
  addTerrainPatches(
    context,
    'frozen-pass',
    ['snow', 'loose-gravel', 'wet-stone'],
    intBetween(context.rng, 7, 12),
  )
  const horizontal = chance(context.rng, 0.5)
  if (horizontal) {
    addWindingHorizontalRoad(
      context,
      'frozen-pass',
      context.height * between(context.rng, 0.38, 0.62),
      between(context.rng, 4.2, 5.5),
    )
  } else {
    addWindingVerticalRoad(
      context,
      'frozen-pass',
      context.width * between(context.rng, 0.38, 0.62),
      between(context.rng, 4.2, 5.5),
    )
  }

  for (let index = 0; index < intBetween(context.rng, 7, 11); index += 1) {
    const width = between(context.rng, 4.5, 8.5)
    const height = between(context.rng, 2.3, 4.5)
    context.objects.push(
      object(
        `frozen-pass-slope-${index}`,
        'hill-slope',
        pick(context.rng, ['rocky-north-rise', 'rocky-south-rise', 'rocky-east-rise'] as const),
        between(context.rng, 1, Math.max(1, context.width - width - 1)),
        between(context.rng, 1, Math.max(1, context.height - height - 1)),
        width,
        height,
        {
          color: context.dark ? 0x59656b : 0xb8c7ce,
          secondaryColor: context.dark ? 0x263039 : 0x71848e,
          rotation: between(context.rng, -0.35, 0.35),
        },
      ),
    )
  }
  addThemedTreeClusters(context, 'frozen-pass', Math.round((context.width * context.height) / 85), [
    'pine-tree',
    'dead-tree',
  ])
  addRocksAndCover(context, intBetween(context.rng, 14, 22))
  const shrineX = context.width * between(context.rng, 0.25, 0.75)
  const shrineY = context.height * between(context.rng, 0.25, 0.65)
  addSceneObject(
    context,
    'frozen-pass-shrine-stone',
    'rock',
    'standing-stone',
    shrineX,
    shrineY,
    0,
    0,
  )
  addSceneObject(
    context,
    'frozen-pass-shrine-marker',
    'decoration',
    'grave-marker',
    shrineX,
    shrineY,
    -1.5,
    1.3,
  )
  addSceneObject(
    context,
    'frozen-pass-shrine-fire',
    'torch',
    context.dark ? 'blue-crystal-torch' : 'hooded-lantern',
    shrineX,
    shrineY,
    1.4,
    1.1,
  )
  addSceneryObjects(context, 'frozen-pass-debris', intBetween(context.rng, 3, 6), ruinSceneryPool)
  addAmbientFogPatches(context, 'frozen-pass', intBetween(context.rng, 2, 5))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildScorchedBattlefield = (context: GenerationContext): void => {
  addBaseGround(context, 'burnt-ground')
  addTerrainPatches(
    context,
    'battlefield',
    ['dark-earth', 'loose-gravel', 'muddy-ruts', 'grave-dust'],
    intBetween(context.rng, 8, 13),
  )
  const roadY = context.height * between(context.rng, 0.38, 0.62)
  addWindingHorizontalRoad(context, 'battlefield', roadY, between(context.rng, 5, 7))
  addVerticalTrail(
    context,
    'battlefield-cross-road',
    chance(context.rng, 0.5) ? 'north' : 'south',
    context.width * between(context.rng, 0.35, 0.65),
    roadY,
  )

  const lineY = roadY + between(context.rng, -4, 4)
  for (let index = 0; index < intBetween(context.rng, 4, 7); index += 1) {
    const x = context.width * 0.16 + index * 4.2 + between(context.rng, -0.5, 0.5)
    addSceneObject(
      context,
      `battlefield-barricade-${index}`,
      'wooden-barricade',
      chance(context.rng, 0.45) ? 'spiked-road-barricade' : 'rough-road-barricade',
      x,
      lineY,
      0,
      0,
      between(context.rng, 3.2, 4.6),
      0.38,
      { blocksSight: false, rotation: between(context.rng, -0.3, 0.3) },
    )
  }
  for (let index = 0; index < intBetween(context.rng, 5, 9); index += 1) {
    addSceneObject(
      context,
      `battlefield-remains-${index}`,
      'forest-remains',
      'scattered-bones',
      context.width / 2,
      roadY,
      between(context.rng, -context.width * 0.35, context.width * 0.35),
      between(context.rng, -context.height * 0.28, context.height * 0.28),
      undefined,
      undefined,
      { rotation: between(context.rng, -0.8, 0.8) },
    )
  }
  addThemedTreeClusters(context, 'battlefield', intBetween(context.rng, 6, 11), ['dead-tree'], 3)
  addFallenLogsAndStumps(context, 'battlefield', intBetween(context.rng, 4, 8))
  addRocksAndCover(context, intBetween(context.rng, 8, 14))
  addSceneObject(
    context,
    'battlefield-broken-wagon',
    'wagon',
    pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
    context.width * 0.68,
    roadY,
    0,
    -2,
    3.2,
    1.4,
    { rotation: between(context.rng, -0.55, 0.55), blocksMovement: false },
  )
  for (let index = 0; index < intBetween(context.rng, 2, 4); index += 1) {
    const fireX = between(context.rng, 4, context.width - 6)
    const fireY = between(context.rng, 4, context.height - 6)
    addSceneObject(
      context,
      `battlefield-embers-${index}`,
      'campfire',
      'smoldering-coals',
      fireX,
      fireY,
      0,
      0,
    )
    addSceneObject(
      context,
      `battlefield-smoke-${index}`,
      'smoke',
      chance(context.rng, 0.5) ? 'light-smoke' : 'dense-smoke',
      fireX,
      fireY,
      -0.8,
      -1.3,
      between(context.rng, 2.2, 3.8),
      between(context.rng, 2.4, 4.2),
      { alpha: between(context.rng, 0.18, 0.34) },
    )
  }
  addSceneryObjects(context, 'battlefield-debris', intBetween(context.rng, 7, 12), roadSceneryPool)
  addAmbientFogPatches(context, 'battlefield', intBetween(context.rng, 1, 3))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const buildDesertOasis = (context: GenerationContext): void => {
  addBaseGround(context, 'sand')
  addTerrainPatches(
    context,
    'desert-oasis',
    ['sand', 'loose-gravel', 'packed-earth', 'burnt-ground'],
    intBetween(context.rng, 7, 11),
  )
  const roadY = context.height * between(context.rng, 0.35, 0.65)
  addWindingHorizontalRoad(context, 'desert-oasis', roadY, between(context.rng, 4.2, 5.8))
  const oasisX = context.width * between(context.rng, 0.28, 0.72)
  const oasisY = clamp(roadY + between(context.rng, -7, 7), 5, context.height - 8)
  addPond(
    context,
    'desert-oasis-water',
    oasisX - 3.5,
    oasisY - 2.2,
    between(context.rng, 6, 8.5),
    between(context.rng, 4, 5.5),
  )
  addThemedTreeClusters(context, 'desert-oasis', intBetween(context.rng, 3, 6), ['dead-tree'], 1)
  const scrubCenters = [{ x: oasisX, y: oasisY }]
  for (let index = 0; index < intBetween(context.rng, 10, 16); index += 1) {
    const position = clusteredPosition(context, scrubCenters, 6, 1.7, 1.35)
    const isBush = chance(context.rng, 0.3)
    context.objects.push(
      object(
        `desert-oasis-scrub-${index}`,
        isBush ? 'bush' : 'thicket',
        isBush ? 'thorn-bush' : 'dry-scrub',
        position.x,
        position.y,
        undefined,
        undefined,
        { blocksMovement: false },
      ),
    )
  }
  addCampsite(
    context,
    'desert-oasis-camp',
    clamp(oasisX + between(context.rng, 5, 7), 5, context.width - 6),
    clamp(oasisY + between(context.rng, -2, 2), 4, context.height - 5),
    context.dark || chance(context.rng, 0.35),
  )
  addSceneObject(
    context,
    'desert-oasis-caravan',
    'wagon',
    pick(context.rng, ['loaded-farm-wagon-east', 'loaded-farm-wagon-west'] as const),
    context.width * 0.2,
    roadY,
    0,
    -1,
    3.2,
    1.4,
    { blocksMovement: false },
  )
  addSceneObject(
    context,
    'desert-oasis-waystone',
    'rock',
    'standing-stone',
    context.width * 0.78,
    roadY,
    0,
    1.5,
  )
  addRocksAndCover(context, intBetween(context.rng, 12, 20))
  addSceneryObjects(context, 'desert-oasis-cargo', intBetween(context.rng, 4, 8), roadSceneryPool)
  addAmbientFogPatches(context, 'desert-oasis', intBetween(context.rng, 1, 2))
  addFullMapLight(context)
  addDarkLightSources(context, intBetween(context.rng, 2, 4))
}

const randomMapTemplates: readonly RandomMapTemplate[] = [
  {
    names: [
      'Jagdweg durch Rabenholz',
      'Tannenpass am Karrenrad',
      'Birkenweg bei Moosfels',
      'Waldschneise am alten Bach',
      'Karrenpfad unter Kronen',
      'Verwachsener Handelsweg',
    ],
    storyScenes: [
      'abandoned-caravan',
      'grave-site',
      'logging-site',
      'ritual-site',
      'spider-nest',
      'watch-camp',
    ],
    traits: ['outdoor', 'forest'],
    build: buildForestRoad,
  },
  {
    names: [
      'Grenzweiler am Handelsweg',
      'Drei-Haeuser-Kreuzung',
      'Wachposten bei den Feldern',
      'Hofweiler am Wegstein',
      'Kleiner Markt am Waldrand',
      'Siedlung bei der alten Linde',
    ],
    storyScenes: ['abandoned-caravan', 'grave-site', 'logging-site', 'watch-camp'],
    traits: ['outdoor', 'settlement'],
    build: buildRoadsideHamlet,
  },
  {
    names: [
      'Moosige Saeulenhalle',
      'Zerfallener Hof der Steine',
      'Alte Tempelreste',
      'Gebrochene Krypta im Wald',
      'Vergessener Steinkreis',
      'Ruinenhof am Dornbusch',
    ],
    storyScenes: ['grave-site', 'ritual-site', 'spider-nest', 'watch-camp'],
    traits: ['outdoor', 'ruins', 'forest'],
    build: buildRuins,
  },
  {
    names: [
      'Moorfurt am schwarzen Steg',
      'Versunkener Damm im Bruch',
      'Torfsteg bei Grauweiden',
      'Nebelbruch-Furt',
      'Sumpfweg am tiefen Wasser',
      'Alter Steg durch das Ried',
    ],
    storyScenes: ['abandoned-caravan', 'grave-site', 'spider-nest'],
    traits: ['outdoor', 'swamp', 'water', 'river'],
    build: buildMarshCrossing,
  },
  {
    names: [
      'Hoehenlager am Kamm',
      'Wachfeuer bei Drei Felsen',
      'Passlager ueber dem Weg',
      'Banditenrast am Steinbuckel',
      'Rastplatz auf der Felskante',
      'Kammweg mit Lagerfeuer',
    ],
    storyScenes: ['abandoned-caravan', 'ritual-site', 'watch-camp'],
    traits: ['outdoor'],
    build: buildHillCamp,
  },
  {
    names: [
      'Verlassener Hof am Feldrain',
      'Alter Erntehof am Weg',
      'Scheunenplatz hinter den Feldern',
      'Hofruine bei den Ackern',
      'Leerer Weidehof',
      'Feldweg am alten Brunnen',
    ],
    storyScenes: ['abandoned-caravan', 'grave-site', 'logging-site', 'spider-nest'],
    traits: ['outdoor', 'settlement'],
    build: buildAbandonedFarm,
  },
  {
    names: [
      'Felsentor am Karrenweg',
      'Hoehleneingang bei Kalten Quellen',
      'Steinbruchpfad unter Tannen',
      'Tropfsteinhang am Waldpfad',
      'Graues Tor im Hang',
      'Felsnische hinter dem Pass',
    ],
    storyScenes: ['grave-site', 'ritual-site', 'spider-nest', 'watch-camp'],
    traits: ['outdoor', 'ruins', 'forest'],
    build: buildCaveMouth,
  },
  {
    names: [
      'Gewoelbe unter dem Wachhaus',
      'Kryptakorridore der alten Feste',
      'Verlassene Zellen unter Stein',
      'Saeulenhalle hinter der Falltuer',
      'Unterirdischer Wachgang',
      'Gemauerter Gangkomplex',
    ],
    suffixes: {
      light: ['in klarer Sicht', 'unter altem Stein', 'bei ruhigem Lampenlicht'],
      dark: ['in tiefer Finsternis', 'im Fackelschein', 'bei kaltem Steinlicht'],
    },
    traits: ['dungeon', 'ruins'],
    build: buildDungeonHalls,
  },
  {
    names: [
      'Verzweigte Hoehle am Tiefenbach',
      'Pilzgrotte mit Seitengaengen',
      'Kalksteingaenge unter dem Wald',
      'Tropfsteinlabyrinth',
      'Nasse Felskammern',
      'Hoehlenpfade im Dunkelgrund',
    ],
    suffixes: {
      light: ['in klarer Sicht', 'unter hellem Kristallschein', 'bei offenem Laternenlicht'],
      dark: ['in tiefer Finsternis', 'im Hexenlicht', 'unter kaltem Tropfstein'],
    },
    traits: ['dungeon', 'water'],
    build: buildCaveLabyrinth,
  },
  {
    names: [
      'Heiliger Hain der alten Eichen',
      'Steinkreis unter roten Kronen',
      'Mondhain am vergessenen Pfad',
      'Druidenlichtung von Silberblatt',
      'Fluesterhain bei den Menhiren',
      'Verborgener Kreis im Gruen',
    ],
    storyScenes: ['grave-site', 'logging-site', 'spider-nest'],
    traits: ['outdoor', 'forest', 'ruins'],
    build: buildSacredGrove,
  },
  {
    names: [
      'Verschneiter Pass am Wegstein',
      'Eisiger Kamm von Weissfels',
      'Winterpfad durch die Hoehen',
      'Frostsenke am alten Schrein',
      'Schneepass der toten Tannen',
      'Kalter Handelsweg am Grat',
    ],
    suffixes: {
      light: ['im blassen Winterlicht', 'unter klarem Frosthimmel', 'im Schneeglanz'],
      dark: ['unter kaltem Mond', 'im Schneesturm', 'bei blauem Feuer'],
    },
    storyScenes: ['abandoned-caravan', 'grave-site', 'watch-camp'],
    traits: ['outdoor', 'snow', 'forest'],
    build: buildFrozenPass,
  },
  {
    names: [
      'Verbranntes Feld der letzten Schlacht',
      'Aschegrund am zerbrochenen Wall',
      'Schwarzer Rain bei den Barrikaden',
      'Verlassene Front am Karrenweg',
      'Schlachtfeld unter grauem Rauch',
      'Gefallenenfeld von Dornwacht',
    ],
    suffixes: {
      light: ['unter rauchigem Himmel', 'im fahlen Tageslicht', 'zwischen kalten Feuern'],
      dark: ['bei glimmender Asche', 'unter rotem Mond', 'zwischen Rauch und Funken'],
    },
    storyScenes: ['abandoned-caravan', 'grave-site', 'ritual-site', 'watch-camp'],
    traits: ['outdoor', 'ruins'],
    build: buildScorchedBattlefield,
  },
  {
    names: [
      'Oase am staubigen Karawanenweg',
      'Sandelquelle bei den Wegsteinen',
      'Verborgene Wasserstelle im roten Land',
      'Karawanenrast von Goldsand',
      'Trockental an der stillen Quelle',
      'Steinpfad durch die Duenen',
    ],
    suffixes: {
      light: ['in der Mittagshitze', 'unter hellem Himmel', 'im flirrenden Licht'],
      dark: ['unter dem Wüstenmond', 'bei kaltem Sternenlicht', 'im Schein der Lagerfeuer'],
    },
    storyScenes: ['abandoned-caravan', 'ritual-site', 'watch-camp'],
    traits: ['outdoor', 'desert', 'water'],
    build: buildDesertOasis,
  },
] as const

const pickRandomMapTemplate = (
  rng: Rng,
  features: ReadonlySet<RandomMapFeature>,
): RandomMapTemplate => {
  const outdoorRequested =
    features.has('outdoor') ||
    features.has('forest') ||
    features.has('swamp') ||
    features.has('desert') ||
    features.has('settlement') ||
    features.has('ship')
  const candidates = randomMapTemplates.filter((template) =>
    features.has('dungeon')
      ? template.traits.includes('dungeon')
      : outdoorRequested
        ? template.traits.includes('outdoor')
        : true,
  )
  const scored = candidates.map((template) => ({
    template,
    score: template.traits.filter(
      (trait) => trait !== 'outdoor' && trait !== 'dungeon' && features.has(trait),
    ).length,
  }))
  const bestScore = Math.max(0, ...scored.map((entry) => entry.score))
  const bestTemplates = scored
    .filter((entry) => entry.score === bestScore)
    .map((entry) => entry.template)
  return pick(rng, bestTemplates.length > 0 ? bestTemplates : randomMapTemplates)
}

const createGeneratedMapName = (
  context: GenerationContext,
  template: RandomMapTemplate,
): string => {
  const story = context.storyLabel ? ` ${context.storyLabel}` : ''
  return `${pick(context.rng, template.names)}${story} ${pick(
    context.rng,
    context.dark
      ? (template.suffixes?.dark ?? darkNameSuffixes)
      : (template.suffixes?.light ?? lightNameSuffixes),
  )} (${context.dark ? 'dunkel' : 'hell'})`
}

const createStartToken = (
  mapIdValue: string,
  x: number,
  y: number,
  dark: boolean,
): PlacedToken => ({
  id: 'generated-token-hero',
  mapId: mapIdValue,
  name: 'Held',
  position: { x, y },
  size: 1,
  rotation: 0,
  visionRange: dark ? 7 : 9,
  visionAngle: null,
  visionEnabled: true,
  category: 'player',
  color: '#3f8cff',
  symbol: 'H',
})

export const createRandomMap = (options: RandomMapOptions): MapDefinition => {
  const seed = options.seed ?? randomSeed()
  const rng = mulberry32(seed)
  const features = new Set(normalizeRandomMapFeatures(options.features ?? []))
  const dark = options.dark || features.has('dark')
  const width = intBetween(rng, 30, 48)
  const height = intBetween(rng, 26, 42)
  const context: GenerationContext = {
    rng,
    seed,
    dark,
    features,
    width,
    height,
    objects: [],
    walls: [],
    doors: [],
  }

  const template = pickRandomMapTemplate(rng, features)
  template.build(context)
  if (template.storyScenes && chance(context.rng, 0.82)) {
    addStoryScene(context, 'generated-story', template.storyScenes)
  }
  addSelectedFeatureLayers(context)
  const startPosition = context.startPosition ?? { x: width / 2, y: height - 4 }

  return defineMap({
    id: randomMapId,
    name: createGeneratedMapName(context, template),
    width,
    height,
    gridSize: 48,
    objects: context.objects,
    walls: context.walls,
    doors: context.doors,
    spawnPoints: [],
    startTokens: [createStartToken(randomMapId, startPosition.x, startPosition.y, dark)],
  })
}
