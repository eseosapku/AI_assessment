// lib/studylab/engines/calculus-grapher/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CalculusGrapherView } from './View'

/**
 * The two ideas of school calculus, handled rather than recited: a derivative
 * is the steepness of the curve at a point, and an integral is area piling up
 * (Cambridge IGCSE Additional Mathematics 0606 and A Level Mathematics 9709:
 * differentiation of polynomials, stationary points, integration as area).
 *
 * The curve is a polynomial of degree 3 or less with small rational
 * coefficients. Every mark is exact: coefficients, positions and gradients are
 * fractions (never floats), the learner's positions sit on a fixed step, and a
 * mark compares two fractions. The step is chosen so a real hand is fair:
 * `stepPx` is tested against a floor for a fingertip.
 *
 * Ideas taken (never code or artwork): the "trace the slope as you drag a
 * point" explorables on GeoGebra and Desmos; PhET Calculus Grapher's habit of
 * predicting the derivative's graph before it is shown, and its teacher's
 * guide on area as accumulation (students memorise "area under a curve"
 * without meeting accumulation).
 */

export const KINDS = ['find-stationary', 'set-gradients', 'sweep-area'] as const
export type Kind = (typeof KINDS)[number]
export type Which = 'max' | 'min'

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
export const ZERO = rat(0)
export const add = (a: Rat, b: Rat) => rat(a.n * b.d + b.n * a.d, a.d * b.d)
export const mul = (a: Rat, b: Rat) => rat(a.n * b.n, a.d * b.d)
export const isZero = (a: Rat) => a.n === 0
export const same = (a: Rat, b: Rat) => a.n === b.n && a.d === b.d
export const sign = (a: Rat) => Math.sign(a.n)
export const num = (a: Rat) => a.n / a.d

const MINUS = '−'
export function ratText(r: Rat): string {
  const abs = r.d === 1 ? `${Math.abs(r.n)}` : `${Math.abs(r.n)}/${r.d}`
  return r.n < 0 ? `${MINUS}${abs}` : abs
}

/** A number the tutor wrote: a whole number, a decimal of up to three places, or "a/b". */
export function readRat(raw: unknown): Rat | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    const scaled = Math.round(raw * 1000)
    return Math.abs(raw * 1000 - scaled) < 1e-6 ? rat(scaled, 1000) : null
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/[−–]/g, '-').replace(/\s+/g, '')
  const frac = /^([+-]?)(\d{1,6})\/(\d{1,6})$/.exec(s)
  if (frac) return Number(frac[3]) > 0 ? rat((frac[1] === '-' ? -1 : 1) * Number(frac[2]), Number(frac[3])) : null
  const dec = /^([+-]?)(\d{0,6})(?:\.(\d{1,3}))?$/.exec(s)
  if (!dec || (!dec[2] && !dec[3])) return null
  const places = dec[3]?.length ?? 0
  return rat((dec[1] === '-' ? -1 : 1) * Number(`${dec[2] || '0'}${dec[3] ?? ''}`), 10 ** places)
}

// ---------------------------------------------------------------------------
// Polynomials, coefficients ascending: coef[i] is the coefficient of x^i.

export type Poly = Rat[]
export const fromQuarters = (k: number): Rat => rat(k, 4)
export const fromHalves = (h: number): Rat => rat(h, 2)

export function evalPoly(p: Poly, x: Rat): Rat {
  let acc = ZERO
  for (let i = p.length - 1; i >= 0; i--) acc = add(mul(acc, x), p[i])
  return acc
}
export const evalFloat = (p: Poly, x: number) => p.reduceRight((acc, c) => acc * x + num(c), 0)
export const derive = (p: Poly): Poly => p.slice(1).map((c, i) => mul(c, rat(i + 1)))
export const antiderive = (p: Poly): Poly => [ZERO, ...p.map((c, i) => mul(c, rat(1, i + 1)))]
export const degreeOf = (p: Poly) => { for (let i = p.length - 1; i >= 0; i--) if (!isZero(p[i])) return i; return 0 }

/** The gradient at x: exact. */
export const gradientAt = (p: Poly, x: Rat) => evalPoly(derive(p), x)
/** The area from 0 to x under the curve: exact. */
export const areaTo = (p: Poly, x: Rat) => evalPoly(antiderive(p), x)

