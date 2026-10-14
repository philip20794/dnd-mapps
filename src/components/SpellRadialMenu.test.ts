import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SpellRadialMenu from './SpellRadialMenu.vue'

describe('SpellRadialMenu', () => {
  it('zeigt Zauber für die gedrückt gehaltene Figur', () => {
    const wrapper = mount(SpellRadialMenu, {
      props: { open: true, contextLabel: 'Mira', tokenCreationEnabled: false, x: 20, y: 30 },
    })

    expect(wrapper.get('[data-testid="spell-radial-menu"]').text()).toContain('Mira')
    expect(wrapper.get('[data-testid="spell-preset-shape-circle"]').text()).toContain('Kreis')
  })

  it('gibt den gewählten Zauber zur Platzierung weiter', async () => {
    const wrapper = mount(SpellRadialMenu, {
      props: {
        open: true,
        contextLabel: 'Freie Platzierung',
        tokenCreationEnabled: true,
        x: 20,
        y: 30,
      },
    })

    await wrapper.get('[data-testid="spell-preset-shape-cone"]').trigger('click')

    expect(wrapper.emitted('choose')).toEqual([['shape-cone']])
  })

  it('strukturiert die Formen als erweiterbare Menükategorie', () => {
    const wrapper = mount(SpellRadialMenu, {
      props: {
        open: true,
        contextLabel: 'Freie Platzierung',
        tokenCreationEnabled: true,
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.get('.spell-menu-category').text()).toContain('Zauberformen')
    expect(wrapper.get('[data-testid="spell-radial-menu"]').text()).toContain('Freie Platzierung')
  })

  it('erstellt einen Spieler mit den vorgesehenen Standardwerten', async () => {
    const wrapper = mount(SpellRadialMenu, {
      props: {
        open: true,
        contextLabel: 'Freie Platzierung',
        tokenCreationEnabled: true,
        x: 20,
        y: 30,
      },
    })

    await wrapper.get('[data-testid="creation-category-tokens"]').trigger('click')
    await wrapper.get('[data-testid="quick-token-player"]').trigger('click')
    await wrapper.get('[data-testid="create-quick-token"]').trigger('click')

    expect(wrapper.emitted('createQuickToken')).toEqual([
      [{ category: 'player', size: 1, color: '#3f8cff' }],
    ])
  })

  it('erstellt Gegner in der gewählten Größe und Farbe', async () => {
    const wrapper = mount(SpellRadialMenu, {
      props: {
        open: true,
        contextLabel: 'Freie Platzierung',
        tokenCreationEnabled: true,
        x: 20,
        y: 30,
      },
    })

    await wrapper.get('[data-testid="creation-category-tokens"]').trigger('click')
    await wrapper.get('[data-testid="quick-token-monster"]').trigger('click')
    await wrapper.get('[data-testid="quick-token-size-huge"]').trigger('click')
    await wrapper.get('[data-testid="quick-token-monster-color"]').setValue('#ff6600')
    await wrapper.get('[data-testid="create-quick-token"]').trigger('click')

    expect(wrapper.emitted('createQuickToken')).toEqual([
      [{ category: 'monster', size: 3, color: '#ff6600' }],
    ])
  })
})
