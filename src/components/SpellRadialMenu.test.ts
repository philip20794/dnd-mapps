import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SpellRadialMenu from './SpellRadialMenu.vue'

describe('SpellRadialMenu', () => {
  it('zeigt Zauber für die gedrückt gehaltene Figur', () => {
    const wrapper = mount(SpellRadialMenu, {
      props: { open: true, tokenName: 'Mira', x: 20, y: 30 },
    })

    expect(wrapper.get('[data-testid="spell-radial-menu"]').text()).toContain('Mira')
    expect(wrapper.get('[data-testid="spell-preset-shape-circle"]').text()).toContain('Kreis')
  })

  it('gibt den gewählten Zauber zur Platzierung weiter', async () => {
    const wrapper = mount(SpellRadialMenu, {
      props: { open: true, tokenName: 'Mira', x: 20, y: 30 },
    })

    await wrapper.get('[data-testid="spell-preset-shape-cone"]').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([['shape-cone']])
  })
})
