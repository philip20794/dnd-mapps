<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type {
  MapEditorSelection,
  MapEditorTool,
  MapObjectLibraryEntry,
  MaterialBrushSize,
} from '@/map-editor/types'
import { materialCatalog, materialDecalKinds, materialIds } from '@/map-materials'
import type {
  MaterialAreaDefinition,
  MaterialDecalDefinition,
  MaterialDecalKind,
  MaterialId,
  MaterialTransitionStyle,
} from '@/map-materials'
import type { MapObjectDefinition } from '@/map-objects'
import type { DoorDefinition, MapDefinition, WallDefinition } from '@/maps/api'

const props = withDefaults(
  defineProps<{
    map: MapDefinition
    mapName: string
    dirty: boolean
    canUndo: boolean
    canRedo: boolean
    tool: MapEditorTool
    snap: boolean
    selection: MapEditorSelection | null
    objectLibrary: readonly MapObjectLibraryEntry[]
    material?: MaterialId
    brushSize?: MaterialBrushSize
    materialVariant?: number
    materialRotation?: 0 | 90 | 180 | 270
    materialScale?: number
    materialAlpha?: number
    materialTint?: number
    materialTransition?: MaterialTransitionStyle
    decalKind?: MaterialDecalKind
  }>(),
  {
    material: 'stone',
    brushSize: 'medium',
    materialRotation: 0,
    materialScale: 1,
    materialAlpha: 1,
    decalKind: 'crack',
  },
)

const emit = defineEmits<{
  rename: [name: string]
  undo: []
  redo: []
  save: []
  discard: []
  leave: []
  exportMap: []
  importMap: [json: string]
  error: [message: string]
  toolChange: [tool: MapEditorTool]
  snapChange: [enabled: boolean]
  select: [selection: MapEditorSelection | null]
  beginObjectPlacement: [template: Pick<MapObjectDefinition, 'type' | 'preset'>]
  updateObject: [id: string, patch: Partial<MapObjectDefinition>]
  updateWall: [id: string, patch: Partial<WallDefinition>]
  updateDoor: [id: string, patch: Partial<DoorDefinition>]
  deleteSelection: []
  duplicateSelection: []
  splitWall: []
  materialChange: [material: MaterialId]
  brushSizeChange: [size: MaterialBrushSize]
  materialSettingsChange: [
    settings: {
      variant?: number
      rotation?: 0 | 90 | 180 | 270
      scale?: number
      alpha?: number
      tint?: number
      transition?: MaterialTransitionStyle
    },
  ]
  decalKindChange: [kind: MaterialDecalKind]
  updateMaterialArea: [layerId: string, id: string, patch: Partial<MaterialAreaDefinition>]
  updateMaterialDecal: [layerId: string, id: string, patch: Partial<MaterialDecalDefinition>]
}>()

const name = ref(props.mapName)
const importInput = ref<HTMLInputElement | null>(null)
const librarySearch = ref('')
const panelOpen = ref(true)
const isCompactEditor = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches

