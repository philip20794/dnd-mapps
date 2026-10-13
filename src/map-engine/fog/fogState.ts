import type { Polygon } from '@/types/geometry'

export interface FogStateData {
  enabled: boolean
  persistExploration: boolean
  exploredByMap: Record<string, readonly Polygon[]>
}

export const defaultFogState: FogStateData = {
  enabled: false,
  persistExploration: true,
  exploredByMap: {},
}

const polygonsEqual = (left: Polygon, right: Polygon): boolean =>
  left.length === right.length &&
  left.every((point, index) => point.x === right[index]?.x && point.y === right[index]?.y)

const endsWithPolygons = (
  existing: readonly Polygon[],
  additions: readonly Polygon[],
): boolean =>
  additions.length <= existing.length &&
  additions.every((polygon, index) =>
    polygonsEqual(existing[existing.length - additions.length + index] ?? [], polygon),
  )

export const recordExploration = (
  state: FogStateData,
  mapId: string,
  visiblePolygons: readonly Polygon[],
): FogStateData => {
  if (!state.persistExploration || visiblePolygons.length === 0) {
    return state
  }

  const existing = state.exploredByMap[mapId] ?? []
  if (endsWithPolygons(existing, visiblePolygons)) {
    return state
  }
  const combined = [...existing, ...visiblePolygons].slice(-160)

  return {
    ...state,
    exploredByMap: {
      ...state.exploredByMap,
      [mapId]: combined,
    },
  }
}

export const clearExplorationForMap = (state: FogStateData, mapId: string): FogStateData => {
  const { [mapId]: _removed, ...remaining } = state.exploredByMap
  return {
    ...state,
    exploredByMap: remaining,
  }
}

export const visibleAndExploredPolygons = (
  state: FogStateData,
  mapId: string,
  currentVisible: readonly Polygon[],
): { readonly visible: readonly Polygon[]; readonly explored: readonly Polygon[] } => ({
  visible: currentVisible,
  explored: state.persistExploration ? (state.exploredByMap[mapId] ?? []) : [],
})
