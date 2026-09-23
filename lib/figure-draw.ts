/**
 * Draw a figure spec as SVG, in the line-art style of a Checkpoint paper.
 *
 * Black strokes on white, a plain sans for labels, grey fills for solids, no
 * colour and no decoration — because that is what the papers look like and a
 * figure that looks like a stock illustration reads as one.
 *
 * Pure and deterministic: the same spec draws the same picture, which matters
 * because the paper is laid out before it is generated and a figure that moved
 * between the two would be a different question.
 *
 * Everything is inline. No classes, no external stylesheet: the SVG travels in
 * the question, and it has to render wherever the question is shown — the exam
 * runner, the results page, a recall card.
 */
import type {
  FigureSpec, PolygonSpec, SpinnerSpec, GraphSpec, BarChartSpec, NumberLineSpec, ChoiceSpec,
} from './figure-spec'
import { INK, GREY, GRID, esc, text, n, wrap } from './figure-ink'
import {
  drawPieChart, drawDataTable, drawCircuit, drawForces, drawFoodChain,
  drawGrid, drawAngles, drawApparatus,
} from './figure-draw-more'

// ── polygon ────────────────────────────────────────────────────────────────
function drawPolygon(s: PolygonSpec): string {
  const W = 420, H = 220
  // Vertices clockwise from the top-left, so `edges` reads clockwise from the
  // top the way a reader traces a shape.
  const pts: [number, number][] =
    s.sides === 3
      ? [[110, 52], [110, 168], [320, 168]]
      : s.shape === 'rectangle'
        ? [[100, 52], [320, 52], [320, 168], [100, 168]]
        : [[100, 52], [262, 52], [330, 168], [100, 168]]

  const poly = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')
  let body = `<polygon points="${poly}" fill="none" stroke="${INK}" stroke-width="1.3"/>`

  if (s.rightAngle === 'bottom-left') {
    const [x, y] = pts[pts.length - 1]
    body += `<path d="M${n(x)} ${n(y - 18)} L${n(x + 18)} ${n(y - 18)} L${n(x + 18)} ${n(y)}" fill="none" stroke="${INK}" stroke-width="0.9"/>`
  } else if (s.rightAngle === 'bottom-right') {
    const [x, y] = s.sides === 3 ? pts[2] : pts[2]
    body += `<path d="M${n(x)} ${n(y - 18)} L${n(x - 18)} ${n(y - 18)} L${n(x - 18)} ${n(y)}" fill="none" stroke="${INK}" stroke-width="0.9"/>`
  }

  // A label sits outside its edge, pushed along the edge's outward normal so
  // it never lands on the line it names.
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
  s.edges.forEach((label, i) => {
    if (!label) return
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const dx = mx - cx, dy = my - cy
    const len = Math.hypot(dx, dy) || 1
    const px = mx + (dx / len) * 22
    const py = my + (dy / len) * 22 + 4
    body += text(px, py, label)
  })

  return wrap(W, H, body, `A ${s.sides === 3 ? 'triangle' : 'quadrilateral'} with labelled sides.`)
}

// ── spinners ───────────────────────────────────────────────────────────────
function spinner(cx: number, cy: number, sides: number, fill: string): string {
  const r = 52
  const pts: string[] = []
  for (let i = 0; i < sides; i++) {
    const a = (-90 + (i * 360) / sides) * (Math.PI / 180)
    pts.push(`${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`)
  }
  let body = `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`
  for (let i = 0; i < sides; i++) {
    const a = (-90 + (i * 360) / sides) * (Math.PI / 180)
    body += `<line x1="${n(cx)}" y1="${n(cy)}" x2="${n(cx + r * Math.cos(a))}" y2="${n(cy + r * Math.sin(a))}" stroke="${INK}" stroke-width="0.9"/>`
  }
  for (let i = 0; i < sides; i++) {
    const a = (-90 + ((i + 0.5) * 360) / sides) * (Math.PI / 180)
    body += text(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a) + 4, String(i + 1))
  }
  return body
}

