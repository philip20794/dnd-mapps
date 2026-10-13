import { describe, expect, it } from 'vitest'
import { legacyRandomFeaturesFromRequest } from './mapGenerationRequestAdapter'

describe('MapGenerationRequest-Legacy-Adapter', () => {
  it('übersetzt neue Mehrfachauswahl in kompatible Legacy-Merkmale', () => {
    expect(
      legacyRandomFeaturesFromRequest({
        mapType: 'coast',
        biomes: ['forest', 'snow'],
        waterFeatures: ['river'],
        themes: ['ruins', 'temple'],
        features: ['ship'],
        atmosphere: 'dark',
      }),
    ).toEqual(
      expect.arrayContaining([
        'outdoor',
        'forest',
        'snow',
        'river',
        'water',
        'ruins',
        'ship',
        'dark',
      ]),
    )
  })

  it('behält Dungeon als dominante Legacy-Ortswahl bei', () => {
    expect(
      legacyRandomFeaturesFromRequest({ mapType: 'dungeon', biomes: ['snow', 'forest'] }),
    ).toEqual(expect.arrayContaining(['dungeon', 'snow']))
    expect(
      legacyRandomFeaturesFromRequest({ mapType: 'dungeon', biomes: ['forest'] }),
    ).not.toContain('outdoor')
  })
})
