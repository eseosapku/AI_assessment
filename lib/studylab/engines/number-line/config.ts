// lib/studylab/engines/number-line/config.ts
//
// A printed classroom number line, with two things to do on it:
//   place -- a number is named (a whole number, a negative, a decimal or a fraction) and the learner puts a pin where it
//            belongs. The line is too coarse to say, so the pin picks a gap and Zoom magnifies that gap into a finer line
//            below it, ticks ten times closer (or one fraction-part apart), until the number has a tick of its own;
//   jump  -- a sum such as -3 + 5 or 2 - (-3) is named and the learner drags the hopper to where it lands. The hop is drawn
//            as an arc from the start, so adding, subtracting and a negative amount are all one picture: a length and a way.
//
// The rules, all exact and never read from the drawing:
//   every position is a whole number of the finest tick on the card ("fine units": hundredths, or twelfths...), so nothing
//   compares floats; the pin is right exactly when it sits on the number's own tick, with the line zoomed far enough to show
//   that tick; a hop is right exactly when it lands on start + amount (add) or start - amount (subtract).
//
// Research, ideas taken and never code or art:
//   - the zoom itself, "estimate, zoom, refine": Paul Goldenberg's (EDC) zooming number line as Daniel Scher describes it
//     (sineofthetimes.org, "Zooming Integers: Magnifying the Number Line"), which makes place value and decimals visible as
//     ever finer gaps; Desmos's number-line activities (drag a point to estimate, zoom, revise) carry the same loop;
//   - the misconceptions: a study of 35 Grade 8 learners (Sage Open 2016, ERIC EJ1198434) found 83% held a misconception in
//     adding and subtracting directed numbers, and tied it to the lack of a number line to reason on; a study of pre-service
//     teachers placing negative decimals (Hansen/Steinle-style work, ScienceDirect S0732312310000581) found negatives built as a
//     mirror of the positive "ray" or from translated positive intervals, so a negative card must make the left of zero count
//     the other way; and walking-the-line studies (Instructional Science 2025) found the body alone does not carry over to the
//     desk, so the card links a hop's length and its direction to the symbols (length from the number, way from the sign).
// Refused:
//   - typing the value, or reading a pin's number off a bubble: it would turn counting ticks into reading a label;
//   - rounding on this card: a pin that chooses between two ends is a two-way choice, and its own scene would do it better;
//   - several hops in one sum, multiplication as repeated hops, inequalities and a double number line (bar-model owns the
//     last): each is a different picture.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { NumberLineView } from './View'

export const MINUS = '−'

export type PlaceConfig = { task: 'place'; value: string }
export type JumpConfig = { task: 'jump'; start: number; op: 'add' | 'subtract'; amount: number }
export type NumberLineConfig = PlaceConfig | JumpConfig
/** place: the pin (fine units) and the left edge of each zoomed window; jump: where the hopper has landed. */
export type NumberLineState = { v?: number; lo?: number[]; at?: number }

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const sign = (n: number) => (n < 0 ? MINUS : '')

// ---------------------------------------------------------------------------
// The number to place, read exactly.

export type Target = {
  kind: 'int' | 'dec' | 'frac'
  /** Fine units in one whole: 1 for a whole number, 10^dp for a decimal, the denominator for a fraction. */
  D: number
  /** The number in fine units. */
  T: number
  /** Decimal places (decimals). */
  dp: number
  /** A fraction as written: whole part (0 when not mixed), numerator, denominator. */
  whole: number
  num: number
  den: number
}

const VULGAR: Record<string, [number, number]> = {
  '½': [1, 2], '¼': [1, 4], '¾': [3, 4], '⅓': [1, 3], '⅔': [2, 3], '⅕': [1, 5], '⅖': [2, 5], '⅗': [3, 5], '⅘': [4, 5],
  '⅙': [1, 6], '⅛': [1, 8], '⅜': [3, 8], '⅝': [5, 8], '⅞': [7, 8], '⅒': [1, 10],
}

