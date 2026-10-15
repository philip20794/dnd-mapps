import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import TopToolbar from './TopToolbar.vue'

const players = [
  {
    id: 'player-a',
    mapId: 'map-a',
    levelId: 'ground',
    name: 'Mira',
    position: { x: 2, y: 3 },
    size: 1,
    rotation: 0,
    visionRange: 8,
    visionAngle: null,
    visionEnabled: true,
    category: 'player' as const,
    color: '#3f8cff',
    symbol: 'M',
  },
]

function mountToolbar(fogEnabled = true) {
  return mount(TopToolbar, {
    props: {
      maps: [],
      selectedMapId: null,
      fogEnabled,
      persistExploration: true,
      fogVisibilityMode: { kind: 'shared' },
      playerTokens: players,
      gridVisible: true,
      snapToGrid: true,
      toolbarCollapsed: false,
      zoomPercent: 100,
      mapRotation: 0,
      activeLevelName: 'Ebene',
      activeLevelId: 'ground',
      levels: [],
    },
  })
}

function createMediaQueryList(): MediaQueryList {
  return {
    matches: false,
    media: '(max-width: 900px)',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }
}

describe('TopToolbar Sichtmodus', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: createMediaQueryList,
    })
  })

  it('zeigt Spielernamen und gibt die gewählte Einzelsicht typisiert weiter', async () => {
    const wrapper = mountToolbar()
    const select = wrapper.get('[data-testid="fog-visibility-mode"]')

    expect(select.text()).toContain('Nur Mira')
    await select.setValue('player:player-a')

    expect(wrapper.emitted('setFogVisibilityMode')).toEqual([
      [{ kind: 'player', tokenId: 'player-a' }],
    ])
  })

  it('kennzeichnet den Sichtmodus bei ausgeschaltetem Fog als inaktiv', () => {
    const wrapper = mountToolbar(false)

    expect(wrapper.get('[data-testid="fog-visibility-mode"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Inaktiv: Fog ist aus')
  })

  it('keeps camera controls available and hides gameplay actions in editor mode', async () => {
    const wrapper = mountToolbar()
    await wrapper.setProps({ editorActive: true, editorMapName: 'Eigene Karte' })

    expect(wrapper.find('[data-testid="generate-random-map-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fog-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rotate-map-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-camera-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="map-select"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Bearbeitungsmodus')
  })
})
