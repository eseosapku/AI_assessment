// lib/studylab/engines/trig-circle/config.ts
//
// Right triangles and the unit circle, handled with one move: dragging an angle.
//   ladder -- a ladder of fixed length leans on a wall. The learner slides its foot along the ground until the top
//             reaches a marked window sill (SOH: the height is the opposite side) or the foot reaches a painted line on the paving
//             (CAH: the distance out is the adjacent side). The card shows the other leg live and the angle's arc, and
//             keeps the angle's number back until it is marked;
//   circle -- a point on the unit circle, with its height (sine) and its distance across (cosine) drawn as the two
//             legs of the triangle it makes, and the sine or cosine curve drawn from the point as it goes round. The
//             learner turns the point to where the sine (or cosine) takes a given exact value, and the card marks the
//             exact value, so a value that happens at two angles accepts both.
//
// The rules, all computed here and never read from the drawing:
//   ladder: the foot is a whole number of tenths of a metre from the wall, and is right when it is the step nearest the
//           true distance: sqrt(L^2 - h^2) for a height h, or the distance itself for a distance out;
//   circle: the exact sine and cosine of every multiple of 30 and 45 degrees: 0, 1/2, sqrt2/2, sqrt3/2, 1, and their
//           negatives. Any other angle the point can sit at (the odd multiples of 15) matches none of them.
//
// Facts:
//   - the exact values are the standard ones, from the 30-60-90 and 45-45-90 triangles;
//   - a ladder is safe near 75 degrees (the 4:1 rule) but nothing here depends on that: the angle only has to be steep
//     enough to be a ladder and flat enough to lean, 20 to 80 degrees, so that a step of the foot is a step you can see.
//
// Ideas taken, never code or art:
//   - the sine curve unrolled from the point's height as it goes round the circle, which is how the unit-circle
//     explorers online teach it (the angle along the bottom, the height up the side);
//   - "the ratio depends on the angle, not the size of the triangle", the misconception every trigonometry primer names
//     (mathsisfun.com: "Opposite is always opposite the angle"; the ratio is the same at any size), hence a fixed
//     ladder length and a drag on the angle alone;
//   - the ladder as the right triangle a student has met outside a classroom (the 4:1 ladder rule: foot a quarter of the
//     length out, arccos 1/4 = 75.5 degrees).
// Refused:
//   - tangent on the circle: its length on a tangent line is a second drawing and a different idea;
//   - radians: the card measures in degrees, so a prompt that asks for radians is refused by promptFaults;
//   - non-right triangles (sine and cosine rules), identities and calculus: not drawn.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TrigCircleView } from './View'

export const LADDER_MIN = 3
export const LADDER_MAX = 10
/** The foot moves in tenths of a metre. */
export const TENTH = 0.1
export const BIG_STEP = 5
/** The ladder never leans flatter than this, or steeper, for a target. */
export const TILT_MIN = 20
export const TILT_MAX = 80
export const ANGLE_STEP = 15

export type TrigConfig =
  /** ask: "height" (how far up the wall the top reaches) or "out" (how far the foot stands from the wall). value is in metres. */
  | { task: 'ladder'; length: number; ask: string; value: number }
  /** fn: "sine" or "cosine"; value: its exact value as text, "1/2", "√3/2", "-√2/2"; other: the sign of the other function, "positive" or "negative". */
  | { task: 'circle'; fn: string; value: string; other?: string }