export function readValue(raw: unknown): Target | null {
  let s: string
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    s = String(raw)
    if (/e/i.test(s)) return null
  } else if (typeof raw === 'string') s = raw
  else return null
  s = s.replace(/[−–—]/g, '-').replace(/[⁄∕]/g, '/').trim().replace(/^\+/, '')
  if (s.length === 0 || s.length > 14) return null
  const mk = (neg: boolean, whole: number, num: number, den: number): Target | null => {
    if (!Number.isFinite(whole + num + den) || den < 1) return null
    const mag = whole * den + num
    const T = mag === 0 ? 0 : neg ? -mag : mag
    return { kind: den === 1 ? 'int' : 'frac', D: den, T, dp: 0, whole, num, den }
  }
  const vulgar = s.match(/^(-)?\s*(\d+)?\s*([½¼¾⅓⅔⅕⅖⅗⅘⅙⅛⅜⅝⅞⅒])$/)
  if (vulgar) return mk(Boolean(vulgar[1]), vulgar[2] ? Number(vulgar[2]) : 0, VULGAR[vulgar[3]][0], VULGAR[vulgar[3]][1])
  const mixed = s.match(/^(-)?\s*(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) return mk(Boolean(mixed[1]), Number(mixed[2]), Number(mixed[3]), Number(mixed[4]))
  const frac = s.match(/^(-)?\s*(\d+)\s*\/\s*(\d+)$/)
  if (frac) return mk(Boolean(frac[1]), 0, Number(frac[2]), Number(frac[3]))
  const dec = s.match(/^(-)?(\d*)(?:\.(\d*))?$/)
  if (dec && (dec[2] || dec[3])) {
    const whole = dec[2] || '0'
    const part = (dec[3] ?? '').replace(/0+$/, '')
    const dp = part.length
    const mag = Number(whole) * 10 ** dp + Number(part || '0')
    if (!Number.isFinite(mag)) return null
    return { kind: dp === 0 ? 'int' : 'dec', D: 10 ** dp, T: mag === 0 ? 0 : dec[1] ? -mag : mag, dp, whole: 0, num: 0, den: 1 }
  }
  return null
}

/** The value as the config keeps it: plain ASCII, so it survives JSON. */
export function valueKey(t: Target): string {
  const neg = t.T < 0 ? '-' : ''
  const abs = Math.abs(t.T)
  if (t.kind === 'int') return `${neg}${abs / t.D}`
  if (t.kind === 'dec') return `${neg}${(abs / t.D).toFixed(t.dp)}`
  return `${neg}${t.whole > 0 ? `${t.whole} ` : ''}${t.num}/${t.den}`
}

export const magnitude = (t: Target) => Math.abs(t.T) / t.D

// ---------------------------------------------------------------------------
// The ladder of lines. Level 0 is the whole line; each level after it magnifies one gap between the ticks above.

export type Ladder = {
  /** Tick spacing at each level, in fine units. The last is always 1: the number's own tick. */
  steps: number[]
  /** Level 0 runs from A to B, in fine units. */
  A: number
  B: number
}

export function ladderOf(t: Target): Ladder {
  const mag = magnitude(t)
  let steps: number[]
  if (t.kind === 'frac') steps = [t.D, 1]
  else {
    const unit = t.kind === 'int' ? (mag < 20 ? 1 : mag < 200 ? 10 : 100) : 1
    steps = []
    for (let s = unit * t.D; ; s /= 10) {
      steps.push(s)
      if (s === 1) break
    }
  }
  const hi = [5, 10, 20].find((h) => mag < h * (steps[0] / t.D) || h === 20) ?? 20
  const B = hi * steps[0]
  return { steps, A: t.T < 0 ? -B : 0, B }
}

export const lastLevel = (l: Ladder) => l.steps.length - 1

export type Win = { lo: number; hi: number; step: number; level: number }

export function windowAt(l: Ladder, lo: number[]): Win {
  const level = Math.min(lo.length, lastLevel(l))
  if (level === 0) return { lo: l.A, hi: l.B, step: l.steps[0], level }
  const from = lo[level - 1]
  return { lo: from, hi: from + l.steps[level - 1], step: l.steps[level], level }
}

