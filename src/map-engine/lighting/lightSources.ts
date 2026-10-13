import { entryLevelId, getDefaultLevelId } from '@/maps/api'
import type { DoorState, MapDefinition } from '@/maps/api'
import { resolveMapObject, type MapObjectRegistry } from '@/map-objects'
import type { GridPoint } from '@/types/geometry'

export interface FogRadialLightSource {
  readonly kind?: 'radial'
  readonly id: string
  readonly position: GridPoint
  readonly range: number
}

export interface FogDaylightAreaSource {
  readonly kind: 'daylight-area'
  readonly id: string
  readonly bounds: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
}

export type FogLightSource = FogRadialLightSource | FogDaylightAreaSource

export const collectFogLightSources = (
  map: MapDefinition,
  doorStates: Readonly<Record<string, DoorState>>,
  registry: MapObjectRegistry,
  levelId = getDefaultLevelId(map),
): readonly FogLightSource[] =>
  map.objects.flatMap<FogLightSource>((object, index): readonly FogLightSource[] => {
    if (entryLevelId(object, map) !== levelId) {
      return []
    }

    const doorState = object.id ? doorStates[object.id] : undefined
    const definition = resolveMapObject(
      doorState ? { ...object, interactionState: doorState } : object,
      registry,
      index,
    )

    if (!definition.visible) {
      return []
    }

    if (definition.type === 'daylight-area' || definition.tags.includes('daylight')) {
      return [
        {
          kind: 'daylight-area',
          id: definition.id,
          bounds: {
            x: definition.position.x,
            y: definition.position.y,
            width: definition.width,
            height: definition.height,
          },
        },
      ]
    }

    if (!definition.light || definition.light.range <= 0) {
      return []
    }

    return [
      {
        kind: 'radial',
        id: definition.id,
        position: {
          x: definition.position.x + definition.width / 2,
          y: definition.position.y + definition.height / 2,
        },
        range: definition.light.range,
      },
    ]
  })
