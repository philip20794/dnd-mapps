import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })
test.setTimeout(90_000)

test('benutzt die Beispielkarte ohne unbehandelte Seitenfehler', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByTestId('map-select').selectOption('alte-krypta')
  await expect(page.getByTestId('map-select')).toHaveValue('alte-krypta')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('reset-menu-button').click()
  await page.getByTestId('reset-session-button').click()
  await expect(page.getByTestId('level-status')).toContainText('Krypta')
  await page.getByTestId('rotate-map-button').click()
  await page.getByTestId('rotate-map-button').click()
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()
  await page.getByTestId('level-menu-button').click()
  await page.getByTestId('level-option-chapel').click()
  await expect(page.getByTestId('level-status')).toContainText('Kapelle')
  await page.getByTestId('level-menu-button').click()
  await page.getByTestId('level-option-crypt').click()
  await expect(page.getByTestId('level-status')).toContainText('Krypta')
  await expect(page.getByTestId('sidebar')).toBeHidden()
  await expect(page.getByTestId('zoom-status')).not.toHaveText('100%')
  await page.getByTestId('toggle-sidebar-button').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()

  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const canvasBox = box as { x: number; y: number; width: number; height: number }

  const hero = page.getByTestId('token-template-hero')
  await hero.dragTo(canvas, {
    targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
  })
  await expect(page.getByTestId('token-properties')).toBeVisible()

  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2 + 80,
    canvasBox.y + canvasBox.height / 2 + 60,
  )
  await page.mouse.up()

  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('fog-toggle').check()
  await expect(page.getByTestId('fog-toggle')).toBeChecked()
  await page.getByTestId('fog-toggle').uncheck()
  await expect(page.getByTestId('fog-toggle')).not.toBeChecked()

  await page.getByTestId('toggle-toolbar-button').click()
  await expect(page.locator('.tabletop-menu-panel')).toBeHidden()
  await expect(page.getByTestId('sidebar')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('zeigt die neue Kapitel-3-Waldwegkarte ohne Seitenfehler', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByTestId('map-select').selectOption('kapitel-3-waldweg')
  await expect(page.getByTestId('map-select')).toHaveValue('kapitel-3-waldweg')
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('zeigt die Kapitel-4-Spinnenwaldkarte ohne Seitenfehler', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByTestId('map-select').selectOption('kapitel-4-spinnenwald-ueberfall')
  await expect(page.getByTestId('map-select')).toHaveValue('kapitel-4-spinnenwald-ueberfall')
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('zeigt den Burg-Naerytar-Höhlen-Dungeon ohne Seitenfehler', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.goto('/')
  await page.getByTestId('map-select').selectOption('burg-naerytar-dungeon')
  await expect(page.getByTestId('map-select')).toHaveValue('burg-naerytar-dungeon')
  await expect(page.getByTestId('map-select').locator('option:checked')).toHaveText(
    'Burg Naerytar – Höhlen-Dungeon',
  )
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('zoom-status')).not.toHaveText('100%')

  expect(pageErrors).toEqual([])
})

test('erstellt per Button eine neue Zufallskarte', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page.getByTestId('sidebar')).toBeHidden()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('generate-random-map-button').click()
  await expect(page.getByTestId('map-select')).toHaveValue('zufallskarte')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('open-random-map-config-button').click()
  await expect(page.getByTestId('random-map-dialog')).toBeVisible()
  await page.getByTestId('generation-biome-forest').click()
  await page.getByTestId('generation-biome-snow').click()
  await expect(page.getByTestId('generation-summary')).toContainText('Nicht gesetzte Werte')
  await page.getByTestId('confirm-random-map-button').click()
  await expect(page.getByTestId('map-select')).toHaveValue('zufallskarte')
  await expect(page.getByTestId('zoom-status')).not.toHaveText('100%')
  await expect(page.getByTestId('map-select').locator('option[value="zufallskarte"]')).toHaveCount(
    1,
  )

  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('generate-random-map-button').click()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('open-random-map-config-button').click()
  await page.getByTestId('generation-atmosphere-dark').click()
  await page.getByTestId('confirm-random-map-button').click()
  await expect(page.getByTestId('map-select')).toHaveValue('zufallskarte')
  await expect(page.getByTestId('map-select').locator('option[value="zufallskarte"]')).toHaveCount(
    1,
  )
  await expect(page.getByTestId('map-select').locator('option:checked')).toContainText('(dunkel)')
  await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()
  const generatedName = await page.getByTestId('map-select').locator('option:checked').textContent()

  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByTestId('map-select')).toHaveValue('zufallskarte')
  await expect(page.getByTestId('map-select').locator('option[value="zufallskarte"]')).toHaveCount(
    1,
  )
  await expect(page.getByTestId('map-select').locator('option:checked')).toHaveText(
    generatedName ?? '',
  )

  expect(pageErrors).toEqual([])
})

