// lib/studylab/engines/order-of-operations/config.ts
//
// The order of operations as something the student does, not recites.
//   order    -- a sum is shown as tiles. The student taps the calculation to work out next; the card does it,
//               and writes the new line underneath, like a page of working. A different order gives a visibly
//               different answer. Marked by exact integer arithmetic: every step must keep the true answer.
//   brackets -- a sum and a target. Tapping an operation puts brackets round it (and its two numbers); the
//               live value answers back. Marked by the value the whole sum has with the brackets drawn.
//
// The rules: brackets first, then powers, then x and / together, then + and - together, each pair left to
// right (Cambridge Primary 5-6, Lower Secondary, IGCSE 0580). The traps designed against, from Mathnasium's
// "why PEMDAS isn't enough" and Math Doctors' "order of operations: common misunderstandings": reading the
// acronym as a strict ladder (x before /, + before -), working strictly left to right (2 + 3 x 4 = 20), and
// BODMAS students dividing before multiplying. Left out: fractions and negatives as step results (refused
// by faults), brackets inside brackets, implied multiplication such as 2(3 + 4), roots, long power chains.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { OrderOfOperationsView } from './View'

export type Op = '+' | '-' | '×' | '÷' | '^'
export type Tok = { t: 'n'; v: number } | { t: 'o'; o: Op } | { t: '(' } | { t: ')' }

export type OrderConfig = { task: 'order'; expr: string }
export type BracketsConfig = { task: 'brackets'; expr: string; target: number }
export type OooConfig = OrderConfig | BracketsConfig
export type OooState = { picks: number[] } | { wrapped: number[] }

export const MAX_NUMBER = 99
export const MAX_VALUE = 9999
export const PANEL_W = 360
/** The widest a line of tiles may be before it will not fit the panel. */
export const MAX_LINE = 336

// ---------------------------------------------------------------- reading

const NUMERAL = /^\d+(\.\d+)?$/

function normalise(raw: string): string {
  return raw
    .replace(/=.*$/, '')
    .replace(/[?]/g, '')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-')
    .replace(/[*·⋅]/g, '×')
    .replace(/[/:]/g, '÷')
    .replace(/(?<=[\d)\s])x(?=[\d(\s])/gi, '×')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
}

/** Tiles from a sum, or null when it cannot be read as numbers, signs and brackets in a sensible order. */
export function tokenize(raw: unknown): Tok[] | null {
  if (typeof raw !== 'string') return null
  const text = normalise(raw)
  const out: Tok[] = []
  const re = /\s*(\d+(?:\.\d+)?|[+\-×÷^()])/y
  let at = 0
  while (at < text.length) {
    if (text.slice(at).trim() === '') { at = text.length; break }
    re.lastIndex = at
    const m = re.exec(text)
    if (!m) break
    at = re.lastIndex
    const s = m[1]
    if (NUMERAL.test(s)) out.push({ t: 'n', v: Number(s) })
    else if (s === '(') out.push({ t: '(' })
    else if (s === ')') out.push({ t: ')' })
    else out.push({ t: 'o', o: s as Op })
  }
  if (at < text.length || out.length === 0) return null
  return wellFormed(out) ? out : null
}

/** unit (op unit)*, where a unit is a number or a bracketed sum. */
function wellFormed(toks: Tok[]): boolean {
  let at = 0
  const unit = (): boolean => {
    const t = toks[at]
    if (!t) return false
    if (t.t === 'n') { at++; return true }
    if (t.t === '(') { at++; if (!sum()) return false; if (toks[at]?.t !== ')') return false; at++; return true }
    return false
  }
  const sum = (): boolean => {
    if (!unit()) return false
    while (toks[at]?.t === 'o') { at++; if (!unit()) return false }
    return true
  }
  return sum() && at === toks.length
}

export const SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '×': '×', '÷': '÷', '^': '^' }

/** The sum as one line of text. */
export function show(toks: Tok[]): string {
  let s = ''
  toks.forEach((t, i) => {
    const prev = toks[i - 1]
    if (t.t === 'n') s += (prev && prev.t === 'o' && prev.o !== '^' ? ' ' : '') + t.v
    else if (t.t === '(') s += prev && prev.t === 'o' && prev.o !== '^' ? ' (' : '('
    else if (t.t === ')') s += ')'
    else s += t.o === '^' ? '^' : ` ${SYMBOL[t.o]}`
  })
  return s
}

