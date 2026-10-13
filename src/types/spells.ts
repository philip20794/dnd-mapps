import type { GridPoint } from './geometry'

export type SpellAreaShape = 'sphere' | 'cylinder' | 'cone' | 'line' | 'cube' | 'emanation' | 'wall'

export type SpellDuration = 'instant' | 'concentration' | 'persistent'
export type SpellOrigin = 'caster' | 'point'

export interface SpellAreaPreset {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly shape: SpellAreaShape
  readonly origin: SpellOrigin
  readonly rangeFeet: number
  readonly sizeFeet: number
  readonly widthFeet?: number
  readonly heightFeet?: number
  readonly duration: SpellDuration
  readonly color: string
  readonly description: string
}

export interface SpellPlacement {
  readonly casterTokenId: string
  readonly presetId: string
}

export interface PlacedSpellEffect {
  readonly id: string
  readonly mapId: string
  readonly levelId?: string
  readonly casterTokenId: string
  readonly presetId: string
  readonly name: string
  readonly shape: SpellAreaShape
  readonly position: GridPoint
  readonly rotation: number
  readonly size: number
  readonly width: number
  readonly heightFeet?: number
  readonly duration: SpellDuration
  readonly color: string
  readonly attachedToCaster: boolean
}

export interface SpellEffectPatch {
  readonly position?: GridPoint
  readonly rotation?: number
  readonly size?: number
  readonly width?: number
  readonly color?: string
}

export const FEET_PER_GRID_UNIT = 5

const formatFeet = (gridUnits: number): string => {
  const feet = gridUnits * FEET_PER_GRID_UNIT
  return Number.isInteger(feet) ? feet.toString() : feet.toFixed(1).replace(/\.0$/, '')
}

/** A concise, player-facing size label derived from the current drawn dimensions. */
export const spellEffectSizeLabel = (
  effect: Pick<PlacedSpellEffect, 'name' | 'shape' | 'size' | 'width' | 'heightFeet'>,
): string => {
  const size = formatFeet(effect.size)
  const width = formatFeet(['cone', 'cube'].includes(effect.shape) ? effect.size : effect.width)
  const twoDimensional = ['cone', 'line', 'cube', 'wall'].includes(effect.shape)
  const dimensions = twoDimensional ? `${size} × ${width} ft` : `${size} ft`
  const height = effect.heightFeet === undefined ? '' : ` · H ${effect.heightFeet} ft`

  return `${dimensions} ${effect.name}${height}`
}

export const spellAreaPresets: readonly SpellAreaPreset[] = [
  {
    id: 'shape-circle',
    name: 'Kreis',
    icon: '○',
    shape: 'sphere',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 15,
    duration: 'persistent',
    color: '#ff6b4a',
    description: 'Sphäre oder runder Bereich',
  },
  {
    id: 'shape-cylinder',
    name: 'Zylinder',
    icon: '◉',
    shape: 'cylinder',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 15,
    heightFeet: 20,
    duration: 'persistent',
    color: '#65c7f7',
    description: 'Runder Bereich mit Höhe',
  },
  {
    id: 'shape-cone',
    name: 'Kegel',
    icon: '▷',
    shape: 'cone',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 15,
    duration: 'persistent',
    color: '#f7c948',
    description: 'Breitet sich in eine Richtung aus',
  },
  {
    id: 'shape-line',
    name: 'Linie',
    icon: '━',
    shape: 'line',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 20,
    widthFeet: 5,
    duration: 'persistent',
    color: '#b78cff',
    description: 'Gerade Fläche mit Breite',
  },
  {
    id: 'shape-square',
    name: 'Quadrat',
    icon: '□',
    shape: 'cube',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 15,
    duration: 'persistent',
    color: '#4dd6a4',
    description: 'Würfel oder quadratischer Bereich',
  },
  {
    id: 'shape-aura',
    name: 'Aura',
    icon: '✺',
    shape: 'emanation',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 10,
    duration: 'persistent',
    color: '#f38bbd',
    description: 'Freie kreisförmige Aura',
  },
  {
    id: 'shape-wall',
    name: 'Wand',
    icon: '╱',
    shape: 'wall',
    origin: 'point',
    rangeFeet: 0,
    sizeFeet: 25,
    widthFeet: 5,
    duration: 'persistent',
    color: '#ff865e',
    description: 'Gerade, frei drehbare Wand',
  },
]

export const findSpellAreaPreset = (presetId: string): SpellAreaPreset | undefined =>
  spellAreaPresets.find((preset) => preset.id === presetId)

export const spellShapeLabel = (shape: SpellAreaShape): string =>
  ({
    sphere: 'Kreis',
    cylinder: 'Zylinder',
    cone: 'Kegel',
    line: 'Linie',
    cube: 'Quadrat',
    emanation: 'Aura',
    wall: 'Wand',
  })[shape]
