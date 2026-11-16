// lib/studylab/engines/area-grid/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { AreaGridView } from './View'

/**
 * An algebra product is an area. Two tasks:
 *
 * expand: a rectangle with sides (x + p) and (x + q) cut into four regions,
 * x by x, p by x, x by q and p by q. The learner writes each region's area,
 * then the whole as one expression (the "box" or "grid" method).
 *
 * complete-square: x^2 + bx as a square with a b-by-x strip beside it. The
 * learner cuts the strip, turns one piece round under the square, and the
 * shape nearly closes: the gap is a square exactly when the cut is in half,
 * and its area is (b/2)^2. This is al-Khwarizmi's geometric argument (c. 820
 * CE, Al-Jabr), as taught in Cambridge IGCSE Mathematics 0580 (expanding
 * brackets; completing the square in the Extended syllabus).
 *
 * Negative numbers: an area cannot be negative, and a "(x - 3)" side is a
 * length with a piece taken off, which this picture cannot honestly cut into
 * regions. So p, q and b are positive whole numbers here; faults() refuses the
 * rest with a nearby example. All arithmetic is exact (integers and fractions).
 */

export const TASKS = ['expand', 'complete-square'] as const
export type Task = (typeof TASKS)[number]

export const P_MAX = 9
export const B_MIN = 2
export const B_MAX = 12
export const C_MAX = 30

export type AreaGridConfig =
  | { task: 'expand'; p: number; q: number }
  | { task: 'complete-square'; b: number; c: number }

export const CELLS = ['tl', 'tr', 'bl', 'br'] as const
export type CellId = (typeof CELLS)[number]
export type Cells = Record<CellId, string>
/**
 * expand: the four region areas and the whole, as typed.
 * complete-square: the cut (in half-units from the square, 1 to 2b-1), whether
 * the outer piece has been turned round under the square, and the typed gap area.
 */
export type AreaGridState = { cells?: Partial<Cells>; total?: string; cut?: number; moved?: boolean; corner?: string }

// ---------------------------------------------------------------------------
// Exact fractions.

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
  return { n: n / g + 0, d: d / g }
}
export const sameRat = (a: Rat, b: Rat) => a.n * b.d === b.n * a.d
const MINUS = '−'
export function ratText(r: Rat): string {
  const abs = r.d === 1 ? `${Math.abs(r.n)}` : `${Math.abs(r.n)}/${r.d}`
  return r.n < 0 ? `${MINUS}${abs}` : abs
}
/** A length in half-units as school writes it: 1 -> "0.5", 4 -> "2", 7 -> "3.5". */
export const halvesText = (h: number) => (h % 2 === 0 ? `${h / 2}` : `${(h - 1) / 2}.5`)

/** A number the learner typed, exactly: "9", "9/4", "2.25". Null for anything else. */
export function readRational(raw: unknown): Rat | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/[−–]/g, '-').replace(/\s+/g, '')
  const frac = /^([+-]?)(\d{1,6})\/(\d{1,6})$/.exec(s)
  if (frac) return Number(frac[3]) > 0 ? rat((frac[1] === '-' ? -1 : 1) * Number(frac[2]), Number(frac[3])) : null
  const dec = /^([+-]?)(\d{0,6})(?:\.(\d{1,6}))?$/.exec(s)
  if (!dec || (!dec[2] && !dec[3])) return null
  const places = dec[3]?.length ?? 0
  return rat((dec[1] === '-' ? -1 : 1) * Number(`${dec[2] || '0'}${dec[3] ?? ''}`), 10 ** places)
}

// ---------------------------------------------------------------------------
// Polynomials in x, as typed: "3x", "x^2", "x² + 8x + 15".

export type Poly = [number, number, number] // constant, x, x^2

const clean = (raw: string) =>
  raw.toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/×/g, '*').replace(/²/g, '^2').replace(/\*\*/g, '^')

