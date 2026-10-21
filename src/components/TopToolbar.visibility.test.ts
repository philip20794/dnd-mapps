import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('keeps the menu button visible while controls are collapsed', async () => {
    const wrapper = mountToolbar()
    await wrapper.setProps({ toolbarCollapsed: true })

    expect(wrapper.get('[data-testid="toggle-toolbar-button"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.tabletop-menu-layer').isVisible()).toBe(false)

    await wrapper.get('[data-testid="toggle-toolbar-button"]').trigger('click')
    expect(wrapper.emitted('toggleToolbar')).toHaveLength(1)
    wrapper.unmount()
  })

  it('enters and exits browser fullscreen via the menu', async () => {
    let activeElement: Element | null = null
    const previousElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    const previousRequest = Object.getOwnPropertyDescriptor(document.documentElement, 'requestFullscreen')
    const previousExit = Object.getOwnPropertyDescriptor(document, 'exitFullscreen')
    const requestFullscreen = vi.fn(async () => {
      activeElement = document.documentElement
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    const exitFullscreen = vi.fn(async () => {
      activeElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => activeElement,
    })
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    })

    const wrapper = mountToolbar()
    try {
      await flushPromises()
      const button = wrapper.get('[data-testid="fullscreen-button"]')
      expect(button.attributes('disabled')).toBeUndefined()
      await button.trigger('click')
      await flushPromises()
      expect(requestFullscreen).toHaveBeenCalledOnce()
      expect(button.attributes('aria-pressed')).toBe('true')
      expect(button.text()).toContain('verlassen')

      await button.trigger('click')
      await flushPromises()
      expect(exitFullscreen).toHaveBeenCalledOnce()
      expect(button.attributes('aria-pressed')).toBe('false')
    } finally {
      wrapper.unmount()
      if (previousElement) Object.defineProperty(document, 'fullscreenElement', previousElement)
      else Reflect.deleteProperty(document, 'fullscreenElement')
      if (previousRequest) Object.defineProperty(document.documentElement, 'requestFullscreen', previousRequest)
      else Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
      if (previousExit) Object.defineProperty(document, 'exitFullscreen', previousExit)
      else Reflect.deleteProperty(document, 'exitFullscreen')
    }
  })

})