// ---------------------------------------------------------------- the rules

const rank = (o: Op) => (o === '^' ? 3 : o === '×' || o === '÷' ? 2 : 1)
const isNum = (t: Tok | undefined): t is { t: 'n'; v: number } => !!t && t.t === 'n'

export const opIndexes = (toks: Tok[]): number[] => toks.flatMap((t, i) => (t.t === 'o' ? [i] : []))

/** Ordinals of the operations with a number on both sides: the ones that can be worked out right now. */
export function readyOps(toks: Tok[]): number[] {
  return opIndexes(toks).flatMap((i, k) => (canWork(toks, i) ? [k] : []))
}

/** Numbers on both sides, and neither is an exponent or a base waiting for its power (4 + 3^2 cannot start with 4 + 3). */
function canWork(toks: Tok[], i: number): boolean {
  if (!isNum(toks[i - 1]) || !isNum(toks[i + 1])) return false
  const o = (toks[i] as { o: Op }).o
  const before = toks[i - 2]
  const after = toks[i + 2]
  if (before && before.t === 'o' && before.o === '^') return false
  if (o !== '^' && after && after.t === 'o' && after.o === '^') return false
  return true
}

const calc = (a: number, o: Op, b: number): number =>
  o === '+' ? a + b : o === '-' ? a - b : o === '×' ? a * b : o === '÷' ? a / b : a ** b

/** The bracket a token sits inside, or -1. */
function enclosing(toks: Tok[], i: number): number {
  let depth = 0
  for (let j = i - 1; j >= 0; j--) {
    if (toks[j].t === ')') depth++
    else if (toks[j].t === '(') { if (depth === 0) return j; depth-- }
  }
  return -1
}

function hasNested(toks: Tok[], start: number): boolean {
  let depth = 0
  for (let j = start; j < toks.length; j++) {
    if (toks[j].t === '(') { depth++; if (depth > 1) return true }
    else if (toks[j].t === ')') { depth--; if (depth === 0) return false }
  }
  return false
}

/** Ordinals of the operations the rules say may be worked out now. */
export function legalOps(toks: Tok[]): number[] {
  const ops = opIndexes(toks)
  const hasBrackets = toks.some((t) => t.t === '(')
  const groups = new Map<number, number[]>()
  for (const i of ops) {
    const g = enclosing(toks, i)
    groups.set(g, [...(groups.get(g) ?? []), i])
  }
  const out: number[] = []
  for (const [start, members] of groups) {
    if (hasBrackets && (start === -1 || hasNested(toks, start))) continue
    const top = Math.max(...members.map((i) => rank((toks[i] as { o: Op }).o)))
    members.forEach((i, k) => {
      const r = rank((toks[i] as { o: Op }).o)
      const before = members[k - 1]
      if (r === top && !(k > 0 && before === i - 2 && rank((toks[before] as { o: Op }).o) === top)) out.push(ops.indexOf(i))
    })
  }
  return out.sort((a, b) => a - b)
}

export interface Applied {
  toks: Tok[]
  /** Where the three tiles stood before. */
  span: [number, number]
  /** Where the answer tile is now. */
  made: number
  result: number
}

/** Work out one operation: its two numbers and itself become one tile; a bracket round a lone number goes. */
export function applyOp(toks: Tok[], ord: number): Applied | null {
  const i = opIndexes(toks)[ord]
  if (i === undefined || !canWork(toks, i)) return null
  const a = (toks[i - 1] as { v: number }).v
  const b = (toks[i + 1] as { v: number }).v
  const o = (toks[i] as { o: Op }).o
  const result = calc(a, o, b)
  const next: Tok[] = [...toks.slice(0, i - 1), { t: 'n', v: result }, ...toks.slice(i + 2)]
  let made = i - 1
  for (;;) {
    const at = next.findIndex((t, k) => t.t === '(' && isNum(next[k + 1]) && next[k + 2]?.t === ')')
    if (at < 0) break
    next.splice(at + 2, 1)
    next.splice(at, 1)
    if (made > at) made -= 1
  }
  return { toks: next, span: [i - 1, i + 1], made, result }
}

