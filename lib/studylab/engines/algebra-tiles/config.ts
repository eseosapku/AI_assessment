// lib/studylab/engines/algebra-tiles/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { AlgebraTilesView } from './View'

/**
 * Linear equations in one unknown, solved on a balance of algebra tiles, as
 * Cambridge teaches them: IGCSE Mathematics 0580 (2025-2027 syllabus), topic
 * 2.5 Equations, "solve linear equations in one unknown"; and the Lower
 * Secondary Mathematics 0862 framework's algebra strand, where the unknown
 * comes to sit on both sides. The balance method -- do the same to both sides
 * -- with x tiles, unit tiles and their negatives (zero pairs) is the standard
 * algebra-tile model of it.
 *
 * The tutor names the equation, ax + b = cx + d. The two pans hold its tiles
 * and stay level, because the learner can only make legal moves, each done to
 * both pans at once: add or take away the same tile, remove zero pairs, or
 * share both pans into the same number of equal groups and keep one. A move
 * that would unbalance the pans is refused, with the reason, so every state
 * the learner reaches is an equation with the same solution. Solved is one x
 * tile alone on one pan and unit tiles of one sign on the other.
 *
 * All arithmetic is in whole tiles: there are no fractions and no floats.
 */

/** The x coefficients a pan starts with: whole numbers from -MAX_X to MAX_X. */
export const MAX_X = 5
/** The constants a pan starts with: whole numbers from -MAX_UNITS to MAX_UNITS, two rows of ten. */
export const MAX_UNITS = 20
/**
 * What one pan can hold while the learner works, so the tiles fit and stay
 * countable: ten x and -x tiles together (|a| + |c| at most, when x tiles are
 * added to clear the other side), and thirty 1 and -1 tiles together -- three
 * rows of ten, or four when positive and negative rows are kept apart. The
 * engine's own solution of every config faults() passes stays within these
 * (proved by the tests); an equation whose working needs more is refused.
 */
export const PAN_X = 2 * MAX_X
export const PAN_UNITS = 30
/** The most equal groups a pan may be shared into: no pan holds more x tiles than this. */
export const SHARE_MAX = PAN_X
/** Beyond this many steps the working stops being something to read. */
export const MAX_MOVES = 40

export const TILES = ['x', '-x', '1', '-1'] as const
export type Tile = (typeof TILES)[number]

/** One side of the equation as the tutor names it: x lots of x, plus units. */
export type Expr = { x: number; units: number }
export type AlgebraTilesConfig = { task: { kind: 'solve'; left: Expr; right: Expr } }

/**
 * A move, done to both pans. `n` counts repeats of the same tile: tapping
 * "take 1" twice is one step, "take 2 from both sides".
 */
export type Move = { op: 'add' | 'take'; tile: Tile; n: number } | { op: 'zero' } | { op: 'share'; n: number }
/** The learner's moves from the start; the pans are worked out from them, so no state can be reached by an illegal move. */
export type AlgebraTilesState = { moves: Move[] }

/** The tiles on one pan, by kind. */
export type Pan = Record<Tile, number>
export type Side = 'left' | 'right'
export type Pans = { left: Pan; right: Pan }

const MINUS = '−'
const SIDES: Side[] = ['left', 'right']

// ---------------------------------------------------------------------------
// Pans and what they say.

export function panOf(e: Expr): Pan {
  return { 'x': Math.max(e.x, 0), '-x': Math.max(-e.x, 0), '1': Math.max(e.units, 0), '-1': Math.max(-e.units, 0) }
}

export const startPans = (config: AlgebraTilesConfig): Pans => ({ left: panOf(config.task.left), right: panOf(config.task.right) })

/** What a pan is worth, as x and units. */
export const netOf = (p: Pan): Expr => ({ x: p['x'] - p['-x'], units: p['1'] - p['-1'] })

