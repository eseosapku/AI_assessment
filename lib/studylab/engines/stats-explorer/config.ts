// lib/studylab/engines/stats-explorer/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { StatsExplorerView } from './View'

/**
 * Averages and spread on a dot plot, as lower secondary and IGCSE teach them:
 * Cambridge Lower Secondary Mathematics (0862, Statistics: the mean, median,
 * mode and range of a small set of data) and Cambridge IGCSE Mathematics (0580,
 * Statistics: calculate the mean, median, mode and range of individual data,
 * and choose the average that suits the data). Three tasks.
 *
 * 1. make. The tutor names one or two targets (a mean, a median, a mode or a
 *    range) and how many dots; the learner builds a data set on a 0 to 20 line
 *    that meets them. The plot shows the dots and no readout of its own: the
 *    median, mode and range can be read off the picture (the middle dot, the
 *    tallest stack, the two ends), and the mean, which cannot, is exactly what
 *    the learner is to work out. The numbers come with the mark.
 * 2. predict. A data set is shown with one change drawn on it (a value added,
 *    taken away or moved). For each of the mean, the median and the range the
 *    learner says whether it goes up, goes down or stays the same. The values
 *    before and after come with the mark.
 * 3. choose. A short situation with its own data (the engine owns the data, so
 *    it is always honest). The learner picks the mean, median or mode and the
 *    reason that fits it. Only situations with one textbook answer are held:
 *    the mode when the aim is "which is most common", the median when one
 *    extreme value drags the mean away from the rest, the mean when the total
 *    is to be shared out equally.
 *
 * The facts used. The mean is the total divided by the number of values; the
 * median is the middle value of the data in order (the mean of the two middle
 * values when there is an even number); the mode is the most common value; the
 * range is the largest value minus the smallest. A single mode needs one value
 * with strictly more dots than any other: when two tie there is no one mode,
 * and the engine does not mark a tie as a mode. The median ignores how far an
 * extreme value lies; the mean does not (the textbook reason to prefer the
 * median for house prices or pay with one very large value).
 *
 * All arithmetic is exact. Values are whole numbers from 0 to 20. A mean is held
 * as a fraction (total over count), a median as twice its value, so every
 * comparison is between whole numbers and marking never compares floats.
 */

// ---------------------------------------------------------------------------
// Limits.

export const MIN_DOTS = 5
export const MAX_DOTS = 10
/** The line runs from 0 to TOP, a dot on every whole number. */
export const TOP = 20
/** predict: the data sets it may show (a value added keeps it within MAX_DOTS). */
export const MIN_VALUES = 5
export const MAX_VALUES = 9

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const asc = (a: number, b: number) => a - b
const listText = (xs: readonly (string | number)[]) => xs.join(', ')

// ---------------------------------------------------------------------------
// Exact arithmetic: a mean is a fraction, a median is twice itself.

export type Rat = { n: number; d: number }
const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}
export function rat(n: number, d = 1): Rat {
  const g = gcd(n, d)
  return { n: n / g + 0, d: d / g }
}
export const cmpRat = (a: Rat, b: Rat): number => Math.sign(a.n * b.d - b.n * a.d)

/** Whether a fraction is a decimal that ends within three places, so the tutor could write it. */
export const terminates = (r: Rat): boolean => (1000 * r.n) % r.d === 0

/** "4", "4.5", "4.125" when exact; "about 4.57" when the decimal goes on. */
export function fmtRat(r: Rat): string {
  if (terminates(r)) {
    const t = (1000 * r.n) / r.d
    const frac = String(t % 1000).padStart(3, '0').replace(/0+$/, '')
    return frac ? `${Math.floor(t / 1000)}.${frac}` : `${t / 1000}`
  }
  const h = Math.floor((200 * r.n + r.d) / (2 * r.d))
  return `about ${Math.floor(h / 100)}.${String(h % 100).padStart(2, '0')}`
}

/** A decimal of at most three places, as a fraction; null for anything else. */
export function ratOfDecimal(x: unknown): Rat | null {
  const s = typeof x === 'number' ? (Number.isFinite(x) ? String(x) : '') : typeof x === 'string' ? x.trim() : ''
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(s)
  if (!m) return null
  const frac = m[2] ?? ''
  return rat(Number(m[1] + frac), 10 ** frac.length)
}

/** Twice a median, written as the learner would: 9 -> "4.5", 8 -> "4". */
export const fmtMedian = (twice: number): string => (twice % 2 === 0 ? `${twice / 2}` : `${(twice - 1) / 2}.5`)

export type Stats = {
  n: number
  sum: number
  mean: Rat
  median2: number
  /** The one value with strictly more dots than any other, or null. */
  mode: number | null
  /** Every value on the most dots; one long when there is a mode. */
  tied: number[]
  /** How many dots the most common value has. */
  most: number
  min: number
  max: number
  range: number
}

/** The mean, median, mode and range of at least one whole-number value. */
export function statsOf(values: readonly number[]): Stats {
  const v = [...values].sort(asc)
  const n = v.length
  const sum = v.reduce((a, b) => a + b, 0)
  const counts = new Map<number, number>()
  for (const x of v) counts.set(x, (counts.get(x) ?? 0) + 1)
  const most = Math.max(...counts.values())
  const tied = [...counts].filter(([, c]) => c === most).map(([x]) => x).sort(asc)
  return {
    n, sum, mean: rat(sum, n),
    median2: n % 2 === 1 ? 2 * v[(n - 1) / 2] : v[n / 2 - 1] + v[n / 2],
    mode: tied.length === 1 ? tied[0] : null, tied, most,
    min: v[0], max: v[n - 1], range: v[n - 1] - v[0],
  }
}

const isDot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= TOP

/** The dots a saved state holds, read safely: whole numbers on the line, sorted, no more than `max`. */
export function readDots(raw: unknown, max = MAX_DOTS): number[] {
  const list = (raw as { dots?: unknown } | null)?.dots
  return Array.isArray(list) ? list.filter(isDot).sort(asc).slice(0, max) : []
}

const modeWords = (s: Stats): string =>
  s.mode !== null ? `${s.mode}` : s.most === 1 ? 'none (no value repeats)' : `none (${s.tied.join(' and ')} tie)`

// ---------------------------------------------------------------------------
// make: what the dots must be.

export const MAKE_MEASURES = ['mean', 'median', 'mode', 'range'] as const
export type Measure = (typeof MAKE_MEASURES)[number]
export type MakeTask = { kind: 'make'; count?: number; mean?: number; median?: number; mode?: number; range?: number; unread?: string[] }

export const namedTargets = (t: MakeTask): Measure[] => MAKE_MEASURES.filter((m) => t[m] !== undefined)

/** The targets as whole numbers: the total the dots must have, twice the median, the mode, the range. */
export type Goal = { sum?: number; med2?: number; mode?: number; range?: number }