/** What the learner has done: where the foot is (tenths of a metre from the wall) or the point's angle (degrees). */
export type TrigState = { foot?: number; angle?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const toDeg = (r: number) => (r * 180) / Math.PI

// ---------------------------------------------------------------------------
// The ladder.

export const ASKS = ['height', 'out'] as const

const round1 = (n: number) => Math.round(n * 10) / 10
/** 4, 4.5, 3.25: no trailing zeros. */
export const fmtM = (n: number) => String(Number(n.toFixed(2)))

export function footMax(length: number): number {
  return Math.max(1, Math.round(length * 10) - 1)
}

/** The learner's foot, read safely and kept on the ground the ladder can reach. */
export function footOf(config: TrigConfig, state: TrigState | null | undefined): number {
  const length = config.task === 'ladder' ? config.length : 5
  const raw = state?.foot
  const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : Math.round(footMax(length) * 0.85)
  return Math.max(1, Math.min(footMax(length), v))
}

/** How high the top is, for a foot `d10` tenths from the wall. */
export const topAt = (length: number, d10: number) => Math.sqrt(Math.max(0, length * length - (d10 / 10) * (d10 / 10)))
export const angleAt = (length: number, d10: number) => toDeg(Math.acos(Math.min(1, d10 / 10 / length)))

/** The true foot position, in (fractional) tenths, that the task is asking for. */
export function targetFoot(config: Extract<TrigConfig, { task: 'ladder' }>): number {
  const L = config.length
  return config.ask === 'out' ? config.value * 10 : Math.sqrt(Math.max(0, L * L - config.value * config.value)) * 10
}

export const ladderOk = (config: Extract<TrigConfig, { task: 'ladder' }>, d10: number) => Math.abs(d10 - targetFoot(config)) <= 0.5 + 1e-9

/** The angle the task is after, in degrees. */
export function targetAngle(config: Extract<TrigConfig, { task: 'ladder' }>): number {
  const r = config.value / config.length
  return config.ask === 'out' ? toDeg(Math.acos(Math.min(1, r))) : toDeg(Math.asin(Math.min(1, r)))
}

/** The values a ladder of this length can be asked for, at each end of the 20 to 80 degree range. */
export function valueRange(length: number, ask: string): { lo: number; hi: number } {
  const s = (d: number) => Math.sin((d * Math.PI) / 180)
  const c = (d: number) => Math.cos((d * Math.PI) / 180)
  return ask === 'out' ? { lo: length * c(TILT_MAX), hi: length * c(TILT_MIN) } : { lo: length * s(TILT_MIN), hi: length * s(TILT_MAX) }
}

/** The value nearest to `value` that the card can ask for, in whole tenths inside the range. */
function nearbyValue(length: number, ask: string, value: number): number {
  const { lo, hi } = valueRange(length, ask)
  const low = Math.ceil(lo * 10 - 1e-9) / 10
  const high = Math.floor(hi * 10 + 1e-9) / 10
  const v = Math.max(low, Math.min(high, Number.isFinite(value) ? value : (low + high) / 2))
  return round1(v)
}

/** A start well away from the target, on whichever side has more ground. */
function ladderStart(config: Extract<TrigConfig, { task: 'ladder' }>): number {
  const t = targetFoot(config)
  const far = Math.round(footMax(config.length) * 0.9)
  const near = Math.max(1, Math.round(footMax(config.length) * 0.3))
  return Math.abs(far - t) >= Math.abs(near - t) ? far : near
}

// ---------------------------------------------------------------------------
// The circle. Exact values, in the usual form: key is "0", "1/2", "√2/2", "√3/2", "1", with a leading "-" when negative.

export const FNS = ['sine', 'cosine'] as const
const BASE: Record<string, number> = { '0': 0, '1/2': 0.5, '√2/2': Math.SQRT1_2, '√3/2': Math.sqrt(3) / 2, '1': 1 }
const BY_REFERENCE: Record<number, string> = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' }
export const VALUES = ['0', '1/2', '√2/2', '√3/2', '1']

/** The angles whose sine and cosine are exact: the multiples of 30 and of 45 degrees. */
export const EXACT_ANGLES = Array.from({ length: 24 }, (_, i) => i * 15).filter((a) => a % 30 === 0 || a % 45 === 0)

export const isExactAngle = (a: number) => a % 30 === 0 || a % 45 === 0

export function exactKey(fn: 'sine' | 'cosine', angle: number): string | null {
  const a = ((Math.round(angle) % 360) + 360) % 360
  if (!isExactAngle(a)) return null
  const r = a % 180
  const ref = r > 90 ? 180 - r : r
  if (fn === 'sine') {
    const base = BY_REFERENCE[ref]
    return a > 180 ? negate(base) : base
  }
  const base = BY_REFERENCE[90 - ref]
  return a > 90 && a < 270 ? negate(base) : base
}

const negate = (key: string) => (key === '0' ? '0' : `-${key}`)
export const numberOfKey = (key: string) => (key.startsWith('-') ? -1 : 1) * BASE[key.replace(/^-/, '')]
export const signOfKey = (key: string): 'positive' | 'negative' | 'zero' => (key === '0' ? 'zero' : key.startsWith('-') ? 'negative' : 'positive')

/** "½", "−√3/2": the way a learner writes it. */
export function showKey(key: string): string {
  const neg = key.startsWith('-')
  const base = key.replace(/^-/, '')
  const text = base === '1/2' ? '½' : base
  return neg ? `−${text}` : text
}

/** A decimal with a real minus sign, for the live readout. */
export function showNumber(n: number): string {
  const t = n.toFixed(2)
  const clean = t === '-0.00' ? '0.00' : t
  return clean.replace('-', '−')
}

const normalise = (raw: string) => raw.trim().toLowerCase().replace(/[−–—]/g, '-').replace(/\s+/g, '')

/** The exact value a tutor's text means, as a key, or null when it is none of the values the circle gives. */
export function readValue(raw: unknown): string | null {
  if (typeof raw === 'number') return readValue(String(raw))
  if (typeof raw !== 'string') return null
  let s = normalise(raw).replace(/½/g, '1/2')
  if (s === '') return null
  s = s.replace(/^(?:minus|negative)-?/, '-').replace(/^(?:plus|positive)-?/, '')
  if (/^(?:a-?|one-?)?half$/.test(s.replace(/^-/, ''))) s = (s.startsWith('-') ? '-' : '') + '1/2'
  s = s.replace(/sqrt\(?(\d+)\)?/g, '√$1').replace(/root/g, '√').replace(/[()]/g, '')
  const m = /^([+-]?)(√?\d+(?:\.\d+)?)(?:\/(√?\d+(?:\.\d+)?))?$/.exec(s)
  if (!m) return null
  const num = (x: string) => (x.startsWith('√') ? Math.sqrt(parseFloat(x.slice(1))) : parseFloat(x))
  const top = num(m[2])
  const bottom = m[3] ? num(m[3]) : 1
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null
  const v = (top / bottom) * (m[1] === '-' ? -1 : 1)
  const mag = Math.abs(v)
  const key = Object.keys(BASE).find((k) => Math.abs(BASE[k] - mag) <= 0.01)
  if (!key) return null
  return v < 0 ? negate(key) : key
}

const SIGNS: Record<string, 'positive' | 'negative'> = {
  positive: 'positive', pos: 'positive', plus: 'positive', '+': 'positive', above: 'positive',
  negative: 'negative', neg: 'negative', minus: 'negative', '-': 'negative', below: 'negative',
}

export const otherOf = (fn: 'sine' | 'cosine') => (fn === 'sine' ? 'cosine' : 'sine')

/** The angles that make the task true, in order. */
export function solutions(config: Extract<TrigConfig, { task: 'circle' }>): number[] {
  const fn = config.fn as 'sine' | 'cosine'
  const key = readValue(config.value)
  if (!key || (fn !== 'sine' && fn !== 'cosine')) return []
  const want = config.other === undefined ? null : has(SIGNS, config.other) ? SIGNS[config.other] : undefined
  if (want === undefined) return []
  return EXACT_ANGLES.filter((a) => exactKey(fn, a) === key && (want === null || signOfKey(exactKey(otherOf(fn), a)!) === want))
}

export const angleOf = (state: TrigState | null | undefined): number => {
  const raw = state?.angle
  const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw / ANGLE_STEP) * ANGLE_STEP : 0
  return ((v % 360) + 360) % 360
}