/** The magnification of a level, as the stepper and the line's tag say it. */
export const magOf = (l: Ladder, level: number) => l.steps[0] / l.steps[level]

/** A state read safely: a pin inside its window, zoom windows that nest, nothing outside the ladder. */
export function readPlace(config: PlaceConfig, state: NumberLineState): { v: number; lo: number[] } {
  const t = readValue(config.value) ?? readValue('3')!
  const l = ladderOf(t)
  const start = initialPlace(config)
  const raw = Array.isArray(state?.lo) ? state.lo : []
  const lo: number[] = []
  for (const x of raw) {
    if (lo.length >= lastLevel(l) || typeof x !== 'number' || !Number.isInteger(x)) break
    const w = windowAt(l, lo)
    if (x < w.lo || x + w.step > w.hi || (x - w.lo) % w.step !== 0) break
    lo.push(x)
  }
  const w = windowAt(l, lo)
  const v = typeof state?.v === 'number' && Number.isFinite(state.v) ? Math.max(w.lo, Math.min(w.hi, Math.round(state.v))) : start.v
  return { v, lo }
}

function initialPlace(config: PlaceConfig): { v: number; lo: number[] } {
  const t = readValue(config.value) ?? readValue('3')!
  const l = ladderOf(t)
  const mid = Math.round((l.A + l.B) / 2 / l.steps[0]) * l.steps[0]
  return { v: [mid, l.A, l.B].find((v) => v !== t.T) ?? l.A, lo: [] }
}

export function moveTo(config: PlaceConfig, state: NumberLineState, v: number): NumberLineState {
  const now = readPlace(config, state)
  const w = windowAt(ladderOf(readValue(config.value) ?? readValue('3')!), now.lo)
  return { v: Math.max(w.lo, Math.min(w.hi, Math.round(v))), lo: now.lo }
}

/** The gap under the pin: the one gap of this line, starting at the tick at or left of the pin. */
export function cellOf(w: Win, v: number): number {
  return Math.min(Math.floor(v / w.step + 1e-9) * w.step, w.hi - w.step)
}

export function zoomIn(config: PlaceConfig, state: NumberLineState): NumberLineState {
  const l = ladderOf(readValue(config.value) ?? readValue('3')!)
  const now = readPlace(config, state)
  const w = windowAt(l, now.lo)
  if (w.level >= lastLevel(l)) return { v: now.v, lo: now.lo }
  return { v: now.v, lo: [...now.lo, cellOf(w, now.v)] }
}

export function zoomOut(config: PlaceConfig, state: NumberLineState): NumberLineState {
  const now = readPlace(config, state)
  return { v: now.v, lo: now.lo.slice(0, -1) }
}

// ---------------------------------------------------------------------------
// Naming numbers on the line.

/** Decimals needed to write a tick `step` fine units apart. */
const decimalsFor = (t: Target, step: number) => Math.max(0, Math.round(Math.log10(t.D / step)))

export type Parts = { neg: boolean; w: number; n: number; d: number }

/** A fraction tick as a reduced mixed number: n/d is 0/1 on a whole. */
export function fracParts(t: Target, fine: number): Parts {
  const abs = Math.abs(fine)
  const w = Math.floor(abs / t.D)
  const r = abs % t.D
  const g = r === 0 ? 1 : gcd(r, t.D)
  return { neg: fine < 0, w, n: r / g, d: r === 0 ? 1 : t.D / g }
}

/** The number at a tick, as plain text with a true minus sign. */
export function fineText(t: Target, fine: number, step: number): string {
  if (t.kind === 'int') return `${sign(fine)}${Math.abs(fine)}`
  if (t.kind === 'dec') return `${sign(fine)}${(Math.abs(fine) / t.D).toFixed(decimalsFor(t, step))}`
  const p = fracParts(t, fine)
  const body = p.n === 0 ? `${p.w}` : p.w === 0 ? `${p.n}/${p.d}` : `${p.w} ${p.n}/${p.d}`
  return `${p.neg && (p.n > 0 || p.w > 0) ? MINUS : ''}${body}`
}

