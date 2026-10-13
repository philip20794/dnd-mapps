import { Container } from 'pixi.js'
import type { MapLayerName } from '@/map-objects'

export const layerOrder: readonly MapLayerName[] = [
  'background',
  'materialBase',
  'floor',
  'materialEdges',
  'grid',
  'terrainStatic',
  'materialDecals',
  'terrainAnimated',
  'objectsStatic',
  'interactiveObjects',
  'wallsDoors',
  'effects',
  'spellEffects',
  'tokens',
  'light',
  'fog',
  'selection',
]

export type PixiLayerMap = Readonly<Record<MapLayerName, Container>>

export const createLayerMap = (): PixiLayerMap => {
  const entries = layerOrder.map(
    (layerName) => [layerName, new Container({ label: layerName })] as const,
  )
  return Object.fromEntries(entries) as PixiLayerMap
}
