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

export const recordExploration = (
  state: FogStateData,
  mapId: string,
  visiblePolygons: readonly Polygon[],
): FogStateData => {
  if (!state.persistExploration || visiblePolygons.length === 0) {
    return state
  }

  const existing = state.exploredByMap[mapId] ?? []
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