function drawSpinners(s: SpinnerSpec): string {
  const W = s.count === 2 ? 400 : 200, H = 170
  const fills = s.fills ?? (s.count === 2 ? ['white', 'grey'] : ['white'])
  let body = ''
  for (let i = 0; i < s.count; i++) {
    const cx = s.count === 2 ? 110 + i * 180 : 100
    body += spinner(cx, 82, s.sides, fills[i] === 'grey' ? GREY : '#ffffff')
  }
  return wrap(W, H, body, `${s.count === 2 ? 'Two' : 'A'} fair ${s.sides}-sided spinner${s.count === 2 ? 's' : ''} numbered 1 to ${s.sides}.`)
}

// ── shared plot frame ──────────────────────────────────────────────────────
interface Frame { L: number; R: number; T: number; B: number; W: number; H: number }
const FRAME: Frame = { L: 76, R: 400, T: 28, B: 224, W: 460, H: 296 }

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = []
  for (let v = min; v <= max + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

function gridAndAxes(x: { min: number; max: number; step: number; label: string },
                     y: { min: number; max: number; step: number; label: string }): string {
  const { L, R, T, B } = FRAME
  let body = ''
  for (const v of ticks(x.min, x.max, x.step)) {
    const px = L + ((v - x.min) / (x.max - x.min)) * (R - L)
    body += `<line x1="${n(px)}" y1="${T}" x2="${n(px)}" y2="${B}" stroke="${GRID}" stroke-width="0.5"/>`
    body += text(px, B + 18, String(v))
  }
  for (const v of ticks(y.min, y.max, y.step)) {
    const py = B - ((v - y.min) / (y.max - y.min)) * (B - T)
    body += `<line x1="${L}" y1="${n(py)}" x2="${R}" y2="${n(py)}" stroke="${GRID}" stroke-width="0.5"/>`
    body += text(L - 10, py + 4, String(v), 'end')
  }
  body += `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${INK}" stroke-width="1.3"/>`
  body += `<line x1="${L}" y1="${B}" x2="${L}" y2="${T}" stroke="${INK}" stroke-width="1.3"/>`
  body += text((L + R) / 2, B + 44, x.label)
  body += text(24, (T + B) / 2, y.label, 'middle', `transform="rotate(-90 24 ${n((T + B) / 2)})"`)
  return body
}

function drawGraph(s: GraphSpec): string {
  const { L, R, T, B, W, H } = FRAME
  const px = (v: number) => L + ((v - s.x.min) / (s.x.max - s.x.min)) * (R - L)
  const py = (v: number) => B - ((v - s.y.min) / (s.y.max - s.y.min)) * (B - T)

  let body = gridAndAxes(s.x, s.y)
  if (s.join !== 'none') {
    const line = s.points.map(([a, b]) => `${n(px(a))},${n(py(b))}`).join(' ')
    body += `<polyline points="${line}" fill="none" stroke="${INK}" stroke-width="1.3"/>`
  }
  // Crosses, as the papers plot them.
  for (const [a, b] of s.points) {
    const X = px(a), Y = py(b)
    body += `<path d="M${n(X - 5)} ${n(Y - 5)} L${n(X + 5)} ${n(Y + 5)} M${n(X + 5)} ${n(Y - 5)} L${n(X - 5)} ${n(Y + 5)}" stroke="${INK}" stroke-width="1.4" fill="none"/>`
  }
  return wrap(W, H, body, `A graph of ${s.y.label} against ${s.x.label}.`)
}

/**
 * A bar label wrapped to the width of its own slot.
 *
 * Each label was drawn as one centred line at a fixed y. Four bars share
 * about 324px of plot, so a slot is ~81px, and a live paper printed
 *
 *   Temperature belowTemperatuFe 10T20°Cerature 2e-30°Cature above 30°C
 *
 * -- four twenty-character labels written straight over one another. The
 * category names ARE the question ("how many days above 20 °C"), so this is
 * not decoration that can be dropped.
 */
function wrapLabel(label: string, widthPx: number): string[] {
  const words = String(label ?? '').split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  // Helvetica at 12px averages about 6.25px a character.
  const max = Math.max(5, Math.floor(widthPx / 6.25))
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= max) { line = next; continue }
    if (line) lines.push(line)
    line = w
  }
  if (line) lines.push(line)
  // Three lines is as deep as the axis area can go before the chart itself
  // starts to look like an afterthought.
  return lines.slice(0, 3)
}

