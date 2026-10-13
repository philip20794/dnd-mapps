import type { MapObjectDefinition, ResolvedMapObject } from './types'

export const baseObjectDefaults: Omit<
  ResolvedMapObject,
  'id' | 'type' | 'position' | 'preset' | 'texture' | 'variant' | 'label'
> = {
  width: 1,
  height: 1,
  rotation: 0,
  scale: 1,
  visible: true,
  layer: 'objectsStatic',
  tags: [],
  blocksSight: false,
  blocksMovement: false,
  interactionState: 'idle',
  color: 0x9ca3af,
  secondaryColor: 0x1f2937,
  alpha: 1,
  light: null,
  animation: null,
  water: null,
  sparks: false,
}

export const mergeObjectDefinition = (
  id: string,
  typeDefaults: Partial<MapObjectDefinition>,
  presetDefaults: Partial<MapObjectDefinition>,
  definition: MapObjectDefinition,
): ResolvedMapObject => ({
  ...baseObjectDefaults,
  ...typeDefaults,
  ...presetDefaults,
  ...definition,
  id,
  type: definition.type,
  position: definition.position,
  tags: [...(typeDefaults.tags ?? []), ...(presetDefaults.tags ?? []), ...(definition.tags ?? [])],
  light: definition.light ?? presetDefaults.light ?? typeDefaults.light ?? baseObjectDefaults.light,
  animation:
    definition.animation ??
    presetDefaults.animation ??
    typeDefaults.animation ??
    baseObjectDefaults.animation,
  water: definition.water ?? presetDefaults.water ?? typeDefaults.water ?? baseObjectDefaults.water,
})