/** The goal a make task asks of its dots, or null when a target is not one whole-number dots can have. */
export function makeGoal(t: MakeTask): Goal | null {
  const n = t.count
  const names = namedTargets(t)
  if (n === undefined || !Number.isInteger(n) || n < MIN_DOTS || n > MAX_DOTS || names.length < 1 || names.length > 2) return null
  const goal: Goal = {}
  if (t.mean !== undefined) {
    const r = ratOfDecimal(t.mean)
    if (!r || r.n > TOP * r.d || (r.n * n) % r.d !== 0) return null
    goal.sum = (r.n * n) / r.d
  }
  if (t.median !== undefined) {
    const twice = t.median * 2
    if (!Number.isInteger(twice) || twice < 0 || twice > 2 * TOP || (n % 2 === 1 && twice % 2 !== 0)) return null
    goal.med2 = twice
  }
  if (t.mode !== undefined) {
    if (!isDot(t.mode)) return null
    goal.mode = t.mode
  }
  if (t.range !== undefined) {
    if (!Number.isInteger(t.range) || t.range < 1 || t.range > TOP) return null
    goal.range = t.range
  }
  return goal
}

type Pin = { p: number; val: number }

/** Where the median pins the sorted dots: the middle one, or the two middle ones in each way they can add up. */
function pinOptions(n: number, med2: number | undefined): Pin[][] {
  if (med2 === undefined) return [[]]
  if (n % 2 === 1) return med2 % 2 === 0 ? [[{ p: (n - 1) / 2, val: med2 / 2 }]] : []
  const a = n / 2 - 1
  const out: Pin[][] = []
  for (let u = 0; u <= TOP; u++) {
    const w = med2 - u
    if (w < u || w > TOP) continue
    out.push(u === w ? [{ p: a, val: u }, { p: a + 1, val: u }] : [{ p: a, val: u }, { p: a + 1, val: w }])
  }
  return out
}

/**
 * One search for counts of each value from lo to hi: every count at most n - 1 (the dots are
 * not all on one value), the mode's count exactly k and every other below it, the pinned
 * positions holding their values, the total exact. Failures are remembered by (value, dots
 * left, total left), so the search is small whatever the targets.
 */
function fill(n: number, goal: Goal, pins: Pin[], k: number, lo: number, hi: number, ends: boolean): number[] | null {
  const m = goal.mode
  const S = goal.sum
  if (m !== undefined && (m < lo || m > hi)) return null
  // The pinned values are in the window; a pin below it would be taken for met.
  if (pins.some((p) => p.val < lo || p.val > hi)) return null
  if (S !== undefined && (S < n * lo || S > n * hi)) return null
  const counts: number[] = new Array(TOP + 1).fill(0)
  const dead = new Set<number>()
  const go = (v: number, rem: number, left: number): boolean => {
    if (rem === 0) {
      return (S === undefined || left === 0) && pins.every((p) => p.val < v) && (m === undefined || m < v) && (!ends || hi < v)
    }
    if (v > hi) return false
    const key = (v * 11 + rem) * 201 + (S === undefined ? 0 : left)
    if (dead.has(key)) return false
    let cmin = 0
    let cmax = Math.min(rem, n - 1)
    if (m !== undefined) {
      if (v === m) {
        cmin = k
        cmax = Math.min(cmax, k)
      } else cmax = Math.min(cmax, k - 1)
    }
    if (ends && v === lo) cmin = Math.max(cmin, 1)
    if (v === hi) cmin = Math.max(cmin, rem)
    if (ends && v < hi) cmax = Math.min(cmax, rem - 1)
    const cum = n - rem
    for (const p of pins) {
      if (p.val !== v) continue
      if (cum > p.p) {
        dead.add(key)
        return false
      }
      cmin = Math.max(cmin, p.p - cum + 1)
    }
    for (let c = cmin; c <= cmax; c++) {
      const rem2 = rem - c
      const left2 = S === undefined ? 0 : left - v * c
      if (S !== undefined) {
        if (left2 < 0) break
        if (rem2 === 0 ? left2 !== 0 : left2 < (v + 1) * rem2 || left2 > hi * rem2) continue
      }
      counts[v] = c
      if (go(v + 1, rem2, left2)) return true
    }
    counts[v] = 0
    dead.add(key)
    return false
  }
  return go(lo, n, S ?? 0) ? counts : null
}

/**
 * A set of n dots on the line that meets the goal, or null when none does. The same search
 * decides whether a goal is possible and builds the example: counts are tried smallest first
 * at the low values, which settles the dots into a tight cluster rather than a scatter.
 */
export function findSet(n: number, goal: Goal): number[] | null {
  const pinSets = pinOptions(n, goal.med2)
  const ks = goal.mode === undefined ? [0] : Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 2)
  const centre = goal.sum !== undefined ? goal.sum / n : goal.mode ?? (goal.med2 !== undefined ? goal.med2 / 2 : TOP / 2)
  const search = (lo: number, hi: number, ends: boolean): number[] | null => {
    for (const pins of pinSets) {
      for (const k of ks) {
        const counts = fill(n, goal, pins, k, lo, hi, ends)
        if (counts) return counts.flatMap((c, v) => Array<number>(c).fill(v))
      }
    }
    return null
  }
  if (goal.range !== undefined) {
    // The range fixes the lowest and highest dot; try the places for it nearest the other targets first.
    const r = goal.range
    const los = Array.from({ length: TOP - r + 1 }, (_, i) => i).sort((a, b) => Math.abs(a + r / 2 - centre) - Math.abs(b + r / 2 - centre) || a - b)
    for (const lo of los) {
      const found = search(lo, lo + r, true)
      if (found) return found
    }
    return null
  }
  // The decision, over the whole line; then, for an example a learner can read, the same search in a
  // narrow window round the targets, widening until one fits.
  const any = search(0, TOP, false)
  if (!any) return null
  for (const half of [2, 4, 7]) {
    const found = search(Math.max(0, Math.round(centre) - half), Math.min(TOP, Math.round(centre) + half), false)
    if (found) return found
  }
  return any
}

/** A set of dots that meets a make task, or null when there is none (faults() says why). */
export function makeSolution(t: MakeTask): number[] | null {
  const goal = makeGoal(t)
  return goal && t.count !== undefined ? findSet(t.count, goal) : null
}

export type MakeVerdict = { ok: boolean; complete: boolean; allSame: boolean; stats: Stats | null; unmet: Measure[] }

/** Whether a set of dots meets a make task, and which targets it misses. */
export function judgeMake(t: MakeTask, dots: readonly number[]): MakeVerdict {
  const n = t.count ?? 0
  const stats = dots.length ? statsOf(dots) : null
  const complete = n > 0 && dots.length === n
  const allSame = complete && stats !== null && stats.range === 0
  const unmet: Measure[] = []
  for (const m of namedTargets(t)) {
    let hit = false
    if (stats) {
      if (m === 'mean') {
        const r = ratOfDecimal(t.mean)
        hit = r !== null && cmpRat(stats.mean, r) === 0
      } else if (m === 'median') hit = stats.median2 === (t.median as number) * 2
      else if (m === 'mode') hit = stats.mode === t.mode
      else hit = stats.range === t.range
    }
    if (!hit) unmet.push(m)
  }
  return { ok: complete && !allSame && unmet.length === 0 && namedTargets(t).length > 0, complete, allSame, stats, unmet }
}

