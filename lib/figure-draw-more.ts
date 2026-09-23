/**
 * The seven shapes added when six turned out to be one shape.
 *
 * Seven hundred drafts came back 65% bar charts, and the verdict was fair:
 * "these are basically all the same kind of thing". A bar chart of pets and a
 * bar chart of sports are one figure with different words.
 *
 * Kept apart from `figure-draw.ts` so neither file is a mile long, and both
 * write with the same pen — see `figure-ink.ts`. Same contract as the
 * original six: pure, deterministic, inline styles only, black on white.
 */
import type {
  PieChartSpec, DataTableSpec, CircuitSpec, ForcesSpec, FoodChainSpec,
  GridSpec, AnglesSpec, ApparatusSpec,
} from './figure-spec'
import { INK, GREY, GRID, esc, text, n, wrap, line, rect, arrow, FONT_SMALL } from './figure-ink'

// ── pie chart ──────────────────────────────────────────────────────────────
/**
 * One tone per slice, and the key uses the same one.
 *
 * The fill alternated white, grey, white, grey. On a four-slice chart that is
 * two tones for four categories, so the key read:
 *
 *   □ Non-fiction    □ Science
 *   ■ Fiction        ■ Arts
 *
 * and "Calculate the percentage of the total that Arts represents" could not
 * be answered at all — there is no way to tell which grey sector is Arts.
 *
 * Monochrome on purpose: the papers are printed black and white. Six steps,
 * spaced far enough apart to survive a photocopier, which is as many slices as
 * a Checkpoint pie chart is ever asked to carry.
 */
const TONES: readonly string[] = ['#ffffff', '#d4d4d4', '#a8a8a8', '#7c7c7c', '#545454', '#2e2e2e']

export function drawPieChart(s: PieChartSpec): string {
  const W = 420, H = 260
  const cx = 150, cy = 130, r = 96
  const total = s.slices.reduce((t, x) => t + x.value, 0) || 1

  let body = ''
  let from = -Math.PI / 2
  s.slices.forEach((slice, i) => {
    const sweep = (slice.value / total) * Math.PI * 2
    const to = from + sweep
    const x1 = cx + r * Math.cos(from), y1 = cy + r * Math.sin(from)
    const x2 = cx + r * Math.cos(to), y2 = cy + r * Math.sin(to)
    const fill = TONES[i % TONES.length]
    body += `<path d="M${n(cx)} ${n(cy)} L${n(x1)} ${n(y1)} A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${n(x2)} ${n(y2)} Z" ` +
      `fill="${fill}" stroke="${INK}" stroke-width="1.3"/>`
    from = to
  })

  // The key, not labels on the slices: a thin slice has no room for a word.
  s.slices.forEach((slice, i) => {
    const ky = 46 + i * 26
    body += rect(276, ky - 10, 14, 14, TONES[i % TONES.length], 1)
    body += text(298, ky + 1, slice.label, 'start')
  })

  if (s.title) body += text(cx, 24, s.title)
  return wrap(W, H, body, `A pie chart of ${s.slices.map((x) => x.label).join(', ')}.`)
}

// ── data table ─────────────────────────────────────────────────────────────
/** Helvetica at 12px averages about this per character across mixed case. */
const CHAR_W = 6.25
const LINE_H = 15

/** Greedy word wrap to a pixel width. Never drops a word, however long. */
function wrapCell(textValue: string, widthPx: number): string[] {
  const words = String(textValue ?? '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const max = Math.max(4, Math.floor(widthPx / CHAR_W))
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= max) { line = next; continue }
    if (line) lines.push(line)
    line = w
  }
  if (line) lines.push(line)
  return lines
}