// ---------------------------------------------------------------------------
// Marking: from the rules, always.

export function done(config: TrigConfig, state: TrigState): boolean {
  if (config.task === 'ladder') return ladderOk(config, footOf(config, state))
  return solutions(config).includes(angleOf(state))
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card gives no verdict.

const fmtDeg = (n: number) => String(Number(n.toFixed(1)))

export function working(config: TrigConfig, state: TrigState): string {
  if (config.task === 'ladder') {
    const L = config.length
    const v = config.value
    const deg = fmtDeg(targetAngle(config))
    if (config.ask === 'out') {
      const r = fmtM(v / L)
      const up = fmtM(round1(Math.sqrt(Math.max(0, L * L - v * v))))
      return `Yes. The ladder leans at ${deg}° to the ground. Cosine is adjacent ÷ hypotenuse: ${fmtM(v)} ÷ ${fmtM(L)} = ${r}, so the angle is the one whose cosine is ${r}. The top is ${up} m up the wall.`
    }
    const r = fmtM(v / L)
    const out = fmtM(round1(Math.sqrt(Math.max(0, L * L - v * v))))
    return `Yes. The ladder leans at ${deg}° to the ground. Sine is opposite ÷ hypotenuse: ${fmtM(v)} ÷ ${fmtM(L)} = ${r}, so the angle is the one whose sine is ${r}. The foot is ${out} m from the wall.`
  }
  const fn = config.fn as 'sine' | 'cosine'
  const key = readValue(config.value) ?? '0'
  const all = solutions(config)
  const at = angleOf(state)
  const here = all.includes(at) ? at : all[0]
  const s = showKey(exactKey('sine', here) ?? '0')
  const c = showKey(exactKey('cosine', here) ?? '0')
  const others = all.filter((a) => a !== here)
  const also = others.length
    ? ` ${fn === 'sine' ? 'Sine' : 'Cosine'} is ${showKey(key)} again at ${others.map((a) => `${a}°`).join(' and ')}: ${fn === 'sine' ? 'the point is at the same height' : 'the point is the same distance across'} on the other side.`
    : ''
  return `Yes. At ${here}° sine is ${s} and cosine is ${c}.${also} Sine is the height of the point, and cosine is how far across it is.`
}

export function madeText(config: TrigConfig, state: TrigState): string {
  if (config.task === 'ladder') {
    const d10 = footOf(config, state)
    return `The top is ${fmtM(round1(topAt(config.length, d10)))} m up the wall, with the foot ${fmtM(d10 / 10)} m from it.`
  }
  const at = angleOf(state)
  const rad = (at * Math.PI) / 180
  const s = exactKey('sine', at)
  const c = exactKey('cosine', at)
  return `You made ${at}°: sine is ${s ? showKey(s) : showNumber(Math.sin(rad))} and cosine is ${c ? showKey(c) : showNumber(Math.cos(rad))}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9+]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'ladder' | 'circle'> = {
  ladder: 'ladder', ladders: 'ladder', triangle: 'ladder', 'right-triangle': 'ladder', 'right-angled-triangle': 'ladder', ramp: 'ladder', 'soh-cah-toa': 'ladder', sohcahtoa: 'ladder', ratios: 'ladder', 'trig-ratios': 'ladder',
  'trigonometric-ratios': 'ladder', 'ladder-against-wall': 'ladder', 'ladder-and-wall': 'ladder', elevation: 'ladder', 'angle-of-elevation': 'ladder',
  circle: 'circle', 'unit-circle': 'circle', graph: 'circle', graphs: 'circle', wave: 'circle', 'sine-wave': 'circle', 'trig-graphs': 'circle', 'trigonometric-graphs': 'circle', equation: 'circle', equations: 'circle', 'trig-equations': 'circle', 'exact-values': 'circle',
}
const ASK_WORDS: Record<string, string> = {
  height: 'height', reach: 'height', up: 'height', top: 'height', wall: 'height', opposite: 'height', sine: 'height', sin: 'height', soh: 'height', 'how-high': 'height', rise: 'height',
  out: 'out', foot: 'out', base: 'out', distance: 'out', along: 'out', ground: 'out', adjacent: 'out', cosine: 'out', cos: 'out', cah: 'out', 'how-far': 'out', run: 'out', 'from-the-wall': 'out',
}
const FN_WORDS: Record<string, string> = { sine: 'sine', sin: 'sine', cosine: 'cosine', cos: 'cosine', tangent: 'tangent', tan: 'tangent' }

function readMetres(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:m|metres?|meters?)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

const goodLadderPrompt = (c: Extract<TrigConfig, { task: 'ladder' }>) =>
  c.ask === 'out'
    ? 'Drag the foot of the ladder along the ground until it stands on the painted line.'
    : 'Drag the foot of the ladder along the ground until its top just reaches the window sill.'
const goodCirclePrompt = (c: Extract<TrigConfig, { task: 'circle' }>) =>
  `Drag the point round the circle to where ${c.fn === 'cosine' ? 'cosine' : 'sine'} is ${showKey(readValue(c.value) ?? '1/2')}${c.other ? ` and ${otherOf(c.fn === 'cosine' ? 'cosine' : 'sine')} is ${c.other}` : ''}.`

export const trigCircleEngine: SceneEngine<TrigConfig, TrigState> = {
  id: 'trig-circle',
  // Few and distinctive. "sine", "cosine", "circle" and "angle" all appear elsewhere (waves, circle theorems, bearings), so
  // everything else is a whole phrase, and the near misses are ruled out below.
  covers: ['trigonometry', 'trigonometric', 'sohcahtoa'],
  phrases: [
    'trig', 'trig ratios', 'trig functions', 'trig graphs', 'trig equations', 'soh cah toa', 'right-angled triangles', 'right angled triangles', 'right triangles', 'right triangle', 'right-angled triangle', 'right triangle trigonometry',
    'sine and cosine', 'sine cosine and tangent', 'sine, cosine and tangent', 'sine graph', 'sine graphs', 'cosine graph', 'cosine graphs', 'sine curve', 'cosine curve', 'graphs of sine and cosine', 'sine and cosine graphs',
    'unit circle', 'the unit circle', 'unit circle and radians', 'trigonometric ratios', 'trigonometric functions', 'trigonometric graphs', 'trigonometric equations', 'inverse trigonometric functions', 'solving trigonometric equations',
    'angles of elevation', 'angle of elevation', 'angles of elevation and depression', 'angle of depression', 'exact trigonometric values', 'special angles', 'ladder against a wall',
    'pythagoras theorem', 'pythagorean theorem', 'theorem of pythagoras', 'pythagoras and trigonometry', 'pythagorean triples', 'pythagorean triple',
    'degrees and radians', 'convert between degrees and radians', 'radian measure',
  ],
  // Near misses: right triangles drawn only as right triangles, and trigonometry the card cannot show.
  notFor: [
    'sine rule', 'cosine rule', 'sine and cosine rule', 'sine and cosine rules', 'the sine rule', 'the cosine rule', 'sine rule and cosine rule', 'area of a triangle using sine', 'non-right triangles', 'non right triangles', 'trigonometry of non right angled triangles', 'solving non right angled triangles',
    'trigonometric identities', 'trigonometric identity', 'trig identities', 'double angle', 'double angle formulae', 'compound angle', 'compound angles', 'addition formulae', 'addition formulas', 'factor formulae',
    'trigonometric integrals', 'trigonometric integration', 'integration of trigonometric functions', 'differentiation of trigonometric functions', 'derivatives of trigonometric functions', 'trigonometric substitution', 'differentiating trigonometric functions', 'integrating trigonometric functions',
    'hyperbolic functions', 'hyperbolic trigonometric', 'complex numbers', 'polar form', 'de moivre', 'fourier series', 'trigonometric series', 'small angle approximations', 'harmonic motion', 'simple harmonic motion', 'sinusoidal waves',
    'three dimensional trigonometry', 'trigonometry in three dimensions', 'bearings', 'spherical trigonometry', 'sound waves', 'light waves', 'sine wave', 'sine waves', 'alternating current',
    'circle theorems', 'circle theorem', 'angles in a circle', 'circle geometry', 'circles and angles', 'area of a circle', 'circumference of a circle', 'equation of a circle', 'equations of circles', 'arc length', 'sector area', 'chords',
    'right angled triangle construction', 'constructing triangles', 'congruent triangles', 'similar triangles', 'triangle inequality', 'triangle sum',
  ],
  // The learner changes an angle and watches the sides: magnitude is what varies.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const rawFn = first(src, ['fn', 'function', 'ratio', 'trig'])
    const rawLength = first(src, ['length', 'ladder', 'ladderLength', 'hypotenuse', 'long', 'size'])
    if (word && !has(TASK_WORDS, word)) return null
    const task = word ? TASK_WORDS[word] : rawFn !== undefined ? 'circle' : rawLength !== undefined || first(src, ['ask', 'reach', 'height', 'out']) !== undefined ? 'ladder' : null
    if (!task) return null
    if (task === 'circle') {
      if (rawFn === undefined && first(src, ['value', 'equals']) === undefined) return null
      const fn = rawFn === undefined ? 'sine' : typeof rawFn === 'string' ? (FN_WORDS[keyOf(rawFn)] ?? keyOf(rawFn)) : null
      if (fn === null) return null
      const value = first(src, ['value', 'equals', 'target', 'is'])
      if (typeof value !== 'string' && typeof value !== 'number') return null
      const rawOther = first(src, ['other', 'sign', 'otherSign', 'where'])
      const cfg: TrigConfig = { task: 'circle', fn, value: String(value).trim() }
      if (rawOther !== undefined) {
        if (typeof rawOther !== 'string') return null
        const t = rawOther.trim()
        const k = t === '-' || t === '−' ? 'negative' : t === '+' ? 'positive' : keyOf(rawOther)
        cfg.other = has(SIGNS, k) ? SIGNS[k] : k
      }
      return cfg
    }
    const length = rawLength === undefined ? 5 : readMetres(rawLength)
    if (length === null) return null
    const rawAsk = first(src, ['ask', 'find', 'target', 'measure'])
    const askKey = typeof rawAsk === 'string' ? keyOf(rawAsk) : ''
    const byKey = first(src, ['reach', 'height']) !== undefined ? 'height' : first(src, ['out', 'distance']) !== undefined ? 'out' : 'height'
    const ask = askKey ? (has(ASK_WORDS, askKey) ? ASK_WORDS[askKey] : askKey) : byKey
    if (rawAsk !== undefined && typeof rawAsk !== 'string') return null
    const rawValue = first(src, ['value', 'reach', 'height', 'out', 'distance', 'at'])
    const value = readMetres(rawValue)
    if (value === null) return null
    return { task: 'ladder', length, ask, value }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'ladder') {
      const { length, ask, value } = config
      if (!has(Object.fromEntries(ASKS.map((a) => [a, 1])), ask)) {
        out.push(`ask "${ask}" is not one of ${ASKS.join(', ')}: use ask "height" to reach a window sill (sine) or ask "out" to stand the foot on a painted line (cosine), e.g. { "task":"ladder", "length":5, "ask":"height", "value":4 }.`)
        return out
      }
      if (length < LADDER_MIN || length > LADDER_MAX) {
        out.push(`a ladder ${fmtM(length)} m long is outside what the card draws (${LADDER_MIN} to ${LADDER_MAX} m): use e.g. length 5, value ${ask === 'out' ? 3 : 4}.`)
        return out
      }
      const { lo, hi } = valueRange(length, ask)
      if (!(value >= lo - 1e-9 && value <= hi + 1e-9)) {
        const word = ask === 'out' ? 'the foot out' : 'the top up'
        out.push(`${word} ${fmtM(value)} m is not possible for a ${fmtM(length)} m ladder at an angle of ${TILT_MIN} to ${TILT_MAX} degrees, which the card keeps so each step of the foot shows (${fmtM(round1(lo + 0.049))} to ${fmtM(round1(hi - 0.049))} m): use e.g. value ${fmtM(nearbyValue(length, ask, value))}.`)
      }
      return out
    }
    const fn = config.fn
    if (fn !== 'sine' && fn !== 'cosine') {
      out.push(`${fn === 'tangent' ? 'tangent is not drawn on the circle, which shows sine and cosine' : `"${fn}" is not a function the circle draws`}: use fn "sine" or "cosine", e.g. { "task":"circle", "fn":"sine", "value":"1/2" }.`)
      return out
    }
    const key = readValue(config.value)
    if (!key) {
      out.push(`"${config.value}" is not a value the circle gives exactly at its marked angles (0, 1/2, √2/2, √3/2, 1, and their negatives): use e.g. value "√3/2".`)
      return out
    }
    if (config.other !== undefined && !has(SIGNS, config.other)) {
      out.push(`other "${config.other}" is not a sign: use "positive" or "negative", e.g. other "negative".`)
      return out
    }
    if (solutions(config).length === 0) {
      const o = otherOf(fn)
      const hits = EXACT_ANGLES.filter((a) => exactKey(fn, a) === key)
      const signs = [...new Set(hits.map((a) => signOfKey(exactKey(o, a)!)))]
      const usable = signs.filter((x) => x !== 'zero')
      out.push(`where ${fn} is ${showKey(key)}, ${o} is ${signs.map((x) => (x === 'zero' ? '0' : x)).join(' or ')}, never ${config.other}: ${usable.length ? `use other "${usable[0]}"` : 'leave other out'}, e.g. { "task":"circle", "fn":"${fn}", "value":"${key}"${usable.length ? `, "other":"${usable[0]}"` : ''} }.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const example = config.task === 'ladder' ? goodLadderPrompt(config) : goodCirclePrompt(config)
    const gesture = /\b(?:drag|slide|slid|turn|move|swing|rotate|lean|push|pull|set|place|put|position|tilt|spin)\w*/i.test(text)
    if (!gesture) out.push(`the prompt does not say what to do with the card: say the gesture, e.g. "${example}"`)
    if (/\bradians?\b|π|\bpi\b/i.test(text)) out.push(`the prompt promises radians, which the card does not show: it measures angles in degrees -- ask for the outcome only ("${example}")`)
    if (/\btan(?:gent)?\b|\bcalculator\b|\binverse\b|\bsin\s*[-⁻]?\s*1\b|\barcsin\b|\barccos\b|\bsine rule\b|\bcosine rule\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show (tangent, a calculator, inverse functions): it draws only ${config.task === 'ladder' ? 'the ladder' : 'the unit circle and its sine or cosine curve'} -- ask for the outcome only ("${example}")`)
    }
    if (config.task === 'ladder') {
      // The angle is what the card keeps back until it is marked.
      if (/\d\s*°|\d\s*degrees?\b|\bdegrees?\b/i.test(text)) {
        out.push(`the prompt names an angle, which the card keeps hidden until it is marked (the learner finds it by reaching the mark): ask for the reach, not the angle ("${example}")`)
      }
      const L = config.length
      const other = round1(Math.sqrt(Math.max(0, L * L - config.value * config.value)))
      const said = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:m\b|metres?\b|meters?\b)/gi)].map((m) => Number(m[1]))
      const allowed = [config.value, L, other]
      const stray = said.find((n) => !allowed.some((a) => Math.abs(a - n) < 0.051))
      if (stray !== undefined) out.push(`the prompt says ${fmtM(stray)} m, but the card's ladder is ${fmtM(L)} m long and its mark is ${fmtM(config.value)} m ${config.ask === 'out' ? 'from the wall' : 'up the wall'}: use the card's numbers, or none ("${example}")`)
      const wrongMark = config.ask === 'out' ? /\bsill\b|\bwindow\b/i.test(text) : /\bflag\b|\bpainted\b|\bpaving\b|\bline\b/i.test(text)
      if (wrongMark) out.push(`the prompt names ${config.ask === 'out' ? 'a window sill' : 'a painted line'}, but this card marks ${config.ask === 'out' ? 'a painted line on the paving' : 'a window sill on the wall'}: ask for what it draws ("${example}")`)
    } else {
      const found = solutions(config)
      const gives = found.find((a) => new RegExp(`(?:^|[^\\d.])${a}\\s*(?:°|degrees?\\b)`, 'i').test(text))
      if (gives !== undefined) out.push(`the prompt gives the answer away: it names ${gives}°, which the learner is to find by turning the point -- ask for the value only ("${example}")`)
      if (/\bquadrant\b|\bhow many (?:solutions|answers|angles)\b|\btwo (?:solutions|answers|angles|places)\b|\bboth\b/i.test(text)) {
        out.push(`the prompt gives away how many places or which quadrant, which the card shows when it is marked -- ask for the value only ("${example}")`)
      }
    }
    return out
  },

  initial(config) {
    if (config.task === 'ladder') return { foot: ladderStart(config) }
    const all = solutions(config)
    const start = [0, 90, 180, 270].find((a) => !all.includes(a)) ?? 45
    return { angle: start }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'ladder') {
      const t = Math.max(1, Math.min(footMax(config.length), Math.round(targetFoot(config))))
      return { foot: t }
    }
    return { angle: solutions(config)[0] ?? 0 }
  },

  View: TrigCircleView,

  prompt: `SCENE "trig-circle" -- right triangles and the unit circle, drawn on a quiet light panel, handled by dragging an angle. Two kinds.
  ladder: a real ladder (two rails, rungs, rubber feet) leans on a house wall, always the same length. The learner drags its foot along the ground, with a ring grip on the foot, and the top slides up or down the wall. An arc at the foot marks the angle the ladder makes with the ground, with no number on it. Either a window with its sill is set into the wall at a height (ask "height": the learner slides the foot until the top reaches the sill, which is the opposite side, sine) or a line is painted on the paving at a distance from the wall (ask "out": the learner slides the foot onto the line, which is the adjacent side, cosine). The ladder's length is written on it; the mark carries its distance. A readout under the picture gives the other leg live, with arrow buttons that slide the foot.
  circle: the unit circle with a point on it that the learner drags round, in steps of 15 degrees. The point's height (sine) and its distance across (cosine) are drawn as the two legs of the triangle it makes with the centre, and the sine (or cosine) curve is drawn alongside as the point goes round. Readouts give the angle and the live sine and cosine as decimals. The learner turns the point to where the sine (or cosine) has a given exact value, with the sign of the other one if the lesson names it. A value that happens at two angles accepts both.
  For: trigonometry in right-angled triangles, SOH CAH TOA, sine and cosine as ratios, finding an angle from a ratio, angles of elevation (a ladder against a wall), the unit circle, exact values of sine and cosine (0, 1/2, √2/2, √3/2, 1), the sine and cosine graphs, solving sin x = k and cos x = k for angles up to 360 degrees. It answers "the ratio depends on the size of the triangle" (the ladder is one length and only the angle changes) and "sine is a button on the calculator" (it is the height of a point going round a circle). It also serves Pythagoras' theorem in a ladder: the live other leg goes with the one marked.
  ladder config: { "task":"ladder", "length":5, "ask":"height", "value":4 }. length is the ladder in metres, 3 to 10; ask is "height" or "out"; value is the mark in metres, between a third and nearly all of the length for "height" (20 to 80 degrees), between a sixth and nine tenths for "out". Whole-number triangles read best: length 5 with value 3 or 4, length 10 with value 6 or 8.
  circle config: { "task":"circle", "fn":"sine", "value":"1/2", "other":"negative" }. fn is "sine" or "cosine"; value is one of 0, 1/2, √2/2, √3/2, 1 or a negative of one, as text; other is optional, the sign of the other function ("positive" or "negative"), which picks one of two angles. Leave other out to let either angle count, and the marking then says the other one too.
  Not drawn: tangent, radians, inverse functions on a calculator, non-right triangles (sine and cosine rules), identities, calculus, bearings, three dimensions, waves in physics.
  Before marking the card shows the lengths and the live legs, with the angle's arc but no angle number on the ladder; it does not say what the target angle is. The prompt must say the gesture, and ask for the reach, the mark or the exact value only: do NOT name the angle in degrees, ask for radians, name tangent or a calculator, or say how many angles or which quadrant works.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the foot of the ladder along the ground until its top just reaches the window sill.",
    "payload": { "engine":"trig-circle", "config": { "task":"ladder", "length":5, "ask":"height", "value":4 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:trig-circle", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the foot of the ladder along the ground until it stands on the painted line.",
    "payload": { "engine":"trig-circle", "config": { "task":"ladder", "length":5, "ask":"out", "value":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:trig-circle", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the point round the circle to where sine is ½ and cosine is negative.",
    "payload": { "engine":"trig-circle", "config": { "task":"circle", "fn":"sine", "value":"1/2", "other":"negative" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:trig-circle", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the point round the circle to where cosine is √3/2.",
    "payload": { "engine":"trig-circle", "config": { "task":"circle", "fn":"cosine", "value":"√3/2" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:trig-circle", "why":"..." } }`,
}

registerEngine(trigCircleEngine as SceneEngine<unknown, unknown>)