/** The value of a sum by the rules, or NaN when it cannot be worked out. */
export function evaluate(start: Tok[]): number {
  let toks = start
  for (let guard = 0; guard < 40; guard++) {
    if (toks.length === 1 && isNum(toks[0])) return toks[0].v
    const ord = legalOps(toks)[0]
    const next = ord === undefined ? null : applyOp(toks, ord)
    if (!next) return NaN
    toks = next.toks
  }
  return NaN
}

// ---------------------------------------------------------------- layout (shared by faults and the view)

export interface Item { kind: 'n' | 'o' | 'pow' | '(' | ')'; i: number; x: number; w: number }
export const NUM_H = 32
export const GAP = 6

const digits = (v: number) => String(v).length
const itemWidth = (t: Tok): number => (t.t === 'n' ? Math.max(32, 14 + 11 * digits(t.v)) : t.t === 'o' ? (t.o === '^' ? 0 : 28) : 10)

/** Where each tile of a line sits, centred in the panel. A power's exponent is a small raised tile after its base. */
export function layoutLine(toks: Tok[]): { items: Item[]; width: number } {
  const items: Item[] = []
  let x = 0
  toks.forEach((t, i) => {
    const prev = toks[i - 1]
    if (t.t === 'o' && t.o === '^') return
    if (prev && prev.t === 'o' && prev.o === '^' && t.t === 'n') {
      items.push({ kind: 'pow', i: i - 1, x: x - GAP + 2, w: 18 })
      x += 18 - GAP + 2 + GAP
      return
    }
    const w = itemWidth(t)
    items.push({ kind: t.t === 'n' ? 'n' : t.t === 'o' ? 'o' : t.t, i, x, w })
    x += w + GAP
  })
  const width = Math.max(0, x - GAP)
  const left = (PANEL_W - width) / 2
  return { items: items.map((it) => ({ ...it, x: it.x + left })), width }
}

// ---------------------------------------------------------------- exploring every order

interface Tour { values: Set<number>; problem: string | null }

/** Every order a student could work a sum in: all must stay whole, non-negative and drawable. */
function tour(start: Tok[]): Tour {
  const values = new Set<number>()
  let problem: string | null = null
  let nodes = 0
  const walk = (toks: Tok[]) => {
    if (problem || ++nodes > 4000) return
    if (layoutLine(toks).width > MAX_LINE) { problem = 'wide'; return }
    if (toks.length === 1 && isNum(toks[0])) { values.add(toks[0].v); return }
    for (const k of readyOps(toks)) {
      const next = applyOp(toks, k)
      if (!next) continue
      if (!Number.isInteger(next.result) || next.result < 0 || next.result > MAX_VALUE) { problem = !Number.isInteger(next.result) ? 'fraction' : next.result < 0 ? 'negative' : 'big'; return }
      walk(next.toks)
    }
  }
  walk(start)
  return { values, problem }
}

// ---------------------------------------------------------------- the order task

export interface Line { toks: Tok[]; span?: [number, number]; made?: number }
export interface Replay { lines: Line[]; picks: number[]; bad: number[]; finished: boolean; value: number }

const startOf = (config: OooConfig): Tok[] => tokenize(config.expr) ?? []

/** Work the student's taps through. A pick that cannot be made is ignored; `bad` lists the steps that changed the answer. */
export function replay(config: OooConfig, state: OooState): Replay {
  const lines: Line[] = [{ toks: startOf(config) }]
  const picks: number[] = []
  const bad: number[] = []
  const raw = 'picks' in state && Array.isArray(state.picks) ? state.picks : []
  for (const ord of raw) {
    const cur = lines[lines.length - 1]
    if (cur.toks.length === 1) break
    if (!Number.isInteger(ord)) continue
    const next = applyOp(cur.toks, ord)
    if (!next) continue
    if (evaluate(next.toks) !== evaluate(cur.toks)) bad.push(picks.length)
    cur.span = next.span
    lines.push({ toks: next.toks, made: next.made })
    picks.push(ord)
  }
  const last = lines[lines.length - 1].toks
  const finished = last.length === 1 && isNum(last[0])
  return { lines, picks, bad, finished, value: finished ? (last[0] as { v: number }).v : NaN }
}

const groupName = (r: number) => (r === 3 ? 'Powers' : r === 2 ? '× and ÷' : '+ and −')
const rankOf = (toks: Tok[], i: number) => rank((toks[i] as { o: Op }).o)
const triple = (toks: Tok[], i: number) => {
  const o = (toks[i] as { o: Op }).o
  const a = (toks[i - 1] as { v: number }).v
  const b = (toks[i + 1] as { v: number }).v
  return o === '^' ? `${a}^${b}` : `${a} ${SYMBOL[o]} ${b}`
}

