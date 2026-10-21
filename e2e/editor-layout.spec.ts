import { expect, test } from '@playwright/test'

const widths = [320, 390, 768, 1440, 1920] as const

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function expectWithinViewport(
  page: import('@playwright/test').Page,
  testId: string,
): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
}

test('keeps a floating menu usable at target widths and browser zoom', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: widths[0], height: 760 })
  await page.goto('/')
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 700 ? 760 : 900 })
    await expect(page.getByTestId('map-select')).toBeHidden()
    await expect(page.getByTestId('toggle-toolbar-button')).toBeVisible()
    const layoutBox = await page.locator('.main-layout').boundingBox()
    expect(layoutBox!.y).toBe(0)
    await expectNoHorizontalOverflow(page)
    await page.getByTestId('toggle-toolbar-button').click()
    await expect(page.getByTestId('map-select')).toBeVisible()
    await expect(page.getByTestId('fog-toggle')).toBeVisible()
    await expect(page.getByTestId('fog-visibility-mode')).toBeVisible()
    await expect(page.getByTestId('generate-random-map-button')).toBeVisible()
    const menuBox = await page.locator('.tabletop-menu-panel').boundingBox()
    expect(menuBox).not.toBeNull()
    expect(menuBox!.x).toBeGreaterThanOrEqual(0)
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width)
    await page.getByTestId('toggle-toolbar-button').click()
    await expect(page.getByTestId('map-select')).toBeHidden()
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('map-select').selectOption('alte-krypta')
  await expect(page.getByTestId('map-select')).toHaveValue('alte-krypta')
  await expect(page.locator('.tabletop-menu-panel')).toBeHidden()
  await page.getByTestId('toggle-toolbar-button').click()
  await expect(page.getByTestId('fullscreen-button')).toBeAttached()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.evaluate(() => {
    document.documentElement.style.zoom = '125%'
  })
  await expectNoHorizontalOverflow(page)
  await expect(page.getByTestId('toggle-toolbar-button')).toBeVisible()
})

test('captures play and editor layouts without covering the canvas', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('map-select').selectOption('alte-krypta')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('fog-toggle').check()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.screenshot({ path: testInfo.outputPath('play-fog.png'), fullPage: true })
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('fog-toggle').uncheck()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.screenshot({ path: testInfo.outputPath('play-no-fog.png'), fullPage: true })

  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('enter-map-editor').click()
  await expect(page.getByTestId('map-editor-tool-wall')).toBeVisible()
  await page.getByTestId('map-editor-tool-wall').click()
  await page.screenshot({ path: testInfo.outputPath('editor-wall.png'), fullPage: true })

  await page.getByTestId('map-editor-tool-object').click()
  await expect(page.getByTestId('map-editor-library-search')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('editor-objects.png'), fullPage: true })

  await page.getByTestId('map-editor-tool-material-brush').click()
  await expect(page.getByTestId('map-editor-material-stone')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('editor-terrain.png'), fullPage: true })

  const canvasBox = await page.getByTestId('map-canvas').boundingBox()
  const panelBox = await page.getByTestId('map-editor-context-panel').boundingBox()
  expect(canvasBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(panelBox!.width).toBeLessThan(380)
  expect(canvasBox!.width).toBeGreaterThan(900)

  await page.getByTestId('map-editor-leave').click()
  await expect(page.getByTestId('map-editor-toolbar')).toBeHidden()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('fog-toggle').check()
  await page.getByTestId('toggle-toolbar-button').click()
  await page.screenshot({ path: testInfo.outputPath('play-after-editor-fog.png'), fullPage: true })
})

test('keeps the editor canvas usable on a narrow touch viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByTestId('toggle-toolbar-button').click()
  await page.getByTestId('enter-map-editor').click()
  await expect(page.getByTestId('map-editor-context-panel')).toBeHidden()
  await expect(page.getByTestId('map-editor-tool-wall')).toBeVisible()
  await expect(page.getByTestId('map-editor-undo')).toBeVisible()
  await expect(page.getByTestId('map-editor-redo')).toBeVisible()
  await expect(page.getByTestId('map-editor-save')).toBeVisible()
  await expect(page.getByTestId('map-editor-discard')).toBeVisible()
  await expect(page.getByTestId('map-editor-leave')).toBeVisible()
  await page.getByTestId('map-editor-tool-material-brush').click()
  await expect(page.getByTestId('map-editor-context-panel')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('editor-touch-terrain.png'), fullPage: true })
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 320, height: 640 })
  for (const testId of [
    'map-editor-undo',
    'map-editor-redo',
    'map-editor-save',
    'map-editor-discard',
    'map-editor-leave',
  ]) {
    await expectWithinViewport(page, testId)
  }
  await expectNoHorizontalOverflow(page)
})
