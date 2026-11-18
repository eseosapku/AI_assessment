// lib/studylab/tour/place.ts
//
// Where a tour or tip card goes relative to the control it talks about: beside it,
// never on top of it where there is room, and always on screen.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type Side = 'below' | 'above' | 'right' | 'left' | 'center'

export interface Placement {
  x: number
  y: number
  side: Side
  /** False when no side had room and the card overlaps the control. */
  clear: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Overlap area of two boxes. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * `target` null means no control (the closing card): centred.
 * Sides are tried below, above, right, left; the first that clears the control wins.
 * If none does, the card goes where it overlaps the control least.
 */
export function placeCard(target: Box | null, card: { w: number; h: number }, view: { w: number; h: number }, gap = 16, margin = 16): Placement {
  const fit = (x: number, y: number): Box => ({ x: clamp(x, margin, view.w - card.w - margin), y: clamp(y, margin, view.h - card.h - margin), w: card.w, h: card.h })
  if (!target) {
    const b = fit((view.w - card.w) / 2, (view.h - card.h) / 2)
    return { x: b.x, y: b.y, side: 'center', clear: true }
  }
  const cx = target.x + target.w / 2 - card.w / 2
  const cy = target.y + target.h / 2 - card.h / 2
  const candidates: { side: Side; x: number; y: number; room: boolean }[] = [
    { side: 'below', x: cx, y: target.y + target.h + gap, room: target.y + target.h + gap + card.h + margin <= view.h },
    { side: 'above', x: cx, y: target.y - gap - card.h, room: target.y - gap - card.h >= margin },
    { side: 'right', x: target.x + target.w + gap, y: cy, room: target.x + target.w + gap + card.w + margin <= view.w },
    { side: 'left', x: target.x - gap - card.w, y: cy, room: target.x - gap - card.w >= margin },
  ]
  // A control that fills most of the height (the card in front) is flanked, not covered above or below.
  const order: Side[] = target.h > view.h * 0.4 ? ['right', 'left', 'below', 'above'] : ['below', 'above', 'right', 'left']
  const clear = order.map((side) => candidates.find((c) => c.side === side)!).find((c) => c.room)
  if (clear) {
    const b = fit(clear.x, clear.y)
    return { x: b.x, y: b.y, side: clear.side, clear: true }
  }
  // No side clears it: the one that covers the control least.
  const scored = candidates.map((c) => ({ c, b: fit(c.x, c.y) })).map((e) => ({ ...e, area: overlap(e.b, target) }))
  scored.sort((a, b) => a.area - b.area)
  const best = scored[0]
  return { x: best.b.x, y: best.b.y, side: best.c.side, clear: best.area === 0 }
}
