// lib/studylab/engines/function-machine/config.ts
//
// A real machine that numbers travel through: a hopper, a belt, one to three stations that each do one sum, and a
// tray. A paper ticket with a number on it rides the belt, and the number changes under each station. Two tasks:
//   inverse -- the machine and the number wanted at the tray are shown, and the learner finds the number to feed in.
//              They feed numbers with a stepper and watch the ticket ride through, so they see each station's part, and
//              the lesson comes when it is marked: undo the steps, last one first;
//   pattern -- a growing pattern of tiles (n groups of the same size, plus a few that never change) and a machine
//              whose two stations the learner sets, until the machine gives the tiles in every step. A step stepper
//              grows the pattern one figure at a time; the machine answers for that step.
//
// The rules, all computed here and never read from the drawing:
//   exact rational arithmetic, so a number fed through stations that divide never meets a float;
//   inverse: marked right exactly when the fed number is the hidden input; the stations are all invertible, so it is the
//            only one that works;
//   pattern: marked right exactly when the machine's multiplier and addition are the pattern's: two straight lines that
//            agree at every step are the same line, so these are the only ones that fit.
//
// Ideas taken, never code or art:
//   - the machine is the picture and the inverse is the same machine run backwards, the input and output swapped:
//     University of Minnesota Math Insight, "The function machine inverse" (read in full). It also warns that the
//     superscript in f^-1 is not a power, and that a machine can be run backwards only if the output says which input made it;
//     here every station is one-to-one, so every machine can;
//   - visual patterns: Fawn Nguyen's visualpatterns.org (read in summary through secondary sources: BetterLesson, the
//     Make Math Moments interview and the Heinemann blog). Show the first figures, grow the next, and make the algebra
//     match what is drawn: "students' expressions have to match what they see in the figure";
//   - the misconceptions, from classroom sources that cite no study (Inquiry Maths' linear and quadratic sequences page,
//     read in full; the worksheet and tutoring sources the search turned up): the first term written as the constant,
//     "first term plus n lots of the difference" instead of n minus one lots, 3n for 5, 8, 11, 14, and the difference taken
//     for the constant. The pattern task draws the constant as tiles that never change and the multiplier as the group that
//     comes with every step, so the constant is visibly not the first term;
//   - Desmos's inverse-function activities were looked at and refused: they swap x and y on a graph, which needs the
//     coordinate plane and loses the machine.
// Refused: composite and quadratic machines (squaring does not run backwards without a choice of root: a different card),
// functions as graphs (coordinate-plane), a table of values the learner fills (no act), and a machine the learner
// assembles from blocks (it would be a list of choices).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FunctionMachineView } from './View'

export type Op = '+' | '−' | '×' | '÷'
export type Step = { op: Op; by: number }

export type FmConfig =
  /** steps: what each station does, in order. input: the number to find, which the learner never sees. */
  | { task: 'inverse'; steps: Step[]; input: number }
  /** The tile at step n count is times * n + plus; plus below zero leaves the first group short. */
  | { task: 'pattern'; times: number; plus: number }

/** inverse: x is the number fed in. pattern: x is the step shown, and a and b are the machine's two stations. */
export type FmState = { x: number; a: number; b: number }

export const OPS: Op[] = ['+', '−', '×', '÷']
export const STEPS_MAX = 3
export const X_MIN = -20
export const X_MAX = 50
/** The longest a number may be on a ticket, so that none is ever shrunk or split. */
export const TEXT_MAX = 6
export const OPERAND = { '+': [1, 50], '−': [1, 50], '×': [2, 10], '÷': [2, 10] } as const
export const STEP_MIN = 1
export const STEP_MAX = 6
export const TIMES_MIN = 1
export const TIMES_MAX = 5
export const PLUS_MIN = -4
export const PLUS_MAX = 6
/** What the machine's two dials can be turned to in the pattern task: a little beyond what a pattern uses. */
export const DIAL_A = { min: 1, max: 9 } as const
export const DIAL_B = { min: -4, max: 9 } as const

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

