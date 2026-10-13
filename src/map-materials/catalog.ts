import type { MaterialDecalKind, MaterialId, MaterialTransitionStyle } from './types'

export interface MaterialDecalProfile {
  readonly kind: MaterialDecalKind
  readonly density: number
  readonly color: number
  readonly alpha: number
}

export interface MaterialDescriptor {
  readonly id: MaterialId
  readonly baseColor: number
  readonly secondaryColor: number
  readonly shadowColor: number
  readonly tintJitter: number
  readonly variantCount: number
  readonly transition: MaterialTransitionStyle
  readonly decals: readonly MaterialDecalProfile[]
  /** Frame names can be added later without changing MapDefinition. */
  readonly atlasFrames: readonly string[]
}

const material = (
  descriptor: Omit<MaterialDescriptor, 'atlasFrames'> & {
    readonly atlasFrames?: readonly string[]
  },
): MaterialDescriptor => ({ ...descriptor, atlasFrames: descriptor.atlasFrames ?? [] })

export const materialCatalog: Readonly<Record<MaterialId, MaterialDescriptor>> = {
  grass: material({
    id: 'grass',
    baseColor: 0x5f8443,
    secondaryColor: 0x314f24,
    shadowColor: 0x1c2c17,
    tintJitter: 12,
    variantCount: 6,
    transition: 'soft',
    decals: [{ kind: 'irregularity', density: 0.32, color: 0x9caf62, alpha: 0.22 }],
  }),
  'forest-floor': material({
    id: 'forest-floor',
    baseColor: 0x4b4a2f,
    secondaryColor: 0x2b321f,
    shadowColor: 0x17150f,
    tintJitter: 11,
    variantCount: 8,
    transition: 'soft',
    decals: [
      { kind: 'leaves', density: 0.72, color: 0x9a6738, alpha: 0.46 },
      { kind: 'moss', density: 0.22, color: 0x58723b, alpha: 0.28 },
    ],
  }),
  dirt: material({
    id: 'dirt',
    baseColor: 0x806242,
    secondaryColor: 0x4e3928,
    shadowColor: 0x2e2118,
    tintJitter: 13,
    variantCount: 7,
    transition: 'soft',
    decals: [
      { kind: 'dirt', density: 0.58, color: 0x39291f, alpha: 0.22 },
      { kind: 'small-stones', density: 0.18, color: 0x99836a, alpha: 0.3 },
    ],
  }),
  mud: material({
    id: 'mud',
    baseColor: 0x4c4934,
    secondaryColor: 0x29291f,
    shadowColor: 0x151711,
    tintJitter: 8,
    variantCount: 6,
    transition: 'soft',
    decals: [{ kind: 'irregularity', density: 0.62, color: 0x87917a, alpha: 0.18 }],
  }),
  stone: material({
    id: 'stone',
    baseColor: 0x77766d,
    secondaryColor: 0x504f49,
    shadowColor: 0x282825,
    tintJitter: 10,
    variantCount: 8,
    transition: 'rough',
    decals: [
      { kind: 'crack', density: 0.24, color: 0x262521, alpha: 0.48 },
      { kind: 'moss', density: 0.12, color: 0x52603b, alpha: 0.3 },
    ],
  }),
  'dungeon-stone': material({
    id: 'dungeon-stone',
    baseColor: 0x817462,
    secondaryColor: 0x4b4035,
    shadowColor: 0x211b17,
    tintJitter: 8,
    variantCount: 10,
    transition: 'masonry',
    decals: [
      { kind: 'crack', density: 0.38, color: 0x211a15, alpha: 0.58 },
      { kind: 'dirt', density: 0.26, color: 0x33271e, alpha: 0.2 },
    ],
  }),
  sand: material({
    id: 'sand',
    baseColor: 0xb69a62,
    secondaryColor: 0x8c713f,
    shadowColor: 0x5e4a2c,
    tintJitter: 10,
    variantCount: 6,
    transition: 'soft',
    decals: [{ kind: 'irregularity', density: 0.42, color: 0xe0c98d, alpha: 0.2 }],
  }),
  snow: material({
    id: 'snow',
    baseColor: 0xd8e3e8,
    secondaryColor: 0xa8bdc7,
    shadowColor: 0x718b98,
    tintJitter: 7,
    variantCount: 5,
    transition: 'soft',
    decals: [{ kind: 'irregularity', density: 0.3, color: 0xf4fbff, alpha: 0.34 }],
  }),
  volcanic: material({
    id: 'volcanic',
    baseColor: 0x342e2a,
    secondaryColor: 0x241d1a,
    shadowColor: 0x0e0c0b,
    tintJitter: 7,
    variantCount: 8,
    transition: 'rough',
    decals: [
      { kind: 'crack', density: 0.52, color: 0xb64220, alpha: 0.54 },
      { kind: 'small-stones', density: 0.3, color: 0x171413, alpha: 0.5 },
    ],
  }),
  ash: material({
    id: 'ash',
    baseColor: 0x57534e,
    secondaryColor: 0x393633,
    shadowColor: 0x211f1d,
    tintJitter: 8,
    variantCount: 5,
    transition: 'soft',
    decals: [{ kind: 'dirt', density: 0.7, color: 0x252321, alpha: 0.28 }],
  }),
  'shallow-water': material({
    id: 'shallow-water',
    baseColor: 0x397b7c,
    secondaryColor: 0x74aaa1,
    shadowColor: 0x173f47,
    tintJitter: 6,
    variantCount: 6,
    transition: 'shore',
    decals: [{ kind: 'shore-detail', density: 0.32, color: 0xb7d8c9, alpha: 0.34 }],
  }),
  'deep-water': material({
    id: 'deep-water',
    baseColor: 0x185265,
    secondaryColor: 0x397f8b,
    shadowColor: 0x092d3b,
    tintJitter: 5,
    variantCount: 5,
    transition: 'shore',
    decals: [{ kind: 'irregularity', density: 0.2, color: 0x86b9bb, alpha: 0.18 }],
  }),
  wood: material({
    id: 'wood',
    baseColor: 0x835738,
    secondaryColor: 0x56341f,
    shadowColor: 0x28170e,
    tintJitter: 10,
    variantCount: 8,
    transition: 'masonry',
    decals: [{ kind: 'crack', density: 0.2, color: 0x2b180f, alpha: 0.42 }],
  }),
}
