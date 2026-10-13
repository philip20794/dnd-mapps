import { MapObjectRegistry } from './registry'
import { registerDoorObjects } from './objects/doorObjects'
import { registerDungeonPropObjects } from './objects/dungeonPropObjects'
import { registerFireObjects } from './objects/fireObjects'
import { registerGroundObjects } from './objects/groundObjects'
import { registerStaticObjects } from './objects/staticObjects'
import { registerWaterAndEffectObjects } from './objects/waterAndEffectObjects'

export const createDefaultObjectRegistry = (): MapObjectRegistry => {
  const registry = new MapObjectRegistry()
  registerGroundObjects(registry)
  registerStaticObjects(registry)
  registerDungeonPropObjects(registry)
  registerDoorObjects(registry)
  registerFireObjects(registry)
  registerWaterAndEffectObjects(registry)
  return registry
}

export * from './factory'
export * from './registry'
export type * from './types'
