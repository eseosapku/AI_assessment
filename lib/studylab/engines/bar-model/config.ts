// lib/studylab/engines/bar-model/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { BarModelView } from './View'

// One bar a hand can cut and fill (the bar model of Singapore primary maths; Mathigon/Polypad fraction bars). All marking is
// whole-number arithmetic: a/b is compared with c/d by a*d against c*b, never as a float.
//
// Three tasks:
//   match -- a given bar shows n of d parts; cut a second, equal bar into `into` parts and shade it to the same length.
//   part  -- a bar worth an amount; cut and shade it to show a fraction or percentage of the amount; the worth appears once marked.
//   share -- a bar worth an amount; cut it into equal parts and give parts to two people in a ratio.

export const MAX_PIECES = 12
export const MAX_AMOUNT = 10000
export const NAME_MAX = 12
export const UNIT_MAX = 14

export type BarModelConfig =
  | { task: 'match'; n: number; d: number; into: number }
  | { task: 'part'; n: number; d: number; amount: number; unit: string }
  | { task: 'share'; amount: number; unit: string; a: number; b: number; names: [string, string] }

/** pieces: how many equal parts the learner's bar is cut into; shaded: filled from the left; owners[i]: 0 none, 1 or 2 for a person. */
export type BarModelState = { pieces?: number; shaded?: number; owners?: number[] }

// ---------------------------------------------------------------------------
// Exact arithmetic.

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
export const reduce = (n: number, d: number) => {
  const g = gcd(n, d) || 1
  return { n: n / g, d: d / g }
}
/** Compare s/p with n/d exactly: -1 shorter, 0 equal, 1 longer. */
export const compare = (s: number, p: number, n: number, d: number) => Math.sign(s * d - n * p)

export const fmtNum = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100))
export const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
export const money = (x: number, unit: string) => `${fmtNum(x)}${unit ? ` ${unit}` : ''}`

export const clampPieces = (v: unknown) => (isInt(v) ? Math.max(1, Math.min(MAX_PIECES, v)) : 1)
export const clampShaded = (v: unknown, pieces: number) => (isInt(v) ? Math.max(0, Math.min(pieces, v)) : 0)
export function ownersOf(state: BarModelState | undefined): number[] {
  const o = Array.isArray(state?.owners) ? state!.owners! : []
  return Array.from({ length: MAX_PIECES }, (_, i) => (o[i] === 1 || o[i] === 2 ? o[i] : 0))
}

/** The shaded count that matches n/d on a bar of `pieces`, or null when the bar cannot show it. */
export const shadedFor = (n: number, d: number, pieces: number): number | null => ((n * pieces) % d === 0 ? (n * pieces) / d : null)

// ---------------------------------------------------------------------------
// The words said back. Numbers appear only once marked.

