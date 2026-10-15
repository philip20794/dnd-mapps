import { createDefaultObjectRegistry } from '@/map-objects'
import type { MapDefinition } from '@/maps/api'
import { validateMapDefinition } from '@/maps/validation'

export const MAP_EXPORT_FORMAT = 'dnd-mapps-map'
export const MAP_EXPORT_VERSION = 1

export interface MapExportDocument {
  readonly format: typeof MAP_EXPORT_FORMAT
  readonly version: typeof MAP_EXPORT_VERSION
  readonly map: MapDefinition
}

export class MapImportError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'MapImportError'
  }
}

function cloneMap(map: MapDefinition): MapDefinition {
  return JSON.parse(JSON.stringify(map))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasMapDefinitionShape(value: unknown): value is MapDefinition {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.gridSize === 'number' &&
    Array.isArray(value.objects) &&
    Array.isArray(value.walls) &&
    Array.isArray(value.doors) &&
    Array.isArray(value.spawnPoints)
  )
}

function defaultIdCandidate(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `custom-map-${globalThis.crypto.randomUUID()}`
  }
  return `custom-map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createUniqueCustomMapId(
  existingIds: ReadonlySet<string>,
  candidateFactory: () => string = defaultIdCandidate,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = candidateFactory().trim()
    if (candidate && !existingIds.has(candidate)) return candidate
  }
  throw new Error('Es konnte keine eindeutige Karten-ID erzeugt werden.')
}

function withMapId(map: MapDefinition, id: string): MapDefinition {
  return {
    ...cloneMap(map),
    id,
    startTokens: map.startTokens?.map((token) => ({ ...token, mapId: id })),
  }
}

export function isCustomMap(map: MapDefinition): boolean {
  return map.editor?.schemaVersion === 1
}

export function createEditableMapCopy(
  source: MapDefinition,
  existingIds: ReadonlySet<string>,
  now = new Date().toISOString(),
  candidateFactory?: () => string,
): MapDefinition {
  const id = createUniqueCustomMapId(existingIds, candidateFactory)
  return {
    ...withMapId(source, id),
    name: `${source.name} – Eigene Karte`,
    editor: {
      schemaVersion: 1,
      sourceMapId: source.id,
      updatedAt: now,
    },
  }
}

export function validateEditableMap(map: MapDefinition): readonly string[] {
  return validateMapDefinition(map, createDefaultObjectRegistry())
}

export function exportMapToJson(map: MapDefinition): string {
  const document: MapExportDocument = {
    format: MAP_EXPORT_FORMAT,
    version: MAP_EXPORT_VERSION,
    map: cloneMap(map),
  }
  return JSON.stringify(document, null, 2)
}

function mapValueFromDocument(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (value.format === MAP_EXPORT_FORMAT && value.version === MAP_EXPORT_VERSION) {
    return value.map
  }
  return value
}

export function parseMapDefinition(value: unknown): MapDefinition {
  const mapValue = mapValueFromDocument(value)
  if (!hasMapDefinitionShape(mapValue)) {
    throw new MapImportError('Die Datei enthält keine vollständige dnd-mapps-Karte.')
  }
  let errors: readonly string[]
  try {
    errors = validateEditableMap(mapValue)
  } catch {
    throw new MapImportError('Die Kartendaten sind beschädigt oder unvollständig.')
  }
  if (errors.length > 0) {
    throw new MapImportError(`Die Karte ist ungültig: ${errors.join(' | ')}`)
  }
  return cloneMap(mapValue)
}

export function importMapFromJson(
  json: string,
  existingIds: ReadonlySet<string>,
  now = new Date().toISOString(),
  candidateFactory?: () => string,
): MapDefinition {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new MapImportError('Die ausgewählte Datei enthält kein gültiges JSON.')
  }
  const imported = parseMapDefinition(value)
  const id = existingIds.has(imported.id)
    ? createUniqueCustomMapId(existingIds, candidateFactory)
    : imported.id
  return {
    ...withMapId(imported, id),
    editor: {
      schemaVersion: 1,
      sourceMapId: imported.editor?.sourceMapId ?? imported.id,
      updatedAt: now,
    },
  }
}
