// lib/studylab/engines/coordinate-plane/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CoordinatePlaneView } from './View'

/**
 * Straight-line graphs on a coordinate grid, as lower secondary and IGCSE
 * teach them (Cambridge IGCSE Mathematics 0580, "Coordinate geometry": the
 * gradient of a line as rise over run, the y-intercept, y = mx + c). The tutor
 * names a gradient and an intercept; the engine draws, measures and marks.
 *
 * All arithmetic is exact: points are whole-number grid points, and the
 * gradients and intercepts the tutor may ask for are whole numbers and halves,
 * so every comparison is between integers and fractions, never floats.
 */

/** The grid runs from -GRID to GRID on both axes, a grid line at every whole number. */
export const GRID = 6
/** Gradients and intercepts the tutor may ask for: whole numbers and halves from -LIMIT to LIMIT. */
export const LIMIT = 5

export const KINDS = ['make-line', 'find-intercept', 'read-gradient'] as const
export type Kind = (typeof KINDS)[number]

export type CoordinatePlaneConfig = { task: { kind: Kind; gradient: number; intercept: number } }
/** A grid point, [x, y], both whole numbers from -GRID to GRID. */
export type Point = [number, number]
/**
 * make-line: the learner's two points `a` and `b`.
 * find-intercept: the point they chose, or null before they choose.
 * read-gradient: the triangle's run along the line, and the gradient they typed.
 */
export type CoordinatePlaneState = { a?: Point; b?: Point; pick?: Point | null; run?: number; answer?: string }

// ---------------------------------------------------------------------------
// Exact fractions.

/** A fraction in lowest terms, the denominator positive. */
export type Rat = { n: number; d: number }

const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

export function rat(n: number, d = 1): Rat {
  if (d < 0) { n = -n; d = -d }
  const g = gcd(n, d)
  // `+ 0` turns -0 into 0.
  return { n: n / g + 0, d: d / g }
}

/** A whole number or half as a fraction. */
export const fromHalves = (v: number): Rat => rat(Math.round(v * 2), 2)
export const sameRat = (a: Rat, b: Rat) => a.n * b.d === b.n * a.d

const MINUS = '−'
const signed = (v: number) => (v < 0 ? `${MINUS}${Math.abs(v)}` : `${v}`)

/** "2", "−3", "1/2", "−5/3". */
export function ratText(r: Rat): string {
  const abs = r.d === 1 ? `${Math.abs(r.n)}` : `${Math.abs(r.n)}/${r.d}`
  return r.n < 0 ? `${MINUS}${abs}` : abs
}

/** "(0, −1)", "(3, 2)", "(0, −5/3)". */
export const pointText = (p: ReadonlyArray<number | Rat>): string =>
  `(${p.map((v) => (typeof v === 'number' ? signed(v) : ratText(v))).join(', ')})`

/**
 * y = mx + c as a school writes it: "y = 2x + 1", "y = −x + 3", "y = (1/2)x − 2",
 * "y = 3x", "y = −4", "y = 0". A fractional gradient is bracketed so it cannot
 * be read as 1/(2x).
 */
export function equationText(m: Rat, c: Rat): string {
  let x = ''
  if (m.n !== 0) {
    const abs = rat(Math.abs(m.n), m.d)
    const coeff = abs.d !== 1 ? `(${ratText(abs)})` : abs.n === 1 ? '' : `${abs.n}`
    x = `${m.n < 0 ? MINUS : ''}${coeff}x`
  }
  if (!x) return `y = ${ratText(c)}`
  if (c.n === 0) return `y = ${x}`
  return `y = ${x} ${c.n < 0 ? MINUS : '+'} ${ratText(rat(Math.abs(c.n), c.d))}`
}

// ---------------------------------------------------------------------------
// Lines and grid points.

export type Line = { kind: 'sloped'; m: Rat; c: Rat } | { kind: 'vertical'; x: number }

const isGridValue = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= GRID

/** A grid point read from state, or null when it is not one. */
export function gridPoint(raw: unknown): Point | null {
  return Array.isArray(raw) && raw.length === 2 && isGridValue(raw[0]) && isGridValue(raw[1]) ? [raw[0] + 0, raw[1] + 0] : null
}

export const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]

