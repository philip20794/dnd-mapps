import { defineStore } from 'pinia'
import { createEditableMapCopy, isCustomMap } from '@/map-editor/mapEditor'
import { prepareMapForEditing } from '@/map-editor/operations'
import type { MapEditorSelection, MapEditorTool, MaterialBrushSize } from '@/map-editor/types'
import type { MapObjectDefinition } from '@/map-objects'
import type { MaterialDecalKind, MaterialId, MaterialTransitionStyle } from '@/map-materials'
import type { MapDefinition } from '@/maps/api'

interface EditorHistoryEntry {
  readonly map: MapDefinition
  readonly dirty: boolean
}

interface MapEditorState {
  active: boolean
  draft: MapDefinition | null
  baseline: MapDefinition | null
  originalMapId: string | null
  levelId: string | null
  dirty: boolean
  past: EditorHistoryEntry[]
  future: EditorHistoryEntry[]
  tool: MapEditorTool
  selection: MapEditorSelection | null
  snap: boolean
  objectTemplate: Pick<MapObjectDefinition, 'type' | 'preset'> | null
  material: MaterialId
  brushSize: MaterialBrushSize
  materialVariant?: number
  materialRotation: 0 | 90 | 180 | 270
  materialScale: number
  materialAlpha: number
  materialTint?: number
  materialTransition?: MaterialTransitionStyle
  decalKind: MaterialDecalKind
}

function cloneMap(map: MapDefinition): MapDefinition {
  return JSON.parse(JSON.stringify(map))
}

export const useMapEditorStore = defineStore('mapEditor', {
  state: (): MapEditorState => ({
    active: false,
    draft: null,
    baseline: null,
    originalMapId: null,
    levelId: null,
    dirty: false,
    past: [],
    future: [],
    tool: 'select',
    selection: null,
    snap: true,
    objectTemplate: null,
    material: 'stone',
    brushSize: 'medium',
    materialRotation: 0,
    materialScale: 1,
    materialAlpha: 1,
    decalKind: 'crack',
  }),
  getters: {
    canUndo: (state): boolean => state.past.length > 0,
    canRedo: (state): boolean => state.future.length > 0,
  },
  actions: {
    enter(source: MapDefinition, existingIds: ReadonlySet<string>, levelId: string): void {
      const sourceDraft = isCustomMap(source)
        ? cloneMap(source)
        : createEditableMapCopy(source, existingIds)
      const draft = prepareMapForEditing(sourceDraft)
      this.active = true
      this.draft = draft
      this.baseline = cloneMap(draft)
      this.originalMapId = source.id
      this.levelId = levelId
      this.dirty = false
      this.past = []
      this.future = []
      this.tool = 'select'
      this.selection = null
      this.snap = true
      this.objectTemplate = null
      this.material = 'stone'
      this.brushSize = 'medium'
      this.materialVariant = undefined
      this.materialRotation = 0
      this.materialScale = 1
      this.materialAlpha = 1
      this.materialTint = undefined
      this.materialTransition = undefined
      this.decalKind = 'crack'
    },
    apply(next: MapDefinition): void {
      if (!this.draft) return
      this.past.push({ map: cloneMap(this.draft), dirty: this.dirty })
      this.draft = cloneMap(next)
      this.dirty = true
      this.future = []
    },
    select(selection: MapEditorSelection | null): void {
      this.selection = selection
    },
    setTool(tool: MapEditorTool): void {
      this.tool = tool
      if (tool !== 'object') this.objectTemplate = null
    },
    setSnap(snap: boolean): void {
      this.snap = snap
    },
    setMaterial(material: MaterialId): void {
      this.material = material
      this.tool = 'material-brush'
    },
    setBrushSize(size: MaterialBrushSize): void {
      this.brushSize = size
    },
    setMaterialSettings(settings: {
      variant?: number
      rotation?: 0 | 90 | 180 | 270
      scale?: number
      alpha?: number
      tint?: number
      transition?: MaterialTransitionStyle
    }): void {
      if ('variant' in settings) this.materialVariant = settings.variant
      if (settings.rotation !== undefined) this.materialRotation = settings.rotation
      if (settings.scale !== undefined) this.materialScale = settings.scale
      if (settings.alpha !== undefined) this.materialAlpha = settings.alpha
      if ('tint' in settings) this.materialTint = settings.tint
      if ('transition' in settings) this.materialTransition = settings.transition
    },
    setDecalKind(kind: MaterialDecalKind): void {
      this.decalKind = kind
      this.tool = 'material-decal'
    },
    beginObjectPlacement(template: Pick<MapObjectDefinition, 'type' | 'preset'>): void {
      this.tool = 'object'
      this.objectTemplate = { ...template }
    },
    rename(name: string): void {
      const trimmed = name.trim()
      if (!this.draft || !trimmed || trimmed === this.draft.name) return
      this.apply({ ...this.draft, name: trimmed })
    },
    undo(): void {
      const entry = this.past.pop()
      if (!entry || !this.draft) return
      this.future.push({ map: cloneMap(this.draft), dirty: this.dirty })
      this.draft = cloneMap(entry.map)
      this.dirty = entry.dirty
      this.dropMissingSelection()
    },
    redo(): void {
      const entry = this.future.pop()
      if (!entry || !this.draft) return
      this.past.push({ map: cloneMap(this.draft), dirty: this.dirty })
      this.draft = cloneMap(entry.map)
      this.dirty = entry.dirty
      this.dropMissingSelection()
    },
    markSaved(savedMap: MapDefinition): void {
      this.draft = cloneMap(savedMap)
      this.baseline = cloneMap(savedMap)
      this.originalMapId = savedMap.id
      this.dirty = false
      this.past = []
      this.future = []
      this.selection = null
    },
    discardChanges(): void {
      if (!this.baseline) return
      this.draft = cloneMap(this.baseline)
      this.dirty = false
      this.past = []
      this.future = []
      this.selection = null
    },
    setLevel(levelId: string): void {
      if (!this.draft) return
      if (this.draft.levels && !this.draft.levels.some((level) => level.id === levelId)) {
        throw new Error(`Unbekannte Ebene "${levelId}" im Kartenentwurf.`)
      }
      this.levelId = levelId
      this.selection = null
    },
    dropMissingSelection(): void {
      if (!this.draft || !this.selection) return
      const selection = this.selection
      const exists =
        selection.kind === 'object'
          ? this.draft.objects.some((object) => object.id === selection.id)
          : selection.kind === 'wall'
            ? this.draft.walls.some((wall) => wall.id === selection.id)
            : selection.kind === 'door'
              ? this.draft.doors.some((door) => door.id === selection.id)
              : this.draft.materialLayers?.some(
                  (layer) =>
                    layer.id === selection.layerId &&
                    (selection.kind === 'material-area'
                      ? layer.areas.some((area) => area.id === selection.id)
                      : (layer.decals ?? []).some((decal) => decal.id === selection.id)),
                )
      if (!exists) this.selection = null
    },
    leave(): void {
      this.active = false
      this.draft = null
      this.baseline = null
      this.originalMapId = null
      this.levelId = null
      this.dirty = false
      this.past = []
      this.future = []
      this.tool = 'select'
      this.selection = null
      this.snap = true
      this.objectTemplate = null
      this.material = 'stone'
      this.brushSize = 'medium'
      this.materialVariant = undefined
      this.materialRotation = 0
      this.materialScale = 1
      this.materialAlpha = 1
      this.materialTint = undefined
      this.materialTransition = undefined
      this.decalKind = 'crack'
    },
  },
})