/** Why the rules want one calculation before another. */
function why(toks: Tok[], right: number, other: number): string {
  const ops = opIndexes(toks)
  const a = ops[right]
  const b = ops[other]
  if (enclosing(toks, a) !== -1 && enclosing(toks, a) !== enclosing(toks, b)) return `Brackets come first, so ${triple(toks, a)} goes first.`
  const ra = rankOf(toks, a)
  const rb = rankOf(toks, b)
  if (ra > rb) return `${groupName(ra)} come before ${groupName(rb)}, so ${triple(toks, a)} goes first.`
  if (ra === rb) return `${groupName(ra)} are worked out from left to right, so ${triple(toks, a)} goes first.`
  return `${triple(toks, a)} goes first.`
}

/** The shortest honest reason from the sum's own first step. */
function firstReason(toks: Tok[]): string {
  const right = legalOps(toks)[0]
  if (right === undefined) return ''
  const other = readyOps(toks).find((k) => k !== right && applyOp(toks, k) && evaluate(applyOp(toks, k)!.toks) !== evaluate(toks))
  return other === undefined ? `${triple(toks, opIndexes(toks)[right])} goes first.` : why(toks, right, other)
}

/** What the card says once marked: a lead sentence, then the reason. */
export function said(config: OooConfig, state: OooState, marked: 'right' | 'wrong' | 'shown'): { lead: string; rest: string } {
  if (config.task === 'brackets') {
    const wrapped = wrapsOf(config, state)
    const v = valueWith(config, wrapped)
    const plain = valueWith(config, [])
    const mine = withBrackets(config, wrapped)
    if (marked === 'wrong') {
      return { lead: `Not quite. ${show(mine)} = ${Number.isFinite(v) ? v : '?'}, not ${config.target}.`, rest: 'Brackets change which calculation goes first, and so change the answer.' }
    }
    return { lead: `Yes. ${show(mine)} = ${config.target}.`, rest: `With no brackets it is ${show(startOf(config))} = ${plain}, because the rules put one calculation first. The brackets moved that to the pair you wrapped.` }
  }
  const r = replay(config, state)
  if (marked === 'wrong') {
    if (r.bad.length === 0) return { lead: 'Not finished yet.', rest: 'Keep tapping calculations until one number is left.' }
    const k = r.bad[0]
    const line = r.lines[k].toks
    const picked = readyOps(line).includes(r.picks[k]) ? triple(line, opIndexes(line)[r.picks[k]]) : ''
    const right = legalOps(line)[0]
    const reason = right === undefined ? '' : why(line, right, r.picks[k])
    const got = r.finished ? ` You got ${r.value}; the answer is ${evaluate(startOf(config))}.` : ` The answer is ${evaluate(startOf(config))}.`
    return { lead: `Not quite. You worked out ${picked} too soon.`, rest: `${reason}${got}` }
  }
  const chain = r.lines.map((l) => show(l.toks)).join(' = ')
  return { lead: `Yes. The answer is ${r.value}.`, rest: `${firstReason(startOf(config))} ${chain}.` }
}

// ---------------------------------------------------------------- the brackets task

/** The operation ordinals wrapped in brackets, as the state holds them (cleaned). */
export function wrapsOf(config: OooConfig, state: OooState): number[] {
  const n = opIndexes(startOf(config)).length
  const raw = 'wrapped' in state && Array.isArray(state.wrapped) ? state.wrapped : []
  const out: number[] = []
  for (const k of [...new Set(raw)].sort((a, b) => a - b)) {
    if (Number.isInteger(k) && k >= 0 && k < n && !(out.length && out[out.length - 1] === k - 1)) out.push(k)
  }
  return out
}

/** Tapping an operation wraps it; tapping again unwraps; wrapping one that shares a number with another swaps. */
export function toggleWrap(wrapped: number[], ord: number): number[] {
  if (wrapped.includes(ord)) return wrapped.filter((k) => k !== ord)
  return [...wrapped.filter((k) => Math.abs(k - ord) > 1), ord].sort((a, b) => a - b)
}