/** One term "3x", "-x^2", "15": its degree and signed coefficient; null when it is not one. */
function readTerm(t: string): { deg: number; coef: number } | null {
  const m = /^([+-]?)(\d{0,4})\*?(x(?:\^2|\*x)?)?$/.exec(t)
  if (!m || (!m[2] && !m[3])) return null
  const sign = m[1] === '-' ? -1 : 1
  const num = m[2] ? Number(m[2]) : 1
  const deg = !m[3] ? 0 : m[3] === 'x' ? 1 : 2
  return { deg, coef: sign * num + 0 }
}

/** A single term, or null. */
export function readMonomial(raw: unknown): { deg: number; coef: number } | null {
  return typeof raw === 'string' ? readTerm(clean(raw)) : null
}

/** A sum of terms. `collected` is false when a power of x appears twice ("5x + 3x"). Null when unreadable. */
export function readPoly(raw: unknown): { poly: Poly; collected: boolean } | null {
  if (typeof raw !== 'string') return null
  const s = clean(raw)
  if (!s) return null
  const parts = s.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== s) return null
  const poly: Poly = [0, 0, 0]
  const seen = new Set<number>()
  let collected = true
  for (const part of parts) {
    const t = readTerm(part)
    if (!t) return null
    if (seen.has(t.deg)) collected = false
    seen.add(t.deg)
    poly[t.deg] += t.coef
  }
  return { poly, collected }
}

