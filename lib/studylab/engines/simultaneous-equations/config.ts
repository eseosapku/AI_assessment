// lib/studylab/engines/simultaneous-equations-kimi31/config.ts
//
// Two linear equations are two lines. In `graph`, the learner places a point that belongs to both.
// In `eliminate`, they form p(first) + q(second): the resulting line pivots about the same crossing,
// until x or y vanishes and the line is vertical or horizontal. This is Picciotto's "add till it's
// plaid" investigation (research.md), not a list of procedural steps. Integer arithmetic does all marking.
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SimultaneousEquationsView } from './View'

export type Equation = { a: number; b: number; c: number }
export type SimTask = 'graph' | 'eliminate'
export type SimConfig = { task: SimTask; first: Equation; second: Equation }
export type Fraction = { n: number; d: number }
export type SimState = {
  point?: [number, number] | null
  p?: number
  q?: number
  variable?: 'x' | 'y'
  /** Used only for parallel or coincident graph cards, where there is no one point to place. */
  special?: 'none' | 'many' | null
}
export type Target = { p: number; q: number; variable: 'x' | 'y' }

export const GRID = 5
export const MAX_MULTIPLIER = 6
export const MAX_COEFFICIENT = 12
export const MAX_CONSTANT = 40

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))
export const frac = (n: number, d = 1): Fraction => {
  const g = gcd(n, d) || 1
  const nn = n / g
  const dd = d / g
  return dd < 0 ? { n: -nn, d: -dd } : { n: nn, d: dd }
}
export const num = (v: number) => String(v).replace(/-/g, '−')
export const fracText = (r: Fraction) => (r.d === 1 ? num(r.n) : `${num(r.n)}/${r.d}`)
const value = (r: Fraction) => r.n / r.d

export function equationText(e: Equation): string {
  const terms: string[] = []
  const add = (coefficient: number, variable: string) => {
    if (!coefficient) return
    const sign = coefficient < 0 ? '−' : terms.length ? '+' : ''
    const size = Math.abs(coefficient)
    const body = `${size === 1 ? '' : size}${variable}`
    terms.push(`${sign}${terms.length ? ' ' : ''}${body}`)
  }
  add(e.a, 'x')
  add(e.b, 'y')
  return `${terms.length ? terms.join(' ') : '0'} = ${num(e.c)}`
}

export function combine(c: SimConfig, p: number, q: number): Equation {
  return {
    a: p * c.first.a + q * c.second.a,
    b: p * c.first.b + q * c.second.b,
    c: p * c.first.c + q * c.second.c,
  }
}

export function solutionOf(c: SimConfig):
  | { kind: 'one'; x: Fraction; y: Fraction }
  | { kind: 'none' | 'many' } {
  const d = c.first.a * c.second.b - c.first.b * c.second.a
  if (d === 0) {
    const same = c.first.a * c.second.c === c.second.a * c.first.c && c.first.b * c.second.c === c.second.b * c.first.c
    return { kind: same ? 'many' : 'none' }
  }
  return {
    kind: 'one',
    x: frac(c.first.c * c.second.b - c.first.b * c.second.c, d),
    y: frac(c.first.a * c.second.c - c.first.c * c.second.a, d),
  }
}

/** Non-zero multiples, small first, which remove exactly one variable. */
export function targetsOf(c: SimConfig): Target[] {
  const out: Target[] = []
  for (const variable of ['x', 'y'] as const) {
    for (let p = -MAX_MULTIPLIER; p <= MAX_MULTIPLIER; p++) for (let q = -MAX_MULTIPLIER; q <= MAX_MULTIPLIER; q++) {
      if (!p || !q) continue
      const e = combine(c, p, q)
      if (e.a === 0 && e.b === 0) continue
      if ((variable === 'x' ? e.a : e.b) === 0) out.push({ p, q, variable })
    }
  }
  const key = (t: Target) => `${t.p},${t.q},${t.variable}`
  return [...new Map(out.map((t) => [key(t), t])).values()]
    .sort((a, b) => Math.max(Math.abs(a.p), Math.abs(a.q)) - Math.max(Math.abs(b.p), Math.abs(b.q)) || Math.abs(a.p) + Math.abs(a.q) - Math.abs(b.p) - Math.abs(b.q) || a.variable.localeCompare(b.variable) || a.p - b.p || a.q - b.q)
}