/** The sum with brackets round each wrapped operation and its two numbers. */
export function withBrackets(config: OooConfig, wrapped: number[]): Tok[] {
  const toks = startOf(config)
  const ops = opIndexes(toks)
  const open = new Set(wrapped.map((k) => ops[k] - 1))
  const close = new Set(wrapped.map((k) => ops[k] + 1))
  return toks.flatMap((t, i) => [...(open.has(i) ? [{ t: '(' } as Tok] : []), t, ...(close.has(i) ? [{ t: ')' } as Tok] : [])])
}

export const valueWith = (config: OooConfig, wrapped: number[]): number => evaluate(withBrackets(config, wrapped))

/** Every way of wrapping: none, one operation, or two that share no number. */
function wrapOptions(nOps: number): number[][] {
  const out: number[][] = [[]]
  for (let a = 0; a < nOps; a++) out.push([a])
  for (let a = 0; a < nOps; a++) for (let b = a + 2; b < nOps; b++) out.push([a, b])
  return out
}

export const solutions = (config: BracketsConfig): number[][] => {
  const n = opIndexes(startOf(config)).length
  return wrapOptions(n).filter((w) => w.length > 0 && valueWith(config, w) === config.target)
}

// ---------------------------------------------------------------- the engine

const EXAMPLE_ORDER = '2 + 3 × 4'
const EXAMPLE_BRACKETS = '3 + 4 × 2 with target 14'

const num = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') { const m = raw.match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null }
  return null
}
const first = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (o[k] !== undefined) return o[k]; return undefined }

function numbersIn(toks: Tok[]) { return toks.filter(isNum) }

