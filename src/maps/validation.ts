import type { MapObjectRegistry } from '@/map-objects'
import { validateMapObject } from '@/map-objects'
import { entryLevelId, getDefaultLevelId } from './api'
import type { MapDefinition } from './api'
import { validateMaterialLayer } from '@/map-materials'

export class MapValidationError extends Error {
  public readonly mapId: string

  public constructor(mapId: string, messages: readonly string[]) {
    super(`Karte "${mapId}" ist ungültig:\n${messages.join('\n')}`)
    this.name = 'MapValidationError'
    this.mapId = mapId
  }
}

export const validateMapDefinition = (
  map: MapDefinition,
  registry: MapObjectRegistry,
): readonly string[] => {
  const errors: string[] = []

  if (!map.id.trim()) {
    errors.push('Karten-ID fehlt.')
  }

  if (!map.name.trim()) {
    errors.push(`Karte "${map.id}" hat keinen Anzeigenamen.`)
  }

  if (map.width <= 0 || map.height <= 0 || map.gridSize <= 0) {
    errors.push(`Karte "${map.id}" hat ungültige Kartenmaße oder Rastergröße.`)
  }

  const levelIds = new Set(map.levels?.map((level) => level.id) ?? [getDefaultLevelId(map)])
  if (map.levels) {
    const seenLevelIds = new Set<string>()
    for (const level of map.levels) {
      if (!level.id.trim()) {
        errors.push(`Karte "${map.id}" enthält eine Ebene ohne ID.`)
      }
      if (!level.name.trim()) {
        errors.push(`Ebene "${level.id}" hat keinen Anzeigenamen.`)
      }
      if (seenLevelIds.has(level.id)) {
        errors.push(`Ebenen-ID "${level.id}" ist doppelt vorhanden.`)
      }
      seenLevelIds.add(level.id)
    }
    if (map.defaultLevelId && !levelIds.has(map.defaultLevelId)) {
      errors.push(`Standardebene "${map.defaultLevelId}" ist nicht definiert.`)
    }
  }

  const objectIds = new Set<string>()
  const materialLayerIds = new Set<string>()
  for (const layer of map.materialLayers ?? []) {
    if (materialLayerIds.has(layer.id))
      errors.push(`Material-Layer-ID "${layer.id}" ist doppelt vorhanden.`)
    materialLayerIds.add(layer.id)
    if (!levelIds.has(entryLevelId(layer, map)))
      errors.push(`Material-Layer "${layer.id}" referenziert eine unbekannte Ebene.`)
    errors.push(...validateMaterialLayer(layer, map.width, map.height))
  }

  map.objects.forEach((object, index) => {
    const objectId = object.id ?? `${object.type}-${index}`
    if (object.id) {
      if (objectIds.has(object.id)) {
        errors.push(`Objekt-ID "${object.id}" ist doppelt vorhanden.`)
      }
      objectIds.add(object.id)
    }

    if (object.position.x < 0 || object.position.y < 0) {
      errors.push(`Objekt "${objectId}" liegt außerhalb der Karte.`)
    }
    if (
      object.position.x + (object.width ?? 1) > map.width ||
      object.position.y + (object.height ?? 1) > map.height
    ) {
      errors.push(`Objekt "${objectId}" überschreitet die Kartenmaße.`)
    }
    if (!levelIds.has(entryLevelId(object, map))) {
      errors.push(`Objekt "${objectId}" referenziert eine unbekannte Ebene.`)
    }
    if (object.transition) {
      if (!levelIds.has(object.transition.targetLevelId)) {
        errors.push(`Objekt "${objectId}" verweist auf eine unbekannte Zielebene.`)
      }
      const target = object.transition.targetPosition
      if (target.x < 0 || target.y < 0 || target.x > map.width || target.y > map.height) {
        errors.push(`Objekt "${objectId}" hat eine ungültige Zielposition für den Ebenenwechsel.`)
      }
    }
    errors.push(
      ...validateMapObject(object, registry).map((error) => `Objekt "${objectId}": ${error}`),
    )
  })

  const doorIds = new Set<string>()
  for (const door of map.doors) {
    if (doorIds.has(door.id)) {
      errors.push(`Tür-ID "${door.id}" ist doppelt vorhanden.`)
    }
    doorIds.add(door.id)
    if (!objectIds.has(door.id)) {
      errors.push(`Tür "${door.id}" hat kein zugehöriges Kartenobjekt mit derselben ID.`)
    }
  }

  for (const door of map.doors) {
    if (!levelIds.has(entryLevelId(door, map))) {
      errors.push(`Tür "${door.id}" referenziert eine unbekannte Ebene.`)
    }
  }

  for (const wall of map.walls) {
    if (
      wall.a.x < 0 ||
      wall.a.y < 0 ||
      wall.b.x < 0 ||
      wall.b.y < 0 ||
      wall.a.x > map.width ||
      wall.b.x > map.width ||
      wall.a.y > map.height ||
      wall.b.y > map.height
    ) {
      errors.push(
        `Wandsegment "${wall.id ?? `${wall.a.x},${wall.a.y}`}" liegt außerhalb der Karte.`,
      )
    }
  }

  for (const wall of map.walls) {
    if (!levelIds.has(entryLevelId(wall, map))) {
      errors.push(
        `Wandsegment "${wall.id ?? `${wall.a.x},${wall.a.y}`}" referenziert eine unbekannte Ebene.`,
      )
    }
  }

  for (const spawn of map.spawnPoints) {
    if (
      spawn.position.x < 0 ||
      spawn.position.y < 0 ||
      spawn.position.x > map.width ||
      spawn.position.y > map.height
    ) {
      errors.push(`Spawnpunkt "${spawn.id}" liegt außerhalb der Karte.`)
    }
  }

  for (const spawn of map.spawnPoints) {
    if (!levelIds.has(entryLevelId(spawn, map))) {
      errors.push(`Spawnpunkt "${spawn.id}" referenziert eine unbekannte Ebene.`)
    }
  }

  for (const token of map.startTokens ?? []) {
    if (!levelIds.has(token.levelId ?? getDefaultLevelId(map))) {
      errors.push(`Start-Token "${token.id}" referenziert eine unbekannte Ebene.`)
    }
  }

  return errors
}
