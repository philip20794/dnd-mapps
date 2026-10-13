import { createDefaultObjectRegistry } from '@/map-objects'
import type { MapDefinition } from './api'
import { MapValidationError, validateMapDefinition } from './validation'

interface MapModule {
  readonly default: MapDefinition
}

const modules = import.meta.glob<MapModule>('./*.map.ts', { eager: true })

export const loadMapDefinitions = (): readonly MapDefinition[] => {
  const registry = createDefaultObjectRegistry()
  const maps = Object.entries(modules).map(([path, module]) => {
    if (!module.default) {
      throw new MapValidationError(path, ['Modul exportiert keine Standard-Kartendefinition.'])
    }
    return module.default
  })

  const ids = new Set<string>()
  for (const map of maps) {
    if (ids.has(map.id)) {
      throw new MapValidationError(map.id, [`Doppelte Karten-ID "${map.id}".`])
    }
    ids.add(map.id)

    const errors = validateMapDefinition(map, registry)
    if (errors.length > 0) {
      throw new MapValidationError(map.id, errors)
    }
  }

  return maps.sort((left, right) => left.name.localeCompare(right.name, 'de'))
}
