import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { tokenSizeOptions } from '@/types/tokens'
import { useTokenStore } from './tokens'

describe('Token Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('erstellt Spieler mit Sicht, Medium-Größe und dem gewählten Kartenbezug', () => {
    const store = useTokenStore()
    const token = store.addQuickToken(
      { category: 'player', size: 1, color: '#3456ff' },
      'map-a',
      { x: 4, y: 6 },
      'level-a',
    )

    expect(token).toMatchObject({
      mapId: 'map-a',
      levelId: 'level-a',
      position: { x: 4, y: 6 },
      size: 1,
      visionRange: 8,
      visionAngle: null,
      visionEnabled: true,
      category: 'player',
      color: '#3456ff',
    })
  })

  it.each(tokenSizeOptions)('erstellt Gegner in Größe $label ohne Sicht', (size) => {
    const store = useTokenStore()
    const token = store.addQuickToken(
      { category: 'monster', size: size.size, color: '#dc4b4b' },
      'map-a',
      { x: 1, y: 2 },
      'level-a',
    )

    expect(token).toMatchObject({
      size: size.size,
      visionRange: 0,
      visionAngle: null,
      visionEnabled: false,
      category: 'monster',
      color: '#dc4b4b',
    })
  })

  it('bleibt nach Wiederherstellung eindeutig und lässt sich regulär bewegen', () => {
    const store = useTokenStore()
    store.replaceTokens([
      {
        id: 'token-z',
        mapId: 'map-a',
        name: 'Wiederhergestellt',
        position: { x: 0, y: 0 },
        size: 1,
        rotation: 0,
        visionRange: 8,
        visionAngle: null,
        visionEnabled: true,
        category: 'player',
        color: '#3f8cff',
        symbol: 'P',
      },
    ])

    const created = store.addQuickToken(
      { category: 'monster', size: 2, color: '#dc4b4b' },
      'map-a',
      { x: 2, y: 3 },
    )
    store.moveToken(created.id, { x: 7, y: 8 })

    expect(created.id).toBe('token-10')
    expect(store.tokens).toContainEqual(
      expect.objectContaining({ id: created.id, position: { x: 7, y: 8 } }),
    )
  })

  it('aktualisiert Farbe und Sichtwerte über die wiederverwendbaren Aktionen', () => {
    const store = useTokenStore()
    const token = store.addQuickToken({ category: 'monster', size: 1, color: '#dc4b4b' }, 'map-a', {
      x: 2,
      y: 3,
    })

    store.updateTokenColor(token.id, '#ff6600')
    store.setTokenVisionRange(token.id, 6)
    expect(store.selectedToken).toMatchObject({
      color: '#ff6600',
      visionRange: 6,
      visionEnabled: true,
    })

    store.setTokenVisionEnabled(token.id, false)
    store.setTokenVisionRange(token.id, 0)
    expect(store.selectedToken).toMatchObject({ visionRange: 0, visionEnabled: false })
  })

  it('löscht ausschließlich den angeforderten Token und räumt dessen Auswahl auf', () => {
    const store = useTokenStore()
    const first = store.addQuickToken({ category: 'player', size: 1, color: '#3f8cff' }, 'map-a', {
      x: 1,
      y: 1,
    })
    const second = store.addQuickToken(
      { category: 'monster', size: 1, color: '#dc4b4b' },
      'map-a',
      { x: 2, y: 2 },
    )

    store.deleteToken(first.id)

    expect(store.tokens).toEqual([second])
    expect(store.selectedTokenId).toBe(second.id)
    store.deleteToken(second.id)
    expect(store.selectedTokenId).toBeNull()
  })
  it.each(['goblin', 'skeleton'])('erstellt Template-Gegner %s ohne Sicht', (kind) => {
    const store = useTokenStore()
    const created = store.addTokenFromTemplate(kind, 'map-a', { x: 3, y: 4 })

    expect(created).toMatchObject({
      visionRange: 0,
      visionEnabled: false,
      category: kind === 'goblin' ? 'monster' : 'undead',
    })
  })

  it.each(['hero', 'mage'])('erstellt Template-Spieler %s mit aktiver Sichtweite 8', (kind) => {
    const store = useTokenStore()
    const created = store.addTokenFromTemplate(kind, 'map-a', { x: 3, y: 4 })

    expect(created).toMatchObject({ visionRange: 8, visionEnabled: true, category: 'player' })
  })

  it('behaelt die individuelle Sicht eines wiederhergestellten NPC unveraendert', () => {
    const store = useTokenStore()
    store.replaceTokens([
      {
        id: 'npc-restored',
        mapId: 'map-a',
        name: 'Wache',
        position: { x: 3, y: 4 },
        size: 1,
        rotation: 0,
        visionRange: 5,
        visionAngle: 120,
        visionEnabled: true,
        category: 'npc',
        color: '#d2d7df',
        symbol: 'W',
      },
    ])

    expect(store.tokens[0]).toMatchObject({ visionRange: 5, visionAngle: 120, visionEnabled: true })
  })
})