function drawBarChart(s: BarChartSpec): string {
  const { L, R, T, B, W } = FRAME
  let body = ''
  for (const v of ticks(s.y.min, s.y.max, s.y.step)) {
    const py = B - ((v - s.y.min) / (s.y.max - s.y.min)) * (B - T)
    body += `<line x1="${L}" y1="${n(py)}" x2="${R}" y2="${n(py)}" stroke="${GRID}" stroke-width="0.5"/>`
    body += text(L - 10, py + 4, String(v), 'end')
  }
  const slot = (R - L) / s.bars.length
  const bw = Math.min(46, slot * 0.58)
  // Wrapped to the slot, with 6px of gutter so neighbours cannot touch.
  const labelLines = s.bars.map((bar) => wrapLabel(bar.label, slot - 6))
  const deepest = labelLines.reduce((m, l) => Math.max(m, l.length), 1)
  const LINE_H = 13

  s.bars.forEach((bar, i) => {
    const cx = L + slot * (i + 0.5)
    const top = B - ((bar.value - s.y.min) / (s.y.max - s.y.min)) * (B - T)
    body += `<rect x="${n(cx - bw / 2)}" y="${n(top)}" width="${n(bw)}" height="${n(B - top)}" fill="${GREY}" stroke="${INK}" stroke-width="1.3"/>`
    labelLines[i].forEach((l, k) => {
      body += text(cx, B + 18 + k * LINE_H, l)
    })
  })
  body += `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${INK}" stroke-width="1.3"/>`
  body += `<line x1="${L}" y1="${B}" x2="${L}" y2="${T}" stroke="${INK}" stroke-width="1.3"/>`
  // The axis title sits below whatever depth the categories reached, and the
  // canvas grows to match rather than clipping them.
  const xLabelY = B + 18 + deepest * LINE_H + 14
  body += text((L + R) / 2, xLabelY, s.xLabel ?? '')
  body += text(24, (T + B) / 2, s.y.label, 'middle', `transform="rotate(-90 24 ${n((T + B) / 2)})"`)
  const H = Math.max(FRAME.H, Math.ceil(xLabelY + 18))
  return wrap(W, H, body, `A bar chart of ${s.y.label}.`)
}

function drawNumberLine(s: NumberLineSpec): string {
  const W = 460, H = 130, L = 40, R = 420, Y = 76
  let body = `<line x1="${L}" y1="${Y}" x2="${R}" y2="${Y}" stroke="${INK}" stroke-width="1.3"/>`
  const at = (v: number) => L + ((v - s.min) / (s.max - s.min)) * (R - L)
  for (const v of ticks(s.min, s.max, s.step)) {
    body += `<line x1="${n(at(v))}" y1="${Y - 6}" x2="${n(at(v))}" y2="${Y + 6}" stroke="${INK}" stroke-width="1.1"/>`
    body += text(at(v), Y + 24, String(v))
  }
  for (const m of s.marks ?? []) {
    const x = at(m.at)
    body += `<path d="M${n(x)} ${Y - 12} L${n(x - 5)} ${Y - 24} L${n(x + 5)} ${Y - 24} Z" fill="${INK}"/>`
    body += text(x, Y - 32, m.label)
  }
  return wrap(W, H, body, `A number line from ${s.min} to ${s.max}.`)
}

/**
 * A row of small triangles, each lettered, for "which one is..." questions.
 *
 * Built from the angles rather than drawn to a template, because that is the
 * whole question: a learner asked which triangle has a right angle must be
 * able to SEE which one does. The angles are placed by the law of sines from a
 * fixed longest side, so a 90-degree corner looks like one.
 */