/** "x³/3 − x", "−(1/2)x² + 2x + 1": a curve as a school writes it. */
export function polyText(p: Poly): string {
  const sup = ['', '', '²', '³']
  const parts: string[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i]
    if (isZero(c)) continue
    const abs = rat(Math.abs(c.n), c.d)
    const body = i === 0 ? ratText(abs) : `${abs.n === 1 && abs.d === 1 ? '' : abs.d === 1 ? `${abs.n}` : `(${ratText(abs)})`}x${sup[i] ?? `^${i}`}`
    parts.push(parts.length === 0 ? `${c.n < 0 ? MINUS : ''}${body}` : `${c.n < 0 ? MINUS : '+'} ${body}`)
  }
  return parts.length ? parts.join(' ').replace(/ /g, ' ') : '0'
}

// ---------------------------------------------------------------------------
// Layout. Shared by the view and the fairness tests.

export const VBW = 360
export const PL = 34
export const PR = 346
export const PW = PR - PL

export function layout(kind: Kind) {
  const upper = kind === 'find-stationary' ? { y0: 24, h: 150 } : kind === 'set-gradients' ? { y0: 24, h: 124 } : { y0: 24, h: 140 }
  const strip = kind === 'find-stationary' ? { y0: upper.y0 + upper.h + 46, h: 100 }
    : kind === 'set-gradients' ? { y0: upper.y0 + upper.h + 46, h: 144 }
    : { y0: upper.y0 + upper.h + 46, h: 112 }
  return { upper, strip, H: strip.y0 + strip.h + 34, xa: kind === 'sweep-area' ? 0 : -3, xb: kind === 'sweep-area' ? 4 : 3 }
}

/** The learner's positions: quarters of a unit on the curve, halves for the sweep, whole gradients. */
export const QUARTERS = 12 // find-stationary: k from -12 to 12, x = k/4
export const HALVES = 8 // sweep-area: h from 0 to 8, x = h/2
export const STATIONS = [-2, -1, 0, 1, 2] as const
export const LEVEL = 4 // set-gradients: a gradient from -4 to 4
export const LEVEL_SPAN = 9 // the strip shows 9 whole levels of height

/** Pixels between neighbouring positions the learner can choose: what a fingertip has to resolve. */
export function stepPx(kind: Kind): number {
  const { xa, xb } = layout(kind)
  if (kind === 'find-stationary') return PW / ((xb - xa) * 4)
  if (kind === 'sweep-area') return PW / ((xb - xa) * 2)
  return layout(kind).strip.h / LEVEL_SPAN
}
/** The least step a fingertip is given (a 12 px mark under a 7 mm fingertip is comfortable at 13 px; a mouse at much less). */
export const MIN_STEP_PX = 12

// ---------------------------------------------------------------------------
// The task, and what the curve does.

export type CalculusConfig = { task: { kind: Kind; coef: Poly; which?: Which; area?: Rat } }
export type CalculusState = { k?: number; h?: number; g?: number[]; seen?: number[]; far?: number }

export type Turn = { x: number; kq: number | null; type: 'max' | 'min' | 'flat' }

/** Where the gradient is zero: the quarter-grid position when it is exactly one, and whether the curve peaks, dips or just levels. */
export function turningPoints(p: Poly): Turn[] {
  const c = p[1] ?? ZERO, b2 = mul(rat(2), p[2] ?? ZERO), a3 = mul(rat(3), p[3] ?? ZERO)
  const [A, B, C] = [num(a3), num(b2), num(c)]
  const roots: number[] = []
  if (A === 0) { if (B !== 0) roots.push(-C / B) }
  else {
    const disc = B * B - 4 * A * C
    if (disc === 0) roots.push(-B / (2 * A))
    else if (disc > 0) roots.push((-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A))
  }
  const d1 = derive(p)
  return roots.sort((u, v) => u - v).map((x) => {
    const kq = Math.round(x * 4)
    const exact = isZero(evalPoly(d1, fromQuarters(kq)))
    // f'' = 2·c2 + 6·c3·x, exactly at an on-grid root; by float otherwise.
    const f2 = exact ? num(add(b2, mul(mul(rat(2), a3), fromQuarters(kq)))) : B + 2 * A * x
    return { x, kq: exact ? kq : null, type: Math.abs(f2) < 1e-9 ? 'flat' : f2 < 0 ? 'max' : 'min' } as Turn
  })
}

