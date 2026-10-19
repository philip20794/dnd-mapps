import type { DoorState } from '@/maps/api'
import type { MapDefinition } from '@/maps/api'
import type { FogStateData } from '@/map-engine/fog/fogState'
import type { RuntimeSettings } from './settings'
import type { PlacedToken } from './tokens'
import type { PlacedSpellEffect } from './spells'

export const SESSION_SCHEMA_VERSION = 4

export interface SessionSnapshot {
  readonly version: typeof SESSION_SCHEMA_VERSION
  readonly selectedMapId: string | null
  readonly tokens: readonly PlacedToken[]
  readonly spellEffects?: readonly PlacedSpellEffect[]
  readonly generatedMaps?: readonly MapDefinition[]
  readonly customMaps?: readonly MapDefinition[]
  readonly doorStatesByMap: Record<string, Record<string, DoorState>>
  readonly currentLevelByMap?: Record<string, string>
  readonly fog: FogStateData
  readonly settings: RuntimeSettings
  readonly savedAt: string
}