export const orderEngine: SceneEngine<OooConfig, OooState> = {
  id: 'order-of-operations',
  covers: ['BIDMAS', 'BODMAS', 'PEMDAS', 'BEDMAS'],
  phrases: [
    'order of operations', 'order of operation', 'order of calculations', 'order of calculation', 'using brackets',
    'putting brackets in', 'inserting brackets', 'brackets in calculations', 'brackets and operations',
    'brackets in arithmetic', 'multiplication and division left to right', 'operations with brackets',
    'priority of operations', 'rules of arithmetic', 'mixed operations',
  ],
  notFor: [
    'expanding brackets', 'expand brackets', 'expanding double brackets', 'factorising', 'factorizing', 'double brackets',
    'function machine', 'function machines', 'inverse operations', 'substituting into formulas', 'substitution into formulas',
    'place value', 'completing the square', 'brackets in algebra', 'algebraic brackets', 'brackets in poetry',
    'order of magnitude', 'standard form', 'order of reactivity', 'order of events', 'order of the spectrum',
  ],
  isolates: 'order',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const toks = tokenize(first(o, ['expr', 'expression', 'sum', 'calculation', 'question', 'problem', 'calc']))
    if (!toks) return null
    const expr = show(toks)
    const taskKey = String(first(o, ['task', 'kind', 'type', 'mode']) ?? '').toLowerCase()
    const target = num(first(o, ['target', 'make', 'makes', 'equals', 'result', 'goal']))
    const wantsBrackets = /bracket|insert|put/.test(taskKey) || (!/order|work|step|evaluat/.test(taskKey) && target !== null)
    if (wantsBrackets) return target === null ? null : { task: 'brackets', expr, target }
    return { task: 'order', expr }
  },

  faults(config) {
    const toks = tokenize(config.expr)
    if (!toks) return [`The sum could not be read: use e.g. "${EXAMPLE_ORDER}".`]
    const nums = numbersIn(toks)
    const ops = opIndexes(toks)
    if (nums.some((n) => !Number.isInteger(n.v) || n.v < 0 || n.v > MAX_NUMBER)) return [`Use whole numbers from 0 to ${MAX_NUMBER}: use e.g. "${EXAMPLE_ORDER}".`]
    if (nums.length > 5) return [`A sum can have at most 5 numbers so every line fits: use e.g. "${EXAMPLE_ORDER}".`]
    if (config.task === 'brackets') {
      if (toks.some((t) => t.t === '(' || t.t === ')')) return [`The sum for putting brackets in starts with none: use e.g. "${EXAMPLE_BRACKETS}".`]
      if (toks.some((t) => t.t === 'o' && t.o === '^')) return [`Putting brackets in uses + − × ÷ only: use e.g. "${EXAMPLE_BRACKETS}".`]
      if (ops.length < 2 || ops.length > 3) return [`Putting brackets in needs 2 or 3 operations (3 or 4 numbers): use e.g. "${EXAMPLE_BRACKETS}".`]
      if (!Number.isInteger(config.target) || config.target < 0 || config.target > MAX_VALUE) return [`The target must be a whole number from 0 to ${MAX_VALUE}: use e.g. "${EXAMPLE_BRACKETS}".`]
      const n = ops.length
      for (const w of wrapOptions(n)) {
        const v = valueWith(config, w)
        if (!Number.isInteger(v) || v < 0 || v > MAX_VALUE) return [`Some bracketings of ${show(toks)} give a fraction, a negative or a huge number, which the card cannot show: use e.g. "${EXAMPLE_BRACKETS}".`]
        if (layoutLine(withBrackets(config, w)).width > MAX_LINE) return [`${show(toks)} is too wide once bracketed: use fewer or smaller numbers, e.g. "${EXAMPLE_BRACKETS}".`]
      }
      if (valueWith(config, []) === config.target) return [`${show(toks)} already makes ${config.target} with no brackets, so nothing is to do: use e.g. "${EXAMPLE_BRACKETS}".`]
      if (solutions(config).length === 0) return [`No way of putting brackets in ${show(toks)} makes ${config.target}: use e.g. "${EXAMPLE_BRACKETS}".`]
      return []
    }
    if (ops.length < 2) return [`Order only matters with at least two operations: use e.g. "${EXAMPLE_ORDER}".`]
    if (ops.length > 4) return [`Use at most 4 operations so the working fits the card: use e.g. "${EXAMPLE_ORDER}".`]
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k]
      if (t.t === 'o' && t.o === '^') {
        const e = toks[k + 1]
        if (!isNum(e) || (e.v !== 2 && e.v !== 3)) return [`A power must be a plain 2 or 3 after the ^, as in 5^2: use e.g. "10 − 2^3".`]
        if (toks[k - 1]?.t !== 'n' && toks[k - 1]?.t !== ')') return ['A power needs a number or a bracket before it, as in 5^2: use e.g. "10 − 2^3".']
        if (toks[k - 2]?.t === 'o' && (toks[k - 2] as { o: Op }).o === '^') return ['Chains of powers are ambiguous: use e.g. "10 − 2^3".']
      }
      if (t.t === '(') {
        if (hasNested(toks, k)) return [`Use one level of brackets: use e.g. "(2 + 3) × 4".`]
        if (isNum(toks[k + 1]) && toks[k + 2]?.t === ')') return [`A bracket round one number does nothing: use e.g. "(2 + 3) × 4".`]
      }
    }
    const t = tour(toks)
    if (t.problem === 'wide') return [`${show(toks)} is too wide to fit the working: use fewer or smaller numbers, e.g. "${EXAMPLE_ORDER}".`]
    if (t.problem) return [`Some wrong orders of ${show(toks)} would give a ${t.problem === 'fraction' ? 'fraction' : t.problem === 'negative' ? 'negative number' : 'huge number'}, which the card cannot show: choose numbers that stay whole, e.g. "${EXAMPLE_ORDER}".`]
    if (t.values.size < 2) return [`The order makes no difference to ${show(toks)}, so it teaches nothing: use e.g. "${EXAMPLE_ORDER}".`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const truth = config.task === 'order' ? evaluate(startOf(config)) : config.target
    if (config.task === 'order') {
      if (new RegExp(`(?:=|answer is|makes|equals|gives)\\s*${truth}\\b`, 'i').test(text)) out.push('The prompt prints the answer: ask the student to work the sum out and leave the value out.')
      if (/\b(?:bidmas|bodmas|pemdas|bedmas|brackets first|multiply first|divide first|multiplication first|division first|before (?:adding|addition|subtract)|left to right)\b/i.test(text)) out.push('The prompt gives the rule the card is teaching: ask only for the sum to be worked out ("Tap the calculation to do next, until one number is left").')
      if (!/\b(?:tap|press|click)\b/i.test(text)) out.push('Say the gesture: tap the calculation to work out next, until one number is left.')
    } else {
      if (/\(\s*\d+\s*(?:[+\-−×÷x*/])\s*\d+\s*\)/.test(text) || /\bround the\b|\baround the\b|\bwrap\b.*\b\d+\b/i.test(text)) out.push('The prompt says where the brackets go: ask for the target and leave the placing to the student.')
      if (!/\b(?:tap|press|click)\b/i.test(text)) out.push('Say the gesture: tap an operation to put brackets round it.')
    }
    if (/\b(?:drag|drop|type|write|enter|fraction|negative|decimal)\b/i.test(text)) out.push('The prompt promises something the card does not do: it only taps operations in whole-number sums.')
    return out
  },

  initial(config) {
    return config.task === 'order' ? { picks: [] } : { wrapped: [] }
  },

  check(config, state) {
    if (config.task === 'brackets') {
      const v = valueWith(config, wrapsOf(config, state))
      return v === config.target ? { ok: true, wrongIds: [] } : { ok: false, wrongIds: ['brackets'] }
    }
    const r = replay(config, state)
    const ok = r.finished && r.value === evaluate(startOf(config))
    if (ok) return { ok, wrongIds: [] }
    return { ok, wrongIds: [...r.bad.map((k) => `step${k + 1}`), ...(r.finished ? [] : ['unfinished'])] }
  },

  solve(config) {
    if (config.task === 'brackets') return { wrapped: solutions(config)[0] ?? [] }
    const picks: number[] = []
    let toks = startOf(config)
    for (let guard = 0; guard < 12 && toks.length > 1; guard++) {
      const ord = legalOps(toks)[0]
      const next = ord === undefined ? null : applyOp(toks, ord)
      if (!next) break
      picks.push(ord)
      toks = next.toks
    }
    return { picks }
  },

  View: OrderOfOperationsView,

  prompt: `SCENE "order-of-operations" -- a sum drawn as number tiles joined by operation discs on a quiet light panel, the order of operations as something the student does. Nothing names the rules before marking.
  order: the student taps the calculation to work out next. The card does it (its two numbers and the disc become one answer tile) and writes the sum again on a new line underneath, like a page of working, until one number is left. A different order gives a visibly different answer; "Undo" and "Start again" let them try another. Calculations that have a bracket still open beside them cannot be tapped yet (they sit faded). Marked by exact whole-number arithmetic: every step must keep the true answer, so working strictly left to right on 2 + 3 × 4 is wrong. Marking names the rule ("× and ÷ come before + and −") and says what the student did.
  brackets: a sum with no brackets and a target. Tapping an operation puts brackets round it and its two numbers (tap again to take them off); the sum's live value and the target are shown side by side. Marked by the value the bracketed sum has; any bracketing that reaches the target passes.
  For: the order of operations, BIDMAS / BODMAS / PEMDAS, the classic wrong answers (2 + 3 × 4 = 20, 8 − 3 + 2 = 3, 12 ÷ 2 × 3 = 2), × and ÷ sharing a rank and + and − sharing a rank (left to right), powers 2 and 3, one level of brackets, and putting brackets in to make a target. Not for expanding brackets in algebra, function machines or inverse operations, substitution into formulas, or place value.
  Whole numbers 0 to 99 and + − × ÷ and ^2 / ^3. order: 2 to 4 operations, at most 5 numbers, one level of brackets; the order must change the answer for some choice, and every order must stay whole and non-negative (so "10 ÷ 4" and "3 − 8 + 10" are refused). brackets: 2 or 3 operations, no powers, no brackets given, a target that some bracketing reaches and the plain sum does not.
  Prompts must say the gesture ("Tap ...") and must not print the answer, the rule's name or "left to right", and for brackets must not say where the brackets go.
  config: { "task":"order", "expr":"2 + 3 × 4" }
       or { "task":"order", "expr":"12 ÷ 2 × 3" }
       or { "task":"order", "expr":"(2 + 3) × 4 + 3^2" }
       or { "task":"brackets", "expr":"3 + 4 × 2", "target":14 }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the calculation you would work out next, and keep going until one number is left.",
    "payload": { "engine":"order-of-operations", "config": { "task":"order", "expr":"2 + 3 × 4" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:order-of-operations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the calculation to do next, one step at a time, until one number is left.",
    "payload": { "engine":"order-of-operations", "config": { "task":"order", "expr":"12 ÷ 2 × 3" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:order-of-operations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap an operation to put brackets round it. Make the sum come to 14.",
    "payload": { "engine":"order-of-operations", "config": { "task":"brackets", "expr":"3 + 4 × 2", "target":14 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:order-of-operations", "why":"..." } }`,
}

registerEngine(orderEngine as SceneEngine<unknown, unknown>)