const NAME: Record<Measure, string> = { mean: 'mean', median: 'median', mode: 'mode', range: 'range' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "a mean of 6 and a mode of 0", for a sentence about the targets. */
export function targetsText(t: MakeTask): string {
  return namedTargets(t).map((m) => `a ${NAME[m]} of ${t[m]}`).join(' and ')
}

/** The targets as chips the card shows, never the working: "Mean: 6". */
export function targetChips(t: MakeTask): string[] {
  return namedTargets(t).map((m) => `${cap(NAME[m])}: ${t[m]}`)
}

export type Nearby = { task: MakeTask; dots: number[]; changed: Measure }

/** The values a target could take, nearest the one asked for first (the lower on a tie). */
function alternatives(t: MakeTask, m: Measure): number[] {
  const n = t.count as number
  const out: number[] = []
  const nearest = (start: number, step: number, ok: (v: number) => boolean, lo: number, hi: number) => {
    out.push(...[start])
    for (let d = step; d <= hi - lo; d += step) {
      for (const v of [start - d, start + d]) if (v >= lo && v <= hi) out.push(v)
    }
    return out.filter(ok)
  }
  if (m === 'mean') {
    const want = Number.isFinite(t.mean) ? Math.max(0, Math.min(TOP, t.mean as number)) : TOP / 2
    const s0 = Math.max(0, Math.min(TOP * n, Math.round(want * n)))
    return nearest(s0, 1, () => true, 0, TOP * n).map((s) => rat(s, n)).filter(terminates).map((r) => Number(fmtRat(r)))
  }
  if (m === 'median') {
    const odd = n % 2 === 1
    const w = Number.isFinite(t.median) ? Math.round((t.median as number) * 2) : TOP
    const s0 = odd && w % 2 !== 0 ? w - 1 : w
    return nearest(Math.max(0, Math.min(2 * TOP, s0)), odd ? 2 : 1, () => true, 0, 2 * TOP).map((x) => x / 2)
  }
  const lo = m === 'range' ? 1 : 0
  const v0 = Number.isFinite(t[m]) ? Math.max(lo, Math.min(TOP, Math.round(t[m] as number))) : lo
  return nearest(v0, 1, () => true, lo, TOP)
}

/** For a make task no dots can meet: the nearest change to one target (one for each) that dots can. */
export function nearbyMake(t: MakeTask): Nearby[] {
  const out: Nearby[] = []
  if (t.count === undefined) return out
  for (const m of namedTargets(t)) {
    for (const v of [...new Set(alternatives(t, m))]) {
      const task = { ...t, [m]: v } as MakeTask
      const dots = makeSolution(task)
      if (dots) {
        out.push({ task, dots, changed: m })
        break
      }
    }
  }
  return out
}

function makeProblems(t: MakeTask): string[] {
  if (t.unread?.length) return t.unread
  const n = t.count
  if (n === undefined) return [`Say how many dots to place: "count", from ${MIN_DOTS} to ${MAX_DOTS}, e.g. 7.`]
  if (!Number.isInteger(n)) return [`${n} dots is not a whole number. Use a whole number from ${MIN_DOTS} to ${MAX_DOTS}, e.g. 7.`]
  if (n < MIN_DOTS || n > MAX_DOTS) {
    return [`${n} dots is outside ${MIN_DOTS} to ${MAX_DOTS}: fewer makes the median, mode and range too easy to find by chance, and more does not fit a stack on the line. Use e.g. 7.`]
  }
  const names = namedTargets(t)
  if (names.length === 0) return ['Name one or two targets for the dots to meet: "mean", "median", "mode" or "range", e.g. "mean": 6.']
  if (names.length > 2) return [`${names.length} targets together (${listText(names)}) is more than one card sets: name one or two.`]
  const out: string[] = []
  if (t.mean !== undefined) {
    const r = ratOfDecimal(t.mean)
    if (!r) out.push(`A mean of ${t.mean} cannot be set: give a number of at most three decimal places, e.g. 6.5.`)
    else if (r.n > TOP * r.d) out.push(`A mean of ${t.mean} is off the line: the dots lie from 0 to ${TOP}, so the mean is between 0 and ${TOP}. Use e.g. 12.`)
    else if ((r.n * n) % r.d !== 0) {
      const total = `${fmtRat(rat(r.n * n, r.d))}`
      const fits = (c: number) => (r.n * c) % r.d === 0
      const otherCount = [5, 6, 7, 8, 9, 10].filter((c) => c !== n && fits(c)).sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b)[0]
      let below = Math.floor((r.n * n) / r.d)
      while (below > 0 && !terminates(rat(below, n))) below--
      let above = Math.ceil((r.n * n) / r.d)
      while (above < TOP * n && !terminates(rat(above, n))) above++
      const means = [below, above].filter((x) => terminates(rat(x, n))).map((x) => fmtRat(rat(x, n)))
      const use = [
        ...(means.length ? [`a mean of ${listText([...new Set(means)]).replace(/, ([^,]*)$/, ' or $1')} with ${n} dots`] : []),
        ...(otherCount !== undefined ? [`${otherCount} dots with a mean of ${t.mean}`] : []),
      ]
      out.push(`A mean of ${t.mean} from ${n} dots needs a total of ${total}, but dots are whole numbers, so their total is whole.${use.length ? ` Use e.g. ${use.join(', or ')}.` : ''}`)
    }
  }
  if (t.median !== undefined) {
    const twice = t.median * 2
    if (!Number.isFinite(twice) || !Number.isInteger(twice)) out.push(`A median of ${t.median} cannot happen: the median of whole-number dots is a whole number or a half. Use e.g. 6 or 6.5.`)
    else if (twice < 0 || twice > 2 * TOP) out.push(`A median of ${t.median} is off the line (0 to ${TOP}). Use e.g. 9.`)
    else if (n % 2 === 1 && twice % 2 !== 0) {
      out.push(`A median of ${t.median} cannot happen with ${n} dots: with an odd number the median is one of the dots, so a whole number. Use ${Math.floor(t.median)} or ${Math.ceil(t.median)}, or an even number of dots (${n - 1} or ${Math.min(MAX_DOTS, n + 1)}).`)
    }
  }
  if (t.mode !== undefined && !isDot(t.mode)) out.push(`A mode of ${t.mode} is not a place on the line: the dots sit on whole numbers from 0 to ${TOP}. Use e.g. 7.`)
  if (t.range !== undefined) {
    if (!Number.isInteger(t.range)) out.push(`A range of ${t.range} is not a whole number: the dots sit on whole numbers. Use e.g. 9.`)
    else if (t.range < 1) out.push('A range of 0 puts every dot on one value, so there is nothing to compare. Use 1 or more, e.g. 9.')
    else if (t.range > TOP) out.push(`A range of ${t.range} is wider than the line (0 to ${TOP}). Use ${TOP} or less, e.g. 9.`)
  }
  if (out.length) return out
  const goal = makeGoal(t)
  if (!goal) return ['These targets cannot be set on the line.']
  if (findSet(n, goal)) return []
  const near = nearbyMake(t).map((x) => `${targetsText(x.task)} (dots ${listText(x.dots)})`)
  return [
    `No ${n} dots on the 0 to ${TOP} line have ${targetsText(t)}, with the dots not all on one value.${near.length ? ` Use e.g. ${near.join(', or ')}.` : ' Use different targets.'}`,
  ]
}

