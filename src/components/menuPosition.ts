export interface MenuAnchor {
  readonly x: number
  readonly y: number
}

export interface MenuDimensions {
  readonly width: number
  readonly height: number
}

export interface MenuPosition {
  readonly left: number
  readonly top: number
  /** Keeps an oversized menu inside the actual overlay and lets its content scroll. */
  readonly maxHeight: number
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(value, maximum))

/**
 * Positions a menu relative to an anchor in overlay-local coordinates. It favours the
 * lower-right side but uses the opposite side when the measured menu would not fit.
 */
export const positionAnchoredMenu = (
  anchor: MenuAnchor,
  container: MenuDimensions,
  menu: MenuDimensions,
  gap = 12,
): MenuPosition => {
  const safeLeft = gap
  const safeTop = gap
  const safeRight = Math.max(safeLeft, container.width - gap)
  const safeBottom = Math.max(safeTop, container.height - gap)

  const rightSpace = safeRight - anchor.x - gap
  const leftSpace = anchor.x - gap - safeLeft
  const placeRight = rightSpace >= menu.width || rightSpace >= leftSpace
  const left = placeRight
    ? clamp(anchor.x + gap, safeLeft, Math.max(safeLeft, safeRight - menu.width))
    : clamp(anchor.x - gap - menu.width, safeLeft, Math.max(safeLeft, safeRight - menu.width))

  const belowSpace = safeBottom - anchor.y - gap
  const aboveSpace = anchor.y - gap - safeTop
  const placeBelow = belowSpace >= menu.height || belowSpace >= aboveSpace
  const maxHeight = Math.max(0, placeBelow ? belowSpace : aboveSpace)
  const renderedHeight = Math.min(menu.height, maxHeight)
  const top = placeBelow
    ? clamp(anchor.y + gap, safeTop, Math.max(safeTop, safeBottom - renderedHeight))
    : clamp(
        anchor.y - gap - renderedHeight,
        safeTop,
        Math.max(safeTop, safeBottom - renderedHeight),
      )

  return { left, top, maxHeight }
}
