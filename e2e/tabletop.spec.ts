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

  await page.getByTestId('fog-toggle').check()
  await expect(page.getByTestId('fog-toggle')).toBeChecked()
  await page.getByTestId('fog-toggle').uncheck()
  await expect(page.getByTestId('fog-toggle')).not.toBeChecked()

  await page.getByTestId('toggle-toolbar-button').click()
  await expect(page.getByTestId('sidebar')).toBeHidden()

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
  await page.getByTestId('generate-random-map-button').click()
  await expect(page.getByTestId('map-select')).toHaveValue('zufallskarte')
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

  await page.getByTestId('generate-random-map-button').click()
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