const turnOf = (config: CalculusConfig): Turn | null => {
  const { coef, which } = config.task
  return turningPoints(coef).find((t) => t.type === which && t.kq !== null) ?? null
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const readKind = (raw: unknown): Kind | null => {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')
  const alias: Record<string, Kind> = {
    'find-stationary': 'find-stationary', 'stationary': 'find-stationary', 'find-turning-point': 'find-stationary',
    'find-turning': 'find-stationary', 'find-peak': 'find-stationary', 'feel-gradient': 'find-stationary',
    'set-gradients': 'set-gradients', 'set-gradient': 'set-gradients', 'sketch-gradient': 'set-gradients', 'sketch-derivative': 'set-gradients',
    'sweep-area': 'sweep-area', 'area': 'sweep-area', 'accumulate': 'sweep-area', 'sweep': 'sweep-area',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

const readWhich = (raw: unknown): Which | null => {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (/^(max|maximum|maxima|peak|top|highest)/.test(s)) return 'max'
  if (/^(min|minimum|minima|trough|dip|bottom|lowest|valley)/.test(s)) return 'min'
  return null
}

const KEYS: Array<[number, string[]]> = [
  [3, ['x3', 'a3', 'cubic', 'x^3', 'x³']],
  [2, ['x2', 'a2', 'quadratic', 'x^2', 'x²']],
  [1, ['x1', 'a1', 'linear', 'x']],
  [0, ['c', 'x0', 'a0', 'constant', 'k']],
]

function readCurve(raw: unknown): Poly | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const coef: Poly = [ZERO, ZERO, ZERO, ZERO]
  for (const [power, names] of KEYS) {
    const v = names.map((k) => o[k]).find((x) => x !== undefined)
    if (v === undefined) continue
    const r = readRat(v)
    if (!r) return null
    coef[power] = r
  }
  return coef
}

// ---------------------------------------------------------------------------
// What the learner made, in words: for the marking, never before it.

const q = (k: number) => `${k < 0 ? MINUS : ''}${Math.abs(k) / 4}`
const h2 = (h: number) => `${h / 2}`

/** The area as a decimal of two places: exact when it is, "≈" otherwise. */
export function areaText(r: Rat): string {
  const exact = (r.n * 100) % r.d === 0
  return `${exact ? '' : '≈ '}${Math.round((r.n / r.d) * 100) / 100}`
}

export function findVerdict(config: CalculusConfig, k: number | undefined, right: boolean): string {
  const { coef, which } = config.task
  const kind = which === 'min' ? 'lowest point of its dip' : 'top of its hump'
  if (right) return `At x = ${q(turnOf(config)?.kq ?? 0)} the tangent is level: the curve stops ${which === 'min' ? 'falling and starts climbing' : 'climbing and starts falling'}. That is the ${kind}.`
  if (typeof k !== 'number') return 'Slide the point along the curve first.'
  const g = gradientAt(coef, fromQuarters(k))
  const at = `You stopped at x = ${q(k)}`
  if (isZero(g)) {
    const t = turningPoints(coef).find((u) => u.kq === k)
    return `${at}, where the tangent is level: it is a ${t?.type === 'max' ? 'top' : t?.type === 'min' ? 'dip' : 'pause'}, but not the ${which === 'min' ? 'dip' : 'top'} you were asked for.`
  }
  return `${at}, where the curve is still ${sign(g) > 0 ? 'climbing' : 'falling'}.`
}

export function setVerdict(config: CalculusConfig, g: number[] | undefined, right: boolean): string {
  const d1 = derive(config.task.coef)
  const want = STATIONS.map((x) => num(evalPoly(d1, rat(x))))
  if (right) {
    const words = want.map((v) => (v > 0 ? 'climbs' : v < 0 ? 'falls' : 'is level'))
    return `Every tangent matches. Left to right the curve ${words.filter((w, i) => i === 0 || w !== words[i - 1]).join(', then ')}: your marks drew the gradient graph.`
  }
  const got = STATIONS.map((_, i) => (g && Number.isInteger(g[i]) ? g[i] : 0))
  const wrong = STATIONS.map((x, i) => ({ x, i })).filter(({ i }) => got[i] !== want[i])
  if (!wrong.length) return ''
  const bits = wrong.slice(0, 2).map(({ x, i }) => {
    const curve = want[i] > 0 ? 'climbs' : want[i] < 0 ? 'falls' : 'is level'
    const mine = got[i] > 0 ? 'climbing' : got[i] < 0 ? 'falling' : 'level'
    const dir = Math.sign(got[i]) === Math.sign(want[i])
      ? (Math.abs(got[i]) > Math.abs(want[i]) ? 'too steep' : 'not steep enough')
      : `${mine}, but the curve ${curve}`
    return `at x = ${x < 0 ? MINUS : ''}${Math.abs(x)} your tangent is ${dir}`
  })
  return `${wrong.length === 1 ? 'One tangent is off' : `${wrong.length} tangents are off`}: ${bits.join('; ')}.`
}

export function sweepVerdict(config: CalculusConfig, h: number | undefined, right: boolean): string {
  const { coef, area } = config.task
  const at = typeof h === 'number' ? h : 0
  const got = areaTo(coef, fromHalves(at))
  if (right) return `At x = ${h2(at)} the area has piled up to ${areaText(got)}: it grows fastest where the curve is tallest.`
  const t = area ? num(area) : 0
  return `You stopped at x = ${h2(at)} with ${areaText(got)} so far: ${num(got) < t ? 'not enough yet' : 'too much'}.`
}

// ---------------------------------------------------------------------------

const LIMIT = 12
const tooBig = (c: Rat) => Math.abs(num(c)) > LIMIT || c.d > 12

export const layoutOk = (kind: Kind) => stepPx(kind) >= MIN_STEP_PX

export const calculusGrapherEngine: SceneEngine<CalculusConfig, CalculusState> = {
  id: 'calculus-grapher',
  covers: ['differentiation', 'differentiating', 'derivatives', 'calculus', 'integration', 'integrals'],
  phrases: ['gradient of a curve', 'gradient function', 'area under a curve', 'area under the graph', 'tangent to a curve', 'stationary points', 'stationary point', 'turning points', 'maxima and minima'],
  isolates: 'magnitude',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readKind(t.kind)
    const coef = readCurve(t.curve ?? t.coefficients ?? t.coef ?? t.f)
    if (!kind || !coef) return null
    if (kind === 'sweep-area') {
      const area = readRat(t.area ?? t.target ?? t.total)
      return area ? { task: { kind, coef, area } } : null
    }
    if (kind === 'find-stationary') {
      const turns = turningPoints(coef).filter((u) => u.type !== 'flat')
      const which = readWhich(t.which ?? t.find ?? t.type) ?? (turns.length === 1 ? turns[0].type as Which : 'max')
      return { task: { kind, coef, which } }
    }
    return { task: { kind, coef } }
  },

  faults(config) {
    const { kind, coef, which, area } = config.task
    const curve = polyText(coef)
    const out: string[] = []
    if (coef.some(tooBig)) out.push(`the curve ${curve} has a coefficient above ${LIMIT} or a denominator above 12: use small coefficients such as x²/2 − 2x.`)
    const deg = degreeOf(coef)
    if (deg === 0) { out.push('the curve is a flat line, so its gradient is 0 everywhere and no area piles up interestingly: give it an x², x or x³ term.'); return out }
    if (kind === 'find-stationary') {
      const turns = turningPoints(coef)
      const want = turns.find((t) => t.type === which)
      if (deg < 2) out.push(`${curve} is a straight line: it never stops climbing or falling. Use a quadratic such as x² − 2x, or a cubic such as x³/3 − x.`)
      else if (!want) {
        const has = turns.filter((t) => t.type !== 'flat').map((t) => (t.type === 'max' ? 'top' : 'dip'))
        out.push(`the curve ${curve} has no ${which === 'max' ? 'maximum' : 'minimum'}${has.length ? ` (it has a ${has.join(' and a ')})` : turns.length ? ' (it only levels off for a moment while still climbing or falling)' : ''}. Ask for the other, or try ${which === 'max' ? '−x² + 2x' : 'x² − 2x'}.`)
      } else if (want.kq === null) out.push(`the ${which === 'max' ? 'top' : 'dip'} of ${curve} is not at a quarter-unit position, so a hand cannot land exactly on it. Choose coefficients that put it on a multiple of 0.25, e.g. x² − 2x.`)
      else if (Math.abs(want.kq) > 10) out.push(`the ${which === 'max' ? 'top' : 'dip'} of ${curve} is too near the edge of the graph (x from −3 to 3). Keep it between −2.5 and 2.5.`)
    } else if (kind === 'set-gradients') {
      if (deg < 2) out.push(`${curve} is a straight line, whose gradient is the same everywhere; coordinate-plane teaches that. Use a quadratic such as x²/2 − x or a cubic such as x³/3 − x.`)
      else {
        const d1 = derive(coef)
        const bad = STATIONS.filter((x) => { const g = evalPoly(d1, rat(x)); return g.d !== 1 || Math.abs(g.n) > LEVEL })
        if (bad.length) out.push(`the gradient of ${curve} is not a whole number from −${LEVEL} to ${LEVEL} at x = ${bad.map((x) => (x < 0 ? MINUS : '') + Math.abs(x)).join(', ')}, so it cannot be set on the graph. Use e.g. x³/3 − x or x²/2 − x.`)
      }
    } else {
      if (!area || area.n <= 0) { out.push('give a positive target area, e.g. 4.5.'); return out }
      let below = false
      for (let i = 0; i <= 400; i++) if (evalFloat(coef, i / 100) < -1e-9) below = true
      if (below) out.push(`${curve} dips below the x-axis between 0 and 4, where the area would have to count backwards. Use a curve that stays above the axis from 0 to 4 for now, e.g. 2x − x²/2.`)
      else {
        const hits = Array.from({ length: HALVES }, (_, i) => i + 1).filter((h) => same(areaTo(coef, fromHalves(h)), area))
        const thin = Array.from({ length: HALVES }, (_, i) => i + 1).some((h) => num(add(areaTo(coef, fromHalves(h)), mul(rat(-1), areaTo(coef, fromHalves(h - 1))))) < 0.1)
        const nice = Array.from({ length: HALVES }, (_, i) => i + 1).map((h) => ({ h, a: areaTo(coef, fromHalves(h)) })).filter(({ a }) => (a.n * 100) % a.d === 0).sort((x, y) => Math.abs(num(x.a) - num(area)) - Math.abs(num(y.a) - num(area)))[0]
        if (!hits.length) out.push(`the area under ${curve} is never exactly ${areaText(area)} at a half-unit position from 0 to 4. Choose a target the area reaches${nice ? `, e.g. ${areaText(nice.a)} (at x = ${nice.h / 2})` : ''}.`)
        else if (thin) out.push(`${curve} is so low in places that the area grows by less than 0.1 in half a unit, which cannot be told apart on the readout. Use a taller curve such as 2x − x²/2.`)
        if ((area.n * 100) % area.d !== 0) out.push('the target area needs at most two decimal places.')
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const out: string[] = []
    const kind = config.task.kind
    if (/\b(?:dy\s*\/\s*dx|d\s*\/\s*dx|f\s*['′]\s*\(\s*x\s*\))\s*=?/i.test(prompt) && /=/.test(prompt) && kind !== 'sweep-area') {
      out.push('the prompt writes the derivative, which the scene lets the learner find by feeling the steepness -- ask without it ("Set the tangent\'s steepness at each mark.")')
    }
    if (kind === 'find-stationary' && (/\bx\s*=\s*[-−–]?\d/i.test(prompt) || /\(\s*[-−–]?\d+(?:\.\d+)?\s*,\s*[-−–]?\d/.test(prompt) || /=\s*0\b/.test(prompt))) {
      out.push('the prompt gives away where the point is (a value of x, a coordinate, or "= 0"): ask for it in words ("Find where the curve stops climbing.")')
    }
    if (kind === 'set-gradients' && /(?:gradient|slope|steepness)[^.?!]{0,40}[-−–]?\d/i.test(prompt)) {
      out.push('the prompt puts a number on a gradient, which the learner is to find: ask for the shape ("Set the tangent at each mark so it follows the curve.")')
    }
    if (kind === 'sweep-area' && (/\bx\s*=\s*[-−–]?\d/i.test(prompt) || /\b(?:to|until|at)\s+x\b/i.test(prompt) || /\bbetween\b[^.?!]*\d/i.test(prompt))) {
      out.push('the prompt names the boundary the learner is to find: the scene already shows the target area, so say "Sweep the line until the area reaches the target."')
    }
    return out
  },

  initial(config) {
    const { kind, coef } = config.task
    if (kind === 'find-stationary') {
      const t = turnOf(config)
      const k = t && t.kq !== null && t.kq > 0 ? -QUARTERS : QUARTERS
      return { k, seen: [k] }
    }
    if (kind === 'set-gradients') return { g: STATIONS.map(() => 0) }
    void coef
    return { h: 0, far: 0 }
  },

  check(config, state) {
    const { kind, coef, which, area } = config.task
    if (kind === 'find-stationary') {
      const k = state?.k
      if (typeof k !== 'number' || !Number.isInteger(k) || Math.abs(k) > QUARTERS) return { ok: false, wrongIds: [] }
      const g = gradientAt(coef, fromQuarters(k))
      const f2 = evalPoly(derive(derive(coef)), fromQuarters(k))
      return { ok: isZero(g) && sign(f2) === (which === 'max' ? -1 : 1), wrongIds: [] }
    }
    if (kind === 'set-gradients') {
      const d1 = derive(coef)
      const g = state?.g
      const wrongIds: string[] = []
      STATIONS.forEach((x, i) => {
        const want = evalPoly(d1, rat(x))
        const got = g && Number.isInteger(g[i]) ? g[i] : NaN
        if (!(want.d === 1 && want.n === got)) wrongIds.push(`s${i}`)
      })
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const h = state?.h
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > HALVES || !area) return { ok: false, wrongIds: [] }
    return { ok: same(areaTo(coef, fromHalves(h)), area), wrongIds: [] }
  },

  solve(config) {
    const { kind, coef, area } = config.task
    if (kind === 'find-stationary') {
      const k = turnOf(config)?.kq ?? 0
      return { k, seen: [k] }
    }
    if (kind === 'set-gradients') {
      const d1 = derive(coef)
      return { g: STATIONS.map((x) => evalPoly(d1, rat(x)).n) }
    }
    const h = Array.from({ length: HALVES + 1 }, (_, i) => i).find((i) => area && same(areaTo(coef, fromHalves(i)), area)) ?? 0
    return { h, far: h }
  },

  View: CalculusGrapherView,

  prompt: `SCENE "calculus-grapher" -- one polynomial curve (degree 3 or less) the learner handles, to FEEL a derivative as
  steepness and an integral as area piling up. The engine draws the curve and a tangent or shaded area; a second graph
  below fills in from the learner's own actions. The learner never sees a gradient value, stationary point or formula
  as an answer before marking; the sentence naming what they made (and what was right) appears once the card is marked.
  For: differentiation, stationary points (maxima and minima), integration as area under a curve. NOT for straight
  lines (use coordinate-plane) and not for areas of shapes.
  curve: the polynomial's coefficients, any of "x3","x2","x1","c" (numbers or fractions like "1/3"); small, |coefficient| <= 12.
  config: { "task": { "kind":"find-stationary", "curve": { "x2":-1, "x1":2 }, "which":"max" } }
            -- the learner slides a point along the curve; the tangent rides on it and a gradient graph traces below.
            They stop where the curve stops climbing. "which" is "max" or "min" (a cubic has both). The top or dip
            must sit on a multiple of 0.25 between -2.5 and 2.5; a straight line has none. Do NOT write x or a
            coordinate in the prompt.
       or { "task": { "kind":"set-gradients", "curve": { "x3":"1/3", "x1":-1 } } }
            -- five tangents ride on the curve at x = -2,-1,0,1,2; the learner sets each one's steepness on the gradient
            graph below (its dots, joined) so the tangents follow the curve. The gradient at each of the five must be a
            whole number from -4 to 4 (x^3/3 - x gives 3,0,-1,0,3; x^2/2 - x gives -3,-2,-1,0,1). Do NOT write the derivative.
       or { "task": { "kind":"sweep-area", "curve": { "x1":2, "x2":"-1/2" }, "area":"9/2" } }
            -- the learner sweeps a line right from x = 0 to 4 in half-units; the area under the curve piles up, its running
            total is shown and a graph traces the total. They stop where it reaches "area" (shown as a dashed target). The
            curve must stay above the x-axis from 0 to 4; the area must be reached exactly at a half-unit; at most 2
            decimal places. Do NOT name the x to stop at.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the point along the curve until you find where it stops climbing.",
    "payload": { "engine":"calculus-grapher", "config": { "task": { "kind":"find-stationary", "curve": { "x2":-1, "x1":2 }, "which":"max" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:calculus-grapher", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Set the tangent at each mark so it follows the curve.",
    "payload": { "engine":"calculus-grapher", "config": { "task": { "kind":"set-gradients", "curve": { "x3":"1/3", "x1":-1 } } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:calculus-grapher", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Sweep the line right until the area reaches the target.",
    "payload": { "engine":"calculus-grapher", "config": { "task": { "kind":"sweep-area", "curve": { "x1":2, "x2":"-1/2" }, "area":"9/2" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:calculus-grapher", "why":"..." } }`,
}

registerEngine(calculusGrapherEngine as SceneEngine<unknown, unknown>)
