import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TokenContextMenu from './TokenContextMenu.vue'

const token = {
  id: 'token-1',
  mapId: 'map-1',
  name: 'Mira',
  position: { x: 2, y: 3 },
  size: 1,
  rotation: 45,
  visionRange: 8,
  visionAngle: 90,
  visionEnabled: true,
  category: 'player' as const,
  color: '#3f8cff',
  symbol: 'M',
}

describe('TokenContextMenu', () => {
  const mountMenu = () => mount(TokenContextMenu, { props: { open: true, token, x: 40, y: 60 } })

  it('gibt Farbe und Sichtwerte für den ausgewählten Token weiter', async () => {
    const wrapper = mountMenu()
    await wrapper.get('[data-testid="token-context-properties"]').trigger('click')
    await wrapper.get('[data-testid="token-context-color-input"]').setValue('#ff6600')
    await wrapper.get('[data-testid="token-context-vision-range"]').setValue('4')
    await wrapper.get('[data-testid="token-context-vision-enabled"]').setValue(false)

    expect(wrapper.emitted('updateColor')).toEqual([['token-1', '#ff6600']])
    expect(wrapper.emitted('updateVisionRange')).toEqual([['token-1', 4]])
    expect(wrapper.emitted('updateVisionEnabled')).toEqual([['token-1', false]])
  })

  it('fordert das Löschen explizit ein und behält die Zauberaktion bei', async () => {
    const wrapper = mountMenu()
    await wrapper.get('[data-testid="token-context-create-spell"]').trigger('click')
    await wrapper.get('[data-testid="token-context-delete"]').trigger('click')

    expect(wrapper.emitted('createSpell')).toEqual([['token-1']])
    expect(wrapper.emitted('deleteToken')).toBeUndefined()
    expect(wrapper.text()).toContain('Löschen bestätigen')

    await wrapper.get('[data-testid="token-context-delete"]').trigger('click')
    expect(wrapper.emitted('deleteToken')).toEqual([['token-1']])
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('schließt nur beim Antippen außerhalb des scrollbaren Menüs', async () => {
    const wrapper = mountMenu()

    await wrapper.get('[data-testid="token-context-menu"]').trigger('pointerdown')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.get('[data-testid="token-context-backdrop"]').trigger('pointerdown')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('emits rename and duplicate actions for the context token', async () => {
    const wrapper = mountMenu()

    await wrapper.get('[data-testid="token-context-rename"]').trigger('click')
    await wrapper.get('[data-testid="token-context-duplicate"]').trigger('click')

    expect(wrapper.emitted('renameToken')).toEqual([['token-1']])
    expect(wrapper.emitted('duplicateToken')).toEqual([['token-1']])
  })

  it('keeps detailed properties behind the quick action and forwards their changes', async () => {
    const wrapper = mountMenu()
    expect(wrapper.find('[data-testid="token-context-color-input"]').exists()).toBe(false)

    await wrapper.get('[data-testid="token-context-properties"]').trigger('click')
    await wrapper.get('[data-testid="token-context-size-input"]').setValue('2')
    await wrapper.get('[data-testid="token-context-rotation-input"]').setValue('90')
    await wrapper.get('[data-testid="token-context-vision-angle"]').setValue('120')
    await wrapper.get('[data-testid="token-context-properties-back"]').trigger('click')

    expect(wrapper.emitted('updateToken')).toEqual([
      ['token-1', { size: 2 }],
      ['token-1', { rotation: 90 }],
      ['token-1', { visionAngle: 120 }],
    ])
    expect(wrapper.text()).toContain('Duplizieren')
  })

  it('toggles a configured vision range from the quick actions', async () => {
    const wrapper = mountMenu()
    await wrapper.get('[data-testid="token-context-vision-toggle"]').trigger('click')

    expect(wrapper.emitted('updateVisionEnabled')).toEqual([['token-1', false]])
  })

  it('aktiviert die Einzelsicht nur für Spieler-Tokens', async () => {
    const wrapper = mountMenu()
    await wrapper.get('[data-testid="token-context-focus-visibility"]').trigger('click')

    expect(wrapper.emitted('focusVisibility')).toEqual([['token-1']])
    expect(wrapper.emitted('close')).toEqual([[]])

    await wrapper.setProps({ token: { ...token, category: 'monster' } })
    expect(wrapper.find('[data-testid="token-context-focus-visibility"]').exists()).toBe(false)
  })
})