/** The line through two grid points, exactly; null when they are the same point. */
export function lineThrough(a: Point, b: Point): Line | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return null
  if (dx === 0) return { kind: 'vertical', x: a[0] }
  // c = y1 - (dy/dx) x1, over the common denominator dx.
  return { kind: 'sloped', m: rat(dy, dx), c: rat(a[1] * dx - dy * a[0], dx) }
}

/** Whether a grid point lies on y = mx + c, for a whole-or-half m and c: compared as integers. */
export function onLine(m: number, c: number, p: Point): boolean {
  return 2 * p[1] === Math.round(2 * m) * p[0] + Math.round(2 * c)
}

/** The grid points y = mx + c passes through, left to right. */
export function gridPointsOn(m: number, c: number): Point[] {
  const out: Point[] = []
  for (let x = -GRID; x <= GRID; x++) {
    const p: Point = [x, m * x + c]
    if (Number.isInteger(p[1]) && Math.abs(p[1]) <= GRID) out.push([x, p[1] + 0])
  }
  return out
}

// ---------------------------------------------------------------------------
// Reading what the tutor and the learner write.

const tidy = (raw: string) => raw.trim().replace(/[−–]/g, '-').replace(/\s+/g, '')

/**
 * A number the learner typed, exactly: "2", "-3", "1/2", "−3/2", "0.5", "-1.25".
 * Null for anything else.
 */
export function readRational(raw: unknown): Rat | null {
  if (typeof raw !== 'string') return null
  const s = tidy(raw)
  const frac = /^([+-]?)(\d{1,6})\/(\d{1,6})$/.exec(s)
  if (frac) return Number(frac[3]) > 0 ? rat((frac[1] === '-' ? -1 : 1) * Number(frac[2]), Number(frac[3])) : null
  const dec = /^([+-]?)(\d{0,6})(?:\.(\d{1,6}))?$/.exec(s)
  if (!dec || (!dec[2] && !dec[3])) return null
  const places = dec[3]?.length ?? 0
  return rat((dec[1] === '-' ? -1 : 1) * Number(`${dec[2] || '0'}${dec[3] ?? ''}`), 10 ** places)
}

/** A gradient or intercept the grid can show: a whole number or half from -5 to 5, written as a number or a string. */
function readValue(raw: unknown): number | null {
  let v: number | null = null
  if (typeof raw === 'number') v = raw
  else if (typeof raw === 'string') {
    const r = readRational(raw)
    v = r ? r.n / r.d : null
  }
  if (v === null || !Number.isFinite(v) || Math.abs(v) > LIMIT) return null
  const twice = v * 2
  return Math.abs(twice - Math.round(twice)) < 1e-9 ? Math.round(twice) / 2 + 0 : null
}