test('bearbeitet Objekte, Wände und Türen mit gemeinsamem Undo-Verlauf', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('enter-map-editor').click()
  await expect(page.getByTestId('map-editor-toolbar')).toBeVisible()
  await page.getByTestId('map-editor-tool-object').click()

  const canvas = page.getByTestId('map-canvas').locator('canvas')
  const tapCanvas = async (xFactor: number, yFactor: number, pointerId: number) => {
    await canvas.evaluate(
      (element, input) => {
        const bounds = element.getBoundingClientRect()
        const init = {
          bubbles: true,
          cancelable: true,
          pointerId: input.pointerId,
          pointerType: 'mouse',
          button: 0,
          clientX: bounds.left + bounds.width * input.xFactor,
          clientY: bounds.top + bounds.height * input.yFactor,
        }
        element.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }))
        window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
      },
      { xFactor, yFactor, pointerId },
    )
  }

  await page.getByTestId('map-editor-preset-small-crate').click()
  await tapCanvas(0.5, 0.55, 701)
  await expect(page.getByTestId('map-editor-properties')).toContainText('Objekt')
  await page.getByTestId('map-editor-duplicate').click()
  await page.getByTestId('map-editor-delete').click()
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('map-editor-redo')).toBeEnabled()

  await page.getByTestId('map-editor-tool-wall').click()
  await tapCanvas(0.42, 0.62, 702)
  await tapCanvas(0.58, 0.62, 703)
  await expect(page.getByTestId('map-editor-split-wall')).toBeVisible()

  await page.getByTestId('map-editor-tool-door').click()
  await tapCanvas(0.5, 0.62, 704)
  await expect(page.getByTestId('map-editor-properties')).toContainText('Tür')
  await expect(page.getByTestId('map-editor-save')).toBeEnabled()
  expect(pageErrors).toEqual([])
})

test('malt und radiert Material per Touch als atomare Editoraktionen', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('enter-map-editor').click()
  await page.getByTestId('map-editor-tool-material-brush').click()
  await page.getByTestId('map-editor-material-shallow-water').click()
  await page.getByTestId('map-editor-brush-large').click()

  const canvas = page.getByTestId('map-canvas').locator('canvas')
  await canvas.evaluate(async (element) => {
    const bounds = element.getBoundingClientRect()
    const event = (type: string, x: number, buttons: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 801,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons,
        clientX: bounds.left + bounds.width * x,
        clientY: bounds.top + bounds.height * 0.58,
      })
    element.dispatchEvent(event('pointerdown', 0.4, 1))
    window.dispatchEvent(event('pointermove', 0.62, 1))
    window.dispatchEvent(event('pointerup', 0.68, 0))
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  })

  await expect(page.getByTestId('map-editor-undo')).toBeEnabled()
  await page.getByTestId('map-editor-undo').click()
  await expect(page.getByTestId('map-editor-redo')).toBeEnabled()
  await page.getByTestId('map-editor-redo').click()
  await page.getByTestId('map-editor-tool-material-eraser').click()
  await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const options = {
      bubbles: true,
      cancelable: true,
      pointerId: 802,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: bounds.left + bounds.width * 0.52,
      clientY: bounds.top + bounds.height * 0.58,
    }
    element.dispatchEvent(new PointerEvent('pointerdown', { ...options, buttons: 1 }))
    window.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }))
  })
  await expect(page.getByTestId('map-editor-undo')).toBeEnabled()
  expect(pageErrors).toEqual([])
})