const selectedObject = computed(() =>
  props.selection?.kind === 'object'
    ? (props.map.objects.find((object) => object.id === props.selection?.id) ?? null)
    : null,
)
const selectedWall = computed(() =>
  props.selection?.kind === 'wall'
    ? (props.map.walls.find((wall) => wall.id === props.selection?.id) ?? null)
    : null,
)
const selectedDoor = computed(() =>
  props.selection?.kind === 'door'
    ? (props.map.doors.find((door) => door.id === props.selection?.id) ?? null)
    : null,
)
const selectedMaterialArea = computed(() => {
  const selection = props.selection
  if (selection?.kind !== 'material-area') return null
  return (
    props.map.materialLayers
      ?.find((layer) => layer.id === selection.layerId)
      ?.areas.find((area) => area.id === selection.id) ?? null
  )
})
const selectedMaterialDecal = computed(() => {
  const selection = props.selection
  if (selection?.kind !== 'material-decal') return null
  return (
    props.map.materialLayers
      ?.find((layer) => layer.id === selection.layerId)
      ?.decals?.find((decal) => decal.id === selection.id) ?? null
  )
})
const materialLabels: Readonly<Record<MaterialId, string>> = {
  grass: 'Gras',
  'forest-floor': 'Waldboden',
  dirt: 'Erde',
  mud: 'Schlamm',
  stone: 'Stein',
  'dungeon-stone': 'Dungeon-Stein',
  sand: 'Sand',
  snow: 'Schnee',
  volcanic: 'Vulkanisch',
  ash: 'Asche',
  'shallow-water': 'Flaches Wasser',
  'deep-water': 'Tiefes Wasser',
  wood: 'Holz',
}
const decalLabels: Readonly<Record<MaterialDecalKind, string>> = {
  dirt: 'Schmutz',
  crack: 'Risse',
  moss: 'Moos',
  leaves: 'Laub',
  'small-stones': 'Steine',
  irregularity: 'Unregelmäßig',
  'shore-detail': 'Uferdetail',
}
const materialTool = computed(() => props.tool.startsWith('material-'))
const toolEntries = [
  { id: 'select', icon: '↖', label: 'Auswählen' },
  { id: 'object', icon: '▣', label: 'Objekte' },
  { id: 'wall', icon: '╱', label: 'Wand' },
  { id: 'door', icon: '▯', label: 'Tür' },
  { id: 'material-brush', icon: '✎', label: 'Gelände' },
  { id: 'material-eraser', icon: '◇', label: 'Radierer' },
  { id: 'material-decal', icon: '✦', label: 'Dekoration' },
  { id: 'material-select', icon: '◉', label: 'Material' },
] as const satisfies readonly { id: MapEditorTool; icon: string; label: string }[]
const toolHint = computed(() => {
  if (props.tool === 'wall') return 'Wähle den ersten Wandpunkt, danach den Endpunkt.'
  if (props.tool === 'door') return 'Tippe auf eine bestehende Wand, um dort eine Tür einzusetzen.'
  if (props.tool === 'object')
    return 'Wähle ein Objekt und tippe oder ziehe es auf die Karte. Escape bricht ab.'
  if (props.tool === 'material-brush') return 'Ziehe über die Karte, um Gelände zu malen.'
  if (props.tool === 'material-eraser')
    return 'Ziehe über Material, um die oberste Fläche zu entfernen.'
  if (props.tool === 'material-decal') return 'Wähle eine Dekoration und tippe auf die Karte.'
  if (props.tool === 'material-select')
    return 'Tippe auf Material oder Dekoration, um Eigenschaften zu ändern.'
  return 'Tippe auf ein Element. Erneutes Tippen wechselt überlappende Elemente.'
})
const filteredLibrary = computed(() => {
  const query = librarySearch.value.trim().toLocaleLowerCase('de')
  return query
    ? props.objectLibrary.filter((entry) =>
        `${entry.label} ${entry.type}`.toLocaleLowerCase('de').includes(query),
      )
    : props.objectLibrary
})
const objectCategories = computed(() => {
  const categories = [
    { id: 'furniture', label: 'Möbel', entries: [] as MapObjectLibraryEntry[] },
    { id: 'nature', label: 'Natur', entries: [] as MapObjectLibraryEntry[] },
    { id: 'light', label: 'Licht', entries: [] as MapObjectLibraryEntry[] },
    { id: 'dungeon', label: 'Dungeon', entries: [] as MapObjectLibraryEntry[] },
    { id: 'other', label: 'Weitere', entries: [] as MapObjectLibraryEntry[] },
  ]
  for (const entry of filteredLibrary.value) {
    const key = `${entry.type} ${entry.preset} ${entry.label}`.toLocaleLowerCase('de')
    const category =
      categories.find(
        (item) =>
          item.id ===
          (/torch|lamp|light|fire|candle|brazer|brazier/.test(key)
            ? 'light'
            : /tree|bush|rock|plant|mushroom|grass|nature|stump/.test(key)
              ? 'nature'
              : /table|chair|bed|shelf|barrel|crate|bench|furniture/.test(key)
                ? 'furniture'
                : /altar|pillar|statue|trap|rubble|bone|coffin|dungeon|stairs/.test(key)
                  ? 'dungeon'
                  : 'other'),
      ) ?? categories[4]!
    category.entries.push(entry)
  }
  return categories.filter((category) => category.entries.length > 0)
})
const levels = computed(() => props.map.levels ?? [])

watch(
  () => props.mapName,
  (mapName) => (name.value = mapName),
)

watch(
  () => props.selection,
  (selection) => {
    if (selection && isCompactEditor()) panelOpen.value = true
  },
)

onMounted(() => {
  if (isCompactEditor()) panelOpen.value = false
})