const point = (raw: unknown): [number, number] | null =>
  Array.isArray(raw) && raw.length === 2 && raw.every((v) => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= GRID)
    ? [raw[0], raw[1]] : null

export function readState(state: SimState): { point: [number, number] | null; p: number; q: number; variable: 'x' | 'y' } {
  return {
    point: point(state?.point),
    p: typeof state?.p === 'number' && Number.isInteger(state.p) && Math.abs(state.p) <= MAX_MULTIPLIER ? state.p : 1,
    q: typeof state?.q === 'number' && Number.isInteger(state.q) && Math.abs(state.q) <= MAX_MULTIPLIER ? state.q : 1,
    variable: state?.variable === 'y' ? 'y' : 'x',
  }
}

export function checkSim(c: SimConfig, state: SimState): boolean {
  const s = readState(state)
  if (c.task === 'graph') {
    const answer = solutionOf(c)
    if (answer.kind !== 'one') return state?.special === answer.kind
    return !!s.point && s.point[0] === value(answer.x) && s.point[1] === value(answer.y)
  }
  const e = combine(c, s.p, s.q)
  return (e.a === 0) !== (e.b === 0) && s.p !== 0 && s.q !== 0
}

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string' && /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw.trim().replace(/−/g, '-'))) return Number(raw.trim().replace(/−/g, '-'))
  return null
}

/** ax + by = c, with terms in either order and signs, decimals included for faults to advise on. */
export function readEquation(raw: unknown): Equation | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const a = readNumber(first(o, ['a', 'x', 'xCoefficient', 'x_coefficient']))
    const b = readNumber(first(o, ['b', 'y', 'yCoefficient', 'y_coefficient']))
    const c = readNumber(first(o, ['c', 'constant', 'rhs', 'equals']))
    return a === null || b === null || c === null ? null : { a, b, c }
  }
  if (typeof raw !== 'string') return null
  const sides = raw.replace(/−|–/g, '-').split('=')
  if (sides.length !== 2) return null
  const right = readNumber(sides[1].trim())
  if (right === null) return null
  const left = sides[0].replace(/\s+/g, '')
  if (!/^[+-]?(?:(?:\d+(?:\.\d+)?|\.\d+)?[xy]|\d+(?:\.\d+)?)(?:[+-](?:(?:\d+(?:\.\d+)?|\.\d+)?[xy]|\d+(?:\.\d+)?))*$/.test(left)) return null
  let a = 0
  let b = 0
  let c = right
  for (const m of left.matchAll(/([+-]?)(\d+(?:\.\d+)?|\.\d+)?([xy])?/g)) {
    if (!m[0]) continue
    const sign = m[1] === '-' ? -1 : 1
    const n = Number(m[2] ?? 1)
    if (m[3] === 'x') a += sign * n
    else if (m[3] === 'y') b += sign * n
    else c -= sign * n
  }
  return { a: a + 0, b: b + 0, c: c + 0 }
}

function readTask(raw: unknown, hasGraphHint: boolean): SimTask | null {
  const k = keyOf(raw)
  if (!k) return hasGraphHint ? 'graph' : 'eliminate'
  if (['graph', 'graphical', 'graphically', 'intersection', 'intersect', 'find-intersection', 'point', 'solve-graphically', 'simultaneous-equations-graphically'].includes(k)) return 'graph'
  if (['eliminate', 'elimination', 'elimination-method', 'linear-combination', 'combine', 'add', 'algebraic', 'solve'].includes(k)) return 'eliminate'
  return null
}

const nearestEquation = (e: Equation): Equation => ({
  a: Math.max(-3, Math.min(3, Math.round(e.a) || 1)),
  b: Math.max(-3, Math.min(3, Math.round(e.b) || 1)),
  c: Math.max(-12, Math.min(12, Math.round(e.c))),
})
const example = (c: SimConfig) => `${equationText(nearestEquation(c.first))}; ${equationText(nearestEquation(c.second))}`

