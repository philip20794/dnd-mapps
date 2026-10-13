import type { MapObjectDefinition, MapObjectRegistration, ObjectPreset } from './types'

export class ObjectRegistryError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'ObjectRegistryError'
  }
}

export class MapObjectRegistry {
  private readonly registrations = new Map<string, MapObjectRegistration>()

  public register<TDefinition extends MapObjectDefinition>(
    registration: MapObjectRegistration<TDefinition>,
  ): void {
    if (this.registrations.has(registration.type)) {
      throw new ObjectRegistryError(`Objekttyp "${registration.type}" ist bereits registriert.`)
    }

    const presetNames = new Set<string>()
    for (const preset of registration.presets) {
      if (presetNames.has(preset.name)) {
        throw new ObjectRegistryError(
          `Preset "${preset.name}" ist für Objekttyp "${registration.type}" doppelt vorhanden.`,
        )
      }
      presetNames.add(preset.name)
    }

    this.registrations.set(registration.type, registration as unknown as MapObjectRegistration)
  }

  public get(type: string): MapObjectRegistration | undefined {
    return this.registrations.get(type)
  }

  public require(type: string): MapObjectRegistration {
    const registration = this.get(type)
    if (!registration) {
      throw new ObjectRegistryError(`Unbekannter Objekttyp "${type}".`)
    }
    return registration
  }

  public has(type: string): boolean {
    return this.registrations.has(type)
  }

  public getPreset(type: string, name: string): ObjectPreset | undefined {
    return this.registrations.get(type)?.presets.find((preset) => preset.name === name)
  }

  public requirePreset(type: string, name: string): ObjectPreset {
    const preset = this.getPreset(type, name)
    if (!preset) {
      throw new ObjectRegistryError(`Unbekanntes Preset "${name}" für Objekttyp "${type}".`)
    }
    return preset
  }

  public listTypes(): readonly string[] {
    return [...this.registrations.keys()].sort()
  }

  public listPresets(type: string): readonly ObjectPreset[] {
    return this.registrations.get(type)?.presets ?? []
  }
}