function chooseTool(tool: MapEditorTool): void {
  emit('toolChange', tool)
  if (isCompactEditor() && (tool === 'object' || tool.startsWith('material-'))) {
    panelOpen.value = true
  }
}

function commitName(): void {
  const trimmed = name.value.trim()
  if (!trimmed) name.value = props.mapName
  else emit('rename', trimmed)
}

function save(): void {
  commitName()
  emit('save')
}

async function importFile(event: Event): Promise<void> {
  if (!(event.currentTarget instanceof HTMLInputElement)) return
  const file = event.currentTarget.files?.[0]
  event.currentTarget.value = ''
  if (!file) return
  try {
    emit('importMap', await file.text())
  } catch {
    emit('error', 'Die Kartendatei konnte nicht gelesen werden.')
  }
}

const numberValue = (event: Event): number =>
  Number((event.currentTarget as HTMLInputElement).value)
const checkedValue = (event: Event): boolean => (event.currentTarget as HTMLInputElement).checked
const stringValue = (event: Event): string =>
  (event.currentTarget as HTMLInputElement | HTMLSelectElement).value
const colorHex = (color: number | undefined): string =>
  `#${(color ?? 0x9ca3af).toString(16).padStart(6, '0').slice(-6)}`
const colorNumber = (event: Event): number => Number.parseInt(stringValue(event).slice(1), 16)

function beginObject(entry: MapObjectLibraryEntry): void {
  emit('beginObjectPlacement', entry.definition)
  if (isCompactEditor()) panelOpen.value = false
}