/** The target as written for the learner, in its own form. */
export function targetText(t: Target): string {
  const neg = t.T < 0 ? MINUS : ''
  if (t.kind === 'int') return `${neg}${Math.abs(t.T)}`
  if (t.kind === 'dec') return `${neg}${(Math.abs(t.T) / t.D).toFixed(t.dp)}`
  return `${neg}${t.whole > 0 ? `${t.whole} ` : ''}${t.num}/${t.den}`
}

/** How far apart a level's ticks are, in words that fit "ticks are ... apart". */
export function tickWords(t: Target, step: number): string {
  if (t.kind === 'frac') return step === t.D ? '1' : `1/${t.D}`
  if (t.kind === 'dec') return (step / t.D).toString()
  return String(step)
}

// ---------------------------------------------------------------------------
// Jumps.

export const landing = (c: JumpConfig) => c.start + (c.op === 'add' ? c.amount : -c.amount)

/** The line runs from -R to R, wide enough for the hop either way, so its width never says which way it goes. */
export function rangeOf(c: JumpConfig): number {
  const reach = Math.abs(c.start) + Math.abs(c.amount)
  return [6, 8, 10, 12, 15, 20].find((r) => r >= reach) ?? 20
}

export function readJump(config: JumpConfig, state: NumberLineState): number {
  const r = rangeOf(config)
  const at = typeof state?.at === 'number' && Number.isFinite(state.at) ? Math.round(state.at) : config.start
  return Math.max(-r, Math.min(r, at))
}

export function sumText(c: JumpConfig): string {
  const op = c.op === 'add' ? '+' : MINUS
  const a = `${sign(c.start)}${Math.abs(c.start)}`
  const b = c.amount < 0 ? `(${MINUS}${Math.abs(c.amount)})` : `${c.amount}`
  return `${a} ${op} ${b}`
}

export const signedText = (n: number) => `${sign(n)}${Math.abs(n)}`

/** The hop the learner has made, in words: its length and its way. */
export function hopText(from: number, to: number): string {
  const d = to - from
  if (d === 0) return 'no hop yet'
  return `${Math.abs(d)} ${d > 0 ? 'right' : 'left'}`
}

// ---------------------------------------------------------------------------
// Marking.