export const simultaneousEquationsEngine: SceneEngine<SimConfig, SimState> = {
  id: 'simultaneous-equations',
  covers: ['simultaneous', 'elimination'],
  phrases: [
    'simultaneous equations', 'solving simultaneous equations', 'simultaneous equations graphically', 'simultaneous linear equations',
    'elimination method', 'elimination and substitution', 'linear equations in two unknowns', 'two linear equations', 'systems of linear equations',
    'system of equations', 'two unknowns', 'intersection of two lines', 'solve simultaneous equations',
  ],
  notFor: [
    'single linear equations', 'one unknown', 'balancing equations', 'balance method', 'equation balancer', 'algebra tiles',
    'chemical equations', 'chemistry', 'straight-line graphs on their own', 'gradient', 'y-intercept',
    'inequalities', 'regions', 'quadratic equations', 'simultaneous equations one linear one quadratic', 'linear and non-linear',
    'matrices', 'three unknowns', 'solutions in chemistry', 'substitution', 'substitution method',
    'elimination reactions', 'organic chemistry',
  ],
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const list = first(src, ['equations', 'lines', 'pair'])
    const one = first(src, ['first', 'equation1', 'eq1', 'line1', 'a']) ?? (Array.isArray(list) ? list[0] : undefined)
    const two = first(src, ['second', 'equation2', 'eq2', 'line2', 'b']) ?? (Array.isArray(list) ? list[1] : undefined)
    const a = readEquation(one)
    const b = readEquation(two)
    if (!a || !b) return null
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const task = readTask(rawTask, keyOf(rawTask).includes('graph') || src.point !== undefined)
    return task ? { task, first: a, second: b } : null
  },

  faults(c) {
    const out: string[] = []
    const all = [c.first, c.second]
    if (all.some((e) => ![e.a, e.b, e.c].every(Number.isInteger))) {
      out.push(`every coefficient and constant must be a whole number so the graph and multipliers stay exact: use e.g. ${example(c)}.`)
    }
    if (all.some((e) => Math.abs(e.a) > MAX_COEFFICIENT || Math.abs(e.b) > MAX_COEFFICIENT || Math.abs(e.c) > MAX_CONSTANT)) {
      out.push(`the card takes x and y coefficients up to ${MAX_COEFFICIENT} and constants up to ${MAX_CONSTANT}: use e.g. ${example(c)}.`)
    }
    if (all.some((e) => e.a === 0 && e.b === 0)) out.push(`an equation with no x or y term is not a line: give both equations an x or y term, e.g. ${example(c)}.`)
    const answer = solutionOf(c)
    if (c.task === 'graph' && answer.kind === 'one') {
      if (answer.x.d !== 1 || answer.y.d !== 1) out.push(`graph needs a crossing at whole-number grid coordinates so the learner can place the point exactly; this one is (${fracText(answer.x)}, ${fracText(answer.y)}): use e.g. x + y = 5; x - y = 1.`)
      else if (Math.abs(value(answer.x)) > GRID || Math.abs(value(answer.y)) > GRID) out.push(`graph needs its crossing inside the grid from −${GRID} to ${GRID}; this one is (${fracText(answer.x)}, ${fracText(answer.y)}): use e.g. x + y = 5; x - y = 1.`)
    }
    if (c.task === 'eliminate') {
      if (answer.kind !== 'one') out.push(`elimination needs two different, non-parallel lines; this pair has ${answer.kind === 'none' ? 'no crossing' : 'the same line twice'}: use graph for this special case, or e.g. 2x + y = 7; x - y = 2.`)
      else if (!targetsOf(c).some((t) => Math.abs(t.p) <= 4 && Math.abs(t.q) <= 4)) out.push(`the smallest useful multipliers are larger than 4, too laborious for this card: use e.g. 2x + y = 7; x - y = 2.`)
    }
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const answer = solutionOf(c)
    const out: string[] = []
    const coordinates = /\(\s*[-−]?\s*\d+\s*,\s*[-−]?\s*\d+\s*\)/.test(text)
    const values = /(?<![+\-−–*×÷/\d]\s*)\b[xy]\s*(?:=|equals|is)\s*[-−]?\d/i.test(text)
    const numberOfSolutions = answer.kind === 'none' ? /\bno solution|\bparallel\b/i.test(text) : answer.kind === 'many' ? /\binfinite(?:ly many)? solutions|\bsame line|\bcoincident\b/i.test(text) : /\bno solution\b|\binfinite(?:ly many)? solutions\b/i.test(text)
    if (c.task === 'graph' && (coordinates || values || numberOfSolutions)) {
      out.push('the prompt gives the answer away: name the two equations and ask what satisfies both, without coordinates, values or the number of solutions.')
    }
    if (c.task === 'eliminate') {
      const multipliers = targetsOf(c).some((t) => new RegExp(`\\b${t.p}\\b[^.]{0,30}\\b${t.q}\\b|\\b${t.q}\\b[^.]{0,30}\\b${t.p}\\b`).test(text))
      if (values || coordinates || multipliers || /\bhorizontal\b|\bvertical\b|\badd (?:the )?equations\b|\bsubtract (?:the )?equations\b/i.test(text)) {
        out.push('the prompt gives the method or answer away: ask the learner to use the two multiplier controls to remove x or y, without saying which multipliers or the resulting line.')
      }
      if (/\bdrag\b|\bsubstitut|\bquadratic\b|\bcircle\b/i.test(text)) out.push('the prompt promises something this card does not do: elimination uses the − and + multiplier buttons; there is no substitution, curve or dragging.')
    }
    if (c.task === 'graph' && /\bmultiplier\b|\beliminat|\bsubstitut|\bcircle\b/i.test(text)) out.push('the prompt promises another method or a curve: this card only asks the learner to drag or tap a point onto the common solution.')
    return out
  },

  initial(c) {
    if (c.task === 'graph') {
      const answer = solutionOf(c)
      if (answer.kind !== 'one') return { point: null, p: 1, q: 1, variable: 'x', special: null }
      const at: [number, number] = answer.x.n === 0 && answer.y.n === 0 ? [1, 0] : [0, 0]
      return { point: at, p: 1, q: 1, variable: 'x', special: null }
    }
    // Never open on a line that has already eliminated a variable.
    for (const [p, q] of [[1, 1], [1, -1], [1, 2], [2, 1], [-1, 1], [2, -1]] as const) {
      const start: SimState = { point: null, p, q, variable: 'x', special: null }
      if (!checkSim(c, start)) return start
    }
    return { point: null, p: 1, q: 3, variable: 'x', special: null }
  },
  check: (c, state) => ({ ok: checkSim(c, state), wrongIds: checkSim(c, state) ? [] : [c.task === 'graph' ? 'point' : 'multipliers'] }),
  solve(c) {
    if (c.task === 'graph') {
      const answer = solutionOf(c)
      return answer.kind === 'one'
        ? { point: [value(answer.x), value(answer.y)], p: 1, q: 1, variable: 'x', special: null }
        : { point: null, p: 1, q: 1, variable: 'x', special: answer.kind }
    }
    const target = targetsOf(c)[0]
    return target ? { point: null, p: target.p, q: target.q, variable: target.variable, special: null } : { point: null, p: 1, q: 1, variable: 'x', special: null }
  },

  View: SimultaneousEquationsView,

  prompt: `SCENE "simultaneous-equations" -- two straight lines on a carefully ruled light coordinate panel, with their equations beside them. The crossing is the point that makes both equations true.
  graph: the learner drags the ring handle (or taps a grid point, or uses arrow keys) to the point satisfying both. Exact whole-number marking: a point on only one line is not enough. Parallel lines and coincident lines are also drawable special cases; their no-solution or infinitely-many-solutions meaning is explained when marked.
  eliminate: two small multiplier steppers set p and q, and the card draws and writes p(first equation) + q(second equation). The new orange line pivots around the unchanged crossing as p and q change. The learner finds non-zero multipliers that make either term disappear, leaving a vertical x = ... or horizontal y = ... line. Marking gives that value and the back-substituted other value. This makes why elimination preserves the solution visible; it is not a step-ordering quiz.
  For: simultaneous linear equations in two unknowns, graphical solutions, the meaning of an intersection, parallel and coincident lines, and the elimination method. Not for one-variable equations, inequalities, substitution, matrices, word-problem equation formation, or one linear and one non-linear equation.
  config: { "task":"graph", "first":"x + y = 5", "second":"x - y = 1" } -- equations may instead be { "a":1,"b":1,"c":5 }; graph crossings must be whole coordinates from -5 to 5.
       or { "task":"eliminate", "first":"2x + y = 7", "second":"x - y = 2" } -- non-parallel, distinct lines, with a useful multiplier of at most 4.
  Before marking graph shows only the lines, equations and the learner's current point, never whether it is right. Eliminate shows the live combined equation and line, with no solution working or correctness message. The prompt must not state coordinates, x or y values, multipliers, or whether to add or subtract. Name the equations in the prompt and say the gesture.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the ring to the point that satisfies both x + y = 5 and x - y = 1. You can also tap a grid point.",
    "payload": { "engine":"simultaneous-equations", "config": { "task":"graph", "first":"x + y = 5", "second":"x - y = 1" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:simultaneous-equations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the − and + multiplier controls to combine 2x + y = 7 and x - y = 2. Make either the x or y term disappear.",
    "payload": { "engine":"simultaneous-equations", "config": { "task":"eliminate", "first":"2x + y = 7", "second":"x - y = 2" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:simultaneous-equations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Look at 2x + y = 4 and 4x + 2y = 10 on the grid, then choose how many points satisfy both.",
    "payload": { "engine":"simultaneous-equations", "config": { "task":"graph", "first":"2x + y = 4", "second":"4x + 2y = 10" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:simultaneous-equations", "why":"..." } }
  Example prompts, each paired with its config for checking:
  "prompt":"Drag the ring to the point that satisfies both x + y = 5 and x - y = 1." "config": { "task":"graph", "first":"x + y = 5", "second":"x - y = 1" } }
  "prompt":"Use the multiplier controls to combine 2x + y = 7 and x - y = 2. Make either term disappear." "config": { "task":"eliminate", "first":"2x + y = 7", "second":"x - y = 2" } }
  "prompt":"Look at 2x + y = 4 and 4x + 2y = 10 on the grid, then choose how many points satisfy both." "config": { "task":"graph", "first":"2x + y = 4", "second":"4x + 2y = 10" } }`,
}