export const xTiles = (p: Pan) => p['x'] + p['-x']
export const unitTiles = (p: Pan) => p['1'] + p['-1']
export const hasZeroPairs = (p: Pan) => (p['x'] > 0 && p['-x'] > 0) || (p['1'] > 0 && p['-1'] > 0)

const signed = (v: number) => (v < 0 ? `${MINUS}${-v}` : `${v}`)
const coeff = (n: number) => (n === 1 ? 'x' : `${n}x`)
/** n lots of x as a school writes it: "x", "−x", "3x", "−2x". */
const xText = (n: number) => (n === 1 ? 'x' : n === -1 ? `${MINUS}x` : `${signed(n)}x`)

/**
 * A pan as it is written, tile for tile: "3x + 2", "x − 4", "−2x", "2x − x + 3 − 3"
 * (zero pairs and all), and "0" for an empty pan.
 */
export function panText(p: Pan): string {
  const terms: [1 | -1, string][] = []
  if (p['x']) terms.push([1, coeff(p['x'])])
  if (p['-x']) terms.push([-1, coeff(p['-x'])])
  if (p['1']) terms.push([1, `${p['1']}`])
  if (p['-1']) terms.push([-1, `${p['-1']}`])
  if (!terms.length) return '0'
  return terms.map(([sign, t], i) => (i === 0 ? (sign < 0 ? `${MINUS}${t}` : t) : `${sign < 0 ? MINUS : '+'} ${t}`)).join(' ')
}

export const exprText = (e: Expr) => panText(panOf(e))
export const equationText = (p: Pans) => `${panText(p.left)} = ${panText(p.right)}`
export const configText = (config: AlgebraTilesConfig) => equationText(startPans(config))

const TILE_NAMES: Record<Tile, string> = { 'x': 'x tile', '-x': `${MINUS}x tile`, '1': 'unit tile', '-1': `${MINUS}1 tile` }
const article = (t: Tile) => (t === 'x' ? 'an' : 'a')
const count = (n: number, t: Tile) => `${n} ${TILE_NAMES[t]}${n === 1 ? '' : 's'}`