function drawChoice(s: ChoiceSpec): string {
  const cell = 148, H = 200
  const W = cell * s.options.length

  let body = ''
  s.options.forEach((opt, i) => {
    const ox = cell * i
    const [A, B, C] = opt.angles
    // Side a is opposite angle A. Scale so the longest side is 92pt.
    const rad = (d: number) => (d * Math.PI) / 180
    const sines = [Math.sin(rad(A)), Math.sin(rad(B)), Math.sin(rad(C))]
    const k = 92 / Math.max(...sines)
    const cAB = sines[2] * k   // the side between vertices A and B

    // A at the origin, B along the x axis, C found from angle A.
    const ax = 0, ay = 0
    const bx = cAB, by = 0
    const bAC = sines[1] * k   // side from A to C
    const cx = bAC * Math.cos(rad(A))
    const cy = -bAC * Math.sin(rad(A))

    const xs = [ax, bx, cx], ys = [ay, by, cy]
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const dx = ox + (cell - (maxX - minX)) / 2 - minX
    const dy = 34 + (108 - (maxY - minY)) / 2 - minY

    const P = [[ax + dx, ay + dy], [bx + dx, by + dy], [cx + dx, cy + dy]]
    body += `<polygon points="${P.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.3"/>`

    // The angle at each vertex, set a little inside the corner.
    P.forEach(([x, y], v) => {
      const other = P.filter((_, j) => j !== v)
      const tx = (other[0][0] + other[1][0]) / 2
      const ty = (other[0][1] + other[1][1]) / 2
      const len = Math.hypot(tx - x, ty - y) || 1
      body += text(x + ((tx - x) / len) * 26, y + ((ty - y) / len) * 26 + 4, `${opt.angles[v]}°`)
    })

    // Side letters, where the paper puts them.
    const labels = opt.sideLabels ?? ['c', 'a', 'b']
    for (let e = 0; e < 3; e++) {
      const [x1, y1] = P[e], [x2, y2] = P[(e + 1) % 3]
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      const gx = (P[0][0] + P[1][0] + P[2][0]) / 3
      const gy = (P[0][1] + P[1][1] + P[2][1]) / 3
      const len = Math.hypot(mx - gx, my - gy) || 1
      body += text(mx + ((mx - gx) / len) * 15, my + ((my - gy) / len) * 15 + 4, labels[e] ?? '', 'middle', 'font-style="italic"')
    }

    // The letter the question refers to, under a tick box as the paper prints.
    const bx0 = ox + cell / 2 - 9
    body += `<rect x="${n(bx0)}" y="156" width="18" height="18" fill="none" stroke="${INK}" stroke-width="1.1"/>`
    body += text(ox + cell / 2, 190, String.fromCharCode(65 + i), 'middle', 'font-weight="700"')
  })

  return wrap(W, H, body, `${s.options.length} triangles with their angles marked, lettered A onwards.`)
}

/**
 * The SVG for this spec, or null when nothing here can draw it.
 *
 * Never throws. A figure that cannot be drawn falls back to the library, and
 * a request must not fail over a picture.
 */
export function drawFigure(spec: FigureSpec | null | undefined): string | null {
  if (!spec) return null
  try {
    switch (spec.kind) {
      case 'polygon': return drawPolygon(spec)
      case 'spinners': return drawSpinners(spec)
      case 'graph': return drawGraph(spec)
      case 'barchart': return drawBarChart(spec)
      case 'numberline': return drawNumberLine(spec)
      case 'choice': return drawChoice(spec)
      case 'piechart': return drawPieChart(spec)
      case 'datatable': return drawDataTable(spec)
      case 'circuit': return drawCircuit(spec)
      case 'forces': return drawForces(spec)
      case 'foodchain': return drawFoodChain(spec)
      case 'grid': return drawGrid(spec)
      case 'angles': return drawAngles(spec)
      case 'apparatus': return drawApparatus(spec)
      default: return null
    }
  } catch {
    return null
  }
}