const parts = (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`

export function describeBar(pieces: number, shaded: number): string {
  return `cut into ${pieces} equal ${pieces === 1 ? 'part' : 'parts'}, ${shaded} shaded`
}

const relation = (c: number) => (c === 0 ? 'the same length as' : c < 0 ? 'shorter than' : 'longer than')

export function madeMatch(config: Extract<BarModelConfig, { task: 'match' }>, state: BarModelState): string {
  const p = clampPieces(state?.pieces)
  const s = clampShaded(state?.shaded, p)
  const c = compare(s, p, config.n, config.d)
  const made = `You cut it into ${parts(p)} and shaded ${s}: ${s}/${p} of the bar, ${relation(c)} ${config.n}/${config.d}.`
  return c === 0 && p !== config.into ? `${made} The lengths match, but the card asked for ${config.into} parts.` : made
}

export function workingMatch(config: Extract<BarModelConfig, { task: 'match' }>): string {
  const k = (config.n * config.into) / config.d
  return `${config.n}/${config.d} and ${k}/${config.into} are the same length: cutting each part into ${config.into / config.d} smaller parts gives ${config.into / config.d} times as many parts, and ${config.into / config.d} times as many are shaded.`
}

const worthOf = (amount: number, s: number, p: number) => (amount * s) / p

export function madePart(config: Extract<BarModelConfig, { task: 'part' }>, state: BarModelState): string {
  const p = clampPieces(state?.pieces)
  const s = clampShaded(state?.shaded, p)
  const c = compare(s, p, config.n, config.d)
  const w = money(worthOf(config.amount, s, p), config.unit)
  return `You cut it into ${parts(p)} and shaded ${s}: ${s}/${p} of ${money(config.amount, config.unit)}, which is ${w}, ${c === 0 ? 'the right length' : c < 0 ? 'too little' : 'too much'}.`
}

export function workingPart(config: Extract<BarModelConfig, { task: 'part' }>, state: BarModelState): string {
  const p = clampPieces(state?.pieces)
  const s = clampShaded(state?.shaded, p)
  const total = money(config.amount, config.unit)
  const value = money(worthOf(config.amount, s, p), config.unit)
  if (config.amount % p === 0) return `Each part is ${fmtNum(config.amount / p)} (${total} in ${parts(p)}). ${s} ${s === 1 ? 'part is' : 'parts are'} ${s} × ${fmtNum(config.amount / p)} = ${value}.`
  return `${s}/${p} of ${total} is ${value}.`
}

export function madeShare(config: Extract<BarModelConfig, { task: 'share' }>, state: BarModelState): string {
  const p = clampPieces(state?.pieces)
  const o = ownersOf(state).slice(0, p)
  const one = o.filter((v) => v === 1).length
  const two = o.filter((v) => v === 2).length
  const [x, y] = config.names
  const left = p - one - two
  const gave = `You cut it into ${parts(p)} and gave ${x} ${parts(one)} and ${y} ${parts(two)}${left > 0 ? `, with ${parts(left)} not given out` : ''}.`
  if (left === 0 && p % (config.a + config.b) === 0 && one * (config.a + config.b) !== config.a * p) return `${gave} That is ${one}:${two}.`
  return gave
}

export function workingShare(config: Extract<BarModelConfig, { task: 'share' }>, state: BarModelState): string {
  const total = config.a + config.b
  const k = clampPieces(state?.pieces) / total
  const [x, y] = config.names
  const unit = config.amount / total
  return `${config.a}:${config.b} makes ${total} equal parts, each worth ${fmtNum(config.amount / clampPieces(state?.pieces))} (${money(config.amount, config.unit)} shared into ${clampPieces(state?.pieces)}). ${x} gets ${config.a * k} parts, ${money(unit * config.a, config.unit)}. ${y} gets ${config.b * k} parts, ${money(unit * config.b, config.unit)}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readTask(raw: unknown): BarModelConfig['task'] | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '')
  const alias: Record<string, BarModelConfig['task']> = {
    match: 'match', equivalent: 'match', 'equivalent-fractions': 'match', same: 'match', 'make-the-same': 'match',
    part: 'part', 'part-of': 'part', fraction: 'part', percentage: 'part', percent: 'part', 'fraction-of': 'part', 'percentage-of': 'part', 'of-an-amount': 'part',
    share: 'share', ratio: 'share', sharing: 'share', 'share-in-a-ratio': 'share',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readInt(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(/,/g, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6 ? v + 0 : null
}

/** "2/3", "two thirds" is not read; "30%", 30 percent as { percent }. */
function readFraction(src: Record<string, unknown>): { n: number; d: number } | null {
  const n0 = readInt(first(src, ['n', 'numerator', 'top']))
  const d0 = readInt(first(src, ['d', 'denominator', 'bottom']))
  if (n0 !== null && d0 !== null) return { n: n0, d: d0 }
  const pc = first(src, ['percent', 'percentage', 'pct'])
  if (pc !== undefined) {
    const t = typeof pc === 'string' ? pc.replace('%', '').trim() : pc
    const v = typeof t === 'string' && t !== '' ? Number(t) : t
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e6) return null
    const hundredths = Math.round(v * 100)
    if (Math.abs(hundredths - v * 100) > 1e-6) return null
    return { n: hundredths, d: 10000 }
  }
  const f = first(src, ['fraction', 'of', 'amountOf', 'share'])
  if (typeof f === 'string') {
    const m = /^\s*(\d+)\s*(?:\/|over|out of)\s*(\d+)\s*$/i.exec(f)
    if (m) return { n: Number(m[1]), d: Number(m[2]) }
    const p = /^\s*(\d+(?:\.\d+)?)\s*(?:%|percent)\s*$/i.exec(f)
    if (p) return readFraction({ percent: p[1] })
  }
  if (f && typeof f === 'object') return readFraction(f as Record<string, unknown>)
  return null
}

function readRatio(src: Record<string, unknown>): { a: number; b: number } | null {
  const r = first(src, ['ratio', 'split'])
  if (typeof r === 'string') {
    const m = /^\s*(\d+)\s*(?::|to|-|\/)\s*(\d+)\s*$/i.exec(r)
    return m ? { a: Number(m[1]), b: Number(m[2]) } : null
  }
  if (Array.isArray(r) && r.length === 2) {
    const a = readInt(r[0])
    const b = readInt(r[1])
    return a !== null && b !== null ? { a, b } : null
  }
  const a = readInt(first(src, ['a', 'first']))
  const b = readInt(first(src, ['b', 'second']))
  return a !== null && b !== null ? { a, b } : null
}

function readNames(src: Record<string, unknown>): [string, string] | null {
  const raw = first(src, ['names', 'people', 'between', 'who'])
  if (!Array.isArray(raw) || raw.length !== 2) return null
  const list = raw.map((v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : null))
  return list[0] && list[1] ? [sentence(list[0]), sentence(list[1])] : null
}

const readUnit = (raw: unknown) => (typeof raw === 'string' ? raw.trim() : '')

/** Does the card word it so that the numbers read plainly? Used by tests too. */
export const initialOf = (name: string) => name.charAt(0).toUpperCase()

export function suggestMatch(d: number): { fraction: string; into: number } {
  const dd = Math.max(2, Math.min(6, Number.isInteger(d) ? d : 3))
  return { fraction: `2/${dd < 3 ? 3 : dd}`, into: (dd < 3 ? 3 : dd) * 2 }
}

export const barModelEngine: SceneEngine<BarModelConfig, BarModelState> = {
  id: 'bar-model',
  // Distinctive words only. The catalogue matches any one word of a covers topic and its plural, so "fractions" would catch
  // "mole fractions" and "ratio" would catch trigonometric and accounting ratios: everything common is a whole phrase below.
  covers: ['bar model', 'bar modelling', 'bar models'],
  phrases: [
    'bar model', 'bar models', 'bar modelling', 'fractions', 'equivalent fractions', 'fractions of an amount', 'fraction of an amount', 'fractions and decimals', 'fractions and percentages',
    'comparing fractions', 'ordering fractions', 'simplifying fractions', 'adding fractions', 'subtracting fractions', 'improper fractions',
    'mixed numbers', 'proper fractions', 'numerator and denominator', 'unit fractions', 'parts of a whole',
    'percentages', 'percentages of an amount', 'percentage of an amount', 'percentage change', 'percentage increase', 'percentage decrease',
    'percentage increase and decrease', 'fractions decimals and percentages', 'finding a percentage', 'working with percentages',
    'ratio and proportion', 'ratio and sharing', 'sharing in a ratio', 'share in a ratio', 'dividing in a ratio', 'dividing a quantity in a ratio',
    'simplifying ratios', 'equivalent ratios', 'ratio problems', 'ratios and proportion', 'proportional sharing', 'direct proportion',
    'mixing ratios', 'feed ratio', 'ratio of feed',
  ],
  notFor: ['partial fractions', 'algebraic', 'mole fraction', 'percentage yield', 'percentage composition', 'percentage by mass', 'percentage error', 'percentage uncertainty'],
  // The learner varies the number of equal parts and how many are shaded or given.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const src = raw as Record<string, unknown>
    const task = readTask(first(src, ['task', 'kind']))
    if (!task) return null
    if (task === 'match') {
      const f = readFraction(src)
      const into = readInt(first(src, ['into', 'pieces', 'parts', 'cutInto', 'equalParts']))
      return f && into !== null ? { task, n: f.n, d: f.d, into } : null
    }
    if (task === 'part') {
      const f = readFraction(src)
      const amount = readInt(first(src, ['amount', 'whole', 'total', 'worth']))
      if (!f || amount === null) return null
      const { n, d } = f.d === 10000 ? reduce(f.n, f.d) : f
      return { task, n, d, amount, unit: readUnit(first(src, ['unit', 'units'])) }
    }
    const ratio = readRatio(src)
    const names = readNames(src)
    const amount = readInt(first(src, ['amount', 'whole', 'total', 'worth']))
    return ratio && names && amount !== null ? { task, amount, unit: readUnit(first(src, ['unit', 'units'])), a: ratio.a, b: ratio.b, names } : null
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'match') {
      const { n, d, into } = config
      if (!isInt(n) || !isInt(d) || d < 2 || d > MAX_PIECES || n < 1 || n >= d) {
        out.push(`fraction must be a proper fraction with a whole denominator from 2 to ${MAX_PIECES}, e.g. 2/3.`)
        return out
      }
      if (!isInt(into) || into < 2 || into > MAX_PIECES) out.push(`into must be a whole number of equal parts from 2 to ${MAX_PIECES} (a bar this size cannot show more), e.g. into ${Math.min(MAX_PIECES, d * 2)}.`)
      else if (into === d) out.push(`into ${into} is the same cut as the given bar, so there is nothing to find. Use a multiple of ${d} such as ${d * 2 <= MAX_PIECES ? d * 2 : d}.`)
      else if ((n * into) % d !== 0) {
        const near = Math.floor(MAX_PIECES / d) >= 2 ? d * 2 : d
        out.push(`${n}/${d} cannot be shown in ${into} equal parts, because ${into} is not a multiple of ${d}. Use e.g. into ${near}${near === d ? ' (or lower the denominator)' : ''}.`)
      }
      return out
    }
    if (config.task === 'part') {
      const { n, d, amount } = config
      if (!isInt(n) || !isInt(d) || d < 2 || n < 1 || n >= d) {
        out.push('the fraction or percentage must be more than nothing and less than the whole bar, e.g. 3/5 or 30%.')
        return out
      }
      const r = reduce(n, d)
      if (r.d > MAX_PIECES) out.push(`${n}/${d} needs the bar cut into ${r.d} parts, and it draws at most ${MAX_PIECES}: use a fraction such as 3/5 or a percentage such as 30%.`)
      if (!isInt(amount) || amount < 1 || amount > MAX_AMOUNT) out.push(`amount must be a whole number from 1 to ${MAX_AMOUNT}, e.g. amount 60.`)
      else if (r.d <= MAX_PIECES && amount % r.d !== 0) {
        const near = r.d * Math.max(1, Math.round(amount / r.d))
        out.push(`${n}/${d} of ${amount} is not a whole number, because ${amount} does not divide into ${r.d} equal parts. Use e.g. amount ${near}.`)
      }
      return out
    }
    const { amount, a, b, names } = config
    if (!isInt(a) || !isInt(b) || a < 1 || b < 1) {
      out.push('ratio needs two whole numbers of at least 1, e.g. 2:3.')
      return out
    }
    if (a === b) out.push(`ratio ${a}:${b} is an equal share, which teaches nothing about ratio. Use e.g. ratio 2:3.`)
    if (a + b > MAX_PIECES) out.push(`ratio ${a}:${b} makes ${a + b} parts, and the bar is readable up to ${MAX_PIECES}. Use e.g. ratio 2:3.`)
    else if (!isInt(amount) || amount < 1 || amount > MAX_AMOUNT) out.push(`amount must be a whole number from 1 to ${MAX_AMOUNT}, e.g. amount ${(a + b) * 12}.`)
    else if (amount % (a + b) !== 0) out.push(`${amount} does not divide into ${a + b} equal parts. Use e.g. amount ${(a + b) * Math.max(1, Math.round(amount / (a + b)))}.`)
    if (names[0].length > NAME_MAX || names[1].length > NAME_MAX) out.push(`names must be ${NAME_MAX} letters or fewer each, e.g. "Asha" and "Ben".`)
    if (initialOf(names[0]) === initialOf(names[1])) out.push('the two names must start with different letters, because each part carries its owner\'s first letter, e.g. "Asha" and "Ben".')
    if (config.unit.length > UNIT_MAX) out.push(`unit must be ${UNIT_MAX} characters or fewer, e.g. "sweets".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const num = (k: number) => new RegExp(`(?<![\\d./:])${k}(?![\\d./:%])`)
    const word = (k: number) => ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][k]
    if (config.task === 'match') {
      const k = (config.n * config.into) / config.d
      const said =
        new RegExp(`(?<![\\d.])${k}\\s*(?:/|out of|of the|of)\\s*${config.into}\\b`, 'i').test(text) ||
        new RegExp(`\\bshad\\w*\\s+(?:in\\s+)?(?:exactly\\s+)?(?:${k}|${word(k)})\\b`, 'i').test(text) ||
        new RegExp(`\\b${word(k)}\\s+(?:${word(config.into)}ths?|${word(config.into)}s)\\b`, 'i').test(text)
      return said
        ? [`the prompt gives the answer away: it says how many parts to shade, which the learner finds by lining the lengths up -- say how many parts to cut into and ask for the same length ("Cut the lower bar into ${config.into} equal parts and shade it to the same length as the top bar.")`]
        : []
    }
    if (config.task === 'part') {
      const value = (config.amount * config.n) / config.d
      const each = config.amount / reduce(config.n, config.d).d
      const said = (Number.isInteger(value) && num(value).test(text) && value !== config.amount) || (Number.isInteger(each) && each !== config.amount && num(each).test(text))
      const parts = new RegExp(`\\b(?:cut|split|divide)\\w*\\s+(?:it\\s+|the bar\\s+)?(?:in|into)\\s+(?:${reduce(config.n, config.d).d}|${word(reduce(config.n, config.d).d)})\\b`, 'i').test(text)
      return said || parts
        ? [`the prompt gives the answer away: it says the worth of the part, of one part, or how many parts to cut into -- ask only for the fraction ("Cut and shade the bar to show ${config.n}/${config.d} of the amount.")`]
        : []
    }
    const total = config.a + config.b
    const unit = config.amount / total
    const shares = [unit * config.a, unit * config.b].filter((v) => Number.isInteger(v) && v !== config.a && v !== config.b && v !== config.amount)
    const said =
      new RegExp(`\\b(?:${total}|${word(total)})\\s+(?:equal\\s+)?(?:parts|pieces|shares|units)\\b`, 'i').test(text) ||
      (Number.isInteger(unit) && unit !== config.a && unit !== config.b && unit !== config.amount && num(unit).test(text)) ||
      shares.some((v) => num(v).test(text))
    return said
      ? [`the prompt gives the answer away: it says the number of parts, the worth of a part or a person's share, which the learner finds by cutting and giving out -- ask only for the sharing ("Share the amount between ${config.names[0]} and ${config.names[1]} in the ratio ${config.a}:${config.b}.")`]
      : []
  },

  initial(config) {
    return config.task === 'share' ? { pieces: 1, owners: Array(MAX_PIECES).fill(0) } : { pieces: 1, shaded: 0 }
  },

  check(config, state) {
    const p = state?.pieces
    if (!isInt(p) || p < 1 || p > MAX_PIECES) return { ok: false, wrongIds: ['bar'] }
    if (config.task === 'share') {
      const o = ownersOf(state).slice(0, p)
      const total = config.a + config.b
      const one = o.filter((v) => v === 1).length
      const two = o.filter((v) => v === 2).length
      const ok = p % total === 0 && one + two === p && one * total === config.a * p
      return { ok, wrongIds: ok ? [] : ['bar'] }
    }
    const s = state?.shaded
    if (!isInt(s) || s < 0 || s > p) return { ok: false, wrongIds: ['bar'] }
    const ok = config.task === 'match' ? p === config.into && compare(s, p, config.n, config.d) === 0 : compare(s, p, config.n, config.d) === 0
    return { ok, wrongIds: ok ? [] : ['bar'] }
  },

  solve(config) {
    if (config.task === 'match') return { pieces: config.into, shaded: (config.n * config.into) / config.d }
    if (config.task === 'part') {
      const r = reduce(config.n, config.d)
      return { pieces: r.d, shaded: r.n }
    }
    const owners = Array(MAX_PIECES).fill(0)
    for (let i = 0; i < config.a + config.b; i++) owners[i] = i < config.a ? 1 : 2
    return { pieces: config.a + config.b, owners }
  },

  View: BarModelView,

  prompt: `SCENE "bar-model" -- a bar a hand can cut and fill. The learner taps round - and + to cut a bar into fewer or more equal parts, and taps a part to shade it or give it out. Every move redraws the bar, so a fraction, a percentage or a ratio is something they made. Bars stay in view up to 12 parts.
  match: a given bar (parts shaded, named "Given") sits above the learner's bar, same width. The learner cuts the lower bar into the number of parts you name and shades it to the same length. Equivalent fractions, simplifying, comparing: the lengths are seen to be equal. Before marking there are no numbers on the lower bar except its part count; marking draws a line down from the edge of the top shading and says the fractions.
  part: one bar worth an amount ("whole bar = 60 km"). The learner cuts and shades it to show a fraction or a percentage of the amount (any cut that makes the right length is right: 50% can be 1 of 2, 3 of 6 or 6 of 12). Marking says each part's worth and the total shaded.
  share: one bar worth an amount, and two named people, each with a coloured round button. The learner cuts the bar into equal parts, picks a person, and taps parts to give them out so the parts are in the ratio. Marking says the parts, each part's worth, and each person's amount.
  For: fractions, equivalent fractions, fractions of an amount, percentages, percentage of an amount, sharing in a ratio, ratio and proportion.
  match: fraction "2/3" (a proper fraction, denominator 2 to 12) and into (2 to 12, a multiple of the denominator, not equal to it).
  part: fraction "3/5" or percent "30" (the reduced denominator must be 12 or fewer, so 5% is refused), amount (whole number, divisible by the reduced denominator) and optional unit ("km", "sweets").
  share: ratio "2:3" (parts total 12 or fewer, not equal), amount (divisible by the parts total), names (two, different first letters) and optional unit.
  Not drawn: improper fractions, mixed numbers, ratios of three, a double number line, percentages above 100.
  config: { "task":"match", "fraction":"2/3", "into":6 }  -- the prompt says "Cut the lower bar into 6 equal parts and shade it to the same length as the top bar." (do NOT say how many to shade)
       or { "task":"part", "fraction":"3/5", "amount":60, "unit":"km" }  -- the prompt says "Cut and shade the bar to show 3/5 of the distance." (do NOT give the answer 36 or the number of parts)
       or { "task":"share", "ratio":"2:3", "amount":60, "unit":"sweets", "names":["Asha","Ben"] }  -- the prompt says "Share the sweets between Asha and Ben in the ratio 2:3." (do NOT say 5 parts, 12 each, or their amounts)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Cut the lower bar into 6 equal parts and shade it to the same length as the top bar.",
    "payload": { "engine":"bar-model", "config": { "task":"match", "fraction":"2/3", "into":6 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:bar-model", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Cut and shade the bar to show 3/5 of the distance.",
    "payload": { "engine":"bar-model", "config": { "task":"part", "fraction":"3/5", "amount":60, "unit":"km" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:bar-model", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Share the sweets between Asha and Ben in the ratio 2:3.",
    "payload": { "engine":"bar-model", "config": { "task":"share", "ratio":"2:3", "amount":60, "unit":"sweets", "names":["Asha","Ben"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:bar-model", "why":"..." } }`,
}

registerEngine(barModelEngine as SceneEngine<unknown, unknown>)