export function drawDataTable(s: DataTableSpec): string {
  // Columns were a fixed 96-150px with no measurement and no wrapping, so
  // "Closely packed in a fixed position" -- 34 characters, about 211px --
  // ran straight out of its cell and collided with the column beside it.
  // Three rows of a particle-model table were unreadable on top of each
  // other. A table the learner cannot read is not a figure.
  const cols = s.columns.length
  const PAD = 12
  const CELL_MAX = 190

  // Wide enough for the longest word in the column, then for its longest
  // cell, then capped -- anything past the cap wraps instead.
  const widths = s.columns.map((heading, c) => {
    const cells = [heading, ...s.rows.map((r) => r[c] ?? '')]
    const longestWord = Math.max(
      ...cells.flatMap((t) => String(t).split(/\s+/).map((w) => w.length)),
      3,
    )
    const longestCell = Math.max(...cells.map((t) => String(t).length), 3)
    return Math.round(Math.min(CELL_MAX, Math.max(longestWord * CHAR_W + PAD * 2, Math.min(longestCell * CHAR_W + PAD * 2, CELL_MAX))))
  })

  const headingLines = s.columns.map((h, c) => wrapCell(h, widths[c] - PAD * 2))
  const rowLines = s.rows.map((row) => row.map((cell, c) => wrapCell(cell, widths[c] - PAD * 2)))

  const headH = Math.max(30, headingLines.reduce((m, l) => Math.max(m, l.length), 1) * LINE_H + 14)
  const rowH = rowLines.map((row) => Math.max(28, row.reduce((m, l) => Math.max(m, l.length), 1) * LINE_H + 12))

  const tableW = widths.reduce((t, w) => t + w, 0)
  const W = tableW + 40
  const top = s.title ? 44 : 20
  const H = top + headH + rowH.reduce((t, h) => t + h, 0) + 20

  let body = s.title ? text(W / 2, 26, s.title) : ''

  // Heading row shaded, as the papers print it.
  body += `<rect x="20" y="${n(top)}" width="${n(tableW)}" height="${n(headH)}" fill="#efefef"/>`

  // Verticals.
  let x = 20
  body += line(x, top, x, top + headH + rowH.reduce((t, h) => t + h, 0), 1)
  for (const w of widths) {
    x += w
    body += line(x, top, x, top + headH + rowH.reduce((t, h) => t + h, 0), 1)
  }
  // Horizontals.
  let y = top
  body += line(20, y, 20 + tableW, y, 1)
  y += headH
  body += line(20, y, 20 + tableW, y, 1)
  for (const h of rowH) {
    y += h
    body += line(20, y, 20 + tableW, y, 1)
  }

  // Headings, centred and vertically middled over however many lines.
  x = 20
  headingLines.forEach((lines, c) => {
    const cx = x + widths[c] / 2
    const startY = top + (headH - lines.length * LINE_H) / 2 + LINE_H - 4
    lines.forEach((l, i) => {
      body += text(cx, startY + i * LINE_H, l, 'middle', 'font-weight="600"')
    })
    x += widths[c]
  })

  // Cells.
  y = top + headH
  rowLines.forEach((row, r) => {
    let cx = 20
    row.forEach((lines, c) => {
      const mid = cx + widths[c] / 2
      const startY = y + (rowH[r] - lines.length * LINE_H) / 2 + LINE_H - 4
      lines.forEach((l, i) => {
        body += text(mid, startY + i * LINE_H, l)
      })
      cx += widths[c]
    })
    y += rowH[r]
  })

  return wrap(W, H, body, `A table of ${s.columns.join(', ')}.`)
}

// ── circuit ────────────────────────────────────────────────────────────────
/** A cell: one long thin plate and one short fat one, as drawn everywhere. */
function cell(x: number, y: number): string {
  return line(x, y - 14, x, y + 14, 1.3) +
    `<line x1="${n(x + 9)}" y1="${n(y - 7)}" x2="${n(x + 9)}" y2="${n(y + 7)}" stroke="${INK}" stroke-width="3.4"/>`
}