test('verarbeitet synthetisches Zwei-Finger-Pan und Pinch-Zoom', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('map-select').selectOption('alte-krypta')
  const canvas = page.getByTestId('map-canvas').locator('canvas')
  await expect(canvas).toBeVisible()
  const zoomBefore = await page.getByTestId('zoom-status').textContent()

  await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const dispatch = (
      target: EventTarget,
      type: string,
      pointerId: number,
      x: number,
      y: number,
      buttons: number,
    ) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 101,
          button: 0,
          buttons,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
        }),
      )

    dispatch(element, 'pointerdown', 101, 100, 100, 1)
    dispatch(element, 'pointerdown', 102, 300, 100, 1)
    dispatch(window, 'pointermove', 101, 90, 120, 1)
    dispatch(window, 'pointermove', 102, 340, 120, 1)
    dispatch(window, 'pointerup', 102, 340, 120, 0)
    dispatch(window, 'pointerup', 101, 90, 120, 0)

    dispatch(element, 'pointerdown', 103, 120, 160, 1)
    dispatch(element, 'pointerdown', 104, 220, 160, 1)
    dispatch(window, 'pointermove', 104, 120, 260, 1)
    dispatch(window, 'pointerup', 104, 120, 260, 0)
    dispatch(window, 'pointerup', 103, 120, 160, 0)
  })

  await expect(page.getByTestId('zoom-status')).not.toHaveText(zoomBefore ?? '')
  await expect(page.getByTestId('rotate-map-button')).toHaveAttribute(
    'aria-label',
    /aktuell 90 Grad/,
  )
  const zoomAfter = await page.getByTestId('zoom-status').textContent()
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByTestId('zoom-status')).toHaveText(zoomAfter ?? '')
  expect(pageErrors).toEqual([])
})

test('platziert eine Token-Vorlage per Touch-Tap auf der Karte', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('toggle-sidebar-button').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await page.getByTestId('token-template-hero').evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 119,
        pointerType: 'touch',
      }),
    )
  })
  await expect(page.getByTestId('token-placement-banner')).toBeVisible()
  const overlay = page.getByTestId('token-placement-overlay')
  await overlay.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const dispatch = (type: string, pointerId: number, x: number, y: number) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          button: 0,
          buttons: 1,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
        }),
      )

    dispatch('pointermove', 120, bounds.width * 0.55, bounds.height * 0.55)
    dispatch('pointerdown', 120, bounds.width * 0.55, bounds.height * 0.55)
  })

  await expect(page.getByTestId('token-placement-banner')).toBeHidden()
  await expect(page.getByTestId('token-properties')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('erstellt einen Spieler über das freie Long-Press-Menü', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByTestId('toggle-sidebar-button').click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  const canvas = page.getByTestId('map-canvas').locator('canvas')
  await expect(canvas).toBeVisible()

  await canvas.evaluate(async (element) => {
    const bounds = element.getBoundingClientRect()
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 127,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: bounds.left + bounds.width * 0.7,
        clientY: bounds.top + bounds.height * 0.7,
      }),
    )
    await new Promise((resolve) => window.setTimeout(resolve, 560))
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 127,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: bounds.left + bounds.width * 0.7,
        clientY: bounds.top + bounds.height * 0.7,
      }),
    )
  })

  await expect(page.getByTestId('spell-radial-menu')).toBeVisible()
  await expect(page.getByTestId('creation-category-spells')).toBeVisible()
  await expect(page.getByTestId('creation-category-tokens')).toBeVisible()
  await page.getByTestId('creation-category-tokens').click()
  await page.getByTestId('quick-token-player').click()
  await page.getByTestId('create-quick-token').click()

  await expect(page.getByTestId('spell-radial-menu')).toBeHidden()
  await expect(page.getByTestId('token-name-input')).toHaveValue('Spieler')
  expect(pageErrors).toEqual([])
})