/** The lines a make card says once marked. Never called before: they name what was made. */
export function makeSaid(t: MakeTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const n = t.count ?? 0
  const dots = readDots(state)
  const v = judgeMake(t, dots)
  const s = v.stats
  const made = (x: Stats) => `mean ${fmtRat(x.mean)}, median ${fmtMedian(x.median2)}, mode ${modeWords(x)}, range ${x.range}`
  if (marked !== 'wrong') {
    if (!s) return []
    const lines = [`Your dots have ${made(s)}.`]
    for (const m of namedTargets(t)) {
      if (m === 'mean') lines.push(`Mean: total ${s.sum} ÷ ${n} dots = ${fmtRat(s.mean)}.`)
      else if (m === 'median') lines.push(`Median: the middle of ${listText([...dots].sort(asc))} is ${fmtMedian(s.median2)}.`)
      else if (m === 'mode') lines.push(`Mode: ${s.mode} has the most dots (${s.most}).`)
      else lines.push(`Range: ${s.max} − ${s.min} = ${s.range}.`)
    }
    lines.push(`Different sets of dots can share the same ${namedTargets(t).join(' and ')}.`)
    return lines
  }
  if (!dots.length) return [`No dots are placed yet. Place ${n} dots on the line, then check.`]
  if (!v.complete || !s) return [`You have placed ${dots.length} of ${n} dots. Place all ${n}, then check.`]
  const lines = [`You made ${made(s)}.`]
  if (v.allSame) lines.push('Every dot is on the same value, so there is nothing to compare. Use at least two different values.')
  for (const m of v.unmet) {
    if (m === 'mean') {
      const r = ratOfDecimal(t.mean) as Rat
      lines.push(`The mean needs to be ${fmtRat(r)}. ${n} dots with that mean total ${fmtRat(rat(r.n * n, r.d))}; yours total ${s.sum}.`)
    } else if (m === 'median') {
      lines.push(`The median needs to be ${fmtMedian((t.median as number) * 2)}: the middle value when the dots are in order. Yours is ${fmtMedian(s.median2)}.`)
    } else if (m === 'mode') {
      lines.push(`The mode needs to be ${t.mode}: the value with the most dots. ${s.mode !== null ? `Yours is ${s.mode}.` : s.most === 1 ? 'In yours no value has more dots than another, so there is no mode.' : `In yours ${s.tied.join(' and ')} tie for the most dots, so there is no single mode.`}`)
    } else {
      lines.push(`The range needs to be ${t.range}: the highest dot minus the lowest. Yours is ${s.range} (from ${s.min} to ${s.max}).`)
    }
  }
  return lines
}

// ---------------------------------------------------------------------------
// predict: one change to a data set.

export const P_MEASURES = ['mean', 'median', 'range'] as const
export type PMeasure = (typeof P_MEASURES)[number]
export type Move = 'up' | 'same' | 'down'
export const MOVES: readonly Move[] = ['up', 'same', 'down']
export const MOVE_WORDS: Record<Move, string> = { up: 'goes up', same: 'stays the same', down: 'goes down' }
export type PChange = { kind: 'add'; value: number } | { kind: 'remove'; value: number } | { kind: 'move'; from: number; to: number }
export type PredictTask = { kind: 'predict'; values: number[]; change?: PChange; measures: PMeasure[]; unread?: string[] }

/** The data after the change. A move shifts one dot of its value; a remove takes one. */
export function applyChange(values: readonly number[], c: PChange): number[] {
  const v = [...values]
  if (c.kind === 'add') v.push(c.value)
  else if (c.kind === 'remove') {
    const i = v.indexOf(c.value)
    if (i >= 0) v.splice(i, 1)
  } else {
    const i = v.indexOf(c.from)
    if (i >= 0) v[i] = c.to
  }
  return v.sort(asc)
}

export type Outcome = { measure: PMeasure; before: string; after: string; move: Move }

/** What the change does to each measure asked: exact, from the fractions and doubled medians. */
export function outcomes(t: PredictTask): Outcome[] | null {
  if (!t.change || t.values.length < 1) return null
  const after = applyChange(t.values, t.change)
  if (after.length < 1) return null
  const a = statsOf(t.values)
  const b = statsOf(after)
  const sign = (x: number): Move => (x > 0 ? 'up' : x < 0 ? 'down' : 'same')
  return t.measures.map((measure) => {
    if (measure === 'mean') return { measure, before: fmtRat(a.mean), after: fmtRat(b.mean), move: sign(cmpRat(b.mean, a.mean)) }
    if (measure === 'median') return { measure, before: fmtMedian(a.median2), after: fmtMedian(b.median2), move: sign(b.median2 - a.median2) }
    return { measure, before: `${a.range}`, after: `${b.range}`, move: sign(b.range - a.range) }
  })
}

export type Answers = Partial<Record<PMeasure, Move>>

/** A saved state's answers, read safely. */
export function readAnswers(raw: unknown): Answers {
  const a = (raw as { answers?: unknown } | null)?.answers
  const out: Answers = {}
  if (!a || typeof a !== 'object') return out
  for (const m of P_MEASURES) {
    const v = (a as Record<string, unknown>)[m]
    if (v === 'up' || v === 'same' || v === 'down') out[m] = v
  }
  return out
}

/** The change in words, as the card states it. */
export function changeText(c: PChange): string {
  if (c.kind === 'add') return `a new value, ${c.value}, is added`
  if (c.kind === 'remove') return `one dot, at ${c.value}, is taken away`
  return `one dot moves from ${c.from} to ${c.to}`
}

function lessonOf(t: PredictTask, outs: Outcome[]): string {
  const by = (m: PMeasure) => outs.find((o) => o.measure === m)?.move
  if (by('mean') && by('mean') !== 'same' && by('median') === 'same') {
    return 'The median only depends on the middle of the data, so it can stay put when a value changes; the mean uses every value, so any change to a value moves it.'
  }
  if (by('mean') === 'same') return 'Adding a value equal to the mean leaves the mean where it was: the total and the count grow in the same proportion.'
  if (by('range') === 'same' && t.measures.includes('range')) return 'The range only depends on the highest and lowest values, so a change between them leaves it alone.'
  return 'Each measure answers a different question: the mean uses every value, the median only the middle, the range only the two ends.'
}

/** The lines a predict card says once marked. Never called before: they hold every before and after. */
export function predictSaid(t: PredictTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const outs = outcomes(t)
  if (!outs) return []
  const given = readAnswers(state)
  const lines: string[] = []
  for (const o of outs) {
    const label = cap(o.measure)
    const fact = `${o.before} to ${o.after}, so it ${MOVE_WORDS[o.move]}`
    const said = given[o.measure]
    if (marked !== 'wrong' || said === o.move) lines.push(`${label}: ${fact}.`)
    else lines.push(`${label}: you said it ${said ? MOVE_WORDS[said] : 'was not answered'}, but it goes ${o.before} to ${o.after}, so it ${MOVE_WORDS[o.move]}.`)
  }
  lines.push(lessonOf(t, outs))
  return lines
}