/** A pan in words, for a screen reader: what is on it, never what x is. */
export function panWords(p: Pan): string {
  const parts = TILES.filter((t) => p[t] > 0).map((t) => count(p[t], t))
  if (!parts.length) return 'empty'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** How much of a tile a move adds or takes, as a school writes it: "x", "2x", "−x", "3", "−2". */
function amountText(tile: Tile, n: number): string {
  if (tile === 'x') return coeff(n)
  if (tile === '-x') return `${MINUS}${coeff(n)}`
  return tile === '1' ? `${n}` : `${MINUS}${n}`
}

/** A step of the working, in words. */
export function moveText(m: Move): string {
  if (m.op === 'zero') return 'Remove the zero pairs'
  if (m.op === 'share') return `Share each side into ${m.n} equal groups and keep one`
  return m.op === 'add' ? `Add ${amountText(m.tile, m.n)} to both sides` : `Take ${amountText(m.tile, m.n)} from both sides`
}

// ---------------------------------------------------------------------------
// Moves: each is done to both pans, or refused with the reason.

export type Applied = { ok: true; pans: Pans } | { ok: false; refused: string }

const bothOrOne = (bad: Side[], one: (s: Side) => string, both: string) => (bad.length === 2 ? both : one(bad[0]))

export function applyMove(pans: Pans, m: Move): Applied {
  if (m.op === 'add' || m.op === 'take') {
    if (!Number.isInteger(m.n) || m.n < 1) return { ok: false, refused: 'That move cannot be made.' }
    if (m.op === 'take') {
      const short = SIDES.filter((s) => pans[s][m.tile] < m.n)
      if (short.length) {
        const name = m.n === 1 ? `${article(m.tile)} ${TILE_NAMES[m.tile]}` : count(m.n, m.tile)
        return {
          ok: false,
          refused: bothOrOne(
            short,
            (s) => `The ${s} pan has no ${m.n === 1 ? TILE_NAMES[m.tile] : count(m.n, m.tile)} to take away, and whatever you take from one side you must take from the other.`,
            `Neither pan has ${name} to take away.`,
          ),
        }
      }
      const take = (p: Pan): Pan => ({ ...p, [m.tile]: p[m.tile] - m.n })
      return { ok: true, pans: { left: take(pans.left), right: take(pans.right) } }
    }
    const isX = m.tile === 'x' || m.tile === '-x'
    const full = SIDES.filter((s) => (isX ? xTiles(pans[s]) + m.n > PAN_X : unitTiles(pans[s]) + m.n > PAN_UNITS))
    if (full.length) {
      return {
        ok: false,
        refused: bothOrOne(
          full,
          (s) => `The ${s} pan has no room for more ${isX ? 'x' : 'unit'} tiles: take tiles away or remove zero pairs first.`,
          `Neither pan has room for more ${isX ? 'x' : 'unit'} tiles: take tiles away or remove zero pairs first.`,
        ),
      }
    }
    const add = (p: Pan): Pan => ({ ...p, [m.tile]: p[m.tile] + m.n })
    return { ok: true, pans: { left: add(pans.left), right: add(pans.right) } }
  }

  if (m.op === 'zero') {
    if (!hasZeroPairs(pans.left) && !hasZeroPairs(pans.right)) {
      return { ok: false, refused: `There are no zero pairs to remove: a zero pair is a 1 tile with a ${MINUS}1 tile, or an x tile with a ${MINUS}x tile, on the same pan.` }
    }
    const clear = (p: Pan): Pan => {
      const xs = Math.min(p['x'], p['-x'])
      const us = Math.min(p['1'], p['-1'])
      return { 'x': p['x'] - xs, '-x': p['-x'] - xs, '1': p['1'] - us, '-1': p['-1'] - us }
    }
    return { ok: true, pans: { left: clear(pans.left), right: clear(pans.right) } }
  }

  // Sharing into equal groups: every kind of tile on both pans must share out exactly.
  if (!Number.isInteger(m.n) || m.n < 2 || m.n > SHARE_MAX) return { ok: false, refused: 'That move cannot be made.' }
  for (const s of SIDES) {
    const p = pans[s]
    const t = TILES.find((k) => p[k] % m.n !== 0)
    if (t) {
      const first = `The ${s} pan's ${count(p[t], t)} cannot be shared into ${m.n} equal groups.`
      return { ok: false, refused: hasZeroPairs(p) ? `${first} Remove the zero pairs first.` : first }
    }
  }
  const share = (p: Pan): Pan => ({ 'x': p['x'] / m.n, '-x': p['-x'] / m.n, '1': p['1'] / m.n, '-1': p['-1'] / m.n })
  return { ok: true, pans: { left: share(pans.left), right: share(pans.right) } }
}

/** A move read from state, or null when it is not one. */
function readMove(raw: unknown): Move | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const n = r.n
  if (r.op === 'zero') return { op: 'zero' }
  if (r.op === 'share') return typeof n === 'number' && Number.isInteger(n) ? { op: 'share', n } : null
  if ((r.op === 'add' || r.op === 'take') && (TILES as readonly unknown[]).includes(r.tile) && typeof n === 'number' && Number.isInteger(n)) {
    return { op: r.op, tile: r.tile as Tile, n }
  }
  return null
}

/** The learner's moves, read from state; null when any is not a move. */
export function readMoves(state: unknown): Move[] | null {
  const moves = (state as { moves?: unknown } | null)?.moves
  if (moves === undefined) return []
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return null
  const out: Move[] = []
  for (const raw of moves) {
    const m = readMove(raw)
    if (!m) return null
    out.push(m)
  }
  return out
}

export type Step = { move: Move; pans: Pans }
export type Replayed = { start: Pans; steps: Step[]; pans: Pans; refused: string | null }

