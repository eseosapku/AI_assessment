/**
 * `position: fixed` is only viewport-relative when no ancestor establishes a
 * containing block for it. An ancestor with a computed `transform`, `filter`
 * or `perspective` other than `none` does establish one — React Flow's own
 * `.react-flow__viewport` is exactly such an ancestor (it carries
 * `transform: matrix(scale, 0, 0, scale, panX, panY)` for pan/zoom). A piece
 * dragged out of a canvas node inherits that containing block, so `left`/`top`
 * in client (viewport) pixels land in the wrong place — offset and scaled by
 * whatever the canvas's current pan/zoom happens to be.
 *
 * This module is the pure math half of the fix: given the containing
 * ancestor's rendered box (`getBoundingClientRect`) and its pre-transform
 * layout size (`offsetWidth`/`offsetHeight`), convert a client-space point (or
 * a client-space delta) into that ancestor's own local coordinate space —
 * the space `left`/`top` are actually resolved against once it becomes the
 * containing block. The DOM walk that finds the ancestor
 * (`findFixedContainingBlock`) is not unit-testable (no DOM in the node test
 * environment); everything else here is plain arithmetic and is.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface ContainingBlockMeasurement {
  /** The ancestor's getBoundingClientRect() — its rendered, post-transform box. */
  rect: Rect
  /** The ancestor's offsetWidth/offsetHeight — its pre-transform layout size. */
  natural: Size
}

/**
 * The scale a transformed ancestor applies to its own content, derived by
 * comparing its rendered (post-transform) box to its natural (pre-transform)
 * layout box. Falls back to 1 on a zero-size box so callers never divide by
 * zero.
 */
export function computeAncestorScale(rect: Size, natural: Size): { scaleX: number; scaleY: number } {
  return {
    scaleX: natural.width > 0 ? rect.width / natural.width : 1,
    scaleY: natural.height > 0 ? rect.height / natural.height : 1,
  }
}

/**
 * Converts a viewport point (clientX/clientY) into the local coordinate space
 * of a `fixed`-containing-block ancestor.
 */
export function clientToContainingBlockPoint(
  clientX: number,
  clientY: number,
  rect: Rect,
  natural: Size,
): { x: number; y: number } {
  const { scaleX, scaleY } = computeAncestorScale(rect, natural)
  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  }
}

/**
 * Converts a client-pixel delta (e.g. where inside an element's box the
 * pointer went down) into the same local space. Deltas only need the scale,
 * not the translate — translation cancels out between any two points.
 */
export function clientDeltaToContainingBlockDelta(
  deltaX: number,
  deltaY: number,
  rect: Size,
  natural: Size,
): { x: number; y: number } {
  const { scaleX, scaleY } = computeAncestorScale(rect, natural)
  return { x: deltaX / scaleX, y: deltaY / scaleY }
}

/**
 * The full conversion `itemProps` needs: given the current pointer position
 * (client space), the pointer's grab offset inside the dragged piece (also
 * client space, captured at pointerdown), and the measured containing-block
 * ancestor (or `null` when there isn't one, i.e. `fixed` really is
 * viewport-relative), return the `left`/`top` to render the ghost at so it
 * stays glued under the cursor.
 */
export function ghostPosition(
  clientX: number,
  clientY: number,
  grabOffsetX: number,
  grabOffsetY: number,
  containing: ContainingBlockMeasurement | null,
): { left: number; top: number } {
  if (!containing) {
    return { left: clientX - grabOffsetX, top: clientY - grabOffsetY }
  }
  const point = clientToContainingBlockPoint(clientX, clientY, containing.rect, containing.natural)
  const offset = clientDeltaToContainingBlockDelta(grabOffsetX, grabOffsetY, containing.rect, containing.natural)
  return { left: point.x - offset.x, top: point.y - offset.y }
}

/**
 * Walks up from `el` to find the nearest ancestor that establishes a
 * containing block for `position: fixed` descendants — one whose computed
 * `transform`, `filter` or `perspective` is not `none`. Returns `null` when
 * no such ancestor exists. DOM-dependent; not unit-tested (see module doc).
 */
export function findFixedContainingBlock(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    const cs = getComputedStyle(node)
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') {
      return node
    }
    node = node.parentElement
  }
  return null
}
