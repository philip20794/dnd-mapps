import { describe, expect, it } from 'vitest'
import { positionAnchoredMenu } from './menuPosition'

describe('positionAnchoredMenu', () => {
  const viewport = { width: 320, height: 640 }
  const menu = { width: 240, height: 300 }

  it('positioniert ein passendes Menü rechts unterhalb des Fingers', () => {
    expect(positionAnchoredMenu({ x: 20, y: 20 }, viewport, menu)).toEqual({
      left: 32,
      top: 32,
      maxHeight: 596,
    })
  })

  it('weicht am rechten und unteren Rand nach links oben aus', () => {
    expect(positionAnchoredMenu({ x: 300, y: 620 }, viewport, menu)).toEqual({
      left: 48,
      top: 308,
      maxHeight: 596,
    })
  })

  it('begrenzt ein zu hohes Menü auf die größere verfügbare Seite', () => {
    expect(positionAnchoredMenu({ x: 160, y: 290 }, viewport, { width: 240, height: 700 })).toEqual(
      {
        left: 68,
        top: 302,
        maxHeight: 326,
      },
    )
  })

  it('hält auch breite Menüs innerhalb des verfügbaren Viewports', () => {
    const position = positionAnchoredMenu(
      { x: 2, y: 2 },
      { width: 390, height: 844 },
      { width: 460, height: 100 },
    )

    expect(position.left).toBe(12)
    expect(position.top).toBe(14)
  })
})
