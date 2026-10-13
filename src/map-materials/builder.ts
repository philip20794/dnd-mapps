import type { MapObjectDefinition } from '@/map-objects'
import type { MaterialAreaDefinition, MaterialId, MaterialLayerDefinition } from './types'

const presetMaterials: Readonly<Record<string, MaterialId>> = {
  'packed-earth': 'dirt',
  'dark-earth': 'ash',
  'cave-ground': 'stone',
  meadow: 'grass',
  'forest-floor': 'forest-floor',
  'dirt-path': 'dirt',
  'muddy-ruts': 'mud',
  cobblestone: 'stone',
  'stone-tiles': 'dungeon-stone',
  'cracked-tiles': 'dungeon-stone',
  'mossy-stone': 'stone',
  'wet-stone': 'stone',
  'grave-dust': 'ash',
  'loose-gravel': 'stone',
  'burnt-ground': 'volcanic',
  'leaf-litter': 'forest-floor',
  'field-stubble': 'grass',
  'shallow-mud': 'mud',
  'wood-planks': 'wood',
  sand: 'sand',
  snow: 'snow',
  marsh: 'mud',
}

export const materialForMapObject = (object: MapObjectDefinition): MaterialId | undefined => {
  if (object.type === 'water')
    return object.tags?.includes('standing-water') ? 'deep-water' : 'shallow-water'
  if (object.type === 'river') return 'shallow-water'
  if (object.type !== 'ground-area') return undefined
  return presetMaterials[object.preset ?? ''] ?? 'dirt'
}

export interface ExtractMaterialLayerResult {
  readonly materialLayer?: MaterialLayerDefinition
  readonly objects: readonly MapObjectDefinition[]
}

/** Moves static ground into a compact material layer; animated water overlays remain MapObjects. */
export const extractMaterialLayer = (
  objects: readonly MapObjectDefinition[],
  options: {
    readonly id: string
    readonly levelId: string
    readonly seed: number
    readonly chunkSize?: number
  },
): ExtractMaterialLayerResult => {
  const areas: MaterialAreaDefinition[] = []
  const remaining: MapObjectDefinition[] = []
  objects.forEach((object, index) => {
    const material = materialForMapObject(object)
    if (!material) {
      remaining.push(object)
      return
    }
    if ((object.levelId ?? options.levelId) !== options.levelId) {
      remaining.push(object)
      return
    }
    areas.push({
      id: object.id ?? `${options.id}-area-${index + 1}`,
      material,
      position: object.position,
      width: object.width ?? 1,
      height: object.height ?? 1,
      rotation: [0, 90, 180, 270].includes(object.rotation ?? 0)
        ? (object.rotation as 0 | 90 | 180 | 270)
        : undefined,
      scale: object.scale,
      tint: object.color,
      alpha: object.type === 'ground-area' ? object.alpha : Math.min(0.78, object.alpha ?? 0.72),
      transition: object.type === 'water' || object.type === 'river' ? 'shore' : undefined,
      tags: object.tags,
    })
    if (object.type === 'water' || object.type === 'river') remaining.push(object)
  })
  return {
    materialLayer:
      areas.length > 0
        ? {
            id: options.id,
            levelId: options.levelId,
            seed: options.seed >>> 0,
            chunkSize: options.chunkSize ?? 16,
            areas,
          }
        : undefined,
    objects: remaining,
  }
}
