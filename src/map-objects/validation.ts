import type { MapObjectDefinition } from './types'

export const validateBaseObject = (definition: MapObjectDefinition): readonly string[] => {
  const errors: string[] = []

  if (!definition.type.trim()) {
    errors.push('Objekttyp fehlt.')
  }

  if (!Number.isFinite(definition.position.x) || !Number.isFinite(definition.position.y)) {
    errors.push(`Objekt "${definition.id ?? definition.type}" hat eine ungültige Position.`)
  }

  if (definition.width !== undefined && definition.width <= 0) {
    errors.push(`Objekt "${definition.id ?? definition.type}" hat eine ungültige Breite.`)
  }

  if (definition.height !== undefined && definition.height <= 0) {
    errors.push(`Objekt "${definition.id ?? definition.type}" hat eine ungültige Höhe.`)
  }

  return errors
}
