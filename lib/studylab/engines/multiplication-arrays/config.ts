// lib/studylab/engines/multiplication-arrays/config.ts
//
// Multiplication and division you can see, with cookies:
//   build -- drag the corner of a baking tray (or use the buttons) to make R rows of C cookies, and turn the tray a
//            quarter turn: 4 rows of 3 become 3 rows of 4 and the cookies in all do not change;
//   share -- deal cookies onto plates, one at a time or a round at a time, until none can be dealt evenly; what is
//            left in the pile is the remainder.
//
// Rules, all computed here: a tray holds rows x cols cookies; the share is right when every plate holds the same
// whole number, which is the most that can be dealt (the quotient), leaving the remainder in the pile.
//
// Ideas taken, never code or art: building then turning an array to show 3 x 4 = 4 x 3, and naming which number is
// the groups and which is "in each" (Illustrative Mathematics grade 3 unit 1; Year 2 array guides); fair sharing by
// dealing out, with the leftover as the remainder. Splitting an array into two to multiply bigger numbers is left for later.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MultiplicationArraysView } from './View'

export const MIN_SIDE = 2
export const MAX_SIDE = 10
export const MIN_PLATES = 2
export const MAX_PLATES = 6
export const MAX_PER_PLATE = 9
export const MAX_COOKIES = 32

export type BuildConfig = { task: 'build'; rows: number; cols: number }
export type ShareConfig = { task: 'share'; total: number; plates: number }
export type ArraysConfig = BuildConfig | ShareConfig
export type BuildState = { rows: number; cols: number }
export type ShareState = { given: number[] }
export type ArraysState = BuildState | ShareState

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)
const clampInt = (n: unknown, lo: number, hi: number, fallback: number) => (isInt(n) ? Math.max(lo, Math.min(hi, n)) : fallback)

export const quotient = (c: ShareConfig) => Math.floor(c.total / c.plates)
export const remainder = (c: ShareConfig) => c.total % c.plates

export const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const rowsOf = (n: number) => plural(n, 'row')

export function buildDrawable(raw: unknown): BuildState {
  const s = (raw ?? {}) as Partial<BuildState>
  return { rows: clampInt(s.rows, 1, MAX_SIDE, 1), cols: clampInt(s.cols, 1, MAX_SIDE, 1) }
}
export function shareDrawable(config: ShareConfig, raw: unknown): ShareState {
  const g = (raw as Partial<ShareState> | null)?.given
  const given: number[] = []
  let left = config.total
  for (let i = 0; i < config.plates; i++) {
    const want = Array.isArray(g) && isInt(g[i]) ? g[i] : 0
    const n = Math.max(0, Math.min(MAX_PER_PLATE, want, left))
    given.push(n)
    left -= n
  }
  return { given }
}
export const pileLeft = (config: ShareConfig, state: ShareState) => config.total - state.given.reduce((a, b) => a + b, 0)

/** What the learner made, said without judging it. */
export function madeBuild(s: BuildState): string {
  return `You made ${rowsOf(s.rows)} of ${s.cols}: ${s.rows * s.cols} cookies in all.`
}
export function rightBuild(config: BuildConfig): string {
  const p = config.rows * config.cols
  return `${rowsOf(config.rows)} of ${config.cols} is ${p}. Turn it and it is ${rowsOf(config.cols)} of ${config.rows}, still ${p}. So ${config.rows} × ${config.cols} = ${config.cols} × ${config.rows} = ${p}, and ${p} ÷ ${config.cols} = ${config.rows}.`
}
export function wrongBuild(config: BuildConfig, s: BuildState): string {
  const same = s.rows * s.cols === config.rows * config.cols
  const made = madeBuild(s)
  if (s.rows === config.cols && s.cols === config.rows) return `${made} It is the same cookies in all, but the rows run the other way. Turn the tray to swap rows and columns.`
  if (same) return `${made} Count the rows and the cookies in each row to match the task.`
  return `${made} The task needs ${rowsOf(config.rows)} with ${config.cols} in each row.`
}
export function shareSentence(config: ShareConfig): string {
  const q = quotient(config)
  const r = remainder(config)
  return r === 0
    ? `${config.total} ÷ ${config.plates} = ${q}. ${config.plates} × ${q} = ${config.total}, so ${q} each and none left over.`
    : `${config.total} ÷ ${config.plates} = ${q} remainder ${r}. ${config.plates} × ${q} + ${r} = ${config.total}, so ${q} each and ${r} left over.`
}
export function madeShare(config: ShareConfig, s: ShareState): string {
  const left = pileLeft(config, s)
  const unequal = new Set(s.given).size > 1
  return `You dealt ${s.given.join(', ')} to the plates, with ${left} left in the pile. ${unequal ? 'The plates are not equal.' : left >= config.plates ? `${left} are still in the pile, enough to deal another round.` : ''}`.trim()
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const m = v.match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null }
  return null
}
const pick = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (o[k] !== undefined) return o[k] }