test('shows compact token actions before detailed properties', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('toggle-sidebar-button').click()
  await page.getByTestId('token-template-hero').evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 151,
        pointerType: 'touch',
      }),
    )
  })

  const overlay = page.getByTestId('token-placement-overlay')
  await overlay.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 152,
        pointerType: 'touch',
        button: 0,
        buttons: 1,
        clientX: bounds.left + bounds.width * 0.55,
        clientY: bounds.top + bounds.height * 0.55,
      }),
    )
  })
  await expect(page.getByTestId('token-properties')).toBeVisible()

  const canvas = page.getByTestId('map-canvas').locator('canvas')
  await canvas.evaluate(async (element) => {
    const bounds = element.getBoundingClientRect()
    const clientX = bounds.left + bounds.width * 0.55
    const clientY = bounds.top + bounds.height * 0.55
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 153,
        pointerType: 'touch',
        button: 0,
        buttons: 1,
        clientX,
        clientY,
      }),
    )
    await new Promise((resolve) => window.setTimeout(resolve, 560))
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 153,
        pointerType: 'touch',
        button: 0,
        buttons: 0,
        clientX,
        clientY,
      }),
    )
  })

  const menu = page.getByTestId('token-context-menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByTestId('token-context-duplicate')).toBeVisible()
  await expect(menu.getByTestId('token-context-properties')).toBeVisible()
  await menu.getByTestId('token-context-properties').click()
  await expect(menu.getByTestId('token-context-color-input')).toBeVisible()
  await menu.getByTestId('token-context-properties-back').click()
  await page.getByTestId('token-context-backdrop').click({ position: { x: 2, y: 2 } })
  await expect(menu).toBeHidden()
})

async function expectInsideViewport(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
}

test('passt Toolbar, Karte und ErstellungsmenÃ¼ an alle Ziel-Viewports an', async ({ page }) => {
  const viewports = [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]
  await page.setViewportSize(viewports[0])
  await page.goto('/')
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId('toolbar')).toBeVisible()
    await expectInsideViewport(page, page.getByTestId('toolbar'))
    await expect(page.getByTestId('map-canvas').locator('canvas')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await page.getByTestId('toggle-toolbar-button').click()
    await expect(page.getByTestId('generate-random-map-button')).toBeVisible()
    await page.getByTestId('reset-menu-button').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('reset-menu-button')).toBeVisible()
    await expectInsideViewport(page, page.getByTestId('toggle-toolbar-button'))
    await page.getByTestId('toggle-toolbar-button').click()

    const canvas = page.getByTestId('map-canvas').locator('canvas')
    await canvas.evaluate(async (element) => {
      const bounds = element.getBoundingClientRect()
      const pointer = (type: string, buttons: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 401,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: bounds.left + bounds.width * 0.35,
          clientY: bounds.top + bounds.height * 0.6,
        })
      element.dispatchEvent(pointer('pointerdown', 1))
      await new Promise((resolve) => window.setTimeout(resolve, 560))
      window.dispatchEvent(pointer('pointerup', 0))
    })
    const menu = page.getByTestId('spell-radial-menu')
    await expect(menu).toBeVisible()
    await expectInsideViewport(page, menu)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await menu.getByRole('button', { name: 'Schließen' }).click()
  }
})
