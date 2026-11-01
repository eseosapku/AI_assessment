// lib/studylab/engines/algorithm-tracer/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { AlgorithmTracerView } from './View'

/**
 * Short algorithms in pseudocode, traced the way Cambridge examines them:
 * IGCSE Computer Science 0478 and O Level Computer Science 2210, "Algorithm
 * design and problem-solving" -- trace tables, completing and correcting
 * algorithms, and the standard algorithms: totalling, counting, finding the
 * maximum and the minimum, linear search and bubble sort. The pseudocode follows
 * the syllabus's own guide: DECLARE, the assignment arrow, FOR ... TO ... NEXT,
 * WHILE ... DO ... ENDWHILE, IF ... THEN ... ELSE ... ENDIF, OUTPUT, arrays
 * counted from 1, and the keywords in capitals.
 *
 * The tutor never writes code. It names an algorithm from the library below and
 * gives it a few numbers; the engine writes the pseudocode (from a small syntax
 * tree it owns) and runs that same tree to get the true trace, so the listing
 * the learner reads and the answer they are marked against cannot disagree.
 * For a fault task one line of the tree is swapped for a known mistake from a
 * short fixed list ("<" for ">", a counter set to 1 instead of added to, a loop
 * that stops a place early) and the learner taps the line.
 *
 * Everything is whole numbers from 0 to 99, so marking is exact integer and
 * text comparison and never touches a float.
 */

export const KINDS = ['trace', 'predict', 'fault'] as const
export type Kind = (typeof KINDS)[number]
export const ALGORITHMS = ['total', 'count', 'maximum', 'minimum', 'linear-search', 'bubble-pass'] as const
export type AlgoId = (typeof ALGORITHMS)[number]

/** How many values Data may hold; a bubble sort pass has a column for each, so it takes fewer. */
export const MIN_ITEMS = 3
export const MAX_ITEMS = 8
export const MAX_SORT_ITEMS = 6
export const MAX_VALUE = 99
/** The longest trace table a card draws. */
export const MAX_ROWS = 25
/** The widest a line of pseudocode may be, indent included: it must fit the card at 12px without wrapping. */
export const MAX_LINE_CHARS = 42

export type BugId =
  | 'total-starts-at-one' | 'total-adds-index' | 'total-skips-first' | 'total-skips-last'
  | 'count-ge' | 'count-less' | 'count-starts-at-one' | 'count-not-incremented'
  | 'max-wrong-way' | 'max-skips-last' | 'max-stores-index'
  | 'min-wrong-way' | 'min-skips-last' | 'min-stores-index' | 'min-starts-at-zero'
  | 'search-stops-early' | 'search-not-equal' | 'search-starts-at-two' | 'search-output-off-by-one'
  | 'bubble-wrong-way' | 'bubble-loses-value' | 'bubble-stops-early'

export type Task = {
  kind: Kind
  algorithm: AlgoId
  values: number[]
  /** linear search: the value looked for. */
  target?: number
  /** count: values greater than this are counted. */
  limit?: number
  /** fault: the mistake planted in the listing. */
  bug?: BugId
  /** What parse could not read, for faults() to say. */
  unread?: string[]
}
export type AlgorithmTracerConfig = { task: Task }

/**
 * `cells` holds what is typed, by `${row}:${column}` (a trace table) or `p0`,
 * `p1` ... (a prediction). `pick` is the line tapped in a fault task.
 */
export type AlgorithmTracerState = { cells: Record<string, string>; pick: number | null }

const MINUS = '−'

export const NAMES: Record<AlgoId, string> = {
  'total': 'Totalling',
  'count': 'Counting',
  'maximum': 'Finding the maximum',
  'minimum': 'Finding the minimum',
  'linear-search': 'Linear search',
  'bubble-pass': 'One pass of a bubble sort',
}

// ---------------------------------------------------------------------------
// The pseudocode: a tiny syntax tree the engine owns.

type Op = '+' | '-' | '<' | '>' | '<=' | '>=' | '=' | '<>' | 'AND'
type Expr =
  | { t: 'num'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'str'; v: string }
  | { t: 'var'; name: string }
  | { t: 'at'; i: Expr }
  | { t: 'bin'; op: Op; l: Expr; r: Expr }

type Stmt = { id: string; bug?: true } & (
  | { k: 'assign'; to: Expr; value: Expr }
  | { k: 'for'; v: string; from: Expr; to: Expr; body: Stmt[] }
  | { k: 'while'; cond: Expr; body: Stmt[] }
  | { k: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[] }
  | { k: 'output'; value: Expr }
)

type Decl = { name: string; type: 'INTEGER' | 'BOOLEAN'; size?: number }

export type ColKind = 'int' | 'bool' | 'out'
/** One column of the trace table: a variable, one place of the array, or the OUTPUT. */
export type Column = { id: string; label: string; kind: ColKind }

/**
 * A program is a few statements, then the one loop whose passes are the table's
 * rows, then a few more. `startGiven`: the table opens with the array as given.
 */
type Program = { decls: Decl[]; pre: Stmt[]; loop: Stmt; post: Stmt[]; columns: Column[]; startGiven: boolean }

const num = (v: number): Expr => ({ t: 'num', v })
const vr = (name: string): Expr => ({ t: 'var', name })
const at = (i: Expr): Expr => ({ t: 'at', i })
const bin = (op: Op, l: Expr, r: Expr): Expr => ({ t: 'bin', op, l, r })
const TRUE: Expr = { t: 'bool', v: true }
const FALSE: Expr = { t: 'bool', v: false }

const OUT_COL: Column = { id: 'OUTPUT', label: 'OUTPUT', kind: 'out' }
const col = (id: string, kind: ColKind = 'int'): Column => ({ id, label: id, kind })

export type BugInfo = {
  id: BugId
  algorithm: AlgoId
  /** Said once the fault is found: what is wrong with the line. */
  what: string
  /** What a prompt must not say, or it points at the fault. */
  words: RegExp
}

const SKIP_FIRST = /\b(?:skips?|misses?|ignores?|never\s+(?:adds?|checks?|compares?|looks?\s+at))\b[^.?!]{0,25}\bfirst\b|\bstarts?\s+(?:at|from)\s+(?:2|two)\b/i
const SKIP_LAST = /\b(?:skips?|misses?|ignores?|never\s+(?:adds?|checks?|compares?|looks?\s+at))\b[^.?!]{0,25}\blast\b|\b(?:stops?|ends?|finishes?)\s+(?:one\s+(?:place\s+|step\s+)?)?(?:early|short)\b|\bone\s+(?:place|step)\s+(?:early|short)\b|\boff[- ]by[- ]one\b/i
const WRONG_OP = /(?:<=|>=|≤|≥|<>|≠)|\b(?:wrong|incorrect|different|opposite|reversed)\s+(?:comparison|operator|sign|way|direction)\b|\b(?:less|greater|bigger|smaller)\s+than\b[^.?!]{0,20}\binstead\b|\binstead\s+of\s+(?:<|>|=|greater|less)/i
const STORES_INDEX = /\b(?:stores?|keeps?|saves?|sets?|adds?|outputs?)\s+(?:the\s+)?(?:index|position)\b|\bindex\b[^.?!]{0,15}\binstead\s+of\b|\binstead\s+of\s+(?:the\s+)?(?:value|data)/i
const STARTS_WRONG = /\b(?:starts?|begins?|initiali[sz]\w*|set\s+to)\b[^.?!]{0,30}\b(?:1|one|0|zero)\b/i