function predictProblems(t: PredictTask): string[] {
  if (t.unread?.length) return t.unread
  const v = t.values
  if (v.length < MIN_VALUES || v.length > MAX_VALUES) {
    return [`"values" has ${v.length}: a data set of ${MIN_VALUES} to ${MAX_VALUES} values (one more may be added, and the line holds ${MAX_DOTS} in a stack). Use e.g. [3, 5, 5, 6, 8, 9].`]
  }
  const bad = v.find((x) => !isDot(x))
  if (bad !== undefined) return [`${bad} is not a whole number from 0 to ${TOP}, which is the line every value sits on.`]
  const c = t.change
  if (!c) return ['Say the change: "change": { "kind": "add", "value": 18 }, or "remove" with a "value", or "move" with a "from" and a "to".']
  if (t.measures.length === 0) return ['"measures" is empty: ask for any of mean, median and range.']
  if (c.kind === 'add') {
    if (!isDot(c.value)) return [`The value added, ${c.value}, is not a whole number from 0 to ${TOP}.`]
  } else if (c.kind === 'remove') {
    if (!v.includes(c.value)) return [`There is no dot at ${c.value} to take away. Take away one of ${listText([...new Set(v)].sort(asc))}.`]
  } else {
    if (!v.includes(c.from)) return [`There is no dot at ${c.from} to move. Move one of ${listText([...new Set(v)].sort(asc))}.`]
    if (!isDot(c.to)) return [`A dot cannot move to ${c.to}: it must land on a whole number from 0 to ${TOP}.`]
    if (c.to === c.from) return [`The dot moves from ${c.from} to ${c.to}, which is nowhere. Move it to a different value.`]
  }
  const outs = outcomes(t)
  if (!outs) return ['This change cannot be shown.']
  if (outs.every((o) => o.move === 'same')) {
    const tries = (c.kind === 'add' ? [TOP, 0, Math.max(...v) + 3, Math.min(...v) - 3] : c.kind === 'remove' ? [...v] : [TOP, 0, Math.max(...v) + 3])
      .filter((x, i, a) => isDot(x) && a.indexOf(x) === i)
    const alt = (x: number): PredictTask => ({ ...t, change: c.kind === 'move' ? { kind: 'move', from: c.from, to: x } : c.kind === 'add' ? { kind: 'add', value: x } : { kind: 'remove', value: x } })
    const eg = tries.find((x) => x !== (c.kind === 'move' ? c.to : c.value) && outcomes(alt(x))?.some((o) => o.move !== 'same'))
    const sayEg = eg === undefined ? '' : c.kind === 'move' ? `, e.g. move ${c.from} to ${eg}` : `, e.g. ${c.kind} ${eg}`
    return [`With these values the change leaves ${t.measures.length === 1 ? `the ${t.measures[0]}` : `the ${listText(t.measures)}`} exactly where ${t.measures.length === 1 ? 'it is' : 'they are'}, so the answer is "stays the same" for everything asked and nothing is learned. Change something that moves at least one of them${sayEg}.`]
  }
  return []
}

// ---------------------------------------------------------------------------
// choose: the engine's own situations, one textbook answer each.

export const AVERAGES = ['mean', 'median', 'mode'] as const
export type Average = (typeof AVERAGES)[number]
export type ChooseTask = { kind: 'choose'; context: string; unread?: string[] }
export type Axis = { min: number; max: number; step: number; labelEvery: number }

/** Why each average suits a situation, in words that fit any of them. */
export const REASONS: Record<Average, string> = {
  mean: 'It uses every value, and is the amount each would get if the total were shared out equally.',
  median: 'It is the middle value, so one very high or very low value cannot drag it away.',
  mode: 'It is the value that happens most often.',
}

export type Scenario = {
  id: string
  /** The ways a tutor might name it. */
  words: string[]
  title: string
  setting: string
  /** What the values are, for the axis and a sentence. */
  thing: string
  /** The commonest value, in a sentence: "The most common shoe size is 8". */
  common?: string
  axis: Axis
  values: number[]
  answer: Average
  /** Values are thousands of pounds. */
  money?: boolean
}

// Each scenario's numbers are chosen so its answer is the textbook one and no other is arguable;
// the tests recheck the mode, the pull of the extreme value and the equal share against the data.
export const SCENARIOS: Scenario[] = [
  {
    id: 'shoe-sizes', words: ['shoe-sizes', 'shoe-size', 'shoes', 'shoe-shop'], title: 'Shoe sizes', thing: 'UK shoe size', common: 'shoe size', answer: 'mode',
    setting: 'A shoe shop wrote down the UK size of every pair it sold last week. The manager must decide which size to order the most of.',
    axis: { min: 3, max: 12, step: 1, labelEvery: 1 }, values: [4, 5, 5, 6, 6, 7, 8, 8, 8, 8, 9, 10],
  },
  {
    id: 'table-sizes', words: ['table-sizes', 'table-size', 'group-sizes', 'restaurant', 'tables'], title: 'Group sizes', thing: 'people at a table', common: 'number of people at a table', answer: 'mode',
    setting: 'A restaurant counted the people at each of 12 tables on a busy night. It will build more tables of the group size that comes up most often.',
    axis: { min: 1, max: 8, step: 1, labelEvery: 1 }, values: [2, 2, 2, 2, 2, 3, 3, 4, 4, 5, 6, 7],
  },
  {
    id: 'house-prices', words: ['house-prices', 'house-price', 'houses', 'prices', 'property'], title: 'House prices', thing: 'price (£000s)', answer: 'median', money: true,
    setting: 'Eight houses on one street were sold this year. An estate agent wants one price to tell a new customer what a house on this street usually sells for.',
    axis: { min: 100, max: 500, step: 20, labelEvery: 5 }, values: [160, 180, 180, 200, 200, 220, 220, 500],
  },
  {
    id: 'salaries', words: ['salaries', 'salary', 'pay', 'wages', 'earnings'], title: 'Pay at a small firm', thing: 'yearly pay (£000s)', answer: 'median', money: true,
    setting: 'Eight people work at a small firm. The firm wants to advertise what a worker there typically earns in a year.',
    axis: { min: 20, max: 100, step: 5, labelEvery: 2 }, values: [20, 25, 25, 30, 30, 35, 35, 100],
  },
  {
    id: 'pocket-money', words: ['pocket-money', 'sharing-money', 'sharing', 'savings'], title: 'Sharing pocket money', thing: 'pocket money (£)', answer: 'mean',
    setting: 'Five friends put all their pocket money into one pot. They will share it out so that each person gets the same amount.',
    axis: { min: 0, max: 15, step: 1, labelEvery: 1 }, values: [3, 5, 6, 8, 13],
  },
  {
    id: 'team-goals', words: ['team-goals', 'goals', 'hockey', 'matches'], title: 'Goals in a match', thing: 'goals in a match', answer: 'mean',
    setting: 'A hockey team scored these goals in its last 6 matches. The coach wants to know how many goals it would have scored in each match if it had scored the same number every time.',
    axis: { min: 0, max: 8, step: 1, labelEvery: 1 }, values: [1, 2, 2, 3, 4, 6],
  },
]

export const scenarioOf = (t: ChooseTask): Scenario | null => SCENARIOS.find((s) => s.id === t.context) ?? null

/** A value of a scenario as it is said: "£200k" for pay and prices, the plain number otherwise. */
export const scenarioValue = (s: Scenario, text: string): string => (s.money ? `£${text}k` : text)

export type Choice = { average: Average | ''; reason: Average | '' }

/** A saved state's choice, read safely. */
export function readChoice(raw: unknown): Choice {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = (v: unknown): Average | '' => (v === 'mean' || v === 'median' || v === 'mode' ? v : '')
  return { average: pick(o.average), reason: pick(o.reason) }
}

