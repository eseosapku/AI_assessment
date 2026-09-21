/**
 * The pen every drawn figure writes with.
 *
 * Pulled out of `figure-draw.ts` when the second drawing module arrived. One
 * definition of black, one of grey, one escaper and one frame — because the
 * point of drawing figures rather than finding them is that they all look like
 * they came off the same paper, and two modules with their own idea of "the
 * ink colour" is how that stops being true.
 *
 * Black strokes on white, a plain sans for labels, grey fills for solids, no
 * colour and no decoration: that is what the papers look like, and a figure
 * that looks like a stock illustration reads as one.
 */

export const INK = '#16181c'
export const GREY = '#c9c9c9'
export const GRID = '#b9bcc2'
export const FONT = 'font-family="Helvetica,Arial,sans-serif" font-size="12"'
export const FONT_SMALL = 'font-family="Helvetica,Arial,sans-serif" font-size="10.5"'

/** Text is the one place a spec's strings reach the output. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

export function text(x: number, y: number, s: string, anchor = 'middle', extra = ''): string {
  if (!s) return ''
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${INK}" ${FONT} ${extra}>${esc(s)}</text>`
}

/** Trim a float so the markup does not carry sixteen decimal places. */
export function n(v: number): string {
  return String(Math.round(v * 100) / 100)
}

export function wrap(w: number, h: number, body: string, alt: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
    `role="img" aria-label="${esc(alt)}">` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`
  )
}

export function line(x1: number, y1: number, x2: number, y2: number, width = 1.3): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${INK}" stroke-width="${width}"/>`
}

export function rect(x: number, y: number, w: number, h: number, fill = 'none', width = 1.3): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${INK}" stroke-width="${width}"/>`
}

/**
 * An arrowhead, drawn rather than declared.
 *
 * SVG markers need an id, ids must be unique, and these figures are inlined
 * many-to-a-page in the review console and the exam runner — two figures with
 * the same marker id on one page is a rendering bug waiting for a reviewer to
 * find. A drawn triangle has no id and cannot collide.
 */
export function arrow(x1: number, y1: number, x2: number, y2: number, size = 7): string {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const back = Math.PI / 7
  const p1 = `${n(x2)},${n(y2)}`
  const p2 = `${n(x2 - size * Math.cos(a - back))},${n(y2 - size * Math.sin(a - back))}`
  const p3 = `${n(x2 - size * Math.cos(a + back))},${n(y2 - size * Math.sin(a + back))}`
  return line(x1, y1, x2, y2) + `<polygon points="${p1} ${p2} ${p3}" fill="${INK}"/>`
}