/** "x² + 8x + 15" for [15, 8, 1]. */
export function polyText(poly: Poly): string {
  const parts: string[] = []
  const names = ['', 'x', 'x²']
  for (const deg of [2, 1, 0]) {
    const c = poly[deg]
    if (c === 0) continue
    const body = deg === 0 ? `${Math.abs(c)}` : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${names[deg]}`
    parts.push(parts.length === 0 ? `${c < 0 ? MINUS : ''}${body}` : `${c < 0 ? MINUS : '+'} ${body}`)
  }
  return parts.join(' ') || '0'
}

const termText = (deg: number, coef: number) => polyText(deg === 2 ? [0, 0, coef] : deg === 1 ? [0, coef, 0] : [coef, 0, 0])

// ---------------------------------------------------------------------------
// expand.

export const CELL_NAMES: Record<CellId, string> = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' }

/** The area each region holds: width times height. The top right is p wide and x tall. */
export function regionArea(p: number, q: number, id: CellId): { deg: number; coef: number } {
  if (id === 'tl') return { deg: 2, coef: 1 }
  if (id === 'tr') return { deg: 1, coef: p }
  if (id === 'bl') return { deg: 1, coef: q }
  return { deg: 0, coef: p * q }
}

export const expandedPoly = (p: number, q: number): Poly => [p * q, p + q, 1]

function cellRight(p: number, q: number, id: CellId, typed: unknown): boolean {
  const m = readMonomial(typed)
  const want = regionArea(p, q, id)
  return !!m && m.deg === want.deg && m.coef === want.coef
}

function totalRight(p: number, q: number, typed: unknown): boolean {
  const r = readPoly(typed)
  const want = expandedPoly(p, q)
  return !!r && r.collected && r.poly.every((c, i) => c === want[i])
}

/** The product written out once it may be said: x² + 3x + 5x + 15 = x² + 8x + 15. */
export function expandWorking(p: number, q: number): string {
  const parts = [`x²`, `${p}x`, `${q}x`, `${p * q}`].join(' + ')
  const lead = p === q ? `(x + ${p})² = ` : ''
  return `${lead}${parts} = ${polyText(expandedPoly(p, q))}`
}

/** expand, marked wrong: which regions and what the learner wrote, never what they should have written. */
export function madeExpand(config: AreaGridConfig, state: AreaGridState): string {
  if (config.task !== 'expand') return ''
  const { p, q } = config
  const bad: string[] = []
  for (const id of CELLS) {
    if (cellRight(p, q, id, state?.cells?.[id])) continue
    const t = (state?.cells?.[id] ?? '').trim()
    bad.push(t ? `${CELL_NAMES[id]} (you wrote ${t})` : `${CELL_NAMES[id]} (empty)`)
  }
  if (bad.length) return `Look again at the ${bad.join(', ')}. A region's area is its width times its height.`
  const typed = (state?.total ?? '').trim()
  if (!typed) return 'All four regions are right. Now write the whole area as one expression.'
  const r = readPoly(typed)
  if (!r) return `"${typed}" is not an expression in x: write it like x² + 4x + 3.`
  if (!r.collected) return `You wrote ${typed}: it still has two terms of the same kind. Put them together.`
  return `You wrote ${typed}. The whole area is the four regions added up, with like terms put together.`
}

// ---------------------------------------------------------------------------
// complete-square.

/** The gap in the corner, as the learner has made it: sides a and w in half-units. */
/** A half-unit step of the cut is under 7 px from b = 10 up, too fine to land by hand: a cut one step either side of the middle counts as the middle. */
export const cutSlack = (b: number): number => (b >= 10 ? 1 : 0)
export const cornerSides = (b: number, cut: number): [number, number] => [cut, 2 * b - cut]

export function madeSquare(config: AreaGridConfig, state: AreaGridState): string {
  if (config.task !== 'complete-square') return ''
  const { b } = config
  const cut = Number.isInteger(state?.cut) ? (state.cut as number) : 1
  if (!state?.moved) return 'The piece has not been turned round yet: move it under the square.'
  const [a, w] = cornerSides(b, cut)
  if (Math.abs(cut - b) > cutSlack(b)) return `You cut the strip into ${halvesText(a)} and ${halvesText(w)}, so the gap is ${halvesText(a)} by ${halvesText(w)}: a rectangle, not a square.`
  const typed = (state.corner ?? '').trim()
  if (!typed) return 'Write the area of the gap first.'
  if (!readRational(typed)) return `"${typed}" is not a number: write the area as a whole number, a fraction like 9/4, or a decimal.`
  return `You wrote ${typed} for the gap. Its area is its two sides multiplied.`
}

/** The completed square, said back once marked: x² + 6x + 2 = (x + 3)² − 9 + 2 = (x + 3)² − 7. */
export function squareWorking(b: number, c: number): string {
  const sq = `(x + ${ratText(rat(b, 2))})²`
  const gap = rat(b * b, 4)
  const lhs = `x² + ${b}x${c === 0 ? '' : ` ${c < 0 ? MINUS : '+'} ${Math.abs(c)}`}`
  const k = rat(c * 4 - b * b, 4)
  const kText = k.n === 0 ? sq : `${sq} ${k.n < 0 ? MINUS : '+'} ${ratText(rat(Math.abs(k.n), k.d))}`
  if (c === 0) return `${lhs} = ${sq} ${MINUS} ${ratText(gap)}`
  return `${lhs} = ${sq} ${MINUS} ${ratText(gap)} ${c < 0 ? MINUS : '+'} ${Math.abs(c)} = ${kText}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

function readTask(raw: unknown): Task | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')
  const alias: Record<string, Task> = {
    expand: 'expand', expanding: 'expand', 'expand-brackets': 'expand', 'double-brackets': 'expand', 'box-method': 'expand', 'grid-method': 'expand',
    'complete-square': 'complete-square', 'complete-the-square': 'complete-square', 'completing-the-square': 'complete-square', 'complete-squares': 'complete-square',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' ? (readRational(raw) ? readRational(raw)!.n / readRational(raw)!.d : null) : raw
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000 ? v + 0 : null
}
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

export const areaGridEngine: SceneEngine<AreaGridConfig, AreaGridState> = {
  id: 'area-grid',
  // 'the box method' and 'grid method' are left out on purpose: the catalogue matches single words, and "method" and "grid"
  // would claim "scientific method" and "coordinate grid". Stations that teach the box method say "expanding" or "brackets".
  covers: ['brackets'],
  phrases: ['double brackets', 'completing the square', 'complete the square', 'box method', 'grid method', 'area model'],
  // The learner varies how a product or a square is split into parts.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    // Both { task: 'expand', p, q } and { task: { kind: 'expand', p, q } } read.
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task']) : o.task)
    if (!task) return null
    if (task === 'expand') {
      const p = readNumber(first(src, ['p', 'a', 'first']))
      const q = readNumber(first(src, ['q', 'b', 'second']))
      return p === null || q === null ? null : { task, p, q }
    }
    const b = readNumber(first(src, ['b', 'coefficient']))
    const cRaw = first(src, ['c', 'constant'])
    const c = cRaw === undefined ? 0 : readNumber(cRaw)
    return b === null || c === null ? null : { task, b, c }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'expand') {
      const { p, q } = config
      if (!Number.isInteger(p) || !Number.isInteger(q)) out.push('expand needs whole numbers for p and q: use e.g. (x + 3)(x + 5).')
      else if (p < 1 || q < 1) {
        out.push(`(x ${p < 0 || q < 0 ? '−' : '+'} …) with a negative or zero number cannot be drawn as an area: a length cannot be taken away from a side, and an area cannot be negative. Choose positive p and q, e.g. (x + ${Math.max(1, Math.abs(p))})(x + ${Math.max(1, Math.abs(q))}).`)
      } else if (p > P_MAX || q > P_MAX) {
        out.push(`${Math.max(p, q)} is more than the grid holds (${P_MAX}): use p and q from 1 to ${P_MAX}, e.g. (x + ${Math.min(p, P_MAX)})(x + ${Math.min(q, P_MAX)}).`)
      }
      return out
    }
    const { b, c } = config
    if (!Number.isInteger(b)) out.push(`complete-square needs a whole number b: use e.g. b = ${Math.max(B_MIN, Math.min(B_MAX, Math.round(Math.abs(b))))}.`)
    else if (b < 0) out.push(`x² − ${-b}x has a strip of negative width, which has no area to cut. Use a positive b, e.g. x² + ${Math.min(B_MAX, Math.max(B_MIN, -b))}x.`)
    else if (b < B_MIN) out.push(`b = ${b} leaves only one place to cut the strip, so there is nothing to find. Use b from ${B_MIN} to ${B_MAX}, e.g. x² + 6x.`)
    else if (b > B_MAX) out.push(`b = ${b} makes a strip longer than the picture holds (${B_MAX}): use b from ${B_MIN} to ${B_MAX}, e.g. x² + ${B_MAX}x.`)
    if (!Number.isInteger(c) || Math.abs(c) > C_MAX) out.push(`c must be a whole number from −${C_MAX} to ${C_MAX}: it is not drawn, only used in the working said back after marking. Use e.g. c = 2.`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, '')
    if (config.task === 'expand') {
      const { p, q } = config
      const out: string[] = []
      const sum = new RegExp(`(?<![\\d(+])${p + q}x`, 'i')
      const prod = p * q !== p && p * q !== q && p * q !== p + q ? new RegExp(String.raw`(?<![\d.])${p * q}(?!\d|[./]\d)`) : null
      const quad = /x(\^2|²)[+−-]/i.test(text)
      if (sum.test(text) || (prod && prod.test(text.replace(/\([^)]*\)/g, ''))) || quad) {
        out.push('the prompt gives the answer away: it writes the expanded form or a region\'s area, which the learner is to produce -- ask without it ("Expand (x + 3)(x + 5).")')
      }
      return out
    }
    const { b, c } = config
    const h = b / 2
    const dot = (n: number) => String(n).replace('.', '[.]')
    const alts = Number.isInteger(h) ? `${h}` : `${b}/2|${dot(h)}`
    const said = new RegExp(String.raw`[(]x[+](${alts})[)]`, 'i').test(text)
    const gapNum = (b * b) / 4
    const gapAlts = Number.isInteger(gapNum) ? `${gapNum}` : `${b * b}/4|${dot(gapNum)}`
    const gapSaid = gapNum !== b && gapNum !== c && new RegExp(String.raw`(?<![\d.])(${gapAlts})(?!\d|[./]\d)`).test(text)
    const method = /(?:^|[^a-z])(?:half|halve|halving)(?:[^a-z]|$)|b\/2/i.test(prompt)
    return said || gapSaid || method
      ? ['the prompt gives the answer away: it names the half, the gap or the completed bracket, which the learner is to find by cutting the strip -- ask without it ("Complete the square for x² + 6x.")']
      : []
  },

  initial(config) {
    if (config.task === 'expand') return { cells: { tl: '', tr: '', bl: '', br: '' }, total: '' }
    // A cut of half a unit is never the middle: b is at least 2.
    return { cut: 1, moved: false, corner: '' }
  },

  check(config, state) {
    if (config.task === 'expand') {
      const { p, q } = config
      const wrongIds: string[] = CELLS.filter((id) => !cellRight(p, q, id, state?.cells?.[id])).map((id) => id as string)
      if (!totalRight(p, q, state?.total)) wrongIds.push('total')
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const { b } = config
    const wrongIds: string[] = []
    if (typeof state?.cut !== 'number' || Math.abs(state.cut - b) > cutSlack(b)) wrongIds.push('cut')
    if (!state?.moved) wrongIds.push('moved')
    const typed = readRational(state?.corner)
    if (!typed || !sameRat(typed, rat(b * b, 4))) wrongIds.push('corner')
    return { ok: wrongIds.length === 0, wrongIds }
  },

  solve(config) {
    if (config.task === 'expand') {
      const { p, q } = config
      const cells = Object.fromEntries(CELLS.map((id) => {
        const r = regionArea(p, q, id)
        return [id, termText(r.deg, r.coef)]
      })) as Cells
      return { cells, total: polyText(expandedPoly(p, q)) }
    }
    return { cut: config.b, moved: true, corner: ratText(rat(config.b * config.b, 4)) }
  },

  View: AreaGridView,

  prompt: `SCENE "area-grid" -- an algebra product shown as an area. The learner does it by hand; the engine draws, checks and says it back.
  expand: a rectangle with sides (x + p) and (x + q), already cut into four regions (x by x, p by x, x by q, p by q) with
    its sides labelled. The learner types each region's area into the region, then the whole as one expression. The
    working (x² + 3x + 5x + 15 = x² + 8x + 15) appears once the card is marked.
  complete-square: x² + bx as a square with a strip beside it. The learner drags the cut across the strip, turns the outer
    piece round under the square, and sees a gap in the corner: a rectangle unless the cut is in half. They type the gap's
    area. (x + b/2)² − (b/2)² is said back once marked. Nothing names the half or the gap before that.
  For: expanding double brackets, the box method, grid method, completing the square.
  expand: p and q are whole numbers from 1 to 9. NO negative numbers: an area cannot be negative, so (x − 3) is refused.
  complete-square: b is a whole number from 2 to 12, odd allowed (x² + 5x gives a gap of 25/4); optional c (-30 to 30) is not
    drawn and only shapes the working said back, so put x² + 6x + 2 in the prompt if you want it. NO negative b.
  config: { "task":"expand", "p":3, "q":5 }  -- the prompt says "Expand (x + 3)(x + 5)." (do NOT write the answer in it)
       or { "task":"complete-square", "b":6, "c":0 }  -- the prompt says "Complete the square for x² + 6x: cut the strip, then move its outer piece under the square." (do NOT say half, b/2 or the gap)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Expand (x + 3)(x + 5).",
    "payload": { "engine":"area-grid", "config": { "task":"expand", "p":3, "q":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:area-grid", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Complete the square for x² + 6x: cut the strip, then move its outer piece under the square.",
    "payload": { "engine":"area-grid", "config": { "task":"complete-square", "b":6, "c":0 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:area-grid", "why":"..." } }`,
}

registerEngine(areaGridEngine as SceneEngine<unknown, unknown>)
