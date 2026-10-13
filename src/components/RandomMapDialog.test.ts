import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RandomMapDialog from './RandomMapDialog.vue'

const usageSnapshot = {
  period: { startUtc: '2026-09-28T00:00:00.000Z', endUtc: '2026-09-29T00:00:00.000Z', timezone: 'UTC' },
  usage: {
    amountUsd: 1.8,
    source: 'openai-organization-costs-api',
    measuredAtUtc: '2026-09-28T12:00:00.000Z',
    mayBeDelayed: true,
  },
  dailyBudget: { amountUsd: 2.5, source: 'server-configuration' },
  remaining: {
    amountUsd: 0.7,
    source: 'calculated-from-api-usage-and-server-budget',
    isEstimate: true,
  },
  freeQuotaStatus: 'unknown',
} as const

const createDialog = (props: Record<string, unknown> = {}) =>
  mount(RandomMapDialog, { props: { open: true, modelValue: {}, ...props } })

afterEach(() => vi.unstubAllGlobals())

describe('RandomMapDialog', () => {
  it('lässt alle Vorgaben offen, damit der Planner entscheiden kann', () => {
    const wrapper = createDialog()

    expect(wrapper.get('[data-testid="generation-summary"]').text()).toContain(
      'Ohne Vorgaben entscheidet der Planner',
    )
    expect(wrapper.get('[data-testid="generation-ai-off"]').attributes('aria-pressed')).toBe('true')
  })

  it('speichert KI-Auswahl und freie Beschreibung im MapGenerationRequest', async () => {
    const wrapper = createDialog()

    await wrapper.get('[data-testid="generation-ai-luna"]').trigger('click')
    await wrapper
      .get('[data-testid="generation-description"]')
      .setValue('Ein verlassener Tempel unter einem Vulkan.')

    const request = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as {
      readonly aiEnabled?: boolean
      readonly description?: string
    }
    expect(request).toMatchObject({
      aiEnabled: true,
      description: 'Ein verlassener Tempel unter einem Vulkan.',
    })
  })

  it('lädt API-gemessene Kosten beim Öffnen mit KI, ohne ein Freikontingent zu behaupten', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(usageSnapshot)))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = createDialog({ open: false, modelValue: { aiEnabled: true } })

    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const panel = wrapper.get('[data-testid="ai-usage-panel"]')
    expect(panel.text()).toContain('API-Verbrauch heute')
    expect(panel.text()).toContain('Konfiguriertes Tagesbudget')
    expect(panel.text()).toContain('Geschätzt innerhalb des Budgets verfügbar')
    expect(panel.text()).toContain('Freikontingent ist nicht verifizierbar')
    expect(panel.text()).toContain('Reset des UTC-Tagesfensters')
    expect(panel.text()).not.toContain('noch kostenlos verfügbar')
  })

  it('zeigt einen unaufdringlichen Fehler und blockiert die Generierung nicht', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const wrapper = createDialog()

    await wrapper.get('[data-testid="generation-ai-luna"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="ai-usage-error"]').text()).toContain(
      'Die Kartenerzeugung bleibt möglich',
    )
    await wrapper.get('[data-testid="confirm-random-map-button"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('aktualisiert Usage erst nach dem Abschluss einer KI-Generierung', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(usageSnapshot)))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = createDialog({ modelValue: { aiEnabled: true } })

    await flushPromises()
    await wrapper.get('[data-testid="confirm-random-map-button"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ usageRefreshKey: 1 })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('kombiniert Umgebung und Elemente als Mehrfachauswahl', async () => {
    const wrapper = createDialog()

    await wrapper.get('[data-testid="generation-biome-forest"]').trigger('click')
    await wrapper.get('[data-testid="generation-biome-snow"]').trigger('click')
    await wrapper.get('[data-testid="generation-water-river"]').trigger('click')
    await wrapper.get('[data-testid="generation-theme-ruins"]').trigger('click')
    await wrapper.get('[data-testid="generation-feature-ship"]').trigger('click')

    await wrapper.get('[data-testid="confirm-random-map-button"]').trigger('click')
    expect(wrapper.emitted('generate')?.[0]?.[0]).toMatchObject({
      biomes: ['forest', 'snow'],
      waterFeatures: ['river'],
      themes: ['ruins'],
      features: ['ship'],
    })
  })

  it('hält Kartentypen als gegenseitig exklusive Wahl', async () => {
    const wrapper = createDialog()

    await wrapper.get('[data-testid="generation-map-type-outdoor"]').trigger('click')
    await wrapper.get('[data-testid="generation-map-type-dungeon"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ mapType: 'dungeon' })
  })

  it('übernimmt weitere Dungeon-Optionen und kann die Anfrage wieder leeren', async () => {
    const wrapper = createDialog()
    const details = wrapper.get('details')
    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')

    await wrapper.get('[data-testid="generation-width"]').setValue('72')
    await wrapper.get('[data-testid="generation-height"]').setValue('48')
    await wrapper.get('[data-testid="generation-secret-rooms"]').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
      width: 72,
      height: 48,
      dungeon: { secretRooms: true },
    })

    await wrapper.get('[data-testid="clear-generation-request"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      biome: undefined,
      theme: undefined,
      water: undefined,
      biomes: undefined,
      themes: undefined,
      waterFeatures: undefined,
      features: undefined,
    })
  })
})