/** What is true of a scenario's data, worked out from the data. */
export function scenarioFacts(s: Scenario) {
  const st = statsOf(s.values)
  const meanText = scenarioValue(s, fmtRat(st.mean))
  const medianText = scenarioValue(s, fmtMedian(st.median2))
  const modeText = st.mode !== null ? scenarioValue(s, `${st.mode}`) : null
  // The value furthest from the median, and how many values the mean sits above (or below) as a result.
  const far = [...s.values].sort((a, b) => Math.abs(b * 2 - st.median2) - Math.abs(a * 2 - st.median2) || b - a)[0]
  const pulledUp = far * 2 > st.median2
  const beaten = s.values.filter((v) => (pulledUp ? cmpRat(rat(v), st.mean) < 0 : cmpRat(rat(v), st.mean) > 0)).length
  return { st, meanText, medianText, modeText, far, pulledUp, beaten }
}

function becauseText(s: Scenario): string {
  const f = scenarioFacts(s)
  const n = s.values.length
  if (s.answer === 'mode') {
    return `The most common ${s.common ?? s.thing} is ${scenarioValue(s, `${f.st.mode}`)}, with ${f.st.most} of the ${n}. The mean (${f.meanText}) and the median (${f.medianText}) find the middle of the data, not the value that comes up most.`
  }
  if (s.answer === 'median') {
    return `The extreme value ${scenarioValue(s, `${f.far}`)} pulls the mean ${f.pulledUp ? 'up' : 'down'} to ${f.meanText}, ${f.pulledUp ? 'higher' : 'lower'} than ${f.beaten} of the ${n} values. The median, ${f.medianText}, is the middle value, so it stays with the rest.`
  }
  return `${n} values totalling ${scenarioValue(s, `${f.st.sum}`)}, shared out equally, give ${f.meanText} each. The median (${f.medianText}) and the mode (${f.modeText ?? 'none: no value has more than the others'}) do not use every value, so neither is the equal share.`
}

/** The lines a choose card says once marked. Never called before: they name the best average and why. */
export function chooseSaid(t: ChooseTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const s = scenarioOf(t)
  if (!s) return []
  const c = readChoice(state)
  const lines: string[] = []
  if (marked === 'wrong') {
    if (!c.average || !c.reason) return ['Choose an average and a reason, then check.']
    if (c.average !== s.answer) lines.push(`You chose the ${c.average}. The best average here is the ${s.answer}.`)
    else lines.push(`The ${s.answer} is the best average here.`)
    if (c.reason !== s.answer) {
      lines.push(`The reason you chose describes the ${c.reason}: "${REASONS[c.reason]}" The ${s.answer}'s reason is: "${REASONS[s.answer]}"`)
    }
  } else {
    lines.push(`The ${s.answer} is the best average here.`, `Why: ${REASONS[s.answer]}`)
  }
  lines.push(becauseText(s))
  return lines
}

function chooseProblems(t: ChooseTask): string[] {
  if (t.unread?.length) return t.unread
  return scenarioOf(t) ? [] : [`"${t.context}" is not a situation this scene has. Use one of: ${SCENARIOS.map((s) => `"${s.id}"`).join(', ')}.`]
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

export type Task = MakeTask | PredictTask | ChooseTask
export type StatsExplorerConfig = { task: Task }

/**
 * make: the dots placed, sorted. predict: the answers by measure. choose: the
 * average and the reason picked.
 */
export type StatsExplorerState = { dots?: number[]; answers?: Answers; average?: Average | ''; reason?: Average | '' }

function readNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string' && /^\s*[-−–]?\d+(?:\.\d+)?\s*$/.test(raw)) return Number(raw.replace(/[−–]/g, '-')) + 0
  return null
}

const KIND_WORDS: Record<string, Task['kind']> = {
  'make': 'make', 'build': 'make', 'make-data': 'make', 'build-data': 'make', 'make-a-data-set': 'make', 'build-a-data-set': 'make', 'create': 'make', 'construct': 'make',
  'predict': 'predict', 'prediction': 'predict', 'what-happens': 'predict', 'effect': 'predict', 'change': 'predict',
  'choose': 'choose', 'choose-average': 'choose', 'choose-the-average': 'choose', 'which-average': 'choose', 'best-average': 'choose', 'pick': 'choose', 'select': 'choose',
}
const ADD_WORDS = ['add', 'added', 'insert', 'new', 'new-value', 'add-a-value', 'extra', 'append']
const REMOVE_WORDS = ['remove', 'removed', 'delete', 'drop', 'take-away', 'remove-a-value', 'leave-out']
const MOVE_KIND_WORDS = ['move', 'change', 'replace', 'alter', 'change-a-value', 'shift', 'edit']
const DOUBLE_WORDS = ['double-largest', 'double-the-largest', 'double-largest-value', 'double-the-largest-value', 'double-max', 'double-the-maximum']

function readList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw.slice(0, 40)
  if (typeof raw === 'string') return raw.split(/[\s,;]+/).filter(Boolean).slice(0, 40)
  return null
}

function parseChange(raw: unknown, values: number[], unread: string[]): PChange | undefined {
  if (raw === undefined) return undefined
  if (!raw || typeof raw !== 'object') {
    unread.push('"change" should be an object, e.g. { "kind": "add", "value": 18 }.')
    return undefined
  }
  const c = raw as Record<string, unknown>
  const kind = typeof (c.kind ?? c.type) === 'string' ? slug((c.kind ?? c.type) as string) : ''
  if (DOUBLE_WORDS.includes(kind)) {
    if (!values.length) return undefined
    const top = Math.max(...values)
    return { kind: 'move', from: top, to: top * 2 }
  }
  const num = (keys: string[], what: string): number | undefined => {
    const x = first(c, keys)
    if (x === undefined) {
      unread.push(`the change needs a ${what}.`)
      return undefined
    }
    const v = readNum(x)
    if (v === null) unread.push(`"${what}" in the change is not a number.`)
    return v ?? undefined
  }
  if (ADD_WORDS.includes(kind)) {
    const value = num(['value', 'new', 'add', 'to'], '"value"')
    return value === undefined ? undefined : { kind: 'add', value }
  }
  if (REMOVE_WORDS.includes(kind)) {
    const value = num(['value', 'remove', 'from'], '"value"')
    return value === undefined ? undefined : { kind: 'remove', value }
  }
  if (MOVE_KIND_WORDS.includes(kind)) {
    const from = num(['from', 'old', 'value'], '"from"')
    const to = num(['to', 'new', 'newValue'], '"to"')
    return from === undefined || to === undefined ? undefined : { kind: 'move', from, to }
  }
  unread.push(`the change kind ${JSON.stringify(c.kind ?? c.type)} is not one of: add, remove, move, double-largest.`)
  return undefined
}

