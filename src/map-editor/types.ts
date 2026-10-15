import type { MapObjectDefinition } from '@/map-objects'
import type { MaterialDecalKind, MaterialId, MaterialTransitionStyle } from '@/map-materials'

export type MapEditorTool =
  | 'select'
  | 'object'
  | 'wall'
  | 'door'
  | 'material-select'
  | 'material-brush'
  | 'material-eraser'
  | 'material-decal'

export type MaterialBrushSize = 'small' | 'medium' | 'large'

export type MapEditorSelection =
  | { readonly kind: 'object'; readonly id: string }
  | { readonly kind: 'wall'; readonly id: string }
  | { readonly kind: 'door'; readonly id: string }
  | { readonly kind: 'material-area'; readonly id: string; readonly layerId: string }
  | { readonly kind: 'material-decal'; readonly id: string; readonly layerId: string }

export interface MapObjectLibraryEntry {
  readonly type: string
  readonly preset: string
  readonly label: string
  readonly definition: Pick<MapObjectDefinition, 'type' | 'preset'>
}

export interface MapEditorState {
  readonly tool: MapEditorTool
  readonly selection: MapEditorSelection | null
  readonly snap: boolean
  readonly objectTemplate: Pick<MapObjectDefinition, 'type' | 'preset'> | null
  readonly material?: MaterialId
  readonly brushSize?: MaterialBrushSize
  readonly materialVariant?: number
  readonly materialRotation?: 0 | 90 | 180 | 270
  readonly materialScale?: number
  readonly materialAlpha?: number
  readonly materialTint?: number
  readonly materialTransition?: MaterialTransitionStyle
  readonly decalKind?: MaterialDecalKind
}