/** The pans after each of the learner's moves, from the tutor's equation; it stops at a move that cannot be made. */
export function replay(config: AlgebraTilesConfig, state: unknown): Replayed {
  const start = startPans(config)
  const moves = readMoves(state)
  if (!moves) return { start, steps: [], pans: start, refused: 'The working could not be read.' }
  const steps: Step[] = []
  let pans = start
  for (const move of moves) {
    const next = applyMove(pans, move)
    if (!next.ok) return { start, steps, pans, refused: next.refused }
    pans = next.pans
    steps.push({ move, pans })
  }
  return { start, steps, pans, refused: null }
}

/**
 * The learner's next move, or why it cannot be made. A move repeating the last
 * one's tile joins it ("take 1", "take 1" is "take 2 from both sides").
 */
export function withMove(config: AlgebraTilesConfig, state: unknown, move: Move): { ok: true; state: AlgebraTilesState; pans: Pans } | { ok: false; refused: string } {
  const r = replay(config, state)
  const moves = (readMoves(state) ?? []).slice(0, r.steps.length)
  const next = applyMove(r.pans, move)
  if (!next.ok) return next
  const last = moves[moves.length - 1]
  if (last && (last.op === 'add' || last.op === 'take') && move.op === last.op && move.tile === last.tile) {
    return { ok: true, state: { moves: [...moves.slice(0, -1), { ...last, n: last.n + move.n }] }, pans: next.pans }
  }
  if (moves.length >= MAX_MOVES) return { ok: false, refused: `That is ${MAX_MOVES} steps: undo some, or start again.` }
  return { ok: true, state: { moves: [...moves, move] }, pans: next.pans }
}

/** The working with its last tile taken back. */
export function undoMove(state: unknown): AlgebraTilesState {
  const moves = readMoves(state) ?? []
  const last = moves[moves.length - 1]
  if (!last) return { moves: [] }
  if ((last.op === 'add' || last.op === 'take') && last.n > 1) return { moves: [...moves.slice(0, -1), { ...last, n: last.n - 1 }] }
  return { moves: moves.slice(0, -1) }
}

// ---------------------------------------------------------------------------
// The solution, and marking.

/** x for the tutor's equation: a whole number, or null when there is none (x cancels, or comes out a fraction). */
export function solution(config: AlgebraTilesConfig): number | null {
  const { left: l, right: r } = config.task
  const k = l.x - r.x
  if (k === 0) return null
  const v = r.units - l.units
  return v % k === 0 ? v / k + 0 : null
}

/** x as the pans show it once it is found -- one x tile alone, unit tiles of one sign opposite -- or null. */
export function foundValue(p: Pans): number | null {
  for (const [xs, other] of [[p.left, p.right], [p.right, p.left]]) {
    const alone = xs['x'] === 1 && xs['-x'] === 0 && unitTiles(xs) === 0
    const units = xTiles(other) === 0 && !hasZeroPairs(other) && unitTiles(other) > 0
    if (alone && units) return netOf(other).units
  }
  return null
}

/** Marked wrong: the equation the learner has, and what is left to do. Never x's value. */
export function progress(config: AlgebraTilesConfig, state: unknown): string {
  const r = replay(config, state)
  if (r.refused) return 'Your working could not be followed: start again.'
  const eq = equationText(r.pans)
  const { left, right } = r.pans
  const you = `You have ${eq}`
  if (xTiles(left) > 0 && xTiles(right) > 0) return `${you}: there are x tiles on both sides.`
  if (hasZeroPairs(left) || hasZeroPairs(right)) return `${you}: there are zero pairs still to remove.`
  if (xTiles(left) === 0 && xTiles(right) === 0) return `${you}: there are no x tiles left.`
  const xs = xTiles(left) > 0 ? left : right
  if (unitTiles(xs) > 0) return `${you}: there are still unit tiles beside the x tiles.`
  const k = netOf(xs).x
  if (k === -1) return `${you}: the x tile is negative, so this tells you ${MINUS}x, not x.`
  if (k < 0) return `${you}: the x tiles are negative.`
  if (k > 1) return `${you}: one more step.`
  return `${you}.`
}

