import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SidebarPanel from './SidebarPanel.vue'
import { tokenTemplates } from '@/types/tokens'

const props = {
  collapsed: false,
  tokenTemplates,
  tokenPlacementKind: null,
  selectedToken: null,
  spellEffects: [],
  selectedSpellEffect: null,
}

describe('SidebarPanel', () => {
  it('startet die Tap-to-Place-Auswahl über eine Token-Vorlage', async () => {
    const wrapper = mount(SidebarPanel, { props })

    await wrapper.get('[data-testid="token-template-hero"]').trigger('click')

    expect(wrapper.emitted('beginTokenPlacement')).toEqual([['hero']])
  })

  it('startet die Tap-to-Place-Auswahl direkt auf Touch-Pointerup', async () => {
    const wrapper = mount(SidebarPanel, { props })

    await wrapper
      .get('[data-testid="token-template-hero"]')
      .trigger('pointerup', { pointerType: 'touch' })

    expect(wrapper.emitted('beginTokenPlacement')).toEqual([['hero']])
  })

  it('unterdrückt den Tap nach einem Desktop-Dragstart', async () => {
    const wrapper = mount(SidebarPanel, { props })
    const template = wrapper.get('[data-testid="token-template-hero"]')

    await template.trigger('dragstart')
    await template.trigger('click')

    expect(wrapper.emitted('beginTokenPlacement')).toBeUndefined()
  })
})