export function parseTask(raw: unknown): StatsExplorerConfig | null {
  const holder = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { task?: unknown }) : null
  const task = holder?.task ?? (holder && ('kind' in holder || 'values' in holder || 'context' in holder) ? holder : null)
  if (!task || typeof task !== 'object') return null
  const t = task as Record<string, unknown>
  const unread: string[] = []

  let kind: Task['kind'] | null = null
  if (t.kind !== undefined) {
    const key = typeof t.kind === 'string' ? slug(t.kind) : ''
    kind = own(KIND_WORDS, key) ? KIND_WORDS[key] : null
    if (!kind) unread.push(`kind ${JSON.stringify(t.kind)} is not one of: make, predict, choose.`)
  }
  if (!kind) kind = 'values' in t ? 'predict' : 'context' in t ? 'choose' : 'make'

  if (kind === 'choose') {
    const ctx = first(t, ['context', 'scenario', 'situation', 'setting', 'topic', 'data'])
    const key = typeof ctx === 'string' ? slug(ctx) : ''
    const hit = SCENARIOS.find((s) => s.id === key || s.words.includes(key))
    if (ctx === undefined) unread.push(`the task needs a "context": one of ${SCENARIOS.map((s) => `"${s.id}"`).join(', ')}.`)
    else if (!hit) unread.push(`context ${JSON.stringify(ctx)} is not a situation this scene has. Use one of: ${SCENARIOS.map((s) => `"${s.id}"`).join(', ')}.`)
    return { task: { kind, context: hit?.id ?? (typeof ctx === 'string' ? ctx : ''), ...(unread.length ? { unread } : {}) } }
  }

  if (kind === 'predict') {
    const values: number[] = []
    const items = readList(first(t, ['values', 'data', 'numbers', 'dots', 'list']))
    if (!items) unread.push('the task needs "values": a list of whole numbers, e.g. [3, 5, 5, 6, 8, 9].')
    else {
      for (const item of items) {
        const v = readNum(item)
        if (v === null) unread.push(`${JSON.stringify(item)} in values is not a number.`)
        else values.push(v)
      }
    }
    const change = parseChange(first(t, ['change', 'edit', 'then', 'alteration']), values, unread)
    const measures: PMeasure[] = []
    const asked = first(t, ['measures', 'ask', 'asks', 'measure'])
    if (asked === undefined) measures.push(...P_MEASURES)
    else {
      for (const m of readList(asked) ?? []) {
        const key = typeof m === 'string' ? slug(m) : ''
        if ((P_MEASURES as readonly string[]).includes(key)) {
          if (!measures.includes(key as PMeasure)) measures.push(key as PMeasure)
        } else unread.push(`measure ${JSON.stringify(m)} is not one of: mean, median, range.`)
      }
    }
    return { task: { kind, values, ...(change ? { change } : {}), measures, ...(unread.length ? { unread } : {}) } }
  }

  // make: targets may sit in the task or in a "targets" object.
  const nested = t.targets && typeof t.targets === 'object' ? (t.targets as Record<string, unknown>) : {}
  const out: MakeTask = { kind: 'make' }
  const countRaw = first(t, ['count', 'dots', 'n', 'size', 'number_of_dots', 'numberOfDots'])
  if (countRaw !== undefined) {
    const v = readNum(countRaw)
    if (v === null) unread.push(`"count" ${JSON.stringify(countRaw)} is not a number: use a whole number from ${MIN_DOTS} to ${MAX_DOTS}.`)
    else out.count = v
  }
  if ('values' in t) unread.push('"values" is not used by a make task: name the targets (mean, median, mode, range) and "count", and leave the dots to the learner.')
  for (const m of MAKE_MEASURES) {
    const x = first({ ...nested, ...t }, [m])
    if (x === undefined) continue
    const v = readNum(x)
    if (v === null) unread.push(`${m} ${JSON.stringify(x)} is not a number.`)
    else out[m] = v
  }
  if (unread.length) out.unread = unread
  return { task: out }
}

// ---------------------------------------------------------------------------
// The card's prompt.