// ---------------------------------------------------------------------------
// Exact numbers.

export type Q = { n: number; d: number }
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))
const q = (n: number, d = 1): Q => {
  if (d < 0) { n = -n; d = -d }
  const g = gcd(n, d) || 1
  return { n: n / g, d: d / g }
}
const whole = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0)

export function applyStep(v: Q, s: Step): Q {
  const by = whole(s.by)
  switch (s.op) {
    case '+': return q(v.n + by * v.d, v.d)
    case '−': return q(v.n - by * v.d, v.d)
    case '×': return q(v.n * by, v.d)
    default: return q(v.n, v.d * (by === 0 ? 1 : by))
  }
}
/** The number undoes it: the step that takes the result back to what went in. */
export function undoOf(s: Step): Step {
  return { op: s.op === '+' ? '−' : s.op === '−' ? '+' : s.op === '×' ? '÷' : '×', by: s.by }
}

/** The number at each place on the belt: what was fed in, then what leaves each station. */
export function stages(steps: Step[], x: number): Q[] {
  const out: Q[] = [q(whole(x))]
  for (const s of steps) out.push(applyStep(out[out.length - 1], s))
  return out
}

/** A number as a ticket reads it: whole, a short decimal, or a fraction. Never longer than TEXT_MAX when faults has passed it. */
export function fmt(v: Q): string {
  const sign = v.n < 0 ? '−' : ''
  const n = Math.abs(v.n)
  if (v.d === 1) return `${sign}${n}`
  for (let k = 1; k <= 3; k++) {
    const ten = 10 ** k
    if (ten % v.d === 0) {
      const scaled = String(n * (ten / v.d)).padStart(k + 1, '0')
      return `${sign}${scaled.slice(0, -k)}.${scaled.slice(-k)}`
    }
  }
  return `${sign}${n}/${v.d}`
}
export const isWhole = (v: Q) => v.d === 1

export const opWord = (op: Op) => (op === '+' ? 'adds' : op === '−' ? 'takes away' : op === '×' ? 'multiplies by' : 'divides by')
export const stepText = (s: Step) => `${s.op}${s.by}`
/** What a station's plate reads: "×3". */
export const stepSpoken = (s: Step) => `${opWord(s.op)} ${s.by}`

export const outputOf = (steps: Step[], x: number): Q => stages(steps, x)[steps.length]

// ---------------------------------------------------------------------------
// The pattern.

export const tilesAt = (times: number, plus: number, n: number) => times * n + plus
/** The rule as a nth term is written: 3n + 2, n − 1, 4n. */
export function nthTerm(times: number, plus: number): string {
  const head = times === 1 ? 'n' : `${times}n`
  return plus === 0 ? head : plus > 0 ? `${head} + ${plus}` : `${head} − ${-plus}`
}
export const plusText = (b: number) => (b >= 0 ? `+${b}` : `−${-b}`)

// ---------------------------------------------------------------------------
// State, read safely.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export function readState(config: FmConfig, state: unknown): FmState {
  const s = (state && typeof state === 'object' ? state : {}) as Partial<FmState>
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback)
  if (config.task === 'inverse') {
    return { x: clamp(num(s.x, startOf(config)), X_MIN, X_MAX), a: 1, b: 0 }
  }
  return {
    x: clamp(num(s.x, STEP_MIN), STEP_MIN, STEP_MAX),
    a: clamp(num(s.a, DIAL_A.min), DIAL_A.min, DIAL_A.max),
    b: clamp(num(s.b, 0), DIAL_B.min, DIAL_B.max),
  }
}

