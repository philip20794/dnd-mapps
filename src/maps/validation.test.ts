import { describe, expect, it } from 'vitest'
import { createDefaultObjectRegistry } from '@/map-objects'
import type { MapDefinition } from './api'
import { loadMapDefinitions } from './loader'
import { createRandomMap, normalizeRandomMapFeatures, randomMapId } from './randomGenerator'
import { validateMapDefinition } from './validation'

const validMap: MapDefinition = {
  id: 'valid',
  name: 'Valide Karte',
  width: 5,
  height: 5,
  gridSize: 48,
  objects: [{ id: 'floor', type: 'stone-floor', preset: 'crypt-slab', position: { x: 0, y: 0 } }],
  walls: [],
  doors: [],
  spawnPoints: [],
}

describe('Kartenvalidierung', () => {
  it('laedt alle Beispielkarten ohne Validierungsfehler', () => {
    const mapIds = loadMapDefinitions().map((map) => map.id)

    expect(mapIds).toContain('kapitel-3-barikarde')
    expect(mapIds).toContain('burg-naerytar-dungeon')
    expect(mapIds).toContain('kapitel-3-waldweg')
    expect(mapIds).toContain('kapitel-4-spinnenwald-ueberfall')
  })

  it('akzeptiert eine gueltige Kartendefinition', () => {
    expect(validateMapDefinition(validMap, createDefaultObjectRegistry())).toHaveLength(0)
  })

  it('erzeugt valide helle und dunkle Zufallskarten', () => {
    const registry = createDefaultObjectRegistry()
    const seeds = [...Array.from({ length: 60 }, (_value, index) => index + 1), 1234, 9999, 424242]
    const lightTypes = new Set(['campfire', 'torch', 'candle', 'hearth', 'light-source'])

    for (const seed of seeds) {
      const brightMap = createRandomMap({ dark: false, seed })
      const darkMap = createRandomMap({ dark: true, seed })

      expect(brightMap.id).toBe(randomMapId)
      expect(darkMap.id).toBe(randomMapId)
      expect(validateMapDefinition(brightMap, registry), `helle Karte Seed ${seed}`).toHaveLength(0)
      expect(validateMapDefinition(darkMap, registry), `dunkle Karte Seed ${seed}`).toHaveLength(0)
      expect(brightMap.objects.some((object) => object.type === 'daylight-area')).toBe(true)
      expect(darkMap.objects.some((object) => object.light || lightTypes.has(object.type))).toBe(
        true,
      )
    }
  })

  it('erzeugt erkennbare Namens- und Layoutvielfalt fuer Zufallskarten', () => {
    const maps = Array.from({ length: 80 }, (_value, index) =>
      createRandomMap({ dark: index % 2 === 0, seed: index + 1 }),
    )
    const names = new Set(maps.map((map) => map.name))
    const firstNameParts = new Set(maps.map((map) => map.name.split(' ').slice(0, 2).join(' ')))
    const newTerrainPresets = new Set([
      'muddy-ruts',
      'cobblestone',
      'burnt-ground',
      'leaf-litter',
      'field-stubble',
      'shallow-mud',
    ])
    const newObjectPresets = new Set([
      'road-sign',
      'sack-pile',
      'farm-tools',
      'plank-debris',
      'ritual-runes',
      'mushroom-ring',
      'thorn-deadfall',
      'rubble-pile',
    ])
    const newLightPresets = new Set(['green-witchlight', 'hooded-lantern', 'standing-brazier'])

    expect(names.size).toBeGreaterThanOrEqual(28)
    expect(firstNameParts.size).toBeGreaterThanOrEqual(16)
    expect(
      maps.some((map) => map.objects.some((object) => object.id === 'vertical-river-water')),
    ).toBe(true)
    expect(maps.some((map) => map.objects.some((object) => object.id === 'farm-house-floor'))).toBe(
      true,
    )
    expect(
      maps.some((map) => map.objects.some((object) => object.id === 'cave-mouth-interior')),
    ).toBe(true)
    expect(
      maps.some((map) => map.objects.some((object) => object.id === 'hill-camp-main-campfire')),
    ).toBe(true)
    expect(
      maps.some(
        (map) =>
          map.objects.some((object) => object.id?.startsWith('dungeon-halls-room-')) &&
          map.walls.length >= 30 &&
          map.doors.length >= 3,
      ),
    ).toBe(true)
    expect(
      maps.some(
        (map) =>
          map.objects.some((object) => object.id?.startsWith('cave-labyrinth-room-')) &&
          map.walls.length >= 30,
      ),
    ).toBe(true)
    expect(
      maps.some((map) => map.objects.some((object) => newTerrainPresets.has(object.preset ?? ''))),
    ).toBe(true)
    expect(
      maps.some((map) => map.objects.some((object) => newObjectPresets.has(object.preset ?? ''))),
    ).toBe(true)
    expect(
      maps.some((map) => map.objects.some((object) => newLightPresets.has(object.preset ?? ''))),
    ).toBe(true)
    expect([...names].some((name) => name.startsWith('Zufallskarte:'))).toBe(false)
  })

  it('kombiniert neue Landschaften mit zusammenhaengenden Story-Szenen', () => {
    const maps = Array.from({ length: 320 }, (_value, index) =>
      createRandomMap({ dark: index % 2 === 0, seed: index + 1 }),
    )
    const allObjectIds = new Set(
      maps.flatMap((map) => map.objects.map((object) => object.id).filter(Boolean)),
    )

    expect(allObjectIds.has('sacred-grove-center-runes')).toBe(true)
    expect(allObjectIds.has('frozen-pass-shrine-stone')).toBe(true)
    expect(allObjectIds.has('battlefield-broken-wagon')).toBe(true)
    expect(allObjectIds.has('desert-oasis-water-water')).toBe(true)
    expect([...allObjectIds].some((id) => id?.startsWith('generated-story-caravan-'))).toBe(true)
    expect([...allObjectIds].some((id) => id?.startsWith('generated-story-ritual-'))).toBe(true)
    expect([...allObjectIds].some((id) => id?.startsWith('generated-story-spider-'))).toBe(true)
    expect([...allObjectIds].some((id) => id?.startsWith('generated-story-grave-'))).toBe(true)
    expect(new Set(maps.map((map) => map.width)).size).toBeGreaterThanOrEqual(15)
    expect(new Set(maps.map((map) => map.height)).size).toBeGreaterThanOrEqual(14)
  })

  it('setzt ausgewaehlte Merkmale gemeinsam auf der Zufallskarte um', () => {
    const registry = createDefaultObjectRegistry()
    const snowForest = createRandomMap({
      dark: false,
      seed: 1201,
      features: ['snow', 'forest'],
    })
    const floodedDungeon = createRandomMap({
      dark: false,
      seed: 1202,
      features: ['dungeon', 'river', 'dark'],
    })
    const shipMap = createRandomMap({
      dark: false,
      seed: 1203,
      features: ['ship', 'snow'],
    })

    expect(snowForest.objects.find((object) => object.id === 'generated-ground-base')?.preset).toBe(
      'snow',
    )
    expect(snowForest.objects.filter((object) => object.type === 'tree').length).toBeGreaterThan(10)
    expect(floodedDungeon.walls.length).toBeGreaterThanOrEqual(30)
    expect(floodedDungeon.objects.some((object) => object.type === 'river')).toBe(true)
    expect(floodedDungeon.name).toContain('(dunkel)')
    expect(shipMap.objects.some((object) => object.type === 'ship')).toBe(true)
    expect(shipMap.objects.some((object) => object.type === 'water')).toBe(true)
    expect(validateMapDefinition(snowForest, registry)).toHaveLength(0)
    expect(validateMapDefinition(floodedDungeon, registry)).toHaveLength(0)
    expect(validateMapDefinition(shipMap, registry)).toHaveLength(0)
  })

  it('ergaenzt Abhaengigkeiten und loest unpassende Ortsauswahlen auf', () => {
    expect(normalizeRandomMapFeatures(['ship'])).toEqual(
      expect.arrayContaining(['ship', 'water', 'outdoor']),
    )
    expect(normalizeRandomMapFeatures(['river'])).toEqual(
      expect.arrayContaining(['river', 'water']),
    )
    expect(normalizeRandomMapFeatures(['dungeon', 'forest', 'ship'])).toEqual(['dungeon'])
  })

  it('erzeugt auch ueber viele Seeds valide Merkmalskombinationen', () => {
    const registry = createDefaultObjectRegistry()
    const combinations = [
      ['snow', 'forest'],
      ['outdoor', 'river'],
      ['outdoor', 'water', 'ruins'],
      ['ship', 'snow'],
      ['dungeon', 'river', 'dark'],
      ['dungeon', 'snow', 'ruins'],
      ['swamp', 'forest', 'water'],
      ['desert', 'settlement', 'dark'],
    ] as const

    for (const features of combinations) {
      for (let seed = 1; seed <= 80; seed += 1) {
        const map = createRandomMap({ dark: false, seed, features })
        const errors = validateMapDefinition(map, registry)
        expect(
          errors,
          `${features.join('+')} mit Seed ${seed}: ${errors.join(' | ')}`,
        ).toHaveLength(0)
      }
    }
  })

  it('meldet unbekannte Presets verstaendlich', () => {
    const errors = validateMapDefinition(
      {
        ...validMap,
        objects: [{ id: 'bad', type: 'stone-floor', preset: 'missing', position: { x: 0, y: 0 } }],
      },
      createDefaultObjectRegistry(),
    )
    expect(errors.join('\n')).toContain('Unbekanntes Preset')
  })

  it('meldet ungueltige Kartenmasse', () => {
    const errors = validateMapDefinition({ ...validMap, width: 0 }, createDefaultObjectRegistry())
    expect(errors.join('\n')).toContain('ung')
  })

  it('meldet ungueltige Tuerreferenzen', () => {
    const errors = validateMapDefinition(
      {
        ...validMap,
        doors: [
          {
            id: 'missing-door-object',
            label: 'Tuer',
            segment: { a: { x: 1, y: 1 }, b: { x: 2, y: 1 } },
            defaultState: 'closed',
            blocksSightWhenClosed: true,
            blocksMovementWhenClosed: true,
          },
        ],
      },
      createDefaultObjectRegistry(),
    )
    expect(errors.join('\n')).toContain('kein zugeh')
  })
})