export const BUGS: BugInfo[] = [
  { id: 'total-starts-at-one', algorithm: 'total', what: 'Total starts at 1, so every total comes out 1 too big. A running total starts at 0.', words: STARTS_WRONG },
  { id: 'total-adds-index', algorithm: 'total', what: 'It adds Index, the position, instead of Data[Index], the value stored there.', words: STORES_INDEX },
  { id: 'total-skips-first', algorithm: 'total', what: 'The loop starts at 2, so Data[1] is never added.', words: SKIP_FIRST },
  { id: 'total-skips-last', algorithm: 'total', what: 'The loop stops one place early, so the last value is never added.', words: SKIP_LAST },
  { id: 'count-ge', algorithm: 'count', what: 'It uses >= so a value equal to Limit is counted too; only the values greater than Limit should be.', words: WRONG_OP },
  { id: 'count-less', algorithm: 'count', what: 'It uses < so it counts the values below Limit, not the values above it.', words: WRONG_OP },
  { id: 'count-starts-at-one', algorithm: 'count', what: 'Count starts at 1, so the count is always 1 too big. A counter starts at 0.', words: STARTS_WRONG },
  { id: 'count-not-incremented', algorithm: 'count', what: 'Count is set to 1 each time instead of going up by 1 (Count ← Count + 1), so it can never get past 1.', words: /\b(?:not|never|doesn['’]?t|isn['’]?t)\s+(?:be\s+)?(?:increment|add|go\s+up|increase|count)\w*|\bset\s+to\s+(?:1|one)\b|\bcounter\b[^.?!]{0,20}\b(?:reset|stuck|stays)\b/i },
  { id: 'max-wrong-way', algorithm: 'maximum', what: 'It uses < so it keeps the smallest value it has seen, not the largest.', words: WRONG_OP },
  { id: 'max-skips-last', algorithm: 'maximum', what: 'The loop stops one place early, so the last value is never compared.', words: SKIP_LAST },
  { id: 'max-stores-index', algorithm: 'maximum', what: 'It stores Index, the position, instead of Data[Index], the value stored there.', words: STORES_INDEX },
  { id: 'min-wrong-way', algorithm: 'minimum', what: 'It uses > so it keeps the largest value it has seen, not the smallest.', words: WRONG_OP },
  { id: 'min-skips-last', algorithm: 'minimum', what: 'The loop stops one place early, so the last value is never compared.', words: SKIP_LAST },
  { id: 'min-stores-index', algorithm: 'minimum', what: 'It stores Index, the position, instead of Data[Index], the value stored there.', words: STORES_INDEX },
  { id: 'min-starts-at-zero', algorithm: 'minimum', what: 'Min starts at 0, which is smaller than every value, so nothing can replace it. It must start as the first value, Data[1].', words: STARTS_WRONG },
  { id: 'search-stops-early', algorithm: 'linear-search', what: 'The loop test uses < so the loop stops when Index reaches the last position, before Data[Index] is checked.', words: WRONG_OP },
  { id: 'search-not-equal', algorithm: 'linear-search', what: 'It tests <> (not equal), so it stops at the first value that is not the target.', words: WRONG_OP },
  { id: 'search-starts-at-two', algorithm: 'linear-search', what: 'Index starts at 2, so Data[1] is never checked.', words: SKIP_FIRST },
  { id: 'search-output-off-by-one', algorithm: 'linear-search', what: 'It outputs Index + 1, one more than the position where the target was found.', words: /\bone\s+(?:more|too\s+(?:big|high|many|large))\b|\boff[- ]by[- ]one\b|\bindex\s*\+\s*1\b/i },
  { id: 'bubble-wrong-way', algorithm: 'bubble-pass', what: 'It uses < so it swaps when the left value is smaller, moving the smallest value to the end instead of the largest.', words: WRONG_OP },
  { id: 'bubble-loses-value', algorithm: 'bubble-pass', what: 'The last swap line copies Data[Index] instead of Temp. By then Data[Index] has been overwritten, so one value is lost and another is copied twice.', words: /\btemp\b|\b(?:lost|loses|overwrit\w*|duplicat\w*|copied\s+twice)\b/i },
  { id: 'bubble-stops-early', algorithm: 'bubble-pass', what: 'The loop stops one place early, so the last pair is never compared.', words: SKIP_LAST },
]

const bugsOf = (algo: AlgoId) => BUGS.filter((b) => b.algorithm === algo)
const BUG_INFO = new Map(BUGS.map((b) => [b.id, b]))

type Build = { n: number; bug?: BugId }