function component(type: CircuitSpec['components'][number]['type'], x: number, y: number): string {
  switch (type) {
    case 'lamp':
      return `<circle cx="${n(x)}" cy="${n(y)}" r="13" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
        line(x - 9.2, y - 9.2, x + 9.2, y + 9.2, 1) + line(x - 9.2, y + 9.2, x + 9.2, y - 9.2, 1)
    case 'resistor':
      return rect(x - 18, y - 9, 36, 18, '#ffffff')
    case 'switch':
      return `<circle cx="${n(x - 15)}" cy="${n(y)}" r="2.4" fill="${INK}"/>` +
        `<circle cx="${n(x + 15)}" cy="${n(y)}" r="2.4" fill="${INK}"/>` +
        line(x - 15, y, x + 11, y - 12, 1.3)
    case 'motor':
      return `<circle cx="${n(x)}" cy="${n(y)}" r="13" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
        text(x, y + 4, 'M')
    case 'ammeter':
      return `<circle cx="${n(x)}" cy="${n(y)}" r="13" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
        text(x, y + 4, 'A')
    case 'voltmeter':
      return `<circle cx="${n(x)}" cy="${n(y)}" r="13" fill="none" stroke="${INK}" stroke-width="1.3"/>` +
        text(x, y + 4, 'V')
  }
}

export function drawCircuit(s: CircuitSpec): string {
  // The supply is written to the LEFT of the cell, so the loop starts far
  // enough in to leave room for it: "a 6 V battery" needs about ninety.
  const W = 480, H = 250
  const L = 120, R = 420, T = 60, B = 190
  let body = ''

  if (s.arrangement === 'series') {
    // One loop. The cell sits on the left side, the components along the top.
    body += line(L, T, R, T) + line(R, T, R, B) + line(R, B, L, B) + line(L, B, L, T)
    body += `<rect x="${n(L - 10)}" y="${n((T + B) / 2 - 16)}" width="20" height="32" fill="#ffffff"/>`
    body += cell(L - 4, (T + B) / 2)
    if (s.supply) body += text(L - 18, (T + B) / 2 + 4, s.supply, 'end')

    const gap = (R - L) / (s.components.length + 1)
    s.components.forEach((c, i) => {
      const x = L + gap * (i + 1)
      body += `<rect x="${n(x - 20)}" y="${n(T - 10)}" width="40" height="20" fill="#ffffff"/>`
      body += component(c.type, x, T)
      if (c.label) body += text(x, T - 22, c.label)
    })
  } else {
    // Two rails with the components on branches between them.
    const midT = T + 34, midB = B - 34
    body += line(L, midT, L, midB) + line(L, midT, R, midT) + line(L, midB, R, midB)
    body += line(R, midT, R, midB)
    body += `<rect x="${n(L - 10)}" y="${n((midT + midB) / 2 - 16)}" width="20" height="32" fill="#ffffff"/>`
    body += cell(L - 4, (midT + midB) / 2)
    if (s.supply) body += text(L - 18, (midT + midB) / 2 + 4, s.supply, 'end')

    const gap = (R - L) / (s.components.length + 1)
    s.components.forEach((c, i) => {
      const x = L + gap * (i + 1)
      body += line(x, midT, x, midB)
      body += `<rect x="${n(x - 20)}" y="${n((midT + midB) / 2 - 16)}" width="40" height="32" fill="#ffffff"/>`
      body += component(c.type, x, (midT + midB) / 2)
      if (c.label) body += text(x, midT - 10, c.label)
    })
  }

  return wrap(W, H, body, `A ${s.arrangement} circuit.`)
}

// ── force diagram ──────────────────────────────────────────────────────────
export function drawForces(s: ForcesSpec): string {
  // 520 wide, not 420: "air resistance 12 N" beside the left-hand arrow
  // needs a column of its own, and at 420 it ran off the edge.
  const W = 520, H = 280
  const cx = 260, cy = 142
  const bw = 88, bh = 58
  let body = ''

  if (s.surface) {
    body += line(96, cy + bh / 2, 424, cy + bh / 2)
    // Hatching under the ground line, the convention for a fixed surface.
    for (let x = 100; x < 424; x += 14) {
      body += line(x, cy + bh / 2, x - 8, cy + bh / 2 + 9, 0.8)
    }
    body += text(cx, cy + bh / 2 + 30, s.surface, 'middle', FONT_SMALL)
  }

  body += rect(cx - bw / 2, cy - bh / 2, bw, bh, '#ffffff')
  body += text(cx, cy + 4, s.object)

  const reach = 58
  for (const a of s.arrows) {
    if (a.direction === 'up') {
      body += arrow(cx, cy - bh / 2, cx, cy - bh / 2 - reach)
      body += text(cx, cy - bh / 2 - reach - 10, a.label)
    } else if (a.direction === 'down') {
      body += arrow(cx, cy + bh / 2, cx, cy + bh / 2 + reach)
      body += text(cx, cy + bh / 2 + reach + 16, a.label)
    } else if (a.direction === 'left') {
      body += arrow(cx - bw / 2, cy, cx - bw / 2 - reach, cy)
      body += text(cx - bw / 2 - reach - 6, cy + 4, a.label, 'end')
    } else {
      body += arrow(cx + bw / 2, cy, cx + bw / 2 + reach, cy)
      body += text(cx + bw / 2 + reach + 6, cy + 4, a.label, 'start')
    }
  }

  return wrap(W, H, body, `A ${s.object} with labelled force arrows.`)
}

// ── food chain ─────────────────────────────────────────────────────────────
export function drawFoodChain(s: FoodChainSpec): string {
  const boxW = 96, boxH = 46, gap = 36
  const count = s.organisms.length
  const W = count * boxW + (count - 1) * gap + 40
  const H = 130
  const y = 46
  let body = ''

  s.organisms.forEach((name, i) => {
    const x = 20 + i * (boxW + gap)
    body += rect(x, y, boxW, boxH, '#ffffff')
    // Two short words fit on one line; anything longer takes a second.
    const words = name.split(/\s+/)
    if (words.length > 1 && name.length > 12) {
      const half = Math.ceil(words.length / 2)
      body += text(x + boxW / 2, y + 20, words.slice(0, half).join(' '), 'middle', FONT_SMALL)
      body += text(x + boxW / 2, y + 34, words.slice(half).join(' '), 'middle', FONT_SMALL)
    } else {
      body += text(x + boxW / 2, y + boxH / 2 + 4, name, 'middle', FONT_SMALL)
    }
    if (i < count - 1) body += arrow(x + boxW + 5, y + boxH / 2, x + boxW + gap - 5, y + boxH / 2)
  })

  return wrap(W, H, body, `A food chain: ${s.organisms.join(' to ')}.`)
}

// ── coordinate grid ────────────────────────────────────────────────────────
export function drawGrid(s: GridSpec): string {
  const W = 340, H = 340
  const pad = 34
  const lo = s.quadrants === 4 ? -s.max : 0
  const span = s.max - lo
  const size = W - pad * 2
  const px = (v: number) => pad + ((v - lo) / span) * size
  const py = (v: number) => H - pad - ((v - lo) / span) * size

  let body = ''
  for (let v = lo; v <= s.max; v++) {
    body += `<line x1="${n(px(v))}" y1="${n(py(lo))}" x2="${n(px(v))}" y2="${n(py(s.max))}" stroke="${GRID}" stroke-width="0.5"/>`
    body += `<line x1="${n(px(lo))}" y1="${n(py(v))}" x2="${n(px(s.max))}" y2="${n(py(v))}" stroke="${GRID}" stroke-width="0.5"/>`
  }
  // The axes themselves, heavier than the grid.
  body += line(px(lo), py(0), px(s.max), py(0))
  body += line(px(0), py(lo), px(0), py(s.max))

  // Number every division on a small grid, every other on a big one, so the
  // labels never collide.
  const every = span > 12 ? 2 : 1
  for (let v = lo; v <= s.max; v += every) {
    if (v === 0) continue
    body += text(px(v), py(0) + 14, String(v), 'middle', FONT_SMALL)
    body += text(px(0) - 8, py(v) + 4, String(v), 'end', FONT_SMALL)
  }
  body += text(px(s.max) + 12, py(0) + 4, 'x', 'start')
  body += text(px(0) - 4, py(s.max) - 10, 'y', 'end')

  if (s.joined && s.points.length >= 3) {
    const poly = s.points.map((pt) => `${n(px(pt.x))},${n(py(pt.y))}`).join(' ')
    body += `<polygon points="${poly}" fill="none" stroke="${INK}" stroke-width="1.4"/>`
  }
  for (const pt of s.points) {
    const x = px(pt.x), y = py(pt.y)
    body += line(x - 5, y - 5, x + 5, y + 5, 1.4) + line(x - 5, y + 5, x + 5, y - 5, 1.4)
    if (pt.label) body += text(x + 9, y - 8, pt.label, 'start')
  }

  return wrap(W, H, body, `A coordinate grid with ${s.points.length} points plotted.`)
}

// ── angles ─────────────────────────────────────────────────────────────────
export function drawAngles(s: AnglesSpec): string {
  const W = 420, H = 250
  let body = ''

  if (s.arrangement === 'parallel-lines') {
    body += line(50, 80, 370, 80) + line(50, 175, 370, 175)
    // Arrowheads on both, the convention for "these are parallel".
    body += arrow(200, 80, 224, 80, 6) + arrow(200, 175, 224, 175, 6)
    body += line(130, 40, 280, 215)
    s.marks.forEach((m, i) => {
      const at = i < 2 ? { x: 178, y: 80 } : { x: 235, y: 175 }
      const dx = i % 2 === 0 ? 26 : -26
      body += text(at.x + dx, at.y + (i < 2 ? -12 : 22), m.label)
    })
  } else if (s.arrangement === 'around-point') {
    const cx = 210, cy = 130, r = 88
    let from = -90
    for (const m of s.marks) {
      const to = from + m.at
      const a = (from * Math.PI) / 180
      body += line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a))
      const mid = ((from + to) / 2) * (Math.PI / 180)
      body += text(cx + r * 0.58 * Math.cos(mid), cy + r * 0.58 * Math.sin(mid) + 4, m.label)
      from = to
    }
  } else if (s.arrangement === 'triangle') {
    const pts: [number, number][] = [[120, 60], [90, 190], [320, 190]]
    body += `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.3"/>`
    const inset: [number, number][] = [[128, 90], [112, 176], [288, 178]]
    s.marks.slice(0, 3).forEach((m, i) => {
      body += text(inset[i][0], inset[i][1], m.label)
    })
  } else {
    // Angles on a straight line: rays from a point on a horizontal.
    const cx = 210, cy = 175, r = 110
    body += line(60, cy, 360, cy)
    let from = 180
    for (const m of s.marks.slice(0, -1)) {
      const to = from - m.at
      const a = (to * Math.PI) / 180
      body += line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a))
      from = to
    }
    from = 180
    for (const m of s.marks) {
      const to = from - m.at
      const mid = ((from + to) / 2) * (Math.PI / 180)
      body += text(cx + r * 0.52 * Math.cos(mid), cy + r * 0.52 * Math.sin(mid) + 4, m.label)
      from = to
    }
  }

  return wrap(W, H, body, `An angle diagram with ${s.marks.length} angles marked.`)
}