export function done(config: NumberLineConfig, state: NumberLineState): boolean {
  if (config.task === 'jump') return readJump(config, state) === landing(config)
  const t = readValue(config.value)
  if (!t) return false
  const l = ladderOf(t)
  const now = readPlace(config, state)
  return now.v === t.T && now.lo.length === lastLevel(l)
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What a correct card says: what the learner found, and why. */
export function working(config: NumberLineConfig, state: NumberLineState): string {
  if (config.task === 'jump') {
    const land = landing(config)
    const n = Math.abs(config.amount)
    const sum = `${sumText(config)} = ${signedText(land)}`
    if (config.op === 'add') {
      return config.amount > 0
        ? `Yes. ${sum}. Adding ${n} hops ${n} to the right, towards the bigger numbers.`
        : `Yes. ${sum}. Adding a negative hops the other way: ${n} to the left, as if you were taking ${n} away.`
    }
    return config.amount > 0
      ? `Yes. ${sum}. Subtracting ${n} hops ${n} to the left, towards the smaller numbers.`
      : `Yes. ${sum}. Subtracting a negative hops the other way from subtracting a positive: ${n} to the right.`
  }
  const t = readValue(config.value)!
  const l = ladderOf(t)
  const gaps: string[] = []
  let w: Win = { lo: l.A, hi: l.B, step: l.steps[0], level: 0 }
  for (let k = 0; k < lastLevel(l); k++) {
    const cell = cellOf(w, t.T)
    gaps.push(`between ${fineText(t, cell, w.step)} and ${fineText(t, cell + w.step, w.step)}`)
    w = { lo: cell, hi: cell + w.step, step: l.steps[k + 1], level: k + 1 }
  }
  const name = targetText(t)
  const left = t.T < 0 ? ' Left of zero the numbers get smaller, so the bigger the digits, the further left it sits.' : ''
  if (gaps.length === 0) return `Yes. ${name} is ${Math.abs(t.T)} ${Math.abs(t.T) === 1 ? 'tick' : 'ticks'} ${t.T < 0 ? 'left' : 'right'} of zero.${left}`
  const j = (t.T - w.lo) / w.step
  const last = j === 0 ? `on the tick at ${fineText(t, w.lo, w.step)}` : `${plural(j, 'tick')} of ${tickWords(t, w.step)} on from ${fineText(t, w.lo, w.step)}`
  return `Yes. ${name} sits ${gaps.join(', then ')}, and then ${last}.${left}`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: NumberLineConfig, state: NumberLineState): string {
  if (config.task === 'jump') {
    const at = readJump(config, state)
    const d = at - config.start
    const made = d === 0 ? `You stayed at ${signedText(at)}.` : `You hopped ${hopText(config.start, at)} and landed on ${signedText(at)}.`
    return `${made} Adding hops one way and subtracting the other, and a negative amount turns the hop round.`
  }
  const t = readValue(config.value)!
  const l = ladderOf(t)
  const now = readPlace(config, state)
  const w = windowAt(l, now.lo)
  if (w.level < lastLevel(l)) {
    return `The pin is on a line whose ticks are ${tickWords(t, w.step)} apart. This number needs ticks ${tickWords(t, 1)} apart: zoom in until they show.`
  }
  return `You put the pin on ${fineText(t, now.v, w.step)}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9+]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'place' | 'jump'> = {
  place: 'place', plot: 'place', locate: 'place', position: 'place', find: 'place', zoom: 'place', mark: 'place', pin: 'place', estimate: 'place',
  'place-it': 'place', 'place-on-the-line': 'place', 'zoom-in': 'place', 'zoom-and-place': 'place', 'place-a-number': 'place', 'number-line': 'place',
  jump: 'jump', jumps: 'jump', hop: 'jump', hops: 'jump', add: 'jump', subtract: 'jump', addition: 'jump', subtraction: 'jump', arithmetic: 'jump',
  sum: 'jump', calculate: 'jump', move: 'jump', walk: 'jump', 'jump-on-the-line': 'jump', 'add-and-subtract': 'jump', 'integer-arithmetic': 'jump',
}

function readOp(raw: unknown): 'add' | 'subtract' | null {
  if (raw === '+') return 'add'
  if (raw === '-' || raw === '−' || raw === '–') return 'subtract'
  const k = keyOf(raw)
  if (['add', 'adds', 'adding', 'addition', 'plus', '+', 'increase'].includes(k)) return 'add'
  if (['subtract', 'subtracts', 'subtracting', 'subtraction', 'minus', 'take-away', 'takeaway', 'take', 'decrease', 'less'].includes(k)) return 'subtract'
  return null
}

function readInt(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[−–]/g, '-').replace(/\s+/g, '')
  return /^[-+]?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null
}

/** "-3 + 5", "2 - (-3)", "−4 − 6": the whole sum in one string. */
function readSum(raw: unknown): { start: number; op: 'add' | 'subtract'; amount: number } | null {
  if (typeof raw !== 'string') return null
  const s = raw.replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/=.*$/, '')
  const m = s.match(/^\(?([-+]?\d+)\)?([+-])\(?([-+]?\d+)\)?$/)
  if (!m) return null
  return { start: Number(m[1]), op: m[2] === '+' ? 'add' : 'subtract', amount: Number(m[3]) }
}

const GESTURE = /\b(?:drag|move|slide|tap|press|pin|zoom|hop|jump|land|put|place|set|step|nudge)\b/i

/** What a prompt can safely say: the gesture and the aim. */
const goodPrompt = (config: NumberLineConfig): string => {
  if (config.task === 'jump') return `Drag the hopper to where ${sumText(config)} lands.`
  const t = readValue(config.value)
  const zoom = t && lastLevel(ladderOf(t)) > 0
  return `Drag the pin to ${t ? targetText(t) : 'the number'}${zoom ? ' and zoom in until its tick shows' : ''}.`
}

export const numberLineEngine: SceneEngine<NumberLineConfig, NumberLineState> = {
  id: 'number-line',
  // One distinctive word. "number" and "line" are common, so every other topic is a whole phrase: the catalogue matches a
  // covers word on its own, and "line" alone would catch straight-line graphs and lines of symmetry.
  covers: ['integers'],
  phrases: [
    'number line', 'number lines', 'the number line', 'numberline', 'negative numbers', 'negative integers', 'positive and negative numbers', 'directed numbers', 'signed numbers',
    'integers on a number line', 'ordering integers', 'ordering negative numbers', 'adding integers', 'subtracting integers', 'adding and subtracting integers', 'integer arithmetic',
    'adding and subtracting negative numbers', 'adding negative numbers', 'subtracting negative numbers', 'adding and subtracting directed numbers', 'working with negative numbers',
    'decimals', 'decimal numbers', 'ordering decimals', 'comparing decimals', 'decimals on a number line', 'tenths and hundredths', 'tenths', 'hundredths',
    'fractions on a number line', 'placing fractions on a number line', 'unit fractions on a number line', 'equivalent fractions on a number line', 'decimals and fractions on a number line',
    'number line fractions', 'whole numbers and integers',
  ],
  // Near misses: "decimals" for arithmetic or rounding, "integers" in code, "number line" for inequalities and ratio tables.
  notFor: [
    'double number line', 'double number lines', 'ratio table', 'inequalities', 'inequality', 'linear inequalities', 'solving inequalities', 'number line graphs', 'graphing inequalities',
    'multiplying decimals', 'dividing decimals', 'adding decimals', 'subtracting decimals', 'adding and subtracting decimals', 'multiplication of decimals', 'division of decimals', 'decimal multiplication',
    'recurring decimals', 'terminating decimals', 'repeating decimals', 'decimal places', 'decimal place', 'significant figures', 'standard form', 'rounding decimals', 'decimals to fractions',
    'fractions to decimals', 'converting fractions', 'decimals and percentages', 'fractions decimals and percentages', 'money', 'decimal system', 'decimal currency', 'decimal time', 'decimal expansion',
    'integer overflow', 'integer division', 'integer data', 'integers and floats', 'data types', 'data type', 'floating point', 'binary', 'programming', 'python', 'variables',
    'negative feedback', 'negative charge', 'negative correlation', 'negative indices', 'negative powers', 'negative gradient', 'negative gradients', 'negative scale factor', 'negative externalities', 'negative index',
    'complex numbers', 'imaginary numbers', 'irrational numbers', 'rational and irrational', 'real numbers', 'surds', 'prime numbers', 'factors and multiples', 'number sequences', 'number patterns',
    'time line', 'timeline', 'timelines', 'time lines', 'straight line', 'straight lines', 'line graphs', 'line graph', 'line of best fit', 'lines of symmetry', 'line symmetry', 'parallel lines', 'perpendicular lines',
  ],
  // What the learner varies is where on the line something sits.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const src = raw as Record<string, unknown>
    const word = keyOf(first(src, ['task', 'kind', 'type', 'mode']))
    const value = first(src, ['value', 'number', 'target', 'n', 'find', 'place'])
    const sum = readSum(first(src, ['expression', 'sum', 'calculation', 'calc', 'question', 'equation']))
    const startRaw = first(src, ['start', 'from', 'begin', 'startAt', 'a'])
    const opRaw = first(src, ['op', 'operation', 'operator', 'sign'])
    const amountRaw = first(src, ['amount', 'by', 'jump', 'hop', 'change', 'b'])
    const jumpish = sum !== null || opRaw !== undefined || startRaw !== undefined || amountRaw !== undefined
    const named = word ? (has(TASK_WORDS, word) ? TASK_WORDS[word] : null) : null
    if (word && !named && !(jumpish || value !== undefined)) return null
    const task = named ?? (jumpish && value === undefined ? 'jump' : value !== undefined ? 'place' : null)
    if (!task) return null
    if (task === 'place') {
      const t = readValue(value)
      return t ? { task, value: valueKey(t) } : null
    }
    if (sum) return { task, ...sum }
    const start = readInt(startRaw)
    const amount = readInt(amountRaw)
    const op = readOp(opRaw) ?? (word === 'subtract' || word === 'subtraction' ? 'subtract' : word === 'add' || word === 'addition' ? 'add' : null)
    if (start === null || amount === null || op === null) return null
    return { task, start, op, amount }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'jump') {
      if (!Number.isInteger(config.start)) out.push(`The hop starts on a whole number, not ${config.start}: use e.g. start -3.`)
      if (!Number.isInteger(config.amount)) out.push(`The hop is a whole number of steps, not ${config.amount}: use e.g. amount 5.`)
      else if (config.amount === 0) out.push('A hop of 0 does not move: use e.g. amount 5.')
      if (Number.isInteger(config.start) && Number.isInteger(config.amount) && Math.abs(config.start) + Math.abs(config.amount) > 20) {
        out.push(`${sumText(config)} reaches past 20 either side of zero, further than the line is drawn: keep start and amount within 20 of each other, e.g. start -3, amount 5.`)
      }
      return out
    }
    const t = readValue(config.value)
    if (!t) return [`"${config.value}" is not a number the line can place: use e.g. value "3.47", "-2.5" or "3/4".`]
    if (t.kind === 'dec' && t.dp > 2) out.push(`${targetText(t)} needs ${t.dp} decimal places; the line zooms to hundredths at most: use e.g. value "3.47".`)
    if (t.kind === 'frac' && (t.den > 10 || t.den < 2)) out.push(`The denominator ${t.den} would draw ${t.den} ticks in a gap, which the card can only do for 2 to 10: use e.g. value "3/4".`)
    if (t.kind !== 'int' && magnitude(t) >= 20) out.push(`${targetText(t)} is too far from zero to place with tenths, hundredths or fractions: use a number between -20 and 20, e.g. value "3.47".`)
    if (t.kind === 'int' && magnitude(t) >= 2000) out.push(`${targetText(t)} is too large for the line: use a whole number between -2000 and 2000, e.g. value "-35".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'jump') {
      const answer = /=\s*[-−]?\s*\d|\bequals?\b|\bthe answer\b|\blands?\s+(?:on|at|in)\s+[-−]?\d|\bwhich lands\b|\bgives\b/i.test(text)
      const way = /\b(?:left|right|backwards?|forwards?|towards? zero|away from zero|opposite|other way|flips?|reverses?|turns? round|bigger numbers|smaller numbers)\b/i.test(text)
      if (answer || way) out.push(`the prompt gives the answer away: it says where the hop lands or which way it goes, which the learner is to work out -- name the sum only ("${example}")`)
      if (/\b(?:type|enter|write|round|order|compare|several|all the sums|each sum|two hops|three hops|multiply|times|divide)\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it draws one sum and one hopper, dragged along the line -- ask for that ("${example}")`)
      }
    } else {
      const where = /\bbetween\b|\bhalf-?way\b|\bmid-?way\b|\bmiddle\b|\bjust\s+(?:past|before|after|over|under|below|above|beyond)\b|\b(?:nearer|closer)\b|\b\d+(?:st|nd|rd|th)\s+(?:tick|mark|line)\b|\btenths?\s+(?:and|past|after)\b|\bhundredths?\s+(?:and|past|after)\b|\bwhich (?:gap|tick|interval)\b|\bthe gap\b/i.test(text)
      if (where) out.push(`the prompt gives the answer away: it says which gap or tick the number is in, which the learner is to find by zooming -- name the number only ("${example}")`)
      if (/\b(?:type|enter|write|round(?:ed|ing)?|order|compare|both|all the numbers|each number|several|pins|two numbers|which is (?:bigger|larger|smaller)|bigger|larger|smaller|greater|less than)\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it places one number with one pin -- ask for that ("${example}")`)
      }
    }
    if (!GESTURE.test(text)) out.push(`the prompt does not say what to do: tell the learner the gesture ("${example}")`)
    return out
  },

  initial(config) {
    if (config.task === 'jump') return { at: config.start }
    return initialPlace(config)
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'jump') return { at: landing(config) }
    const t = readValue(config.value)!
    const l = ladderOf(t)
    let s: NumberLineState = { v: t.T, lo: [] }
    for (let k = 0; k < lastLevel(l); k++) s = zoomIn(config, s)
    return s
  },

  View: NumberLineView,

  prompt: `SCENE "number-line" -- a printed classroom number line on a quiet light panel, with ticks, numbers and arrowheads, and one thing to handle. Two tasks.
  place: a number is named at the top ("Find 3.47") and the learner drags a blue pin along the line to where it belongs. The line is too coarse to say exactly, so the pin picks a gap (shaded, with a funnel to a faint line below) and a Zoom control magnifies that gap into a finer line stacked underneath: ten ticks to the gap for whole numbers and decimals, or one fraction-part (halves, quarters, fifths...) for a fraction. Each line is tagged with its magnification (x1, x10, x100). The pin is right only on the number's own tick of the finest line, so the learner must zoom in far enough. Negatives sit on a line with zero in the middle. The card shows no number for the pin; the learner counts ticks from the labelled ends and middle.
  jump: a sum such as -3 + 5, 2 - (-3) or -4 - 6 is shown at the top with "= ?", on an integer line with zero in the middle. The learner drags the hopper (or steps it with the - and + buttons) and a hop is drawn from the start to it, labelled with its length and way ("5 right"). The learner works out which way and how far; marking says only afterwards.
  For: number lines, integers, negative numbers and directed numbers (ordering them, adding and subtracting them, a negative amount turning the hop round), placing decimals (tenths, hundredths) and fractions between whole numbers. It answers "negative numbers count the same way as positive ones", "you cannot take a bigger number from a smaller", "subtracting always moves left", and "0.47 is bigger than 0.5 because 47 is bigger than 5".
  config place: { "task":"place", "value":"3.47" } -- value is a whole number between -2000 and 2000 ("-35"), a decimal of at most 2 places between -20 and 20 ("3.47", "-2.5"), or a fraction with denominator 2 to 10 between -20 and 20 ("3/4", "1 3/4", "-7/5"). Use a decimal or fraction when the idea is zooming between whole numbers.
  config jump: { "task":"jump", "start":-3, "op":"add", "amount":5 } -- start and amount are whole numbers (amount may be negative, amount 0 is refused), op is "add" or "subtract", and |start| + |amount| is at most 20. Use a negative amount with "subtract" for the case students find hardest.
  Not drawn: rounding to a place, comparing or ordering several numbers at once, several hops, multiplying, inequalities, a double number line (use bar-model), place-value counters (use counters-place-value).
  Before marking the card holds back the number the pin is on, which gap contains the target, and where and which way a hop lands. The prompt must say the gesture and name the number or the sum only: do NOT say which gap or tick it is in ("between 3 and 4", "halfway"), nor where a hop lands, nor which way it goes ("to the right", "towards zero").
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pin to 3.47 and zoom in until its tick shows.",
    "payload": { "engine":"number-line", "config": { "task":"place", "value":"3.47" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:number-line", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pin to 3/4 and zoom in until its tick shows.",
    "payload": { "engine":"number-line", "config": { "task":"place", "value":"3/4" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:number-line", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pin to -35.",
    "payload": { "engine":"number-line", "config": { "task":"place", "value":"-35" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:number-line", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the hopper to where 2 − (−3) lands.",
    "payload": { "engine":"number-line", "config": { "task":"jump", "start":2, "op":"subtract", "amount":-3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:number-line", "why":"..." } }`,
}

registerEngine(numberLineEngine as SceneEngine<unknown, unknown>)
