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
  const mountMenu = () =>
    mount(TokenContextMenu, { props: { open: true, token, x: 40, y: 60 } })

  it('gibt Farbe und Sichtwerte für den ausgewählten Token weiter', async () => {
    const wrapper = mountMenu()
    await wrapper.get('[data-testid="token-context-color-input"]').setValue('#ff6600')
    await wrapper.get('[data-testid="token-context-vision-range"]').setValue('4')
    await wrapper.get('[data-testid="token-context-vision-enabled"]').setValue(false)

    expect(wrapper.emitted('updateColor')).toEqual([['token-1', '#ff6600']])
    expect(wrapper.emitted('updateVisionRange')).toEqual([['token-1', 4]])
    expect(wrapper.emitted('updateVisionEnabled')).toEqual([['token-1', false]])
  })

  it('fordert das Löschen explizit ein und behält die Zauberaktion bei', async () => {
    const wrapper = mountMenu()
    await wrapper.get('.token-context-action.primary').trigger('click')
    await wrapper.get('[data-testid="token-context-delete"]').trigger('click')

    expect(wrapper.emitted('createSpell')).toEqual([['token-1']])
    expect(wrapper.emitted('deleteToken')).toBeUndefined()
    expect(wrapper.text()).toContain('Löschen bestätigen')

    await wrapper.get('[data-testid="token-context-delete"]').trigger('click')
    expect(wrapper.emitted('deleteToken')).toEqual([['token-1']])
    expect(wrapper.emitted('close')).toEqual([[]])
  })
})