// ── apparatus ──────────────────────────────────────────────────────────────
export function drawApparatus(s: ApparatusSpec): string {
  // Wide, and the apparatus sits right of centre, because the labels need a
  // column of their own on the left. Drawn with them jammed against the
  // drawing, "measuring cylinder" ran sixty pixels off the left edge — and a
  // clipped label is the exact part of the figure the question names.
  const W = 500, H = 290
  const cx = 268
  let body = ''
  let anchors: [number, number][] = []

  if (s.vessel === 'tray') {
    const x = cx - 100, y = 165, w = 200, h = 62
    body += line(x, y, x, y + h) + line(x, y + h, x + w, y + h) + line(x + w, y + h, x + w, y)
    if (s.contents) {
      body += `<rect x="${n(x + 2)}" y="${n(y + 20)}" width="${n(w - 4)}" height="${n(h - 22)}" fill="${GREY}"/>`
      // A crater dished into the surface: this is the marble-and-sand figure.
      body += `<path d="M${n(cx - 34)} ${n(y + 20)} Q${n(cx)} ${n(y + 48)} ${n(cx + 34)} ${n(y + 20)}" fill="#ffffff" stroke="${INK}" stroke-width="1.1"/>`
      body += line(x + 2, y + 20, cx - 34, y + 20, 1.1) + line(cx + 34, y + 20, x + w - 2, y + 20, 1.1)
      body += text(cx + 96, y + 44, s.contents, 'start', FONT_SMALL)
    }
    anchors = [[cx, y + 34], [x, y + h], [cx + 34, y + 20]]
  } else if (s.vessel === 'cylinder' || s.vessel === 'tube') {
    const x = cx - 26, y = 96, w = 52, h = 140
    body += line(x, y, x, y + h) + line(x, y + h, x + w, y + h) + line(x + w, y + h, x + w, y)
    if (s.contents) {
      body += `<rect x="${n(x + 2)}" y="${n(y + 52)}" width="${n(w - 4)}" height="${n(h - 54)}" fill="${GREY}"/>`
      body += line(x + 2, y + 52, x + w - 2, y + 52, 1.1)
      body += text(x + w + 10, y + 96, s.contents, 'start', FONT_SMALL)
    }
    // Graduations, which is what makes it a cylinder rather than a jar.
    for (let i = 1; i <= 6; i++) body += line(x, y + (h / 7) * i, x + (i % 2 ? 9 : 15), y + (h / 7) * i, 0.9)
    anchors = [[x, y + 20], [x + w, y + 52], [x + w / 2, y + h]]
  } else {
    const x = cx - 54, y = 118, w = 108, h = 110
    body += line(x, y, x, y + h) + line(x, y + h, x + w, y + h) + line(x + w, y + h, x + w, y)
    body += line(x - 8, y, x, y, 1.1) + line(x + w, y, x + w + 12, y - 6, 1.1)
    if (s.contents) {
      body += `<rect x="${n(x + 2)}" y="${n(y + 40)}" width="${n(w - 4)}" height="${n(h - 42)}" fill="${GREY}"/>`
      body += line(x + 2, y + 40, x + w - 2, y + 40, 1.1)
      body += text(x + w + 14, y + 76, s.contents, 'start', FONT_SMALL)
    }
    anchors = [[x, y + 24], [x + w / 2, y + 40], [x + w / 2, y + h]]
  }

  if (s.dropped) {
    body += `<circle cx="${n(cx)}" cy="60" r="11" fill="${GREY}" stroke="${INK}" stroke-width="1.2"/>`
    body += `<line x1="${n(cx)}" y1="76" x2="${n(cx)}" y2="118" stroke="${INK}" stroke-width="0.9" stroke-dasharray="4 4"/>`
    body += text(cx - 18, 64, s.dropped, 'end', FONT_SMALL)
    anchors = [[cx, 60], ...anchors]
  }

  if (s.ruler) {
    const rx = 410, ry = 96, rh = 140
    body += rect(rx, ry, 22, rh, '#ffffff')
    for (let i = 1; i < 10; i++) body += line(rx, ry + (rh / 10) * i, rx + (i % 5 ? 7 : 13), ry + (rh / 10) * i, 0.9)
    body += text(rx + 11, ry - 8, 'cm', 'middle', FONT_SMALL)
  }

  // Leader lines from a lettered label to the part it names, which is how a
  // paper asks "name the part labelled A".
  s.labels.forEach((label, i) => {
    const letter = String.fromCharCode(65 + i)
    const target = anchors[i % anchors.length]
    const lx = 12
    const ly = 62 + i * 58
    // The leader runs from the end of the label column to the part it names.
    const from = 132
    body += line(from, ly, target[0], target[1], 0.9)
    body += `<circle cx="${n(from)}" cy="${n(ly)}" r="2.6" fill="${INK}"/>`
    body += text(lx, ly + 4, letter, 'start', 'font-weight="600"')
    body += text(lx + 14, ly + 4, label, 'start', FONT_SMALL)
  })

  return wrap(W, H, body, `A ${s.vessel} labelled ${s.labels.join(', ')}.`)
}