const inBrackets = (v: number) => (v < 0 ? `(${signed(v)})` : `${v}`)

/** One side with x put back in: "3 × 3 + 2 = 11", "−(−2) + 8 = 10", "5". */
function substituted(e: Expr, x: number): string {
  const value = e.x * x + e.units
  if (e.x === 0) return signed(value)
  const xs = e.x === 1 ? inBrackets(x) : e.x === -1 ? `${MINUS}${inBrackets(x)}` : `${signed(e.x)} × ${inBrackets(x)}`
  const units = e.units === 0 ? '' : ` ${e.units < 0 ? MINUS : '+'} ${Math.abs(e.units)}`
  return `${xs}${units} = ${signed(value)}`
}

/** Marked right: x, and the first equation with it put back in, so the learner sees both sides come to the same. */
export function rightText(config: AlgebraTilesConfig): string {
  const x = solution(config)
  if (x === null) return ''
  const { left, right } = config.task
  return `x = ${signed(x)}. Put it back in: the left side is ${substituted(left, x)}, and the right side is ${substituted(right, x)}.`
}

/**
 * Whether the working fits the pans: before x can be shared out, one pan holds
 * kx and the other k times x in unit tiles, |d - b| of them. Every other step
 * of the engine's solution holds fewer (proved by the tests).
 */
export const workingFits = (config: AlgebraTilesConfig) => Math.abs(config.task.right.units - config.task.left.units) <= PAN_UNITS

/**
 * The engine's own solution, as moves, the way a learner works: x tiles off
 * one side, unit tiles off the other, then share. Unit tiles both sides share
 * are taken away; the rest are paired off with opposite tiles, as many at a
 * time as the pans hold. Every move acts on both pans alike, so the same moves
 * solve the equation written either way round; it is worked as if x ends on
 * the left.
 */
