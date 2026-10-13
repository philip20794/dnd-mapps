import type { RenderContext, ResolvedMapObject, RuntimeMapObject } from './types'
import type { MapObjectDefinition } from './types'
import { mergeObjectDefinition } from './defaults'
import { MapObjectRegistry } from './registry'

export const resolveMapObject = (
  definition: MapObjectDefinition,
  registry: MapObjectRegistry,
  index: number,
): ResolvedMapObject => {
  const registration = registry.require(definition.type)
  const presetDefaults = definition.preset
    ? registry.requirePreset(definition.type, definition.preset).defaults
    : {}

  return mergeObjectDefinition(
    definition.id ?? `${definition.type}-${index}`,
    registration.defaults,
    presetDefaults,
    definition,
  )
}

export const validateMapObject = (
  definition: MapObjectDefinition,
  registry: MapObjectRegistry,
): readonly string[] => {
  const registration = registry.get(definition.type)
  if (!registration) {
    return [`Unbekannter Objekttyp "${definition.type}".`]
  }

  if (definition.preset && !registry.getPreset(definition.type, definition.preset)) {
    return [`Unbekanntes Preset "${definition.preset}" für Objekttyp "${definition.type}".`]
  }

  return registration.validate(definition)
}

export const createRuntimeObject = (
  definition: ResolvedMapObject,
  registry: MapObjectRegistry,
  context: RenderContext,
): RuntimeMapObject => registry.require(definition.type).render(definition, context)

export const serializeMapObject = (
  definition: ResolvedMapObject,
  registry: MapObjectRegistry,
): MapObjectDefinition => {
  const registration = registry.require(definition.type)
  return (
    registration.serialize?.(definition) ?? {
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
      blocksSight: definition.blocksSight,
      blocksMovement: definition.blocksMovement,
      interactionState: definition.interactionState,
      transition: definition.transition,
    }
  )
}