registerEngine(simultaneousEquationsEngine as SceneEngine<unknown, unknown>)

// ---------------------------------------------------------------------------
// Sentences used by the view only once marked.

export function graphSentence(c: SimConfig, state: SimState, right: boolean): string {
  const answer = solutionOf(c)
  if (answer.kind === 'none') return right
    ? 'There is no solution: the lines are parallel, so no point can satisfy both equations.'
    : `You chose ${state?.special === 'many' ? 'infinitely many solutions' : state?.special === 'none' ? 'no solutions' : 'no answer yet'}: the lines are parallel, so no point satisfies both.`
  if (answer.kind === 'many') return right
    ? 'There are infinitely many solutions: these are two forms of the same line, so every point on it satisfies both.'
    : `You chose ${state?.special === 'none' ? 'no solutions' : state?.special === 'many' ? 'infinitely many solutions' : 'no answer yet'}: the two equations describe the same line, so every point on it works.`
  if (answer.kind !== 'one') return ''
  const at = `(${fracText(answer.x)}, ${fracText(answer.y)})`
  if (right) return `Yes: ${at} lies on both lines, so x = ${fracText(answer.x)} and y = ${fracText(answer.y)} satisfy both equations.`
  const p = readState(state).point
  if (!p) return 'No point has been placed yet. A solution must lie on both lines, not just one.'
  const onFirst = c.first.a * p[0] + c.first.b * p[1] === c.first.c
  const onSecond = c.second.a * p[0] + c.second.b * p[1] === c.second.c
  const where = `You placed (${p[0]}, ${p[1]})`.replace(/-/g, '−')
  if (onFirst && !onSecond) return `${where}: it satisfies the first equation, but not the second.`
  if (!onFirst && onSecond) return `${where}: it satisfies the second equation, but not the first.`
  return `${where}: it lies on neither line.`
}

export function eliminationSentence(c: SimConfig, state: SimState, right: boolean): string {
  const s = readState(state)
  const made = combine(c, s.p, s.q)
  if (made.a === 0 && made.b === 0) return `You made 0 = ${num(made.c)}: both variables disappeared, so there is no value to read.`
  const answer = solutionOf(c)
  if (right && answer.kind === 'one') {
    const firstValue = made.a === 0 ? answer.y : answer.x
    const other = made.a === 0 ? 'x' : 'y'
    const otherValue = made.a === 0 ? answer.x : answer.y
    return `Yes. ${equationText(made)}, so ${made.a === 0 ? 'y' : 'x'} = ${fracText(firstValue)}. Substitute that into either original equation: ${other} = ${fracText(otherValue)}. Every combined line still goes through (${fracText(answer.x)}, ${fracText(answer.y)}).`
  }
  if (made.a !== 0 && made.b !== 0) return `You made ${equationText(made)}. Both x and y are still present; keep changing the multipliers.`
  return `You made ${equationText(made)}: one variable remains.`
}