const numbersIn = (text: string): number[] => [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

function makePromptFaults(t: MakeTask, prompt: string): string[] {
  const out: string[] = []
  const goal = makeGoal(t)
  const n = t.count
  if (n !== undefined && goal) {
    // A list of numbers that is itself a set meeting the targets.
    const nums = numbersIn(prompt)
    for (let i = 0; i + n <= nums.length; i++) {
      const window = nums.slice(i, i + n)
      if (window.every(isDot) && judgeMake(t, window).ok) {
        out.push(`the prompt lists a set of dots that meets the targets (${listText(window)}), which the learner is to find: name the targets and leave the dots out.`)
        break
      }
    }
    if (goal.sum !== undefined) {
      const total = new RegExp(`\\btotal\\b[^.?!]{0,25}?(?<![\\d.])${goal.sum}(?![\\d]|\\.\\d)|(?<![\\d.])${goal.sum}(?![\\d]|\\.\\d)[^.?!]{0,12}\\btotal\\b`, 'i').exec(prompt)
      if (total) out.push(`the prompt gives the total the dots must have (${goal.sum}), which is the working the learner is to do: name the mean and leave the total out.`)
    }
    const counted = [...prompt.matchAll(/(\d+)\s*(?:dots|values|numbers|data\s*points|items)\b/gi)].map((m) => Number(m[1]))
    const wrong = counted.find((c) => c !== n)
    if (wrong !== undefined) out.push(`the prompt says ${wrong} dots, but the card sets ${n}: say ${n}, or leave the number to the card.`)
  }
  for (const m of namedTargets(t)) {
    for (const hit of prompt.matchAll(new RegExp(`\\b${m}\\b(?:\\s+(?:of|is|to be|equal to|=|:))?\\s*(?:the\\s+)?(\\d+(?:\\.\\d+)?)`, 'gi'))) {
      const said = Number(hit[1])
      if (said !== t[m]) {
        out.push(`the prompt says a ${m} of ${said}, but the card's target is ${t[m]}: make them agree, or leave the number to the card.`)
        break
      }
    }
  }
  return out
}

function predictPromptFaults(t: PredictTask, prompt: string): string[] {
  const out: string[] = []
  const outs = outcomes(t)
  if (!outs) return out
  const direction = /\b(?:go(?:es)?\s+up|rises?|increases?|go(?:es)?\s+down|falls?|decreases?|drops?|stays?\s+(?:the\s+same|put)|remains?\s+(?:the\s+same|unchanged)|does\s*n[o']t\s+change|doesn['’]t\s+change|unchanged)\b/gi
  for (const sentence of prompt.split(/(?<=[.!])\s+/)) {
    if (/\?/.test(sentence) || /\b(?:whether|if|or)\b/i.test(sentence)) continue
    const hit = sentence.match(direction)
    if (hit && /\b(?:mean|median|range|average)\b/i.test(sentence)) {
      out.push(`the prompt says what happens ("${hit[0]}"), which the learner is to predict: ask whether each measure goes up, goes down or stays the same.`)
      break
    }
  }
  const values = new Set(outs.map((o) => o.after.replace(/^about /, '')))
  for (const m of prompt.matchAll(/\b(?:new|now|after(?:wards)?|becomes?|will be)\b[^.?!]{0,30}?\b(?:mean|median|range)\b[^.?!]{0,25}?(\d+(?:\.\d+)?)/gi)) {
    if (values.has(m[1])) {
      out.push(`the prompt gives a value after the change (${m[1]}), which the card shows once marked: leave it out.`)
      break
    }
  }
  return out
}

function choosePromptFaults(t: ChooseTask, prompt: string): string[] {
  const s = scenarioOf(t)
  if (!s) return []
  const out: string[] = []
  const names = AVERAGES.filter((a) => new RegExp(`\\b${a}s?\\b`, 'i').test(prompt))
  if (names.includes(s.answer) && names.length < 2) {
    out.push(`the prompt names the ${s.answer}, which the learner is to choose: ask "which average?" without naming one, or name all three.`)
  }
  const hints: Record<Average, RegExp> = {
    median: /outliers?|extreme|unusual(?:ly)?\s+(?:high|large|big|low)|far\s+(?:from|above|below)|much\s+(?:higher|larger|bigger|more)\s+than\s+the\s+rest|\bskew/i,
    mode: /\bmost\s+(?:common|often|popular|frequent)|commonest|occurs?\s+most|happens?\s+most/i,
    mean: /\bshare[sd]?\b[^.?!]{0,15}\bequally|\bequal\s+share|\bfair\s+share|\bsame\s+(?:amount|number)\s+(?:each|every)/i,
  }
  const hit = hints[s.answer].exec(prompt)
  if (hit) out.push(`the prompt gives the reason away ("${hit[0]}"), which the learner is to spot in the data: ask which average and why, and leave the reason out.`)
  return out
}

// ---------------------------------------------------------------------------

export const statsExplorerEngine: SceneEngine<StatsExplorerConfig, StatsExplorerState> = {
  id: 'stats-explorer',
  // Phrases a station would use. Bare "range" would claim "Range of a function", and bare "average"
  // "Average speed": every topic needs its other word too.
  covers: [
    'mean, median and mode', 'mean and range', 'median and range', 'mode and range', 'averages and spread', 'averages and range',
    'comparing averages', 'choosing an average', 'calculating the mean', 'finding the median', 'finding the mode', 'outliers in data',
  ],
  // The learner changes the data and works out what follows for each measure.
  isolates: 'consequence',

  parse: parseTask,

  faults(config) {
    const t = config.task
    if (t.kind === 'make') return makeProblems(t)
    return t.kind === 'predict' ? predictProblems(t) : chooseProblems(t)
  },

  promptFaults(config, prompt) {
    const t = config.task
    if (t.unread?.length) return []
    if (t.kind === 'make') return makePromptFaults(t, prompt)
    return t.kind === 'predict' ? predictPromptFaults(t, prompt) : choosePromptFaults(t, prompt)
  },

  initial(config) {
    const t = config.task
    if (t.kind === 'make') return { dots: [] }
    if (t.kind === 'predict') return { answers: {} }
    return { average: '', reason: '' }
  },

  check(config, state) {
    const t = config.task
    if (t.unread?.length) return { ok: false, wrongIds: [] }
    if (t.kind === 'make') {
      const v = judgeMake(t, readDots(state))
      return { ok: v.ok, wrongIds: v.unmet }
    }
    if (t.kind === 'predict') {
      const outs = outcomes(t)
      const given = readAnswers(state)
      if (!outs || outs.length === 0) return { ok: false, wrongIds: [] }
      const wrong = outs.filter((o) => given[o.measure] !== o.move).map((o) => o.measure)
      return { ok: wrong.length === 0, wrongIds: wrong }
    }
    const s = scenarioOf(t)
    const c = readChoice(state)
    if (!s) return { ok: false, wrongIds: [] }
    const wrongIds = [...(c.average === s.answer ? [] : ['average']), ...(c.reason === s.answer ? [] : ['reason'])]
    return { ok: wrongIds.length === 0, wrongIds }
  },

  solve(config) {
    const t = config.task
    if (t.kind === 'make') return { dots: makeSolution(t) ?? [] }
    if (t.kind === 'predict') {
      const answers: Answers = {}
      for (const o of outcomes(t) ?? []) answers[o.measure] = o.move
      return { answers }
    }
    const s = scenarioOf(t)
    return { average: s?.answer ?? '', reason: s?.answer ?? '' }
  },

  View: StatsExplorerView,

  prompt: `SCENE "stats-explorer" -- averages and spread on a dot plot (one dot for each whole-number value, stacked where values
  repeat), for lower secondary and IGCSE Mathematics 0580. The engine does all the arithmetic exactly; you never write a mean, a
  total or an answer. Three tasks.
  "make": the card lists the targets (one or two of a mean, a median, a mode or a range) and how many dots, 5 to 10, on a line from
  0 to 20. The learner builds a data set that meets them: tap the line to add a dot, drag a dot to move it, tap a dot to take it off
  (or arrow keys and space). The plot draws the dots and shows no mean, median, mode or range of its own, nor a total; the card says
  what they made only when it is marked. The dots must not all sit on one value, and a mode means one value with more dots than any
  other. Impossible targets are refused, with a nearby set that works.
  "predict": the plot shows a data set with one change drawn in orange (a value added, one dot taken away, or one dot moved). For
  each measure asked (mean, median, range) the learner says whether it goes up, goes down or stays the same. The values before and
  after come when it is marked.
  "choose": a short real situation with its own data on the plot (you pick the situation; the engine owns the numbers). The learner
  picks the best average (mean, median or mode) and the reason that fits. Situations, each with one textbook answer:
  "shoe-sizes" and "table-sizes" (the aim is the most common value: mode), "house-prices" and "salaries" (one extreme value drags
  the mean away: median), "pocket-money" and "team-goals" (the total is shared out equally: mean).
  For: mean, median and mode; calculating the mean; finding the median; finding the mode; mean and range; averages and spread;
  choosing an average; outliers. Not for histograms, box plots, cumulative frequency, scatter graphs, frequency tables or grouped data.
  config: { "task": { "kind":"make", "count":<5-10>, "mean":<number>, "median":<number>, "mode":<whole number 0-20>, "range":<whole number 1-20> } }
            -- name one or two of mean, median, mode, range. The total (mean x count) must be whole, so mean 6.5 needs an even count;
            a median that is a half needs an even count; targets that no dots can meet together are refused with ones that work.
       or { "task": { "kind":"predict", "values":[<5 to 9 whole numbers, 0-20>], "change": <see below>, "measures":["mean","median","range"] } }
            -- change is { "kind":"add", "value":<0-20> }, { "kind":"remove", "value":<a value in the data> },
            { "kind":"move", "from":<a value in the data>, "to":<0-20> } or { "kind":"double-largest" } (the largest must be 10 or less).
            "measures" is optional (all three). The change must move at least one measure asked.
       or { "task": { "kind":"choose", "context":"<shoe-sizes | table-sizes | house-prices | salaries | pocket-money | team-goals>" } }
  - the prompt names the task and the targets. It never lists a set of dots that works, gives the total, says what a change does,
    or names the best average or why.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Place the dots to make a data set with a mean of 6 and a range of 8.",
    "payload": { "engine":"stats-explorer", "config": { "task": { "kind":"make", "count":6, "mean":6, "range":8 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stats-explorer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"One more value is added. Predict what happens to each measure.",
    "payload": { "engine":"stats-explorer", "config": { "task": { "kind":"predict", "values":[4, 5, 5, 6, 7, 8], "change": { "kind":"add", "value":19 } } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stats-explorer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Which average should the estate agent use, and why?",
    "payload": { "engine":"stats-explorer", "config": { "task": { "kind":"choose", "context":"house-prices" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stats-explorer", "why":"..." } }`,
}

registerEngine(statsExplorerEngine as SceneEngine<unknown, unknown>)