/** "make-line", "make line", "makeLine", "Make_Line"; and the obvious other names for the tasks. */
function readKind(raw: unknown): Kind | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')
  const alias: Record<string, Kind> = {
    'make-line': 'make-line', 'draw-line': 'make-line',
    'find-intercept': 'find-intercept', 'find-y-intercept': 'find-intercept',
    'read-gradient': 'read-gradient', 'find-gradient': 'read-gradient',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

// ---------------------------------------------------------------------------
// What the learner made, in words: for the marking, never before it.

/** The line asked for, in words, once it may be named. */
export function namedLine(config: CoordinatePlaneConfig): string {
  const { gradient: m, intercept: c } = config.task
  return `${equationText(fromHalves(m), fromHalves(c))}: gradient ${ratText(fromHalves(m))}, crossing the y-axis at ${pointText([rat(0), fromHalves(c)])}`
}

/** make-line, marked wrong: the line the learner made, and how it differs from the one asked for. */
export function madeLine(config: CoordinatePlaneConfig, a: Point, b: Point): string {
  const line = lineThrough(a, b)
  if (!line) return 'Your two points are on the same spot.'
  if (line.kind === 'vertical') return `You made x = ${signed(line.x)}, a vertical line: its run is 0, so it has no gradient.`
  const M = fromHalves(config.task.gradient)
  const steepOk = sameRat(line.m, M)
  const crossOk = sameRat(line.c, fromHalves(config.task.intercept))
  const made = `You made ${equationText(line.m, line.c)}`
  if (steepOk && !crossOk) return `${made}: the gradient is right, but it crosses the y-axis somewhere else.`
  if (!crossOk) return `${made}.`
  const mine = line.m.n / line.m.d
  const want = M.n / M.d
  const how = mine === 0 ? 'it is flat'
    : want === 0 ? 'it slopes'
    : Math.sign(mine) !== Math.sign(want) ? 'it slopes the other way'
    : Math.abs(mine) > Math.abs(want) ? 'it is too steep' : 'it is not steep enough'
  return `${made}: it crosses the y-axis in the right place, but ${how}.`
}

/** find-intercept, marked wrong: where the chosen point is, never where the answer is. */
export function madePick(config: CoordinatePlaneConfig, pick: Point | null): string {
  if (!pick) return 'Choose a point first: tap the grid, or use the arrow keys.'
  const on = onLine(config.task.gradient, config.task.intercept, pick)
  const at = `You chose ${pointText(pick)}`
  if (on && pick[1] === 0) return `${at}, where the line crosses the x-axis.`
  if (on) return `${at}: it is on the line, but not on the y-axis.`
  if (pick[0] === 0) return `${at}: it is on the y-axis, but the line does not pass through it.`
  return `${at}: it is not on the line, and not on the y-axis.`
}

/** read-gradient, marked wrong: what a line with the gradient the learner wrote would do. */
export function madeGradient(answer: unknown): string {
  const typed = typeof answer === 'string' ? answer.trim() : ''
  const r = readRational(typed)
  if (!typed) return 'Write the gradient in the box first.'
  if (!r) return `"${typed}" is not a number: write the gradient as a whole number, a fraction like 3/2, or a decimal.`
  if (r.n === 0) return `You wrote ${typed}: a line with gradient 0 is flat.`
  return `You wrote ${typed}: a line with that gradient goes ${r.n > 0 ? 'up' : 'down'} ${Math.abs(r.n)} for every ${r.d} across.`
}

/** The read-gradient triangle: its corner on the line, the smallest run between grid points, and the largest the grid holds. */
export function triangleOn(m: number, c: number): { from: Point; step: number; most: number } | null {
  const pts = gridPointsOn(m, c)
  if (pts.length < 2) return null
  return { from: pts[0], step: pts[1][0] - pts[0][0], most: pts[pts.length - 1][0] - pts[0][0] }
}

// ---------------------------------------------------------------------------

export const coordinatePlaneEngine: SceneEngine<CoordinatePlaneConfig, CoordinatePlaneState> = {
  id: 'coordinate-plane',
  covers: [
    'straight-line graphs', 'gradient as rise over run', 'the y-intercept', 'y = mx + c',
    'drawing a line from its equation', 'reading the gradient of a line from a graph',
  ],
  isolates: 'position',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readKind(t.kind)
    const gradient = readValue(first(t, ['gradient', 'm', 'slope']))
    const intercept = readValue(first(t, ['intercept', 'c', 'yIntercept', 'y-intercept', 'y_intercept']))
    if (!kind || gradient === null || intercept === null) return null
    return { task: { kind, gradient, intercept } }
  },

  faults(config) {
    const { kind, gradient: m, intercept: c } = config.task
    const eq = equationText(fromHalves(m), fromHalves(c))
    if (kind === 'find-intercept') {
      return Number.isInteger(c) ? [] : [
        `find-intercept needs a whole-number intercept, so the crossing is a grid point the learner can tap: ${eq} crosses the y-axis between grid points. Choose a whole-number intercept from -5 to 5.`,
      ]
    }
    const out: string[] = []
    const count = gridPointsOn(m, c).length
    if (count < 2) {
      const why = kind === 'make-line' ? 'it cannot be made from two grid points' : 'no rise-over-run triangle can be drawn on it between grid points'
      out.push(Number.isInteger(m) && !Number.isInteger(c)
        ? `${eq} passes through no grid point, so ${why}: a whole-number gradient needs a whole-number intercept.`
        : `${eq} passes through ${count === 0 ? 'no grid point' : 'only one grid point'} between -6 and 6, so ${why}. Choose a gentler gradient or an intercept nearer 0.`)
    }
    if (kind === 'read-gradient' && m === 0) {
      out.push('read-gradient needs a sloping line: with gradient 0 the triangle has no rise, so there is nothing to read. Use make-line for a flat line, or choose another gradient.')
    }
    return out
  },

  // make-line names its line as the task; the other two draw it, and the learner reads it.
  promptFaults(config, prompt) {
    if (config.task.kind === 'make-line') return []
    const said = /\by\s*=/i.test(prompt) || /\(\s*0\s*,\s*[-−–]?\s*\d/.test(prompt)
    return said ? ['the prompt gives the answer away: it writes the line\'s equation or where it crosses the y-axis, which the learner is to read off the graph -- ask without it ("Tap the point where this line crosses the y-axis.")'] : []
  },

  initial(config) {
    const { kind, gradient: m, intercept: c } = config.task
    // A gradient of 1/3 is never one the tutor can ask for (they are whole or
    // half), so the starting line is never the answer; its intercept is moved
    // off the asked one too, so neither half of y = mx + c is given.
    if (kind === 'make-line') return c === -1 ? { a: [-3, 0], b: [3, 2] } : { a: [-3, -2], b: [3, 0] }
    if (kind === 'find-intercept') return { pick: null }
    return { run: triangleOn(m, c)?.step ?? 1, answer: '' }
  },

  check(config, state) {
    const { kind, gradient: m, intercept: c } = config.task
    if (kind === 'make-line') {
      // Two different grid points both on the asked line make that line, whichever two they are.
      const a = gridPoint(state?.a)
      const b = gridPoint(state?.b)
      return { ok: !!a && !!b && !samePoint(a, b) && onLine(m, c, a) && onLine(m, c, b), wrongIds: [] }
    }
    if (kind === 'find-intercept') {
      const p = gridPoint(state?.pick)
      return { ok: !!p && p[0] === 0 && p[1] === c, wrongIds: [] }
    }
    const typed = readRational(state?.answer)
    return { ok: !!typed && sameRat(typed, fromHalves(m)), wrongIds: [] }
  },

  solve(config) {
    const { kind, gradient: m, intercept: c } = config.task
    if (kind === 'make-line') {
      // The two grid points nearest the y-axis: the crossing itself when it is a grid point.
      const near = gridPointsOn(m, c).sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]) || q[0] - p[0]).slice(0, 2).sort((p, q) => p[0] - q[0])
      return near.length === 2 ? { a: near[0], b: near[1] } : { a: [0, c], b: [1, m + c] }
    }
    if (kind === 'find-intercept') return { pick: [0, c] }
    return { run: triangleOn(m, c)?.most ?? 1, answer: ratText(fromHalves(m)).replace(MINUS, '-') }
  },

  View: CoordinatePlaneView,

  prompt: `SCENE "coordinate-plane" -- a coordinate grid from -6 to 6 on both axes with a straight line. The learner
  drags points that snap to the grid (or moves them with the arrow keys); the engine draws the line and its
  rise-over-run triangle, labelled "rise" and "run" without numbers: the learner counts the squares. The
  numbers, and the equation of the line the learner made, appear once the card is marked.
  For: straight-line graphs, gradient as rise over run, the y-intercept, y = mx + c.
  gradient and intercept: whole numbers or halves from -5 to 5 (2, -1, "1/2", -1.5).
  config: { "task": { "kind":"make-line", "gradient":2, "intercept":1 } }  -- drag two points to make y = 2x + 1
            (name the line in the prompt; a whole-number gradient needs a whole-number intercept)
       or { "task": { "kind":"find-intercept", "gradient":-1, "intercept":3 } }  -- the engine draws the line, the
            learner taps where it crosses the y-axis (a whole-number intercept; do NOT write the equation in the prompt)
       or { "task": { "kind":"read-gradient", "gradient":"1/2", "intercept":-2 } }  -- the engine draws the line and a
            rise-over-run triangle the learner stretches; they count its rise and run and type the gradient
            (not 0; do NOT write the equation)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Make the line y = 2x + 1.",
    "payload": { "engine":"coordinate-plane", "config": { "task": { "kind":"make-line", "gradient":2, "intercept":1 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:coordinate-plane", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the point where this line crosses the y-axis.",
    "payload": { "engine":"coordinate-plane", "config": { "task": { "kind":"find-intercept", "gradient":-1, "intercept":3 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:coordinate-plane", "why":"..." } }`,
}

registerEngine(coordinatePlaneEngine as SceneEngine<unknown, unknown>)