/** Where the learner starts: nothing fed in, unless that is already the answer. */
function startOf(config: Extract<FmConfig, { task: 'inverse' }>): number {
  return config.input === 0 ? 1 : 0
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(config: FmConfig, state: FmState): boolean {
  const s = readState(config, state)
  return config.task === 'inverse' ? s.x === config.input : s.a === config.times && s.b === config.plus
}

/** The first step, from 1, at which the learner's machine and the pattern disagree; null when they never do. */
export function firstMiss(config: Extract<FmConfig, { task: 'pattern' }>, a: number, b: number): number | null {
  for (let n = STEP_MIN; n <= STEP_MAX; n++) if (tilesAt(a, b, n) !== tilesAt(config.times, config.plus, n)) return n
  return null
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card says nothing of it.

const tiles = (n: number) => `${n} ${n === 1 ? 'tile' : 'tiles'}`

export type Said = { lead: string; detail: string }

export function working(config: FmConfig, state: FmState): Said {
  if (config.task === 'inverse') {
    const want = outputOf(config.steps, config.input)
    let at = want
    const back: string[] = []
    for (let i = config.steps.length - 1; i >= 0; i--) {
      const u = undoOf(config.steps[i])
      const next = applyStep(at, u)
      back.push(`${fmt(at)} ${u.op} ${u.by} = ${fmt(next)}`)
      at = next
    }
    return {
      lead: `Yes. ${fmt(q(config.input))} goes in and ${fmt(want)} comes out.`,
      detail: `Run it backwards: undo each step, the last one first. ${back.join(', then ')}.`,
    }
  }
  const { times: a, plus: b } = config
  const group = a === 1 ? 'one more tile' : `one more group of ${a} tiles`
  const fixed = b > 0 ? `the ${tiles(b)} on the end never change` : b < 0 ? `the first group is always ${-b} short` : 'there are no extra tiles'
  return {
    lead: `Yes. The tiles in step n are ${nthTerm(a, b)}.`,
    detail: `Every step adds ${group}, and ${fixed}. Step 10 would have ${tiles(tilesAt(a, b, 10))}.`,
  }
}

export function madeText(config: FmConfig, state: FmState): string {
  const s = readState(config, state)
  if (config.task === 'inverse') {
    const out = outputOf(config.steps, s.x)
    const want = outputOf(config.steps, config.input)
    return `${fmt(q(s.x))} goes in and ${fmt(out)} comes out, but ${fmt(want)} was wanted.`
  }
  const miss = firstMiss(config, s.a, s.b)
  if (miss === null) return 'Your machine gives the right number of tiles at every step.'
  return `At step ${miss} your machine gives ${tilesAt(s.a, s.b, miss)}, but that figure has ${tiles(tilesAt(config.times, config.plus, miss))}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const norm = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '')
const keyed = (o: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (!has(out, norm(k))) out[norm(k)] = v
  return out
}
const pick = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const minus = (s: string) => s.replace(/[−–—]/g, '-')
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(minus(raw.trim()))
    return Number.isFinite(v) ? v : null
  }
  return null
}

const OP_WORDS: Record<string, Op> = {
  '+': '+', plus: '+', add: '+', adds: '+', addition: '+', adding: '+',
  '-': '−', minus: '−', subtract: '−', subtracts: '−', subtraction: '−', takeaway: '−', take: '−', less: '−',
  x: '×', '*': '×', times: '×', multiply: '×', multiplies: '×', multiplication: '×', multipliedby: '×', multiplyby: '×', mult: '×', lots: '×',
  '/': '÷', divide: '÷', divides: '÷', division: '÷', dividedby: '÷', divideby: '÷', over: '÷',
}
function readOp(raw: unknown): Op | null {
  if (typeof raw !== 'string') return null
  const key = minus(raw).trim().toLowerCase().replace('×', 'x').replace('÷', '/').replace(/[\s_]+/g, '')
  return has(OP_WORDS, key) ? OP_WORDS[key] : null
}

/** "×3", "x 3", "add 2", "multiply by 3", "take away 4", "double", "halve". */
function readStepText(text: string): Step | null {
  const t = minus(text).trim().toLowerCase().replace('×', 'x').replace('÷', '/')
  if (t === 'double' || t === 'doubled') return { op: '×', by: 2 }
  if (t === 'triple') return { op: '×', by: 3 }
  if (t === 'halve' || t === 'half') return { op: '÷', by: 2 }
  const m = t.match(/^(multiplied by|multiply by|multiply|times|take away|divided by|divide by|divide|subtract|minus|plus|add|over|x|\*|\/|\+|-)\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const op = readOp(m[1])
  return op ? { op, by: Number(m[2]) } : null
}

function readStep(raw: unknown): Step | null {
  if (typeof raw === 'string') return readStepText(raw)
  if (!raw || typeof raw !== 'object') return null
  const o = keyed(raw as Record<string, unknown>)
  const by = readNumber(pick(o, ['by', 'n', 'number', 'value', 'amount', 'operand', 'with', 'k']))
  const op = readOp(pick(o, ['op', 'operation', 'type', 'kind', 'symbol', 'do', 'operator']))
  if (op && by !== null) return { op, by }
  const text = pick(o, ['text', 'label', 'step'])
  return typeof text === 'string' ? readStepText(text) : null
}

function readSteps(raw: unknown): Step[] | null {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s*(?:,|;|->|→|=>|\bthen\b|\band then\b|\bafter that\b|\band\b)\s*/i).filter((p) => p.trim() !== '') : null
  if (!list) return null
  const out = list.map(readStep)
  return out.every((s): s is Step => s !== null) ? out : null
}

/** "3n + 2", "n - 1", "nth term 4n", "T(n) = 5n + 3". */
function readRule(raw: unknown): { times: number; plus: number } | null {
  if (typeof raw !== 'string') return null
  const m = minus(raw).toLowerCase().replace(/\s+/g, '').replace(/^(?:nthterm|nthtermis|t\(n\)|u\(n\)|a\(n\)|f\(n\)|tn|un|an|y)?=?/, '').match(/^(\d*)\*?n(?:([+-])(\d+))?$/)
  if (!m) return null
  return { times: m[1] === '' ? 1 : Number(m[1]), plus: m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0 }
}

/** An input for a machine that dividing leaves whole, when the tutor names none: small, and not zero. */
function defaultInput(steps: Step[]): number {
  for (const x of [4, 5, 6, 3, 7, 8, 9, 2, 10, 12, 1, 15, 20, 24, 30]) if (isWhole(outputOf(steps, x))) return x
  return 4
}

/** The number that makes a machine give `want`, found by undoing it; not a whole number when none is. */
function inputFor(steps: Step[], want: number): number {
  let at = q(want)
  for (let i = steps.length - 1; i >= 0; i--) at = applyStep(at, undoOf(steps[i]))
  return at.n / at.d
}

const TASK_WORDS: Record<string, 'inverse' | 'pattern'> = {
  inverse: 'inverse', inversefunction: 'inverse', inverses: 'inverse', functionmachine: 'inverse', machine: 'inverse', undo: 'inverse', reverse: 'inverse',
  backwards: 'inverse', workbackwards: 'inverse', findinput: 'inverse', findtheinput: 'inverse', input: 'inverse', solve: 'inverse', inverseoperations: 'inverse', oneinput: 'inverse',
  pattern: 'pattern', patterns: 'pattern', growingpattern: 'pattern', growingpatterns: 'pattern', nth: 'pattern', nthterm: 'pattern', sequence: 'pattern', sequences: 'pattern',
  grow: 'pattern', visualpattern: 'pattern', generalise: 'pattern', generalize: 'pattern', rule: 'pattern', linearsequence: 'pattern',
}

export const fmEngine: SceneEngine<FmConfig, FmState> = {
  id: 'function-machine',
  // Few and distinctive: any single word of a covers topic catches a station. Everything else is a whole phrase.
  covers: ['nth'],
  phrases: [
    'function machine', 'function machines', 'number machine', 'number machines', 'input output machine', 'input output machines',
    'inverse function', 'inverse functions', 'inverse operation', 'inverse operations', 'inverse of a function', 'composite and inverse functions', 'composite functions', 'mappings', 'mapping diagrams', 'functions and mappings', 'mappings and functions',
    'linear functions', 'numerical functions', 'functions and relations', 'relations and functions', 'formulae and functions', 'function notation', 'nth term', 'nth terms', 'finding the nth term', 'term to term rule', 'position to term rule', 'position to term rules', 'term to term rules',
    'linear sequence', 'linear sequences', 'arithmetic sequence', 'arithmetic sequences', 'number sequence', 'number sequences', 'generating sequences', 'sequence rules',
    'sequences surds sets', 'growing pattern', 'growing patterns', 'number pattern', 'number patterns', 'patterns and sequences', 'sequences and patterns', 'pattern rules', 'visual patterns',
    'shape patterns', 'matchstick patterns', 'tile patterns', 'generalising patterns', 'generalising number patterns',
  ],
  // Near misses: "function" and "pattern" in other subjects, and the harder functions this machine cannot show.
  notFor: [
    'structure and function', 'form and function', 'body functions', 'functions of money',
    'management functions', 'business functions', 'language functions', 
    'c++', 'c programming', 'programming', 'python', 'visual basic', 'vb', 'subroutine', 'subroutines', 'procedures and functions', 'user defined functions', 'spreadsheet', 'spreadsheets', 'excel', 'formulas and functions',
    'functional components', 'functional skills', 'functional', 'functionalism', 'state functions', 'trigonometric functions', 'trig functions', 'inverse trigonometric', 'exponential functions', 'logarithmic functions',
    'exponential and logarithmic', 'logarithmic and exponential', 'polynomial functions', 'rational functions', 'irrational functions', 'quadratic functions', 'periodic functions', 'hyperbolic functions', 'differentiation', 'integration', 'calculus', 'derivative', 'derivatives', 'vitamins', 'minerals', 'nutrients', 'proteins', 'hormones', 'enzymes', 'organs', 'organ', 'kidney', 'liver', 'heart', 'brain',
    'skeleton', 'cell', 'cells', 'plant parts', 'institutions', 'traditional', 'marketing',
    'inverse proportion', 'inverse square', 'inverse matrix', 'inverse matrices', 'inverse variation', 'inversely proportional', 'inverse relationship', 'inversion',
    'position direction', 'position and direction', 'pattern recognition', 'weaving', 'motifs', 'design process', 'tie and dye', 'batik', 'printing patterns', 'speech patterns', 'sentence patterns',
    'patterns of disease', 'patterns in nature', 'weather patterns', 'climate patterns', 'migration patterns', 'settlement patterns', 'population patterns', 'behaviour patterns', 'drainage patterns', 'rhythm patterns',
    'mapping skills', 'map skills', 'map reading', 'gis',
    'process sequence', 'sequence of events', 'sequencing', 'dna sequence', 'dna sequences', 'base sequence', 'sequence of instructions', 'algorithm', 'algorithms',
  ],
  // What the learner varies is what goes in; what follows from it is what comes out.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = keyed(raw as Record<string, unknown>)
    const nested = o.task && typeof o.task === 'object' ? keyed(o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = norm(String(pick(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']) ?? ''))
    const rawSteps = pick(src, ['steps', 'machine', 'operations', 'chain', 'stations', 'blocks', 'ops', 'functionmachine'])
    const steps = rawSteps === undefined ? undefined : readSteps(rawSteps)
    if (steps === null) return null
    const rule = readRule(pick(src, ['rule', 'nthterm', 'nth', 'formula', 'expression', 'pattern', 'term', 'tn']))
    const first = readNumber(pick(src, ['first', 'firstterm', 'start']))
    const diff = readNumber(pick(src, ['difference', 'commondifference', 'step', 'perstep', 'each', 'diff']))
    const rawTimes = readNumber(pick(src, ['times', 'multiplier', 'groups', 'per', 'a', 'coefficient', 'groupsize', 'multiply']))
    const rawPlus = readNumber(pick(src, ['plus', 'extra', 'constant', 'b', 'add', 'extras', 'fixed']))
    const times = rule ? rule.times : rawTimes ?? (diff !== null ? diff : null)
    const plus = rule ? rule.plus : rawPlus ?? (first !== null && diff !== null ? first - diff : null)
    const hasInverse = steps !== undefined
    const hasPattern = times !== null || rule !== null
    const kind = hasInverse && !hasPattern ? 'inverse' : hasPattern && !hasInverse ? 'pattern' : hasInverse && hasPattern ? (has(TASK_WORDS, word) ? TASK_WORDS[word] : 'inverse') : null
    if (kind === 'pattern') {
      if (times === null) return null
      return { task: 'pattern', times, plus: plus ?? 0 }
    }
    if (kind === 'inverse' && steps) {
      const given = readNumber(pick(src, ['input', 'secret', 'answer', 'in', 'x', 'number', 'startingnumber', 'startnumber', 'start', 'firstnumber']))
      if (given !== null) return { task: 'inverse', steps, input: given }
      const want = readNumber(pick(src, ['output', 'result', 'target', 'out', 'wanted', 'want', 'goal']))
      // A target no whole number reaches is kept as the fraction that does, and faults says so.
      if (want !== null) return { task: 'inverse', steps, input: inputFor(steps, want) }
      return { task: 'inverse', steps, input: defaultInput(steps) }
    }
    return null
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'pattern') {
      const { times: a, plus: b } = config
      if (!Number.isInteger(a) || !Number.isInteger(b)) out.push(`times ${a} and plus ${b} must be whole numbers, because tiles are whole: use e.g. times 3 plus 2.`)
      else {
        if (a < TIMES_MIN || a > TIMES_MAX) out.push(`times ${a} is outside what the pattern draws (${TIMES_MIN} to ${TIMES_MAX} tiles in each group): use e.g. times ${clamp(a, TIMES_MIN, TIMES_MAX)}.`)
        if (b < PLUS_MIN || b > PLUS_MAX) out.push(`plus ${b} is outside what the pattern draws (${PLUS_MIN} to ${PLUS_MAX}): use e.g. plus ${clamp(b, PLUS_MIN, PLUS_MAX)}.`)
        if (a >= TIMES_MIN && a <= TIMES_MAX && b < 0 && -b > a - 1) out.push(`times ${a} with plus ${b} leaves no tile in the first figure: take away fewer than ${a}, e.g. plus ${-(a - 1)}.`)
        if (a === 1 && b === 0) out.push('times 1 and plus 0 is just the step number, with nothing to find: use e.g. times 3 plus 2.')
      }
      return out
    }
    const { steps, input } = config
    if (steps.length === 0) return ['The machine has no steps: give it one to three, e.g. steps ["×3", "+2"].']
    if (steps.length > STEPS_MAX) return [`The machine has ${steps.length} steps, and the card draws up to ${STEPS_MAX}: use e.g. steps ["×3", "+2"].`]
    for (const s of steps) {
      if (!Number.isInteger(s.by)) out.push(`${s.op}${s.by} is not a whole number: every step uses a whole number, e.g. ${s.op}${s.op === '×' || s.op === '÷' ? 3 : 2}.`)
      else {
        const [lo, hi] = OPERAND[s.op]
        if (s.by < lo || s.by > hi) out.push(`${s.op}${s.by} is outside what a station takes (${s.op} ${lo} to ${hi}): use e.g. ${s.op}${clamp(s.by, lo, hi)}${s.by < 0 ? ', and a minus step for taking away' : ''}.`)
      }
    }
    if (out.length) return out
    if (!Number.isInteger(input)) {
      const example = [4, 5, 6, 3].find((x) => isWhole(outputOf(steps, x))) ?? 4
      out.push(`No whole number goes in to give that output, and the learner can feed in only whole numbers: use e.g. input ${example}, which gives ${fmt(outputOf(steps, example))}.`)
      return out
    }
    if (input < X_MIN || input > X_MAX) out.push(`input ${input} is outside what the learner can feed in (${X_MIN} to ${X_MAX}): use e.g. input ${clamp(input, X_MIN, X_MAX)}.`)
    if (!isWhole(outputOf(steps, input))) {
      const example = [4, 5, 6, 3, 8, 12].find((x) => isWhole(outputOf(steps, x))) ?? 4
      out.push(`input ${input} gives ${fmt(outputOf(steps, input))} at the tray, which is not whole: choose an input the divisions leave whole, e.g. input ${example}.`)
    }
    // The ticket must fit, for every number the learner can feed in.
    let long = ''
    for (let x = X_MIN; x <= X_MAX && !long; x++) for (const v of stages(steps, x)) if (fmt(v).length > TEXT_MAX) { long = fmt(v); break }
    if (long) out.push(`Numbers on the tickets get too long (like ${long}): use fewer divisions, or smaller numbers, e.g. steps ["×3", "+2"].`)
    const same = [0, 1, 7].every((x) => { const v = outputOf(steps, x); return v.n === x && v.d === 1 })
    if (same) out.push('This machine gives back what goes in, so there is nothing to find: use e.g. steps ["×3", "+2"].')
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const example = goodPrompt(config)
    if (config.task === 'inverse') {
      const numbers = [...text.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])/g)].map((m) => Number(m[0]))
      const known = new Set<number>([...config.steps.map((s) => s.by), ...stages(config.steps, config.input).filter(isWhole).map((v) => v.n).slice(1)])
      if (numbers.includes(config.input) && !known.has(config.input)) out.push(`the prompt gives the answer away: it names the number that goes in, which the learner is to find -- ask for the outcome only ("${example}")`)
      if (/\binverse\b|\bundo\b|\bun-?do(?:ing)?\b|\bbackwards?\b|\bwork(?:ing)? back\b|\breverse\b|\bopposite\b|\bretrace\b/i.test(text)) {
        out.push(`the prompt gives the method away: it says to undo, reverse or work backwards, which is what marking says once the learner has found the number -- ask for the outcome only ("${example}")`)
      }
    } else {
      const { times: a, plus: b } = config
      const expr = /\b\d*\s*n\s*[+\-−–]\s*\d+\b|\bn\s*[×x*]\s*\d+\b|\b\d+\s*[×x*]\s*n\b|\b\d+n\b/i.test(text)
      const spoken = new RegExp(`\\b(?:times|multiply(?:ing)?(?: by)?|multiplied by|add(?:s|ing)?|plus|x|×)\\s*(?:by\\s*)?(?:${[a, b].filter((v) => v !== 0).map((v) => String(Math.abs(v))).join('|') || '999'})\\b`, 'i').test(text)
      const method = /\bcommon difference\b|\bdifference between\b|\bgoes? up by\b|\bgrows? by\b|\bincreases? by\b|\b(?:each|every|next) (?:step|figure|pattern|term)\b[^.]*\b(?:adds?|gets|has|goes)\b[^.]*\d|\bconstant\b|\bgroups? of\b|\bextra tiles?\b|\bmultiplier\b|\bcoefficient\b/i.test(text)
      if (expr || spoken || method) out.push(`the prompt gives the answer away: it says the rule, or how the pattern grows, which the learner is to find with the machine -- ask for the outcome only ("${example}")`)
    }
    if (/\bdrag\b|\bslide\b|\bgraph\b|\bplot\b|\bcoordinates?\b|\baxes\b|\baxis\b|\btable of values\b|\bdraw\b|\bsketch\b|\bwrite (?:down )?the (?:rule|expression|formula)\b|\bblocks?\b|\bgears?\b|\bleve?rs?\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has a machine with steppers and, for a pattern, tiles -- no graph, table or dragging, and the learner does not write the rule: ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'inverse' ? { x: startOf(config), a: 1, b: 0 } : { x: STEP_MIN, a: DIAL_A.min, b: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    return config.task === 'inverse' ? { x: config.input, a: 1, b: 0 } : { x: STEP_MIN, a: config.times, b: config.plus }
  },

  View: FunctionMachineView,

  prompt: `SCENE "function-machine" -- a real machine on a quiet light panel: a hopper, a belt with one to three stations on it, and a tray. A paper ticket with a number rides the belt, and its number changes under each station, which shows its sum on a plate (like "×3"). The learner works the machine with steppers (a real button either side of a number); each change sends a new ticket through.
  For: function machines, input and output, mappings, inverse functions and inverse operations, number patterns and growing patterns, finding the nth term of a linear sequence (the rule "times a, then add b"). It answers "the nth term is the first term" and "the constant is the common difference", because the pattern draws the constant as tiles that never change.
  inverse: the machine and the number WANTED at the tray (a dashed ticket) are shown. The learner feeds numbers in with a stepper and watches each ticket ride through, small tickets under the stations showing the number after each step, and finds the number that gives the wanted one. steps: one to three, each a plain string "×3", "+2", "−5", "÷4" (× and ÷ by 2 to 10, + and − by 1 to 50). input: the hidden number to find, a whole number from -20 to 50 which the learner never sees; with a ÷ it must leave a whole number at the tray. The tutor gives the machine and that number, never the wanted output. Before marking the card shows the machine, the number fed in, the number out and the number wanted; it holds back which number to feed. Marking says the number and the machine run backwards.
  pattern: a growing pattern of tiles, a step stepper (1 to 6) that grows it one figure at a time, and a machine with a times dial and an add dial for the learner to set until the machine's tray gives the tiles in every step. times: the tiles in each group, 1 to 5. plus: the tiles that never change, -4 to 6; a negative plus leaves the first group short, drawn with dashed outlines of what is missing (|plus| at most times - 1). times 1 with plus 0 is refused. The tutor gives these two numbers, which are the rule (the nth term is times n plus plus). Before marking the card shows the figure, its tile count, and the machine's answer for that step; it holds back the rule. Marking says it in full, with the nth term, and when wrong says the first step where the machine and the figure disagree.
  Not drawn: graphs and tables of values (that is the coordinate plane), squaring, roots and other machines that cannot be run backwards, a machine built from blocks, quadratic patterns, and functions in programming or spreadsheets. The prompt must ask for the outcome only: do NOT name the number to feed, say to undo, reverse or work backwards, write the rule or the nth term, or say how the pattern grows.
  config: { "task":"inverse", "steps":["×3","+2"], "input":5 }  -- the prompt says "Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out."
       or { "task":"inverse", "steps":["−4","÷3"], "input":16 }  -- the same prompt
       or { "task":"pattern", "times":3, "plus":2 }  -- the prompt says "Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step."
       or { "task":"pattern", "times":4, "plus":-1 }  -- the same prompt
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.",
    "payload": { "engine":"function-machine", "config": { "task":"inverse", "steps":["×3","+2"], "input":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:function-machine", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.",
    "payload": { "engine":"function-machine", "config": { "task":"inverse", "steps":["−4","÷3"], "input":16 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:function-machine", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step.",
    "payload": { "engine":"function-machine", "config": { "task":"pattern", "times":3, "plus":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:function-machine", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step.",
    "payload": { "engine":"function-machine", "config": { "task":"pattern", "times":4, "plus":-1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:function-machine", "why":"..." } }`,
}

/** What a prompt can safely say: the gesture and the aim, never the number or the rule. */
function goodPrompt(config: FmConfig): string {
  return config.task === 'inverse'
    ? 'Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.'
    : 'Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step.'
}

registerEngine(fmEngine as SceneEngine<unknown, unknown>)