function dragObject(event: DragEvent, entry: MapObjectLibraryEntry): void {
  event.dataTransfer?.setData('application/x-map-object-preset', JSON.stringify(entry.definition))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function toggleLight(enabled: boolean): void {
  const object = selectedObject.value
  if (!object?.id) return
  emit('updateObject', object.id, {
    light: enabled
      ? (object.light ?? { color: object.color ?? 0xffb347, range: 6, intensity: 0.8 })
      : null,
  })
}
</script>

<template>
  <section
    class="map-editor-workspace"
    :class="{ 'panel-open': panelOpen, dirty }"
    data-testid="map-editor-toolbar"
    aria-label="Karteneditor"
  >
    <div class="map-editor-commandbar">
      <div
        class="map-editor-mode"
        :title="dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert'"
        :aria-label="dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert'"
      >
        <strong>Karte bearbeiten</strong>
        <span :class="{ dirty }">{{ dirty ? 'Ungespeicherte Änderungen' : 'Gespeichert' }}</span>
      </div>
      <div class="map-editor-actions" aria-label="Bearbeitungsverlauf">
        <button
          type="button"
          :disabled="!canUndo"
          data-testid="map-editor-undo"
          title="Rückgängig (Strg+Z)"
          @click="emit('undo')"
        >
          ↶ <span>Rückgängig</span>
        </button>
        <button
          type="button"
          :disabled="!canRedo"
          data-testid="map-editor-redo"
          title="Wiederholen (Strg+Y)"
          @click="emit('redo')"
        >
          ↷ <span>Wiederholen</span>
        </button>
      </div>
      <div class="map-editor-actions map-editor-primary-actions">
        <button
          type="button"
          class="primary"
          data-testid="map-editor-save"
          title="Karte speichern"
          @click="save"
        >
          Speichern
        </button>
        <button
          type="button"
          data-testid="map-editor-discard"
          title="Änderungen verwerfen"
          @click="emit('discard')"
        >
          Verwerfen
        </button>
        <button
          type="button"
          :disabled="dirty"
          data-testid="map-editor-leave"
          title="Editor verlassen"
          @click="emit('leave')"
        >
          Editor verlassen
        </button>
        <button
          type="button"
          class="map-editor-panel-toggle"
          :aria-expanded="panelOpen"
          @click="panelOpen = !panelOpen"
        >
          {{ panelOpen ? 'Panel schließen' : 'Panel öffnen' }}
        </button>
      </div>
    </div>

    <nav class="map-editor-toolrail" aria-label="Werkzeuge">
      <button
        v-for="entry in toolEntries"
        :key="entry.id"
        type="button"
        :class="{ active: tool === entry.id }"
        :title="entry.label"
        :aria-label="entry.label"
        :aria-pressed="tool === entry.id"
        :data-testid="`map-editor-tool-${entry.id}`"
        @click="chooseTool(entry.id)"
      >
        <span class="map-editor-tool-icon" aria-hidden="true">{{ entry.icon }}</span>
        <span class="map-editor-tool-label">{{ entry.label }}</span>
      </button>
      <label class="map-editor-snap" title="Positionen am Raster einrasten">
        <input
          type="checkbox"
          :checked="snap"
          data-testid="map-editor-snap"
          @change="emit('snapChange', checkedValue($event))"
        />
        <span>Raster</span>
      </label>
      <button
        v-if="tool === 'object'"
        type="button"
        class="map-editor-cancel-tool"
        @click="chooseTool('select')"
      >
        × <span>Abbrechen</span>
      </button>
    </nav>

    <aside v-if="panelOpen" class="map-editor-context-panel" data-testid="map-editor-context-panel">
      <header class="map-editor-context-header">
        <div>
          <strong>{{
            selection ? 'Eigenschaften' : toolEntries.find((entry) => entry.id === tool)?.label
          }}</strong>
          <small>{{ toolHint }}</small>
        </div>
        <button type="button" aria-label="Kontextpanel schließen" @click="panelOpen = false">
          ×
        </button>
      </header>
      <div class="map-editor-context-scroll">
        <div class="map-editor-body">
          <section
            v-if="tool === 'object'"
            class="map-editor-library"
            aria-label="Objektbibliothek"
          >
            <label
              >Objektbibliothek
              <input
                v-model="librarySearch"
                type="search"
                placeholder="Preset suchen"
                data-testid="map-editor-library-search"
            /></label>
            <div class="map-editor-library-categories">
              <section
                v-for="category in objectCategories"
                :key="category.id"
                class="map-editor-library-category"
              >
                <h3>{{ category.label }}</h3>
                <div class="map-editor-library-list">
                  <button
                    v-for="entry in category.entries"
                    :key="`${entry.type}:${entry.preset}`"
                    type="button"
                    draggable="true"
                    :data-testid="`map-editor-preset-${entry.preset}`"
                    @dragstart="dragObject($event, entry)"
                    @click="beginObject(entry)"
                  >
                    <strong>{{ entry.label }}</strong
                    ><small>{{ entry.type }}</small>
                  </button>
                </div>
              </section>
            </div>
          </section>

          <section
            v-else-if="materialTool"
            class="map-editor-library material-palette"
            aria-label="Materialpalette"
          >
            <strong>Materialien</strong>
            <div class="map-editor-library-list material-list">
              <button
                v-for="id in materialIds"
                :key="id"
                type="button"
                :class="{ active: material === id }"
                :data-testid="`map-editor-material-${id}`"
                @click="emit('materialChange', id)"
              >
                <span
                  class="material-swatch"
                  :style="{
                    backgroundColor: `#${materialCatalog[id].baseColor.toString(16).padStart(6, '0')}`,
                  }"
                />
                <strong>{{ materialLabels[id] }}</strong>
              </button>
            </div>
            <strong>Pinselgröße</strong>
            <div class="map-editor-actions">
              <button
                v-for="size in ['small', 'medium', 'large'] as const"
                :key="size"
                type="button"
                :class="{ active: brushSize === size }"
                :data-testid="`map-editor-brush-${size}`"
                @click="emit('brushSizeChange', size)"
              >
                {{ size === 'small' ? 'Klein' : size === 'medium' ? 'Mittel' : 'Groß' }}
              </button>
            </div>
            <strong>Dekorationen</strong>
            <div class="map-editor-library-list material-list">
              <button
                v-for="kind in materialDecalKinds"
                :key="kind"
                type="button"
                :class="{ active: decalKind === kind }"
                :data-testid="`map-editor-decal-${kind}`"
                @click="emit('decalKindChange', kind)"
              >
                {{ decalLabels[kind] }}
              </button>
            </div>
            <div class="editor-field-grid">
              <label
                >Rotation<select
                  :value="materialRotation"
                  @change="
                    emit('materialSettingsChange', {
                      rotation: Number(stringValue($event)) as 0 | 90 | 180 | 270,
                    })
                  "
                >
                  <option v-for="rotation in [0, 90, 180, 270]" :key="rotation" :value="rotation">
                    {{ rotation }}°
                  </option>
                </select></label
              >
              <label
                >Skalierung<input
                  type="number"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  :value="materialScale"
                  @change="emit('materialSettingsChange', { scale: numberValue($event) })"
              /></label>
              <label
                >Deckkraft<input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="materialAlpha"
                  @change="emit('materialSettingsChange', { alpha: numberValue($event) })"
              /></label>
              <label
                >Übergang<select
                  :value="materialTransition ?? ''"
                  @change="
                    emit('materialSettingsChange', {
                      transition: (stringValue($event) || undefined) as
                        | MaterialTransitionStyle
                        | undefined,
                    })
                  "
                >
                  <option value="">Preset</option>
                  <option value="none">Keiner</option>
                  <option value="soft">Weich</option>
                  <option value="rough">Rau</option>
                  <option value="masonry">Mauerwerk</option>
                  <option value="shore">Ufer</option>
                </select></label
              >
              <label
                >Variante<input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Automatisch"
                  :value="materialVariant ?? ''"
                  @change="
                    emit('materialSettingsChange', {
                      variant: stringValue($event) === '' ? undefined : numberValue($event),
                    })
                  "
              /></label>
              <label
                >Farbton<input
                  type="color"
                  :value="colorHex(materialTint ?? materialCatalog[material].baseColor)"
                  @change="emit('materialSettingsChange', { tint: colorNumber($event) })"
              /></label>
            </div>
          </section>

          <div class="map-editor-properties" data-testid="map-editor-properties">
            <p v-if="!selection && !materialTool && tool !== 'object'">{{ toolHint }}</p>

            <template v-if="selectedObject?.id">
              <h3>Objekt · {{ selectedObject.preset ?? selectedObject.type }}</h3>
              <div class="editor-field-grid">
                <label
                  >X
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedObject.position.x"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        position: { ...selectedObject.position, x: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >Y
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedObject.position.y"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        position: { ...selectedObject.position, y: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >Breite
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    :value="selectedObject.width ?? 1"
                    @change="
                      emit('updateObject', selectedObject.id!, { width: numberValue($event) })
                    "
                /></label>
                <label
                  >Höhe
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    :value="selectedObject.height ?? 1"
                    @change="
                      emit('updateObject', selectedObject.id!, { height: numberValue($event) })
                    "
                /></label>
                <label
                  >Drehung °
                  <input
                    type="number"
                    step="1"
                    :value="Math.round(((selectedObject.rotation ?? 0) * 180) / Math.PI)"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        rotation: (numberValue($event) * Math.PI) / 180,
                      })
                    "
                /></label>
                <label
                  >Skalierung
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    :value="selectedObject.scale ?? 1"
                    @change="
                      emit('updateObject', selectedObject.id!, { scale: numberValue($event) })
                    "
                /></label>
                <label
                  >Farbe
                  <input
                    type="color"
                    :value="colorHex(selectedObject.color)"
                    @change="
                      emit('updateObject', selectedObject.id!, { color: colorNumber($event) })
                    "
                /></label>
                <label v-if="levels.length"
                  >Ebene
                  <select
                    :value="selectedObject.levelId ?? map.defaultLevelId"
                    @change="
                      emit('updateObject', selectedObject.id!, { levelId: stringValue($event) })
                    "
                  >
                    <option v-for="level in levels" :key="level.id" :value="level.id">
                      {{ level.name }}
                    </option>
                  </select></label
                >
              </div>
              <div class="editor-checks">
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedObject.blocksSight ?? false"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        blocksSight: checkedValue($event),
                      })
                    "
                  />
                  Sichtblockade</label
                >
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedObject.blocksMovement ?? false"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        blocksMovement: checkedValue($event),
                      })
                    "
                  />
                  Bewegungsblockade</label
                >
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedObject.light != null"
                    @change="toggleLight(checkedValue($event))"
                  />
                  Licht</label
                >
              </div>
              <div v-if="selectedObject.light" class="editor-field-grid">
                <label
                  >Lichtfarbe
                  <input
                    type="color"
                    :value="colorHex(selectedObject.light.color)"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        light: { ...selectedObject.light!, color: colorNumber($event) },
                      })
                    "
                /></label>
                <label
                  >Reichweite
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    :value="selectedObject.light.range"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        light: { ...selectedObject.light!, range: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >Intensität
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    :value="selectedObject.light.intensity"
                    @change="
                      emit('updateObject', selectedObject.id!, {
                        light: { ...selectedObject.light!, intensity: numberValue($event) },
                      })
                    "
                /></label>
              </div>
              <p v-if="selectedObject.transition" class="editor-transition-note">
                Ebenenwechsel nach „{{ selectedObject.transition.targetLevelId }}“ bleibt beim
                Verschieben erhalten.
              </p>
            </template>

            <template v-else-if="selectedWall?.id">
              <h3>Wand</h3>
              <div class="editor-field-grid">
                <label
                  >A · X
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedWall.a.x"
                    @change="
                      emit('updateWall', selectedWall.id!, {
                        a: { ...selectedWall.a, x: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >A · Y
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedWall.a.y"
                    @change="
                      emit('updateWall', selectedWall.id!, {
                        a: { ...selectedWall.a, y: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >B · X
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedWall.b.x"
                    @change="
                      emit('updateWall', selectedWall.id!, {
                        b: { ...selectedWall.b, x: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >B · Y
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedWall.b.y"
                    @change="
                      emit('updateWall', selectedWall.id!, {
                        b: { ...selectedWall.b, y: numberValue($event) },
                      })
                    "
                /></label>
              </div>
              <div class="editor-checks">
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedWall.blocksSight"
                    @change="
                      emit('updateWall', selectedWall.id!, { blocksSight: checkedValue($event) })
                    "
                  />
                  Blockiert Sicht</label
                >
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedWall.blocksMovement"
                    @change="
                      emit('updateWall', selectedWall.id!, { blocksMovement: checkedValue($event) })
                    "
                  />
                  Blockiert Bewegung</label
                >
              </div>
              <button type="button" data-testid="map-editor-split-wall" @click="emit('splitWall')">
                Wand mittig teilen
              </button>
            </template>

            <template v-else-if="selectedDoor">
              <h3>Tür</h3>
              <label
                >Name
                <input
                  :value="selectedDoor.label"
                  @change="emit('updateDoor', selectedDoor.id, { label: stringValue($event) })"
              /></label>
              <div class="editor-field-grid">
                <label
                  >A · X
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedDoor.segment.a.x"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        segment: {
                          ...selectedDoor.segment,
                          a: { ...selectedDoor.segment.a, x: numberValue($event) },
                        },
                      })
                    "
                /></label>
                <label
                  >A · Y
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedDoor.segment.a.y"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        segment: {
                          ...selectedDoor.segment,
                          a: { ...selectedDoor.segment.a, y: numberValue($event) },
                        },
                      })
                    "
                /></label>
                <label
                  >B · X
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedDoor.segment.b.x"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        segment: {
                          ...selectedDoor.segment,
                          b: { ...selectedDoor.segment.b, x: numberValue($event) },
                        },
                      })
                    "
                /></label>
                <label
                  >B · Y
                  <input
                    type="number"
                    step="0.1"
                    :value="selectedDoor.segment.b.y"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        segment: {
                          ...selectedDoor.segment,
                          b: { ...selectedDoor.segment.b, y: numberValue($event) },
                        },
                      })
                    "
                /></label>
                <label
                  >Anfangszustand
                  <select
                    :value="selectedDoor.defaultState"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        defaultState: stringValue($event) as DoorDefinition['defaultState'],
                      })
                    "
                  >
                    <option value="closed">Geschlossen</option>
                    <option value="open">Offen</option>
                  </select></label
                >
              </div>
              <div class="editor-checks">
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedDoor.blocksSightWhenClosed"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        blocksSightWhenClosed: checkedValue($event),
                      })
                    "
                  />
                  Geschlossen sichtblockend</label
                >
                <label
                  ><input
                    type="checkbox"
                    :checked="selectedDoor.blocksMovementWhenClosed"
                    @change="
                      emit('updateDoor', selectedDoor.id, {
                        blocksMovementWhenClosed: checkedValue($event),
                      })
                    "
                  />
                  Geschlossen bewegungsblockend</label
                >
              </div>
            </template>

            <template v-else-if="selectedMaterialArea && selection?.kind === 'material-area'">
              <h3>Materialfläche · {{ materialLabels[selectedMaterialArea.material] }}</h3>
              <div class="editor-field-grid">
                <label
                  >Material<select
                    :value="selectedMaterialArea.material"
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        material: stringValue($event) as MaterialId,
                      })
                    "
                  >
                    <option v-for="id in materialIds" :key="id" :value="id">
                      {{ materialLabels[id] }}
                    </option>
                  </select></label
                >
                <label
                  >Rotation<select
                    :value="selectedMaterialArea.rotation ?? 0"
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        rotation: Number(stringValue($event)) as 0 | 90 | 180 | 270,
                      })
                    "
                  >
                    <option v-for="rotation in [0, 90, 180, 270]" :key="rotation" :value="rotation">
                      {{ rotation }}°
                    </option>
                  </select></label
                >
                <label
                  >Skalierung<input
                    type="number"
                    min="0.75"
                    max="1.25"
                    step="0.05"
                    :value="selectedMaterialArea.scale ?? 1"
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        scale: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Deckkraft<input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    :value="selectedMaterialArea.alpha ?? 1"
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        alpha: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Übergang<select
                    :value="
                      selectedMaterialArea.transition ??
                      materialCatalog[selectedMaterialArea.material].transition
                    "
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        transition: stringValue($event) as MaterialTransitionStyle,
                      })
                    "
                  >
                    <option value="none">Keiner</option>
                    <option value="soft">Weich</option>
                    <option value="rough">Rau</option>
                    <option value="masonry">Mauerwerk</option>
                    <option value="shore">Ufer</option>
                  </select></label
                >
                <label
                  >Farbton<input
                    type="color"
                    :value="
                      colorHex(
                        selectedMaterialArea.tint ??
                          materialCatalog[selectedMaterialArea.material].baseColor,
                      )
                    "
                    @change="
                      emit('updateMaterialArea', selection.layerId, selection.id, {
                        tint: colorNumber($event),
                      })
                    "
                /></label>
              </div>
            </template>

            <template v-else-if="selectedMaterialDecal && selection?.kind === 'material-decal'">
              <h3>Dekoration · {{ decalLabels[selectedMaterialDecal.kind] }}</h3>
              <div class="editor-field-grid">
                <label
                  >Typ<select
                    :value="selectedMaterialDecal.kind"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        kind: stringValue($event) as MaterialDecalKind,
                      })
                    "
                  >
                    <option v-for="kind in materialDecalKinds" :key="kind" :value="kind">
                      {{ decalLabels[kind] }}
                    </option>
                  </select></label
                >
                <label
                  >X<input
                    type="number"
                    step="0.1"
                    :value="selectedMaterialDecal.position.x"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        position: { ...selectedMaterialDecal.position, x: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >Y<input
                    type="number"
                    step="0.1"
                    :value="selectedMaterialDecal.position.y"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        position: { ...selectedMaterialDecal.position, y: numberValue($event) },
                      })
                    "
                /></label>
                <label
                  >Breite<input
                    type="number"
                    min="0.1"
                    step="0.1"
                    :value="selectedMaterialDecal.width ?? 1"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        width: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Höhe<input
                    type="number"
                    min="0.1"
                    step="0.1"
                    :value="selectedMaterialDecal.height ?? 1"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        height: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Skalierung<input
                    type="number"
                    min="0.1"
                    step="0.05"
                    :value="selectedMaterialDecal.scale ?? 1"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        scale: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Deckkraft<input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    :value="selectedMaterialDecal.alpha ?? 0.28"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        alpha: numberValue($event),
                      })
                    "
                /></label>
                <label
                  >Farbe<input
                    type="color"
                    :value="colorHex(selectedMaterialDecal.color ?? 0x2d241b)"
                    @change="
                      emit('updateMaterialDecal', selection.layerId, selection.id, {
                        color: colorNumber($event),
                      })
                    "
                /></label>
              </div>
            </template>

            <div v-if="selection" class="map-editor-selection-actions">
              <button
                type="button"
                data-testid="map-editor-duplicate"
                @click="emit('duplicateSelection')"
              >
                Duplizieren
              </button>
              <button
                type="button"
                class="danger"
                data-testid="map-editor-delete"
                @click="emit('deleteSelection')"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>

        <div class="map-editor-footer">
          <form class="map-editor-name" @submit.prevent="commitName">
            <label for="map-editor-name">Name</label
            ><input
              id="map-editor-name"
              v-model="name"
              data-testid="map-editor-name"
              autocomplete="off"
              @change="commitName"
            />
          </form>
          <div class="map-editor-actions map-editor-file-actions">
            <button type="button" data-testid="map-editor-import" @click="importInput?.click()">
              JSON importieren
            </button>
            <button type="button" data-testid="map-editor-export" @click="emit('exportMap')">
              JSON exportieren
            </button>
            <input
              ref="importInput"
              class="visually-hidden"
              type="file"
              accept="application/json,.json"
              data-testid="map-editor-import-input"
              @change="importFile"
            />
          </div>
        </div>
      </div>
    </aside>
  </section>
</template>