const goodBuild = { task: 'build', rows: 4, cols: 3 } as const
const goodShare = { task: 'share', total: 13, plates: 4 } as const

function goodPrompt(config: ArraysConfig): string {
  return config.task === 'build'
    ? `Drag the round handle on the tray's corner, or use the Rows and In each row buttons, to make ${config.rows} rows with ${config.cols} cookies in each row. The Turn button gives the tray a quarter turn.`
    : `Tap a plate to give it one cookie from the pile, or press Deal a round to give every plate one. Share ${config.total} cookies equally between ${config.plates} plates.`
}

export const multiplicationArraysEngine: SceneEngine<ArraysConfig, ArraysState> = {
  id: 'multiplication-arrays',
  covers: ['arrays'],
  phrases: [
    'multiplication', 'multiplication facts', 'multiplication tables', 'times tables', 'times table', 'the times tables', 'multiplying', 'multiplying and dividing',
    'multiplication and division', 'multiply and divide', 'equal groups', 'groups of', 'arrays', 'array', 'repeated addition', 'fact families', 'fact family',
    'division facts', 'division as sharing', 'sharing equally', 'grouping and sharing', 'remainders', 'remainder', 'division with remainders',
    'multiplication as repeated addition', 'commutative multiplication', 'multiplying by 2, 5 and 10', 'multiples of 2, 5 and 10',
  ],
  notFor: [
    'programming', 'python', 'pseudocode', 'data structures', 'dimensional arrays', 'dimensional array', 'arrays and records', 'arrays and strings', 'arrays in programming', 'array data structure', 'array data structures', 'arrays and lists', 'lists and arrays', 'two dimensional arrays', 'array indexing',
    'matrix multiplication', 'matrices', 'matrix', 'multiplying matrices', 'multiplying decimals', 'multiplication of decimals', 'multiplying fractions', 'multiplication of fractions', 'multiplying algebraic',
    'multiplying brackets', 'expanding brackets', 'multiplying binomials', 'polynomial division', 'long division of polynomials', 'remainder theorem', 'factor theorem',
    'multiplication rule', 'multiplication law', 'multiplication principle', 'probability', 'area of rectangles', 'area and perimeter', 'area model', 'area models', 'grid method', 'box method',
    'place value', 'prime factors', 'prime factorisation', 'prime factorization', 'highest common factor', 'lowest common multiple', 'bar model', 'bar models', 'ratio',
    'multiplier', 'multipliers', 'complex numbers', 'array of sensors', 'solar arrays', 'phased array',
  ],
  // The learner varies how many rows and columns, or how many plates share the cookies.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const taskKey = String(pick(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']) ?? '').toLowerCase()
    const rows = num(pick(src, ['rows', 'groups', 'row']))
    const cols = num(pick(src, ['cols', 'columns', 'perRow', 'each', 'inEach', 'column']))
    const total = num(pick(src, ['total', 'cookies', 'items', 'dividend', 'n']))
    const plates = num(pick(src, ['plates', 'sharedBetween', 'people', 'divisor', 'groupsOf', 'ways']))
    const task = /share|divi|plate|deal/.test(taskKey) ? 'share' : /build|array|multipl|tray|row/.test(taskKey) ? 'build'
      : total !== null || plates !== null ? 'share' : rows !== null || cols !== null ? 'build' : null
    if (!task) return null
    if (task === 'build') return rows === null || cols === null ? null : { task, rows, cols }
    return total === null || plates === null ? null : { task, total, plates }
  },

  faults(config) {
    if (config.task === 'build') {
      const { rows, cols } = config
      if (!isInt(rows) || !isInt(cols) || rows < MIN_SIDE || cols < MIN_SIDE || rows > MAX_SIDE || cols > MAX_SIDE)
        return [`Rows and cols must be whole numbers from ${MIN_SIDE} to ${MAX_SIDE}, the size the tray holds: use e.g. rows ${goodBuild.rows}, cols ${goodBuild.cols}.`]
      return []
    }
    const { total, plates } = config
    if (!isInt(plates) || plates < MIN_PLATES || plates > MAX_PLATES)
      return [`Plates must be a whole number from ${MIN_PLATES} to ${MAX_PLATES}: use e.g. total ${goodShare.total}, plates ${goodShare.plates}.`]
    if (!isInt(total) || total < plates) return [`Total must be a whole number of cookies, at least one for each plate (${plates}): use e.g. total ${plates * 3 + 1}, plates ${plates}.`]
    if (total > MAX_COOKIES) return [`The pile holds up to ${MAX_COOKIES} cookies: use e.g. total ${Math.min(MAX_COOKIES, plates * 5 + 2)}, plates ${plates}.`]
    if (Math.floor(total / plates) > MAX_PER_PLATE) return [`A plate holds up to ${MAX_PER_PLATE} cookies, so ${total} between ${plates} is too many: use e.g. total ${plates * 4 + 1}, plates ${plates}.`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const word = (n: number) => String.raw`(?:${n}|${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? n})`
    if (config.task === 'build') {
      const p = config.rows * config.cols
      if (new RegExp(String.raw`(?:^|[^\d])${p}(?:[^\d]|$)`).test(text) || new RegExp(`\\b${word(p)}\\b`, 'i').test(text) && p <= 12)
        out.push(`The prompt gives the number of cookies in all, which the learner is to see for themselves: name only the rows and the cookies in each row ("${example}")`)
      if (/\bdrag (?:the )?(?:cookies?|counters?)\b|\bcolou?r\b|\bshare\b|\bplates?\b|\bdivide|\bsplit\b/i.test(text))
        out.push(`The prompt promises something this card does not do: here the learner drags the tray's corner handle or uses the buttons, and turns the tray; cookies cannot be dragged and there are no plates ("${example}")`)
    } else {
      const q = quotient(config)
      const r = remainder(config)
      if (/\bremainder|left ?over|leftover|spare|extra\b/i.test(text) || new RegExp(`\\b${word(q)}\\b[^.?!]{0,14}\\b(?:each|per plate|on each|on a plate)\\b`, 'i').test(text))
        out.push(`The prompt gives the share each plate gets or the remainder, which the learner is to find: give only the cookies and the plates ("${example}")`)
      if (r > 0 && new RegExp(`\\b${word(r)}\\b[^.?!]{0,10}\\b(?:left|over|remain)`, 'i').test(text))
        out.push(`The prompt gives the number left over: leave it out ("${example}")`)
      if (/\bdrag\b|\bdrop\b|\brows?\b|\bcolumns?\b|\barray\b|\bturn\b|\btray\b/i.test(text))
        out.push(`The prompt promises something this card does not do: here the learner taps plates or presses Deal a round; nothing is dragged and there is no tray ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'build' ? { rows: 1, cols: 1 } : { given: Array.from({ length: config.plates }, () => 0) }
  },

  check(config, state) {
    if (config.task === 'build') {
      const s = buildDrawable(state)
      const wrongIds = [...(s.rows !== config.rows ? ['rows'] : []), ...(s.cols !== config.cols ? ['cols'] : [])]
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const s = shareDrawable(config, state)
    const q = quotient(config)
    const wrongIds = s.given.flatMap((g, i) => (g === q ? [] : [`plate${i}`]))
    return { ok: wrongIds.length === 0, wrongIds }
  },

  solve(config) {
    return config.task === 'build' ? { rows: config.rows, cols: config.cols } : { given: Array.from({ length: config.plates }, () => quotient(config)) }
  },

  View: MultiplicationArraysView as never,

  prompt: `SCENE "multiplication-arrays" -- cookies on a baking tray and on plates, drawn on a quiet light panel. For the youngest stages of multiplication and division.
  build: a metal baking tray holds a grid of cookies, starting as one cookie. Rows are numbered down the side and cookies along the top. The learner drags the round handle on the tray's corner (or uses the Rows and In each row − / + buttons) to make the tray with the asked rows and cookies in each row, and the card says "4 rows of 3, 12 cookies in all" as it changes. The Turn button turns the tray a quarter turn, so rows and columns swap while the cookies in all stay the same: this is what shows 3 × 4 and 4 × 3 make the same number. Marking says what was made; when right it writes the fact family.
  share: a pile of cookies and 2-6 empty plates. The learner taps a plate to give it one cookie, or presses Deal a round to give every plate one; the small minus on a plate takes one back. The card shows each plate's count and the cookies left in the pile. Right when every plate holds the same number and no full round can be dealt, so what is left is the remainder. Marking then writes the division with its remainder and the multiplication check.
  For: multiplication as rows and columns and equal groups, the times tables and the order of factors, division as sharing, remainders, and the fact family. It does not split a big array into two to multiply (no area model), and it is not for matrices, programming arrays, multiplying decimals or algebra.
  Before marking it shows only what the learner has made (rows, in each row, how many in all; each plate and the pile). It does not say which counts are asked for beyond the prompt. Prompts must say the gesture and give the rows and cookies in each row, or the cookies and plates; never the total of an array, the share each plate gets or the remainder.
  config: { "task":"build", "rows":4, "cols":3 }  (rows and cols 2 to 10)
       or { "task":"share", "total":13, "plates":4 }  (plates 2 to 6, total at least one per plate, at most 32 and at most 9 on a plate)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the round handle on the tray's corner, or use the Rows and In each row buttons, to make 4 rows with 3 cookies in each row. The Turn button gives the tray a quarter turn.",
    "payload": { "engine":"multiplication-arrays", "config": { "task":"build", "rows":4, "cols":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:multiplication-arrays", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a plate to give it one cookie from the pile, or press Deal a round to give every plate one. Share 13 cookies equally between 4 plates.",
    "payload": { "engine":"multiplication-arrays", "config": { "task":"share", "total":13, "plates":4 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:multiplication-arrays", "why":"..." } }`,
}

registerEngine(multiplicationArraysEngine as SceneEngine<unknown, unknown>)