export function solveMoves(config: AlgebraTilesConfig): Move[] {
  let { x: a, units: b } = config.task.left
  let { x: c, units: d } = config.task.right
  if (a < c) [a, b, c, d] = [c, d, a, b]
  const moves: Move[] = []
  if (c > 0) moves.push({ op: 'take', tile: 'x', n: c })
  else if (c < 0) moves.push({ op: 'add', tile: 'x', n: -c }, { op: 'zero' })
  if (b !== 0) {
    const same: Tile = b > 0 ? '1' : '-1'
    const opposite: Tile = b > 0 ? '-1' : '1'
    // The unit tiles on the x side, all of b's sign, and the other side's, counted in b's sign.
    let near = Math.abs(b)
    let far = d * Math.sign(b)
    if (far > 0) {
      const both = Math.min(near, far)
      moves.push({ op: 'take', tile: same, n: both })
      near -= both
      far -= both
    }
    while (near > 0) {
      const m = Math.min(near, PAN_UNITS - near, PAN_UNITS + far)
      // Only when the working cannot fit the pans, which faults() refuses.
      if (m <= 0) break
      moves.push({ op: 'add', tile: opposite, n: m }, { op: 'zero' })
      near -= m
      far -= m
    }
  }
  if (a - c > 1) moves.push({ op: 'share', n: a - c })
  return moves
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const tidy = (s: string) => s.replace(/[−–]/g, '-').replace(/\s+/g, '').toLowerCase()

const NUM = String.raw`\d{1,6}(?:\.\d{1,6})?`
const TERM = `(?:${NUM}|(?:${NUM})?x)`
const EXPR = new RegExp(`^[+-]?${TERM}(?:[+-]${TERM})*$`)

/**
 * "3x + 2", "x − 4", "−2x", "7", even "1.5x + 25": one side as x and units,
 * whatever the numbers (faults() says which the tiles cannot show); null for
 * anything that is not a linear side in x.
 */
export function readExpr(raw: string): Expr | null {
  const t = tidy(raw)
  if (!EXPR.test(t)) return null
  let x = 0
  let units = 0
  for (const m of t.matchAll(new RegExp(`([+-]?)(${NUM})?(x)?`, 'g'))) {
    if (!m[0]) continue
    const sign = m[1] === '-' ? -1 : 1
    if (m[3]) x += sign * (m[2] === undefined ? 1 : Number(m[2]))
    else units += sign * Number(m[2])
  }
  return { x: x + 0, units: units + 0 }
}

/** A number, written as a number or a string ("−3", "25", "1.5"); null for anything else. */
function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'number' ? raw : typeof raw === 'string' && new RegExp(`^[+-]?${NUM}$`).test(tidy(raw)) ? Number(tidy(raw)) : NaN
  return Number.isFinite(v) ? v + 0 : null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

/** A side as `{ x, units }` (or a coefficient and a constant by other names), "3x + 2", or a plain number. */
function readSide(raw: unknown): Expr | null {
  if (typeof raw === 'string') return readExpr(raw)
  if (typeof raw === 'number') return Number.isFinite(raw) ? { x: 0, units: raw + 0 } : null
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const rx = first(o, ['x', 'xs', 'coefficient', 'a'])
  const ru = first(o, ['units', 'unit', 'ones', 'constant', 'number', 'b'])
  if (rx === undefined && ru === undefined) return null
  const x = rx === undefined ? 0 : readNumber(rx)
  const units = ru === undefined ? 0 : readNumber(ru)
  return x === null || units === null ? null : { x, units }
}

const fits = (e: Expr) => Number.isInteger(e.x) && Number.isInteger(e.units) && Math.abs(e.x) <= MAX_X && Math.abs(e.units) <= MAX_UNITS
const clamp = (v: number, most: number) => Math.max(-most, Math.min(most, Math.round(v))) + 0

/** "solve", "Solve equation", "solve_for_x", "find x"; and a task with no kind, since solving is all there is. */
function readKind(raw: unknown): 'solve' | null {
  if (raw === undefined) return 'solve'
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')
  return ['solve', 'solve-equation', 'solve-the-equation', 'solve-for-x', 'find-x'].includes(key) ? 'solve' : null
}

/**
 * An equation the tiles can show, near the one asked for, for the faults'
 * suggestions: whole numbers in range, x a whole number other than 0, not
 * already solved, and working that fits the pans.
 */
export function nearby(config: AlgebraTilesConfig): string | null {
  // Numbers the tiles cannot show are brought into range first.
  const left = { x: clamp(config.task.left.x, MAX_X), units: clamp(config.task.left.units, MAX_UNITS) }
  const right = { x: clamp(config.task.right.x, MAX_X), units: clamp(config.task.right.units, MAX_UNITS) }
  const ok = (l: Expr, r: Expr) => {
    const c: AlgebraTilesConfig = { task: { kind: 'solve', left: l, right: r } }
    const x = solution(c)
    return fits(l) && fits(r) && x !== null && x !== 0 && foundValue(startPans(c)) === null && workingFits(c)
  }
  if (ok(left, right) && (left.x !== config.task.left.x || left.units !== config.task.left.units || right.x !== config.task.right.x || right.units !== config.task.right.units)) {
    return `${exprText(left)} = ${exprText(right)}`
  }
  // The right side changed as little as it can be, its units before its x:
  // when x cancels and the units match, both must change.
  for (let dist = 1; dist <= 2 * (MAX_UNITS + MAX_X); dist++) {
    for (let dx = 0; dx <= Math.min(dist, 2 * MAX_X); dx++) {
      const du = dist - dx
      for (const sx of dx ? [1, -1] : [1]) {
        for (const su of du ? [1, -1] : [1]) {
          const r = { x: right.x + sx * dx, units: right.units + su * du }
          if (ok(left, r)) return `${exprText(left)} = ${exprText(r)}`
        }
      }
    }
  }
  return null
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

// ---------------------------------------------------------------------------

export const algebraTilesEngine: SceneEngine<AlgebraTilesConfig, AlgebraTilesState> = {
  id: 'algebra-tiles',
  covers: ['linear equations', 'solving equations', 'equations in one unknown', 'algebra tiles'],
  // Structure, as the balance pattern's equation mode has it: every legal move
  // keeps the pans level and x the same, so what the learner's moves vary is
  // the equation's form -- which tiles sit with which -- never its truth or
  // its amount. They are rearranging how the parts join until x stands alone.
  isolates: 'structure',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readKind(t.kind)
    if (!kind) return null
    let left = readSide(first(t, ['left', 'lhs']))
    let right = readSide(first(t, ['right', 'rhs']))
    if (!left && !right && typeof t.equation === 'string') {
      const halves = t.equation.split('=')
      if (halves.length !== 2) return null
      left = readExpr(halves[0])
      right = readExpr(halves[1])
    }
    // Numbers the tiles cannot show still parse: faults() says which, and what to write instead.
    if (!left || !right) return null
    return { task: { kind, left, right } }
  },

  faults(config) {
    const { left, right } = config.task
    const eq = configText(config)
    const k = left.x - right.x
    // Worked out only for a config that needs it: the property test asks every config.
    const eg = () => {
      const instead = nearby(config)
      return instead ? `, e.g. ${instead}` : ''
    }
    const numbers: [number, 'x' | 'unit', Side][] = [[left.x, 'x', 'left'], [left.units, 'unit', 'left'], [right.x, 'x', 'right'], [right.units, 'unit', 'right']]
    const part = numbers.find(([v]) => !Number.isInteger(v))
    if (part) {
      return [`The ${part[2]} side's ${signed(part[0])} ${part[1]} tiles is not a whole number, and tiles come whole: use whole numbers${eg()}.`]
    }
    const big = [
      ...numbers.filter(([v, kind]) => kind === 'unit' && Math.abs(v) > MAX_UNITS).map(([v]) => `${Math.abs(v)} unit tiles is more than a pan holds (${MAX_UNITS})`),
      ...numbers.filter(([v, kind]) => kind === 'x' && Math.abs(v) > MAX_X).map(([v]) => `${Math.abs(v)} x tiles is more than a pan starts with (${MAX_X})`),
    ]
    if (big.length) return [`${big[0]}: use smaller numbers${eg()}.`]
    if (k === 0) {
      return [left.x === 0
        ? `${eq} has no x in it, so there is nothing to solve for. Put x tiles on at least one side${eg()}.`
        : `In ${eq} x cancels out: both sides have ${xText(left.x)}, so taking them away leaves ${left.units === right.units ? 'two equal sides whatever x is' : 'two sides that can never balance'}. Give the two sides different numbers of x${eg()}.`]
    }
    const x = solution(config)
    if (x === null) {
      const v = right.units - left.units
      return [`${eq} comes to ${coeff(Math.abs(k))} = ${signed(Math.sign(k) * v)}, so x would be ${signed(Math.sign(k) * v)}/${Math.abs(k)}, and tiles cannot be cut into parts. Choose numbers that make x a whole number${eg()}.`]
    }
    if (x === 0) {
      return [`${eq} gives x = 0, which leaves one pan empty at the end, with no tiles to read x from. Choose numbers that make x a whole number other than 0${eg()}.`]
    }
    if (foundValue(startPans(config)) !== null) {
      const xs = left.x === 1 ? 'left' : 'right'
      const other = xs === 'left' ? right : left
      const more = Math.abs(other.units + 2) <= MAX_UNITS ? 2 : -2
      const ex = xs === 'left' ? `${exprText({ x: 1, units: more })} = ${exprText({ x: 0, units: other.units + more })}` : `${exprText({ x: 0, units: other.units + more })} = ${exprText({ x: 1, units: more })}`
      return [`${eq} is already solved: x is alone on one side, so there is nothing to do. Put more on the x side, e.g. ${ex}.`]
    }
    if (!workingFits(config)) {
      const v = Math.sign(k) * (right.units - left.units)
      return [`${eq} comes to ${coeff(Math.abs(k))} = ${signed(v)} before x is found: ${Math.abs(v)} unit tiles is more than a pan holds (${PAN_UNITS}). Use smaller numbers${eg()}.`]
    }
    return []
  },

  // The equation is the task, so the prompt writes it; it must not write what x is.
  promptFaults(config, prompt) {
    const x = solution(config)
    if (x === null) return []
    const abs = Math.abs(x)
    const word = abs < NUMBER_WORDS.length ? `|${NUMBER_WORDS[abs]}\\b` : ''
    const value = x < 0
      ? `(?:[-−–]\\s*${abs}|(?:minus|negative)\\s+(?:${abs}${word}))`
      : `(?:\\+?\\s*${abs}${word})`
    // Not a term inside the equation itself: "2x = 6", "6 + x = 3 + 2x" and
    // "x = 3x - 6" are no statement of what x is. So x stands on its own (no
    // digit or letter against it, no operator before it), and the value ends
    // there (no x, digit, fraction or bracket after it).
    const end = `(?![\\d]|\\.\\d|\\s*\\/|\\s*[+\\-−–]?\\s*\\d*\\s*x\\b|\\s*[×*(])`
    const says = new RegExp(`(?<!\\w)(?<![\\-−–+*×÷/]\\s*)x\\s*(?:=|is equal to|equals|is|should be|must be|comes to|will be)\\s*${value}${end}`, 'i')
    const answer = new RegExp(`\\b(?:answer|solution|value of x)\\s*(?:is|=|:|equals|will be|should be)\\s*${value}${end}`, 'i')
    const found = says.exec(prompt) ?? answer.exec(prompt)
    return found
      ? [`the prompt gives the answer away: it says what x is ("${found[0].trim()}"), which the learner finds on the balance -- write the equation and ask them to solve it ("Solve ${configText(config)} on the balance.")`]
      : []
  },

  initial() {
    return { moves: [] }
  },

  check(config, state) {
    const r = replay(config, state)
    const x = solution(config)
    return { ok: !r.refused && x !== null && foundValue(r.pans) === x, wrongIds: [] }
  },

  solve(config) {
    return { moves: solveMoves(config) }
  },

  View: AlgebraTilesView,

  prompt: `SCENE "algebra-tiles" -- an equation balance for solving linear equations. Two level pans hold x tiles and unit
  tiles (and negative -x and -1 tiles), with the equation written beneath them. The learner may only make legal
  moves, each done to both pans at once: add or take away the same tile, remove zero pairs (a 1 with a -1, an x with
  a -x), or share both pans into the same number of equal groups and keep one. Every move writes the new equation
  under the last; a move that would unbalance the pans is refused with the reason. Solved when one x tile is alone
  on one pan and only unit tiles are on the other.
  For: solving linear equations, the unknown on both sides, the balance method, zero pairs.
  config: { "task": { "kind":"solve", "left": { "x":3, "units":2 }, "right": { "x":1, "units":8 } } }  -- 3x + 2 = x + 8
    x: whole numbers from -5 to 5; units: whole numbers from -20 to 20, the two sides' units no more than 30 apart.
    The sides need different numbers of x, and x must come out a whole number other than 0. Write the equation in
    the prompt; never what x is.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Solve 3x + 2 = x + 8 on the balance.",
    "payload": { "engine":"algebra-tiles", "config": { "task": { "kind":"solve", "left": { "x":3, "units":2 }, "right": { "x":1, "units":8 } } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:algebra-tiles", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Solve 2x - 3 = 7 - 3x: keep the pans level.",
    "payload": { "engine":"algebra-tiles", "config": { "task": { "kind":"solve", "left": { "x":2, "units":-3 }, "right": { "x":-3, "units":7 } } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:algebra-tiles", "why":"..." } }`,
}

registerEngine(algebraTilesEngine as SceneEngine<unknown, unknown>)