/** The library: each algorithm as a program, with at most one planted bug. */
function buildProgram(algo: AlgoId, { n, bug }: Build): Program {
  let k = 0
  const id = () => `s${k++}`
  const flag = (b: BugId, s: Stmt): Stmt => (bug === b ? { ...s, bug: true } : s)
  const assign = (name: string, value: Expr): Stmt => ({ id: id(), k: 'assign', to: vr(name), value })
  const assignAt = (i: Expr, value: Expr): Stmt => ({ id: id(), k: 'assign', to: at(i), value })
  const forLoop = (v: string, from: Expr, to: Expr, body: Stmt[]): Stmt => ({ id: id(), k: 'for', v, from, to, body })
  const whileLoop = (cond: Expr, body: Stmt[]): Stmt => ({ id: id(), k: 'while', cond, body })
  const ifThen = (cond: Expr, then: Stmt[], els?: Stmt[]): Stmt => ({ id: id(), k: 'if', cond, then, ...(els ? { else: els } : {}) })
  const output = (value: Expr): Stmt => ({ id: id(), k: 'output', value })
  const array: Decl = { name: 'Data', type: 'INTEGER', size: n }
  const int = (name: string): Decl => ({ name, type: 'INTEGER' })
  const index = vr('Index')

  switch (algo) {
    case 'total': {
      const start = flag('total-starts-at-one', assign('Total', num(bug === 'total-starts-at-one' ? 1 : 0)))
      const add = flag('total-adds-index', assign('Total', bin('+', vr('Total'), bug === 'total-adds-index' ? index : at(index))))
      const loop = flag('total-skips-last', flag('total-skips-first',
        forLoop('Index', num(bug === 'total-skips-first' ? 2 : 1), num(bug === 'total-skips-last' ? n - 1 : n), [add])))
      return { decls: [array, int('Total'), int('Index')], pre: [start], loop, post: [output(vr('Total'))], columns: [col('Total'), OUT_COL], startGiven: false }
    }
    case 'count': {
      const start = flag('count-starts-at-one', assign('Count', num(bug === 'count-starts-at-one' ? 1 : 0)))
      const bump = flag('count-not-incremented', assign('Count', bug === 'count-not-incremented' ? num(1) : bin('+', vr('Count'), num(1))))
      const op: Op = bug === 'count-ge' ? '>=' : bug === 'count-less' ? '<' : '>'
      const test = flag('count-less', flag('count-ge', ifThen(bin(op, at(index), vr('Limit')), [bump])))
      const loop = forLoop('Index', num(1), num(n), [test])
      return { decls: [array, int('Limit'), int('Count'), int('Index')], pre: [start], loop, post: [output(vr('Count'))], columns: [col('Count'), OUT_COL], startGiven: false }
    }
    case 'maximum':
    case 'minimum': {
      const big = algo === 'maximum'
      const name = big ? 'Max' : 'Min'
      const p = big ? 'max' : 'min'
      const start = flag(`${p}-starts-at-zero` as BugId, assign(name, bug === 'min-starts-at-zero' ? num(0) : at(num(1))))
      const keep = flag(`${p}-stores-index` as BugId, assign(name, bug === `${p}-stores-index` ? index : at(index)))
      const wrong = bug === `${p}-wrong-way`
      const test = flag(`${p}-wrong-way` as BugId, ifThen(bin(big !== wrong ? '>' : '<', at(index), vr(name)), [keep]))
      const loop = flag(`${p}-skips-last` as BugId, forLoop('Index', num(2), num(bug === `${p}-skips-last` ? n - 1 : n), [test]))
      return { decls: [array, int(name), int('Index')], pre: [start], loop, post: [output(vr(name))], columns: [col(name), OUT_COL], startGiven: false }
    }
    case 'linear-search': {
      const found = assign('Found', FALSE)
      const first = flag('search-starts-at-two', assign('Index', num(bug === 'search-starts-at-two' ? 2 : 1)))
      const hit = assign('Found', TRUE)
      const step = assign('Index', bin('+', index, num(1)))
      const test = flag('search-not-equal', ifThen(bin(bug === 'search-not-equal' ? '<>' : '=', at(index), vr('Target')), [hit], [step]))
      const loop = flag('search-stops-early', whileLoop(bin('AND', bin(bug === 'search-stops-early' ? '<' : '<=', index, num(n)), bin('=', vr('Found'), FALSE)), [test]))
      const say = flag('search-output-off-by-one', output(bug === 'search-output-off-by-one' ? bin('+', index, num(1)) : index))
      const verdict = ifThen(bin('=', vr('Found'), TRUE), [say], [output({ t: 'str', v: 'Not found' })])
      return {
        decls: [array, int('Target'), int('Index'), { name: 'Found', type: 'BOOLEAN' }],
        pre: [found, first], loop, post: [verdict],
        columns: [col('Index'), col('Found', 'bool'), OUT_COL], startGiven: false,
      }
    }
    case 'bubble-pass': {
      const keepLeft = assign('Temp', at(index))
      const moveRight = assignAt(index, at(bin('+', index, num(1))))
      const drop = flag('bubble-loses-value', assignAt(bin('+', index, num(1)), bug === 'bubble-loses-value' ? at(index) : vr('Temp')))
      const test = flag('bubble-wrong-way', ifThen(bin(bug === 'bubble-wrong-way' ? '<' : '>', at(index), at(bin('+', index, num(1)))), [keepLeft, moveRight, drop]))
      const loop = flag('bubble-stops-early', forLoop('Index', num(1), num(bug === 'bubble-stops-early' ? n - 2 : n - 1), [test]))
      return {
        decls: [array, int('Temp'), int('Index')],
        pre: [], loop, post: [],
        columns: [col('Temp'), ...Array.from({ length: n }, (_, i): Column => ({ id: `D${i + 1}`, label: `Data[${i + 1}]`, kind: 'int' }))],
        startGiven: true,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Writing the pseudocode out.

export type Role = 'declare' | 'assign' | 'for' | 'next' | 'while' | 'endwhile' | 'if' | 'else' | 'endif' | 'output'
export type Line = { n: number; depth: number; text: string; role: Role; id: string }

function exprText(e: Expr): string {
  switch (e.t) {
    case 'num': return `${e.v}`
    case 'bool': return e.v ? 'TRUE' : 'FALSE'
    case 'str': return `"${e.v}"`
    case 'var': return e.name
    case 'at': return `Data[${exprText(e.i)}]`
    case 'bin': return `${exprText(e.l)} ${e.op} ${exprText(e.r)}`
  }
}

type Rendered = { lines: Line[]; head: Map<string, number>; span: Map<string, [number, number]> }

function render(p: Program): Rendered {
  const lines: Line[] = []
  const head = new Map<string, number>()
  const span = new Map<string, [number, number]>()
  const push = (depth: number, text: string, role: Role, id: string) => {
    lines.push({ n: lines.length + 1, depth, text, role, id })
  }
  p.decls.forEach((d, i) => {
    push(0, `DECLARE ${d.name} : ${d.size ? `ARRAY[1:${d.size}] OF ` : ''}${d.type}`, 'declare', `d${i}`)
  })
  const walk = (stmts: Stmt[], depth: number) => {
    for (const s of stmts) {
      const first = lines.length + 1
      head.set(s.id, first)
      if (s.k === 'assign') push(depth, `${exprText(s.to)} ← ${exprText(s.value)}`, 'assign', s.id)
      else if (s.k === 'output') push(depth, `OUTPUT ${exprText(s.value)}`, 'output', s.id)
      else if (s.k === 'for') {
        push(depth, `FOR ${s.v} ← ${exprText(s.from)} TO ${exprText(s.to)}`, 'for', s.id)
        walk(s.body, depth + 1)
        push(depth, `NEXT ${s.v}`, 'next', s.id)
      } else if (s.k === 'while') {
        push(depth, `WHILE ${exprText(s.cond)} DO`, 'while', s.id)
        walk(s.body, depth + 1)
        push(depth, 'ENDWHILE', 'endwhile', s.id)
      } else {
        push(depth, `IF ${exprText(s.cond)} THEN`, 'if', s.id)
        walk(s.then, depth + 1)
        if (s.else) {
          push(depth, 'ELSE', 'else', s.id)
          walk(s.else, depth + 1)
        }
        push(depth, 'ENDIF', 'endif', s.id)
      }
      span.set(s.id, [first, lines.length])
    }
  }
  walk([...p.pre, p.loop, ...p.post], 0)
  return { lines, head, span }
}

/** A line as it is set out: three spaces to a level. */
export const lineText = (l: Line) => `${'   '.repeat(l.depth)}${l.text}`

// ---------------------------------------------------------------------------
// Running it: the true trace.

type Val = number | boolean | string
type Env = { vars: Map<string, Val>; data: number[]; out: string[] }
type Event = { target: string; line: number }
type Ctx = { head: Map<string, number>; events: Event[]; rowOut: string[]; budget: number }

const showVal = (v: Val): string => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `${v}`)

function evalE(e: Expr, env: Env): Val {
  switch (e.t) {
    case 'num': case 'bool': case 'str': return e.v
    case 'var': {
      const v = env.vars.get(e.name)
      if (v === undefined) throw new Error(`${e.name} has no value yet`)
      return v
    }
    case 'at': {
      const i = evalE(e.i, env)
      if (typeof i !== 'number' || i < 1 || i > env.data.length) throw new Error(`Data[${showVal(i)}] is outside the array`)
      return env.data[i - 1]
    }
    case 'bin': {
      const a = evalE(e.l, env)
      const b = evalE(e.r, env)
      switch (e.op) {
        case '+': return (a as number) + (b as number)
        case '-': return (a as number) - (b as number)
        case '<': return (a as number) < (b as number)
        case '>': return (a as number) > (b as number)
        case '<=': return (a as number) <= (b as number)
        case '>=': return (a as number) >= (b as number)
        case '=': return a === b
        case '<>': return a !== b
        case 'AND': return a === true && b === true
      }
    }
  }
}

function exec(stmts: Stmt[], env: Env, ctx: Ctx): void {
  for (const s of stmts) {
    if (--ctx.budget < 0) throw new Error('it never stops')
    const line = ctx.head.get(s.id) ?? 0
    if (s.k === 'assign') {
      const v = evalE(s.value, env)
      if (s.to.t === 'var') {
        env.vars.set(s.to.name, v)
        ctx.events.push({ target: s.to.name, line })
      } else if (s.to.t === 'at') {
        const i = evalE(s.to.i, env)
        if (typeof i !== 'number' || i < 1 || i > env.data.length) throw new Error(`Data[${showVal(i)}] is outside the array`)
        env.data[i - 1] = v as number
        ctx.events.push({ target: `D${i}`, line })
      }
    } else if (s.k === 'output') {
      const text = showVal(evalE(s.value, env))
      env.out.push(text)
      ctx.rowOut.push(text)
      ctx.events.push({ target: 'OUTPUT', line })
    } else if (s.k === 'if') {
      exec(evalE(s.cond, env) === true ? s.then : s.else ?? [], env, ctx)
    } else if (s.k === 'for') {
      const to = evalE(s.to, env) as number
      for (let i = evalE(s.from, env) as number; i <= to; i++) {
        env.vars.set(s.v, i)
        exec(s.body, env, ctx)
      }
    } else {
      while (evalE(s.cond, env) === true) {
        if (--ctx.budget < 0) throw new Error('it never stops')
        exec(s.body, env, ctx)
      }
    }
  }
}

/** One row of the true trace: the state after the lines of a pass, or of the start or the finish. */
export type RunRow = {
  kind: 'start' | 'pass' | 'finish'
  label: string
  given?: { name: string; value: number }
  lines: number[]
  /** Every column's value once the row is done ('' where it has none); OUTPUT holds only what this row output. */
  after: Record<string, string>
  /** The last line of the row that gave each column its value. */
  setBy: Record<string, number>
}
export type Run = { rows: RunRow[]; output: string[]; data: number[]; passes: number; error: string | null }

type Input = { values: number[]; target?: number; limit?: number }

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

function runProgram(p: Program, info: Rendered, input: Input): Run {
  const env: Env = { vars: new Map(), data: [...input.values], out: [] }
  if (input.target !== undefined) env.vars.set('Target', input.target)
  if (input.limit !== undefined) env.vars.set('Limit', input.limit)
  const ctx: Ctx = { head: info.head, events: [], rowOut: [], budget: 800 }
  const rows: RunRow[] = []
  let passes = 0
  const row = (kind: RunRow['kind'], label: string, lines: number[], given?: RunRow['given']) => {
    const after: Record<string, string> = {}
    const setBy: Record<string, number> = {}
    for (const c of p.columns) {
      if (c.kind === 'out') after[c.id] = ctx.rowOut.join(' ')
      else if (/^D\d+$/.test(c.id)) after[c.id] = `${env.data[Number(c.id.slice(1)) - 1]}`
      else {
        const v = env.vars.get(c.id)
        after[c.id] = v === undefined ? '' : showVal(v)
      }
    }
    for (const e of ctx.events) setBy[e.target] = e.line
    rows.push({ kind, label, lines, after, setBy, ...(given ? { given } : {}) })
    ctx.events = []
    ctx.rowOut = []
  }
  let error: string | null = null
  try {
    if (p.pre.length || p.startGiven) {
      exec(p.pre, env, ctx)
      row('start', 'Start', p.pre.length ? range(info.span.get(p.pre[0].id)![0], info.span.get(p.pre[p.pre.length - 1].id)![1]) : [])
    }
    const loop = p.loop
    const [from, to] = info.span.get(loop.id)!
    if (loop.k === 'for') {
      const last = evalE(loop.to, env) as number
      for (let i = evalE(loop.from, env) as number; i <= last; i++) {
        env.vars.set(loop.v, i)
        exec(loop.body, env, ctx)
        passes++
        row('pass', `${loop.v} = ${i}`, range(from, to), { name: loop.v, value: i })
      }
    } else if (loop.k === 'while') {
      while (evalE(loop.cond, env) === true) {
        if (--ctx.budget < 0) throw new Error('it never stops')
        exec(loop.body, env, ctx)
        passes++
        row('pass', `Pass ${passes}`, range(from, to))
      }
    }
    if (p.post.length) {
      exec(p.post, env, ctx)
      row('finish', 'Finish', range(info.span.get(p.post[0].id)![0], info.span.get(p.post[p.post.length - 1].id)![1]))
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'it cannot be run'
  }
  return { rows, output: env.out, data: env.data, passes, error }
}

// ---------------------------------------------------------------------------
// The trace table: its rows and which of its cells are for the learner.

export type CellRole = 'fill' | 'given' | 'none'
export type LayoutRow = {
  id: string
  kind: 'start' | 'pass' | 'finish'
  label: string
  given?: { name: string; value: number }
  /** The lines this row runs, whatever branch is taken: the same for every pass of the loop. */
  lines: number[]
  cells: Record<string, CellRole>
  /** The true trace of this row; null for a spare row after a WHILE loop has ended. */
  truth: RunRow | null
}
export type Layout = { columns: Column[]; rows: LayoutRow[]; lines: Line[]; run: Run; program: Program; info: Rendered }

const taskInput = (t: Task): Input => ({ values: t.values, ...(t.target !== undefined ? { target: t.target } : {}), ...(t.limit !== undefined ? { limit: t.limit } : {}) })
const isAlgo = (a: unknown): a is AlgoId => (ALGORITHMS as readonly unknown[]).includes(a)

const CACHE = new Map<string, Layout>()

/**
 * The listing, the true run and the rows of the table. A fault task is listed
 * with its bug; the other tasks are listed correct. The cache holds a few
 * layouts for the views and the tests, which ask the same config many times.
 */
export function layout(config: AlgorithmTracerConfig): Layout {
  const t = config.task
  const key = JSON.stringify([t.kind, t.algorithm, t.values, t.target, t.limit, t.kind === 'fault' ? t.bug : null])
  const hit = CACHE.get(key)
  if (hit) return hit
  const algo = isAlgo(t.algorithm) ? t.algorithm : 'total'
  const n = t.values.length
  const program = buildProgram(algo, { n, ...(t.kind === 'fault' && t.bug ? { bug: t.bug } : {}) })
  const info = render(program)
  const run = runProgram(program, info, taskInput(t))
  const rows: LayoutRow[] = []
  const assigned = new Set<string>()
  const note = (s: Stmt) => {
    if (s.k === 'assign') assigned.add(s.to.t === 'var' ? s.to.name : 'D')
  }
  program.pre.forEach(note)
  const cellsFor = (kind: LayoutRow['kind']): Record<string, CellRole> => {
    const cells: Record<string, CellRole> = {}
    for (const c of program.columns) {
      if (kind === 'finish') cells[c.id] = c.kind === 'out' ? 'fill' : 'none'
      else if (c.kind === 'out') cells[c.id] = 'none'
      else if (kind === 'pass') cells[c.id] = 'fill'
      else cells[c.id] = program.startGiven && /^D\d+$/.test(c.id) ? 'given' : assigned.has(c.id) ? 'fill' : 'none'
    }
    return cells
  }
  const start = run.rows.find((r) => r.kind === 'start')
  if (start) rows.push({ id: 'start', kind: 'start', label: start.label, lines: start.lines, cells: cellsFor('start'), truth: start })
  const passes = run.rows.filter((r) => r.kind === 'pass')
  const loopSpan = info.span.get(program.loop.id)!
  // A WHILE loop may stop at any pass, so the table has a row for each pass it could take
  // and the learner leaves the rows after the last one empty.
  const shown = program.loop.k === 'while' ? Math.max(n, passes.length) : passes.length
  for (let i = 0; i < shown; i++) {
    const truth = passes[i] ?? null
    rows.push({
      id: `p${i + 1}`, kind: 'pass', label: truth?.label ?? `Pass ${i + 1}`, ...(truth?.given ? { given: truth.given } : {}),
      lines: range(loopSpan[0], loopSpan[1]), cells: cellsFor('pass'), truth,
    })
  }
  const finish = run.rows.find((r) => r.kind === 'finish')
  if (finish) rows.push({ id: 'finish', kind: 'finish', label: 'Finish', lines: finish.lines, cells: cellsFor('finish'), truth: finish })
  const out: Layout = { columns: program.columns, rows, lines: info.lines, run, program, info }
  if (CACHE.size > 200) CACHE.clear()
  CACHE.set(key, out)
  return out
}

/** The line of the listing a fault task has its bug on, or null for any other task. */
export function faultLine(config: AlgorithmTracerConfig): number | null {
  const t = config.task
  if (t.kind !== 'fault' || !t.bug) return null
  const { program, info } = layout(config)
  const find = (stmts: Stmt[]): Stmt | undefined => {
    for (const s of stmts) {
      if (s.bug) return s
      const inner = s.k === 'for' || s.k === 'while' ? s.body : s.k === 'if' ? [...s.then, ...(s.else ?? [])] : []
      const hit = find(inner)
      if (hit) return hit
    }
    return undefined
  }
  const bugged = find([...program.pre, program.loop, ...program.post])
  return bugged ? info.head.get(bugged.id) ?? null : null
}

/** The faulty line as it should read: the same statement in the correct program. */
export function fixedLine(config: AlgorithmTracerConfig): string | null {
  const t = config.task
  const line = faultLine(config)
  if (line === null || !isAlgo(t.algorithm)) return null
  const here = layout(config).lines[line - 1]
  const right = buildProgram(t.algorithm, { n: t.values.length })
  const lines = render(right).lines
  const same = lines.find((l) => l.id === here.id && l.role === here.role)
  return same ? lineText(same).trim() : null
}

// ---------------------------------------------------------------------------
// What the algorithm outputs, and what the learner is told.

/** The answer a predict task asks for, one cell each: the OUTPUT, or Data after a bubble sort pass. */
export function answerCells(run: Run, algo: AlgoId): string[] {
  return algo === 'bubble-pass' ? run.data.map(String) : [run.output.join(' ')]
}

/** The same algorithm run correctly on the config's values. */
export function correctRun(config: AlgorithmTracerConfig): Run {
  const t = config.task
  const algo = isAlgo(t.algorithm) ? t.algorithm : 'total'
  const program = buildProgram(algo, { n: t.values.length })
  return runProgram(program, render(program), taskInput(t))
}

export function expectedAnswer(config: AlgorithmTracerConfig): string[] {
  const t = config.task
  return answerCells(correctRun(config), isAlgo(t.algorithm) ? t.algorithm : 'total')
}

/** What the algorithm is for, in a sentence the card can print before anything is marked. */
export function purpose(config: AlgorithmTracerConfig): string {
  const t = config.task
  switch (t.algorithm) {
    case 'total': return 'This algorithm adds up the values in Data.'
    case 'count': return 'This algorithm counts the values in Data that are greater than Limit.'
    case 'maximum': return 'This algorithm finds the largest value in Data.'
    case 'minimum': return 'This algorithm finds the smallest value in Data.'
    case 'linear-search': return 'This algorithm looks through Data for Target and outputs its position, or "Not found".'
    case 'bubble-pass': return 'This algorithm makes one pass of a bubble sort over Data, swapping neighbours that are out of order.'
  }
}

/** The values the algorithm is given, other than Data, as the card shows them. */
export function givens(config: AlgorithmTracerConfig): { name: string; value: number }[] {
  const t = config.task
  return [
    ...(t.algorithm === 'linear-search' && t.target !== undefined ? [{ name: 'Target', value: t.target }] : []),
    ...(t.algorithm === 'count' && t.limit !== undefined ? [{ name: 'Limit', value: t.limit }] : []),
  ]
}

const list = (xs: (string | number)[]) => xs.join(', ')

/** Marked right: what the algorithm did, in a sentence or two. */
export function explain(config: AlgorithmTracerConfig): string {
  const t = config.task
  const run = correctRun(config)
  const v = t.values
  switch (t.algorithm) {
    case 'total': {
      const sum = v.reduce((a, b) => a + b, 0)
      return `${v.join(' + ')} = ${sum}, so Total is ${sum} and that is what OUTPUT shows.`
    }
    case 'count': {
      const above = v.filter((x) => x > (t.limit ?? 0))
      return `${list(above)} ${above.length === 1 ? 'is' : 'are'} greater than ${t.limit}, so Count goes up ${above.length === 1 ? 'once' : `${above.length} times`} and OUTPUT shows ${above.length}.`
    }
    case 'maximum':
    case 'minimum': {
      const name = t.algorithm === 'maximum' ? 'Max' : 'Min'
      const word = t.algorithm === 'maximum' ? 'largest' : 'smallest'
      const changes = run.rows.filter((r) => r.kind === 'pass' && r.setBy[name] !== undefined)
      const steps = changes.map((r) => `${r.after[name]} (${r.given?.name} ${r.given?.value})`)
      return `${name} starts as ${v[0]}${steps.length ? `, then becomes ${steps.join(' and then ')}` : ''}. The ${word} value is ${run.output.join(' ')}.`
    }
    case 'linear-search': {
      const out = run.output.join(' ')
      return out === 'Not found'
        ? `No value in Data is ${t.target}, so the loop checks every position and OUTPUT shows "Not found".`
        : `Data[${out}] is ${t.target}, the first match: Found becomes TRUE, the loop stops and OUTPUT shows ${out}.`
    }
    case 'bubble-pass':
      return `Each neighbouring pair is compared and swapped when the left one is bigger, so Data ends as ${list(run.data)}: the largest value has moved to the end.`
  }
}

// ---------------------------------------------------------------------------
// Typed cells: reading them, and marking them.

export const cellKey = (rowId: string, colId: string) => `${rowId}:${colId}`
const MAX_CELL = 14

/** A state read safely: anything it cannot read is as at the start. */
export function readState(raw: unknown): AlgorithmTracerState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cells: Record<string, string> = {}
  if (r.cells && typeof r.cells === 'object' && !Array.isArray(r.cells)) {
    let kept = 0
    for (const [k, v] of Object.entries(r.cells as Record<string, unknown>)) {
      if (typeof v === 'string' && k.length <= 24 && ++kept <= 200) cells[k] = v.slice(0, MAX_CELL)
    }
  }
  const pick = typeof r.pick === 'number' && Number.isInteger(r.pick) && r.pick >= 1 && r.pick <= 40 ? r.pick : null
  return { cells, pick }
}

/** A cell's text as a value: '' for blank, one spelling for each value, and `?text` for what is not one. */
export function canon(kind: ColKind, text: string): string {
  const t = text.trim()
  if (t === '') return ''
  if (kind === 'bool') {
    const l = t.toLowerCase()
    return l === 'true' || l === 't' ? 'TRUE' : l === 'false' || l === 'f' ? 'FALSE' : `?${t}`
  }
  const plain = t.replace(/[−–]/g, '-')
  if (/^[+-]?\d+$/.test(plain)) return `${Number(plain) + 0}`
  if (kind === 'int') return `?${t}`
  return plain.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type CellFault = {
  key: string
  row: LayoutRow
  col: Column
  typed: string
  /** What the learner's table says for this cell once blanks are carried down. */
  has: string
  expected: string
  spare: boolean
  /** Left empty where the true value does not change: wrong only because an earlier cell in its column is. */
  carried: boolean
}
export type Judged = { faults: CellFault[]; total: number; right: number }

/** Every cell the learner fills, marked against the true trace; a blank cell means "unchanged", as in an exam. */
export function judgeTrace(config: AlgorithmTracerConfig, state: unknown): Judged {
  const { cells } = readState(state)
  const L = layout(config)
  const faults: CellFault[] = []
  const has: Record<string, string> = {}
  /** What the true table holds in each column going into the row. */
  const was: Record<string, string> = {}
  let total = 0
  for (const row of L.rows) {
    for (const c of L.columns) {
      const role = row.cells[c.id]
      const t = row.truth
      if (role === 'given') {
        has[c.id] = canon(c.kind, t?.after[c.id] ?? '')
        was[c.id] = has[c.id]
        continue
      }
      if (role !== 'fill') continue
      const key = cellKey(row.id, c.id)
      const typed = (cells[key] ?? '').trim()
      if (!t) {
        if (typed !== '') faults.push({ key, row, col: c, typed, has: canon(c.kind, typed), expected: '', spare: true, carried: false })
        continue
      }
      total++
      const expected = canon(c.kind, t.after[c.id] ?? '')
      const mine = c.kind === 'out' ? canon(c.kind, typed) : canon(c.kind, typed) || has[c.id] || ''
      const carried = c.kind !== 'out' && typed === '' && expected === (was[c.id] ?? '')
      if (c.kind !== 'out') {
        has[c.id] = mine
        was[c.id] = expected
      }
      if (mine !== expected) faults.push({ key, row, col: c, typed, has: mine, expected: t.after[c.id] ?? '', spare: false, carried })
    }
  }
  return { faults, total, right: total - faults.filter((f) => !f.spare).length }
}

/** What the learner would type to get every cell right: values only where they change, as an exam table is written. */
export function traceSolution(config: AlgorithmTracerConfig): Record<string, string> {
  const L = layout(config)
  const out: Record<string, string> = {}
  const prev: Record<string, string> = {}
  for (const row of L.rows) {
    if (!row.truth) continue
    for (const c of L.columns) {
      const role = row.cells[c.id]
      const v = row.truth.after[c.id] ?? ''
      if (role === 'given') prev[c.id] = v
      if (role !== 'fill') continue
      if (c.kind === 'out') {
        if (v !== '') out[cellKey(row.id, c.id)] = v
        continue
      }
      if (row.kind === 'start' ? v !== '' : v !== (prev[c.id] ?? '')) out[cellKey(row.id, c.id)] = v
      prev[c.id] = v
    }
  }
  return out
}

export const rowName = (row: LayoutRow) => (row.given ? `${row.given.name} = ${row.given.value}` : row.label)

function sayCell(f: CellFault, L: Layout): string {
  const where = rowName(f.row)
  if (f.spare) return `${where}: the loop has already finished, so this row should be empty.`
  const line = f.row.truth?.setBy[f.col.id]
  const code = line ? L.lines[line - 1] : undefined
  const out = f.col.kind === 'out'
  const by = code ? `${out ? '' : 'after '}line ${line} (${code.text}) ${out ? 'outputs' : 'it is'} ${f.expected}` : null
  const reason = f.expected === ''
    ? `${f.col.label} has no value yet, so leave it empty`
    : by ?? `nothing changes ${f.col.label} in this row, so it stays ${f.expected}`
  const said = f.typed === ''
    ? f.has === '' ? 'you left it empty' : `you left it empty, which means it stays ${f.has}`
    : `you wrote ${f.typed}`
  return `${where}, ${f.col.label}: ${said}; ${reason}.`
}

/** Marked wrong: how many cells are right and, for the first few that are not, what was written and what the line gives. */
export function traceSaid(config: AlgorithmTracerConfig, state: unknown): string[] {
  const j = judgeTrace(config, state)
  if (j.faults.length === 0) return [`All ${j.total} cells are right.`]
  const L = layout(config)
  // A spare row with several cells filled is one mistake: the loop had finished.
  const spare = new Set<string>()
  const faults = j.faults.filter((f) => !f.spare || (!spare.has(f.row.id) && !!spare.add(f.row.id)))
  // A cell left empty only carries an earlier wrong value down: it comes right when that one does.
  const roots = faults.filter((f) => !f.carried)
  const carried = faults.length - roots.length
  const shown = roots.slice(0, 3).map((f) => sayCell(f, L))
  const more = roots.length - shown.length
  return [
    `${j.right} of ${j.total} cells are right.`,
    ...shown,
    ...(more > 0 ? [`${more} more ${more === 1 ? 'cell is' : 'cells are'} not right: fix the first, because later ones may follow from it.`] : []),
    ...(carried > 0 ? [`${carried} more ${carried === 1 ? 'cell carries' : 'cells carry'} a wrong value down from above, and will come right when it does.`] : []),
  ]
}

const predictKey = (i: number) => `p${i}`

export function predictCells(config: AlgorithmTracerConfig): { key: string; label: string }[] {
  const t = config.task
  return t.algorithm === 'bubble-pass'
    ? t.values.map((_, i) => ({ key: predictKey(i), label: `Data[${i + 1}]` }))
    : [{ key: predictKey(0), label: 'OUTPUT' }]
}

export function predictSolution(config: AlgorithmTracerConfig): Record<string, string> {
  return Object.fromEntries(expectedAnswer(config).map((v, i) => [predictKey(i), v]))
}

/** The prediction, marked: which cells are wrong, with what was written. */
export function judgePredict(config: AlgorithmTracerConfig, state: unknown): { wrong: { key: string; label: string; typed: string; expected: string }[] } {
  const { cells } = readState(state)
  const want = expectedAnswer(config)
  const out = config.task.algorithm === 'bubble-pass' ? ('int' as const) : ('out' as const)
  const wrong = predictCells(config)
    .map((c, i) => ({ ...c, typed: (cells[c.key] ?? '').trim(), expected: want[i] ?? '' }))
    .filter((c) => canon(out, c.typed) !== canon(out, c.expected) || c.typed === '')
  return { wrong }
}

/** Marked wrong: what was predicted, never what the output is. */
export function predictSaid(config: AlgorithmTracerConfig, state: unknown): string[] {
  const { wrong } = judgePredict(config, state)
  if (wrong.length === 0) return []
  const t = config.task
  if (t.algorithm === 'bubble-pass') {
    const names = wrong.map((w) => w.label)
    const list2 = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    return [`${list2} ${names.length === 1 ? 'is' : 'are'} not right yet. You wrote ${wrong.map((w) => (w.typed === '' ? 'nothing' : w.typed)).join(', ')} there.`, 'Go through the pass one pair at a time, writing the array out after each swap.']
  }
  const w = wrong[0]
  if (w.typed === '') return ['You have not written a prediction yet.']
  const a = Number(canon('int', w.typed))
  const b = Number(canon('int', w.expected))
  const hint = Number.isFinite(a) && Number.isFinite(b) && /^\d+$/.test(canon('int', w.typed)) && /^\d+$/.test(canon('int', w.expected))
    ? ` That is ${a < b ? 'too low' : 'too high'}.`
    : ''
  return [`You predicted ${w.typed}, which is not what OUTPUT shows.${hint}`, 'Work through the loop one pass at a time, keeping each variable\'s value as you go.']
}

/** The symptom a fault task shows: what the buggy algorithm gives, and what it should. */
export function symptom(config: AlgorithmTracerConfig): { got: string; should: string; array: boolean } {
  const t = config.task
  const algo = isAlgo(t.algorithm) ? t.algorithm : 'total'
  const buggy = layout(config).run
  const array = algo === 'bubble-pass'
  const text = (r: Run) => (r.error ? 'nothing: it stops with an error' : array ? `[${list(r.data)}]` : r.output.length ? r.output.join(' ') : 'nothing')
  return { got: text(buggy), should: text(correctRun(config)), array }
}

/** Marked wrong in a fault task: which line was picked, never the faulty one. */
export function faultSaid(config: AlgorithmTracerConfig, state: unknown): string[] {
  const { pick } = readState(state)
  const L = layout(config)
  if (pick === null) return ['No line is picked yet. Tap the line you think is wrong.']
  const line = L.lines[pick - 1]
  if (!line) return ['That line is not in the listing.']
  const s = symptom(config)
  return [
    `You picked line ${pick}, ${line.text}. That line is correct as it is written.`,
    `Read the other lines against what goes wrong: ${s.array ? 'Data ends as' : 'the output is'} ${s.got} when it should be ${s.should}.`,
  ]
}

/** Marked right in a fault task: the line, what was wrong and how it should read. */
export function faultFound(config: AlgorithmTracerConfig): string {
  const t = config.task
  const line = faultLine(config)
  const info = t.bug ? BUG_INFO.get(t.bug) : undefined
  const fix = fixedLine(config)
  return `Line ${line} is the fault. ${info?.what ?? ''}${fix ? ` It should read: ${fix}` : ''}`.trim()
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const KIND_WORDS: Record<string, Kind> = {
  'trace': 'trace', 'trace-table': 'trace', 'trace-tables': 'trace', 'trace-the-algorithm': 'trace', 'complete-the-trace-table': 'trace',
  'complete-trace-table': 'trace', 'fill-in-the-trace-table': 'trace', 'tracing': 'trace', 'dry-run': 'trace',
  'predict': 'predict', 'predict-output': 'predict', 'predict-the-output': 'predict', 'output': 'predict', 'prediction': 'predict',
  'what-does-it-output': 'predict',
  'fault': 'fault', 'find-the-fault': 'fault', 'find-fault': 'fault', 'bug': 'fault', 'find-the-bug': 'fault', 'find-bug': 'fault',
  'spot-the-bug': 'fault', 'spot-the-fault': 'fault', 'debug': 'fault', 'error': 'fault', 'find-the-error': 'fault',
}

const ALGO_WORDS: Record<string, AlgoId> = {
  'total': 'total', 'totalling': 'total', 'totaling': 'total', 'totals': 'total', 'sum': 'total', 'running-total': 'total',
  'add-up': 'total', 'summing': 'total', 'totalling-values': 'total',
  'count': 'count', 'counting': 'count', 'count-above': 'count', 'count-greater': 'count', 'count-values': 'count',
  'counting-values': 'count', 'count-greater-than': 'count',
  'maximum': 'maximum', 'max': 'maximum', 'largest': 'maximum', 'find-the-maximum': 'maximum', 'finding-the-maximum': 'maximum',
  'find-maximum': 'maximum', 'find-max': 'maximum', 'find-the-largest': 'maximum', 'largest-value': 'maximum',
  'minimum': 'minimum', 'min': 'minimum', 'smallest': 'minimum', 'find-the-minimum': 'minimum', 'finding-the-minimum': 'minimum',
  'find-minimum': 'minimum', 'find-min': 'minimum', 'find-the-smallest': 'minimum', 'smallest-value': 'minimum',
  'linear-search': 'linear-search', 'linear': 'linear-search', 'search': 'linear-search', 'sequential-search': 'linear-search',
  'serial-search': 'linear-search',
  'bubble-pass': 'bubble-pass', 'bubble-sort-pass': 'bubble-pass', 'one-pass-of-bubble-sort': 'bubble-pass', 'one-pass': 'bubble-pass',
  'bubble-sort-one-pass': 'bubble-pass', 'a-pass-of-bubble-sort': 'bubble-pass', 'pass': 'bubble-pass',
}

/** A whole number written as a number or a string; decimals still read (faults() says why they will not do). */
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string' && /^\s*[+\-−–]?\d{1,6}(?:\.\d{1,6})?\s*$/.test(raw)) return Number(raw.replace(/[−–]/g, '-')) + 0
  return null
}

const ALGO_LIST = ALGORITHMS.join(', ')

/** The id of a bug, by its own name or its name without the algorithm in front ("skips-last"). */
function readBug(raw: unknown, algo: AlgoId): BugId | null {
  if (typeof raw !== 'string') return null
  const s = slug(raw)
  const hit = BUGS.find((b) => b.id === s) ?? bugsOf(algo).find((b) => b.id === `${b.id.split('-')[0]}-${s}`)
  return hit ? hit.id : null
}

export function parseTask(raw: unknown): AlgorithmTracerConfig | null {
  const holder = raw && typeof raw === 'object' ? (raw as { task?: unknown }) : null
  const task = holder?.task ?? (holder && ('algorithm' in holder || 'values' in holder) ? holder : null)
  if (!task || typeof task !== 'object') return null
  const t = task as Record<string, unknown>
  const unread: string[] = []

  let kind: Kind = 'trace'
  if (t.kind !== undefined) {
    const key = typeof t.kind === 'string' ? slug(t.kind) : ''
    if (own(KIND_WORDS, key)) kind = KIND_WORDS[key]
    else unread.push(`kind ${JSON.stringify(t.kind)} is not one of: ${KINDS.join(', ')}.`)
  }

  let algorithm: AlgoId = 'total'
  const algoRaw = first(t, ['algorithm', 'algo', 'name'])
  if (algoRaw === undefined) unread.push(`the task needs an "algorithm": one of ${ALGO_LIST}.`)
  else {
    const key = typeof algoRaw === 'string' ? slug(algoRaw) : ''
    if (own(ALGO_WORDS, key)) algorithm = ALGO_WORDS[key]
    else if (key === 'bubble-sort' || key === 'bubble') unread.push(`"${algoRaw}" is the whole sort, which this scene does not do: use "bubble-pass", one pass of a bubble sort.`)
    else unread.push(`algorithm ${JSON.stringify(algoRaw)} is not one of: ${ALGO_LIST}.`)
  }

  const values: number[] = []
  const valuesRaw = first(t, ['values', 'data', 'array', 'numbers', 'items', 'list'])
  const items = Array.isArray(valuesRaw) ? valuesRaw : typeof valuesRaw === 'string' ? valuesRaw.split(/[\s,;]+/).filter(Boolean) : null
  if (!items) unread.push('the task needs "values": a list of whole numbers, e.g. [4, 9, 2, 7, 5].')
  else {
    for (const item of items.slice(0, 40)) {
      const v = readNumber(item)
      if (v === null) unread.push(`${JSON.stringify(item)} in values is not a number: values are whole numbers from 0 to ${MAX_VALUE}.`)
      else values.push(v)
    }
  }

  const out: Task = { kind, algorithm, values }
  const targetRaw = first(t, ['target', 'search_for', 'searchFor', 'key', 'find'])
  if (targetRaw !== undefined) {
    const v = readNumber(targetRaw)
    if (v === null) unread.push(`target ${JSON.stringify(targetRaw)} is not a number: use a whole number from 0 to ${MAX_VALUE}.`)
    else out.target = v
  }
  const limitRaw = first(t, ['limit', 'threshold', 'above', 'greater_than', 'greaterThan'])
  if (limitRaw !== undefined) {
    const v = readNumber(limitRaw)
    if (v === null) unread.push(`limit ${JSON.stringify(limitRaw)} is not a number: use a whole number from 0 to ${MAX_VALUE}.`)
    else out.limit = v
  }
  if (t.bug !== undefined) {
    const id = readBug(t.bug, algorithm)
    if (id) out.bug = id
    else unread.push(`bug ${JSON.stringify(t.bug)} is not one for ${algorithm}: use ${bugsOf(algorithm).map((b) => `"${b.id}"`).join(', ')}.`)
  }
  if (unread.length) out.unread = unread
  return { task: out }
}

// ---------------------------------------------------------------------------
// What would teach nothing, and a config that would.

/** Candidate data, tried in order for the "use e.g." of a fault: small, typical of an exam, and varied in where things sit. */
const POOL: Record<AlgoId, { values: number[]; target?: number; limit?: number }[]> = {
  'total': [{ values: [4, 9, 2, 7, 5] }, { values: [12, 5, 8, 20, 3, 6] }, { values: [6, 3, 8] }],
  'count': [
    { values: [4, 9, 2, 7, 5], limit: 5 }, { values: [4, 9, 5, 7, 2], limit: 5 }, { values: [12, 5, 8, 20, 3, 6], limit: 7 },
    { values: [12, 5, 8, 20, 3, 6], limit: 8 }, { values: [6, 3, 8, 9], limit: 5 },
  ],
  'maximum': [{ values: [3, 8, 2, 11, 6] }, { values: [3, 8, 2, 6, 11] }, { values: [14, 9, 22, 5, 17] }, { values: [5, 9, 7] }],
  'minimum': [{ values: [9, 6, 12, 8, 3] }, { values: [9, 6, 12, 3, 8] }, { values: [14, 9, 22, 5, 17] }, { values: [8, 5, 7] }],
  'linear-search': [
    { values: [4, 9, 2, 7, 5], target: 7 }, { values: [4, 9, 2, 7, 5], target: 5 }, { values: [4, 9, 2, 7, 5], target: 4 },
    { values: [4, 9, 2, 7, 5], target: 8 }, { values: [12, 5, 8, 20, 3, 6], target: 8 },
  ],
  'bubble-pass': [{ values: [4, 9, 2, 7, 5] }, { values: [5, 3, 8, 1, 6] }, { values: [6, 2, 5, 3] }, { values: [3, 2, 1] }],
}

const maxItems = (algo: AlgoId) => (algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS)
const whole = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX_VALUE

/** An independent count of the passes the correct algorithm makes with a swap, for the "teaches nothing" checks. */
function swaps(values: number[]): number {
  let k = 0
  for (let i = 0; i + 1 < values.length; i++) if (values[i] > values[i + 1]) k++
  return k
}

/** Every reason the config would teach nothing or wrongly, in words a writer can act on; `eg` adds a working example. */
function problems(config: AlgorithmTracerConfig, eg: () => string): string[] {
  const t = config.task
  if (t.unread?.length) return t.unread
  const algo = t.algorithm
  const name = NAMES[algo].toLowerCase()
  const use = () => {
    const x = eg()
    return x ? ` Use e.g. ${x}.` : ''
  }
  if (t.kind === 'predict' && (algo === 'maximum' || algo === 'minimum')) {
    return [`Predicting the output of ${algo === 'maximum' ? 'a maximum' : 'a minimum'} is just picking the ${algo === 'maximum' ? 'largest' : 'smallest'} number off the page. Use kind "trace" to follow the algorithm, or "fault" to correct it.`]
  }
  const n = t.values.length
  const most = maxItems(algo)
  if (n < MIN_ITEMS || n > most) {
    return [`${NAMES[algo]} takes ${MIN_ITEMS} to ${most} values (${algo === 'bubble-pass' ? 'each one is a column of the table' : 'a longer table is slow to fill'}); "values" has ${n}.${use()}`]
  }
  const odd = t.values.find((v) => !whole(v))
  if (odd !== undefined) return [`${odd} is not a whole number from 0 to ${MAX_VALUE}, which is the range of every value in Data.${use()}`]

  if (algo === 'linear-search' && (t.target === undefined || !whole(t.target))) {
    return [`Linear search needs a "target" -- the value to look for, a whole number from 0 to ${MAX_VALUE}.${use()}`]
  }
  if (algo === 'count' && (t.limit === undefined || !whole(t.limit))) {
    return [`Counting needs a "limit" -- the values greater than it are counted, a whole number from 0 to ${MAX_VALUE}.${use()}`]
  }
  if (t.kind === 'fault') {
    const ids = bugsOf(algo).map((b) => `"${b.id}"`).join(', ')
    if (!t.bug) return [`A fault task needs a "bug" -- the mistake planted in the listing. For ${name} use one of ${ids}.${use()}`]
    if (BUG_INFO.get(t.bug)?.algorithm !== algo) return [`The bug "${t.bug}" belongs to a different algorithm. For ${name} use one of ${ids}.${use()}`]
  }

  const L = layout(config)
  if (L.run.error && t.kind !== 'fault') return [`With these values the algorithm stops with an error (${L.run.error}).${use()}`]
  if (L.rows.length > MAX_ROWS) {
    return [`The trace would be ${L.rows.length} rows, and the most a card draws is ${MAX_ROWS}.${use()}`]
  }

  if (t.kind === 'fault') {
    const right = correctRun(config)
    const wrong = L.run
    const same = wrong.error === null && answerCells(wrong, algo).join('|') === answerCells(right, algo).join('|')
    if (wrong.error) return [`With these values the bug makes the algorithm stop with an error (${wrong.error}), not give a wrong answer to look into.${use()}`]
    if (same) {
      return [`With these values the bug changes nothing: the algorithm ${algo === 'bubble-pass' ? 'leaves Data' : 'outputs'} ${algo === 'bubble-pass' ? `[${list(right.data)}]` : right.output.join(' ')} either way, so the learner has no wrong answer to look into. Choose values that make the bug show.${use()}`]
    }
    return []
  }

  const v = t.values
  if (algo === 'count') {
    const counted = v.filter((x) => x > (t.limit as number)).length
    if (counted === 0) return [`No value is greater than ${t.limit}, so the IF is never true and Count stays 0. Choose values (or a limit) so that some are counted and some are not.${use()}`]
    if (counted === n) return [`Every value is greater than ${t.limit}, so the IF is true every time and the loop teaches nothing about the test. Choose values (or a limit) so that some are counted and some are not.${use()}`]
  } else if (algo === 'maximum' || algo === 'minimum') {
    const best = algo === 'maximum' ? Math.max(...v) : Math.min(...v)
    if (v[0] === best) return [`The first value, ${v[0]}, is already the ${algo === 'maximum' ? 'largest' : 'smallest'}, so ${algo === 'maximum' ? 'Max' : 'Min'} never changes after it is set and there is nothing to trace. Put a ${algo === 'maximum' ? 'larger' : 'smaller'} value later in the list.${use()}`]
  } else if (algo === 'linear-search') {
    if (v[0] === t.target) return [`The target ${t.target} is the first value, so the search stops after one pass. Choose a target further along the list (or one that is not there at all).${use()}`]
  } else if (algo === 'bubble-pass') {
    if (swaps(v) === 0) return [`Data is already in order, so the pass swaps nothing and the table never changes. Put at least one value before a smaller one.${use()}`]
  }
  return []
}

/** A config the engine accepts, like the one asked for, to name in a fault. */
function example(config: AlgorithmTracerConfig): string {
  const t = config.task
  if (!isAlgo(t.algorithm)) return ''
  const bug = t.bug && BUG_INFO.get(t.bug)?.algorithm === t.algorithm ? t.bug : undefined
  const bugs: (BugId | undefined)[] = t.kind === 'fault' ? (bug ? [bug] : bugsOf(t.algorithm).map((b) => b.id)) : [undefined]
  for (const b of bugs) {
    for (const p of POOL[t.algorithm]) {
      const c: AlgorithmTracerConfig = { task: { kind: t.kind, algorithm: t.algorithm, values: p.values, ...(p.target !== undefined ? { target: p.target } : {}), ...(p.limit !== undefined ? { limit: p.limit } : {}), ...(b ? { bug: b } : {}) } }
      if (problems(c, () => '').length === 0) {
        return [
          `"values": [${list(p.values)}]`,
          ...(p.target !== undefined ? [`"target": ${p.target}`] : []),
          ...(p.limit !== undefined ? [`"limit": ${p.limit}`] : []),
          ...(b ? [`"bug": "${b}"`] : []),
        ].join(', ')
      }
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// The card's prompt.

/** The line numbers a prompt names ("line 5", "lines 4 and 5", "the 5th line"). */
function linesNamed(prompt: string): number[] {
  const out: number[] = []
  for (const m of prompt.matchAll(/\blines?\s*#?\s*((?:\d+(?:\s*(?:,|and|or|&|-|–|to)\s*)?)+)/gi)) {
    for (const d of m[1].matchAll(/\d+/g)) out.push(Number(d[0]))
  }
  for (const m of prompt.matchAll(/\b(\d+)(?:st|nd|rd|th)\s+line\b/gi)) out.push(Number(m[1]))
  return out
}

/** What a prompt must not say: the output, a value the table asks for, the faulty line or what is wrong with it. */
export function promptFaults(config: AlgorithmTracerConfig, prompt: string): string[] {
  const t = config.task
  if (t.unread?.length || !isAlgo(t.algorithm)) return []
  const said = (what: string, how: string) =>
    [`the prompt gives the answer away: it says ${what}, which the learner finds ${how}. Name the task only ("Complete the trace table for this algorithm.").`]

  if (t.kind === 'fault') {
    const line = faultLine(config)
    if (line !== null && linesNamed(prompt).includes(line)) return said(`which line the fault is on ("line ${line}")`, 'by tapping it')
    const info = t.bug ? BUG_INFO.get(t.bug) : undefined
    const hit = info?.words.exec(prompt)
    if (hit) return said(`what is wrong ("${hit[0].trim()}")`, 'by reading the listing against the output')
    return []
  }

  const answer = expectedAnswer(config)
  const given = new Set<number>([...t.values, ...(t.target !== undefined ? [t.target] : []), ...(t.limit !== undefined ? [t.limit] : []), t.values.length, t.values.length - 1])
  for (let i = 1; i <= t.values.length; i++) given.add(i)
  const stated = [...prompt.matchAll(/\d+/g)].map((m) => Number(m[0]))

  if (t.algorithm === 'bubble-pass') {
    const after = answer.map(Number)
    const before = t.values
    const differs = after.some((v, i) => v !== before[i])
    for (let i = 0; differs && i + after.length <= stated.length; i++) {
      if (after.every((v, j) => stated[i + j] === v)) return said(`what Data holds after the pass ("${after.join(', ')}")`, 'by working through the pass')
    }
    return []
  }
  const out = answer[0]
  if (out === 'Not found') {
    const m = /\bnot\s+found\b|\b(?:is|are)(?:n['’]?t|\s+not)\s+(?:in|there|present|found)\b|\b(?:does|do)(?:n['’]?t|\s+not)\s+(?:contain|appear|occur|include)\b|\babsent\b|\bmissing\b/i.exec(prompt)
    return m ? said(`that the target is not there ("${m[0]}")`, 'by running the search') : []
  }
  const n = Number(out)
  if (!Number.isFinite(n)) return []
  if (!given.has(n) && stated.includes(n)) return said(`the output, ${n}`, 'by following the algorithm')
  const near = new RegExp(`\\b(?:outputs?|prints?|displays?|shows?|result|answer|gives?|returns?|equals?|ends?\\s+(?:up\\s+)?(?:as|at|with)|total|count|maximum|minimum|largest|smallest|biggest|position|found\\s+at|index|sum)\\b[^.?!\\n]{0,30}?(?<![\\d.])${n}(?!\\d|\\.\\d)`, 'i')
  const m = near.exec(prompt)
  return m ? said(`the output ("${m[0].trim()}")`, 'by following the algorithm') : []
}

// ---------------------------------------------------------------------------

export const algorithmTracerEngine: SceneEngine<AlgorithmTracerConfig, AlgorithmTracerState> = {
  id: 'algorithm-tracer',
  // Phrases, not single words: a station is told "a scene is made for this" only when every word of a topic is in it,
  // so "counting" alone would claim a primary station on counting in tens.
  covers: ['trace tables', 'tracing algorithms', 'linear search', 'bubble sort', 'totalling and counting', 'pseudocode'],
  // What follows from each line: the learner works out what a line does to the values, in order.
  isolates: 'consequence',

  parse: parseTask,

  faults(config) {
    return problems(config, () => example(config))
  },

  promptFaults,

  initial() {
    return { cells: {}, pick: null }
  },

  check(config, raw) {
    const t = config.task
    if (t.unread?.length || !isAlgo(t.algorithm)) return { ok: false, wrongIds: [] }
    const s = readState(raw)
    if (t.kind === 'fault') {
      const line = faultLine(config)
      return { ok: line !== null && s.pick === line, wrongIds: s.pick !== null && s.pick !== line ? [`line-${s.pick}`] : [] }
    }
    if (t.kind === 'predict') {
      const { wrong } = judgePredict(config, raw)
      return { ok: wrong.length === 0, wrongIds: wrong.map((w) => w.key) }
    }
    const j = judgeTrace(config, raw)
    return { ok: j.faults.length === 0 && j.total > 0, wrongIds: j.faults.map((f) => f.key) }
  },

  solve(config) {
    const t = config.task
    if (t.kind === 'fault') return { cells: {}, pick: faultLine(config) }
    return { cells: t.kind === 'predict' ? predictSolution(config) : traceSolution(config), pick: null }
  },

  View: AlgorithmTracerView,

  prompt: `SCENE "algorithm-tracer" -- a short algorithm in Cambridge IGCSE / O Level pseudocode (0478 / 2210: DECLARE, the
  assignment arrow, FOR ... NEXT, WHILE ... ENDWHILE, IF ... ENDIF, OUTPUT), with its values shown as boxes or bars. You name
  the algorithm and its numbers; the engine writes the pseudocode and works out the true trace, so you never write code.
  Three tasks. "trace": a trace table, one row for each pass of the loop, and the learner types what each variable holds when the
  pass is done (an empty cell means unchanged, as in an exam); the code highlights the lines of the row they are on, and the
  cells are marked only on Check, with what they wrote and what the line gives. "predict": the learner types what the algorithm
  outputs (for a bubble sort pass, what Data holds afterwards) before any run is shown. "fault": the listing has one line with a
  known mistake, the card says what it outputs and what it should, and the learner taps the faulty line. The values of every
  variable, the output and the faulty line stay hidden until the card is marked.
  For: trace tables, tracing an algorithm, totalling, counting, finding the maximum or minimum, linear search, one pass of a
  bubble sort, finding a fault in pseudocode.
  config: { "task": { "kind":"<trace | predict | fault>", "algorithm":"<see below>", "values":[<3 to 8 whole numbers, 0 to 99>],
            "target":<linear-search only>, "limit":<count only>, "bug":"<fault only>" } }
    algorithm "total"          -- adds up Data. No other field.
    algorithm "count"          -- counts the values greater than "limit". Some, but not all, must be greater.
    algorithm "maximum"        -- finds the largest. The first value must not already be the largest. Not for "predict".
    algorithm "minimum"        -- finds the smallest. The first value must not already be the smallest. Not for "predict".
    algorithm "linear-search"  -- looks for "target"; the output is its position or "Not found". The target must not be the first value.
    algorithm "bubble-pass"    -- one pass of a bubble sort (3 to 6 values, at least one pair out of order). The trace table has
                                  a column for Temp and for each place of Data.
    bug, for "fault" only, one of the list for the algorithm, and the values must make it show in the output:
      total: total-starts-at-one, total-adds-index, total-skips-first, total-skips-last
      count: count-ge, count-less, count-starts-at-one, count-not-incremented (the values must include one equal to the limit for count-ge)
      maximum: max-wrong-way, max-skips-last, max-stores-index    minimum: min-wrong-way, min-skips-last, min-stores-index, min-starts-at-zero
      linear-search: search-stops-early (target last), search-not-equal, search-starts-at-two (target first), search-output-off-by-one
      bubble-pass: bubble-wrong-way, bubble-loses-value, bubble-stops-early
  - The prompt names the task. It never says an output, a value the table asks for, the line the fault is on or what is wrong with it.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Complete the trace table for this linear search.",
    "payload": { "engine":"algorithm-tracer", "config": { "task": { "kind":"trace", "algorithm":"linear-search", "values":[4, 9, 2, 7, 5], "target":7 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:algorithm-tracer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Predict what Data holds after this pass.",
    "payload": { "engine":"algorithm-tracer", "config": { "task": { "kind":"predict", "algorithm":"bubble-pass", "values":[4, 9, 2, 7, 5] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:algorithm-tracer", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"This algorithm gives the wrong answer. Tap the faulty line.",
    "payload": { "engine":"algorithm-tracer", "config": { "task": { "kind":"fault", "algorithm":"count", "values":[4, 9, 5, 7, 2], "limit":5, "bug":"count-ge" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:algorithm-tracer", "why":"..." } }`,
}

registerEngine(algorithmTracerEngine as SceneEngine<unknown, unknown>)
